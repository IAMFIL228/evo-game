/* ============================================================
   EVO — жизнь как игра
   Аватар растёт по уровням (LVL): дела дают XP, прокрастинация
   отнимает — вплоть до отката уровня и формы (дно: Семя, LVL 0).
   Каждые 20 XP — +1 уровень; 7 форм-котов — вехи на пути к
   LVL 100 (Титан), дальше уровни растут без предела. Баллы
   тратятся в магазине мотиваций (категории с мин. ценами),
   большие мечты копятся в реальных деньгах на экране «Мечты».
   Данные: localStorage. 5 свайп-экранов.
   ============================================================ */
'use strict';

/* ---------- константы ---------- */
const LS_KEY = 'evo_v1';
const XP_PER_LVL = 20;   // XP до следующего уровня
const LVL_MAX = 100;     // уровень, на котором открывается Титан
const MAX_DEEDS = 12;
const MAX_SHOP = 20;
const MAX_SHIELDS = 3;
const SHIELD_PRICE = 50;
const POTION_PRICE = 40;
const SPONT_DAILY = 5;   // сколько спонтанных дел в день вознаграждается (дальше — просто записи)
const MAX_DREAMS = 10;
const WEEK_TIER = 25;    // каждые +25 LVL после 100 — новый титул Титана (II, III, …)
const DAY_LBL = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/* категории наград: min — минимальная цена в 💰; «dream» — не продаётся за монеты,
   уходит на отдельный экран «Мечты» (копилка в реальных деньгах) */
const CATEGORIES = [
  { id: 'trinket', emoji: '🍬', name: 'Мелочь, а приятно', min: 100 },
  { id: 'food',    emoji: '🍔', name: 'Ням-Ням',           min: 200 },
  { id: 'gadget',  emoji: '📱', name: 'Гаджеты',           min: 500 },
  { id: 'fun',     emoji: '🎡', name: 'Развлечения',       min: 300 },
  { id: 'other',   emoji: '✨', name: 'Остальное',         min: 100 },
  { id: 'dream',   emoji: '💭', name: 'Мечта',             min: 0  },
];

const STAGES = [
  { lvl: 0,   name: 'Семя',    sub: 'LVL 0' },
  { lvl: 15,  name: 'Заряд',   sub: 'LVL 15' },
  { lvl: 30,  name: 'Искра',   sub: 'LVL 30' },
  { lvl: 45,  name: 'Воин',    sub: 'LVL 45' },
  { lvl: 60,  name: 'Герой',   sub: 'LVL 60' },
  { lvl: 80,  name: 'Легенда', sub: 'LVL 80' },
  { lvl: 100, name: 'Титан',   sub: 'LVL 100' },
];

/* аватары — 7 мемных котов: design/ai/cat-1..7.png (котёнок → гигачад) */
const CAT_SRC = (stage) => `design/ai/cat-${stage + 1}.png`;

/* свечение за котом по стадии (7 цветов) */
const GLOW = [
  'rgba(138, 147, 173, 0.22)',
  'rgba(69, 212, 131, 0.22)',
  'rgba(88, 166, 255, 0.22)',
  'rgba(138, 107, 255, 0.24)',
  'rgba(255, 122, 69, 0.24)',
  'rgba(245, 197, 66, 0.26)',
  'rgba(255, 255, 255, 0.30)',
];

function setAvatar(el, stage) {
  if (!el) return;
  el.src = CAT_SRC(stage);
  el.alt = `Кот-аватар: ${STAGES[stage].name}`;
}

function preloadCats() {
  for (let i = 0; i < STAGES.length; i++) new Image().src = CAT_SRC(i);
}

const PRAISE = [
  'Дело сделано. Аватар это почувствовал.',
  'Ещё один шаг. Завтра — снова.',
  'Так держать. Серия растёт.',
  'Ты сегодня сильнее вчерашнего себя.',
  'Дисциплина вместо настроения. Работает.',
];

/* ---------- утилиты дат ---------- */
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function addDaysStr(ds, n) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function dateRu(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return `${d}.${pad(m)}`;
}
function tsTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function evDateLabel(ts) {
  const d = new Date(ts);
  const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return ds === todayStr() ? tsTime(ts) : `${dateRu(ds)} ${tsTime(ts)}`;
}

/* ---------- состояние ---------- */
let state = null;

function defaultState() {
  return {
    v: 1,
    onboarded: false,
    avatarName: 'Эво',
    created: todayStr(),
    xp: 0,
    lvl: 0,
    coins: 0,
    maxStage: 0,
    stageDates: [todayStr()],
    deeds: [],            // серийные: {id, emoji, name, createdAt}
    spontCount: 0,
    deedsTotal: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    shopItems: [],        // {id, emoji, name, price, cat, createdAt}
    dreams: [],           // мечты: {id, emoji, name, target, saved, deposits, createdAt} — реальные деньги
    achievements: {},     // id → дата открытия
    weekClaim: null,      // понедельник недели, челлендж которой уже закрыт
    lastExport: null,     // дата последнего экспорта (напоминание о бэкапе)
    goal: null,           // id награды, на которую копим
    purchases: [],        // {emoji, name, price, ts}
    inventory: { shield: 0 },
    log: {},              // дата → {deeds:{id:bonus}, shielded:[id], spont:[{name,hp,coins,ts}]}
    events: [],           // {ts, ico, txt, kind}
    settings: { notif: false, notifTime: '21:00' },
    notifiedFor: null,
    lastPotion: null,     // дата последнего выпитого зелья (1 в день)
    lastProcess: todayStr(),
  };
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch (e) {
    state = defaultState();
  }
  if (!state || typeof state !== 'object' || !('hp' in state || 'xp' in state)) state = defaultState();
  migrateXP(state);
  migrateShop(state);
}

function ensureLog(ds) {
  if (!state.log[ds]) state.log[ds] = { deeds: {}, shielded: [], spont: [] };
  if (!state.log[ds].shielded) state.log[ds].shielded = [];
  if (!state.log[ds].spont) state.log[ds].spont = [];
  return state.log[ds];
}

/* ---------- события (хроника) ---------- */
function addEvent(ico, txt, kind) {
  state.events.unshift({ ts: Date.now(), ico, txt, kind: kind || 'info' });
  if (state.events.length > 40) state.events.length = 40;
}

/* ---------- XP, уровни и эволюция ---------- */
function curStage() {
  let st = 0;
  for (let i = 0; i < STAGES.length; i++) if (state.lvl >= STAGES[i].lvl) st = i;
  return st;
}

