// Траты — личный учёт расходов. Все данные хранятся локально в IndexedDB.

/* ============================== Константы ============================== */

const CUR = {
  VND: { sym: '₫', dec: 0, name: 'Донг' },
  RUB: { sym: '₽', dec: 2, name: 'Рубль' },
  USD: { sym: '$', dec: 2, name: 'Доллар' },
};
const CUR_ORDER = ['VND', 'RUB', 'USD'];
const SLOTS = 8;            // цвета категорий — фиксированная палитра, см. styles.css (--s0..--s7)
const CHART_MAX = 7;        // в диаграмме максимум 7 категорий, остальное — «Другое»
const RATE_API = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];
// [иконка, название, слот цвета]. Цвета подобраны так, чтобы у самых крупных категорий они не совпадали.
const DEFAULT_CATS = [
  ['🛒', 'Продукты', 0], ['🍜', 'Кафе и рестораны', 1], ['☕', 'Кофе', 3], ['🥡', 'Доставка', 1],
  ['🛵', 'Транспорт', 0], ['🔑', 'Аренда', 2], ['🏠', 'Дом', 6], ['📱', 'Подписки', 7],
  ['💊', 'Здоровье', 5], ['🎉', 'Развлечения', 4], ['👕', 'Одежда', 7], ['🇬🇧', 'Английский', 3],
  ['🏋️', 'Спорт', 4], ['🚬', 'Сиги', 6], ['🎁', 'Подарки', 4], ['✈️', 'Путешествия', 0], ['📦', 'Другое', 5],
];
// Первый набор категорий (до 24.11.2026). Если пользователь его ещё не трогал — заменяем на новый.
const OLD_DEFAULT_NAMES = ['Продукты', 'Кафе и рестораны', 'Кофе', 'Транспорт', 'Жильё', 'Связь и подписки', 'Здоровье', 'Развлечения', 'Одежда', 'Покупки', 'Путешествия', 'Подарки', 'Другое'];
const DEFAULT_SETTINGS = {
  inputCur: 'VND',
  viewCur: 'RUB',
  rates: { USD: 1, VND: 26300, RUB: 80 },   // единиц валюты за 1 USD; заглушка до первого обновления
  ratesDate: null,
  ratesSource: 'default',
  catsSeeded: false,
};

/* ============================== IndexedDB ============================== */

let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('trati', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('tx', { keyPath: 'id' });
      d.createObjectStore('cats', { keyPath: 'id' });
      d.createObjectStore('rec', { keyPath: 'id' });
      d.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function store(name, mode = 'readonly') { return db.transaction(name, mode).objectStore(name); }
function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
const dbAll = (s) => req(store(s).getAll());
const dbPut = (s, v) => req(store(s, 'readwrite').put(v));
const dbDel = (s, id) => req(store(s, 'readwrite').delete(id));
const kvGet = (k) => req(store('kv').get(k));
const kvSet = (k, v) => req(store('kv', 'readwrite').put(v, k));
function dbPutMany(s, items) {
  return new Promise((res, rej) => {
    const t = db.transaction(s, 'readwrite');
    const os = t.objectStore(s);
    items.forEach((i) => os.put(i));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
function dbClear(s) { return req(store(s, 'readwrite').clear()); }

/* ============================== Состояние ============================== */

const S = {
  tx: [], cats: [], rec: [],
  settings: { ...DEFAULT_SETTINGS },
  period: 'month',
  anchor: todayStr(),
  from: null, to: null,
  catFilter: null,
  txLimit: 60,
};
const catById = (id) => S.cats.find((c) => c.id === id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
async function saveSettings() { await kvSet('settings', S.settings); }

/* ============================== Даты ============================== */

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return ymd(new Date()); }
function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function addMonths(s, n, keepDay) {
  const d = parse(s);
  const day = keepDay || d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())));
  return ymd(t);
}
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

function rangeOf(period, anchor) {
  const d = parse(anchor);
  if (period === 'day') return [anchor, anchor];
  if (period === 'week') {
    const start = addDays(anchor, -((d.getDay() + 6) % 7));
    return [start, addDays(start, 6)];
  }
  if (period === 'month') {
    return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  if (period === 'year') return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
  return [S.from, S.to];
}
function currentRange() { return rangeOf(S.period, S.anchor); }
function prevRange() {
  if (S.period === 'custom') {
    const len = diffDays(S.from, S.to) + 1;
    return [addDays(S.from, -len), addDays(S.from, -1)];
  }
  const [pa, pb] = rangeOf(S.period, shiftAnchor(S.anchor, S.period, -1));
  // Текущий период ещё идёт — сравниваем с тем же числом дней прошлого периода, иначе сравнение нечестное.
  const [a, b] = currentRange(), t = todayStr();
  if (t >= a && t < b && S.period !== 'day') {
    const end = addDays(pa, diffDays(a, t));
    return [pa, end < pb ? end : pb, true];
  }
  return [pa, pb];
}
function shiftAnchor(a, p, dir) {
  if (p === 'day') return addDays(a, dir);
  if (p === 'week') return addDays(a, 7 * dir);
  if (p === 'month') return addMonths(a, dir, 1);
  if (p === 'year') return addMonths(a, 12 * dir, 1);
  return a;
}
const fmtD = (opts) => new Intl.DateTimeFormat('ru-RU', opts);
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function short(s, withYear) { return fmtD({ day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(parse(s)).replace(' г.', ''); }
function periodLabel() {
  const [a, b] = currentRange();
  const t = todayStr();
  const thisYear = a.slice(0, 4) === t.slice(0, 4) && b.slice(0, 4) === t.slice(0, 4);
  if (S.period === 'day') {
    if (a === t) return 'Сегодня';
    if (a === addDays(t, -1)) return 'Вчера';
    return fmtD({ weekday: 'short', day: 'numeric', month: 'long', ...(thisYear ? {} : { year: 'numeric' }) }).format(parse(a));
  }
  if (S.period === 'month') { const d = parse(a); return `${MONTHS[d.getMonth()]}${thisYear ? '' : ' ' + d.getFullYear()}`; }
  if (S.period === 'year') return a.slice(0, 4);
  return `${short(a, !thisYear)} – ${short(b, !thisYear)}`;
}
function prevName() {
  return { day: 'вчера', week: 'прошлой неделе', month: 'прошлому месяцу', year: 'прошлому году', custom: 'предыдущему периоду' }[S.period];
}

/* ============================== Деньги ============================== */

function rateOf(cur, rates) { return (rates && rates[cur]) || S.settings.rates[cur] || 1; }
// Перевод суммы траты в валюту отчёта: по курсу, сохранённому в момент траты (если был), иначе по текущему.
function conv(amount, from, to, rates) {
  if (from === to) return amount;
  return (amount / rateOf(from, rates)) * rateOf(to, rates);
}
function txIn(t, to) { return conv(t.amount, t.currency, to, t.fx); }
function fmt(v, cur, opts = {}) {
  const c = CUR[cur];
  const dec = opts.dec ?? (Math.abs(v) >= 1000 ? 0 : c.dec);
  const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(v);
  return `${s} ${c.sym}`;
}
function fmtShort(v, cur) {
  const a = Math.abs(v);
  const n = (x, d) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: d }).format(x);
  if (a >= 1e9) return `${n(v / 1e9, 1)} млрд ${CUR[cur].sym}`;
  if (a >= 1e6) return `${n(v / 1e6, a >= 1e8 ? 0 : 1)} млн ${CUR[cur].sym}`;
  if (a >= 1e5) return `${n(v / 1e3, 0)} тыс ${CUR[cur].sym}`;
  return fmt(v, cur);
}
function parseAmount(str) {
  if (!str) return NaN;
  let s = String(str).replace(/\s/g, '').replace(/,/g, '.').toLowerCase();
  let mult = 1;
  if (/[kк]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
  else if (/[mм]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
  // несколько точек — это разделители тысяч (1.250.000)
  if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const v = parseFloat(s) * mult;
  return Number.isFinite(v) ? v : NaN;
}
function roundCur(v, cur) { const f = 10 ** CUR[cur].dec; return Math.round(v * f) / f; }
function freshRates() {
  if (S.settings.ratesSource !== 'api' || !S.settings.ratesDate) return null;
  if (diffDays(S.settings.ratesDate, todayStr()) > 3) return null;
  return { ...S.settings.rates };
}

async function refreshRates(manual) {
  for (const url of RATE_API) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const vnd = j.usd?.vnd, rub = j.usd?.rub;
      if (!vnd || !rub) continue;
      S.settings.rates = { USD: 1, VND: vnd, RUB: rub };
      S.settings.ratesDate = j.date || todayStr();
      S.settings.ratesSource = 'api';
      await saveSettings();
      renderAll();
      if (manual) toast('Курс обновлён');
      return true;
    } catch (_) { /* пробуем следующий источник */ }
  }
  if (manual) toast('Не удалось обновить курс — нет интернета?');
  return false;
}

/* ============================== Вспомогательное UI ============================== */

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (slot) => (slot == null ? 'var(--other)' : `var(--s${slot % SLOTS})`);

let toastTimer;
function toast(text, actionLabel, action) {
  const t = $('#toast');
  $('#toast-text').textContent = text;
  const b = $('#toast-action');
  b.textContent = actionLabel || '';
  b.classList.toggle('hidden', !actionLabel);
  b.onclick = () => { t.classList.add('hidden'); action && action(); };
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), actionLabel ? 5000 : 2200);
}
function segment(container, items, value, onChange) {
  container.innerHTML = '';
  items.forEach(([v, label]) => {
    const b = el('button', v === value ? 'on' : '', esc(label));
    b.type = 'button';
    b.onclick = () => { [...container.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); onChange(v); };
    container.append(b);
  });
}
const curItems = () => CUR_ORDER.map((c) => [c, `${CUR[c].sym} ${c}`]);

