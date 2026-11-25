// Expenses / Траты — личный учёт расходов. Все данные хранятся локально в IndexedDB.

/* ============================== Константы ============================== */

const CUR = {
  VND: { sym: '₫', dec: 0 },
  RUB: { sym: '₽', dec: 2 },
  USD: { sym: '$', dec: 2 },
};
const CUR_ORDER = ['VND', 'RUB', 'USD'];
const SLOTS = 8;            // цвета категорий — фиксированная палитра, см. styles.css (--s0..--s7)
const CHART_MAX = 7;        // в диаграмме максимум 7 категорий, остальное — «ещё N»
const RATE_API = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];
// Стандартные категории: [ключ, иконка, слот цвета]. Название берётся из словаря (cat_<ключ>),
// пока пользователь его не переименовал, — поэтому оно меняется вместе с языком.
const DEFAULT_CATS = [
  ['groceries', '🛒', 0], ['cafe', '🍜', 1], ['coffee', '☕', 3], ['delivery', '🥡', 1],
  ['transport', '🛵', 0], ['rent', '🔑', 2], ['home', '🏠', 6], ['subscriptions', '📱', 7],
  ['health', '💊', 5], ['leisure', '🎉', 4], ['clothes', '👕', 7], ['english', '🇬🇧', 3],
  ['sport', '🏋️', 4], ['cigarettes', '🚬', 6], ['gifts', '🎁', 4], ['travel', '✈️', 0], ['other', '📦', 5],
];
const EXTRA_KEYS = { shopping: ['🛍️', 2] };  // встречается в старых установках
// Самый первый набор (до 24.11.2026): если его никто не трогал — заменяем целиком.
const OLD_DEFAULT_NAMES = ['Продукты', 'Кафе и рестораны', 'Кофе', 'Транспорт', 'Жильё', 'Связь и подписки', 'Здоровье', 'Развлечения', 'Одежда', 'Покупки', 'Путешествия', 'Подарки', 'Другое'];
// Названия из других приложений и старых версий → ключ категории.
const CAT_ALIASES = {
  groceries: 'groceries', food: 'groceries', продукты: 'groceries', cafe: 'cafe', restaurants: 'cafe', 'eating out': 'cafe',
  'кафе и рестораны': 'cafe', кафе: 'cafe', coffee: 'coffee', кофе: 'coffee', delivery: 'delivery', доставка: 'delivery',
  transportation: 'transport', transport: 'transport', taxi: 'transport', транспорт: 'transport',
  rent: 'rent', аренда: 'rent', 'жильё': 'rent', 'жилье': 'rent', home: 'home', household: 'home', дом: 'home',
  subscriptions: 'subscriptions', подписки: 'subscriptions', 'связь и подписки': 'subscriptions',
  health: 'health', здоровье: 'health', leisure: 'leisure', entertainment: 'leisure', развлечения: 'leisure',
  clothes: 'clothes', clothing: 'clothes', одежда: 'clothes', english: 'english', английский: 'english',
  workout: 'sport', sport: 'sport', sports: 'sport', fitness: 'sport', спорт: 'sport',
  сиги: 'cigarettes', cigarettes: 'cigarettes', сигареты: 'cigarettes', gifts: 'gifts', gift: 'gifts', подарки: 'gifts',
  travel: 'travel', путешествия: 'travel', other: 'other', others: 'other', другое: 'other', shopping: 'shopping', покупки: 'shopping',
};
const DEFAULT_SETTINGS = {
  lang: 'en',
  inputCur: 'VND',
  viewCur: 'RUB',
  rates: { USD: 1, VND: 26300, RUB: 80 },   // единиц валюты за 1 USD; заглушка до первого обновления
  ratesDate: null,
  ratesSource: 'default',
  catsSeeded: false,
};

/* ============================== Словарь ============================== */

