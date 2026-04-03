// touch.js - Mobile touch controls: virtual joystick, look, and action buttons

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1200);

class TouchControls {
    constructor() {
        this.active = false;
        this.moveX = 0;       // -1 to 1
        this.moveY = 0;       // -1 to 1
        this.lookDeltaX = 0;
        this.lookDeltaY = 0;
        this.fireDown = false;
        this.jumpPressed = false;
        this.crouchDown = false;
        this.reloadPressed = false;
        this.scoreboardDown = false;
        this.weaponCyclePressed = false;

        // Track touches
        this._joystickTouch = null;
        this._lookTouch = null;
        this._joystickOrigin = { x: 0, y: 0 };
        this._lastLookPos = { x: 0, y: 0 };

        this.lookSensitivity = 1.05;

        // DOM
        this.container = null;
        this.joystickBase = null;
        this.joystickKnob = null;
        this.joystickRadius = 50;
    }

    init() {
        if (!isMobile) return;
        this.active = true;

        this._createDOM();
        this._bindEvents();

        // Prevent default touch behaviors on game canvas and controls
        document.addEventListener('touchmove', (e) => {
            if (this.active) e.preventDefault();
        }, { passive: false });
    }

    _createDOM() {
        // Container for all touch controls
        this.container = document.createElement('div');
        this.container.id = 'touch-controls';
        document.body.appendChild(this.container);

        // --- Left side: virtual joystick ---
        this.joystickBase = document.createElement('div');
        this.joystickBase.className = 'touch-joystick-base';
        this.container.appendChild(this.joystickBase);

        this.joystickKnob = document.createElement('div');
        this.joystickKnob.className = 'touch-joystick-knob';
        this.joystickBase.appendChild(this.joystickKnob);

        // --- Right side: action buttons ---
        const btnDefs = [
            { id: 'touch-fire', label: 'FIRE', className: 'touch-btn-fire' },
            { id: 'touch-jump', label: 'JUMP', className: 'touch-btn-jump' },
            { id: 'touch-reload', label: 'R', className: 'touch-btn-reload' },
            { id: 'touch-crouch', label: 'C', className: 'touch-btn-crouch' },
            { id: 'touch-weapon', label: 'WPN', className: 'touch-btn-weapon' },
            { id: 'touch-score', label: 'TAB', className: 'touch-btn-score' },
        ];

        for (const def of btnDefs) {
            const btn = document.createElement('div');
            btn.id = def.id;
            btn.className = 'touch-btn ' + def.className;
            btn.textContent = def.label;
            this.container.appendChild(btn);
        }
    }

    _bindEvents() {
        const canvas = document.getElementById('game-canvas');

        // The right half of the screen is look area; left half is joystick area
        // Joystick events
        this.joystickBase.addEventListener('touchstart', (e) => this._onJoystickStart(e), { passive: false });
        this.joystickBase.addEventListener('touchmove', (e) => this._onJoystickMove(e), { passive: false });
        this.joystickBase.addEventListener('touchend', (e) => this._onJoystickEnd(e), { passive: false });
        this.joystickBase.addEventListener('touchcancel', (e) => this._onJoystickEnd(e), { passive: false });

        // Look: touches on the right side of the screen (not on buttons)
        canvas.addEventListener('touchstart', (e) => this._onLookStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this._onLookMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this._onLookEnd(e), { passive: false });
        canvas.addEventListener('touchcancel', (e) => this._onLookEnd(e), { passive: false });

        // Buttons
        this._bindButton('touch-fire', 'fireDown');
        this._bindButton('touch-crouch', 'crouchDown');
        this._bindButton('touch-score', 'scoreboardDown');
        this._bindPulse('touch-jump', 'jumpPressed');
        this._bindPulse('touch-reload', 'reloadPressed');
        this._bindPulse('touch-weapon', 'weaponCyclePressed');
    }

    _bindButton(id, prop) {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this[prop] = true;
            el.classList.add('pressed');
        }, { passive: false });
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this[prop] = false;
            el.classList.remove('pressed');
        }, { passive: false });
        el.addEventListener('touchcancel', (e) => {
            this[prop] = false;
            el.classList.remove('pressed');
        }, { passive: false });
    }

    _bindPulse(id, prop) {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this[prop] = true;
            el.classList.add('pressed');
        }, { passive: false });
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('pressed');
            // Pulse props are consumed by the player and reset
        }, { passive: false });
        el.addEventListener('touchcancel', (e) => {
            el.classList.remove('pressed');
        }, { passive: false });
    }

    // --- Joystick ---
    _onJoystickStart(e) {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.changedTouches[0];
        this._joystickTouch = touch.identifier;
        const rect = this.joystickBase.getBoundingClientRect();
        this._joystickOrigin.x = rect.left + rect.width / 2;
        this._joystickOrigin.y = rect.top + rect.height / 2;
        this._updateJoystick(touch.clientX, touch.clientY);
    }

    _onJoystickMove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this._joystickTouch) {
                this._updateJoystick(touch.clientX, touch.clientY);
            }
        }
    }

    _onJoystickEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this._joystickTouch) {
                this._joystickTouch = null;
                this.moveX = 0;
                this.moveY = 0;
                this.joystickKnob.style.transform = 'translate(-50%, -50%)';
            }
        }
    }

    _updateJoystick(cx, cy) {
        let dx = cx - this._joystickOrigin.x;
        let dy = cy - this._joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.joystickRadius;

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        this.moveX = dx / maxDist;
        this.moveY = -dy / maxDist; // Invert Y: up = forward

        this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    // --- Look (right side of screen) ---
    _onLookStart(e) {
        // Only handle touches on the right half of the screen, that aren't on buttons
        for (const touch of e.changedTouches) {
            if (touch.clientX > window.innerWidth * 0.35 && this._lookTouch === null) {
                // Make sure it's not on a touch-btn
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el && (el.classList.contains('touch-btn') || el.closest('.touch-btn'))) continue;

                e.preventDefault();
                this._lookTouch = touch.identifier;
                this._lastLookPos.x = touch.clientX;
                this._lastLookPos.y = touch.clientY;
            }
        }
    }

    _onLookMove(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier === this._lookTouch) {
                e.preventDefault();
                this.lookDeltaX += (touch.clientX - this._lastLookPos.x) * this.lookSensitivity;
                this.lookDeltaY += (touch.clientY - this._lastLookPos.y) * this.lookSensitivity;
                this._lastLookPos.x = touch.clientX;
                this._lastLookPos.y = touch.clientY;
            }
        }
    }

    _onLookEnd(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier === this._lookTouch) {
                this._lookTouch = null;
            }
        }
    }

    consumeLookDelta() {
        const dx = this.lookDeltaX;
        const dy = this.lookDeltaY;
        this.lookDeltaX = 0;
        this.lookDeltaY = 0;
        return { x: dx, y: dy };
    }

    show() {
        if (this.container) this.container.style.display = 'block';
    }

    hide() {
        if (this.container) this.container.style.display = 'none';
    }
}

const touchControls = new TouchControls();
