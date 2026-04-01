// maps.js - Map definitions and geometry builder

const MAPS = {
    warehouse: {
        name: 'Warehouse',
        size: { x: 60, z: 60 },
        floorColor: 0x444444,
        wallColor: 0x666655,
        ceilingHeight: 8,
        ambientLight: 0.3,
        fogColor: 0x111111,
        fogDensity: 0.02,
        theme: { floor: 'concrete', wall: 'brick', ceiling: 'metal', cover: 'crate' },
        spawnPoints: [
            { x: -25, z: -25 }, { x: 25, z: -25 }, { x: -25, z: 25 }, { x: 25, z: 25 },
            { x: 0, z: -25 }, { x: 0, z: 25 }, { x: -25, z: 0 }, { x: 25, z: 0 },
            { x: -15, z: -15 }, { x: 15, z: 15 }, { x: -15, z: 15 }, { x: 15, z: -15 },
        ],
        pickupLocations: [
            { x: 0, z: 0, type: 'health' },
            { x: -20, z: 0, type: 'armor' },
            { x: 20, z: 0, type: 'armor' },
            { x: 0, z: -20, type: 'ammo' },
            { x: 0, z: 20, type: 'ammo' },
            { x: -20, z: -20, type: 'health' },
            { x: 20, z: 20, type: 'health' },
        ],
        // walls: [minX, minZ, maxX, maxZ, height]
        walls: [
            // Outer walls
            [-30, -30, 30, -29.5, 8],
            [-30, 29.5, 30, 30, 8],
            [-30, -30, -29.5, 30, 8],
            [29.5, -30, 30, 30, 8],
            // Center structure
            [-4, -4, 4, -3.5, 4],
            [-4, 3.5, 4, 4, 4],
            [-4, -4, -3.5, 4, 4],
            [3.5, -4, 4, 4, 4],
            // Crate clusters
            [-18, -8, -14, -4, 2.5],
            [-18, 4, -14, 8, 2.5],
            [14, -8, 18, -4, 2.5],
            [14, 4, 18, 8, 2.5],
            // Long walls for corridors
            [-10, -15, -9, -5, 3],
            [9, -15, 10, -5, 3],
            [-10, 5, -9, 15, 3],
            [9, 5, 10, 15, 3],
            // Small cover
            [-22, -15, -20, -13, 1.5],
            [20, -15, 22, -13, 1.5],
            [-22, 13, -20, 15, 1.5],
            [20, 13, 22, 15, 1.5],
            // Additional cover blocks
            [-6, -20, -4, -18, 2],
            [4, -20, 6, -18, 2],
            [-6, 18, -4, 20, 2],
            [4, 18, 6, 20, 2],
            // Columns
            [-15, -15, -14, -14, 8],
            [14, -15, 15, -14, 8],
            [-15, 14, -14, 15, 8],
            [14, 14, 15, 15, 8],
        ]
    },

    canyon: {
        name: 'Canyon',
        size: { x: 100, z: 100 },
        floorColor: 0x8B7355,
        wallColor: 0x9B7B55,
        ceilingHeight: 0, // outdoor
        ambientLight: 0.6,
        fogColor: 0xC4A882,
        fogDensity: 0.008,
        theme: { floor: 'sand', wall: 'rock', ceiling: null, cover: 'rock' },
        spawnPoints: [
            { x: -40, z: -40 }, { x: 40, z: -40 }, { x: -40, z: 40 }, { x: 40, z: 40 },
            { x: 0, z: -40 }, { x: 0, z: 40 }, { x: -40, z: 0 }, { x: 40, z: 0 },
            { x: -20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }, { x: 20, z: -20 },
        ],
        pickupLocations: [
            { x: 0, z: 0, type: 'health' },
            { x: -30, z: 0, type: 'armor' },
            { x: 30, z: 0, type: 'armor' },
            { x: 0, z: -30, type: 'ammo' },
            { x: 0, z: 30, type: 'ammo' },
            { x: -25, z: -25, type: 'health' },
            { x: 25, z: 25, type: 'health' },
        ],
        walls: [
            // Outer walls
            [-50, -50, 50, -49, 6],
            [-50, 49, 50, 50, 6],
            [-50, -50, -49, 50, 6],
            [49, -50, 50, 50, 6],
            // Rock formations - canyon walls
            [-35, -20, -30, 20, 5],
            [30, -20, 35, 20, 5],
            // Large rocks
            [-15, -25, -10, -20, 3],
            [10, 20, 15, 25, 3],
            [-15, 20, -10, 25, 3],
            [10, -25, 15, -20, 3],
            // Center plateau
            [-8, -8, 8, -6, 2],
            [-8, 6, 8, 8, 2],
            [-8, -8, -6, 8, 2],
            [6, -8, 8, 8, 2],
            // Scattered boulders
            [-25, -35, -22, -32, 2.5],
            [22, 32, 25, 35, 2.5],
            [-25, 32, -22, 35, 2.5],
            [22, -35, 25, -32, 2.5],
            [-3, -35, 3, -30, 3],
            [-3, 30, 3, 35, 3],
            // Ridge lines
            [-20, -10, -18, 10, 4],
            [18, -10, 20, 10, 4],
        ]
    },

    facility: {
        name: 'Facility',
        size: { x: 80, z: 80 },
        floorColor: 0x555566,
        wallColor: 0x667788,
        ceilingHeight: 6,
        ambientLight: 0.35,
        fogColor: 0x222233,
        fogDensity: 0.015,
        theme: { floor: 'tiles', wall: 'sciFiPanel', ceiling: 'metal', cover: 'metal' },
        spawnPoints: [
            { x: -35, z: -35 }, { x: 35, z: -35 }, { x: -35, z: 35 }, { x: 35, z: 35 },
            { x: 0, z: -35 }, { x: 0, z: 35 }, { x: -35, z: 0 }, { x: 35, z: 0 },
            { x: -20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }, { x: 20, z: -20 },
        ],
        pickupLocations: [
            { x: 0, z: 0, type: 'health' },
            { x: -25, z: 0, type: 'armor' },
            { x: 25, z: 0, type: 'armor' },
            { x: 0, z: -25, type: 'ammo' },
            { x: 0, z: 25, type: 'ammo' },
            { x: -30, z: -30, type: 'health' },
            { x: 30, z: 30, type: 'health' },
            { x: 25, z: -25, type: 'ammo' },
        ],
        walls: [
            // Outer walls
            [-40, -40, 40, -39.5, 6],
            [-40, 39.5, 40, 40, 6],
            [-40, -40, -39.5, 40, 6],
            [39.5, -40, 40, 40, 6],
            // Room divisions - main corridors
            [-25, -15, -10, -14, 6],
            [10, -15, 25, -14, 6],
            [-25, 14, -10, 15, 6],
            [10, 14, 25, 15, 6],
            // Side rooms walls
            [-25, -30, -24, -15, 6],
            [24, -30, 25, -15, 6],
            [-25, 15, -24, 30, 6],
            [24, 15, 25, 30, 6],
            // Center area - open with cover
            [-5, -5, 5, -4, 3],
            [-5, 4, 5, 5, 3],
            [-5, -2, -4, 2, 3],
            [4, -2, 5, 2, 3],
            // Corner rooms
            [-38, -38, -28, -30, 6],
            [28, -38, 38, -30, 6],
            [-38, 30, -28, 38, 6],
            [28, 30, 38, 38, 6],
            // Corridor cover
            [-2, -25, 2, -20, 2],
            [-2, 20, 2, 25, 2],
            // Technical equipment
            [-18, -8, -15, -5, 2],
            [15, -8, 18, -5, 2],
            [-18, 5, -15, 8, 2],
            [15, 5, 18, 8, 2],
            // Pillars
            [-10, -10, -9, -9, 6],
            [9, -10, 10, -9, 6],
            [-10, 9, -9, 10, 6],
            [9, 9, 10, 10, 6],
        ]
    }
};

