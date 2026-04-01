// textures.js - Procedural texture generation for map surfaces

class TextureGenerator {
    constructor() {
        this.cache = {};
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.size = this.isMobile ? 128 : 256;
    }

    _createCanvas(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w || this.size;
        canvas.height = h || this.size;
        return { canvas, ctx: canvas.getContext('2d') };
    }

    // Simple hash-based noise
    _hash(x, y) {
        let h = (x * 374761393 + y * 668265263 + 1274126177) & 0xffffffff;
        h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff;
        return (h & 0xffff) / 0xffff;
    }

    // Value noise with smooth interpolation
    _valueNoise(x, y, scale) {
        const sx = x / scale;
        const sy = y / scale;
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const fx = sx - ix;
        const fy = sy - iy;
        // Smoothstep
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const a = this._hash(ix, iy);
        const b = this._hash(ix + 1, iy);
        const c = this._hash(ix, iy + 1);
        const d = this._hash(ix + 1, iy + 1);

        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }

    // Fractal brownian motion
    _fbm(x, y, octaves, scale) {
        let val = 0, amp = 0.5, freq = 1, total = 0;
        for (let i = 0; i < octaves; i++) {
            val += amp * this._valueNoise(x * freq, y * freq, scale);
            total += amp;
            amp *= 0.5;
            freq *= 2;
        }
        return val / total;
    }

    _hexToRgb(hex) {
        const c = new THREE.Color(hex);
        return { r: Math.floor(c.r * 255), g: Math.floor(c.g * 255), b: Math.floor(c.b * 255) };
    }

