// Items.js — каталоги салона: инструменты, палитры цветов, гардероб и клиентки.
// Пути к картинкам — строковыми литералами: их собирает сканер ассетов сборки
// (tools/asset-scan.mjs). Названия предметов — ключи Lang (js/Lang.js).

// --- Инструменты. kind подсказывает игроку, как им пользоваться:
//     'tap' — коснуться точки, 'rub' — провести по зоне, 'trace' — вести по линии,
//     'place' — перетащить на место, 'pick' — сначала выбрать цвет.
/** @satisfies {Record<string, any>} */
const TOOLS = {
    tweezers: { icon: 'assets/art/tool/tweezers.webp', kind: 'tap', sfx: 'pop' },
    needle: { icon: 'assets/art/tool/needle.webp', kind: 'tap', sfx: 'pop' },
    cotton: { icon: 'assets/art/tool/cotton.webp', kind: 'tap', sfx: 'whoosh' },
    cleanser: { icon: 'assets/art/tool/cleanser.webp', kind: 'rub', sfx: 'water' },
    steamer: { icon: 'assets/art/tool/steamer.webp', kind: 'rub', sfx: 'whoosh' },
    spatula: { icon: 'assets/art/tool/spatula.webp', kind: 'tap', sfx: 'pop' },
    cream: { icon: 'assets/art/tool/cream.webp', kind: 'rub', sfx: 'whoosh' },
    maskSheet: { icon: 'assets/art/tool/mask_sheet.webp', kind: 'place', sfx: 'confirm' },
    patch: { icon: 'assets/art/tool/patch.webp', kind: 'place', sfx: 'confirm' },
    cucumber: { icon: 'assets/art/tool/cucumber.webp', kind: 'place', sfx: 'confirm' },
    sponge: { icon: 'assets/art/tool/sponge.webp', kind: 'rub', sfx: 'whoosh' },
    towel: { icon: 'assets/art/tool/towel.webp', kind: 'rub', sfx: 'whoosh' },

    comb: { icon: 'assets/art/tool/comb.webp', kind: 'rub', sfx: 'whoosh' },
    scissors: { icon: 'assets/art/tool/scissors.webp', kind: 'tap', sfx: 'pop' },
    shampoo: { icon: 'assets/art/tool/shampoo.webp', kind: 'rub', sfx: 'water' },
    dryer: { icon: 'assets/art/tool/dryer.webp', kind: 'rub', sfx: 'whoosh' },
    hairOil: { icon: 'assets/art/tool/hair_oil.webp', kind: 'rub', sfx: 'whoosh' },

    razor: { icon: 'assets/art/tool/razor.webp', kind: 'rub', sfx: 'whoosh' },
    waxPot: { icon: 'assets/art/tool/wax_pot.webp', kind: 'rub', sfx: 'whoosh' },
    waxStrip: { icon: 'assets/art/tool/wax_strip.webp', kind: 'tap', sfx: 'pop' },
    lotion: { icon: 'assets/art/tool/lotion.webp', kind: 'rub', sfx: 'whoosh' },
    plaster: { icon: 'assets/art/tool/plaster.webp', kind: 'tap', sfx: 'confirm' },

    nailFile: { icon: 'assets/art/tool/nail_file.webp', kind: 'rub', sfx: 'whoosh' },
    cuticle: { icon: 'assets/art/tool/cuticle.webp', kind: 'tap', sfx: 'pop' },
    clipper: { icon: 'assets/art/tool/clipper.webp', kind: 'tap', sfx: 'pop' },
    polish: { icon: 'assets/art/tool/polish.webp', kind: 'pick', sfx: 'select' },
    decal: { icon: 'assets/art/tool/decal.webp', kind: 'pick', sfx: 'sparkle' },
    topCoat: { icon: 'assets/art/tool/top_coat.webp', kind: 'tap', sfx: 'sparkle' },

    footFile: { icon: 'assets/art/tool/foot_file.webp', kind: 'rub', sfx: 'whoosh' },
    pumice: { icon: 'assets/art/tool/pumice.webp', kind: 'rub', sfx: 'whoosh' },
    saltJar: { icon: 'assets/art/tool/salt_jar.webp', kind: 'rub', sfx: 'water' },
    footCream: { icon: 'assets/art/tool/foot_cream.webp', kind: 'rub', sfx: 'whoosh' },

    stone: { icon: 'assets/art/tool/stone.webp', kind: 'place', sfx: 'confirm' },
    oil: { icon: 'assets/art/tool/oil.webp', kind: 'rub', sfx: 'whoosh' },
    palms: { icon: 'assets/art/tool/palms.webp', kind: 'rub', sfx: 'whoosh' },
    flower: { icon: 'assets/art/tool/flower.webp', kind: 'place', sfx: 'sparkle' },

    foundation: { icon: 'assets/art/tool/foundation.webp', kind: 'rub', sfx: 'whoosh' },
    powder: { icon: 'assets/art/tool/powder.webp', kind: 'rub', sfx: 'whoosh' },
    blush: { icon: 'assets/art/tool/blush.webp', kind: 'pick', sfx: 'select' },
    eyeshadow: { icon: 'assets/art/tool/eyeshadow.webp', kind: 'pick', sfx: 'select' },
    eyeliner: { icon: 'assets/art/tool/eyeliner.webp', kind: 'trace', sfx: 'whoosh' },
    mascara: { icon: 'assets/art/tool/mascara.webp', kind: 'tap', sfx: 'pop' },
    browPen: { icon: 'assets/art/tool/brow_pen.webp', kind: 'trace', sfx: 'whoosh' },
    lipstick: { icon: 'assets/art/tool/lipstick.webp', kind: 'pick', sfx: 'select' },
    lipGloss: { icon: 'assets/art/tool/lip_gloss.webp', kind: 'tap', sfx: 'sparkle' },
    glitter: { icon: 'assets/art/tool/glitter.webp', kind: 'tap', sfx: 'sparkle' },
    gem: { icon: 'assets/art/tool/gem.webp', kind: 'tap', sfx: 'sparkle' },
    lens: { icon: 'assets/art/tool/lens.webp', kind: 'pick', sfx: 'select' },
};

