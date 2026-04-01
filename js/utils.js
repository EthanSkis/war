// utils.js - Shared utilities and constants

const GAME_CONSTANTS = {
    TICK_RATE: 60,
    GRAVITY: -25,
    PLAYER_HEIGHT: 1.7,
    PLAYER_RADIUS: 0.4,
    PLAYER_SPEED: 7,
    SPRINT_MULTIPLIER: 1.5,
    CROUCH_MULTIPLIER: 0.5,
    CROUCH_HEIGHT: 1.0,
    JUMP_FORCE: 9,
    MOUSE_SENSITIVITY: 0.002,
    MAX_HEALTH: 100,
    MAX_ARMOR: 100,
    RESPAWN_TIME: 3,
    MATCH_DURATION: 300, // 5 minutes
    PICKUP_RESPAWN_TIME: 15,
    SPAWN_PROTECTION_TIME: 5,
};

const BOT_NAMES = [
    'Shadow', 'Viper', 'Ghost', 'Reaper', 'Frost',
    'Phoenix', 'Cobra', 'Storm', 'Blade', 'Cipher',
    'Nova', 'Rogue', 'Titan', 'Echo', 'Spectre', 'Havoc'
];

const TEAM_COLORS = {
    red: 0xff4444,
    blue: 0x4488ff,
    none: 0xff9944
};

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function distance3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distance2D(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function randomInRange(min, max) {
    return min + Math.random() * (max - min);
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function angleBetween(from, to) {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

// Simple AABB collision
function boxContainsPoint(box, point) {
    return point.x >= box.min.x && point.x <= box.max.x &&
           point.y >= box.min.y && point.y <= box.max.y &&
           point.z >= box.min.z && point.z <= box.max.z;
}

// Ray-AABB intersection
function rayIntersectsBox(origin, direction, box) {
    let tmin = (box.min.x - origin.x) / direction.x;
    let tmax = (box.max.x - origin.x) / direction.x;
    if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; }

    let tymin = (box.min.y - origin.y) / direction.y;
    let tymax = (box.max.y - origin.y) / direction.y;
    if (tymin > tymax) { const tmp = tymin; tymin = tymax; tymax = tmp; }

    if (tmin > tymax || tymin > tmax) return null;
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (box.min.z - origin.z) / direction.z;
    let tzmax = (box.max.z - origin.z) / direction.z;
    if (tzmin > tzmax) { const tmp = tzmin; tzmin = tzmax; tzmax = tmp; }

    if (tmin > tzmax || tzmin > tmax) return null;
    if (tzmin > tmin) tmin = tzmin;

    if (tmin < 0) return null;
    return tmin;
}