let openSheetEl = null;
function openSheet(id) {
  closeSheet();
  openSheetEl = $(id);
  openSheetEl.classList.remove('hidden');
  $('#backdrop').classList.remove('hidden');
}
function closeSheet() {
  if (openSheetEl) openSheetEl.classList.add('hidden');
  openSheetEl = null;
  $('#backdrop').classList.add('hidden');
}

/* ============================== Обзор ============================== */

function txInRange([a, b]) { return S.tx.filter((t) => t.date >= a && t.date <= b && !(S.settings.hideRec && t.recId)); }
function sumBy(list, cur) {
  const m = new Map();
  let total = 0;
  for (const t of list) {
    const v = txIn(t, cur);
    total += v;
    m.set(t.categoryId, (m.get(t.categoryId) || 0) + v);
  }
  return { total, byCat: m };
}

function renderMain() {
  const cur = S.settings.viewCur;
  $('#view-cur').textContent = CUR[cur].sym;
  [...$('#period-seg').children].forEach((b) => b.classList.toggle('on', b.dataset.p === S.period));
  $('#period-label').textContent = periodLabel();
  $('#custom-range').classList.toggle('hidden', S.period !== 'custom');
  if (S.period === 'custom') { $('#range-from').value = S.from; $('#range-to').value = S.to; }
  $('#next-period').style.visibility = S.period === 'custom' ? 'hidden' : '';
  $('#prev-period').style.visibility = S.period === 'custom' ? 'hidden' : '';

  const range = currentRange();
  const list = txInRange(range);
  const pr = prevRange();
  const prev = sumBy(txInRange(pr), cur);
  const { total, byCat } = sumBy(list, cur);

  const cats = [...byCat.entries()].map(([id, v]) => ({ id, v, cat: catById(id) })).sort((a, b) => b.v - a.v);
  if (S.catFilter && !byCat.has(S.catFilter)) S.catFilter = null;

  renderDonut(cats, total, cur);

  // сравнение с прошлым периодом
  const d = $('#total-delta');
  if (prev.total > 0 && total > 0) {
    const pct = ((total - prev.total) / prev.total) * 100;
    const cls = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : '';
    d.innerHTML = `<span class="${cls}">${pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : ''}${Math.round(pct)}%</span> к ${prevName()}${pr[2] ? ` (${esc(short(pr[0]))} – ${esc(short(pr[1]))})` : ''} · было ${esc(fmt(prev.total, cur))}`;
  } else if (prev.total > 0) d.textContent = `В предыдущем периоде: ${fmt(prev.total, cur)}`;
  else d.textContent = '';

  // список категорий
  const ul = $('#cat-list');
  ul.innerHTML = '';
  if (!cats.length) ul.append(el('li', 'empty', 'Трат за этот период нет'));
  const max = cats[0]?.v || 1;
  for (const { id, v, cat } of cats) {
    const p = prev.byCat.get(id) || 0;
    let delta = '';
    if (p > 0) {
      const pct = Math.round(((v - p) / p) * 100);
      if (pct !== 0) delta = `<span class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct}%</span> · `;
    } else if (prev.total > 0) delta = '<span>новое</span> · ';
    const li = el('li', S.catFilter === id ? 'sel' : '', `
      <span class="emo">${esc(cat?.emoji || '❓')}</span>
      <span class="name">${esc(cat?.name || 'Без категории')}</span>
      <span class="amt">${esc(fmt(v, cur))}</span>
      <span class="meter"><i style="width:${(v / max) * 100}%;background:${color(cat?.color)}"></i></span>
      <span class="meta">${delta}${total ? Math.round((v / total) * 100) : 0}%</span>`);
    li.onclick = () => { S.catFilter = S.catFilter === id ? null : id; S.txLimit = 60; renderMain(); };
    ul.append(li);
  }
  $('#clear-filter').classList.toggle('hidden', !S.catFilter);
  const rt = $('#rec-toggle');
  rt.classList.toggle('hidden', !S.tx.some((t) => t.recId));
  rt.textContent = S.settings.hideRec ? '🔁 Регулярные траты скрыты — показать' : '🔁 Скрыть регулярные траты';

  renderBars(range, list, cur);
  renderTxList(list, cur);
}

function arcPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