function changeXP(delta) {
  const before = curStage();
  const lvlBefore = state.lvl;
  state.xp += delta;
  let ups = 0, downs = 0;
  while (state.xp >= XP_PER_LVL) { state.xp -= XP_PER_LVL; state.lvl++; ups++; }
  // штрафы могут увести XP в минус: тогда уровень откатывается,
  // а с ним — и форма. Дно: LVL 0 / xp 0 (Семя ниже не падает).
  while (state.xp < 0) {
    if (state.lvl <= 0) { state.xp = 0; break; }
    state.lvl--; downs++;
    state.xp += XP_PER_LVL;
  }
  const after = curStage();
  if (after > state.maxStage) {
    state.maxStage = after;
    state.stageDates[after] = todayStr();
    addEvent('🧬', `ЭВОЛЮЦИЯ! Новая форма: «${STAGES[after].name}» (LVL ${state.lvl})`, 'evo');
    toast(`🧬 Эволюция: ${STAGES[after].name}!`);
    confetti();
  } else if (downs > 0 && after < before) {
    addEvent('📉', `Форма откатилась: «${STAGES[before].name}» → «${STAGES[after].name}» (LVL ${state.lvl})`, 'bad');
    toast(`📉 Откат до «${STAGES[after].name}»…`);
  } else if (ups > 0 && after > before) {
    // форма была потеряна из-за срывов и вернулась
    addEvent('🧬', `Форма возвращена: «${STAGES[after].name}» (LVL ${state.lvl})`, 'good');
    toast(`🧬 Снова «${STAGES[after].name}»!`);
  } else if (ups > 0) {
    if (after === STAGES.length - 1) {
      addEvent('⬆️', `LVL ${state.lvl}! Форма уже максимальная — Титан`, 'good');
    } else {
      addEvent('⬆️', `LVL ${state.lvl} · форма «${STAGES[after].name}»`, 'good');
    }
    toast(`⬆️ LVL ${state.lvl}!`);
    // титулы после Титана: каждые +25 уровней
    const tierBefore = lvlBefore >= LVL_MAX ? Math.floor((lvlBefore - LVL_MAX) / WEEK_TIER) : -1;
    const tierAfter = state.lvl >= LVL_MAX ? Math.floor((state.lvl - LVL_MAX) / WEEK_TIER) : -1;
    if (tierAfter > tierBefore && tierAfter >= 1) {
      addEvent('🏆', `Новый титул: Титан ${roman(tierAfter + 1)} (LVL ${state.lvl})`, 'evo');
      toast(`🏆 Титул: Титан ${roman(tierAfter + 1)}!`);
    }
  } else if (downs > 0) {
    addEvent('📉', `−${downs} LVL (сейчас LVL ${state.lvl})`, 'bad');
  }
  checkAchievements();
  checkWeekly();
  save();
}

/* миграция сейвов: старый формат (поле hp) и промежуточный (lvl = стадия 0..6) */
function migrateXP(s) {
  if (typeof s.lvl !== 'number' || isNaN(s.lvl)) {
    const TH = [0, 15, 30, 45, 60, 80, 95]; // старые пороги ХП
    let st = 0;
    if (typeof s.hp === 'number' && !isNaN(s.hp)) for (let i = 0; i < TH.length; i++) if (s.hp >= TH[i]) st = i;
    s.lvl = STAGES[st].lvl; // форма сохраняется на новой шкале уровней
    s.xp = 0;
  }
  if (!('hp' in s) && (s.maxStage | 0) > 0 && s.lvl === s.maxStage && s.lvl <= 6) {
    s.lvl = STAGES[Math.min(s.maxStage, STAGES.length - 1)].lvl; // форма сохраняется
  }
  if (typeof s.xp !== 'number' || isNaN(s.xp)) s.xp = 0;
  s.xp = Math.max(0, Math.min(XP_PER_LVL - 1, s.xp));
  delete s.hp;
}

/* миграция магазина/мечт: у старых наград нет категории, поля dreams может не быть */
function migrateShop(s) {
  if (!Array.isArray(s.dreams)) s.dreams = [];
  if (Array.isArray(s.shopItems)) for (const it of s.shopItems) if (!it.cat) it.cat = 'other';
}

/* ---------- расписание дел, недели, титулы ---------- */
function weekdayOf(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/* дело «положено» в этот день? (без расписания — ежедневно) */
function isDeedDue(deed, ds) {
  return !Array.isArray(deed.days) || deed.days.length === 0 || deed.days.includes(weekdayOf(ds));
}

function daysLabel(days) {
  if (!Array.isArray(days) || days.length === 0 || days.length === 7) return '';
  return ' · ' + [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_LBL[d]).join(',');
}

const dsOfTs = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function weekMonday() {
  return addDaysStr(todayStr(), -((new Date().getDay() + 6) % 7));
}
/* план недели растёт с числом серийных дел: 2 дела → 10, 5 дел → 25, 10+ → 50 */
function weekGoal() {
  return Math.min(50, Math.max(10, state.deeds.length * 5));
}
function weekDeeds() {
  const t = todayStr();
  let n = 0;
  for (let d = weekMonday(); d <= t; d = addDaysStr(d, 1)) {
    const lg = state.log[d];
    if (lg) n += Object.keys(lg.deeds).length + lg.spont.length;
  }
  return n;
}
function checkWeekly() {
  const mon = weekMonday();
  if (state.weekClaim === mon) return;
  const wg = weekGoal();
  if (weekDeeds() >= wg) {
    state.weekClaim = mon;
    const prize = wg * 2;
    state.coins += prize;
    state.coinsEarned += prize;
    addEvent('🎯', `Недельный челлендж закрыт (${wg} дел) — +${prize} 💰`, 'good');
    toast(`🎯 Челлендж недели закрыт! +${prize} 💰`);
  }
}

function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}
/* титул после Титана: 100 = Титан, 125 = Титан II, 150 = Титан III… */
function titanTitle() {
  if (curStage() !== STAGES.length - 1) return '';
  const over = state.lvl - LVL_MAX;
  return over >= WEEK_TIER ? ' ' + roman(Math.floor(over / WEEK_TIER) + 1) : '';
}

/* ---------- достижения ---------- */
const ACHIEVEMENTS = [
  { id: 'first',     ico: '🌱', name: 'Первый шаг',    desc: 'первое дело отмечено' },
  { id: 'streak7',   ico: '🔥', name: 'Неделя огня',   desc: 'серия 7 дней' },
  { id: 'streak30',  ico: '🌋', name: 'Месяц стали',   desc: 'серия 30 дней' },
  { id: 'streak100', ico: '💎', name: 'Сто дней',      desc: 'серия 100 дней' },
  { id: 'evo1',      ico: '🧬', name: 'Пробуждение',   desc: 'вторая форма' },
  { id: 'evo5',      ico: '👑', name: 'Легенда',       desc: 'форма «Легенда»' },
  { id: 'titan',     ico: '🏆', name: 'Титан',         desc: 'финальная форма' },
  { id: 'deeds50',   ico: '⚒️', name: 'Полсотни',      desc: '50 дел всего' },
  { id: 'deeds250',  ico: '⚙️', name: 'Машина',        desc: '250 дел всего' },
  { id: 'coin1k',    ico: '💰', name: 'Первая тысяча', desc: '1000 💰 заработано' },
  { id: 'dream1',    ico: '💭', name: 'Мечтатель',     desc: 'первая мечта' },
  { id: 'dreamDone', ico: '🎉', name: 'Мечта сбылась', desc: 'копилка заполнена' },
  { id: 'shop5',     ico: '🛍️', name: 'Гурман',        desc: '5 покупок' },
];