class MapBuilder {
    constructor(scene) {
        this.scene = scene;
        this.colliders = [];
        this.meshes = [];
        this.textures = [];
    }

    _getTexData(type, color) {
        switch (type) {
            case 'concrete': return textureGen.concrete(color);
            case 'brick': return textureGen.brick(color, 0x555555);
            case 'metal': return textureGen.metal(color);
            case 'rock': return textureGen.rock(color);
            case 'sand': return textureGen.sand(color);
            case 'sciFiPanel': return textureGen.sciFiPanel(color);
            case 'tiles': return textureGen.tiles(color);
            case 'crate': return textureGen.crate(color);
            default: return textureGen.concrete(color);
        }
    }

    build(mapId) {
        const map = MAPS[mapId];
        this.colliders = [];
        this.meshes = [];
        this.textures = [];

        const theme = map.theme || {};

        // Floor
        const floorGeo = new THREE.PlaneGeometry(map.size.x, map.size.z);
        const floorTexData = this._getTexData(theme.floor || 'concrete', map.floorColor);
        const floorRepeatX = map.size.x / 4;
        const floorRepeatY = map.size.z / 4;
        const floorMat = textureGen.buildMaterial(floorTexData, {
            repeatX: floorRepeatX, repeatY: floorRepeatY,
            roughness: 0.85, metalness: 0.05
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.meshes.push(floor);

        // Ceiling (indoor maps)
        if (map.ceilingHeight > 0 && theme.ceiling) {
            const ceilGeo = new THREE.PlaneGeometry(map.size.x, map.size.z);
            const ceilTexData = this._getTexData(theme.ceiling, 0x444444);
            const ceilMat = textureGen.buildMaterial(ceilTexData, {
                repeatX: map.size.x / 6, repeatY: map.size.z / 6,
                roughness: 0.7, metalness: 0.2
            });
            const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.y = map.ceilingHeight;
            this.scene.add(ceiling);
            this.meshes.push(ceiling);
        } else if (map.ceilingHeight > 0) {
            const ceilGeo = new THREE.PlaneGeometry(map.size.x, map.size.z);
            const ceilMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
            const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.y = map.ceilingHeight;
            this.scene.add(ceiling);
            this.meshes.push(ceiling);
        }

        // Walls/obstacles
        const wallTexData = this._getTexData(theme.wall || 'concrete', map.wallColor);
        const coverTexData = this._getTexData(theme.cover || theme.wall || 'concrete', map.wallColor);

        for (const w of map.walls) {
            const [minX, minZ, maxX, maxZ, height] = w;
            const width = maxX - minX;
            const depth = maxZ - minZ;
            const geo = new THREE.BoxGeometry(width, height, depth);

            // Classify: short walls are cover, tall are structural
            const isCover = height < 3;
            const texData = isCover ? coverTexData : wallTexData;

            // Scale UV repeats to wall dimensions for consistent texel density
            const maxDim = Math.max(width, depth);
            const repX = Math.max(1, maxDim / 3);
            const repY = Math.max(1, height / 3);

            // Slight color tint variation per wall
            const colorVariance = 0.08;
            const baseColor = new THREE.Color(map.wallColor);
            const cr = clamp(baseColor.r + (Math.random() - 0.5) * colorVariance, 0, 1);
            const cg = clamp(baseColor.g + (Math.random() - 0.5) * colorVariance, 0, 1);
            const cb = clamp(baseColor.b + (Math.random() - 0.5) * colorVariance, 0, 1);

            const mat = textureGen.buildMaterial(texData, {
                repeatX: repX, repeatY: repY,
                roughness: isCover ? 0.9 : 0.75,
                metalness: isCover ? 0.05 : 0.1,
                color: new THREE.Color(cr, cg, cb)
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(minX + width / 2, height / 2, minZ + depth / 2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.meshes.push(mesh);

            // Collider
            this.colliders.push({
                min: { x: minX, y: 0, z: minZ },
                max: { x: maxX, y: height, z: maxZ }
            });
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, map.ambientLight);
        this.scene.add(ambientLight);

        if (map.ceilingHeight > 0) {
            // Indoor lighting - multiple point lights
            const positions = [
                [0, map.ceilingHeight - 1, 0],
                [-map.size.x * 0.3, map.ceilingHeight - 1, -map.size.z * 0.3],
                [map.size.x * 0.3, map.ceilingHeight - 1, -map.size.z * 0.3],
                [-map.size.x * 0.3, map.ceilingHeight - 1, map.size.z * 0.3],
                [map.size.x * 0.3, map.ceilingHeight - 1, map.size.z * 0.3],
            ];
            for (const pos of positions) {
                const light = new THREE.PointLight(0xffeedd, 0.6, map.size.x);
                light.position.set(...pos);
                light.castShadow = true;
                light.shadow.mapSize.width = 512;
                light.shadow.mapSize.height = 512;
                this.scene.add(light);
            }
        } else {
            // Outdoor - directional light (sun)
            const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
            sun.position.set(30, 50, 20);
            sun.castShadow = true;
            sun.shadow.mapSize.width = 2048;
            sun.shadow.mapSize.height = 2048;
            sun.shadow.camera.left = -60;
            sun.shadow.camera.right = 60;
            sun.shadow.camera.top = 60;
            sun.shadow.camera.bottom = -60;
            this.scene.add(sun);

            // Sky color
            this.scene.background = new THREE.Color(0x87CEEB);
        }

        // Fog
        if (map.fogDensity > 0) {
            this.scene.fog = new THREE.FogExp2(map.fogColor, map.fogDensity);
            if (map.ceilingHeight > 0) {
                this.scene.background = new THREE.Color(map.fogColor);
            }
        }

        return this.colliders;
    }

    clear() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                if (mesh.material.normalMap) mesh.material.normalMap.dispose();
                if (mesh.material.roughnessMap) mesh.material.roughnessMap.dispose();
                mesh.material.dispose();
            }
        }
        this.meshes = [];
        this.colliders = [];
        this.scene.fog = null;
        textureGen.dispose();
    }
}
