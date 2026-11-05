// Stages.js — процедуры салона: из короткой записи уровня («spots:5», «makeup:foundation+lips»)
// собираются шаги, а шаг знает, что игрок должен сделать пальцем.
//
// Виды шагов:
//   tap    — коснуться цели правильным инструментом (убрать прыщик, положить камень,
//            накрасить ресницы); неверный инструмент = ошибка
//   cover  — провести пальцем по зоне, слой проявляется (пенка, тон, масло)
//   erase  — провести пальцем по зоне, слой стирается (смыть, снять маску, побрить)
//   pick   — сначала выбрать цвет/наклейку в палитре, затем коснуться целей
//   trace  — провести по линии через точки-маркеры (стрелки)
//   hold   — выдержка по времени (маска работает, ножки парятся)
//
// Все места действия берутся из маркеров карты (js/Maps2D.js): правка карты двигает игру.
// Сцены dressup и runway ведёт js/Game.js — там свой интерфейс.

/** @satisfies {Record<string, any>} */
const Stages = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {World2D | null} */ world: null,
    /** @type {any} */ level: null,
    tone: 't1',
    /** @type {any[]} */ steps: [],
    at: 0,
    mistakes: 0,
    /** @type {string | null} */ tool: null,
    /** @type {any} */ pick: null,
    /** @type {any[]} */ fx: [],
    /** @type {any} */ cursor: null,
    /** @type {any} */ drag: null,
    idle: 0,
    wrongAt: 0,
    stageFinishWait: 0,
    trailWait: 0,
    rnd: () => Math.random(),
    /** @type {(() => void) | null} */ onStepDone: null,
    /** @type {(() => void) | null} */ onStageDone: null,
    /** @type {((text: string) => void) | null} */ onText: null,

    // Какая сцена (карта) нужна процедуре.
    SCENE: {
        cleanse: 'spa', spots: 'spa', mask: 'spa', patches: 'spa', cream: 'spa',
        hairclean: 'hair', haircut: 'hair', hairwash: 'hair',
        wax: 'legs', shave: 'legs', legcare: 'legs',
        footbath: 'feet', footfile: 'feet', pedicure: 'feet',
        manicure: 'hands', nailart: 'hands',
        massage: 'back', oilrub: 'back',
        makeup: 'makeup', dressup: 'dressup', runway: 'runway',
    },

    // «spots:5» -> { type: 'spots', count: 5, list: [] }; «makeup:a+b» -> list.
    parse(token) {
        const [type, rest] = String(token).split(':');
        const count = rest && /^\d+$/.test(rest) ? parseInt(rest, 10) : 0;
        const list = rest && !count ? rest.split('+') : [];
        return { token, type, count, list, scene: this.SCENE[type] || 'spa' };
    },

    plan(level) {
        return level.stages.map(t => this.parse(t));
    },

    // Детерминированный генератор: уровень выглядит одинаково при перезапуске.
    seed(n) {
        let a = (n * 2654435761) >>> 0;
        this.rnd = () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    shuffled(list) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(this.rnd() * (i + 1));
            const t = out[i]; out[i] = out[j]; out[j] = t;
        }
        return out;
    },

    // --- Геометрия маркеров -----------------------------------------------------
    rect(m) {
        return m.width ? { x: m.x, y: m.y, width: m.width, height: m.height }
            : { x: m.x - 40, y: m.y - 40, width: 80, height: 80 };
    },
    center(m) { return m.width ? { x: m.x + m.width / 2, y: m.y + m.height / 2 } : { x: m.x, y: m.y }; },
    bounds(markers) {
        const list = markers.map(m => this.rect(m));
        const x = Math.min(...list.map(r => r.x)), y = Math.min(...list.map(r => r.y));
        const x2 = Math.max(...list.map(r => r.x + r.width)), y2 = Math.max(...list.map(r => r.y + r.height));
        return { x, y, width: x2 - x, height: y2 - y };
    },
    // Keep the complete sprite footprint apart, not just its centre point.
    spacedMarkers(markers, count, size) {
        const chosen = [];
        for (const m of this.shuffled(markers)) {
            const c = this.center(m);
            if (chosen.some(p => Math.abs(this.center(p).x - c.x) < size + 8 && Math.abs(this.center(p).y - c.y) < size + 8)) continue;
            chosen.push(m);
            if (chosen.length >= Math.max(1, count)) break;
        }
        return chosen;
    },
    /** @param {World2D} [world] */
    frameScene(world) {
        world = world || this.world;
        const frame = world.marker('frame');
        const camera = world.camera;
        world.width = frame ? frame.width : world.map.width;
        world.height = frame ? frame.height : world.map.height;
        world.resize();
        camera.zoom = 1;
        camera.x = frame ? frame.x + frame.width / 2 : world.width / 2;
        camera.y = frame ? frame.y + frame.height / 2 : world.height / 2;
        camera.update();
    },

    // --- Сбор процедуры ---------------------------------------------------------

    // Все картинки, которые понадобятся процедуре: их грузим под экраном загрузки.
    assets(plan, tone) {
        const list = [MODEL_ART[plan.scene] ? MODEL_ART[plan.scene][tone] : '', CARE_ART.sparkle];
        const add = (v) => { if (v) list.push(v); };
        for (const t of Object.values(TOOLS)) add(t.icon);
        if (plan.type === 'spots') for (const s of SPOT_ART) add(s.image);
        if (plan.type === 'hairclean') for (const s of MESS_ART) add(s.image);
        if (plan.type === 'haircut') add(SPLIT_ART.image);
        if (plan.type === 'legcare') for (const s of FLAW_ART) add(s.image);
        if (plan.type === 'nailart') for (const d of DECALS) add(d.image);
        if (plan.type === 'makeup') for (const key of plan.list) { const s = MAKEUP_STEPS[key]; if (s) add(s.mask); }
        for (const v of Object.values(CARE_ART)) add(v);
        return list;
    },

    // Построить шаги процедуры на загруженной сцене.
    build(plan, ctx) {
        this.app = ctx.app; this.world = ctx.app.world2d; this.level = ctx.level; this.tone = ctx.tone;
        this.steps = []; this.at = 0; this.tool = null; this.pick = null; this.fx = []; this.drag = null; this.idle = 0;
        this.stageFinishWait = 0; this.trailWait = 0;
        const w = this.world;
        this.frameScene();
        const model = w.marker('model');
        if (model && MODEL_ART[plan.scene]) {
            const r = this.rect(model);
            w.addSprite({ x: r.x, y: r.y, width: r.width, height: r.height, z: 0, image: MODEL_ART[plan.scene][this.tone], color: '#f3cdb8' });
        }
        const make = this['make_' + plan.type];
        if (typeof make === 'function') make.call(this, plan);
        this.cursor = w.addSprite({ x: -999, y: -999, width: 96, height: 96, z: 95, visible: false, image: '' });
        this.begin();
        return this.steps;
    },

    // --- Конструкторы шагов -----------------------------------------------------
    step(data) { this.steps.push(Object.assign({ done: false, tools: [], targets: [] }, data)); return this.steps[this.steps.length - 1]; },

    // Шаг «коснуться целей». targets: [{ x, y, tool, sprite, add }]
    tapStep(text, targets, tools) { return this.step({ kind: 'tap', text, targets, tools }); },

    // Шаг «провести пальцем»: слой проявляется (erase = false) или стирается (true).
    rubStep(text, tool, zone, image, erase, tint) {
        const r = this.rect(zone);
        const path = tint ? Art.tint(image, tint) : image;
        const layer = Art.reveal(path, r.width, r.height, erase);
        const sprite = this.world.addSprite({ x: r.x, y: r.y, width: r.width, height: r.height, z: erase ? 30 : 12, image: layer.key });
        return this.step({ kind: erase ? 'erase' : 'cover', text, tool, tools: [tool], zone: r, layer, sprite });
    },

    // Шаг «выбери цвет и накрась». targets — маркеры, mask — белая маска.
    pickStep(text, tool, markers, mask, size, palette, items) {
        const targets = markers.map(m => {
            const c = this.center(m);
            return { x: c.x, y: c.y, tool, sprite: null, width: size[0], height: size[1], flipX: mask.includes('/makeup/') && m.name.endsWith('-l') };
        });
        return this.step({ kind: 'pick', text, tool, tools: [tool], targets, mask, palette, items, z: 25 });
    },

    traceStep(text, tool, paths, mask, size, color) {
        return this.step({ kind: 'trace', text, tool, tools: [tool], paths, mask, size, color, z: 26 });
    },

    holdStep(text, seconds) { return this.step({ kind: 'hold', text, left: seconds, total: seconds }); },

    // Связать «нанесли -> смываем»: слой второго шага ждёт своей очереди, а в момент
    // начала убирает то, что оставил первый (иначе пена лежала бы в два слоя).
    link(prev, next) {
        if (next.sprite) next.sprite.visible = false;
        next.onBegin = () => {
            if (prev.sprite) this.world.removeSprite(prev.sprite);
            for (const t of (prev.targets || [])) if (t.added) this.world.removeSprite(t.added);
            if (next.sprite) next.sprite.visible = true;
        };
    },

    // --- Процедуры --------------------------------------------------------------
    make_cleanse() {
        const zone = this.world.marker('zone-face');
        const foam = this.rubStep('stepCleanse', 'cleanser', zone, CARE_ART.foam, false);
        this.link(foam, this.rubStep('stepRinse', 'towel', zone, CARE_ART.foam, true));
    },

    make_spots(plan) {
        const markers = this.spacedMarkers(this.world.markers('spot'), plan.count, 50);
        const kinds = this.shuffled(SPOT_ART.filter(k => k.id !== 'hairspot'));
        const targets = markers.map((m, i) => {
            const kind = m.name === 'spot-nose' ? SPOT_ART.find(k => k.id === 'blackhead') : kinds[i % kinds.length];
            const c = this.center(m);
            const size = Math.min(50, kind.size);
            const sprite = this.world.addSprite({ x: c.x - size / 2, y: c.y - size / 2, width: size, height: size, z: 20, image: kind.image, color: '#d8646b' });
            return { x: c.x, y: c.y, tool: kind.tool, sprite };
        });
        const tools = [...new Set(targets.map(t => t.tool))];
        this.tapStep('stepSpots', targets, tools);
    },

    make_mask() {
        const zone = this.world.marker('zone-face');
        const r = this.rect(zone), c = this.center(zone);
        const put = this.tapStep('stepMask', [{ x: c.x, y: c.y, tool: 'maskSheet', add: { image: CARE_ART.maskSheet, width: r.width, height: r.height, z: 30 } }], ['maskSheet']);
        this.holdStep('stepMaskHold', typeof CARE_HOLD_SEC !== 'undefined' ? CARE_HOLD_SEC : 2);
        this.link(put, this.rubStep('stepMaskOff', 'spatula', zone, CARE_ART.maskSheet, true));
    },

    make_patches() {
        const eyes = this.world.markers('eye').map(m => {
            const c = this.center(m);
            return { x: c.x, y: c.y, tool: 'patch', add: { image: CARE_ART.patch, width: 132, height: 76, z: 30 } };
        });
        this.tapStep('stepPatches', eyes, ['patch', 'cucumber']);
    },

    make_cream() {
        this.rubStep('stepCream', 'cream', this.world.marker('zone-face'), CARE_ART.cream, false);
        this.rubStep('stepGlow', 'sponge', this.world.marker('zone-face'), CARE_ART.glow, false);
    },

    make_hairclean(plan) {
        const markers = this.spacedMarkers(this.world.markers('mess'), plan.count, 80);
        const kinds = this.shuffled(MESS_ART);
        const targets = markers.map((m, i) => {
            const kind = kinds[i % kinds.length], c = this.center(m);
            const sprite = this.world.addSprite({ x: c.x - kind.size / 2, y: c.y - kind.size / 2, width: kind.size, height: kind.size, z: 20, image: kind.image, color: '#6c5b46' });
            return { x: c.x, y: c.y, tool: kind.tool, sprite };
        });
        this.tapStep('stepHairClean', targets, [...new Set(targets.map(t => t.tool))]);
    },

    make_haircut(plan) {
        const markers = this.spacedMarkers(this.world.markers('mess'), plan.count, SPLIT_ART.size);
        const targets = markers.map(m => {
            const c = this.center(m), s = SPLIT_ART.size;
            const sprite = this.world.addSprite({ x: c.x - s / 2, y: c.y - s / 2, width: s, height: s, z: 20, image: SPLIT_ART.image, color: '#8a6a4a' });
            return { x: c.x, y: c.y, tool: SPLIT_ART.tool, sprite };
        });
        this.tapStep('stepHairCut', targets, ['scissors', 'comb']);
    },

    make_hairwash() {
        const zone = this.world.marker('zone-hair');
        const foam = this.rubStep('stepHairWash', 'shampoo', zone, CARE_ART.hairFoam, false);
        this.link(foam, this.rubStep('stepRinse', 'sponge', zone, CARE_ART.hairFoam, true));
        this.rubStep('stepDry', 'dryer', zone, CARE_ART.hairShine, false);
    },

    make_wax(plan) {
        const zone = this.world.marker('zone-legs');
        const segs = this.world.markers('seg').slice(0, Math.max(1, plan.count));
        const hair = this.world.addSprite(Object.assign(this.rect(zone), { z: 10, image: CARE_ART.legHair, color: '#c9a98a' }));
        const wax = this.rubStep('stepWax', 'waxPot', zone, CARE_ART.wax, false);
        const targets = segs.map(m => {
            const r = this.rect(m), c = this.center(m);
            const sprite = this.world.addSprite({ x: r.x, y: r.y, width: r.width, height: r.height, z: 32, image: CARE_ART.waxStrip, color: '#cfe4f5', visible: false });
            return { x: c.x, y: c.y, tool: 'waxStrip', sprite };
        });
        const strip = this.tapStep('stepWaxOff', targets, ['waxStrip', 'cotton']);
        strip.onBegin = () => { for (const t of targets) { t.sprite.visible = true; this.animateSprite(t.sprite); } };
        strip.onDone = () => { this.world.removeSprite(hair); this.world.removeSprite(wax.sprite); };
    },

    make_shave() {
        const zone = this.world.marker('zone-legs');
        this.rubStep('stepShave', 'razor', zone, CARE_ART.legHair, true);
        this.rubStep('stepLegCare', 'lotion', zone, CARE_ART.legLotion, false);
    },

    make_legcare(plan) {
        const markers = this.spacedMarkers(this.world.markers('flaw'), plan.count, 62);
        const kinds = this.shuffled(FLAW_ART);
        const targets = markers.map((m, i) => {
            const kind = kinds[i % kinds.length], c = this.center(m);
            const size = Math.min(kind.size, m.name.startsWith('flaw-ankle') ? 40 : 62);
            const sprite = this.world.addSprite({ x: c.x - size / 2, y: c.y - size / 2, width: size, height: size, z: 20, image: kind.image, color: '#c96a6a' });
            return { x: c.x, y: c.y, tool: kind.tool, sprite };
        });
        this.tapStep('stepLegCare', targets, [...new Set(targets.map(t => t.tool))]);
        this.rubStep('stepCream', 'lotion', this.world.marker('zone-legs'), CARE_ART.legLotion, false);
    },

    make_footbath() {
        const bath = this.world.marker('bath');
        this.rubStep('stepFootBath', 'saltJar', bath, CARE_ART.footFoam, false);
        this.holdStep('stepSoak', typeof CARE_HOLD_SEC !== 'undefined' ? CARE_HOLD_SEC : 2);
    },

    make_footfile() {
        const heels = this.world.markers('heel');
        const zone = { name: 'heels', ...this.bounds(heels) };
        this.rubStep('stepFootFile', 'footFile', zone, CARE_ART.roughHeel, true);
        this.rubStep('stepCream', 'footCream', zone, CARE_ART.legLotion, false);
    },

    make_pedicure(plan) {
        const nails = this.world.markers('nail').slice(0, Math.max(1, plan.count));
        this.pickStep('stepPedicure', 'polish', nails, CARE_ART.nailPolish, [34, 46], PALETTES.nails);
    },

    make_manicure(plan) {
        this.rubStep('stepFile', 'nailFile', this.world.marker('zone-hands'), CARE_ART.nailLong, true);
        const nails = this.world.markers('nail').slice(0, Math.max(1, plan.count));
        this.pickStep('stepManicure', 'polish', nails, CARE_ART.nailPolish, [38, 50], PALETTES.nails);
    },

    make_nailart(plan) {
        const nails = this.world.markers('nail').slice(0, Math.max(1, plan.count));
        this.pickStep('stepNailArt', 'decal', nails, '', [34, 34], null, DECALS);
    },

    make_massage(plan) {
        const stones = this.world.markers('stone').slice(0, Math.max(1, plan.count));
        const targets = stones.map(m => {
            const c = this.center(m);
            return { x: c.x, y: c.y, tool: 'stone', add: { image: CARE_ART.stone, width: 74, height: 54, z: 30 } };
        });
        this.tapStep('stepMassage', targets, ['stone', 'flower']);
    },

    make_oilrub() {
        const zone = this.world.marker('zone-back');
        this.rubStep('stepOilRub', 'oil', zone, CARE_ART.oil, false);
        this.rubStep('stepGlow', 'palms', zone, CARE_ART.glow, false);
    },

    make_makeup(plan) {
        for (const key of plan.list) {
            const s = MAKEUP_STEPS[key];
            if (!s) continue;
            const text = 'do' + key.charAt(0).toUpperCase() + key.slice(1);
            if (s.mode === 'rub') {
                this.rubStep(text, s.tool, this.world.marker(s.zone), s.mask, false, s.color);
            } else if (s.mode === 'pick') {
                this.pickStep(text, s.tool, this.world.markers(s.at), s.mask, s.size, PALETTES[s.palette]);
            } else if (s.mode === 'trace') {
                const paths = ['liner-l', 'liner-r'].map(name => {
                    const points = this.world.markers(name).map(m => this.center(m));
                    return { points, at: 0, active: false, done: false };
                }).filter(p => p.points.length > 1);
                const eyes = this.world.markers('eye').map(m => this.center(m));
                this.traceStep(text, s.tool, paths.map((p, i) => Object.assign(p, { anchor: eyes[i] || p.points[0], flip: i === 0 })), s.mask, s.size, s.color);
            } else {
                const targets = this.world.markers(s.at).map(m => {
                    const c = this.center(m);
                    return { x: c.x, y: c.y, tool: s.tool, add: { image: Art.tint(s.mask, s.color), width: s.size[0], height: s.size[1], z: 26, flipX: m.name.endsWith('-l') } };
                });
                this.tapStep(text, targets, [s.tool]);
            }
        }
    },

    // --- Ход процедуры ----------------------------------------------------------
    get step0() { return this.steps[this.at] || null; },

    begin() {
        const step = this.step0;
        if (!step) return;
        if (step.onBegin) step.onBegin();
        this.pick = step.items ? step.items[0].id : (step.palette ? step.palette[0] : null);
        this.idle = 0;
        if (this.onText) this.onText(step.text);
    },

    // Инструменты, которые показываем в доке всю процедуру (чтобы выбор имел смысл).
    tools() {
        const set = [];
        for (const step of this.steps) for (const t of (step.tools || [])) if (!set.includes(t)) set.push(t);
        return set;
    },

    // Палитра текущего шага для интерфейса.
    palette() {
        const step = this.step0;
        if (!step) return [];
        if (step.items) return step.items.map(i => ({ id: i.id, image: i.image }));
        if (step.palette) return step.palette.map(c => ({ id: c, color: c }));
        return [];
    },

    setTool(id) { this.up(); this.tool = id; this.idle = 0; },
    setPick(id) { this.pick = id; this.idle = 0; },

    // --- Ввод -------------------------------------------------------------------
    down(x, y) {
        const step = this.step0;
        if (!step) return;
        this.idle = 0;
        this.drag = { step, last: { x, y } };
        if (step.kind === 'tap' || step.kind === 'pick') { this.hitTarget(step, x, y); return; }
        if (step.kind === 'cover' || step.kind === 'erase') { this.drag.rub = true; this.rub(step, x, y); return; }
        if (step.kind === 'trace') this.traceDown(step, x, y);
    },

    move(x, y) {
        const step = this.step0;
        if (!step || !this.drag || this.drag.step !== step) return;
        if (step.kind === 'tap' || step.kind === 'pick') {
            const last = this.drag.last;
            this.drag.last = { x, y };
            this.hitTarget(step, x, y, last);
            return;
        }
        // Шаг мог смениться прямо под пальцем: тереть можно только то, что трут.
        const rubbing = step.kind === 'cover' || step.kind === 'erase';
        if (this.drag && this.drag.rub && rubbing) this.rub(step, x, y);
        else if (step.kind === 'trace') this.traceMove(step, x, y);
    },

    up() {
        const step = this.step0;
        this.drag = null;
        if (step && step.kind === 'trace') for (const p of step.paths) if (!p.done) { p.active = false; p.at = 0; }
    },

    // Промах по инструменту: не чаще раза в секунду, чтобы не копить ошибки зря.
    wrong(key) {
        const now = performance.now();
        if (now - this.wrongAt < 900) return;
        this.wrongAt = now;
        this.mistakes++;
        Sound.play(SFX.error, { volume: 0.5 });
        UI.toast(Lang.t(key || 'wrongTool'));
    },

    hitTarget(step, x, y, from = { x, y }) {
        const radius = typeof CARE_TAP_RADIUS !== 'undefined' ? CARE_TAP_RADIUS : 66;
        const nearby = [];
        const dx = x - from.x, dy = y - from.y, length2 = dx * dx + dy * dy;
        for (const t of step.targets) {
            if (t.hit) continue;
            const k = length2 ? Math.max(0, Math.min(1, ((t.x - from.x) * dx + (t.y - from.y) * dy) / length2)) : 0;
            const distance = (t.x - from.x - k * dx) ** 2 + (t.y - from.y - k * dy) ** 2;
            if (distance <= radius * radius) nearby.push({ target: t, k });
        }
        if (!nearby.length) return;
        if (!this.tool) { UI.toast(Lang.t('pickTool')); return; }
        const matching = nearby.filter(p => p.target.tool === this.tool).sort((a, b) => a.k - b.k);
        if (!matching.length) { this.wrong('wrongTool'); return; }
        if (step.kind === 'pick' && !this.pick) { UI.toast(Lang.t('pickColor')); return; }
        for (const p of matching) {
            if (this.step0 !== step) break;
            this.apply(step, p.target);
        }
    },

    apply(step, target) {
        target.hit = true;
        const tool = TOOLS[target.tool] || {};
        Sound.play(SFX[tool.sfx] || SFX.whoosh, { volume: 0.6 });
        if (target.sprite) this.animateSprite(target.sprite, true);
        if (target.add) {
            const a = target.add;
            target.added = this.world.addSprite({ x: target.x - a.width / 2, y: target.y - a.height / 2, width: a.width, height: a.height, z: a.z, image: a.image, flipX: !!a.flipX });
            this.animateSprite(target.added);
        }
        if (step.kind === 'pick') {
            const item = step.items ? step.items.find(i => i.id === this.pick) : null;
            const image = item ? item.image : Art.tint(step.mask, String(this.pick));
            const w = target.width, h = target.height;
            const painted = this.world.addSprite({ x: target.x - w / 2, y: target.y - h / 2, width: w, height: h, z: step.z, image, flipX: !!target.flipX });
            this.animateSprite(painted);
        }
        this.spark(target.x, target.y);
        if (step.targets.every(t => t.hit)) this.finish(step);
    },

    rub(step, x, y) {
        if (!step.zone || !step.layer) return;
        // Сначала смотрим, попали ли вообще по зоне: мазок мимо — не ошибка.
        const r = step.zone;
        if (x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height) {
            if (this.drag) this.drag.last = null;
            return;
        }
        if (!this.tool) { UI.toast(Lang.t('pickTool')); return; }
        if (this.tool !== step.tool) { this.wrong('wrongTool'); return; }
        const radius = typeof CARE_BRUSH_RADIUS !== 'undefined' ? CARE_BRUSH_RADIUS : 58;
        const before = step.layer.progress;
        // Быстрый мазок пальцем даёт редкие события: докрашиваем отрезок от прошлой точки,
        // иначе на мобильном след получается пунктиром.
        const last = this.drag && this.drag.last;
        if (last) {
            const dx = x - last.x, dy = y - last.y;
            const steps = Math.min(24, Math.floor(Math.hypot(dx, dy) / (radius * 0.5)));
            for (let i = 1; i <= steps; i++) {
                step.layer.paint(last.x + dx * i / steps - r.x, last.y + dy * i / steps - r.y, radius);
            }
        }
        if (this.drag) this.drag.last = { x, y };
        step.layer.paint(x - r.x, y - r.y, radius);
        // Small, rate-limited trail only when the treatment actually advances.
        if (step.layer.progress > before && (!this.trailWait || this.trailWait <= 0)) {
            this.spark(x, y, true); this.trailWait = 0.1;
        }
        const need = (typeof CARE_COVER_PERCENT !== 'undefined' ? CARE_COVER_PERCENT : 80) / 100;
        if (step.layer.progress >= need) {
            step.layer.fill();
            this.spark(x, y);
            this.finish(step);
        }
    },

    traceDown(step, x, y) {
        const radius = typeof CARE_TRACE_RADIUS !== 'undefined' ? CARE_TRACE_RADIUS : 58;
        for (const p of step.paths) {
            if (p.done) continue;
            const s = p.points[0];
            if ((s.x - x) ** 2 + (s.y - y) ** 2 > radius * radius) continue;
            if (!this.tool) { UI.toast(Lang.t('pickTool')); return; }
            if (this.tool !== step.tool) { this.wrong('wrongTool'); return; }
            p.active = true; p.at = 1;
        }
    },

    traceMove(step, x, y) {
        if (this.tool !== step.tool) return;
        const radius = typeof CARE_TRACE_RADIUS !== 'undefined' ? CARE_TRACE_RADIUS : 58;
        for (const p of step.paths) {
            if (!p.active || p.done) continue;
            const next = p.points[p.at];
            if (!next) continue;
            if ((next.x - x) ** 2 + (next.y - y) ** 2 > radius * radius) continue;
            p.at++;
            if (p.at >= p.points.length) {
                p.done = true; p.active = false;
                const image = Art.tint(step.mask, step.color);
                const a = p.anchor;
                this.world.addSprite({ x: a.x - step.size[0] / 2, y: a.y - step.size[1] / 2, width: step.size[0], height: step.size[1], z: step.z, image, flipX: !!p.flip });
                this.spark(a.x, a.y);
                Sound.play(SFX.sparkle, { volume: 0.5 });
                if (step.paths.every(q => q.done)) this.finish(step);
            }
        }
    },

    finish(step) {
        if (step.done) return;
        this.drag = null;
        step.done = true;
        if (step.onDone) step.onDone();
        Sound.play(SFX.chime, { volume: 0.5 });
        UI.celebrate?.();
        this.at++;
        // Leave a brief game-time beat for the last successful action to be visible.
        if (this.at >= this.steps.length) { this.stageFinishWait = 0.38; return; }
        this.begin();
        if (this.onStepDone) this.onStepDone();
    },

    // --- Подсказка и эффекты ------------------------------------------------------
    get reducedMotion() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; },

    animateSprite(sprite, remove = false) {
        const previous = this.fx.findIndex(f => f.kind === 'settle' && f.sprite === sprite);
        if (previous >= 0) {
            const f = this.fx.splice(previous, 1)[0];
            Object.assign(sprite, { x: f.x, y: f.y, width: f.width, height: f.height, alpha: f.alpha });
        }
        if (this.reducedMotion || this.fx.length >= 64) {
            if (remove) this.world.removeSprite(sprite);
            return;
        }
        this.fx.push({ sprite, kind: 'settle', life: 0.26, remove,
            x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height, alpha: sprite.alpha ?? 1 });
    },
    // Показать, что делать дальше: подсветить цель и нужный инструмент.
    hint() {
        const step = this.step0;
        if (!step) return;
        let point = null, tool = step.tool;
        if (step.targets && step.targets.length) {
            const target = step.targets.find(t => !t.hit);
            if (target) { point = { x: target.x, y: target.y }; tool = target.tool; }
        } else if (step.paths) {
            const path = step.paths.find(p => !p.done);
            if (path) point = path.points[0];
        } else if (step.zone) {
            point = { x: step.zone.x + step.zone.width / 2, y: step.zone.y + step.zone.height / 2 };
        }
        if (point) this.pulse(point.x, point.y);
        if (tool) UI.flashTool(tool);
    },

    pulse(x, y) {
        if (this.fx.length >= 64) return;
        const sprite = this.world.addSprite({ x: x - 70, y: y - 70, width: 140, height: 140, z: 90, image: CARE_ART.sparkle, alpha: 0.9 });
        this.fx.push({ sprite, life: 1.8, kind: 'pulse', x, y });
    },

    spark(x, y, trail = false) {
        if (this.reducedMotion) return;
        const count = trail ? 1 : 8;
        for (let i = 0; i < count && this.fx.length < 64; i++) {
            const size = trail ? 16 : 18 + Math.random() * 18;
            const sprite = this.world.addSprite({ x: x - size / 2, y: y - size / 2, width: size, height: size, z: 92, image: CARE_ART.sparkle });
            const angle = i / count * Math.PI * 2;
            this.fx.push({ sprite, life: 0.7, kind: 'spark', vx: Math.cos(angle) * (trail ? 10 : 85), vy: Math.sin(angle) * 65 - 65 });
        }
    },

    // Иконка выбранного инструмента ходит за пальцем.
    setCursor(x, y, on) {
        if (!this.cursor) return;
        const tool = this.tool ? TOOLS[this.tool] : null;
        this.cursor.visible = !!(on && tool);
        if (!tool) return;
        this.cursor.image = tool.icon;
        this.cursor.x = x + 12; this.cursor.y = y + 12;
    },

    update(dt) {
        this.trailWait = Math.max(0, (this.trailWait || 0) - dt);
        const step = this.step0;
        if (step && step.kind === 'hold') {
            step.left -= dt;
            if (this.onText) this.onText(step.text);
            if (step.left <= 0) this.finish(step);
        }
        for (const s of this.steps) if (s.layer) s.layer.refresh();
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.life -= dt;
            if (f.kind === 'settle') {
                const t = Math.min(1, 1 - f.life / 0.26);
                const scale = f.remove ? 1 - t * 0.55 : 1 + Math.sin(t * Math.PI) * 0.12;
                f.sprite.width = f.width * scale; f.sprite.height = f.height * scale;
                f.sprite.x = f.x + (f.width - f.sprite.width) / 2;
                f.sprite.y = f.y + (f.height - f.sprite.height) / 2;
                f.sprite.alpha = f.alpha * (f.remove ? 1 - t : 0.7 + t * 0.3);
            } else if (f.kind === 'spark') {
                f.sprite.x += f.vx * dt; f.sprite.y += f.vy * dt; f.vy += 90 * dt;
                f.sprite.rotation = (f.sprite.rotation || 0) + dt * 0.8;
                f.sprite.alpha = Math.max(0, f.life / 0.7);
            } else {
                const k = 1 - f.life / 1.8;
                const size = 140 + (this.reducedMotion ? 0 : Math.sin(k * 9) * 26);
                f.sprite.width = size; f.sprite.height = size;
                f.sprite.x = f.x - size / 2; f.sprite.y = f.y - size / 2;
                f.sprite.alpha = Math.max(0, f.life / 1.8);
            }
            if (f.life <= 0) {
                if (f.kind !== 'settle' || f.remove) this.world.removeSprite(f.sprite);
                else Object.assign(f.sprite, { x: f.x, y: f.y, width: f.width, height: f.height, alpha: f.alpha });
                this.fx.splice(i, 1);
            }
        }
        if (this.stageFinishWait > 0) {
            this.stageFinishWait = Math.max(0, this.stageFinishWait - dt);
            if (this.stageFinishWait === 0 && this.onStageDone) this.onStageDone();
            return;
        }
        // Долго ничего не делают — сама подскажем, куда нажимать.
        this.idle += dt;
        const wait = typeof HINT_IDLE_SEC !== 'undefined' ? HINT_IDLE_SEC : 7;
        if (this.idle >= wait) { this.idle = 0; this.hint(); }
    },
};