function achDone() {
  const totalDeeds = state.deedsTotal + state.spontCount;
  return {
    first: totalDeeds >= 1,
    streak7: maxTotalStreak() >= 7,
    streak30: maxTotalStreak() >= 30,
    streak100: maxTotalStreak() >= 100,
    evo1: state.maxStage >= 1,
    evo5: state.maxStage >= 5,
    titan: state.maxStage >= 6,
    deeds50: totalDeeds >= 50,
    deeds250: totalDeeds >= 250,
    coin1k: state.coinsEarned >= 1000,
    dream1: state.dreams.length >= 1,
    dreamDone: state.dreams.some((d) => d.saved >= d.target),
    shop5: state.purchases.length >= 5,
  };
}

function checkAchievements() {
  if (!state.achievements) state.achievements = {};
  const rules = achDone();
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements[a.id] && rules[a.id]) {
      state.achievements[a.id] = todayStr();
      addEvent(a.ico, `Достижение: «${a.name}» — ${a.desc}`, 'evo');
      toast(`${a.ico} Достижение: ${a.name}!`);
      n++;
    }
  }
  return n;
}

/* ---------- серии ---------- */
function dayHasDeed(ds, deedId) {
  const lg = state.log[ds];
  if (!lg) return false;
  return lg.deeds[deedId] !== undefined || lg.shielded.includes(deedId);
}

function deedStreakAt(deed, dateStr) {
  // сколько «положенных» дней подряд (done/shielded) на день ПЕРЕД dateStr;
  // дни вне расписания пропускаются и серию не ломают
  let n = 0, guard = 0;
  let d = addDaysStr(dateStr, -1);
  while (d >= deed.createdAt && guard++ < 4000) {
    if (!isDeedDue(deed, d)) { d = addDaysStr(d, -1); continue; }
    if (!dayHasDeed(d, deed.id)) break;
    n++;
    d = addDaysStr(d, -1);
  }
  return n;
}

function deedStreak(deed) {
  // текущая серия с учётом сегодня (день ещё можно спасти)
  let n = 0, guard = 0;
  let d = todayStr();
  if (!isDeedDue(deed, d) || !dayHasDeed(d, deed.id)) d = addDaysStr(d, -1);
  while (d >= deed.createdAt && guard++ < 4000) {
    if (!isDeedDue(deed, d)) { d = addDaysStr(d, -1); continue; }
    if (!dayHasDeed(d, deed.id)) break;
    n++;
    d = addDaysStr(d, -1);
  }
  return n;
}

function hasActivity(ds) {
  const lg = state.log[ds];
  if (!lg) return false;
  if (Object.keys(lg.deeds).length > 0 || lg.shielded.length > 0 || lg.spont.length > 0) return true;
  return false;
}

function maxTotalStreak() {
  let max = 0, cur = 0, d = state.created;
  const t = todayStr();
  let guard = 0;
  while (d <= t && guard++ < 4000) {
    if (hasActivity(d)) { cur++; if (cur > max) max = cur; }
    else cur = 0;
    d = addDaysStr(d, 1);
  }
  return max;
}

function totalStreak() {
  let n = 0;
  let d = todayStr();
  if (!hasActivity(d)) d = addDaysStr(d, -1);
  while (hasActivity(d)) { n++; d = addDaysStr(d, -1); if (n > 3650) break; }
  return n;
}

/* ---------- ежесуточная обработка (пропуски, щиты, простой) ---------- */
function processDay(ds) {
  ensureLog(ds);
  const lg = state.log[ds];
  for (const deed of state.deeds) {
    if (deed.createdAt > ds) continue;
    if (!isDeedDue(deed, ds)) continue; // день вне расписания — серия спит, штрафа нет
    if (lg.deeds[deed.id] !== undefined || lg.shielded.includes(deed.id)) continue;
    const lost = deedStreakAt(deed, ds);
    if (lost > 0 && state.inventory.shield > 0) {
      state.inventory.shield--;
      lg.shielded.push(deed.id);
      addEvent('🛡️', `Щит спас серию «${deed.name}» (${lost} дн.)`, 'shield');
    } else if (lost > 0) {
      const pen = Math.min(3 + Math.ceil(lost / 2), 15);
      changeXP(-pen);
      addEvent('💔', `Серия «${deed.name}» потеряна (${lost} дн.) — −${pen} XP`, 'bad');
    }
  }
  if (!hasActivity(ds)) {
    changeXP(-5);
    addEvent('🕳️', 'День без единого дела — −5 XP', 'bad');
  }
}

function processRollover() {
  const today = todayStr();
  let d = state.lastProcess || today;
  let guard = 0;
  while (d < today && guard++ < 500) {
    processDay(d);
    d = addDaysStr(d, 1);
  }
  state.lastProcess = today;
  checkAchievements();
  checkWeekly();
  save();
}

/* ---------- рендер: общие ---------- */
const $ = (id) => document.getElementById(id);

function renderAll() {
  renderHome();
  renderDeeds();
  renderShop();
  renderDreams();
  renderProfile();
}

