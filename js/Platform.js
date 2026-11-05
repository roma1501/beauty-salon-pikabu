// Platform.js — платформа игры: Яндекс Игры (YaGames), YouTube Playables (ytgame),
// Playgama Bridge (bridge) или локальный запуск. Игра зовёт только Platform — SDK знает этот файл.
// SDK подключает сборка: build.bat yandex вписывает в index.html скрипт /sdk.js,
// build.bat playables — SDK Playables первым скриптом, build.bat playgama — Bridge с CDN
// Playgama и playgama-bridge-config.json рядом с index.html. Без SDK (run.bat, web-сборка)
// работает локальный адаптер: сохранения — в Store, реклама — ничего (с ?mockads в
// адресе — заглушка-оверлей на секунду: проверить паузу, звук и выдачу награды).
//
//   await Platform.init()        SDK, язык платформы, события паузы (main.js)
//   Platform.firstFrame()        экран загрузки на экране (Playables firstFrameReady; main.js)
//   Platform.ready()             игра готова к вводу: Яндекс LoadingAPI.ready, Playables gameReady,
//                                Playgama sendMessage('game_ready') (main.js)
//   Platform.gameplay(on)        идёт ли игровой процесс (Яндекс GameplayAPI start/stop);
//                                на паузе (Pause.js) движок сам шлёт stop, после — start
//   Platform.ads.roundEnded()    раунд завершён (победа или поражение) — ОДИН раз на раунд
//   Platform.ads.next(go)        переход по кнопке «Далее/Заново/Меню»: после двух
//                                результатов сначала interstitial, потом go(); защита от двойного клика
//   await Platform.rewarded(id)  true — ТОЛЬКО если SDK подтвердил просмотр
//   Platform.submitScore(n)      рекорд: Яндекс — лидерборд 'Score' (не чаще раза в секунду), Playables — sendScore
//   await Platform.leaderboard() [{ rank, name, score, me }] или null (Яндекс)
//   await Platform.load()        сохранение игры (объект) или null
//   await Platform.save(obj)     записать сохранение (Яндекс — облако игрока + Store, Playables — saveData,
//                                Playgama — bridge.storage)
//   Platform.event(name, data)   событие прохождения для аналитики Playgama (level_started…); иначе ничего
//   Platform.perfFrame(active)   кадр игры для performance_sample Playgama (Game.update)
// На время рекламы игра и звук стоят (Pause 'ad'), после — прежнее состояние.