function renderDonut(cats, total, cur) {
  const svg = $('#donut');
  const center = $('#donut-center');
  svg.innerHTML = '';
  const R1 = 98, R0 = 72, C = 100;
  if (!total) {
    svg.innerHTML = `<circle cx="100" cy="100" r="85" fill="none" stroke="var(--surface-2)" stroke-width="26"/>`;
    center.innerHTML = `<div class="lbl">Потрачено</div><div class="val">${esc(fmt(0, cur))}</div>`;
    return;
  }
  // топ-7 категорий, остальное сворачиваем в «Другое»
  let segs = cats.slice(0, CHART_MAX).map((c) => ({ ...c }));
  if (cats.length > CHART_MAX) {
    const rest = cats.slice(CHART_MAX);
    segs.push({ id: '__other', v: rest.reduce((s, c) => s + c.v, 0), cat: { name: `Ещё ${rest.length} кат.`, color: null }, ids: rest.map((c) => c.id) });
  }
  const gap = segs.length > 1 ? 2 / R1 : 0; // 2px зазор между сегментами
  let a = 0;
  const sel = S.catFilter;
  let selSeg = null;
  for (const s of segs) {
    const sweep = (s.v / total) * Math.PI * 2;
    const a0 = a + gap / 2, a1 = Math.max(a0 + 0.004, a + sweep - gap / 2);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', sweep >= Math.PI * 2 - 1e-6 ? arcPath(C, C, R0, R1, 0, Math.PI * 1.999999) : arcPath(C, C, R0, R1, a0, a1));
    path.setAttribute('fill', color(s.cat?.color));
    const isSel = sel && (s.id === sel || s.ids?.includes(sel));
    if (isSel) { path.classList.add('sel'); selSeg = s; }
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      if (s.id === '__other') { document.querySelector('#cat-list li:nth-child(' + (CHART_MAX + 1) + ')')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      S.catFilter = S.catFilter === s.id ? null : s.id; S.txLimit = 60; renderMain();
    });
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${s.cat?.name}: ${fmt(s.v, cur)}`;
    path.append(title);
    svg.append(path);
    a += sweep;
  }
  svg.classList.toggle('has-sel', !!selSeg);
  if (selSeg) {
    const v = selSeg.id === sel ? selSeg.v : cats.find((c) => c.id === sel).v;
    const c = catById(sel);
    center.innerHTML = `<div class="lbl">${esc((c?.emoji || '') + ' ' + (c?.name || ''))}</div><div class="val">${esc(fmtShort(v, cur))}</div><div class="sub">${Math.round((v / total) * 100)}% от ${esc(fmtShort(total, cur))}</div>`;
  } else {
    const other = cur === 'VND' ? 'RUB' : 'VND';
    center.innerHTML = `<div class="lbl">Потрачено</div><div class="val">${esc(fmtShort(total, cur))}</div><div class="sub">≈ ${esc(fmtShort(conv(total, cur, other), other))}</div>`;
  }
}

function renderBars([a, b], list, cur) {
  const card = $('#bars-card');
  if (S.period === 'day') { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const byMonth = S.period === 'year' || diffDays(a, b) > 92;
  const buckets = [];
  if (byMonth) {
    let d = a.slice(0, 7) + '-01';
    while (d <= b) { buckets.push({ key: d.slice(0, 7), label: MONTHS[parse(d).getMonth()].slice(0, 3), v: 0, full: `${MONTHS[parse(d).getMonth()]} ${d.slice(0, 4)}` }); d = addMonths(d, 1, 1); }
  } else {
    for (let d = a; d <= b; d = addDays(d, 1)) buckets.push({ key: d, label: String(parse(d).getDate()), v: 0, full: fmtD({ weekday: 'short', day: 'numeric', month: 'long' }).format(parse(d)) });
  }
  const idx = new Map(buckets.map((x, i) => [x.key, i]));
  const src = S.catFilter ? list.filter((t) => t.categoryId === S.catFilter) : list;
  for (const t of src) { const i = idx.get(byMonth ? t.date.slice(0, 7) : t.date); if (i != null) buckets[i].v += txIn(t, cur); }

  $('#bars-title').textContent = byMonth ? 'По месяцам' : 'По дням';
  const t = todayStr();
  const elapsed = buckets.filter((x) => (byMonth ? x.key <= t.slice(0, 7) : x.key <= t)).length || buckets.length;
  const sum = buckets.reduce((s, x) => s + x.v, 0);
  const avg = sum / elapsed;
  const info = $('#bars-info');
  const defaultInfo = sum ? `в среднем ${fmtShort(avg, cur)} ${byMonth ? 'в мес.' : 'в день'}` : '';
  info.textContent = defaultInfo;

  const W = Math.max(260, Math.round($('#bars').clientWidth || 340)), H = 150, top = 8, bottom = 18, n = buckets.length;
  const max = Math.max(...buckets.map((x) => x.v), 1);
  const slot = W / n, bw = Math.max(2, slot - 2);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Траты по ${byMonth ? 'месяцам' : 'дням'}">`;
  svg += `<line class="grid" x1="0" x2="${W}" y1="${y(max)}" y2="${y(max)}"/>`;
  buckets.forEach((x, i) => {
    const h = H - bottom - y(x.v);
    const bx = i * slot + 1;
    if (x.v > 0) {
      const r = Math.min(4, bw / 2, h);
      const yy = y(x.v), base = H - bottom;
      svg += `<path class="b-path" d="M${bx} ${base}V${yy + r}Q${bx} ${yy} ${bx + r} ${yy}H${bx + bw - r}Q${bx + bw} ${yy} ${bx + bw} ${yy + r}V${base}Z" fill="var(--bar)" data-i="${i}"/>`;
    }
    svg += `<rect class="hit" x="${i * slot}" y="0" width="${slot}" height="${H}" data-i="${i}"/>`;
    const every = n > 20 ? 5 : n > 12 ? 2 : 1;
    if (i % every === 0 || n <= 12) svg += `<text x="${bx + bw / 2}" y="${H - 4}" text-anchor="middle">${x.label}</text>`;
  });
  if (sum && avg < max) svg += `<line class="avg" x1="0" x2="${W}" y1="${y(avg)}" y2="${y(avg)}"/>`;
  svg += `<line class="axis" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/></svg>`;
  const box = $('#bars');
  box.innerHTML = svg;
  let active = null;
  box.querySelectorAll('.hit').forEach((h) => {
    const show = () => {
      const i = +h.dataset.i;
      if (active === i) { active = null; info.textContent = defaultInfo; box.querySelectorAll('.b-path').forEach((p) => p.setAttribute('fill', 'var(--bar)')); return; }
      active = i;
      info.textContent = `${buckets[i].full}: ${fmt(buckets[i].v, cur)}`;
      box.querySelectorAll('.b-path').forEach((p) => p.setAttribute('fill', +p.dataset.i === i ? 'var(--bar)' : 'var(--bar-dim)'));
    };
    h.addEventListener('click', show);
  });
}

function renderTxList(list, cur) {
  const box = $('#tx-list');
  box.innerHTML = '';
  let items = S.catFilter ? list.filter((t) => t.categoryId === S.catFilter) : list;
  items = [...items].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
  const c = S.catFilter && catById(S.catFilter);
  $('#tx-title').textContent = c ? `${c.emoji} ${c.name}` : 'Операции';
  if (!items.length) { box.append(el('div', 'empty', 'Пока пусто. Нажмите «+», чтобы добавить трату.')); return; }
  const shown = items.slice(0, S.txLimit);
  let group, groupDate;
  const dayTotals = new Map();
  for (const t of items) dayTotals.set(t.date, (dayTotals.get(t.date) || 0) + txIn(t, cur));
  for (const t of shown) {
    if (t.date !== groupDate) {
      groupDate = t.date;
      group = el('div', 'day-group');
      const label = t.date === todayStr() ? 'Сегодня' : t.date === addDays(todayStr(), -1) ? 'Вчера' : fmtD({ weekday: 'short', day: 'numeric', month: 'long' }).format(parse(t.date));
      group.append(el('div', 'day-head', `<span>${esc(label)}</span><span class="num">${esc(fmt(dayTotals.get(t.date), cur))}</span>`));
      box.append(group);
    }
    const cat = catById(t.categoryId);
    const row = el('button', 'tx-row', `
      <span class="emo">${esc(cat?.emoji || '❓')}</span>
      <span><div class="t1">${esc(t.note || cat?.name || 'Без категории')}</div><div class="t2">${esc(t.note ? cat?.name || '' : '')}${t.recId ? (t.note ? ' · ' : '') + '🔁 регулярная' : ''}</div></span>
      <span><div class="a1">${esc(fmt(t.amount, t.currency))}</div>${t.currency !== cur ? `<div class="a2">≈ ${esc(fmt(txIn(t, cur), cur))}</div>` : ''}</span>`);
    row.onclick = () => openTxSheet(t);
    group.append(row);
  }
  if (items.length > shown.length) {
    const more = el('button', 'more-btn', `Показать ещё (${items.length - shown.length})`);
    more.onclick = () => { S.txLimit += 100; renderMain(); };
    box.append(more);
  }
}