function renderHome() {
  $('avName').textContent = state.avatarName;
  const st = curStage();
  const next = STAGES[st + 1];
  $('avStage').textContent = next
    ? `${STAGES[st].name} · до «${next.name}» ${(next.lvl - state.lvl) * XP_PER_LVL - state.xp} XP`
    : `${STAGES[st].name} · максимум формы`;

  $('lvlNum').textContent = state.lvl;
  $('lvlFill').style.width = `${(Math.min(state.lvl, LVL_MAX) / LVL_MAX) * 100}%`;

  $('xpNum').textContent = `${Math.round(state.xp)}/${XP_PER_LVL}`;
  const fill = $('xpFill');
  fill.style.width = `${(state.xp / XP_PER_LVL) * 100}%`;
  fill.classList.toggle('low', state.xp < XP_PER_LVL * 0.3);

  // отметки стадий на шкале LVL (линию с заливкой #lvlFill не трогаем)
  const track = $('lvlTrack');
  track.querySelectorAll('.lvl-mark').forEach((m) => m.remove());
  STAGES.forEach((s, i) => {
    const m = document.createElement('span');
    m.className = 'lvl-mark' + (state.lvl >= s.lvl ? ' passed' : '') + (i === st ? ' current' : '');
    if (i === 0) m.classList.add('edge-l');
    if (i === STAGES.length - 1) m.classList.add('edge-r');
    m.style.left = `${(s.lvl / LVL_MAX) * 100}%`;
    m.textContent = s.name;
    track.appendChild(m);
  });

  // свечение за котом по стадии
  $('avatarGlow').style.background = `radial-gradient(circle, ${GLOW[st]} 0%, transparent 65%)`;

  setAvatar($('avatarImg'), st);

  const dueToday = state.deeds.filter((d) => isDeedDue(d, todayStr()));
  const doneToday = dueToday.filter((d) => dayHasDeed(todayStr(), d.id)).length;
  const line = $('todayLine');
  if (state.deeds.length === 0) {
    line.textContent = 'Дел пока нет';
    line.classList.remove('done');
    $('todaySub').textContent = 'Добавь серийные дела во вкладку «Дела» →';
  } else if (dueToday.length === 0) {
    line.textContent = 'На сегодня планов нет';
    line.classList.remove('done');
    $('todaySub').textContent = `🔥 Общая серия: ${totalStreak()} дн. · выходной от дел 🎉`;
  } else {
    const all = doneToday === dueToday.length;
    line.textContent = all ? 'Все дела на сегодня закрыты!' : `Сегодня: ${doneToday} из ${dueToday.length} дел`;
    line.classList.toggle('done', all);
    const sp = (state.log[todayStr()] || { spont: [] }).spont.length;
    $('todaySub').textContent = `🔥 Общая серия: ${totalStreak()} дн. · спонтанных сегодня: ${sp}`;
  }

  // хроника
  const feed = $('feed');
  feed.innerHTML = '';
  if (state.events.length === 0) {
    feed.innerHTML = '<li class="feed-empty">Пока тихо. Сделай первое дело — и здесь появится история.</li>';
  } else {
    for (const ev of state.events.slice(0, 12)) {
      const li = document.createElement('li');
      li.className = ev.kind === 'bad' ? 'bad' : ev.kind === 'good' || ev.kind === 'evo' ? 'good' : '';
      li.innerHTML = `<span class="f-ico">${ev.ico}</span><span class="f-txt">${ev.txt}</span><span class="f-date">${evDateLabel(ev.ts)}</span>`;
      feed.appendChild(li);
    }
  }

  updateCoins();
}

function updateCoins() {
  const txt = `💰 ${state.coins}`;
  $('coinsChip').textContent = txt;
  $('coinsChip2').textContent = txt;
  $('coinsChip3').textContent = txt;
}

function renderDeeds() {
  updateCoins();
  // недельный челлендж
  const wg = weekGoal(), wd = weekDeeds();
  $('weekNum').textContent = `${wd}/${wg}`;
  $('weekPrize').textContent = `приз ${wg * 2} 💰`;
  $('weekFill').style.width = `${Math.min(100, Math.round((wd / wg) * 100))}%`;

  const list = $('deedList');
  list.innerHTML = '';
  if (state.deeds.length === 0) {
    list.innerHTML = '<p class="hint" style="margin:4px 0 10px">Нет дел. Добавь первое: «зарядка», «чтение», «учёба»…</p>';
  }
  const yest = addDaysStr(todayStr(), -1);
  for (const deed of state.deeds) {
    const done = dayHasDeed(todayStr(), deed.id);
    const streak = deedStreak(deed);
    const row = document.createElement('div');
    row.className = 'deed' + (done ? ' done' : '');
    const canCatch = !done && isDeedDue(deed, yest) && !dayHasDeed(yest, deed.id) && yest >= deed.createdAt;
    row.innerHTML = `
      <div class="deed-emoji">${deed.emoji}</div>
      <div class="deed-body">
        <div class="deed-name">${esc(deed.name)}</div>
        <div class="deed-meta">🔥 <span class="fire">${streak}</span> серия · +5 XP +${deed.coins || 10} 💰${daysLabel(deed.days)}</div>
        ${canCatch ? '<button class="deed-mini-btn" data-catch="' + deed.id + '">↺ Догнать вчера</button>' : ''}
      </div>
      <button class="deed-check" data-toggle="${deed.id}" title="${done ? 'Отменить' : 'Выполнено'}">${done ? '✓' : ''}</button>
      <button class="deed-del" data-del="${deed.id}" title="Удалить дело">✕</button>
    `;
    list.appendChild(row);
  }

  // спонтанные за сегодня
  const sl = $('spontList');
  sl.innerHTML = '';
  const lg = ensureLog(todayStr());
  if (lg.spont.length === 0) {
    sl.innerHTML = '<p class="spont-empty">Сегодня спонтанных дел нет.</p>';
  } else {
    for (const s of [...lg.spont].reverse()) {
      const el = document.createElement('div');
      el.className = 'spont-item';
      el.innerHTML = `<span class="s-name">${esc(s.name)}</span><span class="s-rew">${s.hp > 0 ? `+${s.hp} XP +${s.coins} 💰` : 'без награды · лимит'}</span><button data-spont-del="${s.ts}" title="Удалить">✕</button>`;
      sl.appendChild(el);
    }
  }
  const slLeft = $('spontLeft');
  if (slLeft) {
    slLeft.textContent = lg.spont.length < SPONT_DAILY
      ? `Награда за первые ${SPONT_DAILY} спонтанных в день: сегодня ${lg.spont.length}/${SPONT_DAILY}`
      : `Дневной лимит ${SPONT_DAILY} наград исчерпан — записи идут без XP и 💰`;
  }
}

