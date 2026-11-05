// Art.js — графика салона: загрузка картинок, окраска масок под выбранный цвет,
// «размазывание» слоя пальцем и ВРЕМЕННЫЕ заглушки для ещё не нарисованных файлов.
//
// Все картинки игры лежат в assets/art/… (список и требования — ART-PROMPT.md).
// Пока файла нет, Art рисует техническую заглушку прямо на канвасе и кладёт её в
// кэш движка под тем же путём: игра работает целиком, а как только файл появится,
// движок возьмёт настоящую картинку без единой правки кода.
//
//   await Art.ensure(['assets/art/tool/comb.webp', …])   загрузить (или подменить заглушкой)
//   Art.tint(path, '#d94f7a')                            маска -> ключ окрашенной копии
//   Art.reveal(path, w, h)                               слой, который проявляется под пальцем
//   Art.key(canvas)                                      положить свой холст в кэш движка

/** @satisfies {Record<string, any>} */
const Art = {
    /** @type {World2D | null} */
    world: null,
    seq: 0,

    // Палитра заглушек: спокойный «салонный» набор, чтобы сцена читалась и без арта.
    SKIN: { t1: '#f7d9c4', t2: '#e2ab80', t3: '#a46a45' },
    SKIN_DARK: { t1: '#e7bfa4', t2: '#c98f66', t3: '#875234' },
    PINK: '#e8709f', DEEP: '#7b3f62', LIGHT: '#fff4f8', HAIR: '#7a4632',

    init(world) { this.world = world; return this; },

    canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
        return c;
    },

    // Положить собственный холст в кэш движка и получить ключ для sprite.image.
    key(canvas, name) {
        const id = name || ('art:' + (++this.seq));
        if (this.world) this.world.images.set(id, canvas);
        return id;
    },

    has(path) { return !!(this.world && this.world.images.get(path)); },
    image(path) { return this.world ? this.world.images.get(path) : null; },

    // Загрузить список путей. Чего нет на диске — и файлы-пустышки 1x1 из
    // tools/art.mjs (картинка ещё не нарисована) — заменяются технической заглушкой.
    async ensure(paths) {
        const list = [...new Set(paths.filter(Boolean))];
        if (!this.world || !list.length) return;
        await this.world.preload(list);
        for (const path of list) {
            const image = this.world.images.get(path);
            if (image && (image.width > 2 || image.height > 2)) continue;
            this.world.images.set(path, this.placeholder(path));
        }
    },

    // Адрес картинки для тега <img> в интерфейсе: настоящий файл — свой путь,
    // ещё не нарисованный — data-URL временной фигуры. Звать после ensure().
    src(path) {
        const image = this.image(path);
        if (image && image.width > 2 && !image.toDataURL) return path;
        if (this._urls[path]) return this._urls[path];
        const canvas = image && image.toDataURL ? image : this.placeholder(path);
        this._urls[path] = canvas.toDataURL('image/png');
        return this._urls[path];
    },

    /** @type {Record<string, string>} */
    _urls: {},

    // Окрасить маску (белый рисунок с alpha) в цвет игрока. Возвращает ключ картинки.
    tint(path, color) {
        const id = 'tint|' + path + '|' + color;
        if (this.world.images.get(id)) return id;
        const src = this.image(path);
        const w = (src && src.width) || 256, h = (src && src.height) || 256;
        const c = this.canvas(w, h), g = c.getContext('2d');
        if (src) g.drawImage(src, 0, 0, w, h);
        else { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 6.2832); g.fill(); }
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.84; g.fillStyle = color; g.fillRect(0, 0, w, h);
        return this.key(c, id);
    },

    // Слой под пальцем: erase = false — проявляется (крем, тон), true — стирается
    // (смыть пену, снять маску, побрить). Процент покрытия считается по сетке 20x20.
    reveal(path, width, height, erase) {
        const src = this.image(path);
        const w = Math.round(width), h = Math.round(height);
        const out = this.canvas(w, h), mask = this.canvas(w, h);
        const cells = 64, filled = new Uint8Array(cells * cells);
        const sample = this.canvas(cells, cells), sg = sample.getContext('2d');
        if (src) sg.drawImage(src, 0, 0, cells, cells);
        const pixels = sg.getImageData(0, 0, cells, cells).data;
        const valid = new Uint8Array(cells * cells);
        for (let i = 0; i < valid.length; i++) valid[i] = !src || pixels[i * 4 + 3] > 2 ? 1 : 0;
        const total = valid.reduce((n, v) => n + v, 0) || 1;
        const layer = {
            key: this.key(out),
            count: 0, dirty: true,
            // x, y — в пикселях слоя (0..w, 0..h)
            paint(x, y, radius) {
                const g = mask.getContext('2d');
                g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, radius, 0, 6.2832); g.fill();
                const cx = Math.floor(x / w * cells), cy = Math.floor(y / h * cells);
                const spanX = Math.ceil(radius / w * cells), spanY = Math.ceil(radius / h * cells);
                for (let j = cy - spanY; j <= cy + spanY; j++) for (let i = cx - spanX; i <= cx + spanX; i++) {
                    if (i < 0 || j < 0 || i >= cells || j >= cells) continue;
                    const at = j * cells + i;
                    const distance = ((i + .5) * w / cells - x) ** 2 + ((j + .5) * h / cells - y) ** 2;
                    if (valid[at] && !filled[at] && distance <= radius * radius) { filled[at] = 1; layer.count++; }
                }
                layer.dirty = true;
            },
            fill() {
                const g = mask.getContext('2d');
                g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
                filled.fill(1); layer.count = total; layer.dirty = true;
            },
            get progress() { return layer.count / total; },
            refresh() {
                if (!layer.dirty) return;
                layer.dirty = false;
                const g = out.getContext('2d');
                g.setTransform(1, 0, 0, 1, 0, 0);
                g.clearRect(0, 0, w, h);
                if (src) g.drawImage(src, 0, 0, w, h);
                else { g.fillStyle = 'rgba(255,255,255,.72)'; g.fillRect(0, 0, w, h); }
                g.globalCompositeOperation = erase ? 'destination-out' : 'destination-in';
                g.drawImage(mask, 0, 0);
                g.globalCompositeOperation = 'source-over';
            },
        };
        layer.refresh();
        return layer;
    },

    // --- Заглушки ---------------------------------------------------------------
    // Пока художник не отдал файл, рисуем узнаваемую форму: игра проверяется целиком.
    // Это ТЕХНИЧЕСКАЯ подмена, а не готовая графика.

    kind(path) {
        const m = /assets\/art\/([^/]+)\/([^/.]+)/.exec(path);
        return m ? { dir: m[1], name: m[2] } : { dir: 'ui', name: 'icon' };
    },

    placeholder(path) {
        const { dir, name } = this.kind(path);
        const tone = /_(t[123])$/.exec(name);
        const skin = this.SKIN[tone ? tone[1] : 't1'], dark = this.SKIN_DARK[tone ? tone[1] : 't1'];
        if (dir === 'bg') return this.bgArt(name);
        if (dir === 'model') return this.modelArt(name.replace(/_t[123]$/, ''), skin, dark);
        if (dir === 'hair') return this.hairArt(name);
        if (dir === 'wear') return this.wearArt(name);
        if (dir === 'makeup') return this.maskArt(name);
        if (dir === 'tool') return this.toolArt(name);
        return this.blobArt(dir, name);
    },

    bgArt(name) {
        const c = this.canvas(720, 1280), g = c.getContext('2d');
        const top = /runway|wardrobe/.test(name) ? '#efdcff' : '#ffeef6';
        const bottom = /runway|wardrobe/.test(name) ? '#c9a7ef' : '#f4c9dd';
        const grd = g.createLinearGradient(0, 0, 0, 1280);
        grd.addColorStop(0, top); grd.addColorStop(1, bottom);
        g.fillStyle = grd; g.fillRect(0, 0, 720, 1280);
        g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
        for (let i = 0; i < 26; i++) {
            const x = (i * 137) % 720, y = (i * 211) % 1280, r = 14 + (i % 5) * 9;
            g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        }
        g.globalAlpha = 1;
        return c;
    },

    // Общая «кушетка/стол» под героиней, чтобы сцена не висела в пустоте.
    couch(g, w, h) {
        g.fillStyle = '#ffffff'; this.round(g, w * 0.06, h * 0.06, w * 0.88, h * 0.9, 48); g.fill();
        g.fillStyle = '#f7d3e2'; this.round(g, w * 0.06, h * 0.06, w * 0.88, h * 0.16, 40); g.fill();
    },

    round(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    },

    ellipse(g, x, y, rx, ry, fill) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.2832); g.fill(); },

    face(g, cx, cy, rx, ry, skin, dark, opts = {}) {
        this.ellipse(g, cx, cy, rx, ry, skin);
        if (opts.hair !== false) {
            g.save(); g.beginPath(); g.ellipse(cx, cy - ry * 0.62, rx * 1.06, ry * 0.5, 0, Math.PI, 0); g.fill();
            g.fillStyle = this.HAIR; g.fill(); g.restore();
        }
        const eye = rx * 0.38, ey = cy - ry * 0.1;
        for (const s of [-1, 1]) {
            this.ellipse(g, cx + s * eye, ey, rx * 0.17, ry * 0.075, '#ffffff');
            this.ellipse(g, cx + s * eye, ey, rx * 0.075, ry * 0.05, '#4a3428');
            g.strokeStyle = dark; g.lineWidth = Math.max(2, rx * 0.035);
            g.beginPath(); g.ellipse(cx + s * eye, ey - ry * 0.13, rx * 0.19, ry * 0.07, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
        this.ellipse(g, cx, cy + ry * 0.12, rx * 0.09, ry * 0.05, dark);
        this.ellipse(g, cx, cy + ry * 0.42, rx * 0.26, ry * 0.1, '#d9708f');
        this.ellipse(g, cx - rx * 0.6, cy + ry * 0.2, rx * 0.2, ry * 0.1, 'rgba(226,120,150,.35)');
        this.ellipse(g, cx + rx * 0.6, cy + ry * 0.2, rx * 0.2, ry * 0.1, 'rgba(226,120,150,.35)');
    },

    modelArt(view, skin, dark) {
        const size = {
            face: [640, 940], spa: [680, 1000], hair: [700, 1020], legs: [600, 1020],
            hands: [660, 780], feet: [600, 900], back: [640, 980], body: [420, 1000],
        }[view] || [640, 940];
        const c = this.canvas(size[0], size[1]), g = c.getContext('2d');
        const w = size[0], h = size[1];
        if (view === 'face') {
            this.face(g, w / 2, h * 0.52, w * 0.33, h * 0.31, skin, dark);
            g.fillStyle = skin; this.round(g, w * 0.28, h * 0.79, w * 0.44, h * 0.2, 60); g.fill();
        } else if (view === 'spa') {
            this.couch(g, w, h);
            this.face(g, w / 2, h * 0.42, w * 0.2, h * 0.19, skin, dark, { hair: false });
            g.fillStyle = '#f6a8c8'; this.round(g, w * 0.28, h * 0.17, w * 0.44, h * 0.14, 50); g.fill();
            g.fillStyle = skin; this.round(g, w * 0.24, h * 0.62, w * 0.52, h * 0.3, 70); g.fill();
        } else if (view === 'hair') {
            this.couch(g, w, h);
            this.ellipse(g, w / 2, h * 0.42, w * 0.42, h * 0.3, this.HAIR);
            this.face(g, w / 2, h * 0.64, w * 0.15, h * 0.11, skin, dark, { hair: false });
        } else if (view === 'legs') {
            this.couch(g, w, h);
            for (const s of [-1, 1]) { g.fillStyle = skin; this.round(g, w / 2 + s * w * 0.3 - w * 0.12, h * 0.2, w * 0.24, h * 0.72, 60); g.fill(); }
            for (const s of [-1, 1]) { g.fillStyle = dark; this.round(g, w / 2 + s * w * 0.3 - w * 0.1, h * 0.88, w * 0.2, h * 0.1, 30); g.fill(); }
        } else if (view === 'hands') {
            this.couch(g, w, h);
            for (const s of [-1, 1]) {
                g.fillStyle = skin; this.round(g, w / 2 + s * w * 0.24 - w * 0.16, h * 0.34, w * 0.32, h * 0.4, 46); g.fill();
                for (let i = 0; i < 4; i++) { this.ellipse(g, w / 2 + s * (w * 0.1 + i * w * 0.07), h * 0.32, w * 0.033, h * 0.05, skin); }
            }
        } else if (view === 'feet') {
            this.couch(g, w, h);
            for (const s of [-1, 1]) { g.fillStyle = skin; this.round(g, w / 2 + s * w * 0.22 - w * 0.14, h * 0.28, w * 0.28, h * 0.52, 50); g.fill(); }
        } else if (view === 'back') {
            this.couch(g, w, h);
            g.fillStyle = skin; this.round(g, w * 0.22, h * 0.24, w * 0.56, h * 0.62, 90); g.fill();
            g.fillStyle = dark; this.round(g, w * 0.47, h * 0.3, w * 0.06, h * 0.5, 20); g.fill();
            this.ellipse(g, w / 2, h * 0.18, w * 0.14, h * 0.09, this.HAIR);
        } else {
            this.face(g, w / 2, h * 0.14, w * 0.2, h * 0.09, skin, dark);
            g.fillStyle = skin; this.round(g, w * 0.24, h * 0.22, w * 0.52, h * 0.38, 60); g.fill();
            for (const s of [-1, 1]) { g.fillStyle = skin; this.round(g, w / 2 + s * w * 0.13 - w * 0.1, h * 0.56, w * 0.2, h * 0.4, 44); g.fill(); }
            g.fillStyle = '#f19cc0'; this.round(g, w * 0.26, h * 0.3, w * 0.48, h * 0.26, 34); g.fill();
        }
        return c;
    },

    hairArt(name) {
        const c = this.canvas(460, 560), g = c.getContext('2d');
        const long = /0[13579]$/.test(name);
        g.fillStyle = this.HAIR;
        this.ellipse(g, 230, 180, 175, 165, this.HAIR);
        this.round(g, 44, 150, 372, long ? 380 : 190, 90); g.fill();
        g.globalAlpha = 0.25; this.ellipse(g, 180, 150, 60, 80, '#ffffff'); g.globalAlpha = 1;
        return c;
    },

    wearArt(name) {
        const c = this.canvas(460, 700), g = c.getContext('2d');
        const cat = name.split('_')[0];
        const hue = (name.charCodeAt(name.length - 1) * 47) % 360;
        const color = 'hsl(' + hue + ',68%,68%)';
        g.fillStyle = color;
        if (cat === 'dress') { g.beginPath(); g.moveTo(160, 40); g.lineTo(300, 40); g.lineTo(400, 620); g.lineTo(60, 620); g.closePath(); g.fill(); }
        else if (cat === 'top') { this.round(g, 120, 40, 220, 250, 40); g.fill(); }
        else if (cat === 'bottom') { g.beginPath(); g.moveTo(130, 20); g.lineTo(330, 20); g.lineTo(390, 330); g.lineTo(70, 330); g.closePath(); g.fill(); }
        else if (cat === 'shoes') { for (const s of [0, 1]) { this.round(g, 60 + s * 190, 60, 150, 110, 40); g.fill(); } }
        else if (cat === 'bag') { this.round(g, 130, 110, 200, 170, 34); g.fill(); g.strokeStyle = color; g.lineWidth = 16; g.beginPath(); g.arc(230, 110, 78, Math.PI, 0); g.stroke(); }
        else { this.ellipse(g, 230, 180, 120, 120, color); g.fillStyle = '#fff'; this.ellipse(g, 230, 180, 52, 52, '#ffffff'); }
        return c;
    },

    maskArt(name) {
        const shapes = {
            foundation: [380, 520], concealer: [200, 200], powder: [380, 520], blush: [170, 110],
            contour: [360, 500], highlight: [200, 120], lips_a: [190, 110], lips_b: [190, 110],
            lips_c: [190, 110], gloss: [190, 110], brow_a: [150, 54], brow_b: [150, 54],
            lashes_a: [150, 80], lashes_b: [150, 80], liner_a: [170, 70], liner_b: [170, 70],
            shadow_a: [160, 94], shadow_b: [160, 94], shadow_c: [160, 94], lens: [70, 70],
            glitter: [160, 100], freckles: [280, 160], gem: [60, 60],
        }[name] || [180, 120];
        const c = this.canvas(shapes[0], shapes[1]), g = c.getContext('2d');
        g.fillStyle = '#ffffff';
        if (/lips/.test(name) || name === 'gloss') {
            g.beginPath();
            g.moveTo(10, shapes[1] / 2);
            g.quadraticCurveTo(shapes[0] * 0.3, -6, shapes[0] / 2, shapes[1] * 0.36);
            g.quadraticCurveTo(shapes[0] * 0.7, -6, shapes[0] - 10, shapes[1] / 2);
            g.quadraticCurveTo(shapes[0] / 2, shapes[1] + 8, 10, shapes[1] / 2);
            g.fill();
        } else if (/brow|liner/.test(name)) {
            g.beginPath(); g.moveTo(6, shapes[1] * 0.8);
            g.quadraticCurveTo(shapes[0] * 0.45, -shapes[1] * 0.1, shapes[0] - 6, shapes[1] * 0.45);
            g.quadraticCurveTo(shapes[0] * 0.5, shapes[1] * 0.35, 6, shapes[1]); g.fill();
        } else {
            this.ellipse(g, shapes[0] / 2, shapes[1] / 2, shapes[0] / 2 - 4, shapes[1] / 2 - 4, '#ffffff');
        }
        return c;
    },

    // Иконки инструментов: узнаваемая форма из простых фигур + подпись первой буквой.
    toolArt(name) {
        const c = this.canvas(192, 192), g = c.getContext('2d');
        const hue = ([...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 23) % 360;
        g.fillStyle = 'hsl(' + hue + ',62%,62%)';
        this.round(g, 18, 18, 156, 156, 44); g.fill();
        g.fillStyle = 'rgba(255,255,255,.9)';
        this.round(g, 74, 40, 44, 112, 22); g.fill();
        this.ellipse(g, 96, 52, 30, 30, 'rgba(255,255,255,.95)');
        g.fillStyle = 'hsl(' + hue + ',52%,34%)';
        g.font = 'bold 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(name.slice(0, 2).toUpperCase(), 96, 128);
        return c;
    },

    // Мелкие наклейки: прыщик, лист, камень, лак, звёздочка интерфейса.
    blobArt(dir, name) {
        const big = /stone|mask_sheet|patch|cucumber|towel|foam|wax|bath|confetti|logo|ribbon/.test(name);
        const c = this.canvas(big ? 256 : 128, big ? 256 : 128), g = c.getContext('2d');
        const w = c.width;
        const tone = {
            blemish: '#d8646b', care: '#bfe6f2', hairjob: '#6c5b46', legjob: '#d9b08c',
            nailjob: '#e86ba0', spajob: '#6a6f7a', ui: '#ffbf3c',
        }[dir] || '#e8709f';
        this.ellipse(g, w / 2, w / 2, w * 0.36, w * 0.36, tone);
        g.globalAlpha = 0.45; this.ellipse(g, w * 0.4, w * 0.38, w * 0.12, w * 0.1, '#ffffff'); g.globalAlpha = 1;
        if (dir === 'ui' && /star/.test(name)) {
            g.fillStyle = /off/.test(name) ? '#c9c2cf' : '#ffcf4a';
            g.beginPath();
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? w * 0.18 : w * 0.42, a = -Math.PI / 2 + i * Math.PI / 5;
                g[i ? 'lineTo' : 'moveTo'](w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r);
            }
            g.closePath(); g.fill();
        }
        return c;
    },
};