/* ============================== Ввод трат ============================== */

let txEdit = null;     // редактируемая трата или null для новой
let txState = {};

function catsByUsage() {
  const since = addDays(todayStr(), -60);
  const cnt = new Map();
  for (const t of S.tx) if (t.date >= since) cnt.set(t.categoryId, (cnt.get(t.categoryId) || 0) + 1);
  return S.cats.filter((c) => !c.archived).sort((a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0) || a.order - b.order);
}

function openTxSheet(t) {
  txEdit = t || null;
  txState = {
    currency: t?.currency || S.settings.inputCur,
    date: t?.date || (S.period === 'day' && S.anchor <= todayStr() ? S.anchor : todayStr()),
    categoryId: t?.categoryId || null,
  };
  $('#tx-amount').value = t ? String(t.amount) : '';
  $('#tx-note').value = t?.note || '';
  segment($('#tx-cur'), curItems(), txState.currency, (v) => { txState.currency = v; updateAmountHint(); });
  updateTxDate();
  $('#tx-hint').classList.toggle('hidden', !!t);
  $('#tx-edit-actions').classList.toggle('hidden', !t);
  renderTxCats();
  updateAmountHint();
  openSheet('#sheet-tx');
  if (!t) setTimeout(() => $('#tx-amount').focus(), 50);
}
function renderTxCats() {
  const grid = $('#tx-cats');
  grid.innerHTML = '';
  let cats = catsByUsage();
  if (txEdit && !cats.find((c) => c.id === txEdit.categoryId)) { const c = catById(txEdit.categoryId); if (c) cats = [c, ...cats]; }
  for (const c of cats) {
    const b = el('button', c.id === txState.categoryId && txEdit ? 'on' : '', `<span class="e">${esc(c.emoji)}</span><span class="n">${esc(c.name)}</span>`);
    b.type = 'button';
    b.onclick = () => {
      txState.categoryId = c.id;
      if (txEdit) { grid.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); }
      else saveTx();
    };
    grid.append(b);
  }
}
function updateTxDate() {
  $('#tx-date').value = txState.date;
  const t = todayStr();
  [...$('#tx-date-chips').children].forEach((b) => b.classList.toggle('on', addDays(t, +b.dataset.d) === txState.date));
}
function updateAmountHint() {
  const v = parseAmount($('#tx-amount').value);
  const h = $('#tx-amount-hint');
  if (!(v > 0)) { h.textContent = ''; return; }
  const cur = txState.currency;
  const others = CUR_ORDER.filter((c) => c !== cur && c !== 'USD').concat(cur === 'USD' ? [] : ['USD']).filter((c) => c !== cur);
  h.textContent = `${fmt(v, cur)} ≈ ` + others.map((o) => fmt(conv(v, cur, o), o)).join(' ≈ ');
}
async function saveTx() {
  const amount = parseAmount($('#tx-amount').value);
  if (!(amount > 0)) { const a = $('#tx-amount'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); a.focus(); return; }
  if (!txState.categoryId) { toast('Выберите категорию'); return; }
  const isNew = !txEdit;
  const t = txEdit ? { ...txEdit } : { id: uid(), createdAt: new Date().toISOString() };
  const changedMoney = isNew || t.amount !== amount || t.currency !== txState.currency;
  Object.assign(t, {
    amount: roundCur(amount, txState.currency),
    currency: txState.currency,
    date: txState.date,
    categoryId: txState.categoryId,
    note: $('#tx-note').value.trim(),
  });
  if (changedMoney) { const fx = freshRates(); if (fx) t.fx = fx; else delete t.fx; }
  await dbPut('tx', t);
  const i = S.tx.findIndex((x) => x.id === t.id);
  if (i >= 0) S.tx[i] = t; else S.tx.push(t);
  if (S.settings.inputCur !== t.currency) { S.settings.inputCur = t.currency; saveSettings(); }
  closeSheet();
  renderAll();
  const cat = catById(t.categoryId);
  if (isNew) toast(`${cat.emoji} ${fmt(t.amount, t.currency)} — ${cat.name}`, 'Отменить', () => deleteTx(t, true));
  else toast('Сохранено');
}
async function deleteTx(t, silent) {
  await dbDel('tx', t.id);
  S.tx = S.tx.filter((x) => x.id !== t.id);
  closeSheet();
  renderAll();
  if (!silent) toast('Трата удалена', 'Вернуть', async () => { await dbPut('tx', t); S.tx.push(t); renderAll(); });
}

/* ============================== Категории ============================== */