function renderShop() {
  updateCoins();
  $('invLine').textContent = `Инвентарь: щитов ${state.inventory.shield}/${MAX_SHIELDS} · расходуются автоматически при пропуске дня`;

  // цель накопления
  const goalBox = $('goalBox');
  const goal = state.goal ? state.shopItems.find((i) => i.id === state.goal) : null;
  if (goal) {
    goalBox.classList.remove('hidden');
    const left = Math.max(0, goal.price - state.coins);
    const pct = Math.min(100, Math.round((state.coins / goal.price) * 100));
    goalBox.innerHTML = `
      <div class="goal-top"><span>🎯 Коплю на: <b>${goal.emoji} ${esc(goal.name)}</b></span><span class="goal-num">${state.coins}/${goal.price} 💰</span></div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-sub">${left > 0 ? `Осталось ${left} 💰 — это ~${Math.ceil(left / 15)} дел` : 'Цель достигнута — время купить!'}</div>
    `;
  } else {
    goalBox.classList.add('hidden');
    goalBox.innerHTML = '';
  }

  // артефакты
  const arts = $('artifacts');
  arts.innerHTML = '';
  arts.appendChild(shopRow('🛡️', `Щит серии (в запасе: ${state.inventory.shield})`, `спасает серию при пропуске`, SHIELD_PRICE,
    state.inventory.shield >= MAX_SHIELDS || state.coins < SHIELD_PRICE, buyShield));
  const potionDrunk = state.lastPotion === todayStr();
  arts.appendChild(shopRow('🧪', 'Зелье XP',
    potionDrunk ? 'сегодня уже выпито — следующее завтра · 1/день' : `+20 XP сразу (сейчас ${Math.round(state.xp)} XP) · 1/день`,
    POTION_PRICE, potionDrunk || state.coins < POTION_PRICE, buyPotion));

  // награды пользователя — по категориям (порядок из CATEGORIES)
  const list = $('shopList');
  list.innerHTML = '';
  if (state.shopItems.length === 0) {
    list.innerHTML = '<p class="hint" style="margin:4px 0 10px">Наград нет. Добавь то, что приятно купить за баллы.</p>';
  } else {
    for (const c of CATEGORIES) {
      if (c.id === 'dream') continue;
      const items = state.shopItems.filter((i) => (i.cat || 'other') === c.id);
      if (items.length === 0) continue;
      const h = document.createElement('div');
      h.className = 'cat-head';
      h.textContent = `${c.emoji} ${c.name}`;
      list.appendChild(h);
      for (const item of items) {
        list.appendChild(shopRow(item.emoji, esc(item.name), null, item.price, state.coins < item.price, () => buyReward(item.id), item.id, state.goal === item.id));
      }
    }
  }

  // покупки
  const pl = $('purchases');
  pl.innerHTML = '';
  if (state.purchases.length === 0) {
    pl.innerHTML = '<p class="purch-empty">Покупок пока нет. Копи баллы — трать с удовольствием.</p>';
  } else {
    for (const p of state.purchases.slice(0, 10)) {
      const el = document.createElement('div');
      el.className = 'purch-item';
      const d = new Date(p.ts);
      el.innerHTML = `<span>${p.emoji}</span><span class="p-name">${esc(p.name)}</span><span class="p-date">${dateRu(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)} ${tsTime(p.ts)}</span><span class="p-price">−${p.price} 💰</span>`;
      pl.appendChild(el);
    }
  }
}

function shopRow(emoji, name, sub, price, disabled, onBuy, delId, isGoal) {
  const row = document.createElement('div');
  row.className = 'shop-item';
  const priceCls = state.coins >= price ? 'affordable' : 'expensive';
  row.innerHTML = `
    <div class="si-emoji">${emoji}</div>
    <div class="si-body">
      <div class="si-name">${name}</div>
      ${sub ? `<div class="si-price ${priceCls}">${esc(sub)}</div>` : `<div class="si-price ${priceCls}">${price} 💰</div>`}
    </div>
    <button class="buy-btn" ${disabled ? 'disabled' : ''}>${price} 💰</button>
    ${delId ? `<button class="goal-btn${isGoal ? ' active' : ''}" title="${isGoal ? 'Цель накопления' : 'Копить на эту награду'}">🎯</button>` : ''}
    ${delId ? '<button class="shop-del" title="Удалить награду">✕</button>' : ''}
  `;
  row.querySelector('.buy-btn').addEventListener('click', onBuy);
  if (delId) {
    row.querySelector('.goal-btn').addEventListener('click', () => {
      state.goal = state.goal === delId ? null : delId;
      toast(state.goal ? '🎯 Цель накопления выбрана. Копи!' : 'Цель сброшена.');
      save(); renderShop();
    });
    row.querySelector('.shop-del').addEventListener('click', () => {
      if (confirm('Удалить эту награду из магазина?')) {
        if (state.goal === delId) state.goal = null;
        state.shopItems = state.shopItems.filter((i) => i.id !== delId);
        save(); renderShop();
      }
    });
  }
  return row;
}

function renderProfile() {
  $('profSub').textContent = `${state.avatarName} · ${STAGES[curStage()].name}${titanTitle()} · LVL ${state.lvl}`;
  const days = Math.max(1, Math.round((Date.now() - new Date(state.created + 'T00:00:00').getTime()) / 86400000) + 1);
  $('stDays').textContent = days;
  $('stDeeds').textContent = state.deedsTotal + state.spontCount;
  $('stMaxStreak').textContent = maxTotalStreak();
  $('stSpent').textContent = state.coinsSpent;

  // зал эволюции
  const gal = $('evoGallery');
  gal.innerHTML = '';
  const cur = curStage();
  STAGES.forEach((s, i) => {
    const locked = i > state.maxStage;
    const cell = document.createElement('div');
    cell.className = 'evo-cell' + (locked ? ' locked' : '') + (i === cur ? ' current' : '');
    if (locked) {
      // интрига: будущие формы не показываем — только сколько уровней осталось
      cell.insertAdjacentHTML('beforeend',
        `<div class="ev-mystery">?</div><div class="ev-name">???</div><div class="ev-sub">${s.sub}</div>`);
    } else {
      const img = document.createElement('img');
      setAvatar(img, i);
      const reached = state.stageDates[i] ? dateRu(state.stageDates[i]) : s.sub;
      cell.appendChild(img);
      cell.insertAdjacentHTML('beforeend', `<div class="ev-name">${s.name}</div><div class="ev-sub">${reached}</div>`);
    }
    gal.appendChild(cell);
  });

  // настройки
  $('notifToggle').checked = state.settings.notif;
  $('notifTime').value = state.settings.notifTime;
  renderAchievements();
  renderStats();
  checkExportReminder();
}