// --- Палитры цветов. Игрок выбирает оттенок, маска красится в него (Art.tint).
/** @satisfies {Record<string, string[]>} */
const PALETTES = {
    lips: ['#d6355f', '#b8264f', '#e06a86', '#f0899b', '#a32d4e', '#7d2540', '#e8546e', '#c66b7d'],
    eyes: ['#8e6bd6', '#d27ab5', '#6fa8dc', '#5fc0a6', '#e0a458', '#b45b8c', '#4a4e8c', '#d9d2ea'],
    blush: ['#ef9aa8', '#e6748f', '#f2b3a0', '#d98ca5', '#f5c0c8'],
    nails: ['#e4356f', '#ff8cb0', '#c23a8c', '#7b5fd6', '#4aa8c9', '#57c08a', '#f0b429', '#ffffff', '#2e2b3a', '#c9a0dc'],
    hairColor: ['#3a2820', '#7a4632', '#b07a4a', '#e0bf86', '#c2455c', '#8a5fc0'],
};

// --- Слои макияжа: маска + палитра + маркеры лица, на которые она ложится.
/** @satisfies {Record<string, any>} */
const MAKEUP_STEPS = {
    foundation: { tool: 'foundation', mode: 'rub', zone: 'zone-face', mask: 'assets/art/makeup/foundation.webp', color: '#f6dcc8' },
    powder: { tool: 'powder', mode: 'rub', zone: 'zone-face', mask: 'assets/art/makeup/powder.webp', color: '#fbe6d6' },
    blush: { tool: 'blush', mode: 'pick', at: 'cheek', palette: 'blush', mask: 'assets/art/makeup/blush.webp', size: [150, 98] },
    eyes: { tool: 'eyeshadow', mode: 'pick', at: 'eye', palette: 'eyes', mask: 'assets/art/makeup/shadow_a.webp', size: [142, 84] },
    liner: { tool: 'eyeliner', mode: 'trace', at: 'liner', mask: 'assets/art/makeup/liner_a.webp', color: '#2b2130', size: [150, 62] },
    lashes: { tool: 'mascara', mode: 'tap', at: 'lash', mask: 'assets/art/makeup/lashes_a.webp', color: '#231a2b', size: [134, 40] },
    brows: { tool: 'browPen', mode: 'tap', at: 'brow', mask: 'assets/art/makeup/brow_a.webp', color: '#4a3324', size: [132, 48] },
    lips: { tool: 'lipstick', mode: 'pick', at: 'lips', palette: 'lips', mask: 'assets/art/makeup/lips_a.webp', size: [210, 96] },
    gloss: { tool: 'lipGloss', mode: 'tap', at: 'lips', mask: 'assets/art/makeup/gloss.webp', color: '#ffffff', size: [210, 96] },
    glitter: { tool: 'glitter', mode: 'tap', at: 'eye', mask: 'assets/art/makeup/glitter.webp', color: '#ffe9a8', size: [146, 90] },
    gem: { tool: 'gem', mode: 'tap', at: 'cheek', mask: 'assets/art/makeup/gem.webp', color: '#b7e6ff', size: [54, 54] },
    lens: { tool: 'lens', mode: 'pick', at: 'eye', palette: 'eyes', mask: 'assets/art/makeup/lens.webp', size: [56, 56] },
};