/** @satisfies {Record<string, any>} */
const Platform = {
    name: 'local',        // 'yandex' | 'playables' | 'playgama' | 'local'
    sdk: null,            // объект SDK Яндекса (ysdk) или Playgama Bridge
    lang: null,           // язык платформы (BCP-47) или null
    player: null,         // игрок Яндекса
    LEADERBOARD: 'Score', // технический id лидерборда Яндекса (в интерфейсе — «Рекорды»)
    BOARD: 'score',       // id лидерборда в playgama-bridge-config.json
    SAVE_KEY: 'save',     // ключ сохранения в bridge.storage
    MUTE_KEY: 'muted',    // кнопка звука игрока в bridge.storage ('1' / '0')
    /** @type {any} */ _adWait: null,  // Playgama: реклама, которая сейчас ждёт состояний Bridge
    /** @type {any} */ _perf: null,    // Playgama: окно performance_sample
    _readySent: false,
    _firstFrameSent: false,
    _playing: false,
    _gameplaySent: false, // последнее, что ушло в GameplayAPI: stop без start не шлётся
    _adBusy: false,
    _loaded: null,        // Promise первого load() — Playables: saveData только после loadData
    _scoreAt: 0,
    _scoreTimer: 0,
    _scorePending: null,

    async init() {
        try {
            if (typeof YaGames !== 'undefined') await this._initYandex();
            else if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) await this._initPlayables();
            else if (typeof bridge !== 'undefined') await this._initPlaygama();
        } catch (e) {
            // В Playables нельзя незаметно перейти на локальные сохранения или
            // потерять обязательные SDK-события. Загрузка покажет ошибку/повтор.
            if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) throw e;
            console.warn('Platform: SDK не поднялся, играем локально — ' + ((e && e.message) || e));
            this.name = 'local';
            this.sdk = null;
        }
        Pause.onChange(() => {
            this._syncGameplay();
            if (this._perf) this._perf.last = 0;   // перерыв — не «зависший кадр»
        });
        console.log('Platform: ' + this.name + (this.lang ? ', язык платформы ' + this.lang : ''));
        return this;
    },

    async _initYandex() {
        let timer = 0;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('YaGames.init timeout')), 8000); });
        try { this.sdk = await Promise.race([YaGames.init(), timeout]); } finally { clearTimeout(timer); }
        this.name = 'yandex';
        try { this.lang = this.sdk.environment.i18n.lang || null; } catch (e) { /* язык по умолчанию */ }
        if (typeof this.sdk.on === 'function') {
            this.sdk.on('game_api_pause', () => Pause.set('platform', true));
            this.sdk.on('game_api_resume', () => Pause.set('platform', false));
        }
        try { this.player = await this.sdk.getPlayer({ scopes: false }); } catch (e) { this.player = null; }
    },

    async _initPlayables() {
        this.name = 'playables';
        const sys = ytgame.system;
        sys.onPause(() => Pause.set('platform', true));
        sys.onResume(() => Pause.set('platform', false));
        sys.onAudioEnabledChange((on) => Sound.setPlatformMuted(!on));
        Sound.setPlatformMuted(!sys.isAudioEnabled());
        try { this.lang = await sys.getLanguage(); } catch (e) { this.lang = null; }
    },

    // Playgama Bridge 2: сначала initialize(), потом всё остальное. Язык, звук и пауза —
    // от площадки, на которой Playgama показывает игру.
    async _initPlaygama() {
        let timer = 0;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('bridge.initialize timeout')), 15000); });
        try { await Promise.race([bridge.initialize(), timeout]); } finally { clearTimeout(timer); }
        this.name = 'playgama';
        this.sdk = bridge;
        const platform = bridge.platform, ad = bridge.advertisement, E = bridge.EVENT_NAME;
        try { this.lang = platform.language || null; } catch (e) { this.lang = null; }
        // Начальное состояние звука — вручную: событие приходит только на смену.
        Sound.setPlatformMuted(platform.isAudioEnabled === false);
        platform.on(E.AUDIO_STATE_CHANGED, (on) => Sound.setPlatformMuted(!on));
        platform.on(E.PAUSE_STATE_CHANGED, (paused) => Pause.set('platform', !!paused));
        // Один слушатель на вид рекламы: состояния получает текущий запрос (_adWait).
        // Реклама, открытая не нами (на старте, autoShow площадки), тоже ставит игру на паузу.
        const route = (kind) => (state) => {
            if (state === 'opened') Pause.set('host-ad', true);
            else if (state === 'closed' || state === 'failed') Pause.set('host-ad', false);
            if (this._adWait && this._adWait.kind === kind) this._adWait.state(state);
        };
        ad.on(E.INTERSTITIAL_STATE_CHANGED, route('interstitial'));
        ad.on(E.REWARDED_STATE_CHANGED, route('rewarded'));
        if (ad.interstitialState === 'opened' || ad.rewardedState === 'opened') Pause.set('host-ad', true);
        // Кнопка звука — тоже через bridge.storage, не localStorage.
        Sound.persist = (muted) => {
            try { Promise.resolve(bridge.storage.set([this.MUTE_KEY], [muted ? '1' : '0'])).catch(() => {}); } catch (e) { /* не запомнится */ }
        };
        this._perf = this._perfWindow(performance.now());
        window.addEventListener('error', () => { if (this._perf) this._perf.errors++; });
        window.addEventListener('unhandledrejection', () => { if (this._perf) this._perf.rejections++; });
    },

    // Показ рекламы Bridge. Итог — по событиям состояния: rewarded засчитывается ТОЛЬКО
    // после 'rewarded', закрытие без него — false. Bridge может молча пропустить запрос
    // (слишком рано после прошлой рекламы) или зависнуть в loading — тогда false по таймеру,
    // а не вечное ожидание перехода. Открытую рекламу по времени не ограничиваем.
    _bridgeAd(kind, placement) {
        const ad = bridge.advertisement;
        if (!(kind === 'rewarded' ? ad.isRewardedSupported : ad.isInterstitialSupported)) return Promise.resolve(false);
        return new Promise((resolve) => {
            let rewarded = false, timer = 0;
            const done = (value) => {
                clearTimeout(timer);
                if (this._adWait === wait) this._adWait = null;
                resolve(value);
            };
            const arm = (ms) => { clearTimeout(timer); timer = setTimeout(() => done(false), ms); };
            const wait = {
                kind,
                state: (s) => {
                    if (s === 'loading') arm(10000);
                    else if (s === 'opened') clearTimeout(timer);
                    else if (s === 'rewarded') rewarded = true;
                    else if (s === 'closed') done(kind === 'rewarded' ? rewarded : true);
                    else if (s === 'failed') done(false);
                },
            };
            this._adWait = wait;
            arm(4000);
            try {
                const r = kind === 'rewarded' ? ad.showRewarded(placement) : ad.showInterstitial(placement);
                if (r && typeof r.catch === 'function') r.catch(() => done(false));
            } catch (e) { done(false); }
        });
    },

    // --- Жизненный цикл -------------------------------------------------------

    firstFrame() {
        if (!this._firstFrameSent && typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
            ytgame.game.firstFrameReady();
            this._firstFrameSent = true;
        }
    },

    ready() {
        if (this._readySent) return;
        try {
            if (this.name === 'yandex') this.sdk.features.LoadingAPI && this.sdk.features.LoadingAPI.ready();
            else if (this.name === 'playables') {
                this.firstFrame();
                ytgame.game.gameReady();
            } else if (this.name === 'playgama') bridge.platform.sendMessage('game_ready');
            this._readySent = true;
        } catch (e) {
            if (this.name === 'playables') throw e;
            console.warn('Platform.ready:', e);
        }
    },

    // on — игрок в игровом процессе (раунд идёт). Меню, экран результата, пауза — false.
    gameplay(on) {
        this._playing = !!on;
        this._syncGameplay();
    },

    // Событие прохождения для аналитики Playgama. level_* — сообщения платформы (Bridge
    // сам пишет их в аналитику и передаёт площадкам), прочее — analytics.send. Имя события
    // постоянное, меняющееся (уровень, процедура) — в data. На других платформах — ничего.
    event(name, data) {
        if (this.name !== 'playgama') return;
        try {
            if (/^level_(started|completed|failed|paused|resumed)$/.test(name)) bridge.platform.sendMessage(name, data);
            else if (bridge.analytics && typeof bridge.analytics.send === 'function') bridge.analytics.send(name, data);
        } catch (e) { /* аналитика не мешает игре */ }
    },

    _perfWindow(now) { return { start: now, last: 0, active: 0, times: [], errors: 0, rejections: 0 }; },

    // performance_sample (Playgama): время кадров активной игры, один агрегат на ~30 с игры.
    // Game.update зовёт каждый кадр вне паузы; active = false (меню, итог) рвёт цепочку кадров.
    perfFrame(active) {
        if (this.name !== 'playgama' || !this._perf) return;
        const now = performance.now(), p = this._perf;
        if (!active) { p.last = 0; return; }
        if (p.last) { const ms = now - p.last; p.times.push(ms); p.active += ms; }
        p.last = now;
        if (p.active < 30000 || !p.times.length) return;
        const t = p.times.slice().sort((a, b) => a - b);
        const q = (k) => t[Math.min(t.length - 1, Math.floor(k * t.length))];
        const over = (ms) => t.filter(x => x > ms).length;
        const r = (x) => Math.round(x * 10) / 10;
        this.event('performance_sample', {
            target_fps: 60, window_ms: Math.round(now - p.start), active_ms: Math.round(p.active),
            frame_count: t.length, fps_avg: r(t.length * 1000 / p.active), fps_p10: r(1000 / q(0.9)),
            frame_time_p50_ms: r(q(0.5)), frame_time_p95_ms: r(q(0.95)), frame_time_p99_ms: r(q(0.99)),
            frame_time_max_ms: r(t[t.length - 1]),
            frames_over_50ms: over(50), frames_over_100ms: over(100), frames_over_250ms: over(250),
            frames_over_500ms: over(500), frames_over_1000ms: over(1000),
            js_error_count: p.errors, unhandled_rejection_count: p.rejections,
            game_version: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '',
        });
        this._perf = this._perfWindow(now);
        this._perf.last = now;
    },

    _syncGameplay() {
        const want = this._playing && !Pause.active;
        if (this._gameplaySent === want || this.name !== 'yandex') { this._gameplaySent = want; return; }
        this._gameplaySent = want;
        try {
            const api = this.sdk.features.GameplayAPI;
            if (api) { if (want) api.start(); else api.stop(); }
        } catch (e) { /* SDK без GameplayAPI */ }
    },

    // --- Реклама ----------------------------------------------------------------

    // Interstitial. true — запрос успешен (Playables НЕ подтверждает факт показа).
    // Яндекс возвращает shown. Ошибка/нет API — false, переход всё равно продолжается.
    async interstitial() {
        if (this._adBusy) return false;
        this._adBusy = true;
        Pause.set('ad', true);
        try {
            if (this.name === 'yandex') {
                return await new Promise((resolve) => this.sdk.adv.showFullscreenAdv({ callbacks: {
                    onClose: (shown) => resolve(!!shown),
                    onError: () => resolve(false),
                    onOffline: () => resolve(false),
                } }));
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestInterstitialAd) return false;
                await ytgame.ads.requestInterstitialAd();
                return true;
            }
            if (this.name === 'playgama') return await this._bridgeAd('interstitial', 'level_completed');
            return await this._mockAd(false);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Rewarded. id — стабильный id награды без данных игрока ('continue', 'coins-x2').
    // true — ТОЛЬКО по подтверждению SDK; закрытие и ошибка — false. Награду выдаёт
    // игра по true и один раз.
    async rewarded(id) {
        if (this._adBusy) return false;
        this._adBusy = true;
        Pause.set('ad', true);
        try {
            if (this.name === 'yandex') {
                return await new Promise((resolve) => {
                    let got = false;
                    this.sdk.adv.showRewardedVideo({ callbacks: {
                        onRewarded: () => { got = true; },
                        onClose: () => resolve(got),
                        onError: () => resolve(false),
                    } });
                });
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestRewardedAd) return false;
                return (await ytgame.ads.requestRewardedAd(String(id || 'reward'))) === true;
            }
            // Плейсменты Bridge — постоянный набор из конфига: shop-<вещь> -> shop_item.
            if (this.name === 'playgama') return await this._bridgeAd('rewarded', /^shop-/.test(String(id)) ? 'shop_item' : String(id || 'reward').replace(/-/g, '_'));
            return await this._mockAd(true);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Локальная заглушка рекламы: только с ?mockads в адресе — оверлей на секунду,
    // rewarded засчитывается. Без флага — рекламы нет (false).
    _mockAd(reward) {
        if (!/[?&#]mockads\b/.test(location.search + location.hash)) return Promise.resolve(false);
        return new Promise((resolve) => {
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.85);color:#fff;font:bold 22px system-ui,sans-serif;text-align:center';
            el.textContent = (reward ? 'REWARDED' : 'INTERSTITIAL') + ' — local mock';
            document.body.appendChild(el);
            setTimeout(() => { el.remove(); resolve(true); }, 1000);
        });
    },

    // Счётчик interstitial по правилу игры: реклама — после каждых ДВУХ завершённых
    // раундов (любой исход), и только по кнопке перехода, не в момент результата.
    ads: {
        results: 0,
        busy: false,

        // Раунд завершён (победа или поражение) — звать ОДИН раз на раунд.
        roundEnded() { this.results++; },

        // Переход по кнопке: после двух результатов — сначала реклама, затем go().
        // Повторный клик, пока идёт переход, игнорируется. Реклама не пришла или
        // ошибка — переход без задержки, новый цикл из двух результатов.
        async next(go) {
            if (this.busy) return;
            this.busy = true;
            try {
                if (this.results >= 2) {
                    this.results = 0;
                    await Platform.interstitial();
                }
                if (go) await go();
            } finally {
                this.busy = false;
            }
        },
    },

    // --- Рекорды -------------------------------------------------------------------

    // Рекорд игрока. Яндекс: лидерборд 'Score', не чаще раза в секунду (лишнее — последним
    // значением через секунду). Playables: sendScore.
    submitScore(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        const v = Math.max(0, Math.floor(number));
        if (!Number.isSafeInteger(v)) return;
        if (this.name === 'playables') {
            try { ytgame.engagement.sendScore({ value: v }).catch(() => {}); } catch (e) { /* SDK старый */ }
            return;
        }
        if (this.name === 'playgama') {
            const lb = bridge.leaderboards, type = lb && lb.type;
            if (!type || type === 'not_available') return;   // у самой Playgama лидербордов нет
            try { Promise.resolve(lb.setScore(this.BOARD, v)).catch(() => {}); } catch (e) { /* нет лидерборда */ }
            return;
        }
        if (this.name !== 'yandex') return;
        this._scorePending = v;
        const wait = this._scoreAt + 1100 - Date.now();
        if (wait > 0) {
            if (!this._scoreTimer) this._scoreTimer = setTimeout(() => { this._scoreTimer = 0; this.submitScore(this._scorePending); }, wait);
            return;
        }
        this._scoreAt = Date.now();
        this._scorePending = null;
        const lb = this.sdk.leaderboards;
        const p = lb && lb.setScore ? lb.setScore(this.LEADERBOARD, v)
            : this.sdk.getLeaderboards().then((old) => old.setLeaderboardScore(this.LEADERBOARD, v));
        Promise.resolve(p).catch((e) => console.warn('Platform.submitScore:', (e && e.message) || e));
    },

    // Таблица рекордов (Яндекс): [{ rank, name, score, me }] или null — нет SDK,
    // нет лидерборда или ошибка. Лимит Яндекса — 20 запросов за 5 минут: кэшировать в игре.
    async leaderboard(opts) {
        if (this.name === 'playgama') return this._bridgeBoard();
        if (this.name !== 'yandex') return null;
        const o = Object.assign({ quantityTop: 10, includeUser: true, quantityAround: 3 }, opts || {});
        try {
            const lb = this.sdk.leaderboards;
            const res = lb && lb.getEntries ? await lb.getEntries(this.LEADERBOARD, o)
                : await (await this.sdk.getLeaderboards()).getLeaderboardEntries(this.LEADERBOARD, o);
            let myId = '';
            try { myId = this.player ? this.player.getUniqueID() : ''; } catch (e) { /* аноним */ }
            return (res.entries || []).map((e) => ({
                rank: e.rank, score: e.score,
                name: (e.player && e.player.publicName) || '',
                me: !!(myId && e.player && e.player.uniqueID === myId),
            }));
        } catch (e) {
            return null;
        }
    },

    // Таблица Bridge — только когда площадка отдаёт записи (type in_game), иначе null.
    async _bridgeBoard() {
        const lb = bridge.leaderboards;
        if (!lb || lb.type !== 'in_game') return null;
        try {
            const entries = await lb.getEntries(this.BOARD);
            let myId = '';
            try { myId = (bridge.player && bridge.player.id) || ''; } catch (e) { /* аноним */ }
            return (entries || []).map((e) => ({ rank: e.rank, score: e.score, name: e.name || '', me: !!(myId && e.id === myId) }));
        } catch (e) {
            return null;
        }
    },

    // --- Сохранения ------------------------------------------------------------------

    _storeKey() { return (typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game') + '.save'; },

    // Сохранение игры: объект или null.
    load() {
        if (!this._loaded) this._loaded = this._load().catch((error) => {
            this._loaded = null; // ошибка сети/данных не означает пустое сохранение; возможен повтор
            throw error;
        });
        return this._loaded;
    },

    async _load() {
        if (this.name === 'playables') {
            // Только SDK. Успешный loadData обязателен ДО saveData; ошибку нельзя
            // превращать в null и затем перезаписывать облако новой игрой.
            const raw = await ytgame.game.loadData();
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') throw new Error('Invalid Playables save data');
            return data;
        }
        if (this.name === 'playgama') {
            // Только bridge.storage (он сам выбирает облако или локальное хранилище).
            // Ошибка — не «пустое сохранение»: save() не запишет поверх, пока чтение не удалось.
            // Все ключи — одним запросом: прогресс и кнопка звука.
            const values = await bridge.storage.get([this.SAVE_KEY, this.MUTE_KEY]);
            const raw = Array.isArray(values) ? values[0] : values;
            const muted = Array.isArray(values) ? values[1] : null;
            // Bridge отдаёт значения уже разобранными: '1' приходит числом 1.
            if (muted !== null && muted !== undefined && muted !== '') Sound.setMuted(String(muted) === '1' || muted === true, false);
            if (raw === null || raw === undefined || raw === '') return null;
            const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!data || typeof data !== 'object') throw new Error('Invalid Playgama save data');
            return data;
        }
        const local = Store.getJSON(this._storeKey(), null);
        try {
            if (this.name === 'yandex' && this.player) {
                const data = await this.player.getData(['save']);
                if (data && data.save && typeof data.save === 'object') return data.save;
            }
        } catch (e) {
            console.warn('Platform.load:', (e && e.message) || e);
        }
        return local;
    },

    // Записать JSON. Playables: только SDK, после УСПЕШНОГО load; без localStorage.
    // До начала новой игры нужно await Platform.load() и применить загруженный
    // прогресс; rejected load следует показать как ошибку с повтором.
    async save(obj) {
        try {
            const data = JSON.stringify(obj);
            if (typeof data !== 'string') return false;
            if (this.name === 'playables') {
                // Консервативная проверка обоих представлений: < 3 MiB (MUST).
                // JSON.stringify экранирует непарные суррогаты: строка well-formed UTF-16.
                const bytes = Math.max(data.length * 2, new TextEncoder().encode(data).byteLength);
                if (bytes >= 3 * 1024 * 1024) throw new Error('Playables save must be smaller than 3 MiB');
                await this.load();
                await ytgame.game.saveData(data);
            } else if (this.name === 'playgama') {
                await this.load();
                await bridge.storage.set([this.SAVE_KEY], [data]);
            } else {
                const stored = Store.set(this._storeKey(), data);
                if (this.name === 'yandex' && this.player) await this.player.setData({ save: obj }, true);
                else if (!stored) return false;
            }
            return true;
        } catch (e) {
            console.warn('Platform.save:', (e && e.message) || e);
            return false;
        }
    },
};