/* ---------- тост ---------- */
let toastTimer = null;
function toast(txt) {
  const t = $('toast');
  t.textContent = txt;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- действия: дела ---------- */
function toggleDeed(id) {
  const deed = state.deeds.find((d) => d.id === id);
  if (!deed) return;
  const t = todayStr();
  const lg = ensureLog(t);
  if (lg.deeds[id] !== undefined) {
    // отмена: снимаем ровно то, что начисляли
    const awarded = lg.deeds[id];
    delete lg.deeds[id];
    changeXP(-5);
    state.coins = Math.max(0, state.coins - awarded);
    state.coinsEarned = Math.max(0, state.coinsEarned - awarded);
    state.deedsTotal = Math.max(0, state.deedsTotal - 1);
    toast('Отметка снята');
  } else {
    const streak = deedStreak(deed) + 1; // с учётом сегодняшней отметки
    const bonus = streak >= 2 ? Math.min(streak - 1, 10) : 0;
    const coins = (deed.coins || 10) + bonus;
    lg.deeds[id] = coins;
    changeXP(+5);
    state.coins += coins;
    state.coinsEarned += coins;
    state.deedsTotal++;
    addEvent('✅', `«${deed.name}» — +5 XP +${coins} 💰${bonus ? ` (бонус серии +${bonus})` : ''}`, 'good');
    toast(`+5 XP +${coins} 💰 · ${PRAISE[Math.floor(Math.random() * PRAISE.length)]}`);
    popAvatar();
  }
  save();
  renderAll();
}

function catchUpDeed(id) {
  const deed = state.deeds.find((d) => d.id === id);
  if (!deed) return;
  const yest = addDaysStr(todayStr(), -1);
  const lg = ensureLog(yest);
  if (lg.deeds[id] !== undefined) return;
  const coins = deed.coins || 10;
  lg.deeds[id] = coins; // без бонуса, но серия спасена
  state.deedsTotal++;
  addEvent('↺', `«${deed.name}» — догнано за вчера (+5 XP)`, 'good');
  changeXP(+5);
  state.coins += coins;
  state.coinsEarned += coins;
  toast('Вчера закрыто. Серия спасена!');
  save();
  renderAll();
}

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function addDeed(emoji, name, price, days) {
  if (state.deeds.length >= MAX_DEEDS) { toast(`Максимум ${MAX_DEEDS} дел. Фокус важнее.`); return; }
  state.deeds.push({ id: uid('d'), emoji: emoji || '⚡', name, coins: Math.min(100, Math.max(1, price || 10)), days: Array.isArray(days) && days.length ? days : null, createdAt: todayStr() });
  addEvent('➕', `Новое дело: «${name}»`, 'info');
  toast(`Дело «${name}» создано. Не бросай.`);
  save();
  renderDeeds();
  renderHome();
}

function deleteDeed(id) {
  const deed = state.deeds.find((d) => d.id === id);
  if (!deed) return;
  if (!confirm(`Удалить «${deed.name}»? История останется, но серия исчезнет.`)) return;
  state.deeds = state.deeds.filter((d) => d.id !== id);
  addEvent('➖', `Дело «${deed.name}» удалено`, 'info');
  save();
  renderAll();
}

function addSpont(name) {
  const lg = ensureLog(todayStr());
  const rewarded = lg.spont.length < SPONT_DAILY;
  lg.spont.push({ name, hp: rewarded ? 3 : 0, coins: rewarded ? 5 : 0, ts: Date.now() });
  state.spontCount++;
  if (rewarded) {
    changeXP(+3);
    state.coins += 5;
    state.coinsEarned += 5;
    toast('+3 XP +5 💰 · записано!');
  } else {
    toast(`Записано. Награда — за первые ${SPONT_DAILY} в день.`);
  }
  popAvatar();
  save();
  renderAll();
}

function removeSpont(ts) {
  const t = todayStr();
  const lg = ensureLog(t);
  const idx = lg.spont.findIndex((s) => s.ts === ts);
  if (idx < 0) return;
  const s = lg.spont[idx];
  lg.spont.splice(idx, 1);
  changeXP(-s.hp);
  state.coins = Math.max(0, state.coins - s.coins);
  state.spontCount = Math.max(0, state.spontCount - 1);
  save();
  renderAll();
}

/* ---------- действия: магазин ---------- */
function buyShield() {
  if (state.inventory.shield >= MAX_SHIELDS) { toast(`Максимум ${MAX_SHIELDS} щитов в запасе.`); return; }
  if (state.coins < SHIELD_PRICE) { toast(`Не хватает 💰 (нужно ${SHIELD_PRICE}).`); return; }
  state.coins -= SHIELD_PRICE;
  state.coinsSpent += SHIELD_PRICE;
  state.inventory.shield++;
  addEvent('🛡️', 'Куплен щит серии', 'shield');
  toast('🛡️ Щит в запасе. Спасёт серию сам.');
  save();
  renderAll();
}

function buyPotion() {
  if (state.lastPotion === todayStr()) { toast('🧪 Одно зелье в день. Завтра выпьешь новое.'); return; }
  if (state.coins < POTION_PRICE) { toast(`Не хватает 💰 (нужно ${POTION_PRICE}).`); return; }
  state.coins -= POTION_PRICE;
  state.coinsSpent += POTION_PRICE;
  state.lastPotion = todayStr();
  changeXP(+20);
  addEvent('🧪', 'Выпито зелье XP — +20 XP', 'good');
  toast('🧪 +20 XP');
  popAvatar();
  save();
  renderAll();
}

function buyReward(id) {
  const item = state.shopItems.find((i) => i.id === id);
  if (!item) return;
  if (state.coins < item.price) { toast(`Не хватает 💰: есть ${state.coins}, нужно ${item.price}.`); return; }
  state.coins -= item.price;
  state.coinsSpent += item.price;
  if (state.goal === id) state.goal = null;
  state.purchases.unshift({ emoji: item.emoji, name: item.name, price: item.price, ts: Date.now() });
  if (state.purchases.length > 50) state.purchases.length = 50;
  addEvent('🎁', `Куплено: ${item.emoji} ${item.name} — −${item.price} 💰`, 'coin');
  toast(`${item.emoji} ${item.name} — твой! Наслаждайся.`);
  checkAchievements();
  save();
  renderAll();
}

function addShopItem(emoji, name, price, catId) {
  if (state.shopItems.length >= MAX_SHOP) { toast(`Максимум ${MAX_SHOP} наград.`); return; }
  const cat = CATEGORIES.find((c) => c.id === (catId || 'other')) || CATEGORIES[4];
  if (cat.id !== 'dream' && price < cat.min) { toast(`«${cat.name}»: минимум ${cat.min} 💰.`); return; }
  state.shopItems.push({ id: uid('s'), emoji: emoji || '🎁', name, price, cat: cat.id, createdAt: todayStr() });
  toast(`Награда «${name}» в магазине.`);
  save();
  renderShop();
}

/* ---------- мечты (копилки в реальных деньгах) ---------- */
const fmtMoney = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

function addDream(emoji, name, target) {
  if (state.dreams.length >= MAX_DREAMS) { toast(`Максимум ${MAX_DREAMS} мечт.`); return; }
  if (!(target >= 1)) { toast('Укажи цель в рублях.'); return; }
  state.dreams.push({ id: uid('m'), emoji: emoji || '🏝️', name, target, saved: 0, createdAt: todayStr() });
  addEvent('💭', `Новая мечта: «${name}» — цель ${fmtMoney(target)}`, 'info');
  toast('💭 Мечта на экране «Мечты». Копим!');
  checkAchievements();
  save();
  renderDreams();
}

function depositDream(id, amount) {
  const d = state.dreams.find((x) => x.id === id);
  if (!d) return;
  if (!(amount >= 1)) { toast('Введи сумму пополнения.'); return; }
  const wasDone = d.saved >= d.target;
  d.saved += amount;
  if (!Array.isArray(d.deposits)) d.deposits = [];
  d.deposits.push({ ts: Date.now(), amount });
  if (d.deposits.length > 30) d.deposits.shift();
  addEvent('💭', `«${d.name}»: +${fmtMoney(amount)} · накоплено ${fmtMoney(d.saved)}`, 'good');
  if (!wasDone && d.saved >= d.target) {
    addEvent('🎉', `Мечта «${d.name}» накоплена — можно исполнять!`, 'evo');
    toast(`🎉 «${d.name}» — цель закрыта!`);
    confetti();
  } else {
    toast(`+${fmtMoney(amount)} к мечте «${d.name}»`);
  }
  checkAchievements();
  save();
  renderDreams();
}

function withdrawDream(id, amount) {
  const d = state.dreams.find((x) => x.id === id);
  if (!d) return;
  if (!(amount >= 1)) { toast('Введи сумму.'); return; }
  if (d.saved <= 0) { toast('Пока нечего снимать.'); return; }
  d.saved = Math.max(0, d.saved - amount);
  if (!Array.isArray(d.deposits)) d.deposits = [];
  d.deposits.push({ ts: Date.now(), amount: -amount });
  if (d.deposits.length > 30) d.deposits.shift();
  addEvent('📤', `«${d.name}»: −${fmtMoney(amount)} · осталось ${fmtMoney(d.saved)}`, 'info');
  save();
  renderDreams();
}

function deleteDream(id) {
  const d = state.dreams.find((x) => x.id === id);
  if (!d) return;
  const extra = d.saved > 0 ? ` Накоплено ${fmtMoney(d.saved)} — счётчик исчезнет.` : '';
  if (!confirm(`Удалить мечту «${d.name}»?${extra}`)) return;
  state.dreams = state.dreams.filter((x) => x.id !== id);
  save();
  renderDreams();
}

function renderDreams() {
  const list = $('dreamList');
  if (!list) return;
  list.innerHTML = '';
  if (state.dreams.length === 0) {
    list.innerHTML = '<p class="hint" style="margin:4px 0 10px">Мечт пока нет. Большая цель — лучший мотиватор.</p>';
  }
  for (const d of state.dreams) {
    const pct = Math.min(100, Math.round((d.saved / d.target) * 100));
    const done = d.saved >= d.target;
    const el = document.createElement('div');
    el.className = 'dream' + (done ? ' done' : '');
    el.innerHTML = `
      <div class="dream-top">
        <div class="dream-emoji">${d.emoji}</div>
        <div class="dream-body">
          <div class="dream-name">${esc(d.name)}${done ? ' 🎉' : ''}</div>
          <div class="dream-nums"><b>${fmtMoney(d.saved)}</b> из ${fmtMoney(d.target)} · ${pct}%</div>
        </div>
        <button class="shop-del" data-ddel="${d.id}" title="Удалить мечту">✕</button>
      </div>
      <div class="dream-bar"><div class="dream-fill" style="width:${pct}%"></div></div>
      ${(d.deposits || []).length ? `<div class="dream-hist">${(d.deposits || []).slice(-3).reverse().map((h) => `${h.amount > 0 ? '➕' : '➖'} ${fmtMoney(Math.abs(h.amount))} · ${dateRu(dsOfTs(h.ts))} ${tsTime(h.ts)}`).join('<br>')}</div>` : ''}
      <div class="dream-ops">
        <input type="number" min="1" placeholder="сумма, ₽" data-din="${d.id}">
        <button class="mini-btn" data-dplus="${d.id}" title="Пополнить">＋</button>
        <button class="mini-btn" data-dminus="${d.id}" title="Снять">−</button>
      </div>
    `;
    list.appendChild(el);
  }
  const totalSaved = state.dreams.reduce((a, d) => a + d.saved, 0);
  const totalTarget = state.dreams.reduce((a, d) => a + d.target, 0);
  $('dreamTotal').textContent = fmtMoney(totalSaved);
  $('dreamTotalSub').textContent = totalTarget > 0
    ? `накоплено из ${fmtMoney(totalTarget)} по всем мечтам · ${Math.min(100, Math.round((totalSaved / totalTarget) * 100))}%`
    : 'добавь первую мечту — форма ниже';
}

/* ---------- достижения, статистика, бэкап-напоминание, конфетти ---------- */
function renderAchievements() {
  const grid = $('achGrid');
  if (!grid) return;
  grid.innerHTML = '';
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    const got = state.achievements && state.achievements[a.id];
    if (got) n++;
    const cell = document.createElement('div');
    cell.className = 'ach-cell' + (got ? ' got' : '');
    cell.title = got ? `${a.name} — открыто ${dateRu(got)}` : a.desc;
    cell.innerHTML = `<div class="ach-ico">${got ? a.ico : '🔒'}</div><div class="ach-name">${a.name}</div><div class="ach-sub">${got ? dateRu(got) : a.desc}</div>`;
    grid.appendChild(cell);
  }
  $('achCount').textContent = `Открыто ${n} из ${ACHIEVEMENTS.length}`;
}

