// game.js - Core game loop, match management, shooting, scoring

class Game {
    constructor() {
        // Three.js setup
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !isMobile });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = !isMobile; // Disable shadows on mobile for performance
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

        // Systems
        this.mapBuilder = new MapBuilder(this.scene);
        this.hud = new HUD();
        this.player = null;
        this.bots = [];
        this.pickups = [];
        this.navGrid = null;
        this.colliders = [];

        // Match state
        this.mapId = 'warehouse';
        this.gameMode = 'ffa';
        this.difficulty = 'medium';
        this.botCount = 8;
        this.matchTime = GAME_CONSTANTS.MATCH_DURATION;
        this.timeRemaining = this.matchTime;
        this.isRunning = false;
        this.isPaused = false;

        // Respawn
        this.respawnQueue = [];

        // Muzzle flash
        this.muzzleFlash = this._createMuzzleFlash();
        this.scene.add(this.muzzleFlash);

        // Tracer lines
        this.tracers = [];

        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _createMuzzleFlash() {
        // Create a radial gradient texture for a more convincing flash
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,230,180,1)');
        gradient.addColorStop(0.3, 'rgba(255,170,68,0.8)');
        gradient.addColorStop(0.7, 'rgba(255,100,20,0.3)');
        gradient.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.6, 0.6, 0.6);
        return sprite;
    }

    startMatch(options) {
        this.mapId = options.map;
        this.gameMode = options.mode;
        this.difficulty = options.difficulty;
        this.botCount = options.botCount;

        // Clear previous match
        this._cleanup();

        // Build map
        this.colliders = this.mapBuilder.build(this.mapId);

        // Build navmesh
        const mapDef = MAPS[this.mapId];
        this.navGrid = new NavGrid(mapDef.size);
        this.navGrid.bake(this.colliders);

        // Create player
        this.player = new Player(this.scene, this.camera);
        this.player.name = 'Player';
        const playerSpawn = mapDef.spawnPoints[0];
        this.player.respawn(playerSpawn);

        // Assign teams
        if (this.gameMode === 'tdm') {
            this.player.team = 'red';
        }

        // Create bots
        const availableNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
        for (let i = 0; i < this.botCount; i++) {
            const name = availableNames[i % availableNames.length];
            let team = 'none';
            if (this.gameMode === 'tdm') {
                team = i < this.botCount / 2 ? 'red' : 'blue';
            }

            const bot = new Bot(name, this.difficulty, team, this.scene);
            const spawnIdx = (i + 1) % mapDef.spawnPoints.length;
            bot.respawn(mapDef.spawnPoints[spawnIdx]);
            this.bots.push(bot);
        }

        // Create pickups
        for (const loc of mapDef.pickupLocations) {
            this.pickups.push(new Pickup(this.scene, loc.x, loc.z, loc.type));
        }

        // Start
        this.timeRemaining = this.matchTime;
        this.isRunning = true;
        this.isPaused = false;
        this.respawnQueue = [];
        this.hud.show();

        audioManager.init();

        // Lock pointer (desktop) or go fullscreen (mobile)
        if (touchControls.active) {
            touchControls.show();
            this._requestFullscreen();
        } else {
            this.canvas.requestPointerLock();
        }
    }

    _cleanup() {
        this.mapBuilder.clear();
        for (const bot of this.bots) bot.destroy();
        for (const pickup of this.pickups) pickup.destroy();
        for (const tracer of this.tracers) {
            this.scene.remove(tracer.mesh);
            tracer.mesh.geometry.dispose();
            tracer.mesh.material.dispose();
        }
        this.bots = [];
        this.pickups = [];
        this.tracers = [];
        this.player = null;
    }

    update(dt) {
        if (!this.isRunning || this.isPaused) return;

        const time = performance.now() / 1000;
        const allEntities = this._getAllEntities();

        // Match timer
        this.timeRemaining -= dt;
        if (this.timeRemaining <= 0) {
            this._endMatch();
            return;
        }

        // Update player
        if (this.player.isAlive) {
            this.player.update(dt, this.colliders, time);
            if (this.player.spawnProtectionTimer > 0) {
                this.player.spawnProtectionTimer = Math.max(0, this.player.spawnProtectionTimer - dt);
            }
            this._handlePlayerShooting(time);
        }

        // Update bots
        const gameState = {
            colliders: this.colliders,
            navGrid: this.navGrid,
            entities: allEntities,
            pickups: this.pickups,
            mapId: this.mapId,
            playerPos: this.player.position,
        };

        for (const bot of this.bots) {
            bot.update(dt, gameState);

            // Bot shooting returns hit info
            if (bot.isAlive && bot.wantsToShoot) {
                const hitInfo = bot._tryShoot(time,
                    bot.target ? distance3D(bot.position, bot.target.position) : 0,
                    gameState
                );
                if (hitInfo) {
                    this._applyDamage(hitInfo.target, hitInfo.damage, bot, hitInfo.headshot);
                }
            }
        }

        // Pickups
        for (const pickup of this.pickups) {
            pickup.update(dt, time);
            if (pickup.active) {
                pickup.tryPickup(this.player);
                for (const bot of this.bots) {
                    if (bot.isAlive) pickup.tryPickup(bot);
                }
            }
        }

        // Respawn queue
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            const entry = this.respawnQueue[i];
            entry.timer -= dt;

            if (entry.entity === this.player) {
                this.hud.showRespawnScreen(entry.killer, entry.timer);
            }

            if (entry.timer <= 0) {
                const mapDef = MAPS[this.mapId];
                const spawn = this._getValidSpawn(mapDef.spawnPoints);
                entry.entity.respawn(spawn);
                if (entry.entity === this.player) {
                    this.hud.hideRespawnScreen();
                    if (!touchControls.active) {
                        this.canvas.requestPointerLock();
                    }
                }
                this.respawnQueue.splice(i, 1);
            }
        }

        // Update tracers
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const tracer = this.tracers[i];
            tracer.life -= dt;
            tracer.mesh.material.opacity = tracer.life / 0.1;
            if (tracer.life <= 0) {
                this.scene.remove(tracer.mesh);
                tracer.mesh.geometry.dispose();
                tracer.mesh.material.dispose();
                this.tracers.splice(i, 1);
            }
        }

        // Muzzle flash
        if (this.muzzleFlash.material.opacity > 0) {
            this.muzzleFlash.material.opacity -= dt * 20;
        }

        // Tab for scoreboard
        const showScoreboard = this.player.keys && this.player.keys['Tab'];
        this.hud.updateScoreboard(allEntities, showScoreboard);

        // HUD update
        this.hud.update(this.player, allEntities, this.timeRemaining, dt);
    }

    _handlePlayerShooting(time) {
        if (!this.player.isAlive) return;
        if (!document.pointerLockElement && !touchControls.active) return;

        const weapon = this.player.weapon;

        // For semi-auto, only fire on initial click (not hold)
        if (!weapon.def.automatic) {
            if (this.player.mouseDown && !this.player._lastMouseDown) {
                this.player._lastMouseDown = true;
                // fall through to fire
            } else {
                if (!this.player.mouseDown) this.player._lastMouseDown = false;
                return;
            }
        } else {
            if (!this.player.mouseDown) return;
        }

        if (!weapon.canFire(time)) {
            if (weapon.currentAmmo === 0 && !weapon.isReloading) {
                audioManager.play('dryfire', 0.3);
            }
            return;
        }

        if (!weapon.fire(time)) return;

        // Sound & visual
        audioManager.play(weapon.def.sound, 0.6);
        this._showMuzzleFlash();

        // Raycasting
        const pellets = weapon.def.pellets || 1;
        for (let p = 0; p < pellets; p++) {
            const ray = this.player.getFireRay();

            // Apply spread
            const spread = weapon.def.spread + (this.player.isSprinting ? 0.03 : 0) +
                          (!this.player.onGround ? 0.05 : 0);
            ray.direction.x += (Math.random() - 0.5) * spread;
            ray.direction.y += (Math.random() - 0.5) * spread;
            ray.direction.normalize();

            // Check hits on bots
            let closestHit = null;
            let closestDist = weapon.def.range;

            for (const bot of this.bots) {
                if (!bot.isAlive) continue;
                if (this.gameMode === 'tdm' && bot.team === this.player.team) continue;

                // Hit detection using bounding box
                const botBox = {
                    min: { x: bot.position.x - 0.35, y: 0, z: bot.position.z - 0.35 },
                    max: { x: bot.position.x + 0.35, y: GAME_CONSTANTS.PLAYER_HEIGHT + 0.2, z: bot.position.z + 0.35 }
                };

                const t = rayIntersectsBox(ray.origin, ray.direction, botBox);
                if (t !== null && t < closestDist) {
                    // Check wall occlusion
                    let occluded = false;
                    for (const col of this.colliders) {
                        const wallT = rayIntersectsBox(ray.origin, ray.direction, col);
                        if (wallT !== null && wallT < t) {
                            occluded = true;
                            break;
                        }
                    }
                    if (!occluded) {
                        closestDist = t;
                        // Determine headshot
                        const hitY = ray.origin.y + ray.direction.y * t;
                        const isHeadshot = hitY > GAME_CONSTANTS.PLAYER_HEIGHT - 0.2;
                        closestHit = { bot, dist: t, headshot: isHeadshot };
                    }
                }
            }

            if (closestHit) {
                const damage = weapon.def.damage *
                    (closestHit.headshot ? weapon.def.headshotMultiplier : 1);
                this._applyDamage(closestHit.bot, damage, this.player, closestHit.headshot);
                this.hud.showHitMarker();
                audioManager.play('hit', 0.4);
            }

            // Create tracer
            const endPoint = ray.origin.clone().add(
                ray.direction.clone().multiplyScalar(closestHit ? closestHit.dist : Math.min(closestDist, 50))
            );
            this._createTracer(ray.origin, endPoint);
        }
    }

    _applyDamage(target, damage, attacker, headshot) {
        // Spawn protection: no damage while protected
        if (target.spawnProtectionTimer > 0) return;

        const killed = target.takeDamage(damage, attacker.name);

        if (target === this.player) {
            this.hud.showDamage();
        }

        if (killed) {
            attacker.kills++;
            attacker.score += headshot ? 150 : 100;

            this.hud.addKillfeedEntry(
                attacker.name,
                target.name,
                attacker.weapon ? attacker.weapon.def.name :
                    (attacker.weapons ? attacker.weapons[attacker.currentWeaponIndex].def.name : 'WEAPON'),
                headshot
            );

            if (target === this.player) {
                audioManager.play('death', 0.6);
            } else {
                audioManager.play3D('death', this.player.position, target.position, 0.5);
            }

            // Queue respawn
            this.respawnQueue.push({
                entity: target,
                timer: GAME_CONSTANTS.RESPAWN_TIME,
                killer: attacker.name
            });
        }
    }

    _showMuzzleFlash() {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.muzzleFlash.position.copy(this.camera.position).add(forward.multiplyScalar(1));
        this.muzzleFlash.material.opacity = 1;
    }

    _createTracer(start, end) {
        // Billboard plane tracer for visible thickness (WebGL clamps linewidth to 1)
        const dir = new THREE.Vector3().subVectors(end, start);
        const length = dir.length();
        dir.normalize();

        // Create a thin plane oriented toward the camera
        const geo = new THREE.PlaneGeometry(length, 0.04);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);

        // Position and orient the tracer
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mesh.position.copy(mid);
        mesh.lookAt(this.camera.position);

        // Rotate to align with bullet direction (in the plane facing camera)
        const projected = dir.clone();
        const camDir = new THREE.Vector3().subVectors(this.camera.position, mid).normalize();
        const right = new THREE.Vector3().crossVectors(camDir, projected).normalize();
        const up = new THREE.Vector3().crossVectors(projected, right).normalize();
        mesh.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(projected, up, right.negate())
        );

        this.scene.add(mesh);
        this.tracers.push({ mesh, life: 0.1 });

        // Bright muzzle point
        const pointGeo = new THREE.SphereGeometry(0.03, 4, 4);
        const pointMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const point = new THREE.Mesh(pointGeo, pointMat);
        point.position.copy(start);
        this.scene.add(point);
        this.tracers.push({ mesh: point, life: 0.08 });
    }

    _getValidSpawn(spawnPoints) {
        const radius = 0.4;
        const valid = spawnPoints.filter(sp =>
            !this.colliders.some(c =>
                sp.x + radius > c.min.x && sp.x - radius < c.max.x &&
                sp.z + radius > c.min.z && sp.z - radius < c.max.z
            )
        );
        return randomElement(valid.length > 0 ? valid : spawnPoints);
    }

    _getAllEntities() {
        if (!this.player) return [];
        return [this.player, ...this.bots];
    }

    _endMatch() {
        this.isRunning = false;
        if (document.pointerLockElement) document.exitPointerLock();
        if (touchControls.active) touchControls.hide();

        const allEntities = this._getAllEntities();
        const sorted = [...allEntities].sort((a, b) => b.score - a.score);

        this.hud.updateScoreboard(allEntities, true);

        // Show end match after a delay, then return to menu
        setTimeout(() => {
            this.hud.hide();
            this.hud.updateScoreboard([], false);
            this.hud.hideRespawnScreen();
            document.getElementById('menu-screen').style.display = 'flex';
            this._cleanup();
            // Exit fullscreen
            const eFS = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
            if (eFS && document.fullscreenElement) eFS.call(document).catch(() => {});
        }, 5000);
    }

    _requestFullscreen() {
        const el = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) {
            rfs.call(el).catch(() => {});
        }
        // Lock orientation to landscape if possible
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
