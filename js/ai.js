// ai.js - AI Bot system with behavior trees and tactical decision-making

const AI_DIFFICULTY = {
    easy: {
        reactionTime: 0.5,      // seconds
        accuracy: 0.30,
        aimSpeed: 1.5,           // radians/sec
        strafeChance: 0.2,
        flankChance: 0.05,
        campChance: 0.05,
        awarenessRadius: 25,
        shootWhileMoving: false,
        burstLength: [1, 3],
        burstPause: [0.5, 1.0],
    },
    medium: {
        reactionTime: 0.28,
        accuracy: 0.55,
        aimSpeed: 3.0,
        strafeChance: 0.5,
        flankChance: 0.2,
        campChance: 0.15,
        awarenessRadius: 35,
        shootWhileMoving: true,
        burstLength: [2, 5],
        burstPause: [0.3, 0.7],
    },
    hard: {
        reactionTime: 0.12,
        accuracy: 0.75,
        aimSpeed: 5.0,
        strafeChance: 0.8,
        flankChance: 0.4,
        campChance: 0.2,
        awarenessRadius: 50,
        shootWhileMoving: true,
        burstLength: [3, 8],
        burstPause: [0.15, 0.4],
    }
};

const BOT_VOICE_LINES = [
    'Enemy spotted!', 'Taking fire!', 'Need backup!',
    'Reloading!', 'Got one!', 'Watch your six!',
    'Moving up!', 'Cover me!', 'Fall back!',
    'Nice shot!', 'Behind you!', 'Area clear.',
];

// Behavior states
const BotState = {
    IDLE: 'idle',
    PATROL: 'patrol',
    HUNT: 'hunt',
    ATTACK: 'attack',
    FLEE: 'flee',
    FIND_HEALTH: 'findHealth',
    FIND_AMMO: 'findAmmo',
    INVESTIGATE: 'investigate',
};