const T = {
  en: {
    app_name: 'Expenses', period: 'Period', p_day: 'Day', p_week: 'Week', p_month: 'Month', p_year: 'Year', p_custom: 'Range',
    prev_period: 'Previous period', next_period: 'Next period', report_currency: 'Report currency', from: 'From', to: 'To',
    due_title: 'Time to pay', by_category: 'By category', clear_filter: 'Clear filter', converter: 'Converter',
    cheat_sheet: 'Cheat sheet', more: 'More', overview: 'Overview', language: 'Language', recurring: 'Recurring', add: '+ Add',
    recurring_hint: 'Fixed amounts are added automatically on their day. For amounts that change (rent with utilities) the app reminds you and you enter the amount.',
    rec_find: 'Find recurring in history', categories: 'Categories', currencies: 'Currencies and rates',
    default_input_cur: 'Default input currency', refresh_rates: 'Update rates', export_title: 'Export for analysis',
    export_hint: 'CSV with all expenses for the period. Send it to your Mac (AirDrop or Telegram) and put it into the exports folder.',
    exp_14: 'Last 14 days', exp_period: 'Period selected on Overview', exp_all: 'All expenses',
    backup_title: 'Backup and import', backup_hint: 'Data is stored only on this device. Make a backup at least once a month.',
    backup_save: 'Save backup (JSON)', backup_restore: 'Restore from backup', import_mm: 'Import from Money Manager (Excel/CSV)',
    wipe: 'Delete all data', add_expense: 'Add expense', amount: 'Amount', today: 'Today', yesterday: 'Yesterday', date: 'Date',
    note_ph: 'Comment (optional)', tap_category: 'Pick a category, then Save', close: 'Close', delete: 'Delete', save: 'Save', icon: 'Icon',
    name: 'Name', cat_delete: 'Delete category', rec_name_ph: 'Name (e.g. Rent)',
    rec_variable: 'Amount changes — remind me instead of adding', category: 'Category', every: 'Every', interval: 'Interval',
    unit_month: 'month(s)', unit_week: 'week(s)', unit_year: 'year(s)', rec_next: 'Next payment', active: 'Active',
    rec_found: 'Recurring payments found', rec_found_hint: 'Tick the ones that are still active. Amount and day can be changed later.',
    cancel: 'Cancel', add_selected: 'Add selected', import_title: 'Import from Money Manager', import: 'Import',
    spent: 'Spent', of_total: '{p}% of {t}', more_cats: '{n} more',
    vs_day: 'vs yesterday', vs_week: 'vs last week', vs_month: 'vs last month', vs_year: 'vs last year', vs_custom: 'vs previous period',
    was: 'was {v}', prev_total: 'Previous period: {v}', no_expenses_period: 'No expenses in this period', new_cat: 'new',
    no_category: 'No category', rec_hide: '🔁 Hide recurring', rec_show: '🔁 Recurring hidden — show',
    by_days: 'By day', by_weeks: 'By week', by_months: 'By month', by_years: 'By year',
    avg_day: 'avg {v} per day', avg_week: 'avg {v} per week', avg_month: 'avg {v} per month', avg_year: 'avg {v} per year',
    transactions: 'Transactions', empty_tx: 'Nothing yet. Tap “+” to add an expense.', show_more: 'Show more ({n})', fold_open: 'Show all · {n}', fold_close: 'Collapse',
    recurring_tag: '🔁 recurring', choose_cat: 'Choose a category', undo: 'Undo', restore_btn: 'Restore', saved: 'Saved',
    deleted: 'Expense deleted', expenses_n: ['{n} expense', '{n} expenses'], archived: 'archived', cat_new: 'New category',
    cat_title: 'Category', archive: 'Archive', unarchive: 'Unarchive', cat_archived: 'Category archived — old expenses are kept',
    cat_unarchived: 'Category is active again', confirm_cat_delete: 'Delete category “{n}”?',
    rec_added: ['{n} recurring expense added', '{n} recurring expenses added'],
    every_month: 'every month', every_week: 'every week', every_year: 'every year',
    every_n_month: 'every {n} months', every_n_week: 'every {n} weeks', every_n_year: 'every {n} years',
    next: 'next {d}', paused: 'paused', varies: 'amount varies', per_month: '≈ per month',
    rec_empty: 'E.g. rent, English lessons, subscriptions.', rec_title: 'Recurring expense', rec_new: 'New recurring expense',
    next_on: 'Next payment: {d}', confirm_rec_delete: 'Delete recurring “{n}”? Expenses already added stay.',
    due_pay: 'Enter', due_skip: 'Skip', due_usual: 'usually {v}', due_skipped: 'Skipped, next {d}',
    cur_VND: 'Dong', cur_RUB: 'Ruble', cur_USD: 'Dollar',
    rates_api: 'rate from {d}', rates_manual: 'rate set manually', rates_default: 'approximate rate — update it',
    rates_info: '{m} ≈ {v} · {s}. Updates automatically once a day.', rates_updated: 'Rates updated',
    rates_failed: 'Could not update rates — offline?', no_expenses_export: 'No expenses in this period',
    restore_confirm: 'Replace current data with the backup from {d}? Expenses in backup: {n}.', restored: 'Data restored',
    not_backup: 'This is not a backup of this app', storage_n: 'Expenses: {n}', last_backup: 'last backup {d}',
    no_backup: 'no backups yet', persisted: 'storage protected from cleanup',
    excel_fail: 'Could not load the Excel module — internet needed', no_cols: 'Could not find date, category and amount columns',
    no_expenses_file: 'No expenses found in the file', read_fail: 'Could not read the file',
    imp_found: 'Expenses found: <b>{n}</b>', imp_new: ', new: <b>{n}</b> (the rest are already here)',
    imp_period: 'Period: {a} – {b}. Currencies: {c}.', imp_cats: 'Categories:', imp_newcat: '(new)',
    imp_skipped: 'Skipped income and transfers: {n}.', imp_bad: 'Rows that could not be parsed: {n}.',
    imported: 'Imported expenses: {n}',
    wipe1: 'Delete all expenses, categories and recurring payments? This cannot be undone.',
    wipe2: 'Sure? Better save a backup first.', sugg_none: 'Nothing recurring found in history',
    sugg_times: '{n}× · last {d}', sugg_added: ['{n} recurring payment added', '{n} recurring payments added'],
    cat_groceries: 'Groceries', cat_cafe: 'Cafes & restaurants', cat_coffee: 'Coffee', cat_delivery: 'Delivery',
    cat_transport: 'Transport', cat_rent: 'Rent & utilities', cat_home: 'Home', cat_subscriptions: 'Subscriptions',
    cat_health: 'Health', cat_leisure: 'Leisure', cat_clothes: 'Clothes', cat_english: 'English lessons', cat_sport: 'Sport',
    cat_cigarettes: 'Cigarettes', cat_gifts: 'Gifts', cat_travel: 'Travel', cat_other: 'Other', cat_shopping: 'Shopping',
  },
  ru: {
    app_name: 'Траты', period: 'Период', p_day: 'День', p_week: 'Неделя', p_month: 'Месяц', p_year: 'Год', p_custom: 'Период',
    prev_period: 'Предыдущий период', next_period: 'Следующий период', report_currency: 'Валюта отчёта', from: 'С', to: 'По',
    due_title: 'Пора оплатить', by_category: 'По категориям', clear_filter: 'Сбросить фильтр', converter: 'Конвертер',
    cheat_sheet: 'Шпаргалка', more: 'Ещё', overview: 'Обзор', language: 'Язык', recurring: 'Регулярные траты', add: '+ Добавить',
    recurring_hint: 'Постоянные суммы добавляются сами в нужный день. Если сумма меняется (аренда с коммуналкой), приложение напомнит, а сумму вы введёте сами.',
    rec_find: 'Найти регулярные в истории', categories: 'Категории', currencies: 'Валюты и курс',
    default_input_cur: 'Валюта ввода по умолчанию', refresh_rates: 'Обновить курс', export_title: 'Выгрузка для анализа',
    export_hint: 'CSV со всеми тратами за период. Отправьте его на Mac (AirDrop или Telegram) и положите в папку exports.',
    exp_14: 'Последние 14 дней', exp_period: 'Выбранный на «Обзоре» период', exp_all: 'Все траты',
    backup_title: 'Резервная копия и импорт', backup_hint: 'Данные хранятся только на этом устройстве. Делайте копию хотя бы раз в месяц.',
    backup_save: 'Сохранить резервную копию (JSON)', backup_restore: 'Восстановить из копии', import_mm: 'Импорт из Money Manager (Excel/CSV)',
    wipe: 'Удалить все данные', add_expense: 'Добавить трату', amount: 'Сумма', today: 'Сегодня', yesterday: 'Вчера', date: 'Дата',
    note_ph: 'Комментарий (необязательно)', tap_category: 'Выберите категорию и нажмите «Сохранить»', close: 'Закрыть', delete: 'Удалить', save: 'Сохранить',
    icon: 'Иконка', name: 'Название', cat_delete: 'Удалить категорию', rec_name_ph: 'Название (например, Аренда)',
    rec_variable: 'Сумма меняется — напоминать, а не добавлять', category: 'Категория', every: 'Каждые', interval: 'Интервал',
    unit_month: 'мес.', unit_week: 'нед.', unit_year: 'год', rec_next: 'Следующее списание', active: 'Активна',
    rec_found: 'Найденные регулярные платежи', rec_found_hint: 'Отметьте те, что ещё действуют. Сумму и день можно поменять потом.',
    cancel: 'Отмена', add_selected: 'Добавить выбранные', import_title: 'Импорт из Money Manager', import: 'Импортировать',
    spent: 'Потрачено', of_total: '{p}% от {t}', more_cats: 'Ещё {n} кат.',
    vs_day: 'ко вчера', vs_week: 'к прошлой неделе', vs_month: 'к прошлому месяцу', vs_year: 'к прошлому году', vs_custom: 'к предыдущему периоду',
    was: 'было {v}', prev_total: 'В предыдущем периоде: {v}', no_expenses_period: 'Трат за этот период нет', new_cat: 'новое',
    no_category: 'Без категории', rec_hide: '🔁 Скрыть регулярные траты', rec_show: '🔁 Регулярные траты скрыты — показать',
    by_days: 'По дням', by_weeks: 'По неделям', by_months: 'По месяцам', by_years: 'По годам',
    avg_day: 'в среднем {v} в день', avg_week: 'в среднем {v} в нед.', avg_month: 'в среднем {v} в мес.', avg_year: 'в среднем {v} в год',
    transactions: 'Операции', empty_tx: 'Пока пусто. Нажмите «+», чтобы добавить трату.', show_more: 'Показать ещё ({n})', fold_open: 'Показать все · {n}', fold_close: 'Свернуть',
    recurring_tag: '🔁 регулярная', choose_cat: 'Выберите категорию', undo: 'Отменить', restore_btn: 'Вернуть', saved: 'Сохранено',
    deleted: 'Трата удалена', expenses_n: ['{n} трата', '{n} траты', '{n} трат'], archived: 'в архиве', cat_new: 'Новая категория',
    cat_title: 'Категория', archive: 'В архив', unarchive: 'Вернуть из архива', cat_archived: 'Категория в архиве: старые траты сохранены',
    cat_unarchived: 'Категория снова активна', confirm_cat_delete: 'Удалить категорию «{n}»?',
    rec_added: ['Добавлена {n} регулярная трата', 'Добавлено {n} регулярные траты', 'Добавлено {n} регулярных трат'],
    every_month: 'каждый месяц', every_week: 'каждую неделю', every_year: 'каждый год',
    every_n_month: 'каждые {n} мес.', every_n_week: 'каждые {n} нед.', every_n_year: 'каждые {n} г.',
    next: 'след. {d}', paused: 'на паузе', varies: 'сумма меняется', per_month: '≈ в месяц',
    rec_empty: 'Например: аренда, английский, подписки.', rec_title: 'Регулярная трата', rec_new: 'Новая регулярная трата',
    next_on: 'Следующее списание: {d}', confirm_rec_delete: 'Удалить регулярную трату «{n}»? Уже добавленные траты останутся.',
    due_pay: 'Внести', due_skip: 'Пропустить', due_usual: 'обычно {v}', due_skipped: 'Пропущено, следующее {d}',
    cur_VND: 'Донг', cur_RUB: 'Рубль', cur_USD: 'Доллар',
    rates_api: 'курс от {d}', rates_manual: 'курс задан вручную', rates_default: 'курс приблизительный — обновите',
    rates_info: '{m} ≈ {v} · {s}. Обновляется автоматически раз в день.', rates_updated: 'Курс обновлён',
    rates_failed: 'Не удалось обновить курс — нет интернета?', no_expenses_export: 'За этот период трат нет',
    restore_confirm: 'Заменить текущие данные копией от {d}? Трат в копии: {n}.', restored: 'Данные восстановлены',
    not_backup: 'Это не резервная копия этого приложения', storage_n: 'Трат: {n}', last_backup: 'последняя копия {d}',
    no_backup: 'копий ещё не было', persisted: 'хранилище защищено от очистки',
    excel_fail: 'Не удалось загрузить модуль Excel — нужен интернет', no_cols: 'Не нашёл колонки «дата», «категория», «сумма»',
    no_expenses_file: 'В файле не нашлось расходов', read_fail: 'Не удалось прочитать файл',
    imp_found: 'Найдено расходов: <b>{n}</b>', imp_new: ', из них новых: <b>{n}</b> (остальные уже есть)',
    imp_period: 'Период: {a} – {b}. Валюты: {c}.', imp_cats: 'Категории:', imp_newcat: '(новая)',
    imp_skipped: 'Пропущено доходов и переводов: {n}.', imp_bad: 'Не удалось разобрать строк: {n}.',
    imported: 'Импортировано трат: {n}',
    wipe1: 'Удалить все траты, категории и регулярные платежи? Это нельзя отменить.',
    wipe2: 'Точно? Сначала лучше сохранить резервную копию.', sugg_none: 'В истории не нашлось повторяющихся трат',
    sugg_times: '{n}× · последний раз {d}',
    sugg_added: ['Добавлен {n} регулярный платёж', 'Добавлено {n} регулярных платежа', 'Добавлено {n} регулярных платежей'],
    cat_groceries: 'Продукты', cat_cafe: 'Кафе и рестораны', cat_coffee: 'Кофе', cat_delivery: 'Доставка',
    cat_transport: 'Транспорт', cat_rent: 'Аренда и коммуналка', cat_home: 'Дом', cat_subscriptions: 'Подписки',
    cat_health: 'Здоровье', cat_leisure: 'Развлечения', cat_clothes: 'Одежда', cat_english: 'Английский', cat_sport: 'Спорт',
    cat_cigarettes: 'Сиги', cat_gifts: 'Подарки', cat_travel: 'Путешествия', cat_other: 'Другое', cat_shopping: 'Покупки',
  },
};
const LANGS = [['en', 'English'], ['ru', 'Русский']];
const lang = () => (T[S.settings.lang] ? S.settings.lang : 'en');
function t(key, vars = {}) {
  let s = T[lang()][key] ?? T.en[key] ?? key;
  if (Array.isArray(s)) s = s[0];
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
// Множественное число: en — [one, other], ru — [one, few, many].
function tn(key, n, vars = {}) {
  const forms = T[lang()][key] ?? T.en[key];
  const cat = new Intl.PluralRules(lang()).select(n);
  const idx = lang() === 'ru' ? { one: 0, few: 1, many: 2, other: 1 }[cat] : (cat === 'one' ? 0 : 1);
  return forms[Math.min(idx, forms.length - 1)].replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? n : vars[k] ?? ''));
}
const numLoc = () => (lang() === 'ru' ? 'ru-RU' : 'en-US');
const dateLoc = () => (lang() === 'ru' ? 'ru-RU' : 'en-GB');

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
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
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
    const tr = db.transaction(s, 'readwrite');
    const os = tr.objectStore(s);
    items.forEach((i) => os.put(i));
    tr.oncomplete = () => res();
    tr.onerror = () => rej(tr.error);
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
  open: { tx: false, cat: false },  // раскрыты ли блоки «Операции» и «По категориям»
};
const catById = (id) => S.cats.find((c) => c.id === id);
const catName = (c) => (c ? c.name || t(`cat_${c.key}`) : t('no_category'));
// у регулярной траты без своего названия показываем название категории (и оно переводится)
const recName = (r) => r.name || catName(catById(r.categoryId));
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
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(day, daysInMonth(r.getFullYear(), r.getMonth())));
  return ymd(r);
}
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtD = (opts) => new Intl.DateTimeFormat(dateLoc(), opts);
function monthName(s, style = 'long') { return cap(fmtD({ month: style }).format(parse(s)).replace('.', '')); }
function short(s, withYear) { return fmtD({ day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(parse(s)).replace(' г.', ''); }
function longDay(s) { return fmtD({ weekday: 'short', day: 'numeric', month: 'long' }).format(parse(s)); }

function rangeOf(period, anchor) {
  const d = parse(anchor);
  if (period === 'day') return [anchor, anchor];
  if (period === 'week') {
    const start = addDays(anchor, -((d.getDay() + 6) % 7));
    return [start, addDays(start, 6)];
  }
  if (period === 'month') return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
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
  const [a, b] = currentRange(), td = todayStr();
  if (td >= a && td < b && S.period !== 'day') {
    const end = addDays(pa, diffDays(a, td));
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
function periodLabel() {
  const [a, b] = currentRange();
  const td = todayStr();
  const thisYear = a.slice(0, 4) === td.slice(0, 4) && b.slice(0, 4) === td.slice(0, 4);
  if (S.period === 'day') {
    if (a === td) return t('today');
    if (a === addDays(td, -1)) return t('yesterday');
    return fmtD({ weekday: 'short', day: 'numeric', month: 'long', ...(thisYear ? {} : { year: 'numeric' }) }).format(parse(a));
  }
  if (S.period === 'month') return `${monthName(a)}${thisYear ? '' : ' ' + a.slice(0, 4)}`;
  if (S.period === 'year') return a.slice(0, 4);
  return `${short(a, !thisYear)} – ${short(b, !thisYear)}`;
}

/* ============================== Деньги ============================== */

function rateOf(cur, rates) { return (rates && rates[cur]) || S.settings.rates[cur] || 1; }
// Перевод суммы траты в валюту отчёта: по курсу, сохранённому в момент траты (если был), иначе по текущему.
function conv(amount, from, to, rates) {
  if (from === to) return amount;
  return (amount / rateOf(from, rates)) * rateOf(to, rates);
}
function txIn(tx, to) { return conv(tx.amount, tx.currency, to, tx.fx); }
function fmt(v, cur, opts = {}) {
  const dec = opts.dec ?? (Math.abs(v) >= 1000 ? 0 : CUR[cur].dec);
  const s = new Intl.NumberFormat(numLoc(), { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(v);
  return `${s} ${CUR[cur].sym}`;
}
function fmtShort(v, cur) {
  const a = Math.abs(v);
  const n = (x, d) => new Intl.NumberFormat(numLoc(), { maximumFractionDigits: d }).format(x);
  const ru = lang() === 'ru';
  const sym = CUR[cur].sym;
  if (a >= 1e9) return ru ? `${n(v / 1e9, 1)} млрд ${sym}` : `${n(v / 1e9, 1)}B ${sym}`;
  if (a >= 1e6) return ru ? `${n(v / 1e6, a >= 1e8 ? 0 : 1)} млн ${sym}` : `${n(v / 1e6, a >= 1e8 ? 0 : 1)}M ${sym}`;
  if (a >= 1e5) return ru ? `${n(v / 1e3, 0)} тыс ${sym}` : `${n(v / 1e3, 0)}K ${sym}`;
  return fmt(v, cur);
}
function parseAmount(str) {
  if (str === '' || str == null) return NaN;
  if (typeof str === 'number') return str;
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
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
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
      if (manual) toast(t('rates_updated'));
      return true;
    } catch (_) { /* пробуем следующий источник */ }
  }
  if (manual) toast(t('rates_failed'));
  return false;
}

/* ============================== Вспомогательное UI ============================== */

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (slot) => (slot == null ? 'var(--other)' : `var(--s${slot % SLOTS})`);

let toastTimer;
function toast(text, actionLabel, action) {
  const box = $('#toast');
  $('#toast-text').textContent = text;
  const b = $('#toast-action');
  b.textContent = actionLabel || '';
  b.classList.toggle('hidden', !actionLabel);
  b.onclick = () => { box.classList.add('hidden'); action && action(); };
  box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), actionLabel ? 5000 : 2200);
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

// Свайп вниз закрывает шторку: тянуть можно, когда она прокручена до верха
function swipeToClose(sh) {
  let y0 = null, dy = 0, drag = false;
  sh.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || sh.scrollTop > 0) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; drag = false;
  }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (!drag) {
      if (dy < -4 || sh.scrollTop > 0) { y0 = null; return; }  // тянут вверх — обычная прокрутка
      if (dy < 8) return;
      drag = true; sh.style.transition = 'none';
    }
    e.preventDefault();
    sh.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }, { passive: false });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    if (!drag) return;
    drag = false;
    sh.style.transition = 'transform .18s ease-out';
    if (dy > 110) { document.activeElement?.blur(); closeSheet(); }
    sh.style.transform = '';
    setTimeout(() => (sh.style.transition = ''), 200);
  };
  sh.addEventListener('touchend', end);
  sh.addEventListener('touchcancel', end);
}

