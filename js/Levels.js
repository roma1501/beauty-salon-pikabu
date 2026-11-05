// Levels.js — 50 уровней салона. Уровень = одна клиентка: какие процедуры ей делают,
// в каком порядке и под какую тему подбирают образ.
//
// stages — короткая запись шагов. Сцену (комнату), точки и зоны шаг берёт из карт
// js/Maps2D.js по маркерам, поэтому координат здесь нет.
//
//   cleanse            умыть лицо (растирание)                  сцена spa
//   spots:N            убрать N несовершенств нужным средством  сцена spa
//   mask               наложить маску, выдержать и снять        сцена spa
//   patches            патчи под глаза и огурцы                 сцена spa
//   cream              питательный крем                         сцена spa
//   hairclean:N        вычесать/убрать N «находок» из волос     сцена hair
//   haircut:N          состричь N секущихся прядей              сцена hair
//   hairwash           шампунь, смыть, высушить                 сцена hair
//   wax:N              воск на N участках ног                   сцена legs
//   shave              побрить ноги                             сцена legs
//   legcare:N          залечить N царапин и нанести лосьон      сцена legs
//   footbath           соль и ванночка для ног                  сцена feet
//   footfile           обработать пятки                         сцена feet
//   pedicure:N         покрасить N ногтей на ногах              сцена feet
//   manicure:N         подпилить и покрасить N ногтей на руках  сцена hands
//   nailart:N          наклейки на N ногтях                     сцена hands
//   massage:N          выложить N горячих камней                сцена back
//   oilrub             массаж с маслом                          сцена back
//   makeup:a+b+c       шаги макияжа (ключи MAKEUP_STEPS)        сцена makeup
//   dressup            собрать образ в гардеробе                сцена dressup
//   runway             показ мод, лайки и звёзды                сцена runway