let catEdit = null, catColor = 0;
function renderCatManage() {
  const ul = $('#cat-manage');
  ul.innerHTML = '';
  const counts = new Map();
  for (const t of S.tx) counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1);
  const sorted = [...S.cats].sort((a, b) => (a.archived - b.archived) || a.order - b.order);
  for (const c of sorted) {
    const li = el('li', c.archived ? 'archived' : '', `
      <span class="emo">${esc(c.emoji)}</span>
      <span class="grow"><div class="t1">${esc(c.name)}</div><div class="t2">${counts.get(c.id) || 0} трат${c.archived ? ' · в архиве' : ''}</div></span>
      <span class="dot" style="background:${color(c.color)}"></span>`);
    li.onclick = () => openCatSheet(c);
    ul.append(li);
  }
}
function openCatSheet(c) {
  catEdit = c || null;
  catColor = c ? c.color : S.cats.length % SLOTS;
  $('#cat-sheet-title').textContent = c ? 'Категория' : 'Новая категория';
  $('#cat-emoji').value = c?.emoji || '🏷️';
  $('#cat-name').value = c?.name || '';
  const sw = $('#cat-colors');
  sw.innerHTML = '';
  for (let i = 0; i < SLOTS; i++) {
    const b = el('button', i === catColor ? 'on' : '');
    b.type = 'button';
    b.style.background = color(i);
    b.setAttribute('aria-label', `Цвет ${i + 1}`);
    b.onclick = () => { catColor = i; [...sw.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
    sw.append(b);
  }
  const used = c && S.tx.some((t) => t.categoryId === c.id);
  $('#cat-archive').classList.toggle('hidden', !c);
  $('#cat-archive').textContent = c?.archived ? 'Вернуть из архива' : 'В архив';
  $('#cat-delete').classList.toggle('hidden', !c || used || S.rec.some((r) => r.categoryId === c?.id));
  openSheet('#sheet-cat');
  if (!c) setTimeout(() => $('#cat-name').focus(), 50);
}
async function saveCat(archiveToggle) {
  const name = $('#cat-name').value.trim();
  if (!name) { $('#cat-name').focus(); return; }
  const c = catEdit ? { ...catEdit } : { id: uid(), order: Math.max(0, ...S.cats.map((x) => x.order)) + 1, archived: false };
  Object.assign(c, { name, emoji: $('#cat-emoji').value.trim() || '🏷️', color: catColor });
  if (archiveToggle) c.archived = !c.archived;
  await dbPut('cats', c);
  const i = S.cats.findIndex((x) => x.id === c.id);
  if (i >= 0) S.cats[i] = c; else S.cats.push(c);
  closeSheet();
  renderAll();
  if (archiveToggle) toast(c.archived ? 'Категория в архиве: старые траты сохранены' : 'Категория снова активна');
}
async function deleteCat() {
  if (!catEdit || !confirm(`Удалить категорию «${catEdit.name}»?`)) return;
  await dbDel('cats', catEdit.id);
  S.cats = S.cats.filter((c) => c.id !== catEdit.id);
  closeSheet();
  renderAll();
}

/* ============================== Регулярные траты ============================== */

function nextOccurrence(r, from) {
  const n = Math.max(1, r.every || 1);
  if (r.unit === 'week') return addDays(from, 7 * n);
  if (r.unit === 'year') return addMonths(from, 12 * n, r.day);
  return addMonths(from, n, r.day);
}
// Создаёт траты для всех наступивших дат регулярных платежей.
async function runRecurring() {
  const today = todayStr();
  const created = [];
  for (const r of S.rec) {
    if (!r.active) continue;
    let guard = 0;
    while (r.next <= today && guard++ < 500) {
      const t = {
        id: uid(), createdAt: new Date().toISOString(), amount: r.amount, currency: r.currency,
        date: r.next, categoryId: r.categoryId, note: r.name, recId: r.id,
      };
      const fx = freshRates(); if (fx && r.next === today) t.fx = fx;
      created.push(t);
      r.next = nextOccurrence(r, r.next);
    }
    if (guard) await dbPut('rec', r);
  }
  if (created.length) {
    await dbPutMany('tx', created);
    S.tx.push(...created);
    toast(`Добавлено регулярных трат: ${created.length}`);
  }
  return created.length;
}
function recMonthly(r) {
  const per = r.unit === 'week' ? 52 / 12 : r.unit === 'year' ? 1 / 12 : 1;
  return (conv(r.amount, r.currency, S.settings.viewCur) * per) / Math.max(1, r.every || 1);
}
function unitText(r) {
  const n = Math.max(1, r.every || 1);
  const u = { month: ['месяц', 'мес.'], week: ['неделю', 'нед.'], year: ['год', 'г.'] }[r.unit];
  return n === 1 ? `каждый ${u[0]}`.replace('каждый неделю', 'каждую неделю') : `каждые ${n} ${u[1]}`;
}
function renderRecList() {
  const ul = $('#rec-list');
  ul.innerHTML = '';
  if (!S.rec.length) { ul.append(el('li', 'muted small', 'Например: аренда, интернет, спортзал, подписки.')); return; }
  const cur = S.settings.viewCur;
  let monthly = 0;
  const sorted = [...S.rec].sort((a, b) => (b.active - a.active) || a.next.localeCompare(b.next));
  for (const r of sorted) {
    const c = catById(r.categoryId);
    if (r.active) monthly += recMonthly(r);
    const li = el('li', r.active ? '' : 'archived', `
      <span class="emo">${esc(c?.emoji || '🔁')}</span>
      <span class="grow"><div class="t1">${esc(r.name)}</div><div class="t2">${esc(unitText(r))} · ${r.active ? 'след. ' + esc(short(r.next, r.next.slice(0, 4) !== todayStr().slice(0, 4))) : 'на паузе'}</div></span>
      <span class="right">${esc(fmt(r.amount, r.currency))}</span>`);
    li.onclick = () => openRecSheet(r);
    ul.append(li);
  }
  ul.append(el('li', 'tot', `<span class="grow">≈ в месяц</span><span class="right">${esc(fmt(monthly, cur))}</span>`));
}
let recEdit = null, recCur = 'VND';
function openRecSheet(r) {
  recEdit = r || null;
  recCur = r?.currency || S.settings.inputCur;
  $('#rec-sheet-title').textContent = r ? 'Регулярная трата' : 'Новая регулярная трата';
  $('#rec-name').value = r?.name || '';
  $('#rec-amount').value = r ? String(r.amount) : '';
  segment($('#rec-cur'), curItems(), recCur, (v) => { recCur = v; });
  const sel = $('#rec-cat');
  sel.innerHTML = '';
  for (const c of S.cats.filter((c) => !c.archived || c.id === r?.categoryId)) sel.append(new Option(`${c.emoji} ${c.name}`, c.id));
  sel.value = r?.categoryId || (S.cats.find((c) => c.name === 'Жильё') || S.cats[0])?.id;
  $('#rec-every').value = r?.every || 1;
  $('#rec-unit').value = r?.unit || 'month';
  $('#rec-next').value = r?.next || todayStr();
  $('#rec-active').checked = r ? r.active : true;
  $('#rec-delete').classList.toggle('hidden', !r);
  openSheet('#sheet-rec');
}
async function saveRec() {
  const name = $('#rec-name').value.trim();
  const amount = parseAmount($('#rec-amount').value);
  if (!name) { $('#rec-name').focus(); return; }
  if (!(amount > 0)) { $('#rec-amount').focus(); return; }
  const next = $('#rec-next').value || todayStr();
  const r = recEdit ? { ...recEdit } : { id: uid() };
  Object.assign(r, {
    name, amount: roundCur(amount, recCur), currency: recCur, categoryId: $('#rec-cat').value,
    every: Math.max(1, parseInt($('#rec-every').value, 10) || 1), unit: $('#rec-unit').value,
    next, day: parse(next).getDate(), active: $('#rec-active').checked,
  });
  await dbPut('rec', r);
  const i = S.rec.findIndex((x) => x.id === r.id);
  if (i >= 0) S.rec[i] = r; else S.rec.push(r);
  closeSheet();
  const n = await runRecurring();
  renderAll();
  if (!n) toast(r.next === todayStr() ? 'Сохранено' : `Следующее списание: ${short(r.next, true)}`);
}
async function deleteRec() {
  if (!recEdit || !confirm(`Удалить регулярную трату «${recEdit.name}»? Уже добавленные траты останутся.`)) return;
  await dbDel('rec', recEdit.id);
  S.rec = S.rec.filter((r) => r.id !== recEdit.id);
  closeSheet();
  renderAll();
}

/* ============================== Конвертер и курс ============================== */

let convCur = 'VND';
function renderConv() {
  segment($('#conv-cur'), curItems(), convCur, (v) => { convCur = v; renderConv(); });
  const v = parseAmount($('#conv-amount').value) || 0;
  const out = $('#conv-out');
  out.innerHTML = '';
  for (const c of CUR_ORDER.filter((c) => c !== convCur)) {
    out.append(el('div', '', `<span class="muted">${CUR[c].name}</span><b>${esc(fmt(conv(v, convCur, c), c, { dec: CUR[c].dec }))}</b>`));
  }
  const r = S.settings.rates;
  $('#conv-rates').textContent = `1 ₽ = ${fmt(r.VND / r.RUB, 'VND')} · 1 $ = ${fmt(r.VND, 'VND')} · ${ratesStatus()}`;
  const table = $('#conv-cheat');
  const steps = [10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000];
  table.innerHTML = steps.map((s) => `<tr><td>${esc(fmt(s, 'VND'))}</td><td>${esc(fmt(conv(s, 'VND', 'RUB'), 'RUB', { dec: 0 }))}</td><td>${esc(fmt(conv(s, 'VND', 'USD'), 'USD', { dec: s < 100000 ? 2 : 0 }))}</td></tr>`).join('');
}
function ratesStatus() {
  if (S.settings.ratesSource === 'api') return `курс от ${short(S.settings.ratesDate, true)}`;
  if (S.settings.ratesSource === 'manual') return 'курс задан вручную';
  return 'курс приблизительный — обновите';
}
function renderSettings() {
  segment($('#default-cur'), curItems(), S.settings.inputCur, async (v) => { S.settings.inputCur = v; await saveSettings(); });
  const r = S.settings.rates;
  if (document.activeElement !== $('#rate-vnd')) $('#rate-vnd').value = round(r.VND, 2);
  if (document.activeElement !== $('#rate-rub')) $('#rate-rub').value = round(r.RUB, 4);
  $('#rates-info').textContent = `1 000 000 ₫ ≈ ${fmt(conv(1e6, 'VND', 'RUB'), 'RUB', { dec: 0 })} · ${ratesStatus()}. Обновляется автоматически раз в день.`;
}
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
async function setManualRate(cur, input) {
  const v = parseAmount(input.value);
  if (!(v > 0)) { renderSettings(); return; }
  S.settings.rates = { ...S.settings.rates, [cur]: v };
  S.settings.ratesSource = 'manual';
  S.settings.ratesDate = todayStr();
  await saveSettings();
  renderAll();
}

/* ============================== Экспорт / резервная копия ============================== */

function csvCell(v) { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function buildCsv(list) {
  const head = ['date', 'weekday', 'amount', 'currency', 'amount_vnd', 'amount_rub', 'amount_usd', 'category', 'note', 'recurring'];
  const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const rows = [...list].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
    const c = catById(t.categoryId);
    return [t.date, wd[parse(t.date).getDay()], t.amount, t.currency,
      Math.round(txIn(t, 'VND')), round(txIn(t, 'RUB'), 2), round(txIn(t, 'USD'), 2),
      c?.name || '', t.note || '', t.recId ? 'yes' : ''].map(csvCell).join(',');
  });
  return '﻿' + [head.join(','), ...rows].join('\n');
}
async function shareFile(name, text, mime) {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportRange(a, b) {
  const list = S.tx.filter((t) => (!a || t.date >= a) && (!b || t.date <= b));
  if (!list.length) { toast('За этот период трат нет'); return; }
  const first = a || list.reduce((m, t) => (t.date < m ? t.date : m), '9999');
  const last = b || list.reduce((m, t) => (t.date > m ? t.date : m), '0000');
  shareFile(`traty_${first}_${last}.csv`, buildCsv(list), 'text/csv');
}
async function backup() {
  const data = { app: 'trati', version: 1, exportedAt: new Date().toISOString(), settings: S.settings, categories: S.cats, recurring: S.rec, transactions: S.tx };
  await shareFile(`traty_backup_${todayStr()}.json`, JSON.stringify(data), 'application/json');
  S.settings.lastBackup = todayStr();
  await saveSettings();
  renderStorageInfo();
}
async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'trati' || !Array.isArray(data.transactions)) throw new Error('format');
    if (!confirm(`Заменить текущие данные копией от ${short(data.exportedAt.slice(0, 10), true)}? Трат в копии: ${data.transactions.length}.`)) return;
    for (const s of ['tx', 'cats', 'rec']) await dbClear(s);
    await dbPutMany('cats', data.categories || []);
    await dbPutMany('rec', data.recurring || []);
    await dbPutMany('tx', data.transactions);
    S.settings = { ...DEFAULT_SETTINGS, ...data.settings, catsSeeded: true };
    await saveSettings();
    await loadAll();
    renderAll();
    toast('Данные восстановлены');
  } catch (e) {
    toast('Это не резервная копия этого приложения');
  }
}
async function renderStorageInfo() {
  const parts = [`Трат: ${S.tx.length}`];
  if (S.settings.lastBackup) parts.push(`последняя копия ${short(S.settings.lastBackup, true)}`);
  else if (S.tx.length) parts.push('копий ещё не было');
  try { if (navigator.storage?.persisted && (await navigator.storage.persisted())) parts.push('хранилище защищено от очистки'); } catch (_) {}
  $('#storage-info').textContent = parts.join(' · ');
}