function applyI18n() {
  document.documentElement.lang = lang();
  document.title = t('app_name');
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
}

/* ============================== Обзор ============================== */

function txInRange([a, b]) { return S.tx.filter((x) => x.date >= a && x.date <= b && !(S.settings.hideRec && x.recId)); }
function sumBy(list, cur) {
  const m = new Map();
  let total = 0;
  for (const x of list) {
    const v = txIn(x, cur);
    total += v;
    m.set(x.categoryId, (m.get(x.categoryId) || 0) + v);
  }
  return { total, byCat: m };
}

// Перерисовка с привязкой к блоку, который сейчас на экране: высота блоков выше меняется
// (другое число категорий, напоминания), а смотреть пользователь продолжает в то же место.
function rerender() {
  const topEdge = document.querySelector('#tab-main .topbar').getBoundingClientRect().bottom;
  const cards = [...document.querySelectorAll('#tab-main .card')].filter((c) => !c.classList.contains('hidden'));
  // якорь — первый блок, который начинается на экране; если такого нет (длинный блок на весь экран) — тот, что под шапкой
  const anchor = cards.find((c) => { const r = c.getBoundingClientRect(); return r.top >= topEdge - 4 && r.top < window.innerHeight; })
    || cards.find((c) => c.getBoundingClientRect().bottom > topEdge + 8);
  const before = anchor?.getBoundingClientRect().top;
  renderMain();
  if (anchor && !anchor.classList.contains('hidden') && window.scrollY > 0) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
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

  renderDue();

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
    d.innerHTML = `<span class="${cls}">${pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : ''}${Math.round(pct)}%</span> ${esc(t('vs_' + S.period))}${pr[2] ? ` (${esc(short(pr[0]))} – ${esc(short(pr[1]))})` : ''} · ${esc(t('was', { v: fmt(prev.total, cur) }))}`;
  } else if (prev.total > 0) d.textContent = t('prev_total', { v: fmt(prev.total, cur) });
  else d.textContent = '';

  // список категорий
  const ul = $('#cat-list');
  ul.innerHTML = '';
  if (!cats.length) ul.append(el('li', 'empty', esc(t('no_expenses_period'))));
  const max = cats[0]?.v || 1;
  for (const { id, v, cat } of cats) {
    const p = prev.byCat.get(id) || 0;
    let delta = '';
    if (p > 0) {
      const pct = Math.round(((v - p) / p) * 100);
      if (pct !== 0) delta = `<span class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct}%</span> · `;
    } else if (prev.total > 0) delta = `<span>${esc(t('new_cat'))}</span> · `;
    const li = el('li', S.catFilter === id ? 'sel' : '', `
      <span class="emo">${esc(cat?.emoji || '❓')}</span>
      <span class="name">${esc(catName(cat))}</span>
      <span class="amt">${esc(fmt(v, cur))}</span>
      <span class="meter"><i style="width:${(v / max) * 100}%;background:${color(cat?.color)}"></i></span>
      <span class="meta">${delta}${total ? Math.round((v / total) * 100) : 0}%</span>`);
    li.onclick = () => { S.catFilter = S.catFilter === id ? null : id; S.txLimit = 60; rerender(); };
    ul.append(li);
  }
  $('#clear-filter').classList.toggle('hidden', !S.catFilter);
  const rt = $('#rec-toggle');
  rt.classList.toggle('hidden', !S.tx.some((x) => x.recId));
  rt.textContent = S.settings.hideRec ? t('rec_show') : t('rec_hide');

  renderBars(cur);
  renderTxList(list, cur);
  applyFold('cat', '#cat-list > li', cats.length);
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
    center.innerHTML = `<div class="lbl">${esc(t('spent'))}</div><div class="val">${esc(fmt(0, cur))}</div>`;
    return;
  }
  // топ-7 категорий, остальное сворачиваем в один серый сегмент
  const segs = cats.slice(0, CHART_MAX).map((c) => ({ ...c }));
  if (cats.length > CHART_MAX) {
    const rest = cats.slice(CHART_MAX);
    segs.push({ id: '__other', v: rest.reduce((s, c) => s + c.v, 0), cat: { name: t('more_cats', { n: rest.length }), color: null }, ids: rest.map((c) => c.id) });
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
      if (s.id === '__other') { if (!S.open.cat) toggleFold('cat'); document.querySelector(`#cat-list li:nth-child(${CHART_MAX + 1})`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      S.catFilter = S.catFilter === s.id ? null : s.id; S.txLimit = 60; rerender();
    });
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${catName(s.cat)}: ${fmt(s.v, cur)}`;
    path.append(title);
    svg.append(path);
    a += sweep;
  }
  svg.classList.toggle('has-sel', !!selSeg);
  if (selSeg) {
    const v = selSeg.id === sel ? selSeg.v : cats.find((c) => c.id === sel).v;
    const c = catById(sel);
    center.innerHTML = `<div class="lbl">${esc((c?.emoji || '') + ' ' + catName(c))}</div><div class="val">${esc(fmtShort(v, cur))}</div><div class="sub">${esc(t('of_total', { p: Math.round((v / total) * 100), t: fmtShort(total, cur) }))}</div>`;
  } else {
    const other = cur === 'VND' ? 'RUB' : 'VND';
    center.innerHTML = `<div class="lbl">${esc(t('spent'))}</div><div class="val">${esc(fmtShort(total, cur))}</div><div class="sub">≈ ${esc(fmtShort(conv(total, cur, other), other))}</div>`;
  }
}

// Столбики следуют за переключателем периода: День — последние 30 дней, Неделя — 12 недель,
// Месяц — 12 месяцев, Год — по годам. Выбранный период выделен, нажатие на столбик переходит к нему.
// Для произвольного периода — по дням внутри него (или по месяцам, если он длиннее трёх месяцев).
const BAR_COUNT = { day: 30, week: 12, month: 12 };
function bucketKey(unit, date) {
  if (unit === 'day') return date;
  if (unit === 'week') return rangeOf('week', date)[0];
  if (unit === 'month') return date.slice(0, 7) + '-01';
  return date.slice(0, 4) + '-01-01';
}
function bucketLabel(unit, start, n) {
  if (unit === 'day') return String(parse(start).getDate());
  if (unit === 'week') return fmtD({ day: 'numeric', month: 'numeric' }).format(parse(start));
  if (unit === 'month') return monthName(start, 'short').slice(0, 3);
  return start.slice(0, 4);
}
function bucketFull(unit, start) {
  if (unit === 'day') return longDay(start);
  if (unit === 'week') return `${short(start)} – ${short(addDays(start, 6))}`;
  if (unit === 'month') return `${monthName(start)} ${start.slice(0, 4)}`;
  return start.slice(0, 4);
}
function barBuckets() {
  if (S.period === 'custom') {
    const [a, b] = currentRange();
    const unit = diffDays(a, b) > 92 ? 'month' : 'day';
    const starts = [];
    for (let d = bucketKey(unit, a); d <= b; d = unit === 'day' ? addDays(d, 1) : addMonths(d, 1, 1)) starts.push(d);
    return { unit, starts, nav: false };
  }
  const unit = S.period;
  const td = todayStr();
  const todayStart = rangeOf(unit, td)[0];
  const anchorStart = rangeOf(unit, S.anchor)[0];
  let starts = [];
  if (unit === 'year') {
    const years = S.tx.map((x) => +x.date.slice(0, 4));
    const last = Math.max(+td.slice(0, 4), +anchorStart.slice(0, 4));
    const first = Math.min(last - 2, ...years, +anchorStart.slice(0, 4));
    for (let y = first; y <= last; y++) starts.push(`${y}-01-01`);
  } else {
    // окно заканчивается текущим периодом; если пролистали дальше назад — выбранным
    const endStart = anchorStart > todayStart || diffDays(anchorStart, todayStart) / { day: 1, week: 7, month: 30.4 }[unit] >= BAR_COUNT[unit] - 1 ? anchorStart : todayStart;
    let d = endStart;
    for (let i = 0; i < BAR_COUNT[unit]; i++) { starts.unshift(d); d = shiftAnchor(d, unit, -1); }
  }
  // пустое начало до первой траты не показываем — так столбики шире
  if (S.tx.length) {
    const firstKey = bucketKey(unit, S.tx.reduce((m, x) => (x.date < m ? x.date : m), '9999'));
    const cut = firstKey < anchorStart ? firstKey : anchorStart;
    const trimmed = starts.filter((x) => x >= cut);
    if (trimmed.length) starts = trimmed;
  }
  return { unit, starts, nav: true, selected: starts.indexOf(anchorStart) };
}

function renderBars(cur) {
  const { unit, starts, nav, selected = -1 } = barBuckets();
  const lastEnd = unit === 'day' ? starts[starts.length - 1] : rangeOf(unit, starts[starts.length - 1])[1];
  const buckets = starts.map((start) => ({ start, v: 0, label: bucketLabel(unit, start), full: bucketFull(unit, start) }));
  const idx = new Map(starts.map((x, i) => [x, i]));
  let src = txInRange([starts[0], lastEnd]);
  if (S.catFilter) src = src.filter((x) => x.categoryId === S.catFilter);
  for (const x of src) { const i = idx.get(bucketKey(unit, x.date)); if (i != null) buckets[i].v += txIn(x, cur); }

  const titles = { day: 'by_days', week: 'by_weeks', month: 'by_months', year: 'by_years' };
  $('#bars-title').textContent = t(titles[unit]);
  const td = todayStr();
  const elapsed = buckets.filter((x) => x.start <= td);
  const avg = elapsed.reduce((s, x) => s + x.v, 0) / (elapsed.length || 1);
  const info = $('#bars-info');
  const avgText = avg ? t(`avg_${unit}`, { v: fmtShort(avg, cur) }) : '';
  const defaultInfo = selected >= 0 ? `${buckets[selected].full}: ${fmtShort(buckets[selected].v, cur)}` : avgText;
  info.textContent = defaultInfo;

  const W = Math.max(260, Math.round($('#bars').clientWidth || 340)), H = 150, top = 8, bottom = 18, n = buckets.length;
  const max = Math.max(...buckets.map((x) => x.v), 1);
  const slot = W / n, bw = Math.max(2, Math.min(slot - 2, 48));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const fillOf = (i) => (selected < 0 || i === selected ? 'var(--bar)' : 'var(--bar-dim)');
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(titles[unit]))}">`;
  svg += `<line class="grid" x1="0" x2="${W}" y1="${y(max)}" y2="${y(max)}"/>`;
  const every = n > 20 ? 5 : n > 12 ? 2 : unit === 'week' ? 2 : 1;
  buckets.forEach((x, i) => {
    const h = H - bottom - y(x.v);
    const bx = i * slot + (slot - bw) / 2;
    if (x.v > 0) {
      const r = Math.min(4, bw / 2, h);
      const yy = y(x.v), base = H - bottom;
      svg += `<path class="b-path" d="M${bx} ${base}V${yy + r}Q${bx} ${yy} ${bx + r} ${yy}H${bx + bw - r}Q${bx + bw} ${yy} ${bx + bw} ${yy + r}V${base}Z" fill="${fillOf(i)}" data-i="${i}"/>`;
    }
    svg += `<rect class="hit" x="${i * slot}" y="0" width="${slot}" height="${H}" data-i="${i}"/>`;
    // подписи считаем от правого края, чтобы текущий период всегда был подписан
    if ((n - 1 - i) % every === 0) svg += `<text x="${bx + bw / 2}" y="${H - 4}" text-anchor="middle"${i === selected ? ' class="sel"' : ''}>${esc(x.label)}</text>`;
  });
  if (avg && avg < max) svg += `<line class="avg" x1="0" x2="${W}" y1="${y(avg)}" y2="${y(avg)}"/>`;
  svg += `<line class="axis" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/></svg>`;
  const box = $('#bars');
  box.innerHTML = svg;
  let active = null;
  box.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('click', () => {
      const i = +h.dataset.i;
      if (nav) {
        // переход к выбранному дню / неделе / месяцу / году
        if (buckets[i].start > td) return;
        S.anchor = buckets[i].start; S.txLimit = 60;
        rerender();
        return;
      }
      if (active === i) { active = null; info.textContent = defaultInfo; box.querySelectorAll('.b-path').forEach((p) => p.setAttribute('fill', 'var(--bar)')); return; }
      active = i;
      info.textContent = `${buckets[i].full}: ${fmt(buckets[i].v, cur)}`;
      box.querySelectorAll('.b-path').forEach((p) => p.setAttribute('fill', +p.dataset.i === i ? 'var(--bar)' : 'var(--bar-dim)'));
    });
  });
}