// --- Гардероб. tags — стили; совпадение с темой уровня даёт звёзды и лайки.
//     price 0 — доступно сразу; остальные предметы открываются по SHOP_OFFERS.
/** @type {{id:string,cat:string,image:string,price:number,tags:string[]}[]} */
const WARDROBE = [
    { id: 'hair_01', cat: 'hair', image: 'assets/art/hair/hair_01.webp', price: 0, tags: ['casual', 'office', 'sport'] },
    { id: 'hair_02', cat: 'hair', image: 'assets/art/hair/hair_02.webp', price: 0, tags: ['casual', 'street'] },
    { id: 'hair_03', cat: 'hair', image: 'assets/art/hair/hair_03.webp', price: 0, tags: ['glam', 'party'] },
    { id: 'hair_04', cat: 'hair', image: 'assets/art/hair/hair_04.webp', price: 120, tags: ['wedding', 'glam'] },
    { id: 'hair_05', cat: 'hair', image: 'assets/art/hair/hair_05.webp', price: 0, tags: ['beach', 'casual'] },
    { id: 'hair_06', cat: 'hair', image: 'assets/art/hair/hair_06.webp', price: 160, tags: ['retro', 'glam'] },
    { id: 'hair_07', cat: 'hair', image: 'assets/art/hair/hair_07.webp', price: 0, tags: ['sport', 'street'] },
    { id: 'hair_08', cat: 'hair', image: 'assets/art/hair/hair_08.webp', price: 180, tags: ['party', 'street'] },
    { id: 'hair_09', cat: 'hair', image: 'assets/art/hair/hair_09.webp', price: 0, tags: ['office', 'winter'] },
    { id: 'hair_10', cat: 'hair', image: 'assets/art/hair/hair_10.webp', price: 220, tags: ['wedding', 'retro'] },

    { id: 'dress_01', cat: 'dress', image: 'assets/art/wear/dress_01.webp', price: 0, tags: ['casual', 'beach'] },
    { id: 'dress_02', cat: 'dress', image: 'assets/art/wear/dress_02.webp', price: 0, tags: ['party', 'glam'] },
    { id: 'dress_03', cat: 'dress', image: 'assets/art/wear/dress_03.webp', price: 140, tags: ['wedding'] },
    { id: 'dress_04', cat: 'dress', image: 'assets/art/wear/dress_04.webp', price: 0, tags: ['office'] },
    { id: 'dress_05', cat: 'dress', image: 'assets/art/wear/dress_05.webp', price: 160, tags: ['glam', 'retro'] },
    { id: 'dress_06', cat: 'dress', image: 'assets/art/wear/dress_06.webp', price: 0, tags: ['street', 'casual'] },
    { id: 'dress_07', cat: 'dress', image: 'assets/art/wear/dress_07.webp', price: 200, tags: ['party', 'street'] },
    { id: 'dress_08', cat: 'dress', image: 'assets/art/wear/dress_08.webp', price: 0, tags: ['beach', 'summer'] },
    { id: 'dress_09', cat: 'dress', image: 'assets/art/wear/dress_09.webp', price: 240, tags: ['winter', 'office'] },
    { id: 'dress_10', cat: 'dress', image: 'assets/art/wear/dress_10.webp', price: 300, tags: ['wedding', 'glam'] },

    { id: 'top_01', cat: 'top', image: 'assets/art/wear/top_01.webp', price: 0, tags: ['casual', 'street'] },
    { id: 'top_02', cat: 'top', image: 'assets/art/wear/top_02.webp', price: 0, tags: ['office'] },
    { id: 'top_03', cat: 'top', image: 'assets/art/wear/top_03.webp', price: 120, tags: ['party', 'glam'] },
    { id: 'top_04', cat: 'top', image: 'assets/art/wear/top_04.webp', price: 0, tags: ['sport'] },
    { id: 'top_05', cat: 'top', image: 'assets/art/wear/top_05.webp', price: 150, tags: ['winter'] },
    { id: 'top_06', cat: 'top', image: 'assets/art/wear/top_06.webp', price: 0, tags: ['beach', 'casual'] },

    { id: 'bottom_01', cat: 'bottom', image: 'assets/art/wear/bottom_01.webp', price: 0, tags: ['casual', 'street'] },
    { id: 'bottom_02', cat: 'bottom', image: 'assets/art/wear/bottom_02.webp', price: 0, tags: ['office'] },
    { id: 'bottom_03', cat: 'bottom', image: 'assets/art/wear/bottom_03.webp', price: 130, tags: ['party', 'glam'] },
    { id: 'bottom_04', cat: 'bottom', image: 'assets/art/wear/bottom_04.webp', price: 0, tags: ['sport'] },
    { id: 'bottom_05', cat: 'bottom', image: 'assets/art/wear/bottom_05.webp', price: 170, tags: ['winter', 'retro'] },
    { id: 'bottom_06', cat: 'bottom', image: 'assets/art/wear/bottom_06.webp', price: 0, tags: ['beach'] },

    { id: 'shoes_01', cat: 'shoes', image: 'assets/art/wear/shoes_01.webp', price: 0, tags: ['casual', 'street'] },
    { id: 'shoes_02', cat: 'shoes', image: 'assets/art/wear/shoes_02.webp', price: 0, tags: ['office', 'glam'] },
    { id: 'shoes_03', cat: 'shoes', image: 'assets/art/wear/shoes_03.webp', price: 110, tags: ['party', 'glam'] },
    { id: 'shoes_04', cat: 'shoes', image: 'assets/art/wear/shoes_04.webp', price: 0, tags: ['sport'] },
    { id: 'shoes_05', cat: 'shoes', image: 'assets/art/wear/shoes_05.webp', price: 140, tags: ['winter'] },
    { id: 'shoes_06', cat: 'shoes', image: 'assets/art/wear/shoes_06.webp', price: 0, tags: ['beach'] },
    { id: 'shoes_07', cat: 'shoes', image: 'assets/art/wear/shoes_07.webp', price: 190, tags: ['wedding'] },
    { id: 'shoes_08', cat: 'shoes', image: 'assets/art/wear/shoes_08.webp', price: 0, tags: ['retro', 'street'] },

    { id: 'bag_01', cat: 'bag', image: 'assets/art/wear/bag_01.webp', price: 0, tags: ['casual', 'office'] },
    { id: 'bag_02', cat: 'bag', image: 'assets/art/wear/bag_02.webp', price: 0, tags: ['party', 'glam'] },
    { id: 'bag_03', cat: 'bag', image: 'assets/art/wear/bag_03.webp', price: 120, tags: ['street'] },
    { id: 'bag_04', cat: 'bag', image: 'assets/art/wear/bag_04.webp', price: 0, tags: ['beach', 'sport'] },
    { id: 'bag_05', cat: 'bag', image: 'assets/art/wear/bag_05.webp', price: 210, tags: ['wedding', 'retro'] },

    { id: 'acc_01', cat: 'acc', image: 'assets/art/wear/acc_01.webp', price: 0, tags: ['casual', 'street'] },
    { id: 'acc_02', cat: 'acc', image: 'assets/art/wear/acc_02.webp', price: 0, tags: ['glam', 'party'] },
    { id: 'acc_03', cat: 'acc', image: 'assets/art/wear/acc_03.webp', price: 130, tags: ['wedding'] },
    { id: 'acc_04', cat: 'acc', image: 'assets/art/wear/acc_04.webp', price: 0, tags: ['office', 'winter'] },
    { id: 'acc_05', cat: 'acc', image: 'assets/art/wear/acc_05.webp', price: 160, tags: ['retro'] },
    { id: 'acc_06', cat: 'acc', image: 'assets/art/wear/acc_06.webp', price: 0, tags: ['beach', 'sport'] },
];

