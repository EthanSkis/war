// pickups.js - Health, armor, and ammo pickups

const PICKUP_DEFS = {
    health: {
        color: 0x33ff33,
        amount: 25,
        bobSpeed: 2,
        size: 0.4,
    },
    armor: {
        color: 0x3388ff,
        amount: 25,
        bobSpeed: 2.5,
        size: 0.4,
    },
    ammo: {
        color: 0xffaa33,
        amount: 30, // added to reserve
        bobSpeed: 1.8,
        size: 0.35,
    }
};

class Pickup {
    constructor(scene, x, z, type) {
        this.scene = scene;
        this.type = type;
        this.def = PICKUP_DEFS[type];
        this.active = true;
        this.respawnTimer = 0;
        this.position = new THREE.Vector3(x, 0.5, z);
        this.baseY = 0.5;

        // Create visual
        this.mesh = this._createMesh();
        scene.add(this.mesh);
    }

    _createMesh() {
        const group = new THREE.Group();

        if (this.type === 'health') {
            // Cross shape for health
            const h1 = new THREE.BoxGeometry(this.def.size, this.def.size * 0.3, this.def.size * 0.3);
            const h2 = new THREE.BoxGeometry(this.def.size * 0.3, this.def.size, this.def.size * 0.3);
            const mat = new THREE.MeshStandardMaterial({
                color: this.def.color,
                emissive: this.def.color,
                emissiveIntensity: 0.5,
                roughness: 0.4,
                metalness: 0.2
            });
            group.add(new THREE.Mesh(h1, mat));
            group.add(new THREE.Mesh(h2, mat));
        } else if (this.type === 'armor') {
            const geo = new THREE.OctahedronGeometry(this.def.size, 1);
            const mat = new THREE.MeshStandardMaterial({
                color: this.def.color,
                emissive: this.def.color,
                emissiveIntensity: 0.4,
                roughness: 0.2,
                metalness: 0.7
            });
            group.add(new THREE.Mesh(geo, mat));
        } else {
            const geo = new THREE.BoxGeometry(this.def.size, this.def.size * 0.6, this.def.size * 0.6);
            const mat = new THREE.MeshStandardMaterial({
                color: this.def.color,
                emissive: this.def.color,
                emissiveIntensity: 0.4,
                roughness: 0.4,
                metalness: 0.5
            });
            group.add(new THREE.Mesh(geo, mat));
        }

        // Glow sphere
        const glowGeo = new THREE.SphereGeometry(this.def.size * 1.2, 10, 10);
        const glowMat = new THREE.MeshBasicMaterial({
            color: this.def.color,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.Mesh(glowGeo, glowMat));

        // Rotating ring
        const ringGeo = new THREE.RingGeometry(this.def.size * 0.8, this.def.size * 0.95, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: this.def.color,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.name = 'pickupRing';
        group.add(ring);

        // Point light for colored ground glow
        const light = new THREE.PointLight(this.def.color, 0.3, 3);
        light.position.y = -0.2;
        group.add(light);

        group.position.copy(this.position);
        return group;
    }

    update(dt, time) {
        if (!this.active) {
            this.mesh.visible = false;
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.active = true;
                this.mesh.visible = true;
            }
            return;
        }

        // Bob and rotate
        this.mesh.position.y = this.baseY + Math.sin(time * this.def.bobSpeed) * 0.15;
        this.mesh.rotation.y += dt * 1.5;

        // Animate ring on a different axis
        const ring = this.mesh.getObjectByName('pickupRing');
        if (ring) {
            ring.rotation.x = Math.PI / 2 + Math.sin(time * 1.2) * 0.4;
            ring.rotation.z += dt * 2;
        }
    }

    tryPickup(entity) {
        if (!this.active) return false;

        const dist = distance2D(this.position, entity.position);
        if (dist > 1.5) return false;

        let picked = false;

        if (this.type === 'health' && entity.health < GAME_CONSTANTS.MAX_HEALTH) {
            entity.health = Math.min(GAME_CONSTANTS.MAX_HEALTH, entity.health + this.def.amount);
            picked = true;
        } else if (this.type === 'armor' && entity.armor < GAME_CONSTANTS.MAX_ARMOR) {
            entity.armor = Math.min(GAME_CONSTANTS.MAX_ARMOR, entity.armor + this.def.amount);
            picked = true;
        } else if (this.type === 'ammo') {
            const weapon = entity.weapons ? entity.weapons[entity.currentWeaponIndex] : entity.weapon;
            if (weapon && weapon.reserveAmmo < weapon.def.reserveAmmo) {
                weapon.reserveAmmo = Math.min(weapon.def.reserveAmmo, weapon.reserveAmmo + this.def.amount);
                picked = true;
            }
        }

        if (picked) {
            this.active = false;
            this.respawnTimer = GAME_CONSTANTS.PICKUP_RESPAWN_TIME;
            audioManager.play('pickup', 0.4);
        }

        return picked;
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
