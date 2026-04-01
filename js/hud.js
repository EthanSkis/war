// hud.js - HUD updates, killfeed, scoreboard, minimap

class HUD {
    constructor() {
        this.healthFill = document.getElementById('health-fill');
        this.healthText = document.getElementById('health-text');
        this.armorFill = document.getElementById('armor-fill');
        this.armorText = document.getElementById('armor-text');
        this.ammoCurrent = document.getElementById('ammo-current');
        this.ammoReserve = document.getElementById('ammo-reserve');
        this.weaponName = document.getElementById('weapon-name');
        this.killfeed = document.getElementById('killfeed');
        this.scoreboardBody = document.getElementById('scoreboard-body');
        this.matchTimer = document.getElementById('match-timer');
        this.damageOverlay = document.getElementById('damage-overlay');
        this.hitMarker = document.getElementById('hit-marker');
        this.respawnOverlay = document.getElementById('respawn-overlay');
        this.respawnTimer = document.getElementById('respawn-timer');
        this.killedBy = document.getElementById('killed-by');
        this.weaponSlots = document.getElementById('weapon-slots');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.hudElement = document.getElementById('hud');

        this.spawnProtection = document.getElementById('spawn-protection');

        this.killfeedEntries = [];
        this.hitMarkerTimer = 0;
        this.damageTimer = 0;
    }

    show() {
        this.hudElement.style.display = 'block';
    }

    hide() {
        this.hudElement.style.display = 'none';
    }

    update(player, entities, timeRemaining, dt) {
        // Health
        const healthPct = (player.health / GAME_CONSTANTS.MAX_HEALTH) * 100;
        this.healthFill.style.width = healthPct + '%';
        this.healthText.textContent = Math.ceil(player.health);

        if (player.health < 30) {
            this.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff3333)';
        } else {
            this.healthFill.style.background = 'linear-gradient(90deg, #ff3333, #ff6666)';
        }

        // Armor
        const armorPct = (player.armor / GAME_CONSTANTS.MAX_ARMOR) * 100;
        this.armorFill.style.width = armorPct + '%';
        this.armorText.textContent = Math.ceil(player.armor);

        // Spawn protection indicator
        if (player.spawnProtectionTimer > 0) {
            this.spawnProtection.style.opacity = '1';
            this.spawnProtection.textContent = 'PROTECTED ' + player.spawnProtectionTimer.toFixed(1) + 's';
        } else {
            this.spawnProtection.style.opacity = '0';
        }

        // Ammo
        const weapon = player.weapon;
        this.ammoCurrent.textContent = weapon.currentAmmo;
        this.ammoReserve.textContent = '/ ' + weapon.reserveAmmo;
        this.weaponName.textContent = weapon.def.name + (weapon.isReloading ? ' (RELOADING)' : '');

        if (weapon.currentAmmo === 0 && !weapon.isReloading) {
            this.ammoCurrent.style.color = '#ff3333';
        } else if (weapon.isReloading) {
            this.ammoCurrent.style.color = '#ffaa33';
        } else {
            this.ammoCurrent.style.color = '#ffffff';
        }

        // Weapon slots
        let slotsHTML = '';
        for (let i = 0; i < player.weapons.length; i++) {
            const w = player.weapons[i];
            const active = i === player.currentWeaponIndex ? ' active' : '';
            slotsHTML += `<div class="weapon-slot${active}">${i + 1} ${w.def.name}</div>`;
        }
        this.weaponSlots.innerHTML = slotsHTML;

        // Timer
        const mins = Math.floor(timeRemaining / 60);
        const secs = Math.floor(timeRemaining % 60);
        this.matchTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        if (timeRemaining < 30) {
            this.matchTimer.style.color = '#ff3333';
        } else {
            this.matchTimer.style.color = '#ffffff';
        }

        // Hit marker
        if (this.hitMarkerTimer > 0) {
            this.hitMarkerTimer -= dt;
            this.hitMarker.style.opacity = Math.min(1, this.hitMarkerTimer / 0.1);
        }

        // Damage overlay
        if (this.damageTimer > 0) {
            this.damageTimer -= dt;
            const intensity = Math.min(20, this.damageTimer * 40);
            this.damageOverlay.style.border = `${intensity}px solid rgba(255,0,0,${this.damageTimer * 0.5})`;
        } else {
            this.damageOverlay.style.border = '0px solid rgba(255,0,0,0)';
        }

        // Clean old killfeed entries
        this.killfeedEntries = this.killfeedEntries.filter(e => e.time > performance.now() - 5000);
        let feedHTML = '';
        for (const entry of this.killfeedEntries) {
            const opacity = Math.min(1, (5000 - (performance.now() - entry.time)) / 1000);
            feedHTML += `<div class="kill-entry" style="opacity:${opacity}">
                <span class="killer">${entry.killer}</span>
                <span class="weapon-icon">[${entry.weapon}]</span>
                <span class="victim">${entry.victim}</span>
                ${entry.headshot ? ' &#9733;' : ''}
            </div>`;
        }
        this.killfeed.innerHTML = feedHTML;

        // Minimap
        this._drawMinimap(player, entities);
    }

    showHitMarker() {
        this.hitMarkerTimer = 0.2;
    }

    showDamage() {
        this.damageTimer = 0.5;
    }

    addKillfeedEntry(killer, victim, weapon, headshot) {
        this.killfeedEntries.push({
            killer, victim, weapon, headshot,
            time: performance.now()
        });
        if (this.killfeedEntries.length > 5) {
            this.killfeedEntries.shift();
        }
    }

    showRespawnScreen(killerName, countdown) {
        this.respawnOverlay.style.display = 'flex';
        this.killedBy.textContent = killerName ? `Killed by ${killerName}` : '';
        this.respawnTimer.textContent = `Respawning in ${Math.ceil(countdown)}...`;
    }

    hideRespawnScreen() {
        this.respawnOverlay.style.display = 'none';
    }

    updateScoreboard(entities, show) {
        const scoreboard = document.getElementById('scoreboard');
        scoreboard.style.display = show ? 'block' : 'none';

        if (!show) return;

        const sorted = [...entities].sort((a, b) => b.score - a.score || b.kills - a.kills);
        let html = '';
        for (const e of sorted) {
            const isPlayer = e.name === 'Player';
            html += `<tr class="${isPlayer ? 'player-row' : ''}">
                <td style="color:${isPlayer ? '#ff9944' : '#ccc'}">${e.name}</td>
                <td>${e.kills}</td>
                <td>${e.deaths}</td>
                <td>${e.score}</td>
            </tr>`;
        }
        this.scoreboardBody.innerHTML = html;
    }

    _drawMinimap(player, entities) {
        const ctx = this.minimapCtx;
        const w = 150, h = 150;
        const scale = 2; // pixels per world unit

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // Draw entities
        for (const e of entities) {
            if (!e.isAlive || e === player) continue;

            const dx = (e.position.x - player.position.x) * scale;
            const dz = (e.position.z - player.position.z) * scale;

            // Rotate relative to player facing
            const cos = Math.cos(-player.rotation.yaw);
            const sin = Math.sin(-player.rotation.yaw);
            const rx = dx * cos - dz * sin;
            const ry = dx * sin + dz * cos;

            const px = cx + rx;
            const py = cy - ry;

            if (px < 0 || px > w || py < 0 || py > h) continue;

            // Color by team or as enemy
            if (e.team === player.team && player.team !== 'none') {
                ctx.fillStyle = '#44ff44';
            } else {
                ctx.fillStyle = '#ff4444';
            }
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Player direction
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 10);
        ctx.stroke();
    }
}