/* ============================== Импорт из Money Manager ============================== */

let pendingImport = null;
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res(window.XLSX);
    s.onerror = () => rej(new Error('Не удалось загрузить модуль Excel — нужен интернет'));
    document.head.append(s);
  });
}
// Поддерживаются выгрузки двух разных «Money Manager»:
//  - Realbyte: Period | Category | Subcategory | Note | VND | Income/Expense | Description | Amount | Currency
//  - «Money Manager: expense tracker»: Date and time | Category | Account | Amount in default currency |
//    Default currency | ... | Transaction amount in transaction currency | Transaction currency | Tags | Comment
const H = {
  date: /^(period|date|дата|период|время|date\/time|date and time|дата и время)$/i,
  category: /^(category|категория)$/i,
  sub: /^(subcategory|подкатегория)$/i,
  note: /^(note|заметка|примечание|memo|контент|содержание|comment|комментарий)$/i,
  desc: /^(description|описание)$/i,
  tags: /^(tags|теги|метки)$/i,
  type: /^(income\/expense|доход\/расход|доходы\/расходы|type|тип)$/i,
  amount: /^(amount|сумма|transaction amount in transaction currency|сумма в валюте операции)$/i,
  currency: /^(currency|валюта|transaction currency|валюта операции)$/i,
  defAmount: /^(amount in default currency|сумма в основной валюте)$/i,
  defCurrency: /^(default currency|основная валюта)$/i,
};
function findCols(header) {
  const cols = {};
  header.forEach((h, i) => {
    const s = String(h ?? '').trim();
    for (const [k, re] of Object.entries(H)) if (cols[k] == null && re.test(s)) cols[k] = i;
    if (cols.mainAmount == null && /^[A-Z]{3}$/.test(s) && s !== 'ID') cols.mainAmount = i; // колонка «VND»/«USD» — сумма в основной валюте
  });
  return cols;
}
// Названия категорий из старого приложения → категории «Трат».
const CAT_ALIASES = {
  groceries: 'Продукты', food: 'Продукты', cafe: 'Кафе и рестораны', restaurants: 'Кафе и рестораны', 'eating out': 'Кафе и рестораны',
  coffee: 'Кофе', transportation: 'Транспорт', transport: 'Транспорт', taxi: 'Транспорт', home: 'Дом', household: 'Дом',
  rent: 'Аренда', health: 'Здоровье', leisure: 'Развлечения', entertainment: 'Развлечения', clothes: 'Одежда', clothing: 'Одежда',
  gifts: 'Подарки', gift: 'Подарки', workout: 'Спорт', sport: 'Спорт', sports: 'Спорт', fitness: 'Спорт', travel: 'Путешествия',
  subscriptions: 'Подписки', education: 'Образование', delivery: 'Доставка', other: 'Другое', others: 'Другое',
  'связь и подписки': 'Подписки', 'жильё': 'Аренда', 'жилье': 'Аренда',
};
function mapCatName(name) {
  const n = String(name || '').trim();
  if (!n) return 'Другое';
  // точное совпадение с существующей категорией важнее псевдонима
  if (S.cats.some((c) => c.name.toLowerCase() === n.toLowerCase())) return S.cats.find((c) => c.name.toLowerCase() === n.toLowerCase()).name;
  return CAT_ALIASES[n.toLowerCase()] || n;
}
function toYmd(v) {
  if (v instanceof Date && !isNaN(v)) return ymd(v);
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
async function importMM(file) {
  try {
    const XLSX = await loadSheetJS();
    // даты читаем как числа Excel и переводим сами: так не бывает сдвига на день из-за часового пояса
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames.find((n) => /expense|расход/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const hi = rows.findIndex((r) => { const c = findCols(r); return c.date != null && c.category != null && (c.amount != null || c.mainAmount != null || c.defAmount != null); });
    if (hi < 0) throw new Error('Не нашёл колонки «дата», «категория», «сумма»');
    const cols = findCols(rows[hi]);
    const items = [];
    let skippedIncome = 0, bad = 0;
    for (const r of rows.slice(hi + 1)) {
      if (r.every((x) => x === '' || x == null)) continue;
      const type = cols.type != null ? String(r[cols.type]).toLowerCase() : 'exp';
      if (!/exp|расх|^-/.test(type)) { skippedIncome++; continue; }
      const date = toYmd(r[cols.date]);
      let amount = Math.abs(parseAmount(r[cols.amount ?? cols.mainAmount]));
      let currency = cols.currency != null ? String(r[cols.currency]).trim().toUpperCase() : '';
      if ((!(amount > 0) || !CUR[currency]) && cols.defAmount != null) {
        // сумма в валюте операции не заполнена — берём сумму в основной валюте
        amount = Math.abs(parseAmount(r[cols.defAmount]));
        currency = cols.defCurrency != null ? String(r[cols.defCurrency]).trim().toUpperCase() : '';
      }
      if (!CUR[currency]) {
        // нет валюты или она незнакомая — берём сумму в основной валюте файла
        const main = cols.mainAmount != null ? String(rows[hi][cols.mainAmount]).trim().toUpperCase() : '';
        if (cols.mainAmount != null && CUR[main]) { amount = Math.abs(parseAmount(r[cols.mainAmount])); currency = main; }
        else currency = S.settings.inputCur;
      }
      if (!date || !(amount > 0)) { bad++; continue; }
      const sub = cols.sub != null ? String(r[cols.sub]).trim() : '';
      const note = [cols.note, cols.desc, cols.tags].map((c) => (c != null ? String(r[c]).trim() : '')).filter(Boolean).join(' — ');
      const srcCat = String(r[cols.category]).trim();
      items.push({ date, amount: roundCur(amount, currency), currency, srcCat, catName: mapCatName(srcCat), note: [sub, note].filter(Boolean).join(': ') });
    }
    if (!items.length) throw new Error('В файле не нашлось расходов');
    // дубликаты: такие же дата+сумма+категория+заметка уже есть
    const key = (d, a, c, n) => `${d}|${a}|${c}|${n}`;
    const existing = new Set(S.tx.map((t) => key(t.date, t.amount, (catById(t.categoryId)?.name || '').toLowerCase(), t.note || '')));
    const fresh = items.filter((i) => !existing.has(key(i.date, i.amount, i.catName.toLowerCase(), i.note)));
    const catNames = [...new Set(fresh.map((i) => i.catName))];
    const newCats = catNames.filter((n) => !S.cats.find((c) => c.name.toLowerCase() === n.toLowerCase()));
    const dates = fresh.map((i) => i.date).sort();
    pendingImport = { items: fresh, newCats };
    const byCur = {};
    fresh.forEach((i) => { byCur[i.currency] = (byCur[i.currency] || 0) + 1; });
    $('#import-preview').innerHTML = `
      <p>Найдено расходов: <b>${items.length}</b>${items.length !== fresh.length ? `, из них новых: <b>${fresh.length}</b> (остальные уже есть)` : ''}.</p>
      ${fresh.length ? `<p>Период: ${esc(short(dates[0], true))} – ${esc(short(dates[dates.length - 1], true))}. Валюты: ${esc(Object.entries(byCur).map(([c, n]) => `${c} (${n})`).join(', '))}.</p>` : ''}
      ${catMapHtml(fresh, newCats)}
      ${skippedIncome ? `<p class="muted small">Пропущено доходов и переводов: ${skippedIncome}.</p>` : ''}
      ${bad ? `<p class="warn small">Не удалось разобрать строк: ${bad}.</p>` : ''}
      <table>${fresh.slice(0, 5).map((i) => `<tr><td>${esc(i.date)}</td><td>${esc(i.catName)}</td><td>${esc(i.note)}</td><td style="text-align:right">${esc(fmt(i.amount, i.currency))}</td></tr>`).join('')}</table>`;
    $('#import-ok').disabled = !fresh.length;
    openSheet('#sheet-import');
  } catch (e) {
    toast(e.message || 'Не удалось прочитать файл');
  }
}
// Таблица «категория в файле → категория здесь», чтобы перед импортом было видно, куда что попадёт.
function catMapHtml(items, newCats) {
  const m = new Map();
  for (const i of items) { const k = `${i.srcCat}→${i.catName}`; const e = m.get(k) || { src: i.srcCat, dst: i.catName, n: 0 }; e.n++; m.set(k, e); }
  const rows = [...m.values()].sort((a, b) => b.n - a.n).map((e) => {
    const isNew = newCats.includes(e.dst);
    const c = S.cats.find((x) => x.name === e.dst);
    return `<tr><td>${esc(e.src || '—')}</td><td>→ ${esc((c?.emoji || guessEmoji(e.dst)) + ' ' + e.dst)}${isNew ? ' <span class="muted">(новая)</span>' : ''}</td><td style="text-align:right">${e.n}</td></tr>`;
  });
  return `<p class="small">Категории:</p><table>${rows.join('')}</table><p></p>`;
}
async function confirmImport() {
  if (!pendingImport) return;
  const { items, newCats } = pendingImport;
  let order = Math.max(0, ...S.cats.map((c) => c.order));
  for (const name of newCats) {
    const c = { id: uid(), name, emoji: guessEmoji(name), color: S.cats.length % SLOTS, order: ++order, archived: false };
    S.cats.push(c);
    await dbPut('cats', c);
  }
  const byName = new Map(S.cats.map((c) => [c.name.toLowerCase(), c.id]));
  const now = new Date().toISOString();
  const txs = items.map((i) => ({ id: uid(), createdAt: now, date: i.date, amount: i.amount, currency: i.currency, categoryId: byName.get(i.catName.toLowerCase()), note: i.note, source: 'moneymanager' }));
  await dbPutMany('tx', txs);
  S.tx.push(...txs);
  pendingImport = null;
  closeSheet();
  renderAll();
  toast(`Импортировано трат: ${txs.length}`);
}
function guessEmoji(name) {
  const n = name.toLowerCase();
  const map = [
    [/food|еда|продукт|grocer|супермаркет/, '🛒'], [/cafe|кафе|ресторан|restaurant|eat|обед|ужин/, '🍜'], [/coffee|кофе/, '☕'],
    [/delivery|доставк/, '🥡'], [/сиг|cigar|smok|курен/, '🚬'], [/англ|english|язык|language/, '🇬🇧'],
    [/transport|транспорт|taxi|такси|grab|bike|байк|бензин|fuel/, '🛵'], [/rent|аренд|квартир/, '🔑'], [/жиль|house|home|дом/, '🏠'],
    [/phone|связь|интернет|подпис|subscr/, '📱'], [/health|здоров|аптек|врач|medic/, '💊'], [/fun|развлеч|entertain|кино|бар|party/, '🎉'],
    [/cloth|одежд/, '👕'], [/shop|покуп/, '🛍️'], [/travel|путеш|отпуск|trip|отел|hotel/, '✈️'], [/gift|подар/, '🎁'],
    [/beauty|красот|салон/, '💅'], [/sport|спорт|gym|зал/, '🏋️'], [/educat|образов|курс|книг|book/, '📚'], [/pet|питом|кот|собак/, '🐾'],
  ];
  return (map.find(([re]) => re.test(n)) || [null, '🏷️'])[1];
}

/* ============================== Общее ============================== */

function renderAll() {
  renderMain();
  renderConv();
  renderSettings();
  renderCatManage();
  renderRecList();
  renderStorageInfo();
}
async function loadAll() {
  [S.tx, S.cats, S.rec] = await Promise.all([dbAll('tx'), dbAll('cats'), dbAll('rec')]);
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);
  if (name === 'main') renderMain();
}

function bind() {
  $('#period-seg').addEventListener('click', (e) => {
    const p = e.target.closest('button')?.dataset.p;
    if (!p) return;
    if (p === 'custom' && !S.from) { const [a, b] = currentRange(); S.from = a; S.to = b > todayStr() ? todayStr() : b; }
    S.period = p; S.txLimit = 60;
    renderMain();
  });
  $('#prev-period').onclick = () => { S.anchor = shiftAnchor(S.anchor, S.period, -1); renderMain(); };
  $('#next-period').onclick = () => { S.anchor = shiftAnchor(S.anchor, S.period, 1); renderMain(); };
  $('#period-label').onclick = () => { S.anchor = todayStr(); renderMain(); };
  $('#range-from').onchange = (e) => { if (e.target.value) { S.from = e.target.value; if (S.to < S.from) S.to = S.from; renderMain(); } };
  $('#range-to').onchange = (e) => { if (e.target.value) { S.to = e.target.value; if (S.from > S.to) S.from = S.to; renderMain(); } };
  $('#view-cur').onclick = async () => {
    S.settings.viewCur = CUR_ORDER[(CUR_ORDER.indexOf(S.settings.viewCur) + 1) % CUR_ORDER.length];
    await saveSettings(); renderMain();
  };
  $('#clear-filter').onclick = () => { S.catFilter = null; renderMain(); };
  $('#rec-toggle').onclick = async () => { S.settings.hideRec = !S.settings.hideRec; await saveSettings(); renderMain(); };
  $('#donut').addEventListener('click', () => { if (S.catFilter) { S.catFilter = null; renderMain(); } });

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderMain, 150); });
  $('#fab').onclick = () => openTxSheet(null);
  $('#backdrop').onclick = closeSheet;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

  // шторка траты
  $('#tx-amount').addEventListener('input', updateAmountHint);
  $('#tx-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#tx-amount').blur(); } });
  $('#tx-000').onclick = () => { const a = $('#tx-amount'); a.value = (a.value || '') + '000'; updateAmountHint(); };
  $('#tx-date-chips').addEventListener('click', (e) => { const d = e.target.closest('button')?.dataset.d; if (d != null) { txState.date = addDays(todayStr(), +d); updateTxDate(); } });
  $('#tx-date').onchange = (e) => { if (e.target.value) { txState.date = e.target.value; updateTxDate(); } };
  $('#tx-save').onclick = saveTx;
  $('#tx-delete').onclick = () => txEdit && deleteTx(txEdit);

  // категории
  $('#add-cat').onclick = () => openCatSheet(null);
  $('#cat-save').onclick = () => saveCat(false);
  $('#cat-archive').onclick = () => saveCat(true);
  $('#cat-delete').onclick = deleteCat;

  // регулярные
  $('#add-rec').onclick = () => openRecSheet(null);
  $('#rec-save').onclick = saveRec;
  $('#rec-delete').onclick = deleteRec;
  $('#rec-000').onclick = () => { const a = $('#rec-amount'); a.value = (a.value || '') + '000'; };

  // конвертер и курс
  $('#conv-amount').addEventListener('input', renderConv);
  $('#refresh-rates').onclick = () => refreshRates(true);
  $('#rate-vnd').onchange = (e) => setManualRate('VND', e.target);
  $('#rate-rub').onchange = (e) => setManualRate('RUB', e.target);

  // экспорт / импорт
  $('#exp-14').onclick = () => exportRange(addDays(todayStr(), -13), todayStr());
  $('#exp-period').onclick = () => { const [a, b] = currentRange(); exportRange(a, b); };
  $('#exp-all').onclick = () => exportRange(null, null);
  $('#backup').onclick = backup;
  $('#restore').onclick = () => $('#file-restore').click();
  $('#file-restore').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); };
  $('#import-mm').onclick = () => $('#file-mm').click();
  $('#file-mm').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importMM(f); };
  $('#import-ok').onclick = confirmImport;
  $('#import-cancel').onclick = () => { pendingImport = null; closeSheet(); };
  $('#wipe').onclick = async () => {
    if (!confirm('Удалить все траты, категории и регулярные платежи? Это нельзя отменить.')) return;
    if (!confirm('Точно? Сначала лучше сохранить резервную копию.')) return;
    for (const s of ['tx', 'cats', 'rec', 'kv']) await dbClear(s);
    location.reload();
  };

  // при возвращении в приложение — новый день, регулярные траты, курс
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (await runRecurring()) renderAll();
    if (S.settings.ratesSource !== 'manual' && S.settings.ratesDate !== todayStr()) refreshRates(false);
  });
}