function renderStats() {
  const wrap = $('statsBars');
  if (!wrap) return;
  wrap.innerHTML = '';
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const ds = addDaysStr(todayStr(), -i);
    const lg = state.log[ds];
    days.push({ n: lg ? Object.keys(lg.deeds).length + lg.spont.length : 0, d: Number(ds.slice(8)) });
  }
  const max = Math.max(1, ...days.map((x) => x.n));
  for (const x of days) {
    const col = document.createElement('div');
    col.className = 'stat-col';
    col.innerHTML = `<div class="stat-val">${x.n || ''}</div><div class="stat-bar" style="height:${Math.max(3, Math.round((x.n / max) * 54))}px"></div><div class="stat-day">${x.d}</div>`;
    wrap.appendChild(col);
  }
}

function checkExportReminder() {
  const el = $('exportHint');
  if (!el) return;
  let stale = true;
  if (state.lastExport) {
    const days = Math.round((Date.now() - new Date(state.lastExport + 'T00:00:00').getTime()) / 86400000);
    stale = days >= 14;
    el.textContent = `⏳ Последний экспорт был ${days} дн. назад. Данные живут только в этом браузере — освежи бэкап.`;
  } else {
    el.textContent = '⏳ Бэкапа ещё не было. Данные живут только в этом браузере — жми «Экспорт» и сохраняй файл.';
  }
  el.classList.toggle('hidden', !stale);
}