class Bot {
    constructor(name, difficulty, team, scene) {
        this.name = name;
        this.difficulty = AI_DIFFICULTY[difficulty];
        this.difficultyName = difficulty;
        this.team = team;
        this.scene = scene;

        // Position & movement
        this.position = new THREE.Vector3(0, GAME_CONSTANTS.PLAYER_HEIGHT, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.onGround = true;

        // Spawn protection
        this.spawnProtectionTimer = 0;
        this.spawnShield = null;

        // Stats
        this.health = GAME_CONSTANTS.MAX_HEALTH;
        this.armor = 0;
        this.kills = 0;
        this.deaths = 0;
        this.score = 0;
        this.isAlive = true;

        // Weapon
        this.weapons = [
            new WeaponState('rifle'),
            new WeaponState('shotgun'),
            new WeaponState('smg'),
        ];
        this.currentWeaponIndex = 0;

        // AI state
        this.state = BotState.PATROL;
        this.stateTimer = 0;
        this.target = null;           // Current enemy target
        this.lastKnownEnemyPos = null;
        this.path = null;
        this.pathIndex = 0;
        this.patrolTarget = null;
        this.reactionTimer = 0;
        this.canSeeTarget = false;
        this.lastSeenTime = 0;
        this.stuckTimer = 0;
        this.lastPosition = new THREE.Vector3();

        // Combat
        this.burstCount = 0;
        this.burstMax = 3;
        this.burstPauseTimer = 0;
        this.lastFireTime = 0;

        // Strafing
        this.strafeDir = 1;
        this.strafeTimer = 0;
        this.isStrafing = false;
        this.wantsToShoot = false;

        // Visual representation
        this.mesh = this._createMesh();
        scene.add(this.mesh);

        // Nameplate
        this.nameSprite = this._createNameSprite();
        scene.add(this.nameSprite);
    }

    get weapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    _createMesh() {
        const group = new THREE.Group();

        const bodyColor = this.team === 'red' ? 0xcc3333 :
                         this.team === 'blue' ? 0x3333cc : 0x888888;
        const teamEmissive = this.team === 'red' ? 0x440000 :
                            this.team === 'blue' ? 0x000044 : 0x222222;

        // Body (base layer)
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.7,
            metalness: 0.15
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);

        // Armor vest overlay
        const vestGeo = new THREE.CylinderGeometry(0.33, 0.36, 0.7, 12);
        const vestMat = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.5,
            metalness: 0.3,
            emissive: teamEmissive,
            emissiveIntensity: 0.4
        });
        const vest = new THREE.Mesh(vestGeo, vestMat);
        vest.position.y = 0.75;
        vest.castShadow = true;
        group.add(vest);

        // Shoulder pads
        for (const side of [-1, 1]) {
            const padGeo = new THREE.SphereGeometry(0.12, 8, 6);
            const padMat = new THREE.MeshStandardMaterial({
                color: bodyColor,
                roughness: 0.4,
                metalness: 0.4,
                emissive: teamEmissive,
                emissiveIntensity: 0.3
            });
            const pad = new THREE.Mesh(padGeo, padMat);
            pad.position.set(side * 0.32, 1.1, 0);
            pad.scale.set(1, 0.7, 1);
            group.add(pad);
        }

        // Head
        const headGeo = new THREE.SphereGeometry(0.2, 12, 10);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xddbb99,
            roughness: 0.6,
            metalness: 0.05
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.4;
        head.castShadow = true;
        group.add(head);
        this.headMesh = head;

        // Visor
        const visorGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
        const visorMat = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.1,
            metalness: 0.8,
            emissive: bodyColor,
            emissiveIntensity: 0.5
        });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.42, -0.16);
        group.add(visor);

        // Weapon visual
        const gunGeo = new THREE.BoxGeometry(0.06, 0.1, 0.55);
        const gunMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.3,
            metalness: 0.8
        });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.25, 1.0, -0.3);
        group.add(gun);
        this.gunMesh = gun;

        // Gun barrel detail
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.25, 1.0, -0.65);
        group.add(barrel);

        // Spawn protection shield
        const shieldGeo = new THREE.SphereGeometry(0.8, 16, 12);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0,
            wireframe: true,
            depthWrite: false
        });
        this.spawnShield = new THREE.Mesh(shieldGeo, shieldMat);
        this.spawnShield.position.y = 0.8;
        this.spawnShield.visible = false;
        group.add(this.spawnShield);

        return group;
    }

    _createNameSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.name, 128, 40);
        ctx.fillText(this.name, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 0.5, 1);
        return sprite;
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.nameSprite);
        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        if (this.nameSprite.material.map) this.nameSprite.material.map.dispose();
        this.nameSprite.material.dispose();
    }

    update(dt, gameState) {
        if (!this.isAlive) {
            this.mesh.visible = false;
            this.nameSprite.visible = false;
            return;
        }
        this.mesh.visible = true;
        this.nameSprite.visible = true;

        const time = performance.now() / 1000;
        const { colliders, navGrid, entities, pickups } = gameState;

        // Check if stuck
        if (this.lastPosition.distanceTo(this.position) < 0.05) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = 0;
        }
        this.lastPosition.copy(this.position);

        // Perception - find targets
        this._updatePerception(entities, colliders, time);

        // Behavior tree
        this._runBehaviorTree(dt, time, gameState);

        // Movement physics
        this._applyMovement(dt, colliders);

        // Aim smoothing
        this._updateAim(dt);

        // Weapon update
        this.weapon.updateRecoil(dt);
        this.weapon.updateReload(time);

        // Auto reload
        if (this.weapon.currentAmmo === 0 && !this.weapon.isReloading && this.weapon.reserveAmmo > 0) {
            this.weapon.startReload(time);
        }

        // Spawn protection timer
        if (this.spawnProtectionTimer > 0) {
            this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
        }

        // Update spawn shield visual
        if (this.spawnShield) {
            if (this.spawnProtectionTimer > 0) {
                this.spawnShield.visible = true;
                this.spawnShield.material.opacity = 0.15 + 0.12 * Math.sin(time * 8);
                this.spawnShield.rotation.y += dt * 2;
                this.spawnShield.rotation.x += dt * 1.3;
            } else {
                this.spawnShield.visible = false;
            }
        }

        // Update visual
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 0;
        this.mesh.rotation.y = this.lookYaw;
        this.gunMesh.rotation.y = 0;

        this.nameSprite.position.copy(this.position);
        this.nameSprite.position.y = 2.0;
    }

    _updatePerception(entities, colliders, time) {
        this.canSeeTarget = false;
        let closestDist = Infinity;
        let closestEntity = null;

        for (const entity of entities) {
            if (entity === this || !entity.isAlive) continue;
            if (this.team !== 'none' && entity.team === this.team) continue;

            const dist = distance3D(this.position, entity.position);
            if (dist > this.difficulty.awarenessRadius) continue;

            // Line of sight check
            if (this._hasLineOfSight(entity.position, colliders)) {
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEntity = entity;
                }
            }
        }

        if (closestEntity) {
            this.target = closestEntity;
            this.lastKnownEnemyPos = closestEntity.position.clone();
            this.canSeeTarget = true;
            this.lastSeenTime = time;
        } else if (time - this.lastSeenTime > 5) {
            this.target = null;
            this.lastKnownEnemyPos = null;
        }
    }

    _hasLineOfSight(targetPos, colliders) {
        const eyePos = this.position.clone();
        eyePos.y = GAME_CONSTANTS.PLAYER_HEIGHT * 0.9;

        const dir = new THREE.Vector3().subVectors(targetPos, eyePos);
        const dist = dir.length();
        dir.normalize();

        for (const col of colliders) {
            const t = rayIntersectsBox(eyePos, dir, col);
            if (t !== null && t < dist) {
                return false;
            }
        }
        return true;
    }

    _runBehaviorTree(dt, time, gameState) {
        // Priority 1: Self-preservation
        if (this.health < 25 && this._findNearbyPickup(gameState.pickups, 'health')) {
            this.state = BotState.FIND_HEALTH;
        }
        // Priority 2: Need ammo
        else if (this.weapon.currentAmmo === 0 && this.weapon.reserveAmmo === 0 &&
                 this._findNearbyPickup(gameState.pickups, 'ammo')) {
            this.state = BotState.FIND_AMMO;
        }
        // Priority 3: Enemy visible - attack
        else if (this.canSeeTarget && this.target) {
            if (this.state !== BotState.ATTACK) {
                this.reactionTimer = this.difficulty.reactionTime * (0.8 + Math.random() * 0.4);
            }
            this.state = BotState.ATTACK;
        }
        // Priority 4: Recently saw enemy - hunt
        else if (this.lastKnownEnemyPos && time - this.lastSeenTime < 5) {
            this.state = BotState.HUNT;
        }
        // Priority 5: Stuck - reset
        else if (this.stuckTimer > 2) {
            this.state = BotState.PATROL;
            this.path = null;
            this.patrolTarget = null;
            this.stuckTimer = 0;
        }
        // Default: Patrol
        else if (this.state !== BotState.PATROL && this.state !== BotState.INVESTIGATE) {
            this.state = BotState.PATROL;
        }

        // Execute current state
        switch (this.state) {
            case BotState.PATROL:
                this._doPatrol(dt, gameState);
                break;
            case BotState.HUNT:
                this._doHunt(dt, gameState);
                break;
            case BotState.ATTACK:
                this._doAttack(dt, time, gameState);
                break;
            case BotState.FLEE:
                this._doFlee(dt, gameState);
                break;
            case BotState.FIND_HEALTH:
            case BotState.FIND_AMMO:
                this._doFindPickup(dt, gameState);
                break;
        }
    }

    _doPatrol(dt, gameState) {
        if (!this.patrolTarget || this._reachedTarget(this.patrolTarget, 2)) {
            // Pick random patrol point
            const map = MAPS[gameState.mapId];
            this.patrolTarget = {
                x: randomInRange(-map.size.x / 2 + 5, map.size.x / 2 - 5),
                z: randomInRange(-map.size.z / 2 + 5, map.size.z / 2 - 5)
            };
            this.path = gameState.navGrid.findPath(
                this.position.x, this.position.z,
                this.patrolTarget.x, this.patrolTarget.z
            );
            this.pathIndex = 0;
        }

        this._followPath(dt, GAME_CONSTANTS.PLAYER_SPEED * 0.6);

        // Look in movement direction
        if (this.path && this.pathIndex < this.path.length) {
            const target = this.path[this.pathIndex];
            this.targetYaw = Math.atan2(target.x - this.position.x, target.z - this.position.z);
            this.targetPitch = 0;
        }
    }

    _doHunt(dt, gameState) {
        if (this.lastKnownEnemyPos) {
            if (!this.path || this._reachedTarget(this.lastKnownEnemyPos, 3)) {
                if (this._reachedTarget(this.lastKnownEnemyPos, 3)) {
                    this.state = BotState.PATROL;
                    this.lastKnownEnemyPos = null;
                    return;
                }
                this.path = gameState.navGrid.findPath(
                    this.position.x, this.position.z,
                    this.lastKnownEnemyPos.x, this.lastKnownEnemyPos.z
                );
                this.pathIndex = 0;
            }
            this._followPath(dt, GAME_CONSTANTS.PLAYER_SPEED * 0.8);

            // Look towards last known position
            this.targetYaw = Math.atan2(
                this.lastKnownEnemyPos.x - this.position.x,
                this.lastKnownEnemyPos.z - this.position.z
            );
        }
    }

    _doAttack(dt, time, gameState) {
        if (!this.target || !this.target.isAlive) {
            this.state = BotState.PATROL;
            return;
        }

        const dist = distance3D(this.position, this.target.position);

        // Aim at target
        const dx = this.target.position.x - this.position.x;
        const dz = this.target.position.z - this.position.z;
        const dy = (this.target.position.y - 0.3) - this.position.y;
        const hDist = Math.sqrt(dx * dx + dz * dz);

        this.targetYaw = Math.atan2(dx, dz);
        this.targetPitch = Math.atan2(dy, hDist);

        // Reaction time
        if (this.reactionTimer > 0) {
            this.reactionTimer -= dt;
            return;
        }

        // Strafing while shooting
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
            this.isStrafing = Math.random() < this.difficulty.strafeChance;
            this.strafeDir = Math.random() < 0.5 ? 1 : -1;
            this.strafeTimer = randomInRange(0.5, 1.5);
        }

        if (this.isStrafing && dist > 5) {
            const strafeAngle = this.lookYaw + (Math.PI / 2) * this.strafeDir;
            this.velocity.x = Math.sin(strafeAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.5;
            this.velocity.z = Math.cos(strafeAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.5;
        }

        // Distance management
        const idealDist = this.weapon.id === 'shotgun' ? 8 : this.weapon.id === 'sniper' ? 30 : 15;
        if (dist > idealDist + 5) {
            // Move closer
            const moveAngle = this.targetYaw;
            this.velocity.x += Math.sin(moveAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.4 * dt * 10;
            this.velocity.z += Math.cos(moveAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.4 * dt * 10;
        } else if (dist < idealDist - 5 && this.health < 50) {
            // Back away if too close and low health
            const moveAngle = this.targetYaw + Math.PI;
            this.velocity.x += Math.sin(moveAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.3 * dt * 10;
            this.velocity.z += Math.cos(moveAngle) * GAME_CONSTANTS.PLAYER_SPEED * 0.3 * dt * 10;
        }

        // Shooting flag - actual shooting handled by game loop
        this.wantsToShoot = this.canSeeTarget && this.burstPauseTimer <= 0;
        if (!this.wantsToShoot) {
            this.burstPauseTimer -= dt;
        }
    }

    _tryShoot(time, dist, gameState) {
        if (!this.weapon.canFire(time)) return;
        if (this.weapon.currentAmmo === 0) return;

        // Check aim accuracy
        const aimError = Math.abs(this._angleDiff(this.lookYaw, this.targetYaw)) +
                        Math.abs(this.lookPitch - this.targetPitch);

        if (aimError > 0.15) return; // Don't shoot if not aimed well enough

        // Apply accuracy
        const willHit = Math.random() < this.difficulty.accuracy;

        if (this.weapon.fire(time)) {
            this.lastFireTime = time;
            audioManager.play3D(this.weapon.def.sound, gameState.playerPos, this.position, 0.7);

            this.burstCount++;
            if (this.burstCount >= this.burstMax) {
                this.burstCount = 0;
                this.burstMax = randomInRange(
                    this.difficulty.burstLength[0],
                    this.difficulty.burstLength[1]
                ) | 0;
                this.burstPauseTimer = randomInRange(
                    this.difficulty.burstPause[0],
                    this.difficulty.burstPause[1]
                );
            }

            if (willHit && this.target && this.target.isAlive) {
                // Hit target
                const damage = this.weapon.def.damage;
                const isHeadshot = Math.random() < 0.1;
                const finalDamage = isHeadshot ? damage * this.weapon.def.headshotMultiplier : damage;

                // Shotgun pellets
                if (this.weapon.def.pellets) {
                    const pelletsHit = Math.ceil(this.weapon.def.pellets * this.difficulty.accuracy * (1 - dist / this.weapon.def.range));
                    const totalDamage = finalDamage * Math.max(1, pelletsHit);
                    return { target: this.target, damage: totalDamage, headshot: isHeadshot };
                }

                return { target: this.target, damage: finalDamage, headshot: isHeadshot };
            }
        }
        return null;
    }

    _doFlee(dt, gameState) {
        if (!this.target) {
            this.state = BotState.FIND_HEALTH;
            return;
        }

        // Run away from target
        const awayAngle = Math.atan2(
            this.position.x - this.target.position.x,
            this.position.z - this.target.position.z
        );

        const fleeX = this.position.x + Math.sin(awayAngle) * 20;
        const fleeZ = this.position.z + Math.cos(awayAngle) * 20;

        if (!this.path) {
            this.path = gameState.navGrid.findPath(this.position.x, this.position.z, fleeX, fleeZ);
            this.pathIndex = 0;
        }

        this._followPath(dt, GAME_CONSTANTS.PLAYER_SPEED * GAME_CONSTANTS.SPRINT_MULTIPLIER);
    }

    _doFindPickup(dt, gameState) {
        const type = this.state === BotState.FIND_HEALTH ? 'health' : 'ammo';
        const pickup = this._findNearbyPickup(gameState.pickups, type);

        if (!pickup) {
            this.state = BotState.PATROL;
            return;
        }

        if (!this.path || this._reachedTarget({ x: pickup.position.x, z: pickup.position.z }, 2)) {
            this.path = gameState.navGrid.findPath(
                this.position.x, this.position.z,
                pickup.position.x, pickup.position.z
            );
            this.pathIndex = 0;
        }

        this._followPath(dt, GAME_CONSTANTS.PLAYER_SPEED * 0.9);

        if (this._reachedTarget({ x: pickup.position.x, z: pickup.position.z }, 2)) {
            this.state = BotState.PATROL;
        }
    }

    _findNearbyPickup(pickups, type) {
        let closest = null;
        let closestDist = Infinity;

        for (const p of pickups) {
            if (!p.active || p.type !== type) continue;
            const dist = distance2D(this.position, p.position);
            if (dist < closestDist) {
                closestDist = dist;
                closest = p;
            }
        }
        return closest;
    }

    _followPath(dt, speed) {
        if (!this.path || this.pathIndex >= this.path.length) {
            this.path = null;
            return;
        }

        const target = this.path[this.pathIndex];
        const dx = target.x - this.position.x;
        const dz = target.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.5) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.path = null;
                return;
            }
        }

        const angle = Math.atan2(dx, dz);
        this.velocity.x = Math.sin(angle) * speed;
        this.velocity.z = Math.cos(angle) * speed;

        // Look in movement direction when not in combat
        if (this.state !== BotState.ATTACK) {
            this.targetYaw = angle;
            this.targetPitch = 0;
        }
    }

    _reachedTarget(target, threshold) {
        const dx = target.x - this.position.x;
        const dz = target.z - this.position.z;
        return (dx * dx + dz * dz) < threshold * threshold;
    }

    _angleDiff(a, b) {
        let diff = b - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return diff;
    }

    _updateAim(dt) {
        const yawDiff = this._angleDiff(this.lookYaw, this.targetYaw);
        const pitchDiff = this.targetPitch - this.lookPitch;

        const aimSpeed = this.difficulty.aimSpeed * dt;

        if (Math.abs(yawDiff) > aimSpeed) {
            this.lookYaw += Math.sign(yawDiff) * aimSpeed;
        } else {
            this.lookYaw = this.targetYaw;
        }

        if (Math.abs(pitchDiff) > aimSpeed * 0.5) {
            this.lookPitch += Math.sign(pitchDiff) * aimSpeed * 0.5;
        } else {
            this.lookPitch = this.targetPitch;
        }

        // Normalize yaw
        while (this.lookYaw > Math.PI) this.lookYaw -= Math.PI * 2;
        while (this.lookYaw < -Math.PI) this.lookYaw += Math.PI * 2;
    }

    _applyMovement(dt, colliders) {
        // Clamp velocity
        const maxSpeed = GAME_CONSTANTS.PLAYER_SPEED * GAME_CONSTANTS.SPRINT_MULTIPLIER;
        const hSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (hSpeed > maxSpeed) {
            this.velocity.x = (this.velocity.x / hSpeed) * maxSpeed;
            this.velocity.z = (this.velocity.z / hSpeed) * maxSpeed;
        }

        // Apply gravity
        this.velocity.y += GAME_CONSTANTS.GRAVITY * dt;

        const radius = GAME_CONSTANTS.PLAYER_RADIUS;
        const height = GAME_CONSTANTS.PLAYER_HEIGHT;

        // Move X with collision
        const newX = this.position.x + this.velocity.x * dt;
        let blocked = false;
        for (const col of colliders) {
            if (newX + radius > col.min.x && newX - radius < col.max.x &&
                this.position.z + radius > col.min.z && this.position.z - radius < col.max.z &&
                this.position.y - height + 0.3 < col.max.y && this.position.y > col.min.y) {
                blocked = true;
                break;
            }
        }
        if (!blocked) this.position.x = newX;

        // Move Z with collision
        const newZ = this.position.z + this.velocity.z * dt;
        blocked = false;
        for (const col of colliders) {
            if (this.position.x + radius > col.min.x && this.position.x - radius < col.max.x &&
                newZ + radius > col.min.z && newZ - radius < col.max.z &&
                this.position.y - height + 0.3 < col.max.y && this.position.y > col.min.y) {
                blocked = true;
                break;
            }
        }
        if (!blocked) this.position.z = newZ;

        // Floor
        if (this.position.y + this.velocity.y * dt <= height) {
            this.position.y = height;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.position.y += this.velocity.y * dt;
            this.onGround = false;
        }

        // Friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
    }

    takeDamage(amount, attackerName) {
        if (!this.isAlive) return false;

        if (this.armor > 0) {
            const armorDamage = Math.min(this.armor, amount * 0.6);
            this.armor -= armorDamage;
            amount -= armorDamage;
        }

        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.die(attackerName);
            return true;
        }

        // React to damage - immediately look towards attacker direction
        this.reactionTimer = Math.max(0, this.reactionTimer - 0.2);
        return false;
    }

    die(killerName) {
        this.isAlive = false;
        this.deaths++;
        this.state = BotState.IDLE;
        this.path = null;
        this.target = null;
    }

    respawn(spawnPoint) {
        this.position.set(spawnPoint.x, GAME_CONSTANTS.PLAYER_HEIGHT, spawnPoint.z);
        this.velocity.set(0, 0, 0);
        this.health = GAME_CONSTANTS.MAX_HEALTH;
        this.armor = 0;
        this.isAlive = true;
        this.state = BotState.PATROL;
        this.path = null;
        this.patrolTarget = null;
        this.target = null;
        this.lastKnownEnemyPos = null;
        this.reactionTimer = 0;
        this.spawnProtectionTimer = GAME_CONSTANTS.SPAWN_PROTECTION_TIME;

        for (const w of this.weapons) {
            w.currentAmmo = w.def.magSize;
            w.reserveAmmo = w.def.reserveAmmo;
            w.isReloading = false;
        }

        // Random weapon selection
        this.currentWeaponIndex = Math.floor(Math.random() * this.weapons.length);
    }
}