// Permanent offers: exactly 10 diamond purchases and 10 rewarded-video unlocks.
// Explicit IDs keep unlock methods stable when the wardrobe order changes.
/** @type {Record<string, {diamonds?:number,videos?:number}>} */
const SHOP_OFFERS = {
    hair_04: {diamonds:120}, hair_06: {videos:1},
    hair_08: {diamonds:180}, hair_10: {videos:3},
    dress_03: {diamonds:140}, dress_05: {videos:2},
    dress_07: {diamonds:200}, dress_09: {videos:2},
    dress_10: {diamonds:300}, top_03: {videos:1},
    top_05: {diamonds:150}, bottom_03: {videos:1},
    bottom_05: {diamonds:170}, shoes_03: {videos:1},
    shoes_05: {diamonds:140}, shoes_07: {videos:3},
    bag_03: {diamonds:120}, bag_05: {videos:3},
    acc_03: {diamonds:130}, acc_05: {videos:2},
};

// --- Клиентки салона: имя (ключ Lang) и тон кожи (модели t1/t2/t3).
/** @type {{id:string,tone:string}[]} */
const CLIENTS = [
    { id: 'mia', tone: 't1' }, { id: 'zoe', tone: 't2' }, { id: 'aya', tone: 't3' },
    { id: 'lily', tone: 't1' }, { id: 'nina', tone: 't2' }, { id: 'kira', tone: 't3' },
    { id: 'sasha', tone: 't1' }, { id: 'tara', tone: 't2' }, { id: 'jade', tone: 't3' },
    { id: 'vera', tone: 't1' }, { id: 'lena', tone: 't2' }, { id: 'ruby', tone: 't3' },
];