function dayLabel(d) {
  if (d === todayStr()) return t('today');
  if (d === addDays(todayStr(), -1)) return t('yesterday');
  return longDay(d);
}
function renderTxList(list, cur) {
  const box = $('#tx-list');
  box.innerHTML = '';
  let items = S.catFilter ? list.filter((x) => x.categoryId === S.catFilter) : list;
  items = [...items].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
  const fc = S.catFilter && catById(S.catFilter);
  $('#tx-title').textContent = fc ? `${fc.emoji} ${catName(fc)}` : t('transactions');
  if (!items.length) { box.append(el('div', 'empty', esc(t('empty_tx')))); applyFold('tx', '.tx-row', 0); return; }
  const shown = items.slice(0, S.txLimit);
  let group, groupDate;
  const dayTotals = new Map();
  for (const x of items) dayTotals.set(x.date, (dayTotals.get(x.date) || 0) + txIn(x, cur));
  for (const x of shown) {
    if (x.date !== groupDate) {
      groupDate = x.date;
      group = el('div', 'day-group');
      group.append(el('div', 'day-head', `<span>${esc(dayLabel(x.date))}</span><span class="num">${esc(fmt(dayTotals.get(x.date), cur))}</span>`));
      box.append(group);
    }
    const cat = catById(x.categoryId);
    const sub = [x.note ? catName(cat) : '', x.recId ? t('recurring_tag') : ''].filter(Boolean).join(' · ');
    const row = el('button', 'tx-row', `
      <span class="emo">${esc(cat?.emoji || '❓')}</span>
      <span><div class="t1">${esc(x.note || catName(cat))}</div><div class="t2">${esc(sub)}</div></span>
      <span><div class="a1">${esc(fmt(x.amount, x.currency))}</div>${x.currency !== cur ? `<div class="a2">≈ ${esc(fmt(txIn(x, cur), cur))}</div>` : ''}</span>`);
    row.onclick = () => openTxSheet(x);
    group.append(row);
  }
  if (items.length > shown.length) {
    const more = el('button', 'more-btn', esc(t('show_more', { n: items.length - shown.length })));
    more.onclick = () => { S.txLimit += 100; renderMain(); };
    box.append(more);
  }
  applyFold('tx', '.tx-row', items.length);
}