function confetti() {
  const colors = ['#45d483', '#f5c542', '#58a6ff', '#ff5d5d', '#b06bff'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.left = `${25 + Math.random() * 50}vw`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${Math.round(Math.random() * 160 - 80)}px`);
    p.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1900);
  }
}

/* ---------- поп-анимация аватара ---------- */
function popAvatar() {
  const img = $('avatarImg');
  if (!img) return;
  img.classList.remove('pop');
  void img.offsetWidth;
  img.classList.add('pop');
}

/* ---------- уведомления ---------- */
function notifyCheck() {
  if (!state.settings.notif || state.settings.notifTime === false) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const [h, m] = String(state.settings.notifTime).split(':').map(Number);
  if (isNaN(h)) return;
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)) return;
  const t = todayStr();
  if (hasActivity(t) || state.notifiedFor === t) return;
  state.notifiedFor = t;
  save();
  const title = 'EVO — дела ждут!';
  const body = `Общая серия ${totalStreak()} дн. под угрозой. Сделай хотя бы одно дело до полуночи.`;
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body })).catch(() => new Notification(title, { body }));
  } else {
    new Notification(title, { body });
  }
}

/* ---------- экспорт / импорт / сброс ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `evo-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  state.lastExport = todayStr();
  save();
  checkExportReminder();
  toast('Экспорт готов. Храни бэкап.');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !('log' in data) || !('hp' in data || 'xp' in data)) throw new Error('bad');
      state = Object.assign(defaultState(), data);
      migrateXP(state);
      migrateShop(state);
      save();
      renderAll();
      toast('Импорт успешен. Прогресс на месте.');
    } catch (e) {
      toast('Файл не подходит: это не бэкап EVO.');
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('СЖЕЧЬ ВСЁ? Аватар, серии, баллы и магазин будут удалены безвозвратно.')) return;
  if (!confirm('Точно? Последний шанс передумать.')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

/* ---------- онбординг ---------- */
function showOnboard() {
  $('onboard').classList.remove('hidden');
}

function hideOnboard() {
  $('onboard').classList.add('hidden');
}

/* ---------- свайп-страницы ---------- */
function setupPages() {
  const pages = $('pages');
  const dots = Array.from(document.querySelectorAll('.dot'));
  let idx = 0;

  function setActive(i) {
    if (i === idx) return;
    idx = Math.max(0, Math.min(dots.length - 1, i));
    dots.forEach((d, j) => d.classList.toggle('active', j === idx));
  }

  pages.addEventListener('scroll', () => {
    requestAnimationFrame(() => setActive(Math.round(pages.scrollLeft / pages.clientWidth)));
  }, { passive: true });

  dots.forEach((d) => d.addEventListener('click', () => {
    pages.scrollTo({ left: Number(d.dataset.i) * pages.clientWidth, behavior: 'smooth' });
  }));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') pages.scrollTo({ left: (idx + 1) * pages.clientWidth, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') pages.scrollTo({ left: (idx - 1) * pages.clientWidth, behavior: 'smooth' });
  });

  window.addEventListener('resize', () => {
    pages.scrollTo({ left: idx * pages.clientWidth });
  });
}

/* ---------- установка (Android/десктоп: beforeinstallprompt, iOS: подсказка) ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  $('installBtn').classList.add('hidden');
});

function setupInstallHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) $('iosHint').classList.remove('hidden');
}

/* ---------- запуск ---------- */
function bind() {
  // дела
  $('deedList').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.toggle) toggleDeed(t.dataset.toggle);
    else if (t.dataset.del) deleteDeed(t.dataset.del);
    else if (t.dataset.catch) catchUpDeed(t.dataset.catch);
  });
  $('deedDays').addEventListener('click', (e) => {
    const b = e.target.closest('.day-btn');
    if (b) b.classList.toggle('on');
  });
  $('deedForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('deedName').value.trim();
    if (!name) return;
    const price = Math.floor(Number($('deedPrice').value)) || 10;
    const sel = [...document.querySelectorAll('#deedDays .day-btn.on')].map((b) => Number(b.dataset.d));
    if (sel.length === 0) { toast('Выбери хотя бы один день.'); return; }
    addDeed($('deedEmoji').value.trim(), name, price, sel.length === 7 ? null : sel);
    $('deedEmoji').value = '';
    $('deedName').value = '';
    $('deedPrice').value = '';
  });
  $('spontForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('spontName').value.trim();
    if (!name) return;
    addSpont(name);
    $('spontName').value = '';
  });
  $('spontList').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (t && t.dataset.spontDel) removeSpont(Number(t.dataset.spontDel));
  });

  // магазин: категории в селекте
  for (const c of CATEGORIES) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.id === 'dream' ? `${c.emoji} ${c.name} (реальные деньги)` : `${c.emoji} ${c.name} (от ${c.min} 💰)`;
    $('shopCat').appendChild(o);
  }
  $('shopCat').addEventListener('change', () => {
    $('shopPrice').placeholder = $('shopCat').value === 'dream' ? '₽ цель' : '💰';
  });

  // магазин: добавить награду / мечту
  $('shopForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('shopName').value.trim();
    const emoji = $('shopEmoji').value.trim();
    const price = Math.floor(Number($('shopPrice').value));
    const catId = $('shopCat').value;
    if (!name || !(price >= 1)) return;
    if (catId === 'dream') addDream(emoji, name, price);
    else addShopItem(emoji, name, price, catId);
    $('shopEmoji').value = '';
    $('shopName').value = '';
    $('shopPrice').value = '';
  });

  // мечты: добавить / пополнить / снять / удалить
  $('dreamForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('dreamName').value.trim();
    const target = Math.floor(Number($('dreamTarget').value));
    if (!name || !(target >= 1)) return;
    addDream($('dreamEmoji').value.trim(), name, target);
    $('dreamEmoji').value = '';
    $('dreamName').value = '';
    $('dreamTarget').value = '';
  });
  $('dreamList').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const wrap = t.closest('.dream');
    const inp = wrap ? wrap.querySelector('input[data-din]') : null;
    const amount = inp ? Math.floor(Number(inp.value)) : 0;
    if (t.dataset.dplus) depositDream(t.dataset.dplus, amount);
    else if (t.dataset.dminus) withdrawDream(t.dataset.dminus, amount);
    else if (t.dataset.ddel) deleteDream(t.dataset.ddel);
  });

  // аватар
  $('avatarImg').addEventListener('click', () => {
    popAvatar();
    toast(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  });

  // магазин (артефакты вешаются в renderShop)

  // настройки
  $('notifToggle').addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (!('Notification' in window)) { toast('Уведомления не поддерживаются.'); e.target.checked = false; return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Разрешение не выдано — уведомления не сработают.'); e.target.checked = false; state.settings.notif = false; save(); return; }
      state.settings.notif = true;
      toast('Напоминания включены.');
    } else {
      state.settings.notif = false;
    }
    save();
  });
  $('notifTime').addEventListener('change', (e) => {
    state.settings.notifTime = e.target.value || '21:00';
    save();
  });
  $('exportBtn').addEventListener('click', exportData);
  $('installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') toast('EVO установлен. Иконка уже на экране 🎉');
    } catch (err) { /* пользователь закрыл диалог */ }
    deferredPrompt = null;
    $('installBtn').classList.add('hidden');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', resetAll);

  // онбординг
  $('onboardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.avatarName = $('onboardName').value.trim() || 'Эво';
    state.onboarded = true;
    addEvent('🎉', `Игра началась. Аватар «${state.avatarName}» создан`, 'evo');
    save();
    hideOnboard();
    renderAll();
    toast('Поехали! Первое дело ждёт во вкладке «Дела».');
  });

  // день сменился, пока приложение открыто
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      processRollover();
      renderAll();
      notifyCheck();
    }
  });
}

function init() {
  load();
  processRollover();
  preloadCats();
  bind();
  setupPages();
  setupInstallHint();
  if (!state.onboarded) {
    showOnboard();
    renderAll();
  } else {
    renderAll();
  }
  save();
  notifyCheck();
  setInterval(notifyCheck, 30000);

  // service worker ( офлайн; на file:// просто пропускаем )
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
