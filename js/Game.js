// Game.js — ход игры «Салон красоты»: меню, выбор уровня, очередь процедур,
// гардероб, показ мод, результат, прогресс, реклама и рекорды.
//
// Движок зовёт три хука: init(app) — один раз, ready() — перед снятием загрузки,
// update(dt) — каждый кадр вне паузы. Процедуры ведёт js/Stages.js, интерфейс — js/UI.js.

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {World2D | null} */ world: null,
    mode: 'menu',
    busy: false,
    /** @type {any} */ save: { level: 1, stars: {}, coins: 0, owned: [], likes: 0, adUnlocks: {} },
    /** @type {any} */ run: null,
    saveFailed: false,
    /** @type {any[]} */ board: null,
    hearts: [],
    shopBusy: false,
    shopTab: 'all',
    /** @type {Promise<any>} */ saveQueue: Promise.resolve(),
    /** @type {ResizeObserver | null} */ layoutObserver: null,
    /** @type {Promise<any>} */ chain: Promise.resolve(),

    // --- Запуск ------------------------------------------------------------------
    async init(app) {
        this.app = app;
        this.world = app.world2d;
        try {
            const loaded = await Platform.load();
            if (loaded && typeof loaded === 'object') Object.assign(this.save, loaded);
        } catch (e) {
            // Облачные платформы: ошибка чтения — не «новая игра», иначе сохранение затрётся.
            if (Platform.name === 'playables' || Platform.name === 'playgama') throw e;
            console.warn('Прогресс не прочитался:', (e && e.message) || e);
        }
        // Palette and dock changes resize the canvas without a window resize event.
        this.layoutObserver?.disconnect();
        this.layoutObserver = new ResizeObserver(() => this.world.resize());
        this.layoutObserver.observe(document.getElementById('world3d'));
        Art.init(app.world2d);
        UI.init({
            back: () => this.onBack(),
            hint: () => this.onHint(),
            pause: () => this.onPause(),
            done: () => this.onDressDone(),
        });
        UI.onTool = (id) => { Stages.setTool(id); UI.markTool(id); Sound.play(SFX.click, { volume: 0.4 }); };
        UI.onPick = (id) => { Stages.setPick(id); UI.markPick(id); Sound.play(SFX.select, { volume: 0.5 }); };
        Stages.onStageDone = () => this.stageDone();
        Stages.onStepDone = () => this.syncStep();
        Stages.onText = (key) => this.syncStep(key);
        this.bindPointer();
        this.save.stars = this.save.stars || {};
        this.save.owned = Array.isArray(this.save.owned) ? this.save.owned : [];
        this.save.adUnlocks = this.save.adUnlocks && typeof this.save.adUnlocks === 'object' ? this.save.adUnlocks : {};
        // Картинки меню и первой сцены — под экраном загрузки.
        await Art.ensure(['assets/art/bg/menu.webp', 'assets/art/ui/logo.webp', CARE_ART.sparkle, CARE_ART.like]);
        if (this.seamless()) await this.preloadAll(app);
    },

    // --- Сцены без экрана загрузки (Playgama) ---------------------------------------
    // Модерация Playgama: никаких экранов загрузки посреди уровня — всё грузится заранее.
    // В этой сборке вся графика и звуки грузятся под экраном запуска, а сцены (процедуры,
    // гардероб, показ) меняются без него. Яндекс и Playables — как раньше: сцена под экраном.
    seamless() { return typeof GAME_PLATFORM !== 'undefined' && String(GAME_PLATFORM) === 'playgama'; },

    // Все картинки игры: фоны сцен, модели всех тонов кожи, инструменты, эффекты, маски
    // макияжа и гардероб — из тех же данных, по которым их грузят процедуры.
    allArt() {
        const list = ['assets/art/bg/menu.webp', 'assets/art/ui/logo.webp'];
        for (const map of GAME_MAPS_2D) for (const sprite of map.sprites || []) list.push(sprite.image);
        for (const level of LEVELS) {
            const tone = Levels.client(level).tone;
            for (const plan of Stages.plan(level)) list.push(...Stages.assets(plan, tone));
        }
        for (const tones of Object.values(MODEL_ART)) list.push(...Object.values(tones));
        for (const item of WARDROBE) list.push(item.image);
        list.push(...Object.values(UI.icons));   // иконки кнопок и наград — <img> интерфейса
        return [...new Set(list.filter(Boolean))];
    },

    async preloadAll(app) {
        const art = this.allArt();
        let done = 0;
        await Promise.all([
            ...art.map(path => Art.ensure([path]).then(() => app.loading.set(80 + 14 * (++done) / art.length))),
            Sound.preload(Object.values(SFX)),
        ]);
    },

    // Прошлая сцена растворяется поверх новой вместо экрана загрузки. Возвращает функцию:
    // позвать, когда новая сцена готова. Первая сцена уровня — сразу, без снимка.
    crossfade() {
        const none = () => {};
        if (!this.seamless() || !this.run || this.run.stage === 0) return none;
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('world3d'));
        if (!canvas || !canvas.width || !canvas.height) return none;
        const shot = document.createElement('canvas');
        shot.width = canvas.width; shot.height = canvas.height;
        const ctx = shot.getContext('2d');
        if (!ctx) return none;
        ctx.drawImage(canvas, 0, 0);
        const r = canvas.getBoundingClientRect();
        shot.className = 'scene-fade';
        Object.assign(shot.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        document.body.appendChild(shot);
        return () => {
            if (Stages.reducedMotion || !shot.animate) { shot.remove(); return; }
            const fade = shot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
            fade.finished.then(() => shot.remove(), () => shot.remove());
            // В скрытой вкладке анимация стоит: снимок не должен копиться поверх игры.
            setTimeout(() => shot.remove(), 1500);
        };
    },

    async ready() {
        this.showMenu();
        Sound.music(SFX.music, { volume: 0.5 });
    },

    update(dt) {
        Platform.perfFrame(this.mode === 'play' || this.mode === 'dress' || this.mode === 'show');
        if (this.mode === 'play') {
            Stages.update(dt);
            const step = Stages.step0;
              let value = Stages.stageFinishWait > 0 ? 1 : 0;
            if (step) {
                if (step.layer) value = step.layer.progress / (CARE_COVER_PERCENT / 100);
                else if (step.kind === 'hold') value = 1 - step.left / step.total;
                else if (step.paths) value = step.paths.filter(p => p.done).length / step.paths.length;
                else if (step.targets.length) value = step.targets.filter(t => t.hit).length / step.targets.length;
            }
            UI.setProgress(value);
        }
        if (this.mode === 'show') this.showUpdate(dt);
    },

    // --- Ввод по сцене -------------------------------------------------------------
    bindPointer() {
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('world3d'));
        const at = (e) => {
            const r = canvas.getBoundingClientRect();
            return this.world.screenToWorld(e.clientX - r.left, e.clientY - r.top);
        };
        const live = () => this.mode === 'play' && !Pause.active && !UI.panelOpen;
        let activePointer = null;
        const release = () => { activePointer = null; Stages.up(); Stages.setCursor(-999, -999, false); };
        canvas.addEventListener('pointerdown', (e) => {
            if (!live() || activePointer !== null || e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
            activePointer = e.pointerId;
            const p = at(e);
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
            Stages.down(p.x, p.y);
            Stages.setCursor(p.x, p.y, true);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!live()) return;
            if (activePointer !== e.pointerId) return;
            const p = at(e);
            Stages.move(p.x, p.y);
            Stages.setCursor(p.x, p.y, e.buttons > 0 || e.pointerType !== 'mouse');
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            canvas.addEventListener(type, e => { if (activePointer === /** @type {PointerEvent} */ (e).pointerId) release(); });
        }
        window.addEventListener('lory-release-input', release);
    },

    // --- Экраны --------------------------------------------------------------------
    showMenu() {
        this.mode = 'menu';
        this.run = null;
        Platform.gameplay(false);
        UI.chrome('menu');
        UI.setCoins(this.save.coins);
        const level = Math.min(this.save.level, Levels.count());
        const panel = UI.panel(
            '<img class="salon-emblem" src="assets/art/ui/logo.webp" alt="">' +
            '<h1>' + Lang.t('title') + '</h1><p class="tagline">' + Lang.t('tagline') + '</p>' +
            '<button class="btn" id="m-play">' + UI.icon('play') + '<span>' + Lang.t('play') + '<small>' + Lang.t('level', { n: level }) + '</small></span></button>' +
            '<div class="menu-actions"><button class="btn ghost" id="m-levels">' + UI.icon('levels') + Lang.t('levels') + '</button>' +
            '<button class="btn ghost" id="m-records">' + UI.icon('records') + Lang.t('records') + '</button>' +
            '<button class="btn shop-entry" id="m-shop">' + UI.icon('coins') + '<span>' + Lang.t('shop') + '<small>' + Lang.t('shopSplit') + '</small></span></button></div>' +
            (Platform.name === 'playables' ? '' : '<button class="btn ghost" id="m-sound">' + UI.icon('sound') + Lang.t('sound') + '</button>') +
            '<div class="menu-stats">' + UI.stat('stars', this.totalStars()) + UI.stat('coins', this.save.coins) + '</div>');
        panel.querySelector('#m-play').addEventListener('click', () => this.startLevel(level));
        panel.querySelector('#m-levels').addEventListener('click', () => this.showLevels());
        panel.querySelector('#m-records').addEventListener('click', () => this.showRecords());
        panel.querySelector('#m-shop').addEventListener('click', () => this.showShop());
        const sound = panel.querySelector('#m-sound');
        if (sound) UI.soundButton(sound, true);
        if (sound) sound.addEventListener('click', () => {
            Sound.toggleMuted();
            UI.soundButton(sound, true);
            UI.soundButton(UI.el.sound);
        });
    },

    showLevels() {
        let html = '<h2>' + Lang.t('levels') + '</h2><div class="grid">';
        for (let n = 1; n <= Levels.count(); n++) {
            const open = n <= this.save.level;
            const stars = this.save.stars[n] || 0;
            html += '<button class="node' + (open ? '' : ' locked') + '" data-n="' + n + '">' + n +
                '<b>' + UI.icon('stars').repeat(stars) + '</b></button>';
        }
        html += '</div><button class="btn ghost" id="l-back">' + Lang.t('back') + '</button>';
        const panel = UI.panel(html);
        for (const node of panel.querySelectorAll('.node')) {
            node.addEventListener('click', () => {
                const n = Number(node.getAttribute('data-n'));
                if (n > this.save.level) { UI.toast(Lang.t('levelLocked')); return; }
                this.startLevel(n);
            });
        }
        panel.querySelector('#l-back').addEventListener('click', () => this.showMenu());
    },

    async showRecords() {
        let html = '<h2>' + Lang.t('records') + '</h2>';
        if (this.board === null) this.board = await Platform.leaderboard();
        if (!this.board) html += '<p>' + Lang.t('recordsOff') + '</p>';
        else if (!this.board.length) html += '<p>' + Lang.t('noRecords') + '</p>';
        else {
            html += '<div class="board">';
            for (const row of this.board) {
                html += '<div class="' + (row.me ? 'me' : '') + '"><span>' + row.rank + '. ' +
                    (row.name || Lang.t('you')) + '</span><b>' + row.score + '</b></div>';
            }
            html += '</div>';
        }
        html += '<button class="btn ghost" id="r-back">' + Lang.t('back') + '</button>';
        UI.panel(html).querySelector('#r-back').addEventListener('click', () => this.showMenu());
    },

    onPause() {
        if (this.mode === 'menu') return;
        Pause.set('manual', true);
        const panel = UI.panel('<h2>' + Lang.t('paused') + '</h2>' +
            '<button class="btn" id="p-resume">' + Lang.t('resume') + '</button>' +
            '<button class="btn ghost" id="p-menu">' + Lang.t('toMenu') + '</button>', true);
        panel.querySelector('#p-resume').addEventListener('click', () => { Pause.set('manual', false); UI.closePanel(); });
        panel.querySelector('#p-menu').addEventListener('click', () => {
            Pause.set('manual', false); UI.closePanel(); this.showMenu();
        });
    },

    // Кнопка «назад» посреди процедуры не выбрасывает в меню молча: спрашиваем через паузу.
    onBack() {
        if (this.mode === 'menu') return;
        if (this.mode === 'result') { this.showMenu(); return; }
        this.onPause();
    },

    // --- Уровень ---------------------------------------------------------------------
    async startLevel(n) {
        if (this.busy) return;
        const level = Levels.get(n);
        this.run = {
            n, level,
            client: Levels.client(level),
            plan: Stages.plan(level),
            stage: 0,
            hints: typeof HINT_FREE !== 'undefined' ? HINT_FREE : 3,
            look: {},
            /** @type {Record<string, any>} */ lookSprites: {},
            cat: 'hair',
            likes: 0, rivalLikes: 0, doubled: false, counted: false,
        };
        Platform.event('level_started', { level: String(n) });
        Stages.seed(n * 97 + 13);
        Stages.mistakes = 0;
        UI.closePanel();
        UI.chrome('play');
        UI.setCoins(this.save.coins);
        UI.setHintLabel(this.run.hints);
        UI.setLevel(Lang.t('level', { n }) + ' · ' + Lang.of('client', this.run.client.id));
        await this.queueStage();
    },

    // Переходы между процедурами выстраиваются в очередь: два loadMap одновременно
    // движок не пускает, а пропущенный этап оставил бы игрока на прежней сцене.
    queueStage() {
        this.chain = this.chain.then(() => this.nextStage()).catch((e) => {
            console.warn('Этап не загрузился:', (e && e.message) || e);
        });
        return this.chain;
    },

    async nextStage() {
        if (!this.run) return;
        const plan = this.run.plan[this.run.stage];
        if (!plan) { this.finishLevel(); return; }
        if (plan.type === 'dressup') { await this.startDressup(); return; }
        if (plan.type === 'runway') { await this.startRunway(); return; }
        this.busy = true;
        const tone = this.run.client.tone;
        const reveal = this.crossfade();
        try {
            await this.app.loadMap(plan.scene, {
                prepare: async () => {
                    await Art.ensure(Stages.assets(plan, tone));
                    Stages.build(plan, { app: this.app, level: this.run.level, tone });
                    this.mode = 'play';
                    UI.chrome('play');
                    UI.setTray(this.trayItems(Stages.tools()), null);
                    this.syncStep();
                },
                gameplay: true,
                cover: !this.seamless(),
            });
        } finally { this.busy = false; reveal(); }
    },

    trayItems(ids) {
        return ids.filter(id => TOOLS[id]).map(id => ({
            id, icon: TOOLS[id].icon, label: Lang.of('tool', id),
        }));
    },

    // Текст текущего шага и точки прогресса процедуры.
    syncStep(key) {
        if (!this.run) return;
        const step = Stages.step0;
        const text = key || (step && step.text) || '';
        const theme = Lang.of('theme', this.run.level.theme);
        UI.setStep(Lang.t(text, { theme }), this.run.stage, this.run.plan.length);
        UI.setPalette(Stages.palette(), Stages.pick);
        UI.markTool(Stages.tool);
    },

    stageDone() {
        if (!this.run) return;
        Sound.play(SFX.confirm, { volume: 0.6 });
        this.procedureDone();
        this.run.stage++;
        this.queueStage();
    },

    // Воронка внутри уровня для аналитики: какая процедура (тип — из короткой записи
    // уровня, набор постоянный) пройдена и какой по счёту.
    procedureDone() {
        const plan = this.run.plan[this.run.stage];
        if (plan) Platform.event('procedure_completed', { procedure: plan.type, step_index: this.run.stage + 1, level: this.run.n });
    },

    onHint() {
        if (this.mode === 'play') {
            this.rewardHint();
            return;
        }
        if (this.mode === 'dress') UI.toast(Lang.t('stepDressup', { theme: Lang.of('theme', this.run.level.theme) }));
    },

    // Награду и условие показываем ДО ролика: игрок сам решает, смотреть ли.
    rewardHint() {
        if (UI.panelOpen) return;
        const run = this.run;
        Stages.up();
        Pause.set('hint-dialog', true);
        const close = () => { UI.closePanel(); Pause.set('hint-dialog', false); };
        const panel = UI.panel('<div class="reward-hero">' + UI.icon('hint') + '</div><h2>' + Lang.t('hint') + '</h2><p>' + Lang.t('hintOffer') + '</p>' +
            (run.hints > 0 ? '<button class="btn" id="h-use">' + Lang.t('hintUse', { n: run.hints }) + '</button>' : '') +
            '<button class="btn ad" id="h-ad">' + Lang.t('watchAd') + '</button>' +
            '<button class="btn ghost" id="h-no">' + Lang.t('close') + '</button>', true);
        panel.querySelector('#h-no').addEventListener('click', close);
        const use = /** @type {HTMLButtonElement | null} */ (panel.querySelector('#h-use'));
        if (use) use.addEventListener('click', () => {
            if (this.run !== run || run.hints <= 0) return;
            run.hints--; UI.setHintLabel(run.hints); close(); Stages.hint();
        });
        panel.querySelector('#h-ad').addEventListener('click', async () => {
            const button = /** @type {HTMLButtonElement} */ (panel.querySelector('#h-ad'));
            if (button.disabled) return;
            button.disabled = true;
            button.textContent = Lang.t('adStarting');
            if (use) use.disabled = true;
            const cancel = /** @type {HTMLButtonElement} */ (panel.querySelector('#h-no'));
            cancel.disabled = true;
            try {
                const rewarded = await Platform.rewarded('hint');
                if (rewarded && this.run === run) {
                    run.hints += 3; UI.setHintLabel(run.hints); UI.toast(Lang.t('hintReceived'));
                } else UI.toast(Lang.t('adNoReward'));
            } catch { UI.toast(Lang.t('adNoReward')); } finally { close(); }
        });
    },

    // --- Гардероб ---------------------------------------------------------------------
    async startDressup() {
        this.busy = true;
        const tone = this.run.client.tone;
        const reveal = this.crossfade();
        try {
            await this.app.loadMap('dressup', {
                prepare: async () => {
                    await Art.ensure([MODEL_ART.dressup[tone], ...WARDROBE.map(i => i.image)]);
                    Stages.frameScene(this.world);
                    const m = this.world.marker('model'), r = Stages.rect(m);
                    this.run.body = r;
                    this.world.addSprite({ x: r.x, y: r.y, width: r.width, height: r.height, z: 0, image: MODEL_ART.dressup[tone], color: '#f3cdb8' });
                    this.run.lookSprites = {};
                    this.mode = 'dress';
                    UI.chrome('dress');
                    this.renderWardrobe();
                    this.syncLook();
                    UI.setStep(Lang.t('stepDressup', { theme: Lang.of('theme', this.run.level.theme) }), this.run.stage, this.run.plan.length);
                },
                gameplay: true,
                cover: !this.seamless(),
            });
        } finally { this.busy = false; reveal(); }
    },

    owned(item) { return item.price === 0 || this.save.owned.includes(item.id); },

    renderWardrobe() {
        const cats = [...DRESS_SLOTS, ...DRESS_EXTRA].map(id => ({ id, label: Lang.of('cat', id) }));
        const items = WARDROBE.filter(i => i.cat === this.run.cat).map(i => ({
            id: i.id, image: i.image, price: i.price,
            cost: SHOP_OFFERS[i.id] ? this.shopPrice(i, true) : '',
            costTitle: SHOP_OFFERS[i.id]?.videos ? Lang.t('shopVideoProgress', { done: this.shopProgress(i), total: SHOP_OFFERS[i.id].videos }) : '',
            owned: this.owned(i), chosen: this.run.look[i.cat] === i.id,
        }));
        UI.showWardrobe(cats, this.run.cat, items, {
            cat: (id) => { this.run.cat = id; this.renderWardrobe(); Sound.play(SFX.click, { volume: 0.4 }); },
            item: (id) => this.pickWear(id),
        });
    },

    pickWear(id) {
        const item = WARDROBE.find(i => i.id === id);
        if (!item) return;
        if (!this.owned(item)) { this.offerItem(item); return; }
        this.run.look[item.cat] = this.run.look[item.cat] === id ? null : id;
        Sound.play(SFX.select, { volume: 0.6 });
        this.renderWardrobe();
        this.syncLook();
    },

    // Shop and wardrobe share the same offer and persistent ownership.
    shopProgress(item) {
        const count = Number(this.save.adUnlocks?.[item.id]) || 0;
        return Math.min(SHOP_OFFERS[item.id]?.videos || 0, Math.max(0, Math.floor(count)));
    },

    itemTitle(item) { return Lang.t('shopItem', { cat: Lang.of('cat', item.cat), n: Number(item.id.split('_')[1]) }); },

    // compact — карточка гардероба: «▶ 0/2» рядом с «💎 130»; полная подпись не влезает
    // в узкую карточку при читаемом размере шрифта и остаётся в бутике и в title.
    shopPrice(item, compact = false) {
        if (this.owned(item)) return UI.icon('done') + Lang.t('shopHave');
        const offer = SHOP_OFFERS[item.id];
        const progress = { done: this.shopProgress(item), total: offer.videos };
        return offer.videos ? UI.icon('play') + Lang.t(compact ? 'shopVideoShort' : 'shopVideoProgress', progress)
            : UI.icon('coins') + offer.diamonds;
    },

    shopPreview(item) {
        const tone = this.mode === 'dress' ? this.run.client.tone : 't1';
        return '<div class="shop-preview" aria-label="' + Lang.t('shopTry') + '"><img src="' + MODEL_ART.dressup[tone] + '" alt="">' +
            '<img src="' + item.image + '" alt="' + this.itemTitle(item) + '"></div>';
    },

    showShop(tab) {
        if (this.shopBusy) return;
        tab = tab || this.shopTab;
        this.shopTab = tab;
        const all = WARDROBE.filter(i => SHOP_OFFERS[i.id]);
        const items = all.filter(i => tab === 'owned' ? this.owned(i) : tab === 'diamonds' ? !!SHOP_OFFERS[i.id].diamonds : tab === 'videos' ? !!SHOP_OFFERS[i.id].videos : true);
        let html = '<section class="boutique"><div class="shop-header"><div><h2>' + Lang.t('shop') + '</h2><p>' + Lang.t('shopIntro') + '</p></div>' + UI.stat('coins', this.save.coins) + '</div>' +
            '<p class="shop-split">' + Lang.t('shopSplit') + '</p><div class="shop-tabs">';
        for (const [id,key] of [['all','shopAll'],['diamonds','shopDiamonds'],['videos','shopVideos'],['owned','shopOwned']]) {
            html += '<button class="cat' + (tab === id ? ' on' : '') + '" data-shop-tab="' + id + '" aria-pressed="' + (tab === id) + '">' + Lang.t(key) + '</button>';
        }
        html += '</div><div class="shop-grid">';
        for (const item of items) html += '<button class="shop-card' + (this.owned(item) ? ' owned' : '') + '" data-shop-item="' + item.id + '">' +
            this.shopPreview(item) + '<b>' + this.itemTitle(item) + '</b><small>' + Lang.of('theme', item.tags[0]) + '</small><span class="shop-cost">' + this.shopPrice(item) + '</span></button>';
        html += '</div>' + (!items.length ? '<p>' + Lang.t('shopEmpty') + '</p>' : '') + '<button class="btn ghost" id="shop-back">' + Lang.t('toMenu') + '</button></section>';
        const panel = UI.panel(html);
        for (const button of panel.querySelectorAll('[data-shop-tab]')) button.addEventListener('click', () => this.showShop(button.getAttribute('data-shop-tab')));
        for (const button of panel.querySelectorAll('[data-shop-item]')) button.addEventListener('click', () => this.offerItem(WARDROBE.find(i => i.id === button.getAttribute('data-shop-item'))));
        panel.querySelector('#shop-back').addEventListener('click', () => this.showMenu());
    },

    async buyShopItem(id) {
        const item = WARDROBE.find(i => i.id === id), offer = SHOP_OFFERS[id];
        if (this.shopBusy || !item || !offer?.diamonds || this.owned(item)) return false;
        if (this.save.coins < offer.diamonds) { UI.toast(Lang.t('notEnough')); return false; }
        this.shopBusy = true;
        try {
            this.save.coins -= offer.diamonds;
            this.save.owned.push(id);
            await this.store();
            Sound.play(SFX.coin, { volume: 0.7 });
            UI.toast(Lang.t(this.saveFailed ? 'saveFailed' : 'unlocked'));
            return true;
        } finally { this.shopBusy = false; }
    },

    async watchShopItem(id) {
        const item = WARDROBE.find(i => i.id === id), offer = SHOP_OFFERS[id];
        if (this.shopBusy || !item || !offer?.videos || this.owned(item)) return false;
        this.shopBusy = true;
        try {
            if (!(await Platform.rewarded('shop-' + id))) { UI.toast(Lang.t('shopNoReward')); return false; }
            const count = Math.min(offer.videos, this.shopProgress(item) + 1);
            if (!this.save.adUnlocks) this.save.adUnlocks = {};
            this.save.adUnlocks[id] = count;
            if (count === offer.videos && !this.owned(item)) this.save.owned.push(id);
            await this.store();
            Sound.play(count === offer.videos ? SFX.coin : SFX.confirm, { volume: 0.7 });
            UI.toast(Lang.t(this.saveFailed ? 'saveFailed' : count === offer.videos ? 'unlocked' : 'shopProgressSaved', { done: count, total: offer.videos }));
            return this.owned(item);
        } catch { UI.toast(Lang.t('shopNoReward')); return false; }
        finally { this.shopBusy = false; }
    },

    offerItem(item) {
        if (!item || !SHOP_OFFERS[item.id] || this.shopBusy) return;
        const inDress = this.mode === 'dress', run = this.run;
        if (inDress) Pause.set('shop-dialog', true);
        const close = () => {
            Pause.set('shop-dialog', false);
            if (inDress) UI.closePanel(); else this.showShop();
        };
        const offer = SHOP_OFFERS[item.id], owned = this.owned(item);
        let html = '<section class="shop-detail">' + this.shopPreview(item) + '<div><h2>' + this.itemTitle(item) + '</h2>' +
            '<p>' + Lang.of('theme', item.tags[0]) + '</p><p>' + Lang.t('shopUse') + '</p>';
        if (owned) html += '<p class="shop-cost">' + this.shopPrice(item) + '</p>';
        else if (offer.videos) {
            html += '<p>' + Lang.t('shopVideoInfo', { n: offer.videos }) + '</p><div class="shop-stamps" aria-label="' + Lang.t('shopVideoProgress', { done: this.shopProgress(item), total: offer.videos }) + '">';
            for (let i=0; i<offer.videos; i++) html += '<span class="' + (i<this.shopProgress(item) ? 'on' : '') + '">' + UI.icon(i<this.shopProgress(item) ? 'done' : 'play') + '</span>';
            html += '</div><button class="btn ad" id="shop-action">' + Lang.t('shopWatch', { done: this.shopProgress(item), total: offer.videos }) + '</button>';
        } else html += '<p>' + UI.stat('coins', this.save.coins) + '</p><button class="btn" id="shop-action"' + (this.save.coins < offer.diamonds ? ' disabled' : '') + '>' + UI.icon('coins') + Lang.t('shopBuy', { n: offer.diamonds }) + '</button>' +
            (this.save.coins < offer.diamonds ? '<p>' + Lang.t('notEnough') + '</p>' : '');
        html += '<button class="btn ghost" id="shop-close">' + Lang.t('back') + '</button></div></section>';
        const panel = UI.panel(html, inDress);
        panel.querySelector('#shop-close').addEventListener('click', close);
        const action = panel.querySelector('#shop-action');
        if (action) action.addEventListener('click', async () => {
            if (this.shopBusy) return;
            for (const button of panel.querySelectorAll('button')) button.disabled = true;
            if (offer.videos) action.textContent = Lang.t('adStarting');
            const unlocked = offer.videos ? await this.watchShopItem(item.id) : await this.buyShopItem(item.id);
            if (inDress && this.run === run && unlocked) { close(); this.pickWear(item.id); }
            else this.offerItem(item);
        });
    },

    // Показать выбранные вещи на модели.
    syncLook() {
        const z = { bottom: 8, shoes: 6, dress: 12, top: 14, bag: 16, hair: 20, acc: 22 };
        for (const [slot, sprite] of Object.entries(this.run.lookSprites)) {
            if (sprite) this.world.removeSprite(sprite);
            this.run.lookSprites[slot] = null;
        }
        const r = this.run.body;
        for (const slot of [...DRESS_SLOTS, ...DRESS_EXTRA]) {
            const id = this.run.look[slot];
            const item = id ? WARDROBE.find(i => i.id === id) : null;
            if (!item) continue;
            this.run.lookSprites[slot] = this.world.addSprite({
                x: r.x, y: r.y, width: r.width, height: r.height, z: z[slot] || 10, image: item.image,
            });
        }
        UI.setDone(true);
        UI.setStep(Lang.t('dressOptional'), this.run.stage, this.run.plan.length);
    },

    onDressDone() {
        if (this.mode !== 'dress' || this.busy || UI.panelOpen) return;
        this.mode = 'transition';
        UI.setDone(false);
        UI.hideWardrobe();
        Sound.play(SFX.confirm, { volume: 0.7 });
        this.procedureDone();
        this.run.stage++;
        this.queueStage();
    },

    // Сколько вещей образа попало в тему уровня.
    lookScore() {
        const theme = this.run.level.theme;
        let picked = 0, matched = 0;
        for (const slot of [...DRESS_SLOTS, ...DRESS_EXTRA]) {
            const id = this.run.look[slot];
            if (!id) continue;
            picked++;
            const item = WARDROBE.find(i => i.id === id);
            if (item && item.tags.includes(theme)) matched++;
        }
        return { picked, matched, ratio: picked ? matched / picked : 0 };
    },

    // --- Показ мод ---------------------------------------------------------------------
    async startRunway() {
        this.busy = true;
        const tone = this.run.client.tone;
        const reveal = this.crossfade();
        try {
            await this.app.loadMap('runway', {
                prepare: async () => {
                    await Art.ensure([MODEL_ART.runway[tone], ...WARDROBE.map(i => i.image), CARE_ART.like, CARE_ART.sparkle]);
                    Stages.frameScene(this.world);
                    const me = Stages.rect(this.world.marker('model'));
                    const rival = Stages.rect(this.world.marker('rival'));
                    const actorStart = this.world.sprites.length;
                    this.world.addSprite({ x: me.x, y: me.y, width: me.width, height: me.height, z: 0, image: MODEL_ART.runway[tone], color: '#f3cdb8' });
                    for (const slot of [...DRESS_SLOTS, ...DRESS_EXTRA]) {
                        const id = this.run.look[slot];
                        const item = id ? WARDROBE.find(i => i.id === id) : null;
                        if (item) this.world.addSprite({ x: me.x, y: me.y, width: me.width, height: me.height, z: 10, image: item.image });
                    }
                    this.world.addSprite({ x: rival.x, y: rival.y, width: rival.width, height: rival.height, z: 0, image: MODEL_ART.runway.t2, color: '#e2ab80' });
                    const rivalLook = Stages.shuffled(WARDROBE.filter(i => i.cat === 'dress'))[0];
                    if (rivalLook) this.world.addSprite({ x: rival.x, y: rival.y, width: rival.width, height: rival.height, z: 10, image: rivalLook.image });
                    this.run.battleActors = this.world.sprites.slice(actorStart).map(sprite => ({ sprite, x: sprite.x, y: sprite.y }));
                    for (const actor of this.run.battleActors) actor.sprite.alpha = Stages.reducedMotion ? 1 : 0;
                    const score = this.lookScore();
                    this.run.targetLikes = Math.round(2400 + score.matched * 2600 + (3 - Math.min(3, Stages.mistakes)) * 900);
                    this.run.rivalTarget = Math.round(2600 + Stages.rnd() * 5200);
                    this.run.likes = 0; this.run.rivalLikes = 0; this.run.showTime = 0;
                    this.hearts = [];
                    this.run.reactionWait = 0; this.run.revealed = false;
                    this.mode = 'show';
                    UI.chrome('show');
                    UI.startBattle(Lang.of('client', this.run.client.id), Lang.of('theme', this.run.level.theme));
                    UI.updateBattle(this.run, 'intro');
                    Sound.play(SFX.applause, { volume: 0.5 });
                },
                gameplay: true,
                cover: !this.seamless(),
            });
        } finally { this.busy = false; reveal(); }
    },

    showUpdate(dt) {
        const run = this.run;
        if (!run) return;
        run.showTime += dt;
        const t = run.showTime;
        const player = Math.max(0, Math.min(1, (t - 0.8) / 4.2));
        const rival = Math.max(0, Math.min(1, (t - 1.0) / 4.0));
        run.likes = Math.round(run.targetLikes * (1 - (1 - player) ** 3));
        run.rivalLikes = Math.round(run.rivalTarget * (rival * rival * (3 - 2 * rival)));
        const phase = t < 0.8 ? 'intro' : t < 5 ? 'vote' : 'reveal';
        UI.updateBattle(run, phase);
        for (const actor of run.battleActors || []) {
            const enter = Math.min(1, t / 0.7);
            actor.sprite.alpha = Stages.reducedMotion ? 1 : enter;
            actor.sprite.y = actor.y + (Stages.reducedMotion ? 0 : (1 - enter) ** 2 * 45 + Math.sin(t * 1.6) * 2);
        }
        run.reactionWait -= dt;
        if (phase === 'vote' && run.reactionWait <= 0) {
            run.reactionWait = 0.12;
            this.heart('model'); this.heart('rival');
        }
        if (phase === 'reveal' && !run.revealed) {
            run.revealed = true;
            Sound.play(SFX.applause, { volume: 0.65 });
            const winner = run.likes >= run.rivalLikes ? 'model' : 'rival';
            for (let i = 0; i < 22; i++) this.heart(winner, true);
        }
        for (let i = this.hearts.length - 1; i >= 0; i--) {
            const h = this.hearts[i];
            h.life -= dt;
            h.sprite.y += h.vy * dt; h.sprite.x += h.vx * dt;
            h.vy += h.gravity * dt;
            h.sprite.rotation = (h.sprite.rotation || 0) + h.spin * dt;
            h.sprite.alpha = Math.max(0, Math.min(1, h.life / 0.45));
            if (h.life <= 0) { this.world.removeSprite(h.sprite); this.hearts.splice(i, 1); }
        }
        if (t >= 7.2 && !run.counted) {
            for (const h of this.hearts) this.world.removeSprite(h.sprite);
            this.hearts = [];
            this.finishLevel();
        }
    },

    heart(side = 'model', burst = false) {
        if (Stages.reducedMotion || this.hearts.length >= 64) return;
        const m = this.world.marker(side);
        if (!m) return;
        const size = burst ? 20 + Math.random() * 14 : 22 + Math.random() * 16;
        const sprite = this.world.addSprite({
            x: m.x + m.width / 2 + (Math.random() - 0.5) * m.width * 0.8,
            y: burst ? m.y + 170 : m.y + m.height - 60,
            width: size, height: size, z: 60,
            image: burst ? CARE_ART.sparkle : CARE_ART.like,
        });
        this.hearts.push({ sprite, life: burst ? 1.8 : 1.2, vx: (Math.random() - 0.5) * (burst ? 260 : 40),
            vy: burst ? -60 - Math.random() * 160 : -110, gravity: burst ? 160 : -20, spin: burst ? (Math.random() - 0.5) * 3 : 0 });
    },

    // --- Результат ---------------------------------------------------------------------
    stars() {
        const gold = typeof STARS_MISTAKES_GOLD !== 'undefined' ? STARS_MISTAKES_GOLD : 1;
        const silver = typeof STARS_MISTAKES_SILVER !== 'undefined' ? STARS_MISTAKES_SILVER : 5;
        const care = Stages.mistakes <= gold ? 3 : Stages.mistakes <= silver ? 2 : 1;
        const score = this.lookScore();
        const look = score.ratio >= 0.75 ? 3 : score.ratio >= 0.4 ? 2 : 1;
        return Math.max(1, Math.min(3, Math.round((care + look) / 2)));
    },

    finishLevel() {
        const run = this.run;
        if (!run || run.counted) return;
        run.counted = true;
        this.mode = 'result';
        const stars = this.stars();
        const coinsBase = (typeof LEVEL_COINS !== 'undefined' ? LEVEL_COINS : 45) +
            stars * (typeof STAR_COINS !== 'undefined' ? STAR_COINS : 20);
        run.stars = stars;
        run.coins = coinsBase;
        run.likes = run.likes || stars * (typeof LIKES_PER_STAR !== 'undefined' ? LIKES_PER_STAR : 1500);
        this.save.coins += coinsBase;
        this.save.likes = (this.save.likes || 0) + run.likes;
        if ((this.save.stars[run.n] || 0) < stars) this.save.stars[run.n] = stars;
        if (this.save.level < Math.min(run.n + 1, Levels.count())) this.save.level = Math.min(run.n + 1, Levels.count());
        Platform.ads.roundEnded();      // раунд завершён — считается один раз
        Platform.event('level_completed', { level: String(run.n) });
        Platform.event('level_result', { level: run.n, stars, won: run.likes >= run.rivalLikes, mistakes: Math.min(Stages.mistakes, 20) });
        Platform.submitScore(this.totalStars());
        this.store();
        Sound.play(SFX.complete, { volume: 0.7 });
        UI.chrome('result');
        this.resultPanel();
    },

    resultPanel() {
        const run = this.run;
        const won = run.likes >= run.rivalLikes;
        const last = run.n >= Levels.count();
        let html = '<h2>' + Lang.t('levelDone') + '</h2>' + UI.starsHtml(run.stars) +
            '<p>' + Lang.t(won ? 'showWin' : 'showLose') + '</p><div class="menu-stats">' + UI.stat('likes', run.likes) + UI.stat('coins', run.coins) + '</div>';
        if (last) html += '<p>' + Lang.t('campaignDone') + '</p>';
        if (!run.doubled) html += '<button class="btn ad" id="r-x2">' + Lang.t('adDouble') + '</button>';
        html += '<button class="btn" id="r-next">' + Lang.t(last ? 'toMenu' : 'next') + '</button>' +
            '<div class="row"><button class="btn ghost" id="r-retry">' + Lang.t('retry') + '</button>' +
            '<button class="btn ghost" id="r-menu">' + Lang.t('toMenu') + '</button></div>';
        if (this.saveFailed) html += '<p>' + Lang.t('saveFailed') + '</p>';
        const panel = UI.panel(html, true);
        const x2 = panel.querySelector('#r-x2');
        if (x2) x2.addEventListener('click', async () => {
            if (!(await Platform.rewarded('coins-x2'))) return;
            run.doubled = true;
            this.save.coins += run.coins;
            run.coins *= 2;
            UI.setCoins(this.save.coins);
            UI.toast(Lang.t('adGot'));
            Sound.play(SFX.coin, { volume: 0.8 });
            this.store();
            this.resultPanel();
        });
        // Переход по кнопке: после двух завершённых раундов сначала реклама.
        panel.querySelector('#r-next').addEventListener('click', () => Platform.ads.next(() => {
            UI.closePanel();
            if (run.n >= Levels.count()) this.showMenu(); else this.startLevel(run.n + 1);
        }));
        panel.querySelector('#r-retry').addEventListener('click', () => Platform.ads.next(() => {
            UI.closePanel(); this.startLevel(run.n);
        }));
        panel.querySelector('#r-menu').addEventListener('click', () => Platform.ads.next(() => {
            UI.closePanel(); this.showMenu();
        }));
    },

    totalStars() {
        return Object.values(this.save.stars || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    },

    async store() {
        UI.setCoins(this.save.coins);
        const snapshot = JSON.parse(JSON.stringify({
            level: this.save.level, stars: this.save.stars, coins: this.save.coins,
            owned: this.save.owned, likes: this.save.likes, adUnlocks: this.save.adUnlocks || {},
        }));
        this.saveQueue = this.saveQueue.then(() => Platform.save(snapshot)).catch(() => false);
        const ok = await this.saveQueue;
        this.saveFailed = !ok;
    },
};