/** @type {{n:number,client:string,theme:string,stages:string[]}[]} */
const LEVELS = [
    { n: 1, client: 'mia', theme: 'casual', stages: ['cleanse', 'spots:3', 'makeup:foundation+lips', 'dressup', 'runway'] },
    { n: 2, client: 'zoe', theme: 'casual', stages: ['cleanse', 'spots:4', 'cream', 'makeup:foundation+blush+lips', 'dressup', 'runway'] },
    { n: 3, client: 'aya', theme: 'office', stages: ['spots:4', 'mask', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 4, client: 'lily', theme: 'party', stages: ['cleanse', 'spots:5', 'patches', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 5, client: 'nina', theme: 'beach', stages: ['cleanse', 'spots:5', 'cream', 'makeup:foundation+blush+lips+gloss', 'dressup', 'runway'] },

    { n: 6, client: 'kira', theme: 'street', stages: ['hairclean:4', 'hairwash', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 7, client: 'sasha', theme: 'casual', stages: ['cleanse', 'spots:5', 'hairclean:5', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 8, client: 'tara', theme: 'glam', stages: ['spots:6', 'mask', 'hairwash', 'makeup:foundation+eyes+liner+lips', 'dressup', 'runway'] },
    { n: 9, client: 'jade', theme: 'office', stages: ['hairclean:5', 'haircut:3', 'hairwash', 'makeup:foundation+brows+blush+lips', 'dressup', 'runway'] },
    { n: 10, client: 'vera', theme: 'winter', stages: ['cleanse', 'spots:6', 'patches', 'hairwash', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 11, client: 'lena', theme: 'party', stages: ['hairclean:6', 'haircut:3', 'makeup:foundation+eyes+liner+lashes+lips', 'dressup', 'runway'] },
    { n: 12, client: 'ruby', theme: 'retro', stages: ['cleanse', 'mask', 'hairwash', 'makeup:foundation+brows+liner+lips', 'dressup', 'runway'] },

    { n: 13, client: 'mia', theme: 'glam', stages: ['spots:5', 'manicure:5', 'makeup:foundation+blush+lips', 'dressup', 'runway'] },
    { n: 14, client: 'zoe', theme: 'office', stages: ['cleanse', 'manicure:6', 'nailart:3', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 15, client: 'aya', theme: 'wedding', stages: ['mask', 'manicure:8', 'makeup:foundation+eyes+lashes+lips', 'dressup', 'runway'] },
    { n: 16, client: 'lily', theme: 'sport', stages: ['cleanse', 'spots:6', 'manicure:6', 'makeup:foundation+brows+gloss', 'dressup', 'runway'] },
    { n: 17, client: 'nina', theme: 'street', stages: ['hairclean:5', 'manicure:8', 'nailart:4', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 18, client: 'kira', theme: 'party', stages: ['spots:6', 'patches', 'manicure:8', 'makeup:foundation+eyes+liner+lips+glitter', 'dressup', 'runway'] },
    { n: 19, client: 'sasha', theme: 'casual', stages: ['cleanse', 'hairwash', 'manicure:6', 'makeup:foundation+blush+lips', 'dressup', 'runway'] },
    { n: 20, client: 'tara', theme: 'glam', stages: ['mask', 'manicure:10', 'nailart:5', 'makeup:foundation+eyes+liner+lashes+lips', 'dressup', 'runway'] },

    { n: 21, client: 'jade', theme: 'beach', stages: ['wax:2', 'legcare:2', 'makeup:foundation+blush+gloss', 'dressup', 'runway'] },
    { n: 22, client: 'vera', theme: 'casual', stages: ['cleanse', 'wax:3', 'legcare:2', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 23, client: 'lena', theme: 'sport', stages: ['shave', 'legcare:3', 'manicure:6', 'makeup:foundation+gloss', 'dressup', 'runway'] },
    { n: 24, client: 'ruby', theme: 'party', stages: ['spots:6', 'wax:4', 'legcare:3', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 25, client: 'mia', theme: 'beach', stages: ['wax:4', 'shave', 'legcare:4', 'makeup:foundation+blush+lips+gloss', 'dressup', 'runway'] },
    { n: 26, client: 'zoe', theme: 'street', stages: ['hairclean:6', 'wax:3', 'manicure:8', 'makeup:foundation+eyes+liner+lips', 'dressup', 'runway'] },
    { n: 27, client: 'aya', theme: 'office', stages: ['cleanse', 'mask', 'wax:4', 'makeup:foundation+brows+blush+lips', 'dressup', 'runway'] },
    { n: 28, client: 'lily', theme: 'winter', stages: ['spots:7', 'wax:4', 'legcare:4', 'makeup:foundation+eyes+lashes+lips', 'dressup', 'runway'] },

    { n: 29, client: 'nina', theme: 'beach', stages: ['footbath', 'footfile', 'pedicure:5', 'makeup:foundation+blush+gloss', 'dressup', 'runway'] },
    { n: 30, client: 'kira', theme: 'casual', stages: ['cleanse', 'footbath', 'pedicure:8', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 31, client: 'sasha', theme: 'glam', stages: ['footbath', 'footfile', 'pedicure:10', 'manicure:8', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },
    { n: 32, client: 'tara', theme: 'party', stages: ['spots:7', 'footbath', 'pedicure:10', 'makeup:foundation+eyes+liner+lips+glitter', 'dressup', 'runway'] },
    { n: 33, client: 'jade', theme: 'wedding', stages: ['mask', 'footfile', 'pedicure:10', 'manicure:10', 'makeup:foundation+eyes+lashes+lips', 'dressup', 'runway'] },
    { n: 34, client: 'vera', theme: 'sport', stages: ['shave', 'footbath', 'footfile', 'pedicure:8', 'makeup:foundation+gloss', 'dressup', 'runway'] },
    { n: 35, client: 'lena', theme: 'retro', stages: ['hairwash', 'footbath', 'pedicure:10', 'makeup:foundation+brows+liner+lips', 'dressup', 'runway'] },
    { n: 36, client: 'ruby', theme: 'street', stages: ['hairclean:7', 'wax:4', 'pedicure:8', 'makeup:foundation+eyes+lips', 'dressup', 'runway'] },

    { n: 37, client: 'mia', theme: 'casual', stages: ['massage:4', 'oilrub', 'makeup:foundation+blush+lips', 'dressup', 'runway'] },
    { n: 38, client: 'zoe', theme: 'office', stages: ['massage:5', 'oilrub', 'manicure:8', 'makeup:foundation+brows+lips', 'dressup', 'runway'] },
    { n: 39, client: 'aya', theme: 'glam', stages: ['cleanse', 'massage:6', 'oilrub', 'makeup:foundation+eyes+liner+lips', 'dressup', 'runway'] },
    { n: 40, client: 'lily', theme: 'winter', stages: ['massage:6', 'footbath', 'footfile', 'makeup:foundation+blush+lips', 'dressup', 'runway'] },
    { n: 41, client: 'nina', theme: 'party', stages: ['massage:5', 'spots:7', 'mask', 'makeup:foundation+eyes+lashes+lips+glitter', 'dressup', 'runway'] },
    { n: 42, client: 'kira', theme: 'wedding', stages: ['massage:6', 'oilrub', 'manicure:10', 'makeup:foundation+eyes+liner+lashes+lips', 'dressup', 'runway'] },
    { n: 43, client: 'sasha', theme: 'beach', stages: ['wax:4', 'massage:5', 'pedicure:10', 'makeup:foundation+blush+gloss', 'dressup', 'runway'] },
    { n: 44, client: 'tara', theme: 'retro', stages: ['hairclean:7', 'haircut:4', 'massage:6', 'makeup:foundation+brows+liner+lips', 'dressup', 'runway'] },

    { n: 45, client: 'jade', theme: 'glam', stages: ['spots:8', 'mask', 'hairwash', 'manicure:10', 'makeup:foundation+eyes+liner+lashes+lips+gem', 'dressup', 'runway'] },
    { n: 46, client: 'vera', theme: 'party', stages: ['cleanse', 'spots:8', 'massage:6', 'pedicure:10', 'makeup:foundation+eyes+liner+lips+glitter', 'dressup', 'runway'] },
    { n: 47, client: 'lena', theme: 'street', stages: ['hairclean:8', 'wax:4', 'manicure:10', 'nailart:5', 'makeup:foundation+eyes+lips+gem', 'dressup', 'runway'] },
    { n: 48, client: 'ruby', theme: 'winter', stages: ['massage:6', 'oilrub', 'footbath', 'pedicure:10', 'makeup:foundation+brows+eyes+lips', 'dressup', 'runway'] },
    { n: 49, client: 'mia', theme: 'wedding', stages: ['mask', 'patches', 'manicure:10', 'nailart:5', 'makeup:foundation+eyes+lashes+liner+lips+gloss', 'dressup', 'runway'] },
    { n: 50, client: 'ruby', theme: 'glam', stages: ['cleanse', 'spots:8', 'mask', 'hairwash', 'massage:6', 'manicure:10', 'makeup:foundation+eyes+liner+lashes+lips+glitter+gem', 'dressup', 'runway'] },
];

/** @satisfies {Record<string, any>} */
const Levels = {
    count() { return Math.min(LEVELS.length, typeof GAME_LEVELS !== 'undefined' ? GAME_LEVELS : LEVELS.length); },
    get(n) { return LEVELS[Math.max(0, Math.min(this.count() - 1, (n | 0) - 1))]; },
    // Клиентка уровня: запись CLIENTS или первая по списку.
    client(level) { return CLIENTS.find(c => c.id === level.client) || CLIENTS[0]; },
};