/* Свёрнутый блок: видно 2,5 строки, остальное под градиентом; кнопка раскрывает и сворачивает */
const FOLD_ROWS = 2.5;
function foldHeight(box, rowSel) {
  const rows = box.querySelectorAll(rowSel);
  const n = Math.floor(FOLD_ROWS);
  if (rows.length <= n) return 0;
  const r = rows[n], top = box.getBoundingClientRect().top;
  const b = r.getBoundingClientRect();
  return Math.round(b.top - top + b.height * (FOLD_ROWS - n));
}
function applyFold(key, rowSel, count) {
  const box = $(`#${key}-fold`), btn = $(`#${key}-fold-btn`);
  box.style.transition = 'none';
  box.style.maxHeight = '';
  const h = box.offsetParent ? foldHeight(box, rowSel) : 0;
  const foldable = h > 0 && box.scrollHeight > h + 24;
  btn.classList.toggle('hidden', !foldable);
  const closed = foldable && !S.open[key];
  box.classList.toggle('closed', closed);
  box.dataset.h = h;
  if (closed) box.style.maxHeight = h + 'px';
  btn.dataset.n = count;
  btn.textContent = S.open[key] ? t('fold_close') : t('fold_open', { n: count });
  btn.setAttribute('aria-expanded', String(!!S.open[key]));
}
function toggleFold(key) {
  const box = $(`#${key}-fold`), btn = $(`#${key}-fold-btn`);
  const h = +box.dataset.h;
  S.open[key] = !S.open[key];
  box.style.transition = '';
  if (S.open[key]) {
    box.style.maxHeight = h + 'px';
    void box.offsetHeight;
    box.style.maxHeight = box.scrollHeight + 'px';
    box.classList.remove('closed');
    box.addEventListener('transitionend', () => { if (S.open[key]) box.style.maxHeight = ''; }, { once: true });
  } else {
    box.style.maxHeight = box.scrollHeight + 'px';
    void box.offsetHeight;
    box.style.maxHeight = h + 'px';
    box.classList.add('closed');
    // если начало блока ушло за верх экрана — вернуть его в поле зрения
    const card = box.closest('.card');
    if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  btn.textContent = S.open[key] ? t('fold_close') : t('fold_open', { n: btn.dataset.n });
  btn.setAttribute('aria-expanded', String(S.open[key]));
}

/* ============================== Ввод трат ============================== */

let txEdit = null;     // редактируемая трата или null для новой
let txState = {};

function catsByUsage() {
  const since = addDays(todayStr(), -60);
  const cnt = new Map();
  for (const x of S.tx) if (x.date >= since) cnt.set(x.categoryId, (cnt.get(x.categoryId) || 0) + 1);
  return S.cats.filter((c) => !c.archived).sort((a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0) || a.order - b.order);
}

// prefill — для оплаты регулярной траты с меняющейся суммой: {amount, currency, categoryId, note, date, recId}
function openTxSheet(x, prefill) {
  txEdit = x || null;
  const p = prefill || {};
  txState = {
    currency: x?.currency || p.currency || S.settings.inputCur,
    date: x?.date || p.date || (S.period === 'day' && S.anchor <= todayStr() ? S.anchor : todayStr()),
    categoryId: x?.categoryId || p.categoryId || null,
    recId: p.recId || null,
  };
  $('#tx-amount').value = x ? String(x.amount) : p.amount ? String(p.amount) : '';
  $('#tx-note').value = x?.note || p.note || '';
  segment($('#tx-cur'), curItems(), txState.currency, (v) => { txState.currency = v; updateAmountHint(); });
  updateTxDate();
  $('#tx-hint').classList.toggle('hidden', !!x);
  $('#tx-delete').classList.toggle('hidden', !x);
  renderTxCats();
  updateAmountHint();
  updateTxSave();
  openSheet('#sheet-tx');
  // iOS открывает клавиатуру только при фокусе синхронно в обработчике нажатия — без setTimeout
  if (!x) { const a = $('#tx-amount'); a.focus({ preventScroll: true }); a.select(); }
}
// Кнопка «Сохранить»: у новой траты показывает выбранную категорию, без категории — приглушена
function updateTxSave() {
  const b = $('#tx-save');
  const c = catById(txState.categoryId);
  b.textContent = !txEdit && c ? `${t('save')} · ${c.emoji} ${catName(c)}` : t('save');
  b.classList.toggle('dim', !c);
}
function renderTxCats() {
  const grid = $('#tx-cats');
  grid.innerHTML = '';
  let cats = catsByUsage();
  const pinned = catById(txState.categoryId);
  if (pinned) cats = [pinned, ...cats.filter((c) => c.id !== pinned.id)];
  for (const c of cats) {
    const b = el('button', c.id === txState.categoryId ? 'on' : '', `<span class="e">${esc(c.emoji)}</span><span class="n">${esc(catName(c))}</span>`);
    b.type = 'button';
    // выбор категории не сохраняет трату — сохраняет кнопка «Сохранить» (защита от промаха)
    b.onclick = () => {
      txState.categoryId = c.id;
      grid.querySelectorAll('button').forEach((y) => y.classList.remove('on'));
      b.classList.add('on');
      updateTxSave();
    };
    grid.append(b);
  }
}
function updateTxDate() {
  $('#tx-date').value = txState.date;
  const td = todayStr();
  [...$('#tx-date-chips').children].forEach((b) => b.classList.toggle('on', addDays(td, +b.dataset.d) === txState.date));
}
function updateAmountHint() {
  const v = parseAmount($('#tx-amount').value);
  const h = $('#tx-amount-hint');
  if (!(v > 0)) { h.textContent = ''; return; }
  const cur = txState.currency;
  const others = CUR_ORDER.filter((c) => c !== cur);
  h.textContent = `${fmt(v, cur)} ≈ ` + others.map((o) => fmt(conv(v, cur, o), o)).join(' ≈ ');
}
async function saveTx() {
  const amount = parseAmount($('#tx-amount').value);
  if (!(amount > 0)) { const a = $('#tx-amount'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); a.focus(); return; }
  if (!txState.categoryId) { toast(t('choose_cat')); return; }
  const isNew = !txEdit;
  const x = txEdit ? { ...txEdit } : { id: uid(), createdAt: new Date().toISOString() };
  const changedMoney = isNew || x.amount !== amount || x.currency !== txState.currency;
  Object.assign(x, {
    amount: roundCur(amount, txState.currency),
    currency: txState.currency,
    date: txState.date,
    categoryId: txState.categoryId,
    note: $('#tx-note').value.trim(),
  });
  if (changedMoney) { const fx = freshRates(); if (fx) x.fx = fx; else delete x.fx; }
  if (isNew && txState.recId) x.recId = txState.recId;
  await dbPut('tx', x);
  const i = S.tx.findIndex((y) => y.id === x.id);
  if (i >= 0) S.tx[i] = x; else S.tx.push(x);
  // оплата регулярной траты с меняющейся суммой: запоминаем сумму и переносим на следующий срок
  let paidRule = null;
  if (isNew && txState.recId) {
    const r = S.rec.find((y) => y.id === txState.recId);
    if (r) { r.amount = x.amount; r.currency = x.currency; r.next = nextOccurrence(r, r.next); await dbPut('rec', r); paidRule = r; }
  }
  if (!txState.recId && S.settings.inputCur !== x.currency) { S.settings.inputCur = x.currency; saveSettings(); }
  closeSheet();
  renderAll();
  const cat = catById(x.categoryId);
  if (isNew) toast(`${cat.emoji} ${fmt(x.amount, x.currency)} — ${catName(cat)}`, t('undo'), () => deleteTx(x, true, paidRule));
  else toast(t('saved'));
}
async function deleteTx(x, silent, paidRule) {
  await dbDel('tx', x.id);
  S.tx = S.tx.filter((y) => y.id !== x.id);
  if (paidRule) { paidRule.next = x.date; await dbPut('rec', paidRule); }  // отмена оплаты — напоминание возвращается
  closeSheet();
  renderAll();
  if (!silent) toast(t('deleted'), t('restore_btn'), async () => { await dbPut('tx', x); S.tx.push(x); renderAll(); });
}

/* ============================== Категории ============================== */

let catEdit = null, catColor = 0;
function renderCatManage() {
  const ul = $('#cat-manage');
  ul.innerHTML = '';
  const counts = new Map();
  for (const x of S.tx) counts.set(x.categoryId, (counts.get(x.categoryId) || 0) + 1);
  const sorted = [...S.cats].sort((a, b) => (a.archived - b.archived) || a.order - b.order);
  for (const c of sorted) {
    const li = el('li', c.archived ? 'archived' : '', `
      <span class="emo">${esc(c.emoji)}</span>
      <span class="grow"><div class="t1">${esc(catName(c))}</div><div class="t2">${esc(tn('expenses_n', counts.get(c.id) || 0))}${c.archived ? ' · ' + esc(t('archived')) : ''}</div></span>
      <span class="dot" style="background:${color(c.color)}"></span>`);
    li.onclick = () => openCatSheet(c);
    ul.append(li);
  }
}
function openCatSheet(c) {
  catEdit = c || null;
  catColor = c ? c.color : S.cats.length % SLOTS;
  $('#cat-sheet-title').textContent = c ? t('cat_title') : t('cat_new');
  $('#cat-emoji').value = c?.emoji || '🏷️';
  $('#cat-name').value = c ? catName(c) : '';
  const sw = $('#cat-colors');
  sw.innerHTML = '';
  for (let i = 0; i < SLOTS; i++) {
    const b = el('button', i === catColor ? 'on' : '');
    b.type = 'button';
    b.style.background = color(i);
    b.setAttribute('aria-label', `${i + 1}`);
    b.onclick = () => { catColor = i; [...sw.children].forEach((y) => y.classList.remove('on')); b.classList.add('on'); };
    sw.append(b);
  }
  const used = c && (S.tx.some((x) => x.categoryId === c.id) || S.rec.some((r) => r.categoryId === c.id));
  $('#cat-archive').classList.toggle('hidden', !c);
  $('#cat-archive').textContent = c?.archived ? t('unarchive') : t('archive');
  $('#cat-delete').classList.toggle('hidden', !c || used);
  openSheet('#sheet-cat');
  if (!c) setTimeout(() => $('#cat-name').focus(), 50);
}
async function saveCat(archiveToggle) {
  const name = $('#cat-name').value.trim();
  if (!name) { $('#cat-name').focus(); return; }
  const c = catEdit ? { ...catEdit } : { id: uid(), order: Math.max(0, ...S.cats.map((x) => x.order)) + 1, archived: false };
  // если у стандартной категории оставили стандартное название — оно продолжит переводиться
  c.name = c.key && (name === T.en[`cat_${c.key}`] || name === T.ru[`cat_${c.key}`]) ? null : name;
  c.emoji = $('#cat-emoji').value.trim() || '🏷️';
  c.color = catColor;
  if (archiveToggle) c.archived = !c.archived;
  await dbPut('cats', c);
  const i = S.cats.findIndex((x) => x.id === c.id);
  if (i >= 0) S.cats[i] = c; else S.cats.push(c);
  closeSheet();
  renderAll();
  if (archiveToggle) toast(c.archived ? t('cat_archived') : t('cat_unarchived'));
}
async function deleteCat() {
  if (!catEdit || !confirm(t('confirm_cat_delete', { n: catName(catEdit) }))) return;
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
// Постоянные суммы: создаёт траты на все наступившие даты. Меняющиеся суммы — только напоминание (renderDue).
async function runRecurring() {
  const today = todayStr();
  const created = [];
  for (const r of S.rec) {
    if (!r.active || r.variable) continue;
    let guard = 0;
    while (r.next <= today && guard++ < 500) {
      const x = { id: uid(), createdAt: new Date().toISOString(), amount: r.amount, currency: r.currency, date: r.next, categoryId: r.categoryId, note: r.name || '', recId: r.id };
      const fx = freshRates(); if (fx && r.next === today) x.fx = fx;
      created.push(x);
      r.next = nextOccurrence(r, r.next);
    }
    if (guard) await dbPut('rec', r);
  }
  if (created.length) {
    await dbPutMany('tx', created);
    S.tx.push(...created);
    toast(tn('rec_added', created.length));
  }
  return created.length;
}
function renderDue() {
  const due = S.rec.filter((r) => r.active && r.variable && r.next <= todayStr()).sort((a, b) => a.next.localeCompare(b.next));
  $('#due-card').classList.toggle('hidden', !due.length);
  const ul = $('#due-list');
  ul.innerHTML = '';
  for (const r of due) {
    const c = catById(r.categoryId);
    const li = el('li', '', `
      <span class="emo">${esc(c?.emoji || '🔁')}</span>
      <span class="grow"><div class="t1">${esc(recName(r))}</div><div class="t2">${esc(short(r.next))} · ${esc(t('due_usual', { v: fmt(r.amount, r.currency) }))}</div></span>`);
    const skip = el('button', 'btn', esc(t('due_skip')));
    skip.onclick = async () => { r.next = nextOccurrence(r, r.next); await dbPut('rec', r); renderAll(); toast(t('due_skipped', { d: short(r.next) })); };
    const pay = el('button', 'btn primary', esc(t('due_pay')));
    pay.onclick = () => openTxSheet(null, { amount: r.amount, currency: r.currency, categoryId: r.categoryId, note: r.name || '', date: r.next, recId: r.id });
    li.append(skip, pay);
    ul.append(li);
  }
}
function recMonthly(r) {
  const per = r.unit === 'week' ? 52 / 12 : r.unit === 'year' ? 1 / 12 : 1;
  return (conv(r.amount, r.currency, S.settings.viewCur) * per) / Math.max(1, r.every || 1);
}
function unitText(r) {
  const n = Math.max(1, r.every || 1);
  return n === 1 ? t(`every_${r.unit}`) : t(`every_n_${r.unit}`, { n });
}
function renderRecList() {
  const ul = $('#rec-list');
  ul.innerHTML = '';
  if (!S.rec.length) { ul.append(el('li', 'muted small', esc(t('rec_empty')))); return; }
  const cur = S.settings.viewCur;
  let monthly = 0;
  const sorted = [...S.rec].sort((a, b) => (b.active - a.active) || a.next.localeCompare(b.next));
  for (const r of sorted) {
    const c = catById(r.categoryId);
    if (r.active) monthly += recMonthly(r);
    const status = r.active ? t('next', { d: short(r.next, r.next.slice(0, 4) !== todayStr().slice(0, 4)) }) : t('paused');
    const li = el('li', r.active ? '' : 'archived', `
      <span class="emo">${esc(c?.emoji || '🔁')}</span>
      <span class="grow"><div class="t1">${esc(recName(r))}</div><div class="t2">${esc(unitText(r))} · ${esc(status)}${r.variable ? ' · ' + esc(t('varies')) : ''}</div></span>
      <span class="right">${r.variable ? '~' : ''}${esc(fmt(r.amount, r.currency))}</span>`);
    li.onclick = () => openRecSheet(r);
    ul.append(li);
  }
  ul.append(el('li', 'tot', `<span class="grow">${esc(t('per_month'))}</span><span class="right">${esc(fmt(monthly, cur))}</span>`));
}
let recEdit = null, recCur = 'VND';
function openRecSheet(r) {
  recEdit = r || null;
  recCur = r?.currency || S.settings.inputCur;
  $('#rec-sheet-title').textContent = r ? t('rec_title') : t('rec_new');
  $('#rec-name').value = r ? recName(r) : '';
  $('#rec-amount').value = r ? String(r.amount) : '';
  segment($('#rec-cur'), curItems(), recCur, (v) => { recCur = v; });
  const sel = $('#rec-cat');
  sel.innerHTML = '';
  for (const c of S.cats.filter((y) => !y.archived || y.id === r?.categoryId)) sel.append(new Option(`${c.emoji} ${catName(c)}`, c.id));
  sel.value = r?.categoryId || (S.cats.find((c) => c.key === 'rent') || S.cats[0])?.id;
  $('#rec-every').value = r?.every || 1;
  $('#rec-unit').value = r?.unit || 'month';
  $('#rec-next').value = r?.next || todayStr();
  $('#rec-active').checked = r ? r.active : true;
  $('#rec-variable').checked = !!r?.variable;
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
  const catId = $('#rec-cat').value;
  Object.assign(r, {
    name: name === catName(catById(catId)) ? null : name, amount: roundCur(amount, recCur), currency: recCur, categoryId: catId,
    every: Math.max(1, parseInt($('#rec-every').value, 10) || 1), unit: $('#rec-unit').value,
    next, day: parse(next).getDate(), active: $('#rec-active').checked, variable: $('#rec-variable').checked,
  });
  await dbPut('rec', r);
  const i = S.rec.findIndex((x) => x.id === r.id);
  if (i >= 0) S.rec[i] = r; else S.rec.push(r);
  closeSheet();
  const n = await runRecurring();
  renderAll();
  if (!n) toast(r.next <= todayStr() ? t('saved') : t('next_on', { d: short(r.next, true) }));
}
async function deleteRec() {
  if (!recEdit || !confirm(t('confirm_rec_delete', { n: recName(recEdit) }))) return;
  await dbDel('rec', recEdit.id);
  S.rec = S.rec.filter((r) => r.id !== recEdit.id);
  closeSheet();
  renderAll();
}

// Подбор регулярных платежей по истории: одинаковый комментарий в одной категории в разные месяцы,
// а также всё из «Аренды» и «Английского», даже без комментария.
let suggestions = [];
function findRecurringCandidates() {
  const ALWAYS = ['rent', 'english'];
  const LIKELY = ['rent', 'english', 'subscriptions'];
  const groups = new Map();
  for (const x of S.tx) {
    if (x.recId) continue;
    const c = catById(x.categoryId);
    const note = (x.note || '').trim();
    let key;
    if (c && ALWAYS.includes(c.key)) key = `c:${x.categoryId}`;   // аренда, английский — вся категория один платёж
    else if (note) key = `n:${x.categoryId}:${note.toLowerCase()}`;
    else continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  const today = todayStr();
  const out = [];
  for (const [key, items] of groups) {
    items.sort((a, b) => a.date.localeCompare(b.date));
    const c = catById(items[0].categoryId);
    const months = new Set(items.map((x) => x.date.slice(0, 7))).size;
    const likely = c && LIKELY.includes(c.key);
    const last = items[items.length - 1];
    const amounts = items.filter((x) => x.currency === last.currency).map((x) => x.amount);
    const stable = Math.max(...amounts) / Math.min(...amounts) <= 1.05;
    // в остальных категориях повторяющийся комментарий — это скорее привычка («Пиво»), чем платёж:
    // берём только если 3+ месяца подряд и сумма почти не меняется
    if (!likely && !(months >= 3 && stable)) continue;
    const name = key.startsWith('c:') ? catName(c) : last.note.trim();
    if (S.rec.some((r) => recName(r).toLowerCase() === name.toLowerCase() || (key.startsWith('c:') && r.categoryId === c.id))) continue;
    const day = parse(last.date).getDate();
    let next = addMonths(last.date, 1, day);
    while (next <= today) next = addMonths(next, 1, day);
    out.push({
      name, byCat: key.startsWith('c:'), categoryId: c?.id, amount: last.amount, currency: last.currency, day, next, count: items.length, months,
      lastDate: last.date, variable: Math.max(...amounts) / Math.min(...amounts) > 1.02,
      checked: likely && (months >= 2 || ALWAYS.includes(c.key)),
    });
  }
  return out.sort((a, b) => b.checked - a.checked || b.months - a.months || b.amount - a.amount);
}
function openSuggest() {
  suggestions = findRecurringCandidates();
  if (!suggestions.length) { toast(t('sugg_none')); return; }
  const ul = $('#suggest-list');
  ul.innerHTML = '';
  suggestions.forEach((s, i) => {
    const c = catById(s.categoryId);
    const li = el('li', '', `
      <input type="checkbox" data-i="${i}" class="pick" ${s.checked ? 'checked' : ''}>
      <span class="emo">${esc(c?.emoji || '🔁')}</span>
      <span class="grow"><div class="t1">${esc(s.name)}</div>
        <div class="t2">${esc(t('sugg_times', { n: s.count, d: short(s.lastDate, true) }))}</div>
        <label class="var"><input type="checkbox" data-i="${i}" class="vary" ${s.variable ? 'checked' : ''}>${esc(t('varies'))}</label></span>
      <span class="right">${esc(fmt(s.amount, s.currency))}</span>`);
    ul.append(li);
  });
  openSheet('#sheet-suggest');
}
async function confirmSuggest() {
  const picks = [...document.querySelectorAll('#suggest-list .pick')].filter((x) => x.checked).map((x) => +x.dataset.i);
  const rules = picks.map((i) => {
    const s = suggestions[i];
    return {
      id: uid(), name: s.byCat ? null : s.name, amount: s.amount, currency: s.currency, categoryId: s.categoryId, every: 1, unit: 'month',
      next: s.next, day: s.day, active: true, variable: document.querySelector(`#suggest-list .vary[data-i="${i}"]`).checked,
    };
  });
  if (rules.length) { await dbPutMany('rec', rules); S.rec.push(...rules); }
  closeSheet();
  renderAll();
  if (rules.length) toast(tn('sugg_added', rules.length));
}

/* ============================== Конвертер, курс, язык ============================== */

let convCur = 'VND';
function renderConv() {
  segment($('#conv-cur'), curItems(), convCur, (v) => { convCur = v; renderConv(); });
  const v = parseAmount($('#conv-amount').value) || 0;
  const out = $('#conv-out');
  out.innerHTML = '';
  for (const c of CUR_ORDER.filter((y) => y !== convCur)) {
    out.append(el('div', '', `<span class="muted">${esc(t('cur_' + c))}</span><b>${esc(fmt(conv(v, convCur, c), c, { dec: CUR[c].dec }))}</b>`));
  }
  const r = S.settings.rates;
  $('#conv-rates').textContent = `1 ₽ = ${fmt(r.VND / r.RUB, 'VND')} · 1 $ = ${fmt(r.VND, 'VND')} · ${ratesStatus()}`;
  const steps = [10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000];
  $('#conv-cheat').innerHTML = steps.map((s) => `<tr><td>${esc(fmt(s, 'VND'))}</td><td>${esc(fmt(conv(s, 'VND', 'RUB'), 'RUB', { dec: 0 }))}</td><td>${esc(fmt(conv(s, 'VND', 'USD'), 'USD', { dec: s < 100000 ? 2 : 0 }))}</td></tr>`).join('');
}
function ratesStatus() {
  if (S.settings.ratesSource === 'api') return t('rates_api', { d: short(S.settings.ratesDate, true) });
  if (S.settings.ratesSource === 'manual') return t('rates_manual');
  return t('rates_default');
}
function renderSettings() {
  segment($('#lang-seg'), LANGS, lang(), async (v) => { S.settings.lang = v; await saveSettings(); applyI18n(); renderAll(); });
  segment($('#default-cur'), curItems(), S.settings.inputCur, async (v) => { S.settings.inputCur = v; await saveSettings(); });
  const r = S.settings.rates;
  if (document.activeElement !== $('#rate-vnd')) $('#rate-vnd').value = round(r.VND, 2);
  if (document.activeElement !== $('#rate-rub')) $('#rate-rub').value = round(r.RUB, 4);
  $('#rates-info').textContent = t('rates_info', { m: fmt(1e6, 'VND'), v: fmt(conv(1e6, 'VND', 'RUB'), 'RUB', { dec: 0 }), s: ratesStatus() });
}
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
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const rows = [...list].sort((a, b) => a.date.localeCompare(b.date)).map((x) => [
    x.date, wd[parse(x.date).getDay()], x.amount, x.currency,
    Math.round(txIn(x, 'VND')), round(txIn(x, 'RUB'), 2), round(txIn(x, 'USD'), 2),
    catName(catById(x.categoryId)), x.note || '', x.recId ? 'yes' : '',
  ].map(csvCell).join(','));
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
  const list = S.tx.filter((x) => (!a || x.date >= a) && (!b || x.date <= b));
  if (!list.length) { toast(t('no_expenses_export')); return; }
  const first = a || list.reduce((m, x) => (x.date < m ? x.date : m), '9999');
  const last = b || list.reduce((m, x) => (x.date > m ? x.date : m), '0000');
  shareFile(`expenses_${first}_${last}.csv`, buildCsv(list), 'text/csv');
}
async function backup() {
  const data = { app: 'trati', version: 2, exportedAt: new Date().toISOString(), settings: S.settings, categories: S.cats, recurring: S.rec, transactions: S.tx };
  await shareFile(`expenses_backup_${todayStr()}.json`, JSON.stringify(data), 'application/json');
  S.settings.lastBackup = todayStr();
  await saveSettings();
  renderStorageInfo();
}
async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'trati' || !Array.isArray(data.transactions)) throw new Error('format');
    if (!confirm(t('restore_confirm', { d: short(data.exportedAt.slice(0, 10), true), n: data.transactions.length }))) return;
    for (const s of ['tx', 'cats', 'rec']) await dbClear(s);
    await dbPutMany('cats', data.categories || []);
    await dbPutMany('rec', data.recurring || []);
    await dbPutMany('tx', data.transactions);
    S.settings = { ...DEFAULT_SETTINGS, ...data.settings, catsSeeded: true };
    await saveSettings();
    await loadAll();
    await migrateCategories();
    applyI18n();
    renderAll();
    toast(t('restored'));
  } catch (e) {
    toast(t('not_backup'));
  }
}
async function renderStorageInfo() {
  const parts = [t('storage_n', { n: S.tx.length })];
  if (S.settings.lastBackup) parts.push(t('last_backup', { d: short(S.settings.lastBackup, true) }));
  else if (S.tx.length) parts.push(t('no_backup'));
  try { if (navigator.storage?.persisted && (await navigator.storage.persisted())) parts.push(t('persisted')); } catch (_) {}
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
    s.onerror = () => rej(new Error(t('excel_fail')));
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
// Куда попадёт категория из файла: {id} — существующая, {key} — новая стандартная, {name} — новая своя.
function resolveImportCat(src) {
  const n = String(src || '').trim().toLowerCase();
  if (!n) return resolveKey('other');
  const exact = S.cats.find((c) => [c.name, c.key && T.en[`cat_${c.key}`], c.key && T.ru[`cat_${c.key}`]].some((x) => x && x.toLowerCase() === n));
  if (exact) return { id: exact.id };
  if (CAT_ALIASES[n]) return resolveKey(CAT_ALIASES[n]);
  return { name: String(src).trim() };
}
function resolveKey(key) { const c = S.cats.find((x) => x.key === key); return c ? { id: c.id } : { key }; }
const targetName = (tg) => (tg.id ? catName(catById(tg.id)) : tg.key ? t(`cat_${tg.key}`) : tg.name);
const targetEmoji = (tg) => (tg.id ? catById(tg.id).emoji : tg.key ? keyEmoji(tg.key) : guessEmoji(tg.name));
const targetId = (tg) => tg.id || (tg.key ? `key:${tg.key}` : `name:${tg.name.toLowerCase()}`);
function keyEmoji(key) { return (DEFAULT_CATS.find((d) => d[0] === key) || [null, ...(EXTRA_KEYS[key] || ['🏷️'])])[1]; }
function keyColor(key) { const d = DEFAULT_CATS.find((x) => x[0] === key); return d ? d[2] : (EXTRA_KEYS[key] || [null, S.cats.length % SLOTS])[1]; }

async function importMM(file) {
  try {
    const XLSX = await loadSheetJS();
    // даты читаем как числа Excel и переводим сами: так не бывает сдвига на день из-за часового пояса
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames.find((n) => /expense|расход/i.test(n)) || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    const hi = rows.findIndex((r) => { const c = findCols(r); return c.date != null && c.category != null && (c.amount != null || c.mainAmount != null || c.defAmount != null); });
    if (hi < 0) throw new Error(t('no_cols'));
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
        const main = cols.mainAmount != null ? String(rows[hi][cols.mainAmount]).trim().toUpperCase() : '';
        if (cols.mainAmount != null && CUR[main]) { amount = Math.abs(parseAmount(r[cols.mainAmount])); currency = main; }
        else currency = S.settings.inputCur;
      }
      if (!date || !(amount > 0)) { bad++; continue; }
      const sub = cols.sub != null ? String(r[cols.sub]).trim() : '';
      const note = [cols.note, cols.desc, cols.tags].map((c) => (c != null ? String(r[c]).trim() : '')).filter(Boolean).join(' — ');
      const srcCat = String(r[cols.category]).trim();
      items.push({ date, amount: roundCur(amount, currency), currency, srcCat, target: resolveImportCat(srcCat), note: [sub, note].filter(Boolean).join(': ') });
    }
    if (!items.length) throw new Error(t('no_expenses_file'));
    // дубликаты: такая же дата+сумма+категория+комментарий уже есть
    const key = (d, a, c, n) => `${d}|${a}|${c}|${n}`;
    const existing = new Set(S.tx.map((x) => key(x.date, x.amount, x.categoryId, x.note || '')));
    const fresh = items.filter((i) => !(i.target.id && existing.has(key(i.date, i.amount, i.target.id, i.note))));
    const dates = fresh.map((i) => i.date).sort();
    pendingImport = { items: fresh };
    const byCur = {};
    fresh.forEach((i) => { byCur[i.currency] = (byCur[i.currency] || 0) + 1; });
    $('#import-preview').innerHTML = `
      <p>${t('imp_found', { n: items.length })}${items.length !== fresh.length ? t('imp_new', { n: fresh.length }) : ''}.</p>
      ${fresh.length ? `<p>${esc(t('imp_period', { a: short(dates[0], true), b: short(dates[dates.length - 1], true), c: Object.entries(byCur).map(([c, n]) => `${c} (${n})`).join(', ') }))}</p>` : ''}
      ${fresh.length ? catMapHtml(fresh) : ''}
      ${skippedIncome ? `<p class="muted small">${esc(t('imp_skipped', { n: skippedIncome }))}</p>` : ''}
      ${bad ? `<p class="warn small">${esc(t('imp_bad', { n: bad }))}</p>` : ''}`;
    $('#import-ok').disabled = !fresh.length;
    openSheet('#sheet-import');
  } catch (e) {
    toast(e.message || t('read_fail'));
  }
}
// Таблица «категория в файле → категория здесь», чтобы перед импортом было видно, куда что попадёт.
function catMapHtml(items) {
  const m = new Map();
  for (const i of items) {
    const k = `${i.srcCat}→${targetId(i.target)}`;
    const e = m.get(k) || { src: i.srcCat, tg: i.target, n: 0 };
    e.n++;
    m.set(k, e);
  }
  const rows = [...m.values()].sort((a, b) => b.n - a.n).map((e) => `<tr><td>${esc(e.src || '—')}</td><td>→ ${esc(targetEmoji(e.tg) + ' ' + targetName(e.tg))}${e.tg.id ? '' : ` <span class="muted">${esc(t('imp_newcat'))}</span>`}</td><td style="text-align:right">${e.n}</td></tr>`);
  return `<p class="small">${esc(t('imp_cats'))}</p><table>${rows.join('')}</table><p></p>`;
}
async function confirmImport() {
  if (!pendingImport) return;
  const { items } = pendingImport;
  let order = Math.max(0, ...S.cats.map((c) => c.order));
  const ids = new Map();
  for (const i of items) {
    const tid = targetId(i.target);
    if (i.target.id || ids.has(tid)) continue;
    const c = i.target.key
      ? { id: uid(), key: i.target.key, name: null, emoji: keyEmoji(i.target.key), color: keyColor(i.target.key), order: ++order, archived: false }
      : { id: uid(), name: i.target.name, emoji: guessEmoji(i.target.name), color: S.cats.length % SLOTS, order: ++order, archived: false };
    S.cats.push(c);
    await dbPut('cats', c);
    ids.set(tid, c.id);
  }
  const now = new Date().toISOString();
  const txs = items.map((i) => ({ id: uid(), createdAt: now, date: i.date, amount: i.amount, currency: i.currency, categoryId: i.target.id || ids.get(targetId(i.target)), note: i.note, source: 'moneymanager' }));
  await dbPutMany('tx', txs);
  S.tx.push(...txs);
  pendingImport = null;
  closeSheet();
  renderAll();
  toast(t('imported', { n: txs.length }));
}
function guessEmoji(name) {
  const n = String(name).toLowerCase();
  const map = [
    [/food|еда|продукт|grocer|супермаркет/, '🛒'], [/cafe|кафе|ресторан|restaurant|eat|обед|ужин/, '🍜'], [/coffee|кофе/, '☕'],
    [/delivery|доставк/, '🥡'], [/сиг|cigar|smok|курен/, '🚬'], [/англ|english|язык|language/, '🇬🇧'],
    [/transport|транспорт|taxi|такси|grab|bike|байк|бензин|fuel/, '🛵'], [/rent|аренд|квартир/, '🔑'], [/жиль|house|home|дом/, '🏠'],
    [/phone|связь|интернет|подпис|subscr/, '📱'], [/health|здоров|аптек|врач|medic/, '💊'], [/fun|развлеч|entertain|кино|бар|party|leisure/, '🎉'],
    [/cloth|одежд/, '👕'], [/shop|покуп/, '🛍️'], [/travel|путеш|отпуск|trip|отел|hotel/, '✈️'], [/gift|подар/, '🎁'],
    [/beauty|красот|салон/, '💅'], [/sport|спорт|gym|зал|workout/, '🏋️'], [/educat|образов|курс|книг|book/, '📚'], [/pet|питом|кот|собак/, '🐾'],
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
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.id === `tab-${name}`));
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);
  if (name === 'main') renderMain();
}
const add000 = (sel, after) => () => { const a = $(sel); a.value = (a.value || '') + '000'; after && after(); };