// Темы показа мод: с ними сверяются теги надетых вещей.
const THEMES = ['casual', 'office', 'party', 'glam', 'beach', 'sport', 'street', 'winter', 'retro', 'wedding'];

// Основные и дополнительные категории. Все слоты необязательны.
const DRESS_SLOTS = ['hair', 'dress', 'shoes'];
const DRESS_EXTRA = ['top', 'bottom', 'bag', 'acc'];


// --- Базовые картинки моделей: вид сцены x тон кожи клиентки (t1/t2/t3).
//     Пути литералами — иначе сканер сборки их не увидит.
/** @satisfies {Record<string, Record<string, string>>} */
const MODEL_ART = {
    spa: { t1: 'assets/art/model/spa_t1.webp', t2: 'assets/art/model/spa_t2.webp', t3: 'assets/art/model/spa_t3.webp' },
    hair: { t1: 'assets/art/model/hair_t1.webp', t2: 'assets/art/model/hair_t2.webp', t3: 'assets/art/model/hair_t3.webp' },
    legs: { t1: 'assets/art/model/legs_t1.webp', t2: 'assets/art/model/legs_t2.webp', t3: 'assets/art/model/legs_t3.webp' },
    feet: { t1: 'assets/art/model/feet_t1.webp', t2: 'assets/art/model/feet_t2.webp', t3: 'assets/art/model/feet_t3.webp' },
    hands: { t1: 'assets/art/model/hands_t1.webp', t2: 'assets/art/model/hands_t2.webp', t3: 'assets/art/model/hands_t3.webp' },
    back: { t1: 'assets/art/model/back_t1.webp', t2: 'assets/art/model/back_t2.webp', t3: 'assets/art/model/back_t3.webp' },
    makeup: { t1: 'assets/art/model/face_t1.webp', t2: 'assets/art/model/face_t2.webp', t3: 'assets/art/model/face_t3.webp' },
    dressup: { t1: 'assets/art/model/body_t1.webp', t2: 'assets/art/model/body_t2.webp', t3: 'assets/art/model/body_t3.webp' },
    runway: { t1: 'assets/art/model/body_t1.webp', t2: 'assets/art/model/body_t2.webp', t3: 'assets/art/model/body_t3.webp' },
};

// --- Несовершенства кожи: чем убирается и какая картинка лежит на лице.
/** @type {{id:string,image:string,tool:string,size:number}[]} */
const SPOT_ART = [
    { id: 'pimple', image: 'assets/art/blemish/pimple.webp', tool: 'needle', size: 52 },
    { id: 'acne', image: 'assets/art/blemish/acne.webp', tool: 'needle', size: 66 },
    { id: 'blackhead', image: 'assets/art/blemish/blackhead.webp', tool: 'tweezers', size: 46 },
    { id: 'hairspot', image: 'assets/art/blemish/hairspot.webp', tool: 'tweezers', size: 56 },
    { id: 'redness', image: 'assets/art/blemish/redness.webp', tool: 'cotton', size: 74 },
    { id: 'dirt', image: 'assets/art/blemish/dirt.webp', tool: 'cotton', size: 70 },
    { id: 'dry', image: 'assets/art/blemish/dry.webp', tool: 'spatula', size: 64 },
    { id: 'scar', image: 'assets/art/blemish/scar.webp', tool: 'spatula', size: 58 },
];

