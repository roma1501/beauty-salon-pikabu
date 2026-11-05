// UI.js — интерфейс салона: верхняя полоса, подсказка шага, док с инструментами и
// палитрой, гардероб и всплывающие экраны (меню, уровни, результат, пауза, рекорды).
// Разметка и стили — в index.html; здесь только поведение. Все тексты идут через Lang.

/** @satisfies {Record<string, any>} */
const UI = {
    /** @type {Record<string, any>} */
    el: {},
    /** @type {((id: string) => void) | null} */ onTool: null,
    /** @type {((id: any) => void) | null} */ onPick: null,
    toolIds: [],
    _toastTimer: 0,
    /** @type {ResizeObserver | null} */ stepLayoutObserver: null,
    icons: {
        sound: 'assets/sprites/ui-musicon.png', muted: 'assets/sprites/ui-musicoff.png',
        pause: 'assets/sprites/ui-pause.png', play: 'assets/sprites/ui-next.png',
        back: 'assets/sprites/ui-arrowleft.png', done: 'assets/sprites/ui-checkmark.png',
        hint: 'assets/sprites/ui-question.png', levels: 'assets/sprites/ui-menugrid.png',
        records: 'assets/sprites/ui-trophy.png', stars: 'assets/art/ui/reward-star.webp',
        coins: 'assets/art/ui/reward-gem.webp', likes: 'assets/art/ui/like.webp',
    },
    icon(name) { return '<img class="ui-icon icon-' + name + '" src="' + this.icons[name] + '" alt="" aria-hidden="true">'; },
    stat(name, value) { return '<span class="stat" aria-label="' + Lang.t(name) + ': ' + value + '">' + this.icon(name) + '<b>' + value + '</b></span>'; },
    soundButton(button, label = false) {
        button.innerHTML = this.icon(Sound.muted ? 'muted' : 'sound') + (label ? '<span>' + Lang.t('sound') + '</span>' : '');
        button.setAttribute('aria-pressed', String(!Sound.muted));
    },

    init(handlers = {}) {
        const id = (name) => document.getElementById(name);
        this.el = {
            battle: id('battle'), topbar: id('topbar'), stepbar: id('stepbar'), dock: id('dock'),
            levelText: id('chip-level-text'), coins: id('coins-value'),
            back: id('btn-back'), hint: id('btn-hint'), sound: id('btn-sound'), pause: id('btn-pause'),
            done: id('btn-done'),
            stepText: id('step-text'), dots: id('step-dots'),
            tray: id('tray'), palette: id('palette'),
            wardrobe: id('wardrobe'), wardCats: id('ward-cats'), wardItems: id('ward-items'),
            overlay: id('overlay'), panel: id('panel'), toast: id('toast'),
        };
        // Reserve the actual height of wrapped instructions above the tool dock.
        this.stepLayoutObserver?.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
            this.stepLayoutObserver = new ResizeObserver(() => {
                const height = this.el.stepbar.getBoundingClientRect().height;
                if (height > 0) document.documentElement.style.setProperty('--step-space', Math.ceil(height + 22) + 'px');
            });
            this.stepLayoutObserver.observe(this.el.stepbar);
        }
        this.el.back.onclick = () => handlers.back && handlers.back();
        this.el.done.onclick = () => handlers.done && handlers.done();
        this.el.hint.onclick = () => handlers.hint && handlers.hint();
        this.el.pause.onclick = () => handlers.pause && handlers.pause();
        this.el.sound.onclick = () => {
            Sound.toggleMuted();
            this.soundButton(this.el.sound);
        };
        for (const name of ['back', 'hint', 'done', 'pause']) this.el[name].innerHTML = this.icon(name);
        this.soundButton(this.el.sound);
        document.querySelector('#chip-coins small').innerHTML = this.icon('coins');
        // На Playables громкостью управляет платформа — своей кнопки там быть не должно.
        if (Platform.name === 'playables') this.el.sound.hidden = true;
        else this.el.sound.setAttribute('aria-pressed', String(!Sound.muted));
        Pause.onChange(() => {
            document.body.classList.toggle('is-paused', Pause.active);
            document.body.classList.toggle('platform-paused', Pause.has('platform'));
            for (const animation of document.getAnimations()) {
                if (Pause.has('platform')) animation.pause();
                else if (animation.playState === 'paused') animation.play();
            }
            this.el.pause.setAttribute('aria-pressed', String(Pause.has('manual')));
            this.el.pause.innerHTML = this.icon(Pause.has('manual') ? 'play' : 'pause');
        });
        return this;
    },

    // Режим интерфейса: 'menu' — только монеты и звук, 'play' — процедура,
    // 'dress' — гардероб с кнопкой «Готово», 'show' — показ мод, 'result' — итог.
    chrome(mode) {
        document.body.dataset.mode = mode;
        this.el.battle.hidden = mode !== 'show';
        const game = mode !== 'menu';
        this.el.topbar.hidden = !game;
        this.el.stepbar.hidden = !(mode === 'play' || mode === 'dress' || mode === 'show');
        this.el.dock.hidden = !(mode === 'play' || mode === 'dress');
        this.el.back.hidden = !game;
        this.el.pause.hidden = !game;
        this.el.hint.hidden = mode !== 'play';
        this.el.done.hidden = mode !== 'dress';
        document.body.classList.toggle('nodock', this.el.dock.hidden);
    },

    // Кнопка «Готово»: выбор вещей необязателен, блокируем только переход.
    setDone(on) {
        this.el.done.disabled = !on;
        this.el.done.style.opacity = on ? '1' : '.45';
    },

    setLevel(text) { this.el.levelText.textContent = text; },
    animate(element, frames, duration = 350) {
        if (!element?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        for (const animation of element.getAnimations()) animation.cancel();
        element.animate(frames, { duration, easing: 'cubic-bezier(.2,.8,.3,1)' });
    },
    celebrate() {
        this.animate(document.querySelector('.care-status'), [
            { filter: 'brightness(1)', transform: 'scale(1)' },
            { filter: 'brightness(1.35)', transform: 'scale(1.035)', offset: .35 },
            { filter: 'brightness(1)', transform: 'scale(1)' },
        ], 500);
    },
    setCoins(n) {
        if (this.el.coins.textContent !== String(n)) this.animate(this.el.coins.parentElement, [
            { transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' },
        ]);
        this.el.coins.textContent = String(n);
    },
    setHintLabel(n) {
        this.el.hint.innerHTML = this.icon('hint') + '<b class="hint-count">' + (n > 0 ? n : '+') + '</b>';
        this.el.hint.title = Lang.t(n > 0 ? 'hintLeft' : 'hintAd', { n });
        this.el.hint.setAttribute('aria-label', this.el.hint.title);
    },
    setProgress(value) {
        const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
        const meter = document.getElementById('care-progress');
        if (meter.getAttribute('aria-valuenow') === String(pct)) return;
        meter.setAttribute('aria-valuenow', String(pct));
        meter.style.setProperty('--progress', pct + '%');
        document.getElementById('care-percent').textContent = pct + '%';
    },

    setStep(text, done, total) {
        if (document.body.dataset.mode !== 'show' && this.el.stepText.textContent !== (text || '')) this.animate(this.el.stepText, [
            { opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' },
        ]);
        this.el.stepText.textContent = text || '';
        if (total !== undefined && this.el.dots.childElementCount !== total) {
            this.el.dots.innerHTML = '';
            for (let i = 0; i < total; i++) this.el.dots.appendChild(document.createElement('i'));
        }
        [...this.el.dots.children].forEach((dot, i) => dot.classList.toggle('on', i < done));
    },

    // Инструменты шага: [{ id, icon, label }]. current — выбранный.
    setTray(tools, current) {
        this.el.tray.innerHTML = '';
        this.toolIds = tools.map(t => t.id);
        for (const tool of tools) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'tool'; button.dataset.tool = tool.id;
            button.setAttribute('aria-label', tool.label);
            const img = document.createElement('img');
            img.src = Art.src(tool.icon); img.alt = '';
            const span = document.createElement('span');
            span.textContent = tool.label;
            button.append(img, span);
            button.onclick = () => this.onTool && this.onTool(tool.id);
            this.el.tray.appendChild(button);
        }
        this.markTool(current);
        this.el.wardrobe.classList.remove('on');
        this.el.tray.hidden = false;
    },

    markTool(current) {
        for (const b of this.el.tray.children) {
            const selected = b.dataset.tool === current;
            b.classList.toggle('on', selected);
            b.setAttribute('aria-pressed', String(selected));
        }
        document.getElementById('selected-tool').textContent = current ? Lang.of('tool', current) : Lang.t('pickTool');
    },

    // Подсветить нужный инструмент (подсказка).
    flashTool(id) {
        for (const b of this.el.tray.children) {
            b.classList.toggle('hintme', b.dataset.tool === id);
            if (b.dataset.tool === id) b.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
        setTimeout(() => { for (const b of this.el.tray.children) b.classList.remove('hintme'); }, 2400);
    },

    // Палитра: [{ id, color }] или [{ id, image }]. Пустой список прячет полосу.
    setPalette(list, current) {
        this.el.palette.innerHTML = '';
        for (const item of list || []) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'swatch'; button.dataset.pick = String(item.id);
            button.setAttribute('aria-label', Lang.t('pickColor'));
            if (item.image) {
                const img = document.createElement('img'); img.src = Art.src(item.image); img.alt = '';
                button.appendChild(img); button.style.background = '#fff';
            } else button.style.background = item.color;
            button.onclick = () => this.onPick && this.onPick(item.id);
            this.el.palette.appendChild(button);
        }
        this.markPick(current);
    },

    markPick(current) {
        for (const b of this.el.palette.children) b.classList.toggle('on', b.dataset.pick === String(current));
    },

    // --- Гардероб --------------------------------------------------------------
    // cats: [{ id, label }]; items: [{ id, image, price, cost, costTitle, owned, chosen }].
    showWardrobe(cats, active, items, handlers) {
        this.el.tray.hidden = true;
        this.el.palette.innerHTML = '';
        this.el.wardrobe.classList.add('on');
        this.el.wardCats.innerHTML = '';
        for (const cat of cats) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'cat' + (cat.id === active ? ' on' : '');
            b.textContent = cat.label;
            b.onclick = () => handlers.cat(cat.id);
            this.el.wardCats.appendChild(b);
        }
        this.el.wardItems.innerHTML = '';
        for (const item of items) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'ward-item' + (item.chosen ? ' on' : '') + (item.owned ? '' : ' locked');
            const img = document.createElement('img'); img.src = Art.src(item.image); img.alt = '';
            b.appendChild(img);
            if (!item.owned) {
                const price = document.createElement('span');
                price.className = 'price'; price.innerHTML = item.cost || this.icon('coins') + item.price;
                if (item.costTitle) { price.title = item.costTitle; price.setAttribute('aria-label', item.costTitle); }
                b.appendChild(price);
            }
            b.onclick = () => handlers.item(item.id);
            this.el.wardItems.appendChild(b);
        }
    },

    hideWardrobe() { this.el.wardrobe.classList.remove('on'); this.el.tray.hidden = false; },

    startBattle(name, theme) {
        this.el.battle.setAttribute('aria-label', Lang.t('battleTitle'));
        this.el.battle.innerHTML = '<div class="battle-heading"><small>' + Lang.t('battleTheme', { theme }) + '</small><h2>' + Lang.t('battleTitle') + '</h2><p id="battle-message" role="status" aria-live="polite"></p></div>' +
            '<div class="battle-scores"><div class="battle-player" id="battle-me"><span class="battle-crown">' + this.icon('records') + '</span><span>' + name + ' · ' + Lang.t('you') + '</span><strong>' + this.icon('likes') + '<b id="battle-my-likes">0</b></strong><small class="battle-leader">' + Lang.t('battleLeader') + '</small></div>' +
            '<div class="battle-vs">VS</div><div class="battle-player rival" id="battle-rival"><span class="battle-crown">' + this.icon('records') + '</span><span>' + Lang.t('rival') + '</span><strong>' + this.icon('likes') + '<b id="battle-rival-likes">0</b></strong><small class="battle-leader">' + Lang.t('battleLeader') + '</small></div>' +
            '<div class="battle-meter" role="img" id="battle-meter"><i></i></div><p class="battle-caption" id="battle-caption"></p></div>';
        this.el.battleMyLikes = document.getElementById('battle-my-likes');
        this.el.battleRivalLikes = document.getElementById('battle-rival-likes');
        this.el.battleMe = document.getElementById('battle-me');
        this.el.battleRival = document.getElementById('battle-rival');
        this.el.battleMessage = document.getElementById('battle-message');
        this.el.battleMeter = document.getElementById('battle-meter');
        this.el.battleCaption = document.getElementById('battle-caption');
        this.el.battle.dataset.phase = 'intro';
    },

    updateBattle(run, phase) {
        const total = run.likes + run.rivalLikes;
        const share = total ? run.likes / total * 100 : 50;
        this.el.battle.style.setProperty('--battle-share', share + '%');
        this.el.battle.dataset.phase = phase;
        const won = run.likes >= run.rivalLikes;
        this.el.battleMe.classList.toggle('leading', total > 0 && won);
        this.el.battleRival.classList.toggle('leading', total > 0 && !won);
        const label = Lang.t(phase === 'reveal' ? (won ? 'battleWin' : 'battleLose') : phase === 'intro' ? 'battleIntro' : 'battleVoting');
        if (this.el.battleMessage.textContent !== label) this.el.battleMessage.textContent = label;
        this.el.battleCaption.textContent = Lang.t(phase === 'reveal' ? 'battleFinal' : 'likes');
        this.el.battleMeter.setAttribute('aria-label', Lang.t('you') + ': ' + Math.round(share) + '%');
        for (const [element, value] of [[this.el.battleMyLikes, run.likes], [this.el.battleRivalLikes, run.rivalLikes]]) {
            const milestone = String(Math.floor(value / 1000));
            if (element.dataset.milestone !== milestone && value > 0) this.animate(element, [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 250);
            element.dataset.milestone = milestone;
            element.textContent = value.toLocaleString(Lang.code === 'ru' ? 'ru-RU' : 'en-US');
        }
    },

    // --- Экраны ----------------------------------------------------------------
    /** @returns {HTMLElement} панель, чтобы навесить обработчики на кнопки */
    panel(html, dim) {
        this.el.panel.innerHTML = html;
        this.el.panel.classList.toggle('salon-menu', !!this.el.panel.querySelector('h1'));
        this.el.overlay.classList.toggle('dim', !!dim);
        this.el.overlay.classList.add('on');
        this.animate(this.el.panel, [{ opacity: 0, transform: 'translateY(16px) scale(.96)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }], 380);
        return this.el.panel;
    },

    closePanel() { this.el.overlay.classList.remove('on'); this.el.panel.innerHTML = ''; },
    get panelOpen() { return this.el.overlay.classList.contains('on'); },

    toast(text) {
        this.el.toast.textContent = text;
        this.el.toast.classList.add('on');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.el.toast.classList.remove('on'), 1500);
    },

    // Полоска звёзд для экрана результата.
    starsHtml(count) {
        let out = '<div class="stars">';
        for (let i = 0; i < 3; i++) out += '<i class="' + (i < count ? 'on' : '') + '">' + this.icon('stars') + '</i>';
        return out + '</div>';
    },
};
