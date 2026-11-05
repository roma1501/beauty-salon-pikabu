// Maps2D.js — сцены салона (Canvas 2D, Lory Engine). Каждая сцена = карта:
// фон комнаты, размеры логического поля (WORLD2D_WIDTH x WORLD2D_HEIGHT) и МАРКЕРЫ —
// точки логики, по которым игра расставляет прыщики, стразы, лак, камни и одежду.
//
// Правило движка: координаты в коде не держим. Хочешь подвинуть прыщик на щеке или
// ноготь — правь маркер здесь, игра возьмёт новое место сама (world.markers('spot')).
// Имена маркеров: 'spot-1', 'spot-2', … — группа; 'eye-l' / 'eye-r' — пара.
//
// Уровни (кто пришёл в салон и что с ним делаем) — js/Levels.js, они ссылаются на
// сцены по id. Одна сцена обслуживает десятки уровней.

/** @type {GameMap2D[]} */
const GAME_MAPS_2D = [
    // --- Уход за лицом: клиентка лежит на подушке, лицо крупно ---------------------
    {
        id: 'spa', name: 'Spa', width: 720, height: 1280, background: '#f7dbe8',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_spa.webp', color: '#f7dbe8' }],
        markers: [
            { name: 'model', x: 20, y: 150, width: 680, height: 1000 },
            { name: 'frame', x: 0, y: 0, width: 720, height: 1140 },
            { name: 'zone-face', x: 200, y: 340, width: 320, height: 394 },
            { name: 'brow-l', x: 286, y: 438 }, { name: 'brow-r', x: 434, y: 438 },
            { name: 'eye-l', x: 286, y: 490 }, { name: 'eye-r', x: 434, y: 490 },
            { name: 'cheek-l', x: 274, y: 574 }, { name: 'cheek-r', x: 446, y: 574 },
            { name: 'lips', x: 360, y: 628 },
            { name: 'spot-1', x: 310, y: 390 }, { name: 'spot-2', x: 410, y: 390 },
            { name: 'spot-3', x: 255, y: 550 }, { name: 'spot-4', x: 465, y: 550 },
            { name: 'spot-5', x: 275, y: 610 }, { name: 'spot-6', x: 445, y: 610 },
            { name: 'spot-7', x: 360, y: 695 }, { name: 'spot-nose', x: 360, y: 540 },
        ],
    },

    // --- Уход за волосами: голова сверху, волосы разложены веером --------------------
    {
        id: 'hair', name: 'Hair care', width: 720, height: 1280, background: '#f3dcec',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_hair.webp', color: '#f3dcec' }],
        markers: [
            { name: 'model', x: 10, y: 130, width: 700, height: 1020 },
            { name: 'frame', x: 0, y: 0, width: 720, height: 1140 },
            { name: 'zone-hair', x: 110, y: 185, width: 500, height: 400 },
            { name: 'zone-face', x: 268, y: 690, width: 184, height: 210 },
            { name: 'mess-1', x: 186, y: 262 }, { name: 'mess-2', x: 300, y: 224 },
            { name: 'mess-3', x: 430, y: 236 }, { name: 'mess-4', x: 540, y: 300 },
            { name: 'mess-5', x: 150, y: 400 }, { name: 'mess-6', x: 566, y: 424 },
            { name: 'mess-7', x: 228, y: 520 }, { name: 'mess-8', x: 492, y: 536 },
            { name: 'mess-9', x: 356, y: 300 }, { name: 'mess-10', x: 120, y: 540 },
        ],
    },

    // --- Ноги: воск, бритва, крем ---------------------------------------------------
    {
        id: 'legs', name: 'Legs', width: 720, height: 1280, background: '#f6dfe9',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_legs.webp', color: '#f6dfe9' }],
        markers: [
            { name: 'model', x: 60, y: 140, width: 600, height: 1020 },
            { name: 'frame', x: 0, y: 150, width: 720, height: 1030 },
            { name: 'zone-legs', x: 195, y: 140, width: 330, height: 945 },
            { name: 'seg-1', x: 204, y: 190, width: 140, height: 330 },
            { name: 'seg-2', x: 232, y: 540, width: 104, height: 360 },
            { name: 'seg-3', x: 369, y: 190, width: 140, height: 330 },
            { name: 'seg-4', x: 379, y: 540, width: 104, height: 360 },
            { name: 'flaw-1', x: 265, y: 330 }, { name: 'flaw-2', x: 435, y: 372 },
            { name: 'flaw-3', x: 287, y: 672 }, { name: 'flaw-4', x: 409, y: 700 },
            { name: 'flaw-ankle-l', x: 317, y: 860 }, { name: 'flaw-ankle-r', x: 397, y: 846 },
        ],
    },

    // --- Педикюр: ванночка, пятки, ногти на ногах -----------------------------------
    {
        id: 'feet', name: 'Pedicure', width: 720, height: 1280, background: '#e6dcf6',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_feet.webp', color: '#e6dcf6' }],
        markers: [
            { name: 'model', x: 60, y: 190, width: 600, height: 900 },
            { name: 'zone-feet', x: 150, y: 400, width: 420, height: 470 },
            { name: 'bath', x: 90, y: 760, width: 540, height: 300 },
            { name: 'heel-l', x: 204, y: 705, width: 120, height: 150 },
            { name: 'heel-r', x: 372, y: 705, width: 120, height: 150 },
            { name: 'nail-1', x: 166, y: 506 }, { name: 'nail-2', x: 190, y: 472 },
            { name: 'nail-3', x: 219, y: 443 }, { name: 'nail-4', x: 255, y: 425 },
            { name: 'nail-5', x: 307, y: 431 }, { name: 'nail-6', x: 413, y: 431 },
            { name: 'nail-7', x: 467, y: 425 }, { name: 'nail-8', x: 500, y: 443 },
            { name: 'nail-9', x: 528, y: 472 }, { name: 'nail-10', x: 552, y: 506 },
        ],
    },

    // --- Маникюр: руки на столике ---------------------------------------------------
    {
        id: 'hands', name: 'Manicure', width: 720, height: 1280, background: '#f7e2dd',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_hands.webp', color: '#f7e2dd' }],
        markers: [
            { name: 'model', x: 30, y: 270, width: 660, height: 780 },
            { name: 'frame', x: 0, y: 0, width: 720, height: 990 },
            { name: 'zone-hands', x: 52, y: 300, width: 616, height: 332 },
            { name: 'nail-1', x: 69, y: 467 }, { name: 'nail-2', x: 123, y: 390 },
            { name: 'nail-3', x: 175, y: 359 }, { name: 'nail-4', x: 228, y: 387 },
            { name: 'nail-5', x: 326, y: 577 }, { name: 'nail-6', x: 392, y: 577 },
            { name: 'nail-7', x: 492, y: 385 }, { name: 'nail-8', x: 544, y: 359 },
            { name: 'nail-9', x: 596, y: 390 }, { name: 'nail-10', x: 650, y: 467 },
        ],
    },

    // --- Массаж спины: горячие камни и масло ----------------------------------------
    {
        id: 'back', name: 'Massage', width: 720, height: 1280, background: '#dfeaf2',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_back.webp', color: '#dfeaf2' }],
        markers: [
            { name: 'model', x: 40, y: 170, width: 640, height: 980 },
            { name: 'frame', x: 0, y: 0, width: 720, height: 1140 },
            { name: 'zone-back', x: 205, y: 485, width: 310, height: 445 },
            { name: 'stone-1', x: 360, y: 525 }, { name: 'stone-2', x: 360, y: 595 },
            { name: 'stone-3', x: 360, y: 665 }, { name: 'stone-4', x: 360, y: 735 },
            { name: 'stone-5', x: 360, y: 805 }, { name: 'stone-6', x: 360, y: 875 },
            { name: 'flower-l', x: 168, y: 906 }, { name: 'flower-r', x: 552, y: 906 },
        ],
    },

    // --- Макияж: лицо крупным планом ------------------------------------------------
    {
        id: 'makeup', name: 'Make-up', width: 720, height: 1280, background: '#fadfe8',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_makeup.webp', color: '#fadfe8' }],
        markers: [
            { name: 'model', x: 40, y: 110, width: 640, height: 940 },
            { name: 'frame', x: 0, y: 0, width: 720, height: 1040 },
            { name: 'zone-face', x: 145, y: 278, width: 430, height: 566 },
            { name: 'brow-l', x: 254, y: 443 }, { name: 'brow-r', x: 466, y: 443 },
            { name: 'eye-l', x: 256, y: 505 }, { name: 'eye-r', x: 464, y: 505 },
            { name: 'lash-l', x: 255, y: 482 }, { name: 'lash-r', x: 465, y: 482 },
            { name: 'cheek-l', x: 248, y: 612 }, { name: 'cheek-r', x: 472, y: 612 },
            { name: 'lips', x: 360, y: 712 },
            { name: 'liner-l-1', x: 202, y: 500 }, { name: 'liner-l-2', x: 251, y: 486 },
            { name: 'liner-l-3', x: 304, y: 512 },
            { name: 'liner-r-1', x: 416, y: 512 }, { name: 'liner-r-2', x: 469, y: 486 },
            { name: 'liner-r-3', x: 518, y: 500 },
        ],
    },

    // --- Гардероб: модель в полный рост перед зеркалом -------------------------------
    {
        id: 'dressup', name: 'Wardrobe', width: 720, height: 1280, background: '#f0e1f7',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_wardrobe.webp', color: '#f0e1f7' }],
        markers: [
            { name: 'model', x: 110, y: 130, width: 500, height: 1000 },
            { name: 'mirror', x: 60, y: 90, width: 600, height: 1040 },
        ],
    },

    // --- Показ мод: героиня против соперницы ----------------------------------------
    {
        id: 'runway', name: 'Fashion show', width: 720, height: 1280, background: '#e9d6fb',
        sprites: [{ x: 0, y: 0, width: 720, height: 1280, z: -100, image: 'assets/art/bg/room_runway.webp', color: '#e9d6fb' }],
        markers: [
            { name: 'frame', x: 0, y: 230, width: 720, height: 720 },
            { name: 'model', x: 44, y: 300, width: 300, height: 600 },
            { name: 'rival', x: 376, y: 300, width: 300, height: 600 },
        ],
    },
];