// --- Что находится в волосах.
/** @type {{id:string,image:string,tool:string,size:number}[]} */
const MESS_ART = [
    { id: 'bug', image: 'assets/art/hairjob/bug.webp', tool: 'tweezers', size: 56 },
    { id: 'leaf', image: 'assets/art/hairjob/leaf.webp', tool: 'tweezers', size: 66 },
    { id: 'twig', image: 'assets/art/hairjob/twig.webp', tool: 'tweezers', size: 72 },
    { id: 'gum', image: 'assets/art/hairjob/gum.webp', tool: 'scissors', size: 62 },
    { id: 'tangle', image: 'assets/art/hairjob/tangle.webp', tool: 'comb', size: 80 },
    { id: 'dandruff', image: 'assets/art/hairjob/dandruff.webp', tool: 'comb', size: 58 },
];

// --- Секущиеся пряди (ножницы) и царапины на ногах.
const SPLIT_ART = { image: 'assets/art/hairjob/split.webp', tool: 'scissors', size: 78 };
/** @type {{id:string,image:string,tool:string,size:number}[]} */
const FLAW_ART = [
    { id: 'cut', image: 'assets/art/legjob/cut.webp', tool: 'plaster', size: 56 },
    { id: 'bruise', image: 'assets/art/legjob/bruise.webp', tool: 'cotton', size: 62 },
    { id: 'mole', image: 'assets/art/legjob/mole.webp', tool: 'tweezers', size: 44 },
];

// --- Слои ухода: то, что накладывается поверх модели.
/** @satisfies {Record<string, string>} */
const CARE_ART = {
    foam: 'assets/art/care/foam.webp',
    cream: 'assets/art/care/cream.webp',
    glow: 'assets/art/care/glow.webp',
    maskSheet: 'assets/art/care/mask_sheet.webp',
    patch: 'assets/art/care/patch_eye.webp',
    steam: 'assets/art/care/steam.webp',
    hairFoam: 'assets/art/hairjob/shampoo_foam.webp',
    hairShine: 'assets/art/hairjob/shine.webp',
    legHair: 'assets/art/legjob/hairpatch.webp',
    wax: 'assets/art/legjob/wax_applied.webp',
    waxStrip: 'assets/art/legjob/wax_strip.webp',
    legLotion: 'assets/art/legjob/lotion.webp',
    plaster: 'assets/art/legjob/plaster.webp',
    roughHeel: 'assets/art/nailjob/rough_heel.webp',
    footFoam: 'assets/art/nailjob/foot_foam.webp',
    nailLong: 'assets/art/nailjob/nail_long.webp',
    nailPolish: 'assets/art/nailjob/nail_polish.webp',
    stone: 'assets/art/spajob/stone.webp',
    oil: 'assets/art/spajob/oil.webp',
    flower: 'assets/art/spajob/flower.webp',
    sparkle: 'assets/art/ui/sparkle.webp',
    like: 'assets/art/ui/like.webp',
};

// --- Наклейки на ногти: выбираются как палитра.
/** @type {{id:string,image:string}[]} */
const DECALS = [
    { id: 'star', image: 'assets/art/nailjob/decal_star.webp' },
    { id: 'heart', image: 'assets/art/nailjob/decal_heart.webp' },
    { id: 'flower', image: 'assets/art/nailjob/decal_flower.webp' },
    { id: 'gem', image: 'assets/art/nailjob/decal_gem.webp' },
];

// --- Звуки игры. Пути литералами: сканер сборки кладёт в архив только их.
/** @satisfies {Record<string, string>} */
const SFX = {
    click: 'assets/sounds/click.ogg',
    select: 'assets/sounds/select.ogg',
    confirm: 'assets/sounds/confirm.ogg',
    error: 'assets/sounds/error.ogg',
    pop: 'assets/sounds/pop.wav',
    sparkle: 'assets/sounds/sparkle.ogg',
    chime: 'assets/sounds/chime.ogg',
    complete: 'assets/sounds/complete.ogg',
    coin: 'assets/sounds/coin.ogg',
    water: 'assets/sounds/water.ogg',
    whoosh: 'assets/sounds/whoosh.wav',
    applause: 'assets/sounds/applause.ogg',
    music: 'assets/sounds/salon-happy-loop.ogg',
};
