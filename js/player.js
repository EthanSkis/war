// player.js - Player controller with FPS camera, movement, and physics

class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Position & physics
        this.position = new THREE.Vector3(0, GAME_CONSTANTS.PLAYER_HEIGHT, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { yaw: 0, pitch: 0 };
        this.onGround = true;
        this.isCrouching = false;
        this.isSprinting = false;
        this.currentHeight = GAME_CONSTANTS.PLAYER_HEIGHT;

        // Stats
        this.health = GAME_CONSTANTS.MAX_HEALTH;
        this.armor = 0;
        this.kills = 0;
        this.deaths = 0;
        this.score = 0;
        this.isAlive = true;
        this.name = 'Player';
        this.team = 'none';
        this.spawnProtectionTimer = 0;

        // Weapons
        this.weapons = [
            new WeaponState('pistol'),
            new WeaponState('rifle'),
            new WeaponState('shotgun'),
        ];
        this.currentWeaponIndex = 1; // Start with rifle

        // Input state
        this.keys = {};
        this.mouseDown = false;
        this.mouseDelta = { x: 0, y: 0 };

        // Footstep timer
        this.stepTimer = 0;
        this.stepInterval = 0.4;

        // Weapon bob
        this.bobPhase = 0;
        this.bobAmount = 0;

        this._setupInput();
    }

    get weapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    _setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // Weapon switching
            if (e.code === 'Digit1') this.switchWeapon(0);
            if (e.code === 'Digit2') this.switchWeapon(1);
            if (e.code === 'Digit3') this.switchWeapon(2);
            if (e.code === 'KeyR') this.reload();
            // Scroll wheel weapon switch via keyboard
            if (e.code === 'KeyQ') this.cycleWeapon(-1);
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement) {
                this.mouseDelta.x += e.movementX;
                this.mouseDelta.y += e.movementY;
            }
        });

        document.addEventListener('wheel', (e) => {
            if (document.pointerLockElement) {
                this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
            }
        });
    }

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length && index !== this.currentWeaponIndex) {
            this.weapons[this.currentWeaponIndex].isReloading = false;
            this.currentWeaponIndex = index;
        }
    }

    cycleWeapon(dir) {
        let next = this.currentWeaponIndex + dir;
        if (next < 0) next = this.weapons.length - 1;
        if (next >= this.weapons.length) next = 0;
        this.switchWeapon(next);
    }

    reload() {
        if (this.weapon.startReload(performance.now() / 1000)) {
            audioManager.play('reload', 0.5);
        }
    }

    update(dt, colliders, time) {
        if (!this.isAlive) return;

        // --- Touch input integration ---
        if (touchControls.active) {
            const look = touchControls.consumeLookDelta();
            this.mouseDelta.x += look.x;
            this.mouseDelta.y += look.y;

            this.mouseDown = touchControls.fireDown;

            if (touchControls.jumpPressed) {
                this.keys['Space'] = true;
                touchControls.jumpPressed = false;
            } else {
                this.keys['Space'] = false;
            }

            this.keys['KeyC'] = touchControls.crouchDown;

            if (touchControls.reloadPressed) {
                this.reload();
                touchControls.reloadPressed = false;
            }

            if (touchControls.weaponCyclePressed) {
                this.cycleWeapon(1);
                touchControls.weaponCyclePressed = false;
            }

            this.keys['Tab'] = touchControls.scoreboardDown;
        }

        // Mouse look
        const sensitivity = GAME_CONSTANTS.MOUSE_SENSITIVITY;
        this.rotation.yaw -= this.mouseDelta.x * sensitivity;
        this.rotation.pitch -= this.mouseDelta.y * sensitivity;
        this.rotation.pitch = clamp(this.rotation.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;

        // Apply weapon recoil to pitch
        if (this.weapon.recoilOffset > 0.001) {
            this.rotation.pitch += this.weapon.recoilOffset * 0.075;
            this.rotation.pitch = clamp(this.rotation.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
        }
        this.weapon.updateRecoil(dt);

        // Movement
        this.isSprinting = this.keys['ShiftLeft'] && !this.isCrouching;
        const wasCrouching = this.isCrouching;
        this.isCrouching = this.keys['KeyC'] || this.keys['ControlLeft'];

        // Height transition
        const targetHeight = this.isCrouching ? GAME_CONSTANTS.CROUCH_HEIGHT : GAME_CONSTANTS.PLAYER_HEIGHT;
        this.currentHeight = lerp(this.currentHeight, targetHeight, dt * 10);

        let speed = GAME_CONSTANTS.PLAYER_SPEED;
        if (this.isSprinting) speed *= GAME_CONSTANTS.SPRINT_MULTIPLIER;
        if (this.isCrouching) speed *= GAME_CONSTANTS.CROUCH_MULTIPLIER;

        const forward = new THREE.Vector3(
            -Math.sin(this.rotation.yaw),
            0,
            -Math.cos(this.rotation.yaw)
        );
        const right = new THREE.Vector3(
            Math.cos(this.rotation.yaw),
            0,
            -Math.sin(this.rotation.yaw)
        );

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.keys['KeyW']) moveDir.add(forward);
        if (this.keys['KeyS']) moveDir.sub(forward);
        if (this.keys['KeyA']) moveDir.sub(right);
        if (this.keys['KeyD']) moveDir.add(right);

        // Touch joystick movement
        if (touchControls.active) {
            const tx = touchControls.moveX;
            const ty = touchControls.moveY;
            if (Math.abs(tx) > 0.1 || Math.abs(ty) > 0.1) {
                moveDir.add(forward.clone().multiplyScalar(ty));
                moveDir.add(right.clone().multiplyScalar(tx));
            }
        }

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            this.velocity.x = moveDir.x * speed;
            this.velocity.z = moveDir.z * speed;

            // Footsteps
            this.stepTimer += dt;
            const interval = this.isSprinting ? this.stepInterval * 0.7 : this.stepInterval;
            if (this.stepTimer >= interval && this.onGround) {
                audioManager.play('step', 0.15, 0.8 + Math.random() * 0.4);
                this.stepTimer = 0;
            }

            // Weapon bob
            this.bobPhase += dt * (this.isSprinting ? 14 : 10);
            this.bobAmount = lerp(this.bobAmount, this.isSprinting ? 0.04 : 0.02, dt * 5);
        } else {
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
            this.bobAmount = lerp(this.bobAmount, 0, dt * 5);
            this.stepTimer = 0;
        }

        // Jump
        if (this.keys['Space'] && this.onGround && !this.isCrouching) {
            this.velocity.y = GAME_CONSTANTS.JUMP_FORCE;
            this.onGround = false;
            audioManager.play('jump', 0.3);
        }

        // Gravity
        this.velocity.y += GAME_CONSTANTS.GRAVITY * dt;

        // Apply velocity with collision
        this._moveWithCollision(dt, colliders);

        // Update camera
        const bobX = Math.sin(this.bobPhase) * this.bobAmount;
        const bobY = Math.abs(Math.cos(this.bobPhase)) * this.bobAmount * 0.5;

        this.camera.position.set(
            this.position.x + bobX,
            this.position.y + bobY,
            this.position.z
        );

        const euler = new THREE.Euler(this.rotation.pitch, this.rotation.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);

        // Weapon reload
        if (this.weapon.updateReload(time)) {
            // Reload complete
        }

        // Auto reload when empty
        if (this.weapon.currentAmmo === 0 && !this.weapon.isReloading && this.weapon.reserveAmmo > 0) {
            this.weapon.startReload(time);
            audioManager.play('reload', 0.5);
        }
    }

    _moveWithCollision(dt, colliders) {
        const radius = GAME_CONSTANTS.PLAYER_RADIUS;
        const height = this.currentHeight;

        // Move X
        const newX = this.position.x + this.velocity.x * dt;
        let blocked = false;
        for (const col of colliders) {
            if (newX + radius > col.min.x && newX - radius < col.max.x &&
                this.position.z + radius > col.min.z && this.position.z - radius < col.max.z &&
                this.position.y - height + 0.3 < col.max.y && this.position.y > col.min.y) {
                blocked = true;
                this.velocity.x = 0;
                break;
            }
        }
        if (!blocked) this.position.x = newX;

        // Move Z
        const newZ = this.position.z + this.velocity.z * dt;
        blocked = false;
        for (const col of colliders) {
            if (this.position.x + radius > col.min.x && this.position.x - radius < col.max.x &&
                newZ + radius > col.min.z && newZ - radius < col.max.z &&
                this.position.y - height + 0.3 < col.max.y && this.position.y > col.min.y) {
                blocked = true;
                this.velocity.z = 0;
                break;
            }
        }
        if (!blocked) this.position.z = newZ;

        // Move Y
        const newY = this.position.y + this.velocity.y * dt;
        if (newY <= height) {
            this.position.y = height;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.position.y = newY;
            this.onGround = false;

            // Check ceiling/floor collisions with obstacles
            for (const col of colliders) {
                if (this.position.x + radius > col.min.x && this.position.x - radius < col.max.x &&
                    this.position.z + radius > col.min.z && this.position.z - radius < col.max.z) {
                    // Standing on top of obstacle
                    if (this.velocity.y < 0 && newY - height < col.max.y && this.position.y - height >= col.max.y - 0.1) {
                        this.position.y = col.max.y + height;
                        this.velocity.y = 0;
                        this.onGround = true;
                    }
                    // Hit head on bottom of obstacle
                    if (this.velocity.y > 0 && newY > col.min.y && this.position.y <= col.min.y) {
                        this.velocity.y = 0;
                    }
                }
            }
        }
    }

    takeDamage(amount, attackerName) {
        if (!this.isAlive) return false;

        // Armor absorbs 60% of damage
        if (this.armor > 0) {
            const armorDamage = Math.min(this.armor, amount * 0.6);
            this.armor -= armorDamage;
            amount -= armorDamage;
        }

        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.die(attackerName);
            return true; // killed
        }
        return false;
    }

    die(killerName) {
        this.isAlive = false;
        this.deaths++;
        audioManager.play('death', 0.6);
    }

    respawn(spawnPoint) {
        this.position.set(spawnPoint.x, GAME_CONSTANTS.PLAYER_HEIGHT, spawnPoint.z);
        this.velocity.set(0, 0, 0);
        this.health = GAME_CONSTANTS.MAX_HEALTH;
        this.armor = 0;
        this.isAlive = true;
        this.isCrouching = false;
        this.spawnProtectionTimer = GAME_CONSTANTS.SPAWN_PROTECTION_TIME;

        // Refill ammo
        for (const w of this.weapons) {
            w.currentAmmo = w.def.magSize;
            w.reserveAmmo = w.def.reserveAmmo;
            w.isReloading = false;
        }
    }

    // Get firing ray from camera
    getFireRay() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        return { origin: this.camera.position.clone(), direction: dir };
    }
}