function bind() {
  $('#period-seg').addEventListener('click', (e) => {
    const p = e.target.closest('button')?.dataset.p;
    if (!p) return;
    if (p === 'custom' && !S.from) { const [a, b] = currentRange(); S.from = a; S.to = b > todayStr() ? todayStr() : b; }
    // при смене периода всегда показываем текущий: сегодня, эту неделю, этот месяц, этот год
    S.period = p; S.anchor = todayStr(); S.txLimit = 60;
    rerender();
  });
  $('#prev-period').onclick = () => { S.anchor = shiftAnchor(S.anchor, S.period, -1); rerender(); };
  $('#next-period').onclick = () => { S.anchor = shiftAnchor(S.anchor, S.period, 1); rerender(); };
  $('#period-label').onclick = () => { S.anchor = todayStr(); rerender(); };
  $('#range-from').onchange = (e) => { if (e.target.value) { S.from = e.target.value; if (S.to < S.from) S.to = S.from; rerender(); } };
  $('#range-to').onchange = (e) => { if (e.target.value) { S.to = e.target.value; if (S.from > S.to) S.from = S.to; rerender(); } };
  $('#view-cur').onclick = async () => {
    S.settings.viewCur = CUR_ORDER[(CUR_ORDER.indexOf(S.settings.viewCur) + 1) % CUR_ORDER.length];
    await saveSettings(); rerender();
  };
  $('#tx-fold-btn').onclick = () => toggleFold('tx');
  $('#cat-fold-btn').onclick = () => toggleFold('cat');
  $('#clear-filter').onclick = () => { S.catFilter = null; rerender(); };
  $('#rec-toggle').onclick = async () => { S.settings.hideRec = !S.settings.hideRec; await saveSettings(); rerender(); };
  $('#donut').addEventListener('click', () => { if (S.catFilter) { S.catFilter = null; rerender(); } });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderMain, 150); });

  $('#fab').onclick = () => openTxSheet(null);
  $('#backdrop').onclick = closeSheet;
  document.querySelectorAll('.sheet-x').forEach((b) => (b.onclick = closeSheet));
  document.querySelectorAll('.sheet').forEach(swipeToClose);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

  // шторка траты
  $('#tx-amount').addEventListener('input', updateAmountHint);
  $('#tx-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#tx-amount').blur(); } });
  $('#tx-000').onclick = add000('#tx-amount', updateAmountHint);
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
  $('#rec-000').onclick = add000('#rec-amount');
  $('#rec-suggest').onclick = openSuggest;
  $('#suggest-ok').onclick = confirmSuggest;
  $('#suggest-cancel').onclick = closeSheet;

  // конвертер и курс
  $('#conv-amount').addEventListener('input', renderConv);
  $('#conv-000').onclick = add000('#conv-amount', renderConv);
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
    if (!confirm(t('wipe1'))) return;
    if (!confirm(t('wipe2'))) return;
    for (const s of ['tx', 'cats', 'rec', 'kv']) await dbClear(s);
    location.reload();
  };

  // при возвращении в приложение — новый день, регулярные траты, курс
  let openedOn = todayStr();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    // приложение пролежало открытым до следующего дня — переходим на новый «сегодня»
    if (openedOn !== todayStr()) { openedOn = todayStr(); S.anchor = openedOn; }
    await runRecurring();
    renderAll();
    if (S.settings.ratesSource !== 'manual' && S.settings.ratesDate !== todayStr()) refreshRates(false);
  });
}