    _makeTexture(canvas, repeatX, repeatY) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX || 1, repeatY || 1);
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }

    // Generate normal map from a grayscale heightmap canvas
    _generateNormalMap(heightCanvas, strength) {
        strength = strength || 2.0;
        const w = heightCanvas.width;
        const h = heightCanvas.height;
        const srcCtx = heightCanvas.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, w, h).data;

        const { canvas, ctx } = this._createCanvas(w, h);
        const imgData = ctx.createImageData(w, h);
        const out = imgData.data;

        const getHeight = (px, py) => {
            px = ((px % w) + w) % w;
            py = ((py % h) + h) % h;
            return srcData[(py * w + px) * 4] / 255;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const left = getHeight(x - 1, y);
                const right = getHeight(x + 1, y);
                const up = getHeight(x, y - 1);
                const down = getHeight(x, y + 1);

                const dx = (left - right) * strength;
                const dy = (up - down) * strength;

                // Normalize
                const len = Math.sqrt(dx * dx + dy * dy + 1);
                const nx = dx / len * 0.5 + 0.5;
                const ny = dy / len * 0.5 + 0.5;
                const nz = 1 / len * 0.5 + 0.5;

                const idx = (y * w + x) * 4;
                out[idx] = nx * 255;
                out[idx + 1] = ny * 255;
                out[idx + 2] = nz * 255;
                out[idx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    // ---- TEXTURE GENERATORS ----

    concrete(baseColor) {
        const key = 'concrete_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        // Diffuse map
        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        // Height map for normals
        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        // Roughness map
        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;
                const n1 = this._fbm(x, y, 4, 32);
                const n2 = this._fbm(x + 500, y + 500, 3, 16);
                const n3 = this._fbm(x + 1000, y + 1000, 2, 64);

                // Concrete base with variation
                const variation = (n1 - 0.5) * 50 + (n2 - 0.5) * 25;

                // Cracks: thin dark lines
                const crackNoise = this._fbm(x + 2000, y + 2000, 5, 24);
                const crack = crackNoise > 0.58 && crackNoise < 0.6 ? -40 : 0;

                // Stains
                const stain = n3 > 0.6 ? (n3 - 0.6) * -80 : 0;

                const r = clamp(rgb.r + variation + crack + stain, 0, 255);
                const g = clamp(rgb.g + variation + crack + stain, 0, 255);
                const b = clamp(rgb.b + variation + crack + stain, 0, 255);

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;

                // Height
                const h = clamp(128 + variation + crack * 2, 0, 255);
                hd[idx] = h; hd[idx + 1] = h; hd[idx + 2] = h; hd[idx + 3] = 255;

                // Roughness (concrete is fairly rough)
                const rough = clamp(180 + (n2 - 0.5) * 60, 0, 255);
                rd[idx] = rough; rd[idx + 1] = rough; rd[idx + 2] = rough; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 2.0)
        };
        this.cache[key] = result;
        return result;
    }

    brick(baseColor, mortarColor) {
        const key = 'brick_' + baseColor + '_' + mortarColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const brickRgb = this._hexToRgb(baseColor);
        const mortarRgb = this._hexToRgb(mortarColor || 0x555555);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        const brickH = Math.floor(sz / 8);
        const brickW = Math.floor(sz / 4);
        const mortarSize = Math.max(2, Math.floor(sz / 64));

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;
                const row = Math.floor(y / brickH);
                const offset = (row % 2 === 0) ? 0 : brickW / 2;
                const bx = (x + offset) % brickW;
                const by = y % brickH;

                const isMortar = bx < mortarSize || by < mortarSize;

                const n = this._fbm(x, y, 3, 16);
                const variation = (n - 0.5) * 30;

                let r, g, b, height, roughness;
                if (isMortar) {
                    r = clamp(mortarRgb.r + variation * 0.5, 0, 255);
                    g = clamp(mortarRgb.g + variation * 0.5, 0, 255);
                    b = clamp(mortarRgb.b + variation * 0.5, 0, 255);
                    height = 80;
                    roughness = 220;
                } else {
                    // Per-brick color variation
                    const brickSeed = this._hash(Math.floor((x + offset) / brickW), row) * 30 - 15;
                    r = clamp(brickRgb.r + variation + brickSeed, 0, 255);
                    g = clamp(brickRgb.g + variation + brickSeed * 0.7, 0, 255);
                    b = clamp(brickRgb.b + variation + brickSeed * 0.5, 0, 255);
                    height = clamp(160 + variation, 0, 255);
                    roughness = clamp(160 + (n - 0.5) * 40, 0, 255);
                }

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;
                hd[idx] = height; hd[idx + 1] = height; hd[idx + 2] = height; hd[idx + 3] = 255;
                rd[idx] = roughness; rd[idx + 1] = roughness; rd[idx + 2] = roughness; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 3.0)
        };
        this.cache[key] = result;
        return result;
    }

    metal(baseColor) {
        const key = 'metal_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        // Panel grid
        const panelSize = Math.floor(sz / 4);
        const rivetSize = Math.max(2, Math.floor(sz / 32));
        const borderSize = Math.max(1, Math.floor(sz / 64));

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;
                const px = x % panelSize;
                const py = y % panelSize;

                // Brushed metal streaks (horizontal)
                const streak = this._valueNoise(x * 4, y, 8) * 20 - 10;
                const n = this._fbm(x, y, 2, 32);

                const isBorder = px < borderSize || py < borderSize;
                const isRivet = (px < rivetSize * 2 && py < rivetSize * 2 && px > borderSize && py > borderSize) ||
                    (px > panelSize - rivetSize * 2 && py > panelSize - rivetSize * 2 &&
                        px < panelSize - borderSize && py < panelSize - borderSize);

                let variation = streak + (n - 0.5) * 15;
                let height = 160;
                let roughness = 80; // metal is fairly smooth

                if (isBorder) {
                    variation -= 25;
                    height = 100;
                    roughness = 120;
                } else if (isRivet) {
                    variation += 10;
                    height = 200;
                    roughness = 60;
                }

                // Scratches
                const scratchN = this._fbm(x + 3000, y + 3000, 3, 12);
                if (scratchN > 0.62 && scratchN < 0.63) {
                    variation += 30;
                    height -= 20;
                    roughness += 40;
                }

                dd[idx] = clamp(rgb.r + variation, 0, 255);
                dd[idx + 1] = clamp(rgb.g + variation, 0, 255);
                dd[idx + 2] = clamp(rgb.b + variation, 0, 255);
                dd[idx + 3] = 255;

                hd[idx] = clamp(height, 0, 255); hd[idx + 1] = hd[idx]; hd[idx + 2] = hd[idx]; hd[idx + 3] = 255;
                rd[idx] = clamp(roughness, 0, 255); rd[idx + 1] = rd[idx]; rd[idx + 2] = rd[idx]; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 2.5)
        };
        this.cache[key] = result;
        return result;
    }

    rock(baseColor) {
        const key = 'rock_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;

                // Layered rock striations (horizontal bands)
                const strata = this._fbm(x * 0.5, y * 2, 4, 32);
                const n1 = this._fbm(x, y, 5, 24);
                const n2 = this._fbm(x + 7000, y + 7000, 3, 48);

                const variation = (n1 - 0.5) * 60 + (strata - 0.5) * 40;

                // Crevices
                const crevice = n2 > 0.63 ? (n2 - 0.63) * -200 : 0;

                const r = clamp(rgb.r + variation + crevice, 0, 255);
                const g = clamp(rgb.g + variation * 0.9 + crevice, 0, 255);
                const b = clamp(rgb.b + variation * 0.7 + crevice, 0, 255);

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;

                const height = clamp(128 + variation + crevice * 0.5, 0, 255);
                hd[idx] = height; hd[idx + 1] = height; hd[idx + 2] = height; hd[idx + 3] = 255;

                const rough = clamp(200 + (n1 - 0.5) * 60, 0, 255);
                rd[idx] = rough; rd[idx + 1] = rough; rd[idx + 2] = rough; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 3.0)
        };
        this.cache[key] = result;
        return result;
    }

    sand(baseColor) {
        const key = 'sand_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;

                const n1 = this._fbm(x, y, 4, 20);
                const n2 = this._fbm(x + 4000, y + 4000, 3, 8);
                const n3 = this._fbm(x + 8000, y + 8000, 2, 48);

                // Sandy base with dunes
                const dune = (n3 - 0.5) * 30;
                const grain = (n2 - 0.5) * 20;
                const variation = (n1 - 0.5) * 35 + dune + grain;

                // Pebbles (dark spots)
                const pebble = n2 > 0.72 ? -35 : 0;

                const r = clamp(rgb.r + variation + pebble, 0, 255);
                const g = clamp(rgb.g + variation * 0.9 + pebble, 0, 255);
                const b = clamp(rgb.b + variation * 0.7 + pebble * 0.5, 0, 255);

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;

                const height = clamp(128 + variation * 0.8 + pebble * -1, 0, 255);
                hd[idx] = height; hd[idx + 1] = height; hd[idx + 2] = height; hd[idx + 3] = 255;

                const rough = clamp(200 + grain, 0, 255);
                rd[idx] = rough; rd[idx + 1] = rough; rd[idx + 2] = rough; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 1.5)
        };
        this.cache[key] = result;
        return result;
    }

    sciFiPanel(baseColor) {
        const key = 'scifi_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        const panelW = Math.floor(sz / 4);
        const panelH = Math.floor(sz / 2);
        const groove = Math.max(2, Math.floor(sz / 64));
        const inset = Math.max(4, Math.floor(sz / 32));

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;
                const px = x % panelW;
                const py = y % panelH;

                const n = this._fbm(x, y, 2, 32);
                const baseVariation = (n - 0.5) * 12;

                // Panel structure
                const isGroove = px < groove || py < groove;
                const isInset = px > inset && px < panelW - inset &&
                    py > inset && py < panelH - inset;
                const isInsetBorder = !isGroove && !isInset &&
                    (px === inset || px === panelW - inset || py === inset || py === panelH - inset);

                let variation = baseVariation;
                let height = 160;
                let roughness = 100;

                if (isGroove) {
                    variation -= 30;
                    height = 60;
                    roughness = 150;
                } else if (isInsetBorder) {
                    variation += 15;
                    height = 180;
                    roughness = 60;
                } else if (isInset) {
                    variation -= 10;
                    height = 130;
                    roughness = 110;

                    // Subtle horizontal line pattern inside inset
                    if (py % 8 < 1) {
                        variation -= 8;
                        height -= 10;
                    }
                }

                // Emissive accent line (bright strip)
                const accentY = Math.floor(panelH * 0.85);
                if (py > accentY && py < accentY + groove && !isGroove) {
                    variation += 40;
                    roughness = 40;
                }

                dd[idx] = clamp(rgb.r + variation, 0, 255);
                dd[idx + 1] = clamp(rgb.g + variation, 0, 255);
                dd[idx + 2] = clamp(rgb.b + variation * 1.2, 0, 255);
                dd[idx + 3] = 255;

                hd[idx] = clamp(height, 0, 255); hd[idx + 1] = hd[idx]; hd[idx + 2] = hd[idx]; hd[idx + 3] = 255;
                rd[idx] = clamp(roughness, 0, 255); rd[idx + 1] = rd[idx]; rd[idx + 2] = rd[idx]; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 2.0)
        };
        this.cache[key] = result;
        return result;
    }

    tiles(baseColor) {
        const key = 'tiles_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        const tileSize = Math.floor(sz / 4);
        const groutSize = Math.max(2, Math.floor(sz / 64));

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;
                const tx = x % tileSize;
                const ty = y % tileSize;
                const isGrout = tx < groutSize || ty < groutSize;

                const n = this._fbm(x, y, 3, 24);
                const variation = (n - 0.5) * 20;

                // Per-tile subtle color variation
                const tileRow = Math.floor(y / tileSize);
                const tileCol = Math.floor(x / tileSize);
                const tileVariation = (this._hash(tileCol, tileRow) - 0.5) * 15;

                let r, g, b, height, roughness;
                if (isGrout) {
                    r = clamp(rgb.r * 0.5 + variation * 0.3, 0, 255);
                    g = clamp(rgb.g * 0.5 + variation * 0.3, 0, 255);
                    b = clamp(rgb.b * 0.5 + variation * 0.3, 0, 255);
                    height = 80;
                    roughness = 200;
                } else {
                    r = clamp(rgb.r + variation + tileVariation, 0, 255);
                    g = clamp(rgb.g + variation + tileVariation, 0, 255);
                    b = clamp(rgb.b + variation + tileVariation * 1.1, 0, 255);
                    height = clamp(170 + variation * 0.5, 0, 255);
                    roughness = clamp(60 + (n - 0.5) * 30, 0, 255); // tiles are smooth
                }

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;
                hd[idx] = height; hd[idx + 1] = height; hd[idx + 2] = height; hd[idx + 3] = 255;
                rd[idx] = roughness; rd[idx + 1] = roughness; rd[idx + 2] = roughness; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 1.5)
        };
        this.cache[key] = result;
        return result;
    }

    crate(baseColor) {
        const key = 'crate_' + baseColor;
        if (this.cache[key]) return this.cache[key];

        const sz = this.size;
        const rgb = this._hexToRgb(baseColor || 0x8B6914);

        const { canvas: diffCanvas, ctx: diffCtx } = this._createCanvas(sz, sz);
        const diffImg = diffCtx.createImageData(sz, sz);
        const dd = diffImg.data;

        const { canvas: hCanvas, ctx: hCtx } = this._createCanvas(sz, sz);
        const hImg = hCtx.createImageData(sz, sz);
        const hd = hImg.data;

        const { canvas: rCanvas, ctx: rCtx } = this._createCanvas(sz, sz);
        const rImg = rCtx.createImageData(sz, sz);
        const rd = rImg.data;

        const border = Math.floor(sz / 16);
        const plankWidth = Math.floor(sz / 6);

        for (let y = 0; y < sz; y++) {
            for (let x = 0; x < sz; x++) {
                const idx = (y * sz + x) * 4;

                // Wood grain (horizontal)
                const grain = this._valueNoise(x * 0.3, y * 4, 16) * 25 - 12;
                const n = this._fbm(x, y, 3, 20);
                const variation = (n - 0.5) * 20 + grain;

                // Crate frame border
                const isBorder = x < border || x > sz - border || y < border || y > sz - border;
                // Cross braces
                const isCross = Math.abs(x - y) < border * 0.7 || Math.abs(x - (sz - y)) < border * 0.7;
                // Plank lines
                const isPlankGap = x % plankWidth < 2;

                let r, g, b, height, roughness;
                if (isBorder || isCross) {
                    r = clamp(rgb.r * 0.7 + variation * 0.5, 0, 255);
                    g = clamp(rgb.g * 0.7 + variation * 0.5, 0, 255);
                    b = clamp(rgb.b * 0.6 + variation * 0.3, 0, 255);
                    height = 200;
                    roughness = 160;
                } else if (isPlankGap) {
                    r = clamp(rgb.r * 0.4, 0, 255);
                    g = clamp(rgb.g * 0.4, 0, 255);
                    b = clamp(rgb.b * 0.3, 0, 255);
                    height = 90;
                    roughness = 220;
                } else {
                    r = clamp(rgb.r + variation, 0, 255);
                    g = clamp(rgb.g + variation * 0.9, 0, 255);
                    b = clamp(rgb.b + variation * 0.5, 0, 255);
                    height = clamp(150 + variation * 0.5, 0, 255);
                    roughness = 180;
                }

                dd[idx] = r; dd[idx + 1] = g; dd[idx + 2] = b; dd[idx + 3] = 255;
                hd[idx] = height; hd[idx + 1] = height; hd[idx + 2] = height; hd[idx + 3] = 255;
                rd[idx] = roughness; rd[idx + 1] = roughness; rd[idx + 2] = roughness; rd[idx + 3] = 255;
            }
        }

        diffCtx.putImageData(diffImg, 0, 0);
        hCtx.putImageData(hImg, 0, 0);
        rCtx.putImageData(rImg, 0, 0);

        const result = {
            map: diffCanvas,
            roughnessMap: rCanvas,
            normalMap: this._generateNormalMap(hCanvas, 2.5)
        };
        this.cache[key] = result;
        return result;
    }

    // Build a MeshStandardMaterial from generated texture canvases
    buildMaterial(texData, options) {
        options = options || {};
        const matOpts = {
            map: this._makeTexture(texData.map, options.repeatX, options.repeatY),
            roughness: options.roughness !== undefined ? options.roughness : 0.8,
            metalness: options.metalness !== undefined ? options.metalness : 0.1,
        };

        if (!this.isMobile && texData.normalMap) {
            matOpts.normalMap = this._makeTexture(texData.normalMap, options.repeatX, options.repeatY);
            matOpts.normalScale = new THREE.Vector2(
                options.normalStrength || 0.8,
                options.normalStrength || 0.8
            );
        }

        if (texData.roughnessMap) {
            matOpts.roughnessMap = this._makeTexture(texData.roughnessMap, options.repeatX, options.repeatY);
        }

        if (options.color) matOpts.color = options.color;

        return new THREE.MeshStandardMaterial(matOpts);
    }

    // Dispose all cached textures
    dispose() {
        this.cache = {};
    }
}

const textureGen = new TextureGenerator();