async function seedCategories() {
  const cats = DEFAULT_CATS.map(([emoji, name, color], i) => ({ id: uid(), emoji, name, color, order: i, archived: false }));
  await dbPutMany('cats', cats);
  S.settings.catsSeeded = true;
  S.settings.catsVersion = 2;
  await saveSettings();
}
// Набор категорий v2. Старый набор заменяется, только если трат ещё нет и категории никто не менял.
async function migrateCategories() {
  if (S.settings.catsVersion >= 2) return;
  const untouched = !S.tx.length && !S.rec.length && S.cats.length === OLD_DEFAULT_NAMES.length && S.cats.every((c) => OLD_DEFAULT_NAMES.includes(c.name) && !c.archived);
  if (untouched) {
    await dbClear('cats');
    await seedCategories();
    S.cats = await dbAll('cats');
  } else {
    S.settings.catsVersion = 2;
    await saveSettings();
  }
}

async function init() {
  db = await openDB();
  S.settings = { ...DEFAULT_SETTINGS, ...((await kvGet('settings')) || {}) };
  if (!S.settings.catsSeeded) await seedCategories();
  await loadAll();
  await migrateCategories();
  bind();
  await runRecurring();
  renderAll();
  if (S.settings.ratesSource !== 'manual' && S.settings.ratesDate !== todayStr()) refreshRates(false);
  try { navigator.storage?.persist?.(); } catch (_) {}
  // офлайн-кэш нужен только на телефоне; при локальной разработке он мешал бы видеть изменения
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