/* ============================== Категории: начальный набор и миграции ============================== */

async function seedCategories() {
  const cats = DEFAULT_CATS.map(([key, emoji, color], i) => ({ id: uid(), key, name: null, emoji, color, order: i, archived: false }));
  await dbPutMany('cats', cats);
  S.settings.catsSeeded = true;
  S.settings.catsVersion = 3;
  await saveSettings();
}
async function migrateCategories() {
  const v = S.settings.catsVersion || 1;
  if (v >= 3) return;
  // v1: самый первый набор, если его не трогали, заменяем целиком
  const untouchedV1 = v < 2 && !S.tx.length && !S.rec.length && S.cats.length === OLD_DEFAULT_NAMES.length
    && S.cats.every((c) => OLD_DEFAULT_NAMES.includes(c.name) && !c.archived);
  if (untouchedV1) {
    await dbClear('cats');
    await seedCategories();
    S.cats = await dbAll('cats');
    return;
  }
  // v1/v2: категориям со стандартными названиями присваиваем ключ, чтобы они переводились. id не меняются.
  for (const c of S.cats) {
    if (c.key || !c.name) continue;
    const key = CAT_ALIASES[c.name.trim().toLowerCase()];
    if (!key || S.cats.some((x) => x.key === key)) continue;
    c.key = key;
    c.name = null;
    await dbPut('cats', c);
  }
  S.settings.catsVersion = 3;
  await saveSettings();
}

async function init() {
  db = await openDB();
  S.settings = { ...DEFAULT_SETTINGS, ...((await kvGet('settings')) || {}) };
  if (!S.settings.catsSeeded) await seedCategories();
  await loadAll();
  await migrateCategories();
  applyI18n();
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
