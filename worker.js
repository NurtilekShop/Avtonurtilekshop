/**
 * Nurtilek Shop — Telegram bot on Cloudflare Workers
 * KV binding: DB
 * Vars/secrets: BOT_TOKEN, DONIX_API_KEY, DONIX_WEBHOOK_SECRET, ADMIN_ID,
 *   FINIK_API_KEY, FINIK_PRIVATE_KEY, FINIK_PUBLIC_KEY, FINIK_ACCOUNT_ID,
 *   FINIK_ENV ("beta" or "prod"), APP_BASE_URL,
 *   REVIEWS_CHAT_ID (чат/канал, куда бот публикует выполненные покупки),
 *   SECOND_API_KEY (ключ MVP Resellers, rk_live_…), SECOND_WEBHOOK_SECRET (секрет подписи вебхуков MVP)
 */

import { Signer } from "@mancho.devs/authorizer";
import APP_HTML from "./app-html.js";

const DONIX_BASE = "https://back.donix.org/api/partner/v1";

/* ================= FINIK PAYMENTS ================= */

function finikBaseUrl(env) {
  return env.FINIK_ENV === "prod"
    ? "https://api.acquiring.averspay.kg"
    : "https://beta.api.acquiring.averspay.kg";
}

/**
 * Creates a Finik QR payment and returns the hosted payment page URL.
 * amount: number in KGS (сом). paymentId: unique id, <= 36 chars (a UUID works).
 */
async function createFinikPayment(env, { amount, paymentId, redirectUrl, description, lang }) {
  const baseUrl = finikBaseUrl(env);
  const path = "/v1/payment";
  const host = new URL(baseUrl).host;
  const timestamp = Date.now().toString();

  const body = {
    Amount: amount,
    CardType: "FINIK_QR",
    PaymentId: paymentId,
    RedirectUrl: redirectUrl,
    Data: {
      accountId: env.FINIK_ACCOUNT_ID,
      name_en: "Nurtilek Shop",
      webhookUrl: `${env.APP_BASE_URL}/payment-webhook`,
      description: description || `Nurtilek Shop payment ${paymentId}`,
      Lang: lang === "kg" ? "ky" : "ru",
    },
  };

  const requestData = {
    httpMethod: "POST",
    path,
    headers: {
      Host: host,
      "x-api-key": env.FINIK_API_KEY,
      "x-api-timestamp": timestamp,
    },
    queryStringParameters: undefined,
    body,
  };

  const signature = await new Signer(requestData).sign(env.FINIK_PRIVATE_KEY);

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.FINIK_API_KEY,
      "x-api-timestamp": timestamp,
      signature,
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });

  if (res.status === 302) {
    const paymentUrl = res.headers.get("location");
    return { ok: true, paymentUrl };
  }

  let errorData = null;
  try {
    errorData = await res.json();
  } catch {
    // ignore parse failure
  }
  console.log("Finik create payment error", res.status, JSON.stringify(errorData));
  if (env.DB) await logEvent(env.DB, "finik", `создание платежа: HTTP ${res.status} ${JSON.stringify(errorData)}`);
  return { ok: false, status: res.status, error: errorData };
}

/**
 * Verifies the signature of an incoming Finik webhook request.
 * rawBody: the raw request body text (already read once).
 */
async function verifyFinikWebhookSignature(env, request, rawBody, url) {
  const signature = request.headers.get("signature");
  if (!signature) return false;

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const requestData = {
    httpMethod: "POST",
    path: url.pathname,
    headers: {
      Host: request.headers.get("host") || new URL(env.APP_BASE_URL).host,
      "x-api-timestamp": request.headers.get("x-api-timestamp") || "",
    },
    queryStringParameters: null,
    body,
  };

  try {
    return await new Signer(requestData).verify(env.FINIK_PUBLIC_KEY, signature);
  } catch (e) {
    console.log("Finik signature verify error", String(e));
    return false;
  }
}

/* ================= TRANSLATIONS ================= */

const T = {
  ru: {
    main_menu: "Главное меню Nurtilek Shop 🛍",
    btn_freefire: "🔥 Free Fire",
    btn_pubg: "🔫 PUBG Mobile",
    btn_mlbb: "⚔️ Mobile Legends",
    btn_codm: "🎯 Call of Duty Mobile",
    btn_genshin: "✨ Genshin Impact",
    btn_roblox: "🔲 Roblox",
    btn_mvp_test: "🧪 MVP тест",
    btn_hsr: "🚂 Honkai: Star Rail",
    btn_arena: "🪖 Arena Breakout",
    btn_rivals: "🦸 Marvel Rivals",
    btn_oxide: "🏝 Oxide Survival",
    btn_discord: "💬 Discord",
    btn_steam: "🎮 Steam",
    btn_tg: "⭐ Telegram",
    btn_games: "🎮 Игры и сервисы",
    enter_player_id_generic: "Введите ID игрока:",
    enter_discord_id: "Введите данные аккаунта Discord (логин / ID):",
    enter_steam_login: "Введите логин Steam (account name):",
    steam_choose_amount: "Выберите сумму пополнения Steam в долларах или введите свою:",
    steam_custom_btn: "✏️ Своя сумма",
    steam_custom_prompt: (min, max) => `Напишите сумму в долларах (от ${min} до ${max}), например 7.5:`,
    steam_bad_amount: (min, max) => `❌ Введите число от ${min} до ${max}.`,
    steam_rate_line: (r) => `Курс: ${r} сом за $1`,
    btn_wallet: "💰 Кошелёк",
    btn_orders: "📦 Мои заказы",
    btn_promo: "🎟 Промокод",
    btn_reviews: "⭐ Отзывы",
    btn_channel: "📢 Канал",
    btn_support: "🆘 Поддержка",
    btn_lang: "🌐 Язык",
    btn_profile: "👤 Профиль",
    btn_back: "⬅️ Назад",
    btn_home: "🏠 Главное меню",
    btn_confirm: "✅ Подтвердить",
    btn_cancel: "❌ Отмена",
    btn_retry: "🔄 Попробовать снова",
    btn_prices: "💰 Цены",
    btn_qty_confirm: "✅ Далее",
    choose_category: "Выберите раздел:",
    choose_product: "Выберите товар:",
    choose_qty: "Выберите количество:",
    qty_line: (n) => `Количество: ${n} (макс. 10)`,
    qty_total_line: (s) => `Сумма: ${s} сом`,
    cart_title: "🛒 Товары",
    cart_empty: "Товары не выбраны",
    btn_cart_next: "✅ Далее",
    btn_cart_reset: (s) => `🔄 Сброс • ${s} сом`,
    cart_max_reached: "❌ Максимум 10 шт. этого товара.",
    cart_choose_at_least_one: "❌ Выберите хотя бы один товар.",
    prices_title: "💰 Цены:",
    enter_uid_ff: "Введите UID Free Fire:",
    enter_uid_pubg: "Введите PUBG ID:",
    enter_uid_codm: "Введите ID Call of Duty Mobile (регион Казахстан):",
    enter_uid_genshin: "Введите UID Genshin Impact:",
    codm_invalid_id: "❌ ID не найден.\n\nЛибо вы неверно ввели ID, либо это не регион Казахстан.\nПроверьте и попробуйте ещё раз.",
    enter_player_id_mlbb: "Введите Player ID:",
    enter_server_id_mlbb: "Введите Server ID:",
    enter_username_tg: "Введите @username:",
    enter_stars_amount: "Выберите количество Stars кнопкой или напишите своё (от 50 до 5000):",
    stars_rate_line: (rate) => `Курс: ${rate} сом за 1 звезду ⭐`,
    validating: "⏳ Проверяю данные...",
    service_unavailable: "⚠️ Сервис временно недоступен. Попробуйте позже.",
    invalid_input: "❌ Неверные данные. Проверьте и попробуйте снова.",
    invalid_game_id: "❌ ID неверный.\n\nПроверьте ID или попробуйте ещё раз.",
    order_created: (n) => `Заказ создан.\nНомер заказа: ${n}`,
    price_label: "Цена",
    discount_label: "Скидка",
    total_label: "К оплате",
    profile_title: "👤 Ваш профиль",
    profile_id: "ID",
    profile_username: "Никнейм",
    profile_balance: "Баланс",
    profile_spent: "Всего потрачено",
    wallet_title: "💰 Кошелёк",
    wallet_balance: "Баланс",
    wallet_topup: "➕ Пополнить",
    wallet_history: "📜 История",
    wallet_enter_amount: "Введите сумму пополнения в сомах:",
    wallet_topup_created: "Заявка на пополнение создана. Ожидайте подтверждения оплаты.",
    orders_empty: "У вас пока нет заказов.",
    orders_title: "📦 Ваши заказы:",
    order_details: "Детали заказа",
    promo_enter: "Введите промокод:",
    promo_applied: (d) => `Промокод применён. Скидка: ${d} сом`,
    promo_invalid: "❌ Промокод недействителен.",
    promo_activated: "✅ Промокод активирован",
    gift_activated: (n) => `🎁 Промокод активирован!\nВам полагается бесплатно: ${n}`,
    gift_failed: "❌ Не удалось выполнить заказ. Промокод возвращён — попробуйте ввести его снова чуть позже.",
    promo_admin_create_hint:
      "Отправьте промокод в формате:\nCODE;TYPE;VALUE;USES;DAYS;MINSUM\nTYPE = percent или fixed\nПример: SALE10;percent;10;100;30;500",
    lang_choose: "Выберите язык:",
    lang_set: "Язык изменён на Русский",
    admin_panel: "⚙️ Админ-панель",
    admin_only: "⛔ Доступ запрещён.",
    processing: "⏳ Заказ обрабатывается.",
    completed: "✅ Заказ успешно выполнен.",
    failed: "❌ Не удалось выполнить заказ. Средства возвращены на кошелёк.",
    refunded: "💸 Средства возвращены на кошелёк.",
    insufficient_balance: "❌ Недостаточно средств на балансе.",
    kg_som: "сом",
    btn_referral: "🤝 Рефералка",
    btn_pay_balance: "💰 С баланса",
    btn_pay_bank: "🏦 Банк (MBank, О!Деньги и др.)",
    btn_pay_terminal: "🧾 Терминал",
    choose_payment_method: "Выберите способ оплаты:",
    bank_pay_hint: "Нажмите «Оплатить» — откроется страница для оплаты картой или через приложение банка (MBank, О!Деньги, Bakai24, Элсом, Optima Bank и другие).",
    terminal_instructions:
      "Нажмите кнопку ниже — откроется личный чат с администратором с уже готовым текстом. Просто отправьте его и приложите чек об оплате.",
    terminal_dm_button: "📩 Написать администратору",
    order_completed_review_hint: "Будем рады, если оставите отзыв 🙂",
    btn_leave_review: "⭐ Оставить отзыв",
    referral_rate_line: (p) => `Ваша текущая ставка: ${p}%`,
    referral_link_label: "Ваша реферальная ссылка",
    referral_earned_label: "Заработано с рефералов",
    status_pending_payment: "🟡 Ожидает оплаты",
    status_processing: "🟡 В обработке",
    status_paid: "🟡 В обработке",
    status_completed: "🟢 Выполнен",
    status_cancelled: "🔴 Отменён",
    status_failed: "🔴 Не выполнен",
    status_refunded: "🔴 Возврат средств",
    partial_title: (n) => `⚠️ Заказ №${n} выполнен частично.`,
    partial_done: "✅ Выполнено:",
    partial_failed: "❌ Не выполнено (деньги возвращены на кошелёк):",
    partial_refund_total: "💸 Возвращено на кошелёк",
    balance_promo_ok: (a, b) => `🎁 Промокод активирован!\nНа баланс зачислено: +${a} сом\nВаш баланс: ${b} сом`,
  },
  kg: {
    main_menu: "Nurtilek Shop башкы менюсу 🛍",
    btn_freefire: "🔥 Free Fire",
    btn_pubg: "🔫 PUBG Mobile",
    btn_mlbb: "⚔️ Mobile Legends",
    btn_codm: "🎯 Call of Duty Mobile",
    btn_genshin: "✨ Genshin Impact",
    btn_roblox: "🔲 Roblox",
    btn_mvp_test: "🧪 MVP тест",
    btn_hsr: "🚂 Honkai: Star Rail",
    btn_arena: "🪖 Arena Breakout",
    btn_rivals: "🦸 Marvel Rivals",
    btn_oxide: "🏝 Oxide Survival",
    btn_discord: "💬 Discord",
    btn_steam: "🎮 Steam",
    btn_tg: "⭐ Telegram",
    btn_games: "🎮 Оюндар жана кызматтар",
    enter_player_id_generic: "Оюнчунун ID киргизиңиз:",
    enter_discord_id: "Discord аккаунтунун маалыматын киргизиңиз (логин / ID):",
    enter_steam_login: "Steam логинин киргизиңиз (account name):",
    steam_choose_amount: "Steam толуктоо суммасын доллар менен тандаңыз же өзүңүз киргизиңиз:",
    steam_custom_btn: "✏️ Өз суммам",
    steam_custom_prompt: (min, max) => `Доллар менен сумманы жазыңыз (${min}ден ${max} чейин), мисалы 7.5:`,
    steam_bad_amount: (min, max) => `❌ ${min}ден ${max} чейинки санды киргизиңиз.`,
    steam_rate_line: (r) => `Курс: $1 = ${r} сом`,
    btn_wallet: "💰 Капчык",
    btn_orders: "📦 Менин буйрутмаларым",
    btn_promo: "🎟 Промокод",
    btn_reviews: "⭐ Пикирлер",
    btn_channel: "📢 Канал",
    btn_support: "🆘 Колдоо",
    btn_lang: "🌐 Тил",
    btn_profile: "👤 Профиль",
    btn_back: "⬅️ Артка",
    btn_home: "🏠 Башкы меню",
    btn_confirm: "✅ Ырастоо",
    btn_cancel: "❌ Жокко чыгаруу",
    btn_retry: "🔄 Кайра аракет кылуу",
    btn_prices: "💰 Баалар",
    btn_qty_confirm: "✅ Кийинки",
    choose_category: "Бөлүмдү тандаңыз:",
    choose_product: "Товарды тандаңыз:",
    choose_qty: "Санын тандаңыз:",
    qty_line: (n) => `Саны: ${n} (макс. 10)`,
    qty_total_line: (s) => `Сумма: ${s} сом`,
    cart_title: "🛒 Товарлар",
    cart_empty: "Товарлар тандалган жок",
    btn_cart_next: "✅ Кийинки",
    btn_cart_reset: (s) => `🔄 Тазалоо • ${s} сом`,
    cart_max_reached: "❌ Бул товардан макс. 10 даана.",
    cart_choose_at_least_one: "❌ Жок дегенде бир товар тандаңыз.",
    prices_title: "💰 Баалар:",
    enter_uid_ff: "Free Fire UID киргизиңиз:",
    enter_uid_pubg: "PUBG ID киргизиңиз:",
    enter_uid_codm: "Call of Duty Mobile ID киргизиңиз (Казахстан региону):",
    enter_uid_genshin: "Genshin Impact UID киргизиңиз:",
    codm_invalid_id: "❌ ID табылган жок.\n\nЖаңылыш ID киргизген окшойсуз, же бул Казахстан региону эмес.\nТекшерип, кайра аракет кылыңыз.",
    enter_player_id_mlbb: "Player ID киргизиңиз:",
    enter_server_id_mlbb: "Server ID киргизиңиз:",
    enter_username_tg: "@username киргизиңиз:",
    enter_stars_amount: "Stars санын баскыч менен тандаңыз же өзүңүз жазыңыз (50дөн 5000 чейин):",
    stars_rate_line: (rate) => `Курс: ${rate} сом 1 жылдызга ⭐`,
    validating: "⏳ Текшерилүүдө...",
    service_unavailable: "⚠️ Кызмат убактылуу жеткиликсиз. Кийинчерээк аракет кылыңыз.",
    invalid_input: "❌ Туура эмес маалымат. Кайра аракет кылыңыз.",
    invalid_game_id: "❌ ID туура эмес.\n\nID'ни текшериңиз же кайра аракет кылыңыз.",
    order_created: (n) => `Буйрутма түзүлдү.\nБуйрутма номери: ${n}`,
    price_label: "Баасы",
    discount_label: "Арзандатуу",
    total_label: "Төлөнүүчү сумма",
    profile_title: "👤 Сиздин профилиңиз",
    profile_id: "ID",
    profile_username: "Никнейм",
    profile_balance: "Баланс",
    profile_spent: "Жалпы коротулган",
    wallet_title: "💰 Капчык",
    wallet_balance: "Баланс",
    wallet_topup: "➕ Толуктоо",
    wallet_history: "📜 Тарых",
    wallet_enter_amount: "Толуктоо суммасын сом менен киргизиңиз:",
    wallet_topup_created: "Толуктоо өтүнүчү түзүлдү. Төлөмдүн ырасталышын күтүңүз.",
    orders_empty: "Сизде азырынча буйрутма жок.",
    orders_title: "📦 Сиздин буйрутмаларыңыз:",
    order_details: "Буйрутма чоо-жайы",
    promo_enter: "Промокодду киргизиңиз:",
    promo_applied: (d) => `Промокод колдонулду. Арзандатуу: ${d} сом`,
    promo_invalid: "❌ Промокод жараксыз.",
    promo_activated: "✅ Промокод активтештирилди",
    gift_activated: (n) => `🎁 Промокод активдештирилди!\nСизге акысыз берилет: ${n}`,
    gift_failed: "❌ Буйрутма аткарылган жок. Промокод кайтарылды — бир аздан кийин кайра киргизип көрүңүз.",
    promo_admin_create_hint:
      "Промокодду форматта жөнөтүңүз:\nCODE;TYPE;VALUE;USES;DAYS;MINSUM\nTYPE = percent же fixed\nМисал: SALE10;percent;10;100;30;500",
    lang_choose: "Тилди тандаңыз:",
    lang_set: "Тил Кыргызча кылып өзгөртүлдү",
    admin_panel: "⚙️ Админ панели",
    admin_only: "⛔ Уруксат жок.",
    processing: "⏳ Буйрутма иштелүүдө.",
    completed: "✅ Буйрутма ийгиликтүү аткарылды.",
    failed: "❌ Буйрутма аткарылган жок. Каражат капчыкка кайтарылды.",
    refunded: "💸 Каражат капчыкка кайтарылды.",
    insufficient_balance: "❌ Баланста каражат жетишсиз.",
    kg_som: "сом",
    btn_referral: "🤝 Рефералка",
    btn_pay_balance: "💰 Баланстан",
    btn_pay_bank: "🏦 Банк (MBank, О!Деньги ж.б.)",
    btn_pay_terminal: "🧾 Терминал",
    choose_payment_method: "Төлөм ыкмасын тандаңыз:",
    bank_pay_hint: "«Төлөө» баскычын басыңыз — карта менен же банк колдонмосу аркылуу төлөө барагы ачылат (MBank, О!Деньги, Bakai24, Элсом, Optima Bank ж.б.).",
    terminal_instructions:
      "Төмөнкү баскычты басыңыз — администратор менен даяр текст менен жеке чат ачылат. Аны жөнөтүп, төлөм чегин тиркеңиз.",
    terminal_dm_button: "📩 Администраторго жазуу",
    order_completed_review_hint: "Пикир калтырсаңыз кубанычтабыз 🙂",
    btn_leave_review: "⭐ Пикир калтыруу",
    referral_rate_line: (p) => `Учурдагы чегиңиз: ${p}%`,
    referral_link_label: "Сиздин реферал шилтемеңиз",
    referral_earned_label: "Рефералдардан тапкан",
    status_pending_payment: "🟡 Төлөм күтүлүүдө",
    status_processing: "🟡 Иштелүүдө",
    status_paid: "🟡 Иштелүүдө",
    status_completed: "🟢 Аткарылды",
    status_cancelled: "🔴 Жокко чыгарылды",
    status_failed: "🔴 Аткарылган жок",
    status_refunded: "🔴 Каражат кайтарылды",
    partial_title: (n) => `⚠️ №${n} буйрутма жарым-жартылай аткарылды.`,
    partial_done: "✅ Аткарылды:",
    partial_failed: "❌ Аткарылган жок (каражат капчыкка кайтарылды):",
    partial_refund_total: "💸 Капчыкка кайтарылды",
    balance_promo_ok: (a, b) => `🎁 Промокод активдештирилди!\nБалансыңызга кошулду: +${a} сом\nСиздин балансыңыз: ${b} сом`,
  },
};

function t(lang, key, ...args) {
  const table = T[lang] || T.ru;
  const v = table[key] ?? T.ru[key];
  return typeof v === "function" ? v(...args) : v;
}

/* Human-readable label for a wallet history entry ("📜 История"), by entry.type. */
const WALLET_HISTORY_LABELS = {
  ru: {
    topup: "➕ Пополнение",
    purchase: "🛒 Потрачено",
    refund: "💸 Возврат средств",
    referral: "🤝 Реферальный бонус",
    promo: "🎁 Промокод",
  },
  kg: {
    topup: "➕ Толуктоо",
    purchase: "🛒 Коротулду",
    refund: "💸 Каражат кайтарылды",
    referral: "🤝 Реферал бонусу",
    promo: "🎁 Промокод",
  },
};
function walletHistoryTypeLabel(lang, type) {
  const table = WALLET_HISTORY_LABELS[lang] || WALLET_HISTORY_LABELS.ru;
  return table[type] || WALLET_HISTORY_LABELS.ru[type] || type;
}

/* ================= CATALOG ================= */

const CATALOG = {
  freefire: {
    validateNick: true,
    name: "Free Fire",
    inputType: "uid",
    donixCategory: "freefire",
    // fixed: true -> цена задана вручную, /syncprices и cron её не трогают.
    // sku -> точный SKU Donix, автоподбор по названию не нужен.
    items: [
      { id: "ff_110", name: "💎 110", price: 75, sku: "110-алмазов", fixed: true },
      { id: "ff_341", name: "💎 341", price: 228, sku: "341-алмаз", fixed: true },
      { id: "ff_572", name: "💎 572", price: 370, sku: "572-алмаза", fixed: true },
      { id: "ff_1166", name: "💎 1166", price: 745, sku: "1166-алмазов", fixed: true },
      { id: "ff_2398", name: "💎 2398", price: 1459, sku: "2398-алмазов", fixed: true },
      { id: "ff_6160", name: "💎 6160", price: 3702, sku: "6160-алмазов", fixed: true },
      { id: "ff_lite_week", name: "🔹 Lite Ваучер (90💎)", price: 39, sku: "ваучер-на-неделю-лайт", fixed: true,
        popup: "Сразу после покупки вам начисляется 20 алмазов, и 7 дней вы будете получать по 10 алмазов." },
      { id: "ff_week", name: "🔹 Ваучер на неделю (450💎)", price: 149, sku: "ваучер-на-неделю", fixed: true,
        popup: "Сразу после покупки вы получаете 100 алмазов, 7 дней подряд будете получать по 50 алмазов." },
      { id: "ff_month", name: "🔹 Ваучер на месяц (2600💎)", price: 532, sku: "ваучер-на-месяц", fixed: true,
        popup: "Вы получаете сразу при пополнении 500 алмазов, а последующие 30 дней будете получать по 70 алмазов." },
      // Пропуск прокачки — второй поставщик (MVP). Цена MVP (себестоимость): 28 / 49 / 49 / 49 / 49 / 72 сом.
      // popup — подсказка при нажатии («В игре» — сколько это стоит алмазами в игре), warn — показывать условия без возврата.
      { id: "ff_lvl6", name: "🎫 Пропуск прокачки 6 lvl", price: 65, provider: "mvp", providerProductId: "ff.cis.lvl.6", fixed: true, popup: "💎 В игре: 120", warn: true },
      { id: "ff_lvl10", name: "🎫 Пропуск прокачки 10 lvl", price: 89, provider: "mvp", providerProductId: "ff.cis.lvl.10", fixed: true, popup: "💎 В игре: 200", warn: true },
      { id: "ff_lvl15", name: "🎫 Пропуск прокачки 15 lvl", price: 89, provider: "mvp", providerProductId: "ff.cis.lvl.15", fixed: true, popup: "💎 В игре: 200", warn: true },
      { id: "ff_lvl20", name: "🎫 Пропуск прокачки 20 lvl", price: 89, provider: "mvp", providerProductId: "ff.cis.lvl.20", fixed: true, popup: "💎 В игре: 200", warn: true },
      { id: "ff_lvl25", name: "🎫 Пропуск прокачки 25 lvl", price: 89, provider: "mvp", providerProductId: "ff.cis.lvl.25", fixed: true, popup: "💎 В игре: 200", warn: true },
      { id: "ff_lvl30", name: "🎫 Пропуск прокачки 30 lvl", price: 120, provider: "mvp", providerProductId: "ff.cis.lvl.30", fixed: true, popup: "💎 В игре: 350", warn: true },
    ],
  },
  pubg_uc: {
    validateNick: true,
    name: "PUBG Mobile — UC",
    inputType: "pubg_id",
    donixCategory: "pubg",
    items: [
      { id: "uc_60", name: "60 UC", price: 89 },
      { id: "uc_325", name: "325 UC", price: 439 },
      { id: "uc_660", name: "660 UC", price: 889 },
      { id: "uc_1800", name: "1800 UC", price: 2200 },
      { id: "uc_3850", name: "3850 UC", price: 4300 },
      { id: "uc_8100", name: "8100 UC", price: 8500 },
    ],
  },
  pubg_prime: {
    validateNick: true,
    name: "PUBG Mobile — Prime",
    inputType: "pubg_id",
    donixCategory: "pubg",
    items: [
      { id: "prime_1m", name: "Prime 1 месяц", price: 89 },
      { id: "prime_3m", name: "Prime 3 месяца", price: 270 },
      { id: "prime_6m", name: "Prime 6 месяцев", price: 550 },
      { id: "prime_12m", name: "Prime 12 месяцев", price: 1090 },
    ],
  },
  pubg_primeplus: {
    validateNick: true,
    name: "PUBG Mobile — Prime+",
    inputType: "pubg_id",
    donixCategory: "pubg",
    items: [
      { id: "primeplus_1m", name: "Prime+ 1 месяц", price: 899 },
      { id: "primeplus_3m", name: "Prime+ 3 месяца", price: 2600 },
      { id: "primeplus_6m", name: "Prime+ 6 месяцев", price: 5150 },
      { id: "primeplus_12m", name: "Prime+ 12 месяцев", price: 10500 },
    ],
  },
  mlbb: {
    name: "Mobile Legends",
    inputType: "ml_id",
    donixCategory: "mlbb",
    items: [
      { id: "ml_22", name: "20+2 Diamonds", price: 60, sku: "mobile-legends-20-2-diamonds" },
      { id: "ml_weekly_elite", name: "Weekly Elite Bundle", price: 85, sku: "mobile-legends-weekly-elite-pack" },
      { id: "ml_86", name: "78+8 Diamonds", price: 122, sku: "mobile-legends-78-8-diamonds" },
      { id: "ml_weekly", name: "Weekly Pass", price: 155, sku: "mobile-legends-weekly-pass" },
      { id: "ml_172", name: "156+16 Diamonds", price: 245, sku: "mobile-legends-156-16-diamonds" },
      { id: "ml_170", name: "170 Diamonds", price: 306, sku: "mobile-legends-170-diamonds" },
      { id: "ml_257", name: "234+23 Diamonds", price: 366, sku: "mobile-legends-234-23-diamonds" },
      { id: "ml_monthly_elite", name: "Monthly Elite Pack", price: 397, sku: "mobile-legends-monthly-elite-pack" },
      { id: "ml_240", name: "240 Diamonds", price: 445, sku: "mobile-legends-240-diamonds" },
      { id: "ml_296", name: "296 Diamonds", price: 537, sku: "mobile-legends-296-diamonds" },
      { id: "ml_twilight", name: "Twilight Pass", price: 808, sku: "mobile-legends-twilight-pass" },
      { id: "ml_570", name: "504+66 Diamonds", price: 950, sku: "mobile-legends-504-66-diamonds" },
      { id: "ml_706", name: "625+81 Diamonds", price: 984, sku: "mobile-legends-625-81-diamonds" },
      { id: "ml_2195", name: "1860+335 Diamonds", price: 2942, sku: "mobile-legends-1860-335-diamonds" },
      { id: "ml_2010", name: "2010 Diamonds", price: 3371, sku: "mobile-legends-2010-diamonds" },
      { id: "ml_3688", name: "3099+589 Diamonds", price: 4904, sku: "mobile-legends-3099-589-diamonds" },
      { id: "ml_5532", name: "4649+883 Diamonds", price: 7381, sku: "mobile-legends-4649-883-diamonds" },
    ],
  },
  codm: {
    name: "Call of Duty Mobile",
    inputType: "codm_id",
    donixCategory: "codm",
    invalidKey: "codm_invalid_id",
    items: [
      { id: "codm_88", name: "80 + 8 CP", price: 130, sku: "codm-88-cp" },
      { id: "codm_460", name: "400 + 60 CP", price: 572, sku: "codm-460-cp" },
      { id: "codm_960", name: "800 + 160 CP", price: 1199, sku: "codm-960-cp" },
      { id: "codm_2600", name: "2000 + 600 CP", price: 2770, sku: "codm-2600-cp" },
      { id: "codm_5400", name: "4000 + 1400 CP", price: 5410, sku: "codm-5400-cp" },
    ],
  },
  genshin: {
    name: "Genshin Impact",
    inputType: "genshin_id",
    donixCategory: "genshin",
    items: [
      { id: "genshin_60", name: "60 Genesis Crystals", price: 105, sku: "genshin-60-crystals" },
      { id: "genshin_330", name: "300 + 30 Genesis Crystals", price: 545, sku: "genshin-330-crystals" },
      { id: "genshin_welkin", name: "Blessing of the Welkin Moon", price: 550, sku: "genshin-welkin-moon" },
      { id: "genshin_1090", name: "980 + 110 Genesis Crystals", price: 1599, sku: "genshin-1090-crystals" },
      { id: "genshin_2240", name: "1980 + 260 Genesis Crystals", price: 3195, sku: "genshin-2240-crystals" },
      { id: "genshin_3880", name: "3280 + 600 Genesis Crystals", price: 5386, sku: "genshin-3880-crystals" },
      { id: "genshin_8080", name: "6480 + 1600 Genesis Crystals", price: 10999, sku: "genshin-8080-crystals" },
    ],
  },
  tg_stars: {
    name: "Telegram Stars",
    inputType: "tg_username",
    donixCategory: "tgstars",
    pricePerStar: 1.7,
    min: 50,
    max: 5000,
    quick: [50, 100, 250, 500, 1000, 2500], // быстрые кнопки; своё количество вводится текстом
    items: [],
  },
  tg_premium: {
    name: "Telegram Premium",
    inputType: "tg_username",
    donixCategory: "tgpremium",
    items: [
      { id: "tgp_3m", name: "Premium 3 месяца", price: 1260 },
      { id: "tgp_6m", name: "Premium 6 месяцев", price: 1700 },
      { id: "tgp_12m", name: "Premium 12 месяцев", price: 2999 },
    ],
  },
  hsr: {
    name: "Honkai: Star Rail",
    inputType: "mvp_id",
    needsServer: true, // MVP требует поле server (asia/america/europe/tw_hk_mo)
    items: [
      { id: "hsr_60", name: "60 Осколков", price: 104, provider: "mvp", providerProductId: "hsr.global.60_oskolkov", fixed: true },
      { id: "hsr_330", name: "300+30 Осколков", price: 504, provider: "mvp", providerProductId: "hsr.global.300_30_oskolkov", fixed: true },
      { id: "hsr_1090", name: "980+110 Осколков", price: 1378, provider: "mvp", providerProductId: "hsr.global.980_110_oskolkov", fixed: true },
      { id: "hsr_2240", name: "1980+260 Осколков", price: 2623, provider: "mvp", providerProductId: "hsr.global.1980_260_oskolkov", fixed: true },
      { id: "hsr_3880", name: "3280+600 Осколков", price: 4555, provider: "mvp", providerProductId: "hsr.global.3280_600_oskolkov", fixed: true },
      { id: "hsr_8080", name: "6480+1600 Осколков", price: 9155, provider: "mvp", providerProductId: "hsr.global.6480_1600_oskolkov", fixed: true },
      { id: "hsr_pass", name: "Пропуск снабжения экспресса", price: 504, provider: "mvp", providerProductId: "hsr.global.propusk_snabzheniya_ekspressa", fixed: true },
    ],
  },
  arena: {
    name: "Arena Breakout",
    inputType: "mvp_id",
    items: [
      { id: "ab_66", name: "66 облигаций", price: 86, provider: "mvp", providerProductId: "arena.global.66_obligatsiy", fixed: true },
      { id: "ab_335", name: "335 облигаций", price: 409, provider: "mvp", providerProductId: "arena.global.335_obligatsiy", fixed: true },
      { id: "ab_675", name: "675 облигаций", price: 809, provider: "mvp", providerProductId: "arena.global.675_obligatsiy", fixed: true },
      { id: "ab_1690", name: "1690 облигаций", price: 2001, provider: "mvp", providerProductId: "arena.global.1690_obligatsiy", fixed: true },
      { id: "ab_3400", name: "3400 облигаций", price: 3971, provider: "mvp", providerProductId: "arena.global.3400_obligatsiy", fixed: true },
      { id: "ab_6820", name: "6820 облигаций", price: 7850, provider: "mvp", providerProductId: "arena.global.6820_obligatsiy", fixed: true },
      { id: "ab_starter", name: "Набор новичка", price: 78, provider: "mvp", providerProductId: "arena.global.nabor_novichka", fixed: true },
      { id: "ab_bp_ext", name: "Расширенный ежемесячный БП", price: 96, provider: "mvp", providerProductId: "arena.global.rasshirennyy_ezhemesyachnyy_bp", fixed: true },
      { id: "ab_bullet", name: "Пуленепробиваемый ящик + привилегии (30 дней)", price: 234, provider: "mvp", providerProductId: "arena.global.puleneprobivaemyy_yaschik_privilegii_30_dney", fixed: true },
      { id: "ab_bp_prem", name: "Премиальный ежемесячный БП", price: 367, provider: "mvp", providerProductId: "arena.global.premialnyy_ezhemesyachnyy_bp", fixed: true },
      { id: "ab_comp", name: "Композитный ящик + привилегии (30 дней)", price: 685, provider: "mvp", providerProductId: "arena.global.kompozitnyy_yaschik_privilegii_30_dney", fixed: true },
      { id: "ab_quarter", name: "Ежеквартальный набор пропусков", price: 1075, provider: "mvp", providerProductId: "arena.global.ezhekvartalnyy_nabor_propuskov", fixed: true },
    ],
  },
  rivals: {
    name: "Marvel Rivals",
    inputType: "mvp_id",
    items: [
      { id: "mr_100", name: "100 Lattices", price: 101, provider: "mvp", providerProductId: "rivals.global.100_lattices", fixed: true },
      { id: "mr_500", name: "500 Lattices", price: 501, provider: "mvp", providerProductId: "rivals.global.500_lattices", fixed: true },
      { id: "mr_1000", name: "1000 Lattices", price: 960, provider: "mvp", providerProductId: "rivals.global.1000_lattices", fixed: true },
      { id: "mr_2180", name: "2180 Lattices", price: 1809, provider: "mvp", providerProductId: "rivals.global.2180_lattices", fixed: true },
      { id: "mr_5680", name: "5680 Lattices", price: 4650, provider: "mvp", providerProductId: "rivals.global.5680_lattices", fixed: true },
      { id: "mr_11680", name: "11680 Lattices", price: 9650, provider: "mvp", providerProductId: "rivals.global.11680_lattices", fixed: true },
    ],
  },
  oxide: {
    name: "Oxide Survival Island",
    inputType: "mvp_id",
    items: [
      { id: "ox_50", name: "50 Монет", price: 236, provider: "mvp", providerProductId: "oxide.global.50_monet", fixed: true },
      { id: "ox_135", name: "135 Монет", price: 583, provider: "mvp", providerProductId: "oxide.global.135_monet", fixed: true },
      { id: "ox_290", name: "290 Монет (15% Выгоды)", price: 1154, provider: "mvp", providerProductId: "oxide.global.290_monet_15_vygody", fixed: true },
      { id: "ox_630", name: "630 Монет (25% Выгоды)", price: 2284, provider: "mvp", providerProductId: "oxide.global.630_monet_25_vygody", fixed: true },
      { id: "ox_1675", name: "1675 Монет (30% Выгоды)", price: 5606, provider: "mvp", providerProductId: "oxide.global.1675_monet_30_vygody", fixed: true },
      { id: "ox_3550", name: "3550 Монет (40% Выгоды)", price: 11113, provider: "mvp", providerProductId: "oxide.global.3550_monet_40_vygody", fixed: true },
      { id: "ox_elite", name: "Elite + Боевой пропуск", price: 1604, provider: "mvp", providerProductId: "oxide.global.elite_boevoy_propusk", fixed: true },
    ],
  },
  discord: {
    name: "Discord",
    inputType: "discord_id",
    noInput: true, // ID не нужен: MVP выдаёт код в заказе
    giftcard: true,
    items: [
      { id: "dc_basic", name: "Discord Basic — 1 месяц", price: 491, provider: "mvp", providerProductId: "discord.global.discord_basic_1_mesyats", fixed: true },
      { id: "dc_nitro1", name: "Discord Nitro — 1 месяц", price: 982, provider: "mvp", providerProductId: "discord.global.discord_nitro_1_mesyats", fixed: true },
      { id: "dc_nitro12", name: "Discord Nitro — 12 месяцев", price: 9350, provider: "mvp", providerProductId: "discord.global.discord_nitro_12_mesyatsev", fixed: true },
    ],
  },
  // Steam: сумма в долларах вводится кнопкой или текстом; price = курс сом за $1 (меняется в «Каталог и цены»).
  steam: {
    name: "Steam",
    inputType: "steam_login",
    steam: true,
    min: 0.2,
    max: 1000,
    quick: [1, 2, 3, 5, 10, 15],
    items: [
      { id: "steam_usd", name: "Steam $", price: 98, provider: "mvp", providerProductId: "steam.global.wallet_usd", fixed: true },
    ],
  },
  // Тестовая категория второго поставщика (MVP Resellers): ОДИН товар, чтобы проверить полный цикл.
  // Кнопка в боте появляется только когда админ включил её в «Настройки» (config:mvp_test = on).
  // provider: "mvp" -> выдача идёт в MVP; providerProductId — product_id из GET /v1/products
  // (пример из документации MVP; проверить: /mvpproducts ff, изменить без деплоя: /setmvp ITEM_ID PRODUCT_ID).
  // price — цена для клиента (в MVP этот товар по документации стоит 74 сом); меняется в «Каталог и цены».
  mvp_test: {
    validateNick: true,
    name: "MVP тест",
    inputType: "uid",
    maxQty: 1,
    items: [
      { id: "mvp_ff_110", name: "💎 110 (MVP)", price: 80, provider: "mvp", providerProductId: "ff.cis.dia.110", fixed: true },
    ],
  },
};

// У каждого товара есть provider ("donix" по умолчанию или "mvp") и providerProductId (для "mvp").
for (const cat of Object.values(CATALOG)) {
  for (const it of cat.items) {
    it.provider = it.provider === "mvp" ? "mvp" : "donix";
    if (it.providerProductId === undefined) it.providerProductId = null;
  }
}

/* ================= KV HELPERS ================= */

function kvKeyUser(id) {
  return `user:${id}`;
}
function kvKeyState(id) {
  return `state:${id}`;
}
function kvKeyOrder(internalId) {
  return `order:${internalId}`;
}
function kvKeyOrderByNumber(num) {
  return `ordernum:${num}`;
}
function kvKeyUserOrders(userId) {
  return `userorders:${userId}`;
}
function kvKeyIdemp(scope, key) {
  return `idemp:${scope}:${key}`;
}
/* Money helpers: amounts are kept with tyiyn (2 decimals), so 102 сом -15% = 86.70 сом. */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function fmtSom(n) {
  const v = round2(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
function fmtPercent(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return String(v);
}

function kvKeyPromo(code) {
  return `promo:${code.toUpperCase()}`;
}
function kvKeyPromoUse(code, userId) {
  return `promouse:${code.toUpperCase()}:${userId}`;
}
function kvKeyCounter() {
  return `ordercounter:global`;
}
function kvKeyConfig(key) {
  return `config:${key}`;
}
function kvKeyPriceOverride(catKey, itemId) {
  return `price:${catKey}:${itemId}`;
}
/* Поставьте false, чтобы снова включить покупку Telegram Stars. */
const STARS_TEMP_DISABLED = false;

/* Техработы Free Fire. По умолчанию ВЫКЛЮЧЕНЫ; админ переключает командой /ffmaint on | off (без деплоя). */
const FREEFIRE_MAINTENANCE_DEFAULT = false;
async function isFreefireMaintenance(db) {
  const v = await db.get("config:ff_maintenance");
  if (v === "on") return true;
  if (v === "off") return false;
  return FREEFIRE_MAINTENANCE_DEFAULT;
}
const MAINTENANCE_TEXT = {
  ru: "🛠 Сейчас идут технические работы.\nПожалуйста, попробуйте чуть позже.",
  kg: "🛠 Азыр техникалык иштер жүрүп жатат.\nСураныч, бир аздан кийин кайра аракет кылыңыз.",
};

function kvKeyStarsPricePerStar() {
  return `config:tgstars_price_per_star`;
}
function kvKeyStarsPromptText() {
  return `config:tgstars_prompt_text`;
}
function kvKeyActivePromo(userId) {
  return `activepromo:${userId}`;
}
function kvKeyCart(userId) {
  return `cart:${userId}`;
}
function kvKeyBalanceHistory(userId) {
  return `balancehistory:${userId}`;
}
function kvKeyReferralOverride(username) {
  return `config:referral_percent_user:${(username || "").toLowerCase()}`;
}

const DEFAULT_REFERRAL_PERCENT = "0.5";
const DEFAULT_REFERRAL_TEXT_RU =
  "Если вы позовёте друга, вы будете получать {percent}% от каждой его покупки в магазине.\n\nЕсли хотите стать крупным партнёром с повышенным процентом (например, 1–1.5%) — свяжитесь с администрацией.";
const DEFAULT_REFERRAL_TEXT_KG =
  "Досуңузду чакырсаңыз, анын ар бир сатып алуусунан {percent}% аласыз.\n\nЖогорку пайыздуу ири өнөктөш болгуңуз келсе (мисалы, 1–1.5%) — администрация менен байланышыңыз.";

async function getReferralPercentForUsername(db, username) {
  if (username) {
    const override = await db.get(kvKeyReferralOverride(username));
    if (override) return parseFloat(override);
  }
  const global = await db.get(kvKeyConfig("referral_percent"));
  return parseFloat(global || DEFAULT_REFERRAL_PERCENT);
}

async function getReferralText(db, lang) {
  const stored = await db.get(kvKeyConfig("referral_text"));
  return stored || (lang === "kg" ? DEFAULT_REFERRAL_TEXT_KG : DEFAULT_REFERRAL_TEXT_RU);
}

/**
 * Credits the referrer of `buyerUserId` with a percentage of a completed purchase.
 * Only triggered on actual product purchases (never on wallet top-ups).
 */
async function applyReferralCommission(db, buyerUserId, saleAmount) {
  const buyer = await getUser(db, buyerUserId);
  if (!buyer.referredBy) return;
  const referrer = await getUser(db, buyer.referredBy);
  const percent = await getReferralPercentForUsername(db, referrer.username);
  const commission = Math.round(saleAmount * (percent / 100) * 100) / 100;
  if (commission <= 0) return;
  referrer.balance += commission;
  referrer.referralEarnings = (referrer.referralEarnings || 0) + commission;
  await saveUser(db, referrer);
  await addWalletHistory(db, referrer.id, { type: "referral", amount: commission, from: buyerUserId });
}

async function getJSON(db, key, fallback = null) {
  const v = await db.get(key);
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
async function putJSON(db, key, value) {
  await db.put(key, JSON.stringify(value));
}

async function getUser(db, id) {
  let u = await getJSON(db, kvKeyUser(id));
  if (!u) {
    u = {
      id,
      username: null,
      lang: "ru",
      balance: 0,
      spent: 0,
      referredBy: null,
      referralEarnings: 0,
      createdAt: new Date().toISOString(),
    };
    await putJSON(db, kvKeyUser(id), u);
  }
  return u;
}
async function saveUser(db, u) {
  await putJSON(db, kvKeyUser(u.id), u);
}

async function getState(db, id) {
  return await getJSON(db, kvKeyState(id), { step: "idle", data: {} });
}
async function setState(db, id, state) {
  await putJSON(db, kvKeyState(id), state);
}
async function clearState(db, id) {
  await db.delete(kvKeyState(id));
}

/* ================= CART (multi-item basket per category) ================= */
/* Shape: { catKey, items: { [itemId]: qty } } — one active cart per user at a time.
   Switching to a different category starts a fresh cart. */
async function getCart(db, userId) {
  return await getJSON(db, kvKeyCart(userId));
}
async function saveCart(db, userId, cart) {
  await putJSON(db, kvKeyCart(userId), cart);
}
async function clearCart(db, userId) {
  await db.delete(kvKeyCart(userId));
}
function cartTotal(cart, resolvedItems) {
  if (!cart) return 0;
  let sum = 0;
  for (const item of resolvedItems) {
    const qty = cart.items[item.id] || 0;
    sum += item.price * qty;
  }
  return sum;
}

/* order number generator: plain sequential number (1, 2, 3, ...), no date —
   simple to read out loud and easy for the admin to check "did order №N go through". */
async function generateOrderNumber(db) {
  const counterKey = kvKeyCounter();
  const current = await db.get(counterKey);
  const next = current ? parseInt(current, 10) + 1 : 1;
  // best-effort increment (KV has no atomic increment; acceptable for this scale)
  await db.put(counterKey, String(next));
  return String(next);
}

/* ================= TELEGRAM API ================= */

function tgApi(env, method) {
  return `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
}

async function tgCall(env, method, payload) {
  const res = await fetch(tgApi(env, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, description: "invalid_json_response" };
  }
  if (!data.ok) {
    console.log("Telegram API error", method, JSON.stringify(data));
  }
  return data;
}

function stripHtmlTags(text) {
  return String(text)
    .replace(/<\/?(b|i|u|s|em|strong|code|pre|a|tg-spoiler|blockquote)(\s[^>]*)?>/gi, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

async function sendMessage(env, chatId, text, replyMarkup) {
  const res = await tgCall(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
  // Ник игрока с символами < > & ломает HTML-разметку, и Telegram не доставляет сообщение.
  // Тогда повторяем отправку обычным текстом, чтобы клиент всегда получил ответ.
  if (!res.ok && /parse entities|unsupported start tag|can't find end tag/i.test(res.description || "")) {
    return tgCall(env, "sendMessage", {
      chat_id: chatId,
      text: stripHtmlTags(text),
      reply_markup: replyMarkup,
    });
  }
  return res;
}

async function editMessage(env, chatId, messageId, text, replyMarkup) {
  const res = await tgCall(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
  if (!res.ok) {
    // message may be too old / not modified / deleted -> send new one
    return sendMessage(env, chatId, text, replyMarkup);
  }
  return res;
}

async function deleteMessage(env, chatId, messageId) {
  if (!messageId) return;
  try {
    await tgCall(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch (e) {
    console.log("deleteMessage failed", e);
  }
}

async function answerCallback(env, callbackQueryId, text, showAlert = false) {
  return tgCall(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text || undefined,
    show_alert: showAlert,
  });
}

function ikb(rows) {
  return { inline_keyboard: rows };
}
function btn(text, callback_data) {
  return { text, callback_data };
}

/* ================= DONIX API ================= */

async function donixRequest(env, path, method = "GET", body = null) {
  try {
    const res = await fetch(`${DONIX_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DONIX_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e) };
  }
}

async function donixPing(env) {
  return donixRequest(env, "/ping");
}
async function donixBalance(env) {
  return donixRequest(env, "/balance");
}
async function donixProducts(env) {
  return donixRequest(env, "/products");
}
async function donixValidate(env, payload) {
  // payload: { sku, uid }
  return donixRequest(env, "/validate", "POST", payload);
}

/* ---- SKU resolution: bot items -> Donix SKUs, matched automatically from GET /products ---- */

const DONIX_GAME_KEYWORDS = {
  freefire: ["free fire", "freefire"],
  pubg: ["pubg"],
  mlbb: ["mobile legends", "mobile legend", "mlbb"],
  codm: ["call of duty", "codm", "cod mobile"],
  genshin: ["genshin", "геншин"],
  tgstars: ["star", "звезд"],
  tgpremium: ["premium", "премиум"],
};
const DONIX_DISTINCT_TOKENS = ["lite", "plus", "week", "month", "svp"];
let donixProductsCache = { at: 0, list: null };

function skuNorm(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/недел\S*|week\S*/g, " week ")
    .replace(/месяц\S*|month\S*/g, " month ")
    .replace(/алмаз\S*|diamond\S*|бриллиант\S*/g, " diamond ")
    .replace(/ваучер\S*|voucher\S*|\bpass\b/g, " voucher ")
    .replace(/[^a-z0-9а-яё]+/g, " ")
    .trim();
}
function skuTokens(str) {
  const all = skuNorm(str).split(" ").filter(Boolean);
  return {
    nums: all.filter((w) => /^\d+$/.test(w)),
    words: all.filter((w) => !/^\d+$/.test(w) && w.length >= 3),
  };
}

async function getDonixProducts(env) {
  if (donixProductsCache.list && Date.now() - donixProductsCache.at < 5 * 60 * 1000) {
    return donixProductsCache.list;
  }
  const res = await donixProducts(env);
  if (!res.ok || !Array.isArray(res.data)) return donixProductsCache.list; // stale copy if any
  donixProductsCache = { at: Date.now(), list: res.data };
  return res.data;
}

function donixProductInGame(p, donixCategory) {
  const kws = DONIX_GAME_KEYWORDS[donixCategory] || [];
  const hay = skuNorm(`${p.game || ""} ${p.category || ""} ${p.name || ""}`);
  return kws.some((k) => hay.includes(k));
}

function scoreDonixProduct(itemName, p) {
  const item = skuTokens(itemName);
  const prod = skuTokens(`${p.name || ""} ${p.sku || ""}`);
  let score = 0;
  if (item.nums.length && prod.nums.length) {
    const hit = item.nums.filter((n) => prod.nums.includes(n)).length;
    score += hit ? 10 * hit : -15;
  }
  for (const w of item.words) if (prod.words.includes(w)) score += 3;
  for (const w of DONIX_DISTINCT_TOKENS) {
    if (item.words.includes(w) !== prod.words.includes(w)) score -= 5;
  }
  return score;
}

/* Returns the Donix SKU for a bot item, or null. Priority: admin override (/setsku) ->
   `sku` field in CATALOG -> automatic match against Donix /products. */
async function resolveDonixSku(env, catKey, itemId, itemName) {
  const db = env.DB;
  const override = await db.get(`skuov:${itemId}`);
  if (override) return override;
  const cat = CATALOG[catKey];
  if (!cat) return null;
  const fixed = (cat.items || []).find((i) => i.id === itemId);
  if (fixed && fixed.sku) return fixed.sku;

  const products = await getDonixProducts(env);
  if (!products) return null;
  const inGame = products.filter((p) => donixProductInGame(p, cat.donixCategory));

  if (catKey === "tg_stars") {
    // Donix sells Stars as one flat-rate SKU (telegram-stars-base), not per amount.
    const hit = inGame.find((p) => p.sku === "telegram-stars-base") || inGame[0];
    return hit ? hit.sku : null;
  }

  let best = null;
  let bestScore = 0;
  for (const p of inGame) {
    const sc = scoreDonixProduct(itemName, p);
    if (sc > bestScore) {
      best = p;
      bestScore = sc;
    }
  }
  return best && bestScore >= 3 ? best.sku : null;
}

/* ---- Price sync: Donix base price (GET /products) + markup % -> price overrides ---- */
async function syncPricesFromDonix(env, markupPercent) {
  const db = env.DB;
  donixProductsCache = { at: 0, list: null };
  const products = await getDonixProducts(env);
  if (!products) return { ok: false, changed: 0, missing: [] };
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const k = 1 + Number(markupPercent) / 100;
  let changed = 0;
  const missing = [];
  for (const [catKey, cat] of Object.entries(CATALOG)) {
    if (catKey === "tg_stars") {
      const hit = products.find((p) => donixProductInGame(p, "tgstars"));
      const base = hit ? Number(hit.price) : NaN;
      if (Number.isFinite(base) && base > 0 && base < 20) {
        await db.put(kvKeyStarsPricePerStar(), String(round2(base * k)));
        changed++;
      } else missing.push("Telegram Stars");
      continue;
    }
    for (const item of cat.items) {
      if (item.fixed || itemProvider(item) === "mvp") continue; // price set manually in CATALOG / у MVP свои цены
      const sku = await resolveDonixSku(env, catKey, item.id, item.name);
      const base = sku && bySku.has(sku) ? Number(bySku.get(sku).price) : NaN;
      if (!Number.isFinite(base) || base <= 0) {
        missing.push(item.id);
        continue;
      }
      await setPriceOverride(db, catKey, item.id, Math.ceil(base * k));
      changed++;
    }
  }
  return { ok: true, changed, missing };
}

/* Cart orders store itemId as "ff_110+ff_week"; for UID validation any single line's SKU works. */
function validationItemRef(data) {
  const first = data.items && data.items[0];
  return first ? [first.itemId, first.name] : [data.itemId, data.itemName];
}

/* Game ID / target the way Donix expects it (the `uid` field). */
function donixUidFromData(uidData) {
  const d = uidData || {};
  const raw = d.UID || d["Player ID"] || d.Username || "";
  return String(raw).replace(/^@/, "").trim();
}

/* ================= EVENT LOG (кольцевой буфер в KV) ================= */

const LOG_KEY = "log:events";
const LOG_MAX = 50;

/* Пишет событие в журнал (последние LOG_MAX записей). Никогда не бросает ошибку. */
async function logEvent(db, type, text) {
  try {
    const list = (await getJSON(db, LOG_KEY, [])) || [];
    list.unshift({ at: new Date().toISOString(), type, text: String(text).slice(0, 300) });
    if (list.length > LOG_MAX) list.length = LOG_MAX;
    await putJSON(db, LOG_KEY, list);
  } catch (e) {
    console.log("logEvent error", String(e));
  }
}

async function notifyAdminDonix(env, text) {
  if (env.DB) await logEvent(env.DB, "donix", text);
  if (!env.ADMIN_ID) return;
  try {
    await sendMessage(env, env.ADMIN_ID, `⚠️ Donix: ${text}`.slice(0, 3900));
  } catch (e) {
    console.log("notifyAdminDonix error", String(e));
  }
}
function donixErrText(result) {
  if (!result) return "no response";
  const d = result.data;
  const msg = d && (d.error || d.message || d.code) ? String(d.error || d.message || d.code) : JSON.stringify(d);
  return `HTTP ${result.status} ${msg || ""}`.trim();
}
async function donixCreateOrder(env, payload) {
  return donixRequest(env, "/order", "POST", payload);
}
/* Telegram Stars / Premium: Donix requires POST /telegram-order (plain /order returns use_telegram_order). */
async function donixTelegramOrder(env, payload) {
  return donixRequest(env, "/telegram-order", "POST", payload);
}
async function donixTelegramCheck(env, username) {
  return donixRequest(env, "/telegram/check", "POST", { username: String(username || "").replace(/^@/, "").trim() });
}
function isTelegramCategory(catKey) {
  return catKey === "tg_stars" || catKey === "tg_premium";
}
/* "tgp_3m" -> 3 months */
function premiumMonthsFromItemId(itemId) {
  const m = String(itemId || "").match(/(\d+)m$/);
  return m ? parseInt(m[1], 10) : null;
}
async function donixOrderByExternal(env, externalId) {
  return donixRequest(env, `/order/${encodeURIComponent(externalId)}?by=external`);
}
async function donixOrders(env) {
  return donixRequest(env, "/orders");
}
async function donixTopUp(env, payload) {
  return donixRequest(env, "/top-up", "POST", payload);
}

/* ================= END OF PART 1 — helpers/data above, logic continues below ================= */

/* ================= WALLET ================= */

async function walletHistoryKey(userId) {
  return `wallethistory:${userId}`;
}

async function addWalletHistory(db, userId, entry) {
  const key = await walletHistoryKey(userId);
  const list = (await getJSON(db, key, [])) || [];
  list.unshift({ ...entry, at: new Date().toISOString() });
  if (list.length > 50) list.length = 50;
  await putJSON(db, key, list);
}

async function walletReserve(db, user, amount) {
  amount = round2(amount);
  if (round2(user.balance) < amount) return false;
  user.balance = round2(user.balance - amount);
  await saveUser(db, user);
  return true;
}

async function walletRelease(db, userId, amount, reason) {
  amount = round2(amount);
  if (amount <= 0) return; // подарочные заказы (0 сом) нечего возвращать на кошелёк
  const user = await getUser(db, userId);
  user.balance = round2(user.balance + amount);
  await saveUser(db, user);
  await addWalletHistory(db, userId, { type: "refund", amount, reason });
}

async function walletCommitSpend(db, userId, amount, orderNumber) {
  const user = await getUser(db, userId);
  amount = round2(amount);
  user.spent = round2(user.spent + amount);
  await saveUser(db, user);
  await addWalletHistory(db, userId, { type: "purchase", amount, orderNumber });
}

async function walletTopUpCredit(db, userId, amount, note) {
  const user = await getUser(db, userId);
  user.balance = round2(user.balance + amount);
  await saveUser(db, user);
  await addWalletHistory(db, userId, { type: "topup", amount, note });
}

/* ================= ADMIN BALANCE ADJUSTMENTS ================= */

/* Records every manual admin top-up/deduction, distinct from the buyer-facing wallet
   history: keeps the Telegram ID, amount, type, before/after balance, timestamp and
   which admin performed it. */
async function addAdminBalanceHistory(db, userId, entry) {
  const key = kvKeyBalanceHistory(userId);
  const list = (await getJSON(db, key, [])) || [];
  list.unshift({ ...entry, userId, at: new Date().toISOString() });
  if (list.length > 100) list.length = 100;
  await putJSON(db, key, list);
}

/* Admin-initiated balance top-up: no floor beyond 0, always allowed. */
async function adminTopUpBalance(db, adminId, userId, amount) {
  const user = await getUser(db, userId);
  const oldBalance = user.balance;
  user.balance = oldBalance + amount;
  await saveUser(db, user);
  await addAdminBalanceHistory(db, userId, { amount, type: "topup", oldBalance, newBalance: user.balance, adminId });
  return { oldBalance, newBalance: user.balance };
}

/* Admin-initiated deduction: rejected if it would take the balance below 0. */
async function adminDeductBalance(db, adminId, userId, amount) {
  const user = await getUser(db, userId);
  if (amount > user.balance) return { ok: false, balance: user.balance };
  const oldBalance = user.balance;
  user.balance = oldBalance - amount;
  await saveUser(db, user);
  await addAdminBalanceHistory(db, userId, { amount, type: "deduct", oldBalance, newBalance: user.balance, adminId });
  return { ok: true, oldBalance, newBalance: user.balance };
}

/* ================= PROMO CODES ================= */

async function createPromo(db, spec) {
  // spec: {code, type: 'percent'|'fixed', value, uses, days, minSum, firstPurchaseOnly, onePerUser}
  // uses: null/undefined/Infinity means unlimited total redemptions (usesLeft stored as null).
  // days: null/undefined means it never expires ("вечный" promo code).
  const unlimitedUses = spec.uses === null || spec.uses === undefined || spec.uses === Infinity;
  const promo = {
    code: spec.code.toUpperCase(),
    type: spec.type,
    value: Number(spec.value),
    usesLeft: unlimitedUses ? null : Number(spec.uses) || 0,
    minSum: Number(spec.minSum) || 0,
    firstPurchaseOnly: !!spec.firstPurchaseOnly,
    onePerUser: spec.onePerUser !== false,
    expiresAt: spec.days ? new Date(Date.now() + Number(spec.days) * 86400000).toISOString() : null,
    createdAt: new Date().toISOString(),
    active: true,
    // type "gift": промокод даёт конкретный товар бесплатно { catKey, itemId }
    gift: spec.gift || null,
    // type "prices": промокод действует на ОДНУ игру и задаёт свои цены за единицу товара:
    // catKey — игра, prices — { [itemId]: цена_по_промокоду }. Товары без цены не меняются.
    catKey: spec.catKey || null,
    prices: spec.prices || null,
  };
  await putJSON(db, kvKeyPromo(promo.code), promo);
  return promo;
}

/* Скидка промокода типа "prices": разница между обычной и промо-ценой по строкам корзины
   (только для той игры, на которую выпущен промокод). */
function promoPricesDiscount(promo, ctx) {
  if (!promo || !promo.prices || !ctx || ctx.catKey !== promo.catKey || !Array.isArray(ctx.lines)) return 0;
  let d = 0;
  for (const l of ctx.lines) {
    const pp = promo.prices[l.itemId];
    if (pp === undefined || pp === null) continue;
    const diff = Number(l.price) - Number(pp);
    if (diff > 0) d += diff * (l.qty || 1);
  }
  return round2(d);
}

async function validatePromo(db, code, userId, sum, ctx) {
  const promo = await getJSON(db, kvKeyPromo(code));
  if (!promo || !promo.active) return { ok: false, reason: "not_found" };
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  // usesLeft === null means unlimited total redemptions (only onePerUser limits a given account).
  if (promo.usesLeft !== null && promo.usesLeft <= 0) return { ok: false, reason: "exhausted" };
  if (sum < promo.minSum) return { ok: false, reason: "min_sum" };
  if (promo.onePerUser) {
    const used = await db.get(kvKeyPromoUse(code, userId));
    if (used) return { ok: false, reason: "already_used" };
  }
  if (promo.firstPurchaseOnly) {
    const orders = (await getJSON(db, kvKeyUserOrders(userId), [])) || [];
    if (orders.length > 0) return { ok: false, reason: "not_first_purchase" };
  }
  let discount =
    promo.type === "prices"
      ? promoPricesDiscount(promo, ctx)
      : promo.type === "percent"
        ? round2((sum * promo.value) / 100)
        : round2(promo.value);
  if (discount > sum) discount = round2(sum);
  return { ok: true, promo, discount };
}

async function consumePromo(db, code, userId) {
  const promo = await getJSON(db, kvKeyPromo(code));
  if (!promo) return;
  if (promo.usesLeft !== null) {
    promo.usesLeft = Math.max(0, promo.usesLeft - 1);
    await putJSON(db, kvKeyPromo(code), promo);
  }
  await db.put(kvKeyPromoUse(code, userId), "1");
  await db.delete(kvKeyActivePromo(userId));
}

/* Runs once per order, regardless of HOW it was paid (wallet / bank / terminal):
   marks the "spent" total, consumes the promo code, and pays referral commission.
   Kept in one place so promo codes and referral bonuses can never be skipped for
   any particular payment method. */
async function finalizeOrderPaid(db, order) {
  await walletCommitSpend(db, order.userId, order.total, order.orderNumber);
  if (order.promoCode) await consumePromo(db, order.promoCode, order.userId);
  await applyReferralCommission(db, order.userId, order.total);
}

/* ================= ORDERS ================= */

async function createOrder(db, params) {
  // params: userId, category, itemId, itemName, price, discount, total, uidData, promoCode, items (optional cart lines)
  const internalId = crypto.randomUUID();
  const orderNumber = await generateOrderNumber(db);
  const order = {
    internalId,
    orderNumber,
    userId: params.userId,
    category: params.category,
    itemId: params.itemId,
    itemName: params.itemName,
    price: params.price,
    discount: params.discount || 0,
    total: params.total,
    uidData: params.uidData || {},
    promoCode: params.promoCode || null,
    // Multiple distinct products bought together from the cart, each with its own
    // qty/price/fulfilment status. Absent for legacy single-item orders.
    items: params.items && params.items.length > 0
      ? params.items.map((l) => ({ itemId: l.itemId, name: l.name, qty: l.qty, price: l.price, status: "pending", donixOrderId: null }))
      : undefined,
    status: "pending_payment",
    donixOrderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putJSON(db, kvKeyOrder(internalId), order);
  await putJSON(db, kvKeyOrderByNumber(orderNumber), internalId);
  const userOrders = (await getJSON(db, kvKeyUserOrders(params.userId), [])) || [];
  userOrders.unshift(internalId);
  await putJSON(db, kvKeyUserOrders(params.userId), userOrders);
  return order;
}

async function getOrder(db, internalId) {
  return getJSON(db, kvKeyOrder(internalId));
}
async function getOrderByNumber(db, orderNumber) {
  const num = String(orderNumber).trim();
  let internalId = await db.get(kvKeyOrderByNumber(num));
  if (internalId) {
    // значение может быть сохранено как JSON-строка ("uuid" в кавычках)
    try { const v = JSON.parse(internalId); if (typeof v === "string") internalId = v; } catch {}
    const o = await getOrder(db, internalId);
    if (o) return o;
  }
  // запасной путь: перебор всех заказов
  let cursor;
  do {
    const list = await db.list({ prefix: "order:", cursor });
    for (const k of list.keys) {
      const o = await getJSON(db, k.name);
      if (o && String(o.orderNumber) === num) return o;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return null;
}
async function saveOrder(db, order) {
  order.updatedAt = new Date().toISOString();
  await putJSON(db, kvKeyOrder(order.internalId), order);
}

/* Colour-circle status label shown to the buyer in "Мои заказы" (plain text, not buttons). */
function orderStatusLabel(lang, status) {
  const map = {
    pending_payment: "status_pending_payment",
    paid: "status_paid",
    processing: "status_processing",
    completed: "status_completed",
    cancelled: "status_cancelled",
    failed: "status_failed",
    refunded: "status_refunded",
  };
  return t(lang, map[status] || "status_processing");
}

/* idempotency guard: returns true if this is the first time this action ran */
async function idempotentOnce(db, scope, key) {
  const k = kvKeyIdemp(scope, key);
  const existing = await db.get(k);
  if (existing) return false;
  await db.put(k, "1");
  return true;
}

/* ================= ROBLOX (коды из админки) ================= */

const ROBLOX_REDEEM_URL = "https://www.roblox.com/redeem";
const ROBLOX_DEFAULT_ROBUX = [50, 100, 275, 360, 555]; // цены задаются в админке (пока цена 0 — номинал скрыт)

function rbxT(lang, ru, kg) {
  return lang === "kg" ? kg : ru;
}

/* Включён ли Roblox в меню «Игры и сервисы». Переключается в админке. */
async function isRobloxEnabled(db) {
  return (await db.get("config:roblox_enabled")) !== "off";
}

async function getRobloxProducts(db) {
  let list = await getJSON(db, "roblox:products", null);
  if (!Array.isArray(list)) {
    list = ROBLOX_DEFAULT_ROBUX.map((r) => ({ id: `r${r}`, robux: r, price: 0 }));
    await putJSON(db, "roblox:products", list);
  }
  return list;
}
async function saveRobloxProducts(db, list) {
  await putJSON(db, "roblox:products", list);
}
async function getRobloxCodes(db, pid) {
  const l = await getJSON(db, `roblox:codes:${pid}`, []);
  return Array.isArray(l) ? l : [];
}
async function saveRobloxCodes(db, pid, list) {
  await putJSON(db, `roblox:codes:${pid}`, list);
}
function kvKeyRobloxSold(code) {
  return `roblox:sold:${code}`;
}
function robloxItemName(robux) {
  return `Roblox ${robux} Robux`;
}

/* Только то, что можно продать: есть цена И есть хотя бы один код. */
async function getRobloxAvailable(db) {
  const prods = await getRobloxProducts(db);
  const out = [];
  for (const p of prods) {
    if (!(p.price > 0)) continue;
    const n = (await getRobloxCodes(db, p.id)).length;
    if (n > 0) out.push({ ...p, stock: n });
  }
  return out.sort((a, b) => a.robux - b.robux);
}

async function robloxShopView(db, lang) {
  const items = await getRobloxAvailable(db);
  const back = btn(t(lang, "btn_back"), "menu:games");
  if (items.length === 0) {
    return {
      text: rbxT(
        lang,
        "🔲 Roblox\n\n😔 Сейчас коды закончились. Загляните чуть позже.",
        "🔲 Roblox\n\n😔 Азыр кодтор бүттү. Бир аздан кийин кайрылыңыз."
      ),
      keyboard: ikb([[back]]),
    };
  }
  const buttons = items.map((i) => btn(`${i.robux} R$ — ${fmtSom(i.price)} ${t(lang, "kg_som")}`, `rbx:buy:${i.id}`));
  const rows = twoPerRow(buttons);
  rows.push([back]);
  return {
    text: rbxT(
      lang,
      "🔲 Roblox — коды пополнения\n\nВыберите номинал. Код придёт сразу после оплаты:",
      "🔲 Roblox — толуктоо коддору\n\nНоминалды тандаңыз. Код төлөмдөн кийин дароо келет:"
    ),
    keyboard: ikb(rows),
  };
}

async function createRobloxOrder(env, db, lang, chatId, userId, prod) {
  const itemName = robloxItemName(prod.robux);
  const stateData = { catKey: "roblox", itemId: prod.id, itemName, price: prod.price };
  const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, stateData, {});
  prompt.text = prompt.text.replace(/^\s+/, "");
  const order = await createOrder(db, {
    userId,
    category: "roblox",
    itemId: prod.id,
    itemName,
    price: prod.price,
    discount: prompt.discount,
    total: prompt.total,
    uidData: {},
    promoCode: prompt.promoCode,
  });
  await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
}

async function notifyAdminRoblox(env, text) {
  const adminId = String(env.ADMIN_ID || "").split(/[,\s;]+/).map((x) => x.replace(/["']/g, "").trim()).filter(Boolean)[0];
  if (!adminId) return;
  try {
    await sendMessage(env, adminId, `🔲 Roblox: ${text}`.slice(0, 3900));
  } catch (e) {
    console.log("notifyAdminRoblox error", String(e));
  }
}

/* Выдача кода после оплаты (любым способом: кошелёк / банк / терминал). Вызывается из processDonixOrder. */
async function deliverRobloxOrder(env, db, order, lang, chatId) {
  order = (await getOrder(db, order.internalId)) || order;
  if (order.status === "completed" || order.status === "failed" || order.status === "cancelled") return;
  const first = await idempotentOnce(db, "donixcreate", order.internalId);
  if (!first) return;

  const pid = order.itemId;

  const failOrder = async (reason) => {
    order.status = "failed";
    await saveOrder(db, order);
    const refundOk = await idempotentOnce(db, "refund", order.internalId);
    if (refundOk) await walletRelease(db, order.userId, order.total, `order_failed:${order.orderNumber}`);
    await notifyAdminRoblox(env, `заказ №${order.orderNumber} не выполнен: ${reason}. Деньги возвращены на баланс клиента.`);
    if (order.processingMsg && order.processingMsg.messageId) {
      await deleteMessage(env, order.processingMsg.chatId || order.userId, order.processingMsg.messageId);
    }
    await sendMessage(env, order.userId, t(lang, "failed"), backHomeKeyboard(lang));
  };

  let stock = await getRobloxCodes(db, pid);
  if (!order.robloxCodes || order.robloxCodes.length === 0) {
    // Берём случайный код (меньше шанс, что два параллельных заказа возьмут один и тот же),
    // пропуская коды, уже помеченные как проданные.
    let code = null;
    while (stock.length > 0) {
      const i = Math.floor(Math.random() * stock.length);
      const c = stock[i];
      stock.splice(i, 1);
      if (await db.get(kvKeyRobloxSold(c))) continue;
      code = c;
      break;
    }
    if (!code) {
      await saveRobloxCodes(db, pid, stock);
      return failOrder(`коды «${order.itemName}» закончились`);
    }
    order.robloxCodes = [code];
    await saveOrder(db, order); // сначала фиксируем код за заказом...
    await db.put(kvKeyRobloxSold(code), String(order.orderNumber));
    await saveRobloxCodes(db, pid, stock); // ...потом убираем со склада
  } else {
    // повторная выдача (retry): код уже закреплён за заказом — просто убеждаемся, что его нет на складе
    const code = order.robloxCodes[0];
    await db.put(kvKeyRobloxSold(code), String(order.orderNumber));
    if (stock.includes(code)) await saveRobloxCodes(db, pid, stock.filter((c) => c !== code));
  }

  order.status = "completed";
  await saveOrder(db, order);
  await logEvent(db, "roblox", `Заказ №${order.orderNumber}: выдан код (${order.itemName})`);
  await sendRobloxReceipt(env, order.userId, lang, order);

  // предупреждение админу, когда коды заканчиваются
  const left = (await getRobloxCodes(db, pid)).length;
  if (left <= 2) {
    await notifyAdminRoblox(env, left === 0 ? `коды «${order.itemName}» закончились — номинал скрыт у клиентов.` : `осталось кодов «${order.itemName}»: ${left}.`);
  }
}

async function sendRobloxReceipt(env, userId, lang, order) {
  await postPurchaseToReviewsChat(env, env.DB, order);
  if (order.processingMsg && order.processingMsg.messageId) {
    await deleteMessage(env, order.processingMsg.chatId || userId, order.processingMsg.messageId);
  }
  const code = order.robloxCodes[0];
  const text = [
    t(lang, "completed"),
    `№ ${order.orderNumber}`,
    order.itemName,
    "",
    rbxT(lang, "🔑 Код для активации:", "🔑 Активдештирүү коду:"),
    `<code>${escHtml(code)}</code>`,
    rbxT(lang, "<i>Нажмите на код, чтобы скопировать.</i>", "<i>Кодду басыңыз — көчүрүлөт.</i>"),
    "",
    rbxT(lang, "Активация:", "Активдештирүү:"),
    rbxT(
      lang,
      `1. Откройте <a href="${ROBLOX_REDEEM_URL}">roblox.com/redeem</a>`,
      `1. <a href="${ROBLOX_REDEEM_URL}">roblox.com/redeem</a> ачыңыз`
    ),
    rbxT(lang, "2. Войдите в аккаунт и введите код", "2. Аккаунтка кирип, кодду киргизиңиз"),
    rbxT(
      lang,
      "3. Сконвертируйте полученную валюту через кнопку «Get Robux»",
      "3. Алынган валютаны «Get Robux» баскычы аркылуу конвертациялаңыз"
    ),
  ].join("\n");
  const copyRow = [{ text: rbxT(lang, "📋 Скопировать код", "📋 Кодду көчүрүү"), copy_text: { text: String(code).slice(0, 256) } }];
  const restRows = [
    [{ text: rbxT(lang, "🔗 Активировать код", "🔗 Кодду активдештирүү"), url: ROBLOX_REDEEM_URL }],
    [btn(t(lang, "btn_home"), "menu:home")],
  ];
  let res = await sendMessage(env, userId, text, { inline_keyboard: [copyRow, ...restRows] });
  if (!res || !res.ok) {
    // на случай, если клиент/Telegram не поддерживает кнопку копирования — код всё равно должен дойти
    res = await sendMessage(env, userId, text, { inline_keyboard: restRows });
  }
}

/* ---- Админка: Roblox ---- */

async function adminRobloxView(db) {
  const enabled = await isRobloxEnabled(db);
  const prods = (await getRobloxProducts(db)).slice().sort((x, y) => x.robux - y.robux);
  const lines = ["🔲 Roblox — коды", "", `В боте: ${enabled ? "ПОКАЗЫВАЕТСЯ ✅" : "СКРЫТ ⛔"}`, ""];
  const rows = [[btn(enabled ? "⛔ Скрыть Roblox из бота" : "✅ Показать Roblox в боте", "admin:rbxtoggle")]];
  for (const p of prods) {
    const n = (await getRobloxCodes(db, p.id)).length;
    const priced = p.price > 0;
    lines.push(`${p.robux} R$ — ${priced ? fmtSom(p.price) + " сом" : "цена не задана ⚠️"} — кодов: ${n}${!priced || n === 0 ? " (клиенты не видят)" : ""}`);
    rows.push([btn(`${p.robux} R$ · ${priced ? fmtSom(p.price) : "?"} сом · 📦 ${n}`, `admin:rbxp:${p.id}`)]);
  }
  if (prods.length === 0) lines.push("Номиналов пока нет.");
  lines.push("", "Клиент видит только номиналы, у которых есть цена и хотя бы один код.");
  rows.push([btn("➕ Добавить номинал", "admin:rbxnew")]);
  rows.push([btn("⬅️", "admin:home")]);
  return { text: lines.join("\n"), keyboard: ikb(rows) };
}

async function adminRobloxProductView(db, pid, notice) {
  const prod = (await getRobloxProducts(db)).find((p) => p.id === pid);
  if (!prod) return adminRobloxView(db);
  const n = (await getRobloxCodes(db, pid)).length;
  const lines = [];
  if (notice) lines.push(notice, "");
  lines.push(
    `🔲 ${prod.robux} Robux`,
    `Цена: ${prod.price > 0 ? fmtSom(prod.price) + " сом" : "не задана ⚠️"}`,
    `Кодов в наличии: ${n}`
  );
  if (!(prod.price > 0) || n === 0) lines.push("", "Сейчас этот номинал скрыт у клиентов (нужна цена и хотя бы один код).");
  return {
    text: lines.join("\n"),
    keyboard: ikb([
      [btn("💰 Изменить цену", `admin:rbxprice:${pid}`), btn("🔢 Изменить Robux", `admin:rbxamount:${pid}`)],
      [btn("➕ Добавить коды", `admin:rbxadd:${pid}`), btn("📋 Коды / удалить", `admin:rbxcodes:${pid}:0`)],
      [btn("🗑 Удалить номинал", `admin:rbxdelprod:${pid}`)],
      [btn("⬅️", "admin:rbx")],
    ]),
  };
}

const RBX_CODES_PER_PAGE = 10;
async function adminRobloxCodesView(db, pid, page) {
  const prod = (await getRobloxProducts(db)).find((p) => p.id === pid);
  if (!prod) return adminRobloxView(db);
  const codes = await getRobloxCodes(db, pid);
  const pages = Math.max(1, Math.ceil(codes.length / RBX_CODES_PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = codes.slice(page * RBX_CODES_PER_PAGE, (page + 1) * RBX_CODES_PER_PAGE);
  const lines = [`📋 Коды ${prod.robux} R$ — всего ${codes.length} (стр. ${page + 1}/${pages})`, ""];
  const rows = [];
  slice.forEach((c, k) => {
    const idx = page * RBX_CODES_PER_PAGE + k;
    lines.push(`${idx + 1}. <code>${escHtml(c)}</code>`);
    rows.push([btn(`❌ Удалить ${idx + 1}: ${c.length > 18 ? c.slice(0, 18) + "…" : c}`, `admin:rbxdel:${pid}:${idx}`)]);
  });
  if (codes.length === 0) lines.push("Кодов нет.");
  const nav = [];
  if (page > 0) nav.push(btn("◀️", `admin:rbxcodes:${pid}:${page - 1}`));
  if (page < pages - 1) nav.push(btn("▶️", `admin:rbxcodes:${pid}:${page + 1}`));
  if (nav.length) rows.push(nav);
  if (codes.length > 0) rows.push([btn("🗑 Удалить ВСЕ коды", `admin:rbxclear:${pid}`)]);
  rows.push([btn("⬅️", `admin:rbxp:${pid}`)]);
  return { text: lines.join("\n"), keyboard: ikb(rows) };
}

async function sendAdminRobloxProduct(env, db, chatId, pid, notice) {
  const view = await adminRobloxProductView(db, pid, notice);
  await sendMessage(env, chatId, view.text, view.keyboard);
}

/* Обработка текстовых шагов админки Roblox. Возвращает true, если сообщение обработано. */
async function handleAdminRobloxText(env, db, msg, state) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();
  const step = state.step;
  if (!step.startsWith("admin_rbx_")) return false;
  const pid = state.data && state.data.pid;

  if (step === "admin_rbx_price") {
    const n = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 1000000) {
      await sendMessage(env, chatId, "Нужно число больше 0, например: 70 или 69.5");
      return true;
    }
    const list = await getRobloxProducts(db);
    const prod = list.find((p) => p.id === pid);
    if (!prod) { await clearState(db, userId); await sendMessage(env, chatId, "Номинал не найден.", adminMainKeyboard()); return true; }
    prod.price = round2(n);
    await saveRobloxProducts(db, list);
    await clearState(db, userId);
    await sendAdminRobloxProduct(env, db, chatId, pid, `✅ Цена обновлена: ${fmtSom(prod.price)} сом`);
    return true;
  }

  if (step === "admin_rbx_amount") {
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n <= 0 || String(n) !== text.replace(/\s/g, "")) {
      await sendMessage(env, chatId, "Нужно целое число Robux, например: 400");
      return true;
    }
    const list = await getRobloxProducts(db);
    const prod = list.find((p) => p.id === pid);
    if (!prod) { await clearState(db, userId); await sendMessage(env, chatId, "Номинал не найден.", adminMainKeyboard()); return true; }
    if (list.some((p) => p.id !== pid && p.robux === n)) {
      await sendMessage(env, chatId, `Номинал ${n} R$ уже есть. Отправьте другое число.`);
      return true;
    }
    prod.robux = n;
    await saveRobloxProducts(db, list);
    await clearState(db, userId);
    await sendAdminRobloxProduct(env, db, chatId, pid, `✅ Теперь это номинал ${n} Robux`);
    return true;
  }

  if (step === "admin_rbx_newprod") {
    const m = text.match(/^(\d+)(?:\s*[;\s]\s*([\d.,]+))?$/);
    if (!m) {
      await sendMessage(env, chatId, "Неверный формат. Отправьте: КОЛИЧЕСТВО_ROBUX;ЦЕНА\nПример: 800;540");
      return true;
    }
    const robux = parseInt(m[1], 10);
    const price = m[2] ? round2(parseFloat(m[2].replace(",", "."))) : 0;
    if (!(robux > 0) || !Number.isFinite(price) || price < 0) {
      await sendMessage(env, chatId, "Неверные числа. Пример: 800;540");
      return true;
    }
    const list = await getRobloxProducts(db);
    if (list.some((p) => p.robux === robux)) {
      await sendMessage(env, chatId, `Номинал ${robux} R$ уже есть. Измените его цену в списке или отправьте другое число.`);
      return true;
    }
    const prod = { id: `r${robux}`, robux, price };
    list.push(prod);
    await saveRobloxProducts(db, list);
    await clearState(db, userId);
    await sendAdminRobloxProduct(env, db, chatId, prod.id, `✅ Номинал ${robux} R$ добавлен. Теперь добавьте коды.`);
    return true;
  }

  if (step === "admin_rbx_addcodes") {
    const incoming = text.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
    if (incoming.length === 0) {
      await sendMessage(env, chatId, "Не вижу кодов. Отправьте их текстом, каждый с новой строки.");
      return true;
    }
    if (incoming.length > 500) {
      await sendMessage(env, chatId, "Слишком много за один раз (максимум 500). Отправьте частями.");
      return true;
    }
    if (incoming.some((c) => c.length > 200)) {
      await sendMessage(env, chatId, "Один из кодов слишком длинный (больше 200 символов). Проверьте текст.");
      return true;
    }
    const prods = await getRobloxProducts(db);
    if (!prods.some((p) => p.id === pid)) { await clearState(db, userId); await sendMessage(env, chatId, "Номинал не найден.", adminMainKeyboard()); return true; }
    // дубли ищем по всем номиналам, чтобы один код не оказался в двух местах
    const existing = new Set();
    for (const p of prods) for (const c of await getRobloxCodes(db, p.id)) existing.add(c);
    const codes = await getRobloxCodes(db, pid);
    let added = 0;
    let dup = 0;
    for (const c of incoming) {
      if (existing.has(c)) { dup++; continue; }
      existing.add(c);
      codes.push(c);
      added++;
    }
    await saveRobloxCodes(db, pid, codes);
    await clearState(db, userId);
    await logEvent(db, "settings", `Roblox ${pid}: добавлено кодов ${added}`);
    await sendAdminRobloxProduct(env, db, chatId, pid, `✅ Добавлено кодов: ${added}${dup ? `\n⚠️ Пропущено дублей: ${dup}` : ""}`);
    return true;
  }
  return false;
}

/* ================= KEYBOARDS / MENUS ================= */

/* Chunks a flat list of buttons into rows of 2 (last row may have 1). */
function twoPerRow(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return rows;
}

function mainMenuKeyboard(lang) {
  return ikb([
    ...(APP_URL ? [[{ text: "🛍 Открыть магазин", web_app: { url: APP_URL } }]] : []),
    [btn(t(lang, "btn_games"), "menu:games")],
    [btn(t(lang, "btn_wallet"), "wallet:home"), btn(t(lang, "btn_orders"), "orders:list")],
    [btn(t(lang, "btn_promo"), "promo:enter"), btn(t(lang, "btn_profile"), "profile:home")],
    [btn(t(lang, "btn_referral"), "referral:home")],
    [
      { text: t(lang, "btn_reviews"), url: "https://t.me/nurtilekshop" },
      { text: t(lang, "btn_channel"), url: "https://t.me/nurtilek_shopp" },
    ],
    [
      { text: t(lang, "btn_support"), url: "https://t.me/nurt1lek_ff" },
      btn(t(lang, "btn_lang"), "lang:menu"),
    ],
  ]);
}

/* Roblox включён -> он встаёт рядом с Genshin, а Telegram уходит отдельной строкой внизу.
   Roblox выключен -> Telegram снова стоит рядом с Genshin (по два в ряд). */
async function gamesMenuKeyboard(db, lang) {
  const rbxOn = await isRobloxEnabled(db);
  const items = [
    btn(t(lang, "btn_freefire"), "cat:freefire"),
    btn(t(lang, "btn_pubg"), "menu:pubg"),
    btn(t(lang, "btn_mlbb"), "cat:mlbb"),
    btn(t(lang, "btn_codm"), "cat:codm"),
    btn(t(lang, "btn_genshin"), "cat:genshin"),
  ];
  if (rbxOn) items.push(btn(t(lang, "btn_roblox"), "cat:roblox"));
  items.push(
    btn(t(lang, "btn_hsr"), "cat:hsr"),
    btn(t(lang, "btn_arena"), "cat:arena"),
    btn(t(lang, "btn_rivals"), "cat:rivals"),
    btn(t(lang, "btn_oxide"), "cat:oxide")
  );
  const rows = twoPerRow(items);
  // Сервисы всегда в самом низу, каждый отдельной строкой: Telegram, Discord, Steam.
  rows.push([btn(t(lang, "btn_tg"), "menu:tg")]);
  rows.push([btn(t(lang, "btn_discord"), "cat:discord")]);
  rows.push([btn(t(lang, "btn_steam"), "cat:steam")]);
  if (await isMvpTestEnabled(db)) rows.push([btn(t(lang, "btn_mvp_test"), "cat:mvp_test")]);
  rows.push([btn(t(lang, "btn_home"), "menu:home")]);
  return ikb(rows);
}

function pubgMenuKeyboard(lang) {
  return ikb([
    [btn("UC", "cat:pubg_uc"), btn("Prime", "cat:pubg_prime")],
    [btn("Prime+", "cat:pubg_primeplus")],
    [btn(t(lang, "btn_back"), "menu:games")],
  ]);
}

function starsQuickKeyboard(lang) {
  const q = CATALOG.tg_stars.quick;
  const rows = [];
  for (let i = 0; i < q.length; i += 3) {
    rows.push(q.slice(i, i + 3).map((n) => btn(`${n} ⭐`, `stars:${n}`)));
  }
  rows.push([btn(lang === "kg" ? "✏️ Өз санымды жазам" : "✏️ Своё количество", "stars:custom")]);
  rows.push([btn(t(lang, "btn_back"), "menu:tg")]);
  return ikb(rows);
}

/* Создаёт заказ на Stars (кнопка или введённое число) и показывает итог. */
async function createStarsOrder(env, db, lang, chatId, userId, username, amount) {
  const pricePerStar = await getEffectiveStarsPricePerStar(db);
  const price = round2(amount * pricePerStar);
  const uidData = { Username: username, Stars: amount };
  const stateData = { catKey: "tg_stars", itemId: `stars_${amount}`, itemName: `${amount} ⭐ Stars`, price };
  const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, stateData, uidData);
  const order = await createOrder(db, {
    userId,
    category: "tg_stars",
    itemId: stateData.itemId,
    itemName: stateData.itemName,
    price,
    discount: prompt.discount,
    total: prompt.total,
    uidData,
    promoCode: prompt.promoCode,
    // Без items: Stars уходят в Donix ОДНИМ заказом с quantity (см. processDonixOrderInner).
  });
  await clearState(db, userId);
  await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
}

const HSR_SERVERS = { asia: "Asia", america: "America", europe: "Europe", tw_hk_mo: "TW/HK/MO" };
function serverKeyboard(lang) {
  const b = Object.entries(HSR_SERVERS).map(([k, v]) => btn(v, `srv:${k}`));
  return ikb([...twoPerRow(b), [btn(t(lang, "btn_home"), "menu:home")]]);
}
async function discordShopView(db, lang) {
  const items = await getResolvedItems(db, "discord");
  const rows = items.map((i) => [btn(`${i.name} — ${fmtSom(i.price)} ${t(lang, "kg_som")}`, `dcbuy:${i.id}`)]);
  rows.push([btn(t(lang, "btn_back"), "menu:games")]);
  return { text: lang === "kg" ? "💬 Discord\n\nТоварды тандаңыз. Код төлөмдөн кийин дароо келет:" : "💬 Discord\n\nВыберите товар. Код придёт сразу после оплаты:", keyboard: ikb(rows) };
}
function steamAmountText(a) {
  return String(Math.round(Number(a) * 100) / 100);
}
async function steamRate(db) {
  const it = await findItem(db, "steam", "steam_usd");
  return it ? it.price : 98;
}
function steamQuickKeyboard(lang) {
  const q = CATALOG.steam.quick;
  const rows = [q.slice(0, 3).map((n) => btn(`$${n}`, `steam:${n}`)), q.slice(3, 6).map((n) => btn(`$${n}`, `steam:${n}`))];
  rows.push([btn(t(lang, "steam_custom_btn"), "steam:custom")]);
  rows.push([btn(t(lang, "btn_back"), "menu:games")]);
  return ikb(rows);
}
async function createSteamOrder(env, db, lang, chatId, userId, login, amount) {
  const rate = await steamRate(db);
  const price = round2(amount * rate);
  const uidData = { UID: login, "Сумма": `$${steamAmountText(amount)}` };
  const stateData = { catKey: "steam", itemId: "steam_usd", itemName: `Steam $${steamAmountText(amount)}`, price };
  const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, stateData, uidData);
  const order = await createOrder(db, {
    userId,
    category: "steam",
    itemId: "steam_usd",
    itemName: stateData.itemName,
    price,
    discount: prompt.discount,
    total: prompt.total,
    uidData,
    promoCode: prompt.promoCode,
  });
  order.steamAmount = amount;
  await saveOrder(db, order);
  await clearState(db, userId);
  await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
}

function tgMenuKeyboard(lang) {
  return ikb([
    [btn("⭐ Stars", "cat:tg_stars"), btn("💎 Premium", "cat:tg_premium")],
    [btn(t(lang, "btn_back"), "menu:games")],
  ]);
}

function categoryBackTarget(catKey) {
  return catKey.startsWith("pubg_") ? "menu:pubg" : catKey.startsWith("tg_") ? "menu:tg" : "menu:games";
}

/* Cart-style product screen: tapping a product adds one unit of it to the basket
   (max 10 of each). A reset button always shows the running total; a "Далее" button
   appears once at least one item is selected, to proceed to checkout. */
async function cartKeyboard(db, lang, catKey, cart) {
  const cat = CATALOG[catKey];
  if (!cat) return ikb([[btn(t(lang, "btn_back"), "menu:games")]]);
  const resolvedItems = await getResolvedItems(db, catKey);
  const items = cart && cart.catKey === catKey ? cart.items : {};
  const productButtons = resolvedItems.map((i) => {
    const qty = items[i.id] || 0;
    const label = qty > 0 ? `${i.name} ×${qty}` : i.name;
    return btn(label, `cartadd:${catKey}:${i.id}`);
  });
  const rows = twoPerRow(productButtons);
  const backTarget = categoryBackTarget(catKey);
  if (resolvedItems.length > 0) rows.push([btn(t(lang, "btn_prices"), `prices:${catKey}`)]);
  const total = cartTotal(cart && cart.catKey === catKey ? cart : null, resolvedItems);
  if (total > 0) rows.push([btn(t(lang, "btn_cart_next"), `cartnext:${catKey}`)]);
  rows.push([btn(t(lang, "btn_cart_reset", total), `cartreset:${catKey}`)]);
  rows.push([btn(t(lang, "btn_back"), backTarget)]);
  return ikb(rows);
}

/* Text shown above the cart keyboard: prompt + a compact summary line of what's selected. */
const PASS_WARNING = "💥 Если вы ранее покупали этот пакет, то на ваш аккаунт второй раз он не придёт. Если не покупали — смело покупайте.\n\n✅ Если пакет вам недоступен, заказ не выполнится, а деньги сразу вернутся на ваш кошелёк в боте.";

/* Подсказка при нажатии на товар (лимит Telegram для всплывающего окна — 200 символов). */
function itemPopupText(item) {
  if (!item || !item.popup) return null;
  if (item.warn) {
    // Всплывающее окно Telegram — максимум 200 символов, поэтому тут сжатая версия; полный текст — в сообщении.
    return [
      `${item.name} · ${fmtSom(item.price)} сом`,
      item.popup,
      "💥 Покупали этот пакет — второй раз не придёт. Не покупали — покупайте!",
      "✅ Не пришёл — деньги вернутся на ваш кошелёк в боте.",
    ].join("\n").slice(0, 200);
  }
  const lines = [item.name, item.popup, `Цена: ${fmtSom(item.price)} сом`, "Добавлено в корзину ✅"];
  return lines.join("\n").slice(0, 200);
}

async function cartText(db, lang, catKey, cart) {
  const resolvedItems = await getResolvedItems(db, catKey);
  const items = cart && cart.catKey === catKey ? cart.items : {};
  const byId = Object.fromEntries(resolvedItems.map((i) => [i.id, i]));
  const parts = [];
  for (const id of Object.keys(items)) {
    const qty = items[id];
    const item = byId[id];
    if (item && qty > 0) parts.push(`${item.name} ×${qty}`);
  }
  const summary = parts.length > 0 ? parts.join("     ") : t(lang, "cart_empty");
  const warnItem = Object.keys(items).map((id) => (items[id] > 0 ? byId[id] : null)).find((i) => i && i.warn);
  if (warnItem) {
    return [t(lang, "choose_product"), "", warnItem.name, warnItem.popup, `Цена: ${fmtSom(warnItem.price)} сом`, PASS_WARNING].join("\n");
  }
  return [t(lang, "choose_product"), "", t(lang, "cart_title"), "", summary].join("\n");
}

/* Plain-text price list: each item on its own line, price written at the end. */
async function pricesText(db, lang, catKey, userId) {
  const cat = CATALOG[catKey];
  if (!cat) return t(lang, "prices_title");
  const items = await getResolvedItems(db, catKey);

  // Если у пользователя активирован промокод с особыми ценами на ЭТУ игру — показываем цены по промокоду.
  let promo = null;
  if (userId) {
    const activeCode = await db.get(kvKeyActivePromo(userId));
    if (activeCode) {
      const check = await validatePromo(db, activeCode, userId, 0, null);
      if (check.ok && check.promo.type === "prices" && check.promo.catKey === catKey) promo = check.promo;
    }
  }

  const lines = [t(lang, "prices_title"), ""];
  if (promo) {
    lines.push(lang === "kg" ? `🎟 Промокод ${promo.code} — арзандатылган баалар` : `🎟 Промокод ${promo.code} — цены со скидкой`, "");
  }
  for (const i of items) {
    const pp = promo && promo.prices ? promo.prices[i.id] : undefined;
    if (pp !== undefined && pp !== null && Number(pp) < i.price) {
      lines.push(`🔹 <b>${i.name} = ${fmtSom(pp)} ${t(lang, "kg_som")}</b> <s>${fmtSom(i.price)}</s>`);
    } else {
      lines.push(`🔹 <b>${i.name} = ${i.price} ${t(lang, "kg_som")}</b>`);
    }
  }
  return lines.join("\n");
}

function pricesKeyboard(lang, catKey) {
  return ikb([[btn(t(lang, "btn_back"), `cat:${catKey}`)]]);
}

/* Quantity-stepper screen shown right after picking a product (max 10x). */
function qtyKeyboard(lang, catKey, itemId, qty) {
  const dec = Math.max(1, qty - 1);
  const inc = Math.min(10, qty + 1);
  return ikb([
    [btn("➖", `qty:${catKey}:${itemId}:${dec}`), btn(`${qty}`, `qty:${catKey}:${itemId}:${qty}`), btn("➕", `qty:${catKey}:${itemId}:${inc}`)],
    [btn(t(lang, "btn_qty_confirm"), `qtyok:${catKey}:${itemId}:${qty}`)],
    [btn(t(lang, "btn_back"), `cat:${catKey}`)],
  ]);
}

function qtyText(lang, item, qty) {
  return [
    item.name,
    t(lang, "qty_line", qty),
    t(lang, "qty_total_line", item.price * qty),
  ].join("\n");
}

function confirmKeyboard(lang, confirmData, cancelData) {
  return ikb([[btn(t(lang, "btn_confirm"), confirmData), btn(t(lang, "btn_cancel"), cancelData)]]);
}

function paymentMethodKeyboard(lang, orderId) {
  return ikb([
    [btn(t(lang, "btn_pay_balance"), `confirmorder:${orderId}`)],
    [btn(t(lang, "btn_pay_bank"), `payorder:bank:${orderId}`)],
    [btn(t(lang, "btn_pay_terminal"), `payorder:terminal:${orderId}`)],
    [btn(t(lang, "btn_cancel"), `cancelorder:${orderId}`)],
  ]);
}

function backHomeKeyboard(lang) {
  return ikb([[btn(t(lang, "btn_home"), "menu:home")]]);
}

function langKeyboard() {
  return ikb([[btn("🇷🇺 Русский", "lang:ru"), btn("🇰🇬 Кыргызча", "lang:kg")], [btn("⬅️", "menu:home")]]);
}

function walletKeyboard(lang) {
  return ikb([
    [btn(t(lang, "wallet_topup"), "wallet:topup"), btn(t(lang, "wallet_history"), "wallet:history")],
    [btn(t(lang, "btn_home"), "menu:home")],
  ]);
}

function profileKeyboard(lang) {
  return ikb([[btn(t(lang, "btn_home"), "menu:home")]]);
}


/* ================= RENDER HELPERS ================= */

async function renderMainMenu(env, db, chatId, messageId, lang) {
  const text = t(lang, "main_menu");
  if (messageId) return editMessage(env, chatId, messageId, text, mainMenuKeyboard(lang));
  return sendMessage(env, chatId, text, mainMenuKeyboard(lang));
}

function findItemBase(catKey, itemId) {
  const cat = CATALOG[catKey];
  if (!cat) return null;
  return cat.items.find((i) => i.id === itemId) || null;
}

/* Admin can override any catalog item's price from the admin panel (config:price:*).
   This price is used everywhere: buttons, the prices list, and the final order total. */
async function getEffectivePrice(db, catKey, itemId, basePrice) {
  const override = await db.get(kvKeyPriceOverride(catKey, itemId));
  if (override !== null && override !== undefined && override !== "") {
    const n = Number(override);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return basePrice;
}

async function setPriceOverride(db, catKey, itemId, price) {
  await db.put(kvKeyPriceOverride(catKey, itemId), String(price));
}

async function getEffectiveStarsPricePerStar(db) {
  const override = await db.get(kvKeyStarsPricePerStar());
  const n = override !== null ? Number(override) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return CATALOG.tg_stars.pricePerStar;
}

/* Admin-editable wording shown above the "enter Stars amount" prompt; falls back to the
   built-in translation if the admin hasn't set a custom text. */
async function getEffectiveStarsPromptText(db, lang) {
  const override = await db.get(kvKeyStarsPromptText());
  return override || t(lang, "enter_stars_amount");
}

/* Rate + a few sample totals, so the price is visible on every Stars screen. */
async function starsPriceInfo(db, lang) {
  const rate = await getEffectiveStarsPricePerStar(db);
  const cat = CATALOG.tg_stars;
  const samples = [50, 100, 500, 1000, 2500]
    .filter((n) => n >= cat.min && n <= cat.max)
    .map((n) => `⭐ ${n} = ${fmtSom(round2(n * rate))} ${t(lang, "kg_som")}`);
  return [t(lang, "stars_rate_line", fmtSom(rate)), ...samples].join("\n");
}

/* Returns an item with its price already resolved to the current (possibly admin-overridden) price. */
async function findItem(db, catKey, itemId) {
  const base = findItemBase(catKey, itemId);
  if (!base) return null;
  const price = await getEffectivePrice(db, catKey, itemId, base.price);
  return { ...base, price };
}

/* Returns every item of a category with resolved (overridden) prices, for listing/pricing screens. */
async function getResolvedItems(db, catKey) {
  const cat = CATALOG[catKey];
  if (!cat) return [];
  const out = [];
  for (const i of cat.items) {
    const price = await getEffectivePrice(db, catKey, i.id, i.price);
    out.push({ ...i, price });
  }
  return out;
}

function inputPromptKey(inputType, step) {
  if (inputType === "mvp_id") return "enter_player_id_generic";
  if (inputType === "discord_id") return "enter_discord_id";
  if (inputType === "steam_login") return "enter_steam_login";
  if (inputType === "uid") return "enter_uid_ff";
  if (inputType === "pubg_id") return "enter_uid_pubg";
  if (inputType === "codm_id") return "enter_uid_codm";
  if (inputType === "genshin_id") return "enter_uid_genshin";
  if (inputType === "ml_id") return step === "player" ? "enter_player_id_mlbb" : "enter_server_id_mlbb";
  if (inputType === "tg_username") return "enter_username_tg";
  return "enter_uid_ff";
}

/* ================= CALLBACK ROUTER ================= */

async function handleCallbackQuery(env, db, cq) {
  const data = cq.data || "";
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const user = await getUser(db, userId);
  // BUGFIX: this used to unconditionally re-save the full user record on every single
  // button tap. getUser/saveUser is a read-modify-write over the whole KV record (not an
  // atomic increment), so if a payment webhook credited the balance (getUser -> balance
  // += amount -> saveUser) in between this handler's own read and write, this handler
  // would blindly overwrite it with the stale, pre-credit balance — silently reverting a
  // top-up back down, while the wallet history entry (written first inside the webhook)
  // stayed intact. That's exactly why balance sometimes didn't update even though history
  // showed the payment, and why reloading/tapping around didn't help — every tap was
  // itself another chance to clobber the credit. Now we only write back when something in
  // this handler actually changed.
  if (cq.from.username && cq.from.username !== user.username) {
    user.username = cq.from.username;
    await saveUser(db, user);
  }
  const lang = user.lang || "ru";

  const [ns, a, b, c] = data.split(":");

  try {
    if (ns === "menu") {
      if (a === "home") {
        await clearState(db, userId);
        await renderMainMenu(env, db, chatId, messageId, lang);
      } else if (a === "games") {
        await editMessage(env, chatId, messageId, t(lang, "choose_category"), await gamesMenuKeyboard(db, lang));
      } else if (a === "pubg") {
        await editMessage(env, chatId, messageId, t(lang, "choose_category"), pubgMenuKeyboard(lang));
      } else if (a === "tg") {
        await editMessage(env, chatId, messageId, t(lang, "choose_category"), tgMenuKeyboard(lang));
      }
      return answerCallback(env, cq.id);
    }

    if (ns === "stars") {
      const cat = CATALOG.tg_stars;
      if (a === "custom") {
        await setState(db, userId, { step: "await_stars_custom", data: {} });
        const txt = lang === "kg"
          ? `Stars санын жазыңыз (${cat.min}дөн ${cat.max} чейин):`
          : `Напишите количество Stars (от ${cat.min} до ${cat.max}):`;
        await editMessage(env, chatId, messageId, txt, ikb([[btn(t(lang, "btn_back"), "cat:tg_stars")]]));
        return answerCallback(env, cq.id);
      }
      const amount = parseInt(a, 10);
      if (!cat.quick.includes(amount)) return answerCallback(env, cq.id);
      await setState(db, userId, { step: "await_stars_username", data: { amount } });
      await editMessage(env, chatId, messageId, `⭐ ${amount} Stars\n\n${t(lang, "enter_username_tg")}`, backHomeKeyboard(lang));
      return answerCallback(env, cq.id);
    }

    if (ns === "srv") {
      const st = await getState(db, userId);
      if (st.step !== "await_server" || !HSR_SERVERS[a]) return answerCallback(env, cq.id);
      const uidData = { ...(st.data.uidData || {}), Server: a };
      const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, st.data, uidData);
      const order = await createOrder(db, {
        userId,
        category: st.data.catKey,
        itemId: st.data.itemId,
        itemName: st.data.itemName,
        price: st.data.price,
        discount: prompt.discount,
        total: prompt.total,
        uidData,
        promoCode: prompt.promoCode,
        items: st.data.items,
      });
      await clearState(db, userId);
      await answerCallback(env, cq.id);
      await deleteMessage(env, chatId, messageId);
      await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
      return;
    }

    if (ns === "dcbuy") {
      const item = await findItem(db, "discord", a);
      if (!item) {
        await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
        return;
      }
      await answerCallback(env, cq.id);
      await deleteMessage(env, chatId, messageId);
      const stateData = { catKey: "discord", itemId: item.id, itemName: item.name, price: item.price };
      const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, stateData, {});
      prompt.text = prompt.text.replace(/^\s+/, "");
      const order = await createOrder(db, {
        userId,
        category: "discord",
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        discount: prompt.discount,
        total: prompt.total,
        uidData: {},
        promoCode: prompt.promoCode,
      });
      await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
      return;
    }

    if (ns === "cat" && a === "discord") {
      await clearState(db, userId);
      const view = await discordShopView(db, lang);
      await editMessage(env, chatId, messageId, view.text, view.keyboard);
      return answerCallback(env, cq.id);
    }

    if (ns === "steam") {
      const cat = CATALOG.steam;
      if (a === "custom") {
        await setState(db, userId, { step: "await_steam_custom", data: {} });
        await editMessage(env, chatId, messageId, t(lang, "steam_custom_prompt", cat.min, cat.max), ikb([[btn(t(lang, "btn_back"), "cat:steam")]]));
        return answerCallback(env, cq.id);
      }
      const amount = Number(a);
      if (!cat.quick.includes(amount)) return answerCallback(env, cq.id);
      await setState(db, userId, { step: "await_steam_login", data: { amount } });
      await editMessage(env, chatId, messageId, `🎮 Steam $${steamAmountText(amount)}\n\n${t(lang, "enter_steam_login")}`, backHomeKeyboard(lang));
      return answerCallback(env, cq.id);
    }

    if (ns === "cat" && a === "steam") {
      await setState(db, userId, { step: "await_steam_choice", data: {} });
      const rate = await steamRate(db);
      await editMessage(env, chatId, messageId, `🎮 Steam\n${t(lang, "steam_rate_line", fmtSom(rate))}\n\n${t(lang, "steam_choose_amount")}`, steamQuickKeyboard(lang));
      return answerCallback(env, cq.id);
    }

    if (ns === "cat" && a === "roblox") {
      await clearState(db, userId);
      if (!(await isRobloxEnabled(db))) {
        await editMessage(env, chatId, messageId, t(lang, "service_unavailable"), ikb([[btn(t(lang, "btn_back"), "menu:games")]]));
        return answerCallback(env, cq.id);
      }
      const view = await robloxShopView(db, lang);
      await editMessage(env, chatId, messageId, view.text, view.keyboard);
      return answerCallback(env, cq.id);
    }

    if (ns === "rbx" && a === "buy") {
      const pid = b;
      const prod = (await getRobloxProducts(db)).find((p) => p.id === pid);
      const stock = prod ? (await getRobloxCodes(db, pid)).length : 0;
      if (!(await isRobloxEnabled(db)) || !prod || !(prod.price > 0) || stock < 1) {
        await answerCallback(env, cq.id, rbxT(lang, "Этого номинала сейчас нет в наличии", "Бул номинал азыр жок"), true);
        const view = await robloxShopView(db, lang);
        await editMessage(env, chatId, messageId, view.text, view.keyboard);
        return;
      }
      await answerCallback(env, cq.id);
      // Старое сообщение со списком номиналов удаляем, чтобы оно не оставалось в чате.
      await deleteMessage(env, chatId, messageId);
      await createRobloxOrder(env, db, lang, chatId, userId, prod);
      return;
    }

    if (ns === "cat") {
      const catKey = a;
      if (catKey === "tg_stars" && STARS_TEMP_DISABLED) {
        await clearState(db, userId);
        await editMessage(env, chatId, messageId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
        return answerCallback(env, cq.id);
      }
      if (catKey === "tg_stars") {
        await setState(db, userId, { step: "await_stars_choice", data: {} });
        const starsInfo = await starsPriceInfo(db, lang);
        const promptText = await getEffectiveStarsPromptText(db, lang);
        await editMessage(env, chatId, messageId, `${starsInfo}\n\n${promptText}`, starsQuickKeyboard(lang));
        return answerCallback(env, cq.id);
      }
      if (catKey === "mvp_test" && !(await isMvpTestEnabled(db))) {
        await clearCart(db, userId);
        await editMessage(env, chatId, messageId, t(lang, "service_unavailable"), ikb([[btn(t(lang, "btn_back"), "menu:games")]]));
        return answerCallback(env, cq.id);
      }
      if (catKey === "freefire" && (await isFreefireMaintenance(db))) {
        await clearCart(db, userId);
        await editMessage(env, chatId, messageId, MAINTENANCE_TEXT[lang] || MAINTENANCE_TEXT.ru, ikb([[btn(t(lang, "btn_back"), "menu:games")]]));
        return answerCallback(env, cq.id);
      }
      let cart = await getCart(db, userId);
      if (!cart || cart.catKey !== catKey) {
        cart = { catKey, items: {} };
        await saveCart(db, userId, cart);
      }
      const kb = await cartKeyboard(db, lang, catKey, cart);
      const text = await cartText(db, lang, catKey, cart);
      await editMessage(env, chatId, messageId, text, kb);
      return answerCallback(env, cq.id);
    }

    if (ns === "prices") {
      const catKey = a;
      const text = await pricesText(db, lang, catKey, userId);
      await editMessage(env, chatId, messageId, text, pricesKeyboard(lang, catKey));
      return answerCallback(env, cq.id);
    }

    if ((ns === "cartadd" || ns === "cartnext") && a === "mvp_test" && !(await isMvpTestEnabled(db))) {
      await answerCallback(env, cq.id, t(lang, "service_unavailable"), true);
      return;
    }

    if ((ns === "cartadd" || ns === "cartnext") && a === "freefire" && (await isFreefireMaintenance(db))) {
      await answerCallback(env, cq.id, MAINTENANCE_TEXT[lang] || MAINTENANCE_TEXT.ru, true);
      return;
    }

    if (ns === "cartadd") {
      const catKey = a;
      const itemId = b;
      const cat = CATALOG[catKey];
      const item = await findItem(db, catKey, itemId);
      if (!cat || !item) {
        await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
        return;
      }
      let cart = await getCart(db, userId);
      if (!cart || cart.catKey !== catKey) cart = { catKey, items: {} };
      const cur = cart.items[itemId] || 0;
      if (cur >= 10) {
        await answerCallback(env, cq.id, t(lang, "cart_max_reached"), true);
        return;
      }
      // Товары второго поставщика (MVP) покупаются отдельным заказом, по 1 шт., без других товаров в корзине.
      const inCart = Object.keys(cart.items).filter((k) => cart.items[k] > 0);
      const mvpInCart = inCart.some((k) => itemProvider(findItemBase(catKey, k)) === "mvp");
      if (itemProvider(item) === "mvp") {
        if (cur >= 1 || inCart.some((k) => k !== itemId)) {
          await answerCallback(env, cq.id, "🎫 Этот товар покупается отдельным заказом, 1 шт. Нажмите «Сброс», если хотите выбрать другой.", true);
          return;
        }
      } else if (mvpInCart) {
        await answerCallback(env, cq.id, "🎫 Пропуск прокачки покупается отдельным заказом. Нажмите «Сброс», чтобы выбрать другой товар.", true);
        return;
      }
      cart.items[itemId] = cur + 1;
      await saveCart(db, userId, cart);
      const kb = await cartKeyboard(db, lang, catKey, cart);
      const text = await cartText(db, lang, catKey, cart);
      await editMessage(env, chatId, messageId, text, kb);
      const popup = itemPopupText(item);
      return popup ? answerCallback(env, cq.id, popup, true) : answerCallback(env, cq.id);
    }

    if (ns === "cartreset") {
      const catKey = a;
      const cart = { catKey, items: {} };
      await saveCart(db, userId, cart);
      const kb = await cartKeyboard(db, lang, catKey, cart);
      const text = await cartText(db, lang, catKey, cart);
      await editMessage(env, chatId, messageId, text, kb);
      return answerCallback(env, cq.id);
    }

    if (ns === "cartnext") {
      const catKey = a;
      const cat = CATALOG[catKey];
      const cart = await getCart(db, userId);
      if (!cat || !cart || cart.catKey !== catKey) {
        await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
        return;
      }
      const resolvedItems = await getResolvedItems(db, catKey);
      const byId = Object.fromEntries(resolvedItems.map((i) => [i.id, i]));
      const lines = [];
      let total = 0;
      for (const itemId of Object.keys(cart.items)) {
        const qty = cart.items[itemId];
        const item = byId[itemId];
        if (!item || qty <= 0) continue;
        lines.push({ itemId, name: item.name, qty, price: item.price, lineTotal: item.price * qty });
        total += item.price * qty;
      }
      if (lines.length === 0) {
        await answerCallback(env, cq.id, t(lang, "cart_choose_at_least_one"), true);
        return;
      }
      const itemName = lines.map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(", ");
      const stateData = {
        catKey,
        itemId: lines.map((l) => l.itemId).join("+"),
        itemName,
        price: total,
        inputType: cat.inputType,
        items: lines,
      };
      if (cat.inputType === "ml_id") {
        await setState(db, userId, { step: "await_ml_player", data: stateData });
        await editMessage(env, chatId, messageId, t(lang, "enter_player_id_mlbb"), backHomeKeyboard(lang));
      } else {
        await setState(db, userId, { step: "await_uid", data: stateData });
        const promptKey = inputPromptKey(cat.inputType, null);
        await editMessage(env, chatId, messageId, t(lang, promptKey), backHomeKeyboard(lang));
      }
      await clearCart(db, userId);
      return answerCallback(env, cq.id);
    }

    if (ns === "confirmorder") {
      const internalId = a;
      const order = await getOrder(db, internalId);
      if (!order || order.userId !== userId) {
        await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
        return;
      }
      if (order.status !== "pending_payment") {
        await answerCallback(env, cq.id);
        return;
      }
      // pay from wallet
      const first = await idempotentOnce(db, "confirm", internalId);
      if (!first) {
        await answerCallback(env, cq.id);
        return;
      }
      const freshUser = await getUser(db, userId);
      const paid = await walletReserve(db, freshUser, order.total);
      if (!paid) {
        await editMessage(
          env,
          chatId,
          messageId,
          `${t(lang, "insufficient_balance")}\n${t(lang, "wallet_balance")}: ${fmtSom(freshUser.balance)} ${t(
            lang,
            "kg_som"
          )}`,
          walletKeyboard(lang)
        );
        await answerCallback(env, cq.id);
        return;
      }
      order.status = "paid";
      await saveOrder(db, order);
      await finalizeOrderPaid(db, order);

      await editMessage(
        env,
        chatId,
        messageId,
        `${t(lang, "order_created", order.orderNumber)}\n${t(lang, "processing")}`,
        backHomeKeyboard(lang)
      );
      order.processingMsg = { chatId, messageId };
      await saveOrder(db, order);
      await answerCallback(env, cq.id);

      // fire off donix order creation (do not block callback ack)
      await processDonixOrder(env, db, order, lang, chatId);
      return;
    }

    if (ns === "cancelorder") {
      const internalId = a;
      const order = await getOrder(db, internalId);
      if (order && order.userId === userId && order.status === "pending_payment") {
        order.status = "cancelled";
        await saveOrder(db, order);
      }
      await clearState(db, userId);
      await renderMainMenu(env, db, chatId, messageId, lang);
      return answerCallback(env, cq.id);
    }

    if (ns === "payorder") {
      const method = a;
      const orderId = b;
      const order = await getOrder(db, orderId);
      if (!order || order.userId !== userId || order.status !== "pending_payment") {
        await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
        return;
      }
      await answerCallback(env, cq.id);

      if (method === "bank") {
        const botInfo = await tgCall(env, "getMe", {});
        const redirectUrl =
          botInfo.ok && botInfo.result.username ? `https://t.me/${botInfo.result.username}` : env.APP_BASE_URL;
        const payment = await createFinikPayment(env, {
          amount: round2(order.total),
          paymentId: order.internalId,
          redirectUrl,
          description: `Nurtilek Shop order ${order.orderNumber}`,
          lang,
        });
        if (!payment.ok) {
          await editMessage(env, chatId, messageId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
          return;
        }
        // Same message, just swap the buttons — no extra message stacking underneath.
        await editMessage(
          env,
          chatId,
          messageId,
          `№ ${order.orderNumber} — ${fmtSom(order.total)} ${t(lang, "kg_som")}\n\n${t(lang, "bank_pay_hint")}`,
          {
          inline_keyboard: [
            [{ text: "💳 Оплатить", url: payment.paymentUrl }],
            [{ text: t(lang, "btn_back"), callback_data: `payorder:back:${orderId}` }],
          ],
          }
        );
        return;
      }

      if (method === "back") {
        // Return to the payment-method picker on the very same message.
        await editMessage(
          env,
          chatId,
          messageId,
          `№ ${order.orderNumber} — ${order.itemName}\n${t(lang, "total_label")}: ${fmtSom(order.total)} ${t(lang, "kg_som")}\n\n${t(lang, "choose_payment_method")}`,
          paymentMethodKeyboard(lang, orderId)
        );
        return;
      }

      if (method === "terminal") {
        const uidLines = Object.entries(order.uidData)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        const messageText = [
          `Здравствуйте! Хочу оформить заказ Nurtilek Shop.`,
          `Заказ: ${order.orderNumber}`,
          `Товар: ${order.itemName}`,
          `Сумма: ${fmtSom(order.total)} ${t(lang, "kg_som")}`,
          uidLines,
        ].join("\n");

        await sendMessage(env, chatId, t(lang, "terminal_instructions"), {
          inline_keyboard: [
            [{ text: t(lang, "terminal_dm_button"), url: `https://t.me/${env.ADMIN_USERNAME || "nurt1lek_ff"}?text=${encodeURIComponent(messageText)}` }],
            [{ text: t(lang, "btn_home"), callback_data: "menu:home" }],
          ],
        });

        await sendMessage(
          env,
          env.ADMIN_ID,
          `🧾 Заказ ожидает оплаты через терминал\n№ ${order.orderNumber}\n${order.itemName}\nСумма: ${fmtSom(order.total)} ${t(lang, "kg_som")}\nUser: ${userId} (@${user.username || "-"})\n${uidLines}`,
          ikb([[btn("✅ Оплата получена", `admin:orderpayok:${order.internalId}`)]])
        );
        return;
      }
      return;
    }

    if (ns === "wallet") {
      if (a === "home") {
        const u = await getUser(db, userId);
        const text = `${t(lang, "wallet_title")}\n${t(lang, "wallet_balance")}: ${fmtSom(u.balance)} ${t(lang, "kg_som")}`;
        await editMessage(env, chatId, messageId, text, walletKeyboard(lang));
      } else if (a === "topup") {
        await setState(db, userId, { step: "await_topup_amount", data: {} });
        await editMessage(env, chatId, messageId, t(lang, "wallet_enter_amount"), backHomeKeyboard(lang));
      } else if (a === "history") {
        const key = await walletHistoryKey(userId);
        const list = (await getJSON(db, key, [])) || [];
        if (list.length === 0) {
          await editMessage(env, chatId, messageId, t(lang, "orders_empty"), walletKeyboard(lang));
        } else {
          const lines = list
            .slice(0, 15)
            .map((h) => {
              const sign = h.type === "topup" || h.type === "refund" || h.type === "referral" || h.type === "promo" ? "+" : "−";
              return `${h.at.slice(0, 10)} — ${walletHistoryTypeLabel(lang, h.type)} — ${sign}${fmtSom(h.amount)} ${t(lang, "kg_som")}`;
            })
            .join("\n");
          await editMessage(env, chatId, messageId, lines, walletKeyboard(lang));
        }
      }
      return answerCallback(env, cq.id);
    }

    if (ns === "profile") {
      const u = await getUser(db, userId);
      const text = [
        t(lang, "profile_title"),
        `${t(lang, "profile_username")}: @${u.username || "—"}`,
        `${t(lang, "profile_id")}: ${u.id}`,
        `${t(lang, "profile_balance")}: ${fmtSom(u.balance)} ${t(lang, "kg_som")}`,
        `${t(lang, "profile_spent")}: ${fmtSom(u.spent)} ${t(lang, "kg_som")}`,
      ].join("\n");
      await editMessage(env, chatId, messageId, text, profileKeyboard(lang));
      return answerCallback(env, cq.id);
    }

    if (ns === "referral") {
      const u = await getUser(db, userId);
      const percent = await getReferralPercentForUsername(db, u.username);
      const template = await getReferralText(db, lang);
      const description = template.replace(/\{percent\}/g, String(percent));
      const botInfo = await tgCall(env, "getMe", {});
      const refLink =
        botInfo.ok && botInfo.result.username
          ? `https://t.me/${botInfo.result.username}?start=ref_${userId}`
          : "—";
      const text = [
        description,
        "",
        t(lang, "referral_rate_line", percent),
        `${t(lang, "referral_link_label")}:\n${refLink}`,
        `${t(lang, "referral_earned_label")}: ${u.referralEarnings || 0} ${t(lang, "kg_som")}`,
      ].join("\n");
      await editMessage(env, chatId, messageId, text, backHomeKeyboard(lang));
      return answerCallback(env, cq.id);
    }

    if (ns === "orders") {
      if (a === "list") {
        const orderIds = (await getJSON(db, kvKeyUserOrders(userId), [])) || [];
        if (orderIds.length === 0) {
          await editMessage(env, chatId, messageId, t(lang, "orders_empty"), backHomeKeyboard(lang));
          return answerCallback(env, cq.id);
        }
        // Plain text, not buttons — every order is readable at a glance,
        // with a colour circle for its status (🔴 отменён, 🟡 в обработке, 🟢 выполнен).
        const lines = [t(lang, "orders_title"), ""];
        for (const id of orderIds.slice(0, 20)) {
          const o = await getOrder(db, id);
          if (!o) continue;
          lines.push(`№ ${o.orderNumber}`);
          lines.push(`${o.itemName} — ${fmtSom(o.total)} ${t(lang, "kg_som")}`);
          lines.push(orderStatusLabel(lang, o.status));
          if (o.status === "completed" && ((o.category === "roblox" && o.robloxCodes && o.robloxCodes.length) || (o.giftCodes && o.giftCodes.length))) {
            lines.push(`🔑 <code>${escHtml((o.robloxCodes || o.giftCodes)[0])}</code>`);
          }
          lines.push("");
        }
        await editMessage(env, chatId, messageId, lines.join("\n").trim(), backHomeKeyboard(lang));
      }
      return answerCallback(env, cq.id);
    }

    if (ns === "promo") {
      if (a === "enter") {
        await setState(db, userId, { step: "await_promo_code", data: {} });
        await editMessage(env, chatId, messageId, t(lang, "promo_enter"), backHomeKeyboard(lang));
      }
      return answerCallback(env, cq.id);
    }

    if (ns === "lang") {
      if (a === "menu") {
        await editMessage(env, chatId, messageId, t(lang, "lang_choose"), langKeyboard());
      } else if (a === "ru" || a === "kg") {
        user.lang = a;
        await saveUser(db, user);
        await renderMainMenu(env, db, chatId, messageId, a);
      }
      return answerCallback(env, cq.id);
    }

    if (ns === "admin") {
      return handleAdminCallback(env, db, cq, a, b, c, lang);
    }

    // unknown callback_data — still ack to avoid a stuck spinner
    await answerCallback(env, cq.id);
  } catch (err) {
    console.log("callback error", err);
    await answerCallback(env, cq.id, t(lang, "service_unavailable"), true);
  }
}


/* Публикует в чат отзывов анонимную запись о выполненной покупке:
   игра, игровой ID, ник и товар. Без Telegram ID и без @username.
   Нужна переменная REVIEWS_CHAT_ID (ID канала/группы; бот должен быть там админом/участником). */
async function postPurchaseToReviewsChat(env, db, order) {
  if (!env.REVIEWS_CHAT_ID) return;
  try {
    const first = await idempotentOnce(db, "reviewpost", order.internalId);
    if (!first) return;

    const cat = CATALOG[order.category];
    const game = order.category === "roblox" ? "Roblox" : cat ? cat.name : order.category;
    const d = order.uidData || {};
    const isTelegram = order.category === "tg_stars" || order.category === "tg_premium";

    const lines = ["✅ <b>Успешная покупка</b>", "", `🎮 ${escHtml(game)}`];
    // Для Telegram-товаров в данных лежит @username — его не публикуем.
    if (!isTelegram) {
      const gameId = d.UID || d["Player ID"];
      if (gameId) {
        const idLabel = order.category === "freefire" ? "Free Fire ID" : "ID";
        lines.push(`🆔 ${idLabel}: <code>${escHtml(gameId)}</code>`);
      }
      if (d["Server ID"]) lines.push(`🌐 Server ID: ${escHtml(d["Server ID"])}`);
      if (d["Ник"] && d["Ник"] !== "—") lines.push(`👤 Ник: ${escHtml(d["Ник"])}`);
    }
    lines.push(`🛍 Товар: ${escHtml(order.itemName)}`);

    await sendMessage(env, env.REVIEWS_CHAT_ID, lines.join("\n"));
  } catch (e) {
    console.log("postPurchaseToReviewsChat error", String(e));
  }
}

/* Final "чек": заказ выполнен + номер, ID, ник, товар. Остаётся в чате, а главное меню открывается ниже. */
async function sendCompletedReceipt(env, userId, lang, order) {
  await postPurchaseToReviewsChat(env, env.DB, order);
  // Remove the "Заказ создан / обрабатывается" message so only the receipt stays.
  if (order.processingMsg && order.processingMsg.messageId) {
    await deleteMessage(env, order.processingMsg.chatId || userId, order.processingMsg.messageId);
  }
  const uidLines = Object.entries(order.uidData || {}).map(([k, v]) => `${k}: ${v}`);
  const receiptText = [
    t(lang, "completed"),
    `№ ${order.orderNumber}`,
    ...uidLines,
    order.itemName,
    "",
    t(lang, "order_completed_review_hint"),
  ].join("\n");
  await sendMessage(env, userId, receiptText, {
    inline_keyboard: [[{ text: t(lang, "btn_leave_review"), url: "https://t.me/nurtilekshop" }]],
  });
  await sendMessage(env, userId, t(lang, "main_menu"), mainMenuKeyboard(lang));
}

/* ================= DONIX ORDER PROCESSING ================= */

/* Safe wrapper: if anything throws, the "already started" guard is released so the order can be
   retried (/retryorder N or the cron job) instead of being stuck in "paid" forever. */
async function processDonixOrder(env, db, order, lang, chatId, isRetry = false) {
  // Roblox: коды выдаются из нашего склада (админка), Donix не участвует.
  if (order.category === "roblox") {
    try {
      await deliverRobloxOrder(env, db, order, lang, chatId);
    } catch (e) {
      console.log("deliverRobloxOrder error", order.orderNumber, String(e));
      await logEvent(db, "error", `Roblox заказ №${order.orderNumber}: ${String(e).slice(0, 200)}`);
      await db.delete(kvKeyIdemp("donixcreate", order.internalId));
      await notifyAdminRoblox(env, `заказ №${order.orderNumber}: ошибка выдачи кода (${String(e).slice(0, 200)}). Повтор: /retryorder ${order.orderNumber}`);
    }
    return;
  }
  // MVP Resellers: выдача у второго поставщика (поле provider у товара).
  if (orderProvider(order) === "mvp") {
    return processMvpOrder(env, db, order, lang, chatId, isRetry);
  }
  try {
    await processDonixOrderInner(env, db, order, lang, chatId, isRetry);
  } catch (e) {
    console.log("processDonixOrder error", order.orderNumber, String(e));
    await logEvent(db, "error", `заказ №${order.orderNumber}: ${String(e).slice(0, 200)}`);
    await db.delete(kvKeyIdemp("donixcreate", order.internalId));
    await notifyAdminDonix(env, `заказ №${order.orderNumber}: ошибка при отправке в Donix (${String(e).slice(0, 200)}). Повтор: /retryorder ${order.orderNumber}`);
  }
}

/* Re-sends orders that were paid but never reached Donix. Before creating anything it asks Donix
   whether that external_id already exists, so nothing is ever ordered twice. */
async function retryPaidOrder(env, db, order) {
  if (!order || order.status !== "paid") return false;
  const buyer = await getUser(db, order.userId);
  await db.delete(kvKeyIdemp("donixcreate", order.internalId));
  await db.delete(kvKeyIdemp("mvpcreate", order.internalId));
  await processDonixOrder(env, db, order, buyer.lang || "ru", order.userId, true);
  return true;
}

async function retryStuckPaidOrders(env, db, minAgeMs = 3 * 60 * 1000, maxAgeMs = 20 * 60 * 1000) {
  let n = 0;
  const list = await db.list({ prefix: "order:" });
  for (const k of list.keys) {
    if (n >= 10) break;
    const o = await getJSON(db, k.name);
    if (!o || o.status !== "paid") continue;
    const age = Date.now() - new Date(o.updatedAt || o.createdAt).getTime();
    if (age < minAgeMs || age > maxAgeMs) continue; // old ones may already be delivered by hand -> only /retryorder
    if (await retryPaidOrder(env, db, o)) n++;
  }
  return n;
}

async function processDonixOrderInner(env, db, order, lang, chatId, isRetry) {
  const first = await idempotentOnce(db, "donixcreate", order.internalId);
  if (!first) return;

  const uid = donixUidFromData(order.uidData);
  const server = order.uidData && order.uidData["Server ID"] ? String(order.uidData["Server ID"]) : null;

  const failOrder = async (reason) => {
    order.status = "failed";
    if (order.items) order.items.forEach((l) => (l.status = "failed"));
    await saveOrder(db, order);
    const refundOk = await idempotentOnce(db, "refund", order.internalId);
    if (refundOk) await walletRelease(db, order.userId, order.total, `order_failed:${order.orderNumber}`);
    await restoreGiftPromo(db, order);
    await notifyAdminDonix(env, `заказ №${order.orderNumber} не создан. ${reason}`);
    await sendMessage(env, chatId, t(lang, order.isGift ? "gift_failed" : "failed"), backHomeKeyboard(lang));
  };

  // Cart orders: one Donix order per unit (the API has no quantity field).
  // Товары уходят в Donix ПО ОЧЕРЕДИ: следующий отправляется, когда предыдущий выполнен
  // (см. sendNextQueuedUnit). Пока ждёт своей очереди, позиция в статусе "queued".
  if (order.items && order.items.length > 0) {
    const isTg = isTelegramCategory(order.category);
    for (const line of order.items) {
      if (isTg) {
        if (!premiumMonthsFromItemId(line.itemId)) return failOrder(`не удалось определить срок Premium для «${line.name}» (${line.itemId})`);
      } else {
        const sku = await resolveDonixSku(env, order.category, line.itemId, line.name);
        if (!sku) return failOrder(`не найден SKU для «${line.name}» (${line.itemId}). Используйте /setsku ${line.itemId} SKU`);
        line.sku = sku;
      }
      const qty = Math.max(1, line.qty || 1);
      line.units = {};
      for (let i = 1; i <= qty; i++) line.units[String(i)] = "queued";
      line.status = "queued";
    }
    let inFlight = false;
    outer: for (const line of order.items) {
      const qty = Math.max(1, line.qty || 1);
      for (let i = 1; i <= qty; i++) {
        const extId = cartUnitExternalId(order, line, i);
        const ex = isRetry ? await donixOrderByExternal(env, extId) : null;
        if (ex && ex.ok && ex.data) {
          // этот юнит уже есть в Donix — не создаём второй раз
          line.units[String(i)] = "processing";
          line.status = "processing";
          if (extractDonixOrderInfo(ex.data).status !== "completed") inFlight = true;
          continue;
        }
        if (inFlight) break outer;
        const r = await sendCartUnit(env, order, line, i);
        if (!r.ok || !r.data) return failOrder(`${line.name}: ${donixErrText(r)}`);
        line.units[String(i)] = "processing";
        line.status = "processing";
        line.donixOrderId = r.data.order_id || r.data.id || null;
        await idempotentOnce(db, "unitsend", extId);
        inFlight = true;
        break outer;
      }
    }
    await saveOrderProcessing(db, order);
    return;
  }

  let payload;
  let sendFn = donixCreateOrder;
  if (isTelegramCategory(order.category)) {
    sendFn = donixTelegramOrder;
    payload = { external_id: order.internalId, username: uid };
    if (order.category === "tg_stars") {
      const stars = Number(order.uidData && order.uidData.Stars);
      if (!Number.isFinite(stars) || stars < 50) return failOrder(`неверное количество Stars: ${order.uidData && order.uidData.Stars}`);
      payload.stars = stars; // Stars: один заказ на всё количество
    } else {
      const months = premiumMonthsFromItemId(order.itemId);
      if (!months) return failOrder(`не удалось определить срок Premium (${order.itemId})`);
      payload.premium = months;
    }
  } else {
    const sku = await resolveDonixSku(env, order.category, order.itemId, order.itemName);
    if (!sku) return failOrder(`не найден SKU для «${order.itemName}» (${order.itemId}). Используйте /setsku ${order.itemId} SKU`);
    payload = { external_id: order.internalId, sku, uid };
    if (server) payload.server = server;
  }
  let result = null;
  if (isRetry) {
    const ex = await donixOrderByExternal(env, order.internalId);
    if (ex.ok && ex.data) result = ex;
  }
  if (!result) result = await sendFn(env, payload);
  if (!result.ok || !result.data) return failOrder(donixErrText(result));

  order.donixOrderId = result.data.order_id || result.data.id || null;
  await saveOrderProcessing(db, order);
}

/* Сохраняет статус «в обработке» после отправки поставщику, НЕ затирая финальный статус.
   Donix часто выполняет заказ за секунды, и вебхук «completed» приходит раньше, чем мы дошли до сохранения:
   раньше старая копия заказа перезаписывала «выполнен» обратно на «в обработке», и заказ висел вечно. */
async function saveOrderProcessing(db, order) {
  const TERMINAL = ["completed", "failed", "refunded"];
  const fresh = await getOrder(db, order.internalId);
  if (fresh && TERMINAL.includes(fresh.status)) {
    let changed = false;
    if (order.donixOrderId && !fresh.donixOrderId) { fresh.donixOrderId = order.donixOrderId; changed = true; }
    for (const line of order.items || []) {
      const fl = (fresh.items || []).find((x) => x.itemId === line.itemId);
      if (fl && line.donixOrderId && !fl.donixOrderId) { fl.donixOrderId = line.donixOrderId; changed = true; }
    }
    if (changed) await saveOrder(db, fresh);
    order.status = fresh.status;
    return fresh;
  }
  if (fresh && fresh.items && order.items) {
    // часть позиций вебхук уже мог закрыть — их финальные состояния сохраняем
    for (const line of order.items) {
      const fl = fresh.items.find((x) => x.itemId === line.itemId);
      if (!fl) continue;
      if (TERMINAL.includes(fl.status)) line.status = fl.status;
      if (fl.units && line.units) for (const k of Object.keys(line.units)) if (TERMINAL.includes(fl.units[k])) line.units[k] = fl.units[k];
    }
  }
  order.status = "processing";
  await saveOrder(db, order);
  return order;
}

/* Сверяет один «зависший» заказ с поставщиком и, если он уже выполнен/не выполнен, закрывает его
   (при этом клиенту уходит чек в чат бота, а запись о покупке — в чат отзывов). */
async function reconcileOneOrder(env, db, order) {
  if (orderProvider(order) === "mvp") {
    if (order.status !== "processing") return 0;
    const mr = await mvpReconcileOrder(env, db, order);
    return mr && mr.updated ? 1 : 0;
  }
  const ids = [];
  if (order.items && order.items.length > 0) {
    for (const line of order.items) {
      const qty = Math.max(1, line.qty || 1);
      for (let i = 1; i <= qty; i++) ids.push(qty > 1 ? `${order.internalId}::${line.itemId}#${i}` : `${order.internalId}::${line.itemId}`);
    }
  } else {
    ids.push(order.internalId);
  }
  let n = 0;
  for (const externalId of ids) {
    const r = await donixOrderByExternal(env, externalId);
    if (!r.ok || !r.data) continue;
    const { status } = extractDonixOrderInfo(r.data);
    if (status === "completed" || status === "failed" || status === "refunded") {
      await handleDonixStatusUpdate(env, db, externalId, status, true);
      n++;
    }
  }
  return n;
}

/* ---- Последовательная отправка позиций корзины в Donix ---- */
function cartUnitExternalId(order, line, i) {
  const qty = Math.max(1, line.qty || 1);
  return qty > 1 ? `${order.internalId}::${line.itemId}#${i}` : `${order.internalId}::${line.itemId}`;
}

/* Создаёт в Donix один юнит позиции корзины. Возвращает ответ Donix ({ok, data, status}). */
async function sendCartUnit(env, order, line, i) {
  const uid = donixUidFromData(order.uidData);
  const server = order.uidData && order.uidData["Server ID"] ? String(order.uidData["Server ID"]) : null;
  const isTg = isTelegramCategory(order.category);
  const externalId = cartUnitExternalId(order, line, i);
  if (isTg) {
    const months = premiumMonthsFromItemId(line.itemId);
    if (!months) return { ok: false, status: 0, data: { error: "не определён срок Premium" } };
    return donixTelegramOrder(env, { external_id: externalId, username: uid, premium: months });
  }
  const sku = line.sku || (await resolveDonixSku(env, order.category, line.itemId, line.name));
  if (!sku) return { ok: false, status: 0, data: { error: "не найден SKU" } };
  const payload = { external_id: externalId, sku, uid };
  if (server) payload.server = server;
  return donixCreateOrder(env, payload);
}

function recomputeLineStatus(line) {
  if (!line.units) return;
  const states = Object.values(line.units);
  const terminal = ["completed", "failed", "refunded"];
  if (states.every((x) => terminal.includes(x))) {
    line.status = states.some((x) => x !== "completed") ? "failed" : "completed";
  } else if (states.some((x) => x !== "queued" && !terminal.includes(x)) || states.some((x) => x === "completed")) {
    line.status = "processing";
  } else {
    line.status = "queued";
  }
}

/* Если юнит не выполнился — все ещё не отправленные ("queued") снимаем с очереди и возвращаем за них деньги. */
async function abortQueuedUnits(db, order) {
  const factor = order.price > 0 ? order.total / order.price : 1;
  for (const line of order.items || []) {
    if (!line.units) continue;
    let touched = false;
    for (const k of Object.keys(line.units)) {
      if (line.units[k] !== "queued") continue;
      line.units[k] = "failed";
      touched = true;
      const refundOk = await idempotentOnce(db, "refund", `${order.internalId}::${line.itemId}#${k}`);
      if (refundOk) await walletRelease(db, order.userId, round2(line.price * factor), `donix_queued_cancel:${order.orderNumber}:${line.itemId}#${k}`);
    }
    if (touched) recomputeLineStatus(line);
  }
}

/* Завершает заказ, когда все позиции в финальном состоянии: чек покупателю или сообщение об ошибке. */
async function finalizeCartOrderIfDone(env, db, order, user, lang) {
  const allDone = order.items.every((l) => ["completed", "failed", "refunded"].includes(l.status));
  if (!allDone) {
    await saveOrder(db, order);
    return;
  }
  const anyIssue = order.items.some((l) => l.status === "failed" || l.status === "refunded");
  order.status = anyIssue ? "failed" : "completed";
  await saveOrder(db, order);
  if (order.status === "completed") {
    await sendCompletedReceipt(env, user.id, lang, order);
  } else {
    await restoreGiftPromo(db, order);
    const report = buildPartialReport(lang, order);
    if (report) {
      await sendMessage(env, user.id, report, backHomeKeyboard(lang));
    } else {
      await sendMessage(env, user.id, t(lang, order.isGift ? "gift_failed" : "failed"), backHomeKeyboard(lang));
    }
  }
}

/* Если часть корзины выполнена, а часть нет — подробный отчёт: что выдано, что не выдано
   и сколько денег за это вернулось на кошелёк. Если выдано ничего — возвращает null
   (тогда показывается обычное сообщение «Не удалось выполнить заказ»). */
function buildPartialReport(lang, order) {
  if (!order.items || order.items.length === 0) return null;
  const factor = order.price > 0 ? order.total / order.price : 1;
  const done = [];
  const failed = [];
  let refundTotal = 0;
  for (const line of order.items) {
    let okCount = 0;
    let badCount = 0;
    if (line.units && Object.keys(line.units).length > 0) {
      for (const s of Object.values(line.units)) {
        if (s === "completed") okCount++;
        else badCount++;
      }
    } else {
      const qty = Math.max(1, line.qty || 1);
      if (line.status === "completed") okCount = qty;
      else badCount = qty;
    }
    if (okCount > 0) done.push(`• ${escHtml(line.name)} × ${okCount}`);
    if (badCount > 0) {
      const refund = round2(line.price * factor * badCount);
      refundTotal = round2(refundTotal + refund);
      failed.push(`• ${escHtml(line.name)} × ${badCount} — ${fmtSom(refund)} ${t(lang, "kg_som")}`);
    }
  }
  if (done.length === 0 || failed.length === 0) return null;
  return [
    t(lang, "partial_title", order.orderNumber),
    "",
    t(lang, "partial_done"),
    ...done,
    "",
    t(lang, "partial_failed"),
    ...failed,
    "",
    `${t(lang, "partial_refund_total")}: ${fmtSom(refundTotal)} ${t(lang, "kg_som")}`,
  ].join("\n");
}

/* Отправляет в Donix следующий юнит из очереди — только если сейчас ни один юнит не выполняется. */
async function sendNextQueuedUnit(env, db, order, user, lang) {
  if (!order.items) return;
  for (const line of order.items) {
    if (line.units && Object.values(line.units).some((x) => x === "processing")) return; // уже что-то идёт
  }
  for (const line of order.items) {
    if (!line.units) continue;
    const keys = Object.keys(line.units).sort((a, b) => Number(a) - Number(b));
    for (const k of keys) {
      if (line.units[k] !== "queued") continue;
      const extId = cartUnitExternalId(order, line, k);
      const guard = await idempotentOnce(db, "unitsend", extId);
      if (!guard) return; // этот юнит уже отправляли
      const r = await sendCartUnit(env, order, line, k);
      if (!r.ok || !r.data) {
        await db.delete(kvKeyIdemp("unitsend", extId));
        await notifyAdminDonix(env, `заказ №${order.orderNumber}: не удалось отправить «${line.name}» в Donix (${donixErrText(r)}). Остальное возвращено на баланс.`);
        line.units[k] = "failed";
        const factor = order.price > 0 ? order.total / order.price : 1;
        const refundOk = await idempotentOnce(db, "refund", `${order.internalId}::${line.itemId}#${k}`);
        if (refundOk) await walletRelease(db, order.userId, round2(line.price * factor), `donix_send_failed:${order.orderNumber}:${line.itemId}#${k}`);
        recomputeLineStatus(line);
        await abortQueuedUnits(db, order);
        await finalizeCartOrderIfDone(env, db, order, user, lang);
        return;
      }
      line.units[k] = "processing";
      line.status = "processing";
      line.donixOrderId = r.data.order_id || r.data.id || null;
      order.status = "processing";
      await saveOrder(db, order);
      return;
    }
  }
}

/* called from /donix-webhook when a status update arrives */
async function handleDonixStatusUpdate(env, db, externalId, status, force = false) {
  // Cart (multi-item) orders send one Donix order per line, tagged "<internalId>::<itemId>".
  let order = await getOrder(db, externalId);
  let cartLine = null;
  let unitKey = null;
  if (!order && externalId.includes("::")) {
    const [baseId, lineRef] = externalId.split("::");
    const [lineItemId, unitPart] = lineRef.split("#");
    unitKey = unitPart || null;
    order = await getOrder(db, baseId);
    if (order && order.items) cartLine = order.items.find((l) => l.itemId === lineItemId) || null;
  }
  if (!order) return;

  // Заказ уже закрыт (в т.ч. вручную) — поздние/повторные статусы его не откатывают.
  if (order.status === "completed" && status === "processing") return;
  if (order.status === "completed" && order.closedManually) return;

  const idempKey = `${externalId}:${status}`;
  if (force) {
    // Повторная сверка из cron: пропускаем идемпотентность, но только если реально есть что чинить.
    const needsFix = cartLine
      ? (unitKey && cartLine.units ? cartLine.units[unitKey] !== status : cartLine.status !== status)
      : order.status !== status;
    if (!needsFix) return;
  } else {
    const first = await idempotentOnce(db, "donixstatus", idempKey);
    if (!first) return; // already processed this exact status transition
  }

  const user = await getUser(db, order.userId);
  const lang = user.lang || "ru";

  if (cartLine) {
    return handleCartLineStatusUpdate(env, db, order, cartLine, status, user, lang, unitKey);
  }

  if (status === "processing") {
    order.status = "processing";
    await saveOrder(db, order);
  } else if (status === "completed") {
    order.status = "completed";
    await saveOrder(db, order);
    await sendCompletedReceipt(env, user.id, lang, order);
  } else if (status === "failed") {
    order.status = "failed";
    await saveOrder(db, order);
    const refundOk = await idempotentOnce(db, "refund", externalId);
    if (refundOk) await walletRelease(db, order.userId, order.total, `donix_failed:${order.orderNumber}`);
    await sendMessage(env, user.id, t(lang, "failed"), backHomeKeyboard(lang));
  } else if (status === "refunded") {
    order.status = "refunded";
    await saveOrder(db, order);
    const refundOk = await idempotentOnce(db, "refund", externalId);
    if (refundOk) await walletRelease(db, order.userId, order.total, `donix_refunded:${order.orderNumber}`);
    await sendMessage(env, user.id, t(lang, "refunded"), backHomeKeyboard(lang));
  }
}

/* Updates the status of a single cart line inside a multi-item order, refunds just that
   line's amount if it fails/gets refunded, and finalizes the order once every line has
   reached a terminal state (completed/failed/refunded). */
async function handleCartLineStatusUpdate(env, db, order, cartLine, status, user, lang, unitKey = null) {
  const TERMINAL = ["completed", "failed", "refunded"];
  // Позиция из одного юнита приходит без "#1" — приводим к единому виду.
  if (!unitKey && cartLine.units && Object.keys(cartLine.units).length === 1) unitKey = Object.keys(cartLine.units)[0];

  if (status === "processing") {
    // «processing» может прийти ПОСЛЕ «completed» — не затираем уже финальное состояние.
    if (unitKey && cartLine.units && !TERMINAL.includes(cartLine.units[unitKey])) cartLine.units[unitKey] = "processing";
    if (!TERMINAL.includes(cartLine.status)) cartLine.status = "processing";
    if (order.status !== "processing" && order.status !== "completed" && order.status !== "failed") order.status = "processing";
    await saveOrder(db, order);
    return;
  }

  // Перечитываем заказ прямо перед записью, чтобы параллельные вебхуки не затирали друг друга.
  {
    const fresh = await getOrder(db, order.internalId);
    if (fresh && fresh.items) {
      order = fresh;
      cartLine = fresh.items.find((l) => l.itemId === cartLine.itemId) || cartLine;
    }
  }

  const factor = order.price > 0 ? order.total / order.price : 1;

  if (unitKey && cartLine.units) {
    cartLine.units[unitKey] = status;
    if (status === "failed" || status === "refunded") {
      const refundOk = await idempotentOnce(db, "refund", `${order.internalId}::${cartLine.itemId}#${unitKey}`);
      if (refundOk) await walletRelease(db, order.userId, round2(cartLine.price * factor), `donix_${status}:${order.orderNumber}:${cartLine.itemId}#${unitKey}`);
    }
    recomputeLineStatus(cartLine);
  } else if (status === "failed" || status === "refunded") {
    cartLine.status = status;
    const refundOk = await idempotentOnce(db, "refund", `${order.internalId}::${cartLine.itemId}`);
    if (refundOk) {
      await walletRelease(db, order.userId, round2(cartLine.price * (cartLine.qty || 1) * factor), `donix_${status}:${order.orderNumber}:${cartLine.itemId}`);
    }
  } else if (status === "completed") {
    cartLine.status = "completed";
  }

  if (status === "failed" || status === "refunded") {
    // Следующие товары из очереди не отправляем — возвращаем за них деньги.
    await abortQueuedUnits(db, order);
    await finalizeCartOrderIfDone(env, db, order, user, lang);
    return;
  }

  // Выполнен -> отправляем следующий товар из очереди; если очередь пуста и всё выполнено — чек покупателю.
  await saveOrder(db, order);
  await sendNextQueuedUnit(env, db, order, user, lang);
  const after = await getOrder(db, order.internalId);
  if (after && after.status !== "failed") await finalizeCartOrderIfDone(env, db, after, user, lang);
}

/* ================= TEXT MESSAGE HANDLER ================= */

function giftPromoLabel(p) {
  const base = p.gift ? findItemBase(p.gift.catKey, p.gift.itemId) : null;
  const cat = p.gift ? CATALOG[p.gift.catKey] : null;
  return `🎁 ${cat ? cat.name + " — " : ""}${base ? base.name : p.gift ? p.gift.itemId : "?"}`;
}

function promoValText(p) {
  if (p.type === "gift") return giftPromoLabel(p);
  if (p.type === "balance") return `💰 +${fmtSom(p.value)} сом на баланс`;
  if (p.type === "prices") {
    return `💲 ${(CATALOG[p.catKey] || {}).name || p.catKey} (особые цены, товаров: ${Object.keys(p.prices || {}).length})`;
  }
  return p.type === "percent" ? `-${p.value}%` : `-${p.value} сом`;
}

/* Возвращает использование подарочного промокода, если заказ не удалось выполнить. */
async function restoreGiftPromo(db, order) {
  if (!order || !order.isGift || !order.promoCode) return;
  const once = await idempotentOnce(db, "giftrestore", order.internalId);
  if (!once) return;
  const promo = await getJSON(db, kvKeyPromo(order.promoCode));
  if (promo && promo.usesLeft !== null) {
    promo.usesLeft += 1;
    await putJSON(db, kvKeyPromo(order.promoCode), promo);
  }
  await db.delete(kvKeyPromoUse(order.promoCode, order.userId));
}

/* Пользователь ввёл подарочный промокод: сразу просим игровой ID (оплата не нужна). */
async function startGiftRedeem(env, db, lang, chatId, userId, promo) {
  const g = promo.gift;
  const cat = g ? CATALOG[g.catKey] : null;
  const item = g ? await findItem(db, g.catKey, g.itemId) : null;
  if (!cat || !item) {
    await sendMessage(env, chatId, t(lang, "promo_invalid"), backHomeKeyboard(lang));
    return;
  }
  if (g.catKey === "freefire" && (await isFreefireMaintenance(db))) {
    await sendMessage(env, chatId, MAINTENANCE_TEXT[lang] || MAINTENANCE_TEXT.ru, backHomeKeyboard(lang));
    return;
  }
  const stateData = {
    catKey: g.catKey,
    itemId: g.itemId,
    itemName: item.name,
    price: item.price,
    inputType: cat.inputType,
    items: [{ itemId: g.itemId, name: item.name, qty: 1, price: item.price, lineTotal: item.price }],
    giftCode: promo.code,
  };
  if (cat.inputType === "ml_id") {
    await setState(db, userId, { step: "await_ml_player", data: stateData });
    await sendMessage(env, chatId, `${t(lang, "gift_activated", item.name)}\n\n${t(lang, "enter_player_id_mlbb")}`, backHomeKeyboard(lang));
  } else {
    await setState(db, userId, { step: "await_uid", data: stateData });
    await sendMessage(env, chatId, `${t(lang, "gift_activated", item.name)}\n\n${t(lang, inputPromptKey(cat.inputType, null))}`, backHomeKeyboard(lang));
  }
}

/* Подарочный заказ: без оплаты — сразу «оплачен» и уходит в Donix. */
async function claimGiftOrder(env, db, lang, chatId, userId, order, prompt) {
  const check = await validatePromo(db, order.promoCode, userId, 0);
  if (!check.ok) {
    order.status = "cancelled";
    await saveOrder(db, order);
    await sendMessage(env, chatId, t(lang, "promo_invalid"), backHomeKeyboard(lang));
    return;
  }
  const first = await idempotentOnce(db, "giftclaim", order.internalId);
  if (!first) return;
  order.isGift = true;
  order.status = "paid";
  order.paymentMethod = "gift";
  await saveOrder(db, order);
  await consumePromo(db, order.promoCode, userId);
  const procRes = await sendMessage(
    env,
    chatId,
    `${prompt.text}\n\n${t(lang, "order_created", order.orderNumber)}\n${t(lang, "processing")}`,
    backHomeKeyboard(lang)
  );
  if (procRes && procRes.ok && procRes.result) {
    order.processingMsg = { chatId, messageId: procRes.result.message_id };
    await saveOrder(db, order);
  }
  await processDonixOrder(env, db, order, lang, chatId);
}

/* Показывает итог заказа: обычный — с выбором оплаты, подарочный — сразу выдача. */
async function sendOrderSummary(env, db, lang, chatId, userId, order, prompt) {
  if (prompt.isGift) return claimGiftOrder(env, db, lang, chatId, userId, order, prompt);
  const sent = await sendMessage(
    env,
    chatId,
    `№ ${order.orderNumber}\n${prompt.text}\n\n${t(lang, "choose_payment_method")}`,
    paymentMethodKeyboard(lang, order.internalId)
  );
  if (!sent || !sent.ok) {
    // Клиент не увидел заказ — не оставляем «висящий» неоплаченный заказ в админке.
    order.status = "cancelled";
    await saveOrder(db, order);
    await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
  }
}

async function buildOrderConfirmPrompt(env, db, lang, userId, stateData, uidData) {
  const price = stateData.price;
  if (stateData.giftCode) {
    const giftLine = lang === "kg" ? "🎁 Промокод боюнча белек" : "🎁 Подарок по промокоду";
    const text = [
      Object.entries(uidData)
        .map(([k, v]) => `${k}: ${escHtml(v)}`)
        .join("\n"),
      `${stateData.itemName}`,
      giftLine,
      `${t(lang, "total_label")}: 0 ${t(lang, "kg_som")}`,
    ].join("\n");
    return { text, total: 0, discount: price, promoCode: stateData.giftCode, isGift: true };
  }
  let discount = 0;
  let promoCode = null;
  let promoInfo = null;
  // The active promo code is kept in its own KV key (not in the step-machine state),
  // so it survives moving between menus/categories while the user picks a product.
  const activeCode = await db.get(kvKeyActivePromo(userId));
  // Steam продаётся без скидок: промокоды на него не действуют и не тратятся.
  if (activeCode && stateData.catKey !== "steam") {
    const check = await validatePromo(db, activeCode, userId, price, { catKey: stateData.catKey, lines: stateData.items });
    // Промокод с особыми ценами применяется только если реально что-то удешевляет (иначе не тратим его).
    if (check.ok && !(check.promo.type === "prices" && check.discount <= 0)) {
      discount = check.discount;
      promoCode = activeCode;
      promoInfo = check.promo;
    }
  }
  const total = round2(price - discount);
  const lines = [
    Object.entries(uidData)
      .map(([k, v]) => `${k}: ${escHtml(v)}`)
      .join("\n"),
    `${stateData.itemName}`,
    `${t(lang, "price_label")}: ${fmtSom(price)} ${t(lang, "kg_som")}`,
  ];
  if (discount > 0) {
    // Show the promo's real percent (e.g. 8.5%), not a rounded value derived from the discount.
    const discountPercent =
      promoInfo && promoInfo.type === "percent"
        ? fmtPercent(promoInfo.value)
        : fmtPercent(price > 0 ? (discount / price) * 100 : 0);
    lines.push(`${t(lang, "discount_label")}: ${fmtSom(discount)} ${t(lang, "kg_som")} (-${discountPercent}%)`);
  }
  lines.push(`${t(lang, "total_label")}: ${fmtSom(total)} ${t(lang, "kg_som")}`);
  return { text: lines.join("\n"), total, discount, promoCode };
}

/* Checks a Telegram @username via Donix. Returns { state: "ok"|"invalid"|"down", name }. */
async function checkTelegramUsername(env, username) {
  const r = await donixTelegramCheck(env, username);
  if (r.status === 0 || r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) {
    if (r.status === 401 || r.status === 403) await notifyAdminDonix(env, `проверка Telegram username: ${donixErrText(r)}`);
    return { state: "down" };
  }
  if (r.ok && r.data && r.data.valid !== false) return { state: "ok", name: r.data.name || null };
  return { state: "invalid" };
}

/* Достаёт номер заказа из команды: "/closeorder 155", "/closeorder:155", "/closeorder@bot 155",
   "/closeorder №155", "/closeorder #155". Возвращает строку с цифрами или null. */
function parseOrderNumArg(text, cmd) {
  const re = new RegExp("^\\/" + cmd + "(?:@\\w+)?[\\s:=\\-]*[№#]?\\s*(\\d+)", "i");
  const m = String(text || "").trim().match(re);
  return m ? m[1] : null;
}

/* Промокод на баланс: зачисляет сумму на кошелёк пользователя (один раз на аккаунт). */
async function redeemBalancePromo(db, promo, userId) {
  const key = `${promo.code}:${userId}`;
  const first = await idempotentOnce(db, "balpromo", key);
  if (!first) return { ok: false };
  const fresh = await getJSON(db, kvKeyPromo(promo.code));
  if (!fresh || !fresh.active || (fresh.usesLeft !== null && fresh.usesLeft <= 0)) {
    await db.delete(kvKeyIdemp("balpromo", key));
    return { ok: false };
  }
  if (fresh.usesLeft !== null) {
    fresh.usesLeft = Math.max(0, fresh.usesLeft - 1);
    await putJSON(db, kvKeyPromo(fresh.code), fresh);
  }
  await db.put(kvKeyPromoUse(fresh.code, userId), "1");
  const amount = round2(fresh.value);
  const user = await getUser(db, userId);
  user.balance = round2(user.balance + amount);
  await saveUser(db, user);
  await addWalletHistory(db, userId, { type: "promo", amount, note: fresh.code });
  await logEvent(db, "promo", `Промокод ${fresh.code}: +${fmtSom(amount)} сом пользователю ${userId}`);
  return { ok: true, amount, balance: user.balance, usesLeft: fresh.usesLeft };
}

async function handleMessage(env, db, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();

  // Admin: /setsku ITEM_ID DONIX_SKU  (manual SKU override; "/setsku ITEM_ID -" removes it)
  if (text.startsWith("/setsku") && isAdmin(env, userId)) {
    const [, itemId, ...skuParts] = text.split(/\s+/);
    const sku = skuParts.join(" ");
    if (!itemId || !sku) {
      await sendMessage(env, chatId, "Формат: /setsku ID_ТОВАРА SKU_DONIX\nНапример: /setsku ff_110 110-алмазов");
      return;
    }
    if (sku === "-") {
      await db.delete(`skuov:${itemId}`);
      await sendMessage(env, chatId, `SKU для ${itemId} сброшен (будет подбираться автоматически).`);
    } else {
      await db.put(`skuov:${itemId}`, sku);
      await sendMessage(env, chatId, `✅ ${itemId} → ${sku}`);
    }
    return;
  }

  // Admin: /setmvp ITEM_ID MVP_PRODUCT_ID  (правка product_id у MVP без деплоя; "-" сбрасывает)
  if (text.startsWith("/setmvp") && isAdmin(env, userId)) {
    const [, itemId, productId] = text.split(/\s+/);
    if (!itemId || !productId) {
      await sendMessage(env, chatId, "Формат: /setmvp ID_ТОВАРА PRODUCT_ID_MVP\nНапример: /setmvp mvp_ff_110 ff.cis.dia.110\nСписок: /mvpproducts ff");
      return;
    }
    const item = Object.values(CATALOG).flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item || itemProvider(item) !== "mvp") {
      await sendMessage(env, chatId, `Товар ${itemId} не найден среди товаров MVP.`);
      return;
    }
    if (productId === "-") {
      await db.delete(`mvpov:${itemId}`);
      await sendMessage(env, chatId, `product_id для ${itemId} сброшен (из каталога: ${item.providerProductId || "не задан"}).`);
    } else {
      await db.put(`mvpov:${itemId}`, productId);
      await sendMessage(env, chatId, `✅ ${itemId} → MVP ${productId}`);
    }
    return;
  }

  // Admin: /mvpproducts [game_id]  (без аргумента — игры и число товаров; с game_id — товары и цены MVP)
  if (/^\/mvpproducts/i.test(text) && isAdmin(env, userId)) {
    const arg = (text.split(/\s+/)[1] || "").toLowerCase();
    const r = await mvpRequest(env, "GET", "/products");
    if (!r.ok || !r.data || !Array.isArray(r.data.data)) {
      await sendMessage(env, chatId, `⚠️ MVP: ${escHtml(mvpErrText(r))}`);
      return;
    }
    const list = r.data.data;
    const lines = [];
    if (!arg) {
      const games = new Map();
      for (const p of list) {
        const g = p.game && p.game.id ? String(p.game.id) : "?";
        const e = games.get(g) || { name: p.game && p.game.name ? p.game.name : g, n: 0 };
        e.n++;
        games.set(g, e);
      }
      lines.push("🟣 Игры в каталоге MVP:");
      for (const [g, e] of games) lines.push(`${g} — ${e.name}: ${e.n} шт.`);
      lines.push("", "Товары игры: /mvpproducts ID_ИГРЫ (например /mvpproducts ff)");
    } else {
      const sel = list.filter((p) => p.game && String(p.game.id).toLowerCase() === arg);
      lines.push(`🟣 MVP «${arg}»: ${sel.length} шт. (product_id — название — цена, сом)`);
      for (const p of sel) lines.push(`${p.product_id} — ${p.title} — ${p.price}`);
    }
    let cur = "";
    for (const ln of lines) {
      if ((cur + ln).length > 3500) {
        await sendMessage(env, chatId, escHtml(cur));
        cur = "";
      }
      cur += ln + "\n";
    }
    if (cur) await sendMessage(env, chatId, escHtml(cur));
    return;
  }

  // Admin: /setapp  (ставит кнопку «Магазин» с мини-аппом рядом с полем ввода)
  if (/^\/setapp/i.test(text) && isAdmin(env, userId)) {
    if (!APP_URL) {
      await sendMessage(env, chatId, "❌ Не задана переменная APP_BASE_URL (адрес воркера).");
      return;
    }
    const r = await tgCall(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "Магазин", web_app: { url: APP_URL } } });
    await sendMessage(env, chatId, r.ok ? `✅ Кнопка «Магазин» установлена.\n${APP_URL}` : `❌ Не удалось: ${escHtml(JSON.stringify(r))}`);
    return;
  }

  // Admin: /ffmaint on|off  (техработы Free Fire)
  if (text.startsWith("/ffmaint") && isAdmin(env, userId)) {
    const arg = (text.split(/\s+/)[1] || "").toLowerCase();
    if (arg !== "on" && arg !== "off") {
      const cur = await isFreefireMaintenance(db);
      await sendMessage(env, chatId, `Техработы Free Fire сейчас: ${cur ? "ВКЛЮЧЕНЫ 🛠" : "выключены ✅"}\n\n/ffmaint on — включить\n/ffmaint off — выключить`);
      return;
    }
    await db.put("config:ff_maintenance", arg);
    await sendMessage(env, chatId, arg === "on" ? "🛠 Техработы Free Fire ВКЛЮЧЕНЫ. Покупатели видят сообщение." : "✅ Техработы выключены. Free Fire снова доступен.");
    return;
  }

  // Диагностика: команда админская, а ID не совпал с ADMIN_ID
  if (/^\/(closeorder|retryorder)/i.test(text) && !isAdmin(env, userId)) {
    await sendMessage(env, chatId, `⛔ Команда только для админа. Ваш Telegram ID: ${userId}. Он должен совпадать с переменной ADMIN_ID в Cloudflare.`);
    return;
  }

  // Admin: /closeorder N  (order was delivered by hand -> close it, nothing is sent to Donix)
  if (/^\/closeorder/i.test(text) && isAdmin(env, userId)) {
    const num = parseOrderNumArg(text, "closeorder");
    if (!num) {
      await sendMessage(env, chatId, "Формат: /closeorder НОМЕР_ЗАКАЗА\nНапример: /closeorder 155");
      return;
    }
    const o = await getOrderByNumber(db, num);
    if (!o) {
      await sendMessage(env, chatId, `Заказ №${num} не найден.`);
      return;
    }
    if (o.status === "completed") {
      await sendMessage(env, chatId, `Заказ №${o.orderNumber} уже выполнен.`);
      return;
    }
    if (o.status === "pending_payment" || o.status === "cancelled") {
      await sendMessage(env, chatId, `Заказ №${o.orderNumber} в статусе «${o.status}» — он не оплачен, закрывать нельзя.`);
      return;
    }
    o.status = "completed";
    o.closedManually = true;
    if (o.items) o.items.forEach((l) => {
      l.status = "completed";
      if (l.units) Object.keys(l.units).forEach((k) => (l.units[k] = "completed"));
    });
    await saveOrder(db, o);
    await idempotentOnce(db, "donixcreate", o.internalId); // block any later auto-send
    // Покупателю уходит тот же чек «✅ Заказ успешно выполнен», что и при автовыдаче
    // (+ публикация в чат отзывов, если задан REVIEWS_CHAT_ID).
    const buyer = await getUser(db, o.userId);
    await sendCompletedReceipt(env, o.userId, buyer.lang || "ru", o);
    await sendMessage(env, chatId, `✅ Заказ №${o.orderNumber} закрыт как выполненный вручную. Покупателю отправлено «Заказ выполнен». В Donix ничего не отправлено.`);
    return;
  }

  // Admin: /msg USER_ID текст  (бот пишет одному человеку от своего имени)
  if (text.startsWith("/msg") && isAdmin(env, userId)) {
    const m = text.match(/^\/msg(?:@\w+)?\s+(\d+)\s+([\s\S]+)$/);
    if (!m) {
      await sendMessage(env, chatId, "Формат: /msg TELEGRAM_ID текст\nНапример: /msg 123456789 Ваш заказ выдан, спасибо!");
      return;
    }
    const r = await sendMessage(env, m[1], escHtml(m[2]));
    await sendMessage(env, chatId, r && r.ok ? `✅ Отправлено пользователю ${m[1]}.` : `❌ Не удалось отправить (пользователь не запускал бота или заблокировал его).`);
    return;
  }

  // Admin: /post текст  (бот публикует ваш отзыв/сообщение в чат отзывов от своего имени)
  if (text.startsWith("/post") && isAdmin(env, userId)) {
    const body = text.replace(/^\/post(?:@\w+)?\s*/, "");
    if (!body) {
      await sendMessage(env, chatId, "Формат: /post текст\nБот опубликует текст в чате отзывов от своего имени.");
      return;
    }
    if (!env.REVIEWS_CHAT_ID) {
      await sendMessage(env, chatId, "❌ Не задана переменная REVIEWS_CHAT_ID.");
      return;
    }
    const r = await sendMessage(env, env.REVIEWS_CHAT_ID, escHtml(body));
    await sendMessage(env, chatId, r && r.ok ? "✅ Опубликовано в чате отзывов." : "❌ Не удалось опубликовать (бот должен быть в чате и иметь право писать).");
    return;
  }

  // Admin: /retryorder N  (re-sends a paid order that never reached Donix)
  if (/^\/retryorder/i.test(text) && isAdmin(env, userId)) {
    const num = parseOrderNumArg(text, "retryorder");
    const o = num ? await getOrderByNumber(db, num) : null;
    if (!o) {
      await sendMessage(env, chatId, "Формат: /retryorder НОМЕР_ЗАКАЗА\nНапример: /retryorder 125");
      return;
    }
    if (o.status !== "paid") {
      await sendMessage(env, chatId, `Заказ №${o.orderNumber} в статусе «${o.status}». Повтор возможен только для «paid» (оплачен, но не ушёл в Donix).`);
      return;
    }
    await retryPaidOrder(env, db, o);
    const after = await getOrder(db, o.internalId);
    await sendMessage(env, chatId, `🔁 Заказ №${o.orderNumber}: теперь статус «${after ? after.status : "?"}».`);
    return;
  }

  // Admin: /checkorders  (asks Donix about every order stuck in "processing" and delivers receipts)
  if (text.startsWith("/checkorders") && isAdmin(env, userId)) {
    const retried = await retryStuckPaidOrders(env, db, 0);
    const r = await syncProcessingOrders(env, db);
    await sendMessage(
      env,
      chatId,
      `🔁 Повторно отправлено застрявших оплаченных: ${retried}\n🔎 Проверено: ${r.checked}, обновлено: ${r.updated}\n` +
        (r.sample ? `Ответ Donix (пример): ${r.sample}\n` : "") +
        (r.errors.length ? `Ошибки:\n${r.errors.slice(0, 5).join("\n")}` : "")
    );
    return;
  }

  // Admin: /syncprices [НАЦЕНКА_%]  (prices = Donix price + markup; markup is remembered)
  if (text.startsWith("/syncprices") && isAdmin(env, userId)) {
    const arg = text.split(/\s+/)[1];
    if (arg !== undefined) {
      const m = Number(arg.replace(",", "."));
      if (!Number.isFinite(m) || m < 0 || m > 200) {
        await sendMessage(env, chatId, "Формат: /syncprices 8  (наценка в процентах)");
        return;
      }
      await db.put("config:markup_percent", String(m));
    }
    const markup = await db.get("config:markup_percent");
    if (markup === null || markup === undefined) {
      await sendMessage(env, chatId, "Укажите наценку: /syncprices 8");
      return;
    }
    const r = await syncPricesFromDonix(env, markup);
    await sendMessage(
      env,
      chatId,
      r.ok
        ? `✅ Цены обновлены (наценка ${markup}%): ${r.changed}` + (r.missing.length ? `\n❌ Не найдены: ${r.missing.join(", ")}` : "")
        : "⚠️ Donix недоступен, цены не изменены."
    );
    return;
  }

  const existingUserRecord = await getJSON(db, kvKeyUser(userId));
  const isNewUser = !existingUserRecord;

  const user = await getUser(db, userId);
  // Same read-modify-write race as in handleCallbackQuery — only write back if the
  // username actually changed, so a text message can't clobber a concurrent balance
  // credit from the payment webhook.
  if (msg.from.username && msg.from.username !== user.username) {
    user.username = msg.from.username;
    await saveUser(db, user);
  }
  const lang = user.lang || "ru";

  if (text.startsWith("/start")) {
    await clearState(db, userId);
    if (isNewUser) {
      const payload = text.slice(6).trim();
      if (payload.startsWith("ref_")) {
        const refId = payload.slice(4).trim();
        if (refId && String(refId) !== String(userId)) {
          user.referredBy = refId;
          await saveUser(db, user);
        }
      }
    }
    await sendMessage(env, chatId, t(lang, "main_menu"), mainMenuKeyboard(lang));
    return;
  }

  if (text === "/admin") {
    if (String(userId) !== String(env.ADMIN_ID)) {
      await sendMessage(env, chatId, t(lang, "admin_only"));
      return;
    }
    await sendMessage(env, chatId, t(lang, "admin_panel"), adminMainKeyboard());
    return;
  }

  const state = await getState(db, userId);

  // admin text-input flows take priority
  if (String(userId) === String(env.ADMIN_ID) && state.step && state.step.startsWith("admin_")) {
    return handleAdminTextInput(env, db, msg, state, lang);
  }

  if (state.step === "await_uid" || state.step === "await_generic_uid") {
    const uid = text;
    if (!uid || uid.length < 2) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    const cat = CATALOG[state.data.catKey];
    let uidData;
    if (cat && cat.validateNick) {
      // Free Fire и PUBG Mobile: проверяем ID через Donix и показываем ник.
      const validatingMsg = await sendMessage(env, chatId, t(lang, "validating"));
      const dropValidating = () => deleteMessage(env, chatId, validatingMsg && validatingMsg.result && validatingMsg.result.message_id);
      const vItem = findItemBase(state.data.catKey, validationItemRef(state.data)[0]);
      if (itemProvider(vItem) === "mvp") {
        // Товар второго поставщика: проверяем ID через MVP и показываем ник.
        const mv = await mvpValidateForItem(env, db, vItem, uid);
        await dropValidating();
        if (mv.state === "down") {
          await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
          await clearState(db, userId);
          return;
        }
        if (mv.state === "invalid") {
          await sendMessage(env, chatId, t(lang, "invalid_game_id"), ikb([[btn(t(lang, "btn_home"), "menu:home")]]));
          return; // состояние сохраняем: можно сразу отправить ID ещё раз
        }
        uidData = mv.nick ? { UID: uid, "Ник": mv.nick } : { UID: uid };
      } else {
      const sku = await resolveDonixSku(env, state.data.catKey, ...validationItemRef(state.data));
      if (!sku) {
        await dropValidating();
        await notifyAdminDonix(env, `не найден SKU для «${state.data.itemName}» (${state.data.itemId}). Используйте /setsku ${state.data.itemId} SKU`);
        await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
        await clearState(db, userId);
        return;
      }
      const validation = await donixValidate(env, { sku, uid });
      await dropValidating();
      const st = validation.status;
      // Сервис недоступен только при сетевой ошибке, проблемах с ключом или лимитах.
      // Ошибки 5xx на проверке ID считаем «ID неверный» (Donix так отвечает на несуществующий ID).
      const serviceDown = !validation.ok && (st === 0 || st === 401 || st === 403 || st === 429);
      if (serviceDown) {
        if (st === 401 || st === 403) await notifyAdminDonix(env, `проверка ID: ${donixErrText(validation)}`);
        await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
        await clearState(db, userId);
        return;
      }
      // Если Donix не вернул ник — считаем, что ID неверный.
      const playerNick =
        validation.ok && validation.data && validation.data.valid !== false
          ? validation.data.player_name || validation.data.nickname || validation.data.name || null
          : null;
      if (!playerNick) {
        await sendMessage(env, chatId, t(lang, "invalid_game_id"), ikb([[btn(t(lang, "btn_home"), "menu:home")]]));
        return; // состояние сохраняем: можно сразу отправить ID ещё раз
      }
      uidData = { UID: uid, "Ник": playerNick };
      }
    } else {
      // Остальные игры и Telegram: без проверки ника.
      if (cat && cat.inputType === "tg_username") {
        const tgCheck = await checkTelegramUsername(env, uid);
        if (tgCheck.state === "down") {
          await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
          await clearState(db, userId);
          return;
        }
        if (tgCheck.state === "invalid") {
          await sendMessage(env, chatId, t(lang, "invalid_input"), backHomeKeyboard(lang));
          return;
        }
        uidData = { Username: uid.startsWith("@") ? uid : "@" + uid };
      } else {
        uidData = { UID: uid };
      }
    }
    state.data.uidData = uidData;
    if (cat && cat.needsServer) {
      state.step = "await_server";
      await setState(db, userId, state);
      await sendMessage(env, chatId, lang === "kg" ? "Серверди тандаңыз:" : "Выберите сервер:", serverKeyboard(lang));
      return;
    }
    await setState(db, userId, state);
    const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, state.data, uidData);
    const order = await createOrder(db, {
      userId,
      category: state.data.catKey,
      itemId: state.data.itemId,
      itemName: state.data.itemName,
      price: state.data.price,
      discount: prompt.discount,
      total: prompt.total,
      uidData,
      promoCode: prompt.promoCode,
      items: state.data.items,
    });
    await clearState(db, userId);
    await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
    return;
  }

  // Mobile Legends: first try to find the player by Player ID alone. If Donix returns a
  // nickname, the Server ID is not asked. Otherwise fall back to asking for the Server ID.
  if (state.step === "await_ml_player") {
    if (!text || text.length < 2) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    // Mobile Legends: ник не проверяем — просто просим Server ID.
    state.data.playerId = text;
    state.step = "await_ml_server";
    await setState(db, userId, state);
    await sendMessage(env, chatId, t(lang, "enter_server_id_mlbb"));
    return;
  }

  if (state.step === "await_ml_server") {
    if (!text || text.length < 1) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    state.data.serverId = text;
    const uidData = {
      "Player ID": state.data.playerId,
      "Server ID": state.data.serverId,
    };
    const prompt = await buildOrderConfirmPrompt(env, db, lang, userId, state.data, uidData);
    const order = await createOrder(db, {
      userId,
      category: state.data.catKey,
      itemId: state.data.itemId,
      itemName: state.data.itemName,
      price: state.data.price,
      discount: prompt.discount,
      total: prompt.total,
      uidData,
      promoCode: prompt.promoCode,
      items: state.data.items,
    });
    await clearState(db, userId);
    await sendOrderSummary(env, db, lang, chatId, userId, order, prompt);
    return;
  }

  if (state.step === "await_steam_custom") {
    const cat = CATALOG.steam;
    const amount = /^\d+([.,]\d{1,2})?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
    if (!Number.isFinite(amount) || amount < cat.min || amount > cat.max) {
      await sendMessage(env, chatId, t(lang, "steam_bad_amount", cat.min, cat.max));
      return;
    }
    await setState(db, userId, { step: "await_steam_login", data: { amount } });
    await sendMessage(env, chatId, `🎮 Steam $${steamAmountText(amount)}\n\n${t(lang, "enter_steam_login")}`, backHomeKeyboard(lang));
    return;
  }

  if (state.step === "await_steam_login") {
    const login = text.trim();
    const amount = state.data && state.data.amount;
    if (!amount) {
      await clearState(db, userId);
      await sendMessage(env, chatId, t(lang, "main_menu"), mainMenuKeyboard(lang));
      return;
    }
    if (login.length < 2 || login.length > 64 || /\s/.test(login)) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    // Проверка логина до оплаты (деньги не списываются). Если проверить не удалось — заказ всё равно проверит MVP сам.
    const stItem = CATALOG.steam.items[0];
    const stPid = await getMvpProductId(db, stItem);
    if (stPid) {
      const vr = await mvpValidatePlayerRaw(env, stPid, { player_id: login, amount: steamAmountText(amount) });
      const bad = (vr.ok && vr.data && vr.data.valid === false) || ["invalid_player_id", "player_region_mismatch"].includes(mvpErrCode(vr));
      if (bad) {
        await sendMessage(env, chatId, t(lang, "invalid_game_id"), backHomeKeyboard(lang));
        return; // состояние сохраняем: можно отправить логин ещё раз
      }
    }
    await createSteamOrder(env, db, lang, chatId, userId, login, amount);
    return;
  }

  if (state.step === "await_stars_custom") {
    const amount = /^\d+$/.test(text.trim()) ? parseInt(text.trim(), 10) : NaN;
    const cat = CATALOG.tg_stars;
    if (!Number.isFinite(amount) || amount < cat.min || amount > cat.max) {
      await sendMessage(
        env,
        chatId,
        lang === "kg"
          ? `❌ ${cat.min}дөн ${cat.max} чейинки санды жазыңыз.`
          : `❌ Введите число от ${cat.min} до ${cat.max}.`
      );
      return;
    }
    await setState(db, userId, { step: "await_stars_username", data: { amount } });
    await sendMessage(env, chatId, `⭐ ${amount} Stars\n\n${t(lang, "enter_username_tg")}`, backHomeKeyboard(lang));
    return;
  }

  if (state.step === "await_stars_username") {
    if (!text.startsWith("@") || text.length < 3) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    const amount = state.data && state.data.amount;
    if (!amount) {
      await clearState(db, userId);
      await sendMessage(env, chatId, t(lang, "main_menu"), mainMenuKeyboard(lang));
      return;
    }
    const tgCheck = await checkTelegramUsername(env, text.trim());
    if (tgCheck.state === "down") {
      await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
      return;
    }
    if (tgCheck.state === "invalid") {
      await sendMessage(env, chatId, t(lang, "invalid_input"), backHomeKeyboard(lang));
      return; // состояние сохраняем: можно сразу отправить @username ещё раз
    }
    await createStarsOrder(env, db, lang, chatId, userId, text.trim(), amount);
    return;
  }

  if (state.step === "await_promo_code") {
    await clearState(db, userId);
    const check = await validatePromo(db, text, userId, 0);
    if (!check.ok) {
      await sendMessage(env, chatId, t(lang, "promo_invalid"), backHomeKeyboard(lang));
      return;
    }
    if (check.promo.type === "gift") {
      await startGiftRedeem(env, db, lang, chatId, userId, check.promo);
      return;
    }
    if (check.promo.type === "balance") {
      const r = await redeemBalancePromo(db, check.promo, userId);
      if (!r.ok) {
        await sendMessage(env, chatId, t(lang, "promo_invalid"), backHomeKeyboard(lang));
        return;
      }
      await sendMessage(env, chatId, t(lang, "balance_promo_ok", fmtSom(r.amount), fmtSom(r.balance)), backHomeKeyboard(lang));
      // Уведомление админу: кто и сколько получил по промокоду.
      try {
        const adminId = String(env.ADMIN_ID || "").split(/[,\s;]+/).map((x) => x.replace(/["']/g, "").trim()).filter(Boolean)[0];
        if (adminId) {
          await sendMessage(
            env,
            adminId,
            [
              `🎁 Промокод ${escHtml(check.promo.code)} активирован`,
              `Пользователь: ${userId} (@${escHtml(user.username || "-")})`,
              `Сумма: +${fmtSom(r.amount)} сом`,
              `Осталось активаций: ${r.usesLeft === null ? "∞" : r.usesLeft}`,
            ].join("\n")
          );
        }
      } catch (e) {
        console.log("balance promo admin notify error", String(e));
      }
      return;
    }
    // Stored separately from the step-machine state so it isn't lost when the
    // user goes on to browse categories/products before checking out.
    await db.put(kvKeyActivePromo(userId), text.toUpperCase());
    const valueLine =
      check.promo.type === "prices"
        ? `${lang === "kg" ? "Атайын баалар" : "Особые цены"}: ${(CATALOG[check.promo.catKey] || {}).name || check.promo.catKey}\n${
            lang === "kg"
              ? "Баасын «Баалар» баскычынан көрүңүз 💰"
              : "Посмотреть цены можно в разделе игры, кнопка «💰 Цены»"
          }`
        : check.promo.type === "percent"
          ? `${t(lang, "discount_label")}: ${fmtPercent(check.promo.value)}%`
          : `${t(lang, "discount_label")}: ${fmtSom(check.promo.value)} ${t(lang, "kg_som")}`;
    await sendMessage(
      env,
      chatId,
      `${t(lang, "promo_activated")}\n${text.toUpperCase()}\n${valueLine}`,
      backHomeKeyboard(lang)
    );
    return;
  }

  if (state.step === "await_topup_amount") {
    const amount = parseInt(text, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendMessage(env, chatId, t(lang, "invalid_input"));
      return;
    }
    const topupId = crypto.randomUUID();
    await putJSON(db, `topup:${topupId}`, {
      topupId,
      userId,
      amount,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    await clearState(db, userId);

    const botInfo = await tgCall(env, "getMe", {});
    const redirectUrl = botInfo.ok && botInfo.result.username
      ? `https://t.me/${botInfo.result.username}`
      : env.APP_BASE_URL;

    const payment = await createFinikPayment(env, {
      amount,
      paymentId: topupId,
      redirectUrl,
      description: `Nurtilek Shop top-up ${topupId}`,
      lang,
    });

    if (!payment.ok) {
      await sendMessage(env, chatId, t(lang, "service_unavailable"), backHomeKeyboard(lang));
      return;
    }

    await sendMessage(env, chatId, `${amount} ${t(lang, "kg_som")}`, {
      inline_keyboard: [
        [{ text: "💳 Оплатить", url: payment.paymentUrl }],
        [{ text: t(lang, "btn_home"), callback_data: "menu:home" }],
      ],
    });

    // Let the admin see every top-up request as it's created, with its id and username,
    // so they can check whether it actually landed in Finik/Donix and, if not, credit it
    // manually right from this message. Normally the /payment-webhook confirms it
    // automatically and this message can just be ignored.
    await sendMessage(
      env,
      env.ADMIN_ID,
      `🧾 Новое пополнение (ожидает оплаты)\nID: ${topupId}\nUser: ${userId} (@${user.username || "-"})\nСумма: ${amount} ${t(lang, "kg_som")}`,
      ikb([
        [btn("✅ Зачислить", `admin:topupok:${topupId}`), btn("❌ Отклонить", `admin:topupno:${topupId}`)],
      ])
    );
    return;
  }

  // no active state, not a recognized command -> show main menu
  await sendMessage(env, chatId, t(lang, "main_menu"), mainMenuKeyboard(lang));
}


/* ================= ADMIN PANEL ================= */

function isAdmin(env, userId) {
  // ADMIN_ID может содержать пробелы/кавычки или несколько ID через запятую.
  const ids = String(env.ADMIN_ID || "").split(/[,\s;]+/).map((x) => x.replace(/["']/g, "").trim()).filter(Boolean);
  return ids.includes(String(userId));
}

function adminMainKeyboard() {
  return ikb([
    [btn("📊 Статистика", "admin:stats"), btn("👥 Пользователи", "admin:users")],
    [btn("📦 Заказы", "admin:orders"), btn("💰 Кошельки", "admin:wallets")],
    [btn("💵 Балансы", "admin:balances"), btn("🧾 Пополнения", "admin:topups")],
    [btn("🎮 Каталог и цены", "admin:catalog"), btn("🎟 Промокоды", "admin:promos")],
    [btn("🤝 Рефералка", "admin:referral")],
    [btn("📢 Рассылка", "admin:broadcast"), btn("💳 Баланс Donix", "admin:donixbalance")],
    [btn("🟣 Баланс MVP", "admin:mvpbalance")],
    [btn("🔲 Roblox (коды)", "admin:rbx"), btn("🔗 SKU Donix", "admin:skus")],
    [btn("🛠 Настройки", "admin:settings"), btn("📋 Логи", "admin:logs")],
    [btn("🏠 Главное меню", "menu:home")],
  ]);
}

const CATALOG_LABELS = {
  freefire: "Free Fire",
  pubg_uc: "PUBG — UC",
  pubg_prime: "PUBG — Prime",
  pubg_primeplus: "PUBG — Prime+",
  mlbb: "Mobile Legends",
  codm: "Call of Duty Mobile",
  genshin: "Genshin Impact",
  tg_stars: "Telegram Stars",
  tg_premium: "Telegram Premium",
  hsr: "Honkai: Star Rail",
  arena: "Arena Breakout",
  rivals: "Marvel Rivals",
  oxide: "Oxide Survival Island",
  discord: "Discord",
  steam: "Steam (курс за $1)",
  mvp_test: "MVP тест (2-й поставщик)",
};

function adminCatalogListKeyboard() {
  const rows = Object.keys(CATALOG).map((key) => [btn(CATALOG_LABELS[key] || key, `admin:catcat:${key}`)]);
  rows.push([btn("⬅️", "admin:home")]);
  return ikb(rows);
}

async function adminCategoryItemsView(db, catKey) {
  if (catKey === "tg_stars") {
    const perStar = await getEffectiveStarsPricePerStar(db);
    const promptText = await db.get(kvKeyStarsPromptText());
    return {
      text: `💎 Telegram Stars\nТекущий курс за 1 звезду: ${perStar} сом\nТекст запроса количества: ${
        promptText || "(стандартный)"
      }\n\nМинимум: ${CATALOG.tg_stars.min}, максимум: ${CATALOG.tg_stars.max}.`,
      keyboard: ikb([
        [btn(`✏️ Изменить курс (${perStar})`, "admin:catitem:tg_stars:__perstar")],
        [btn("✏️ Изменить текст запроса", "admin:catitem:tg_stars:__prompttext")],
        [btn("⬅️", "admin:catalog")],
      ]),
    };
  }
  const items = await getResolvedItems(db, catKey);
  const rows = items.map((i) => [btn(`${i.name} — ${i.price} сом`, `admin:catitem:${catKey}:${i.id}`)]);
  rows.push([btn("⬅️", "admin:catalog")]);
  return { text: `${CATALOG_LABELS[catKey] || catKey}\nВыберите товар, чтобы изменить его цену:`, keyboard: ikb(rows) };
}

function adminBalanceView(user) {
  const text = [`👤 Пользователь: ${user.id}`, `💰 Баланс: ${user.balance} сом`].join("\n");
  const keyboard = ikb([
    [btn("➕ Пополнить", `admin:baltopup:${user.id}`), btn("➖ Списать", `admin:baldeduct:${user.id}`)],
    [btn("⬅️", "admin:home")],
  ]);
  return { text, keyboard };
}

/* ================= ADMIN: ORDERS LIST ================= */

const ADMIN_ORDERS_PER_PAGE = 5;
const ADMIN_ORDER_FILTERS = {
  all: { label: "Все", statuses: null },
  active: { label: "В процессе", statuses: ["pending_payment", "paid", "processing"] },
  done: { label: "Выполнены", statuses: ["completed"] },
  bad: { label: "Проблемные", statuses: ["failed", "refunded", "cancelled"] },
};

const ADMIN_ORDER_STATUS_RU = {
  pending_payment: "🟡 Ожидает оплаты — клиент создал заказ, но ещё не оплатил",
  paid: "🟡 Оплачен — деньги получены, заказ ещё не передан поставщику",
  processing: "🟡 В обработке — отправлен поставщику (Donix), ждём выполнения",
  completed: "🟢 Выполнен — товар доставлен клиенту",
  cancelled: "🔴 Отменён — клиент отменил заказ до оплаты",
  failed: "🔴 Не выполнен — поставщик не смог выполнить заказ",
  refunded: "🔴 Возврат — деньги возвращены клиенту",
};

const ADMIN_LINE_STATUS_RU = {
  pending: "⏳ ожидает",
  queued: "⏳ в очереди",
  processing: "🟡 в обработке",
  completed: "🟢 выполнен",
  failed: "🔴 не выполнен",
  refunded: "🔴 возврат",
};

function escHtml(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDateRu(iso) {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 6 * 3600 * 1000); // Бишкек, UTC+6
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/* Reads EVERY order (follows KV cursors; a single list() call returns at most 1000 keys). */
async function loadAllOrders(db) {
  const keys = [];
  let cursor;
  do {
    const res = await db.list({ prefix: "order:", cursor });
    keys.push(...res.keys.map((k) => k.name));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  const orders = [];
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = await Promise.all(keys.slice(i, i + 25).map((k) => getJSON(db, k)));
    for (const o of chunk) if (o) orders.push(o);
  }
  // newest first (keys are random UUIDs, so the KV order says nothing about time)
  orders.sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")));
  return orders;
}

async function adminOrdersView(db, page, filter, env) {
  const all = await loadAllOrders(db);
  const allowed = ADMIN_ORDER_FILTERS[filter].statuses;
  const orders = allowed ? all.filter((o) => allowed.includes(o.status)) : all;
  const pages = Math.max(1, Math.ceil(orders.length / ADMIN_ORDERS_PER_PAGE));
  const cur = Math.min(page, pages - 1);
  let slice = orders.slice(cur * ADMIN_ORDERS_PER_PAGE, (cur + 1) * ADMIN_ORDERS_PER_PAGE);
  // «В обработке» дольше 15 сек: сверяем с поставщиком и закрываем выполненные (чек клиенту + запись в чат отзывов).
  if (env) {
    const stuck = slice.filter((o) => o.status === "processing" && Date.now() - new Date(o.updatedAt || o.createdAt).getTime() > 15000).slice(0, 5);
    if (stuck.length) {
      try {
        await Promise.all(stuck.map((o) => reconcileOneOrder(env, db, o).catch((e) => console.log("admin reconcile error", String(e)))));
        slice = await Promise.all(slice.map(async (o) => (await getOrder(db, o.internalId)) || o));
      } catch (e) {
        console.log("admin reconcile error", String(e));
      }
    }
  }

  const lines = [`📦 Заказы — ${ADMIN_ORDER_FILTERS[filter].label}`, `Найдено: ${orders.length} (всего заказов: ${all.length}) • стр. ${cur + 1}/${pages}`];
  if (slice.length === 0) lines.push("", "Заказов нет.");
  for (const o of slice) {
    const user = await getJSON(db, kvKeyUser(o.userId));
    const who = user && user.username ? `@${escHtml(user.username)} (${escHtml(o.userId)})` : escHtml(o.userId);
    lines.push("", `━━━━━━━━━━━━`, `<b>№ ${escHtml(o.orderNumber)}</b> • ${fmtDateRu(o.createdAt)}`);
    lines.push(`👤 Клиент: ${who}`);
    lines.push(`🎮 Товар: ${escHtml(o.itemName)}`);
    if (o.items && o.items.length > 0) {
      for (const l of o.items) {
        lines.push(`   • ${escHtml(l.name)} × ${l.qty || 1} — ${ADMIN_LINE_STATUS_RU[l.status] || escHtml(l.status)}`);
      }
    }
    const uid = Object.entries(o.uidData || {}).map(([k, v]) => `${escHtml(k)}: ${escHtml(v)}`).join(", ");
    if (uid) lines.push(`🆔 Данные: ${uid}`);
    lines.push(`💰 Сумма: ${fmtSom(o.total)} сом` + (o.discount ? ` (скидка ${fmtSom(o.discount)})` : "") + (o.promoCode ? ` • промокод ${escHtml(o.promoCode)}` : ""));
    lines.push(`📌 Статус: ${ADMIN_ORDER_STATUS_RU[o.status] || escHtml(o.status)}`);
    if (o.updatedAt && o.updatedAt !== o.createdAt) lines.push(`🕒 Обновлён: ${fmtDateRu(o.updatedAt)}`);
  }

  const rows = [
    Object.entries(ADMIN_ORDER_FILTERS).map(([key, f]) => btn(key === filter ? `• ${f.label}` : f.label, `admin:orders:0:${key}`)),
  ];
  const nav = [];
  if (cur > 0) nav.push(btn("◀️ Назад", `admin:orders:${cur - 1}:${filter}`));
  if (cur < pages - 1) nav.push(btn("Вперёд ▶️", `admin:orders:${cur + 1}:${filter}`));
  if (nav.length) rows.push(nav);
  rows.push([btn("⬅️", "admin:home")]);
  return { text: lines.join("\n"), keyboard: ikb(rows) };
}

/* Экран создания промокода с ценами: список товаров игры, обычная и промо-цена. */
async function adminPricePromoView(db, data) {
  const items = await getResolvedItems(db, data.catKey);
  const lines = [
    `💲 Промокод ${data.code} — ${CATALOG_LABELS[data.catKey] || data.catKey}`,
    "Нажмите на товар, чтобы задать цену по промокоду. Товары без цены остаются по обычной цене.",
    "",
  ];
  const rows = [];
  for (const i of items) {
    const pp = data.prices[i.id];
    lines.push(`${i.name}: ${i.price} сом → ${pp !== undefined ? pp + " сом" : "без изменений"}`);
    rows.push([btn(`${i.name} — ${pp !== undefined ? pp : i.price} сом${pp !== undefined ? " ✏️" : ""}`, `admin:priceitem:${i.id}`)]);
  }
  rows.push([btn("✅ Создать промокод", "admin:pricedone")]);
  rows.push([btn("⬅️", "admin:pricenew")]);
  return { text: lines.join("\n"), keyboard: ikb(rows) };
}

const ADMIN_WALLETS_PER_PAGE = 10;

/* Every user (follows KV cursors; one list() call returns at most 1000 keys). */
async function loadAllUsers(db) {
  const keys = [];
  let cursor;
  do {
    const res = await db.list({ prefix: "user:", cursor });
    keys.push(...res.keys.map((k) => k.name));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  const users = [];
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = await Promise.all(keys.slice(i, i + 25).map((k) => getJSON(db, k)));
    for (const u of chunk) if (u) users.push(u);
  }
  return users;
}

async function adminWalletsView(db, page) {
  const users = await loadAllUsers(db);
  users.sort((x, y) => (y.balance || 0) - (x.balance || 0));
  const total = users.reduce((sum, u) => round2(sum + (u.balance || 0)), 0);
  const pages = Math.max(1, Math.ceil(users.length / ADMIN_WALLETS_PER_PAGE));
  const cur = Math.min(Math.max(0, page), pages - 1);
  const slice = users.slice(cur * ADMIN_WALLETS_PER_PAGE, (cur + 1) * ADMIN_WALLETS_PER_PAGE);

  const lines = [
    "💰 Кошельки (по убыванию баланса)",
    `Пользователей: ${users.length} • на всех балансах: ${fmtSom(total)} сом • стр. ${cur + 1}/${pages}`,
    "",
  ];
  let n = cur * ADMIN_WALLETS_PER_PAGE;
  for (const u of slice) {
    n++;
    lines.push(`${n}. ${escHtml(u.id)} @${escHtml(u.username || "-")} — ${fmtSom(u.balance || 0)} сом (потрачено: ${fmtSom(u.spent || 0)} сом)`);
  }
  if (users.length === 0) lines.push("Пока нет пользователей.");

  const rows = [];
  const nav = [];
  if (cur > 0) nav.push(btn("◀️ Назад", `admin:wallets:${cur - 1}`));
  if (cur < pages - 1) nav.push(btn("Вперёд ▶️", `admin:wallets:${cur + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([btn("⬅️", "admin:home")]);
  return { text: lines.join("\n"), keyboard: ikb(rows) };
}

/* ================= ADMIN: SETTINGS / LOGS ================= */

async function adminSettingsView(env, db) {
  const [ffMaint, markup, starRate, refPercent, ping, bal, mvpBal, mvpThreshold, mvpTestOn] = await Promise.all([
    isFreefireMaintenance(db),
    db.get("config:markup_percent"),
    getEffectiveStarsPricePerStar(db),
    db.get(kvKeyConfig("referral_percent")),
    donixPing(env),
    donixBalance(env),
    env.SECOND_API_KEY ? mvpBalance(env) : Promise.resolve(null),
    getMvpLowBalanceThreshold(db),
    isMvpTestEnabled(db),
  ]);
  const mvpLine = !env.SECOND_API_KEY
    ? "не настроен (нет SECOND_API_KEY)"
    : mvpBal && mvpBal.ok && mvpBal.data
      ? `${escHtml(mvpBal.data.balance)} ${escHtml(mvpBal.data.currency || "KGS")}`
      : `❌ ${escHtml(mvpErrText(mvpBal))}`;
  const donixLine = ping.ok ? "✅ на связи" : `❌ недоступен (${donixErrText(ping)})`;
  const balLine = bal.ok ? escHtml(JSON.stringify(bal.data)) : "—";
  const text = [
    "🛠 Настройки",
    "",
    `Техработы Free Fire: ${ffMaint ? "ВКЛЮЧЕНЫ 🛠" : "выключены ✅"}`,
    `Наценка (/syncprices): ${markup !== null && markup !== undefined ? markup + "%" : "не задана (/syncprices 8)"}`,
    `Курс Telegram Stars: ${starRate} сом за 1 ⭐`,
    `Реферальный процент: ${refPercent || DEFAULT_REFERRAL_PERCENT}%`,
    `Чат отзывов (REVIEWS_CHAT_ID): ${env.REVIEWS_CHAT_ID ? "задан ✅" : "не задан ❌"}`,
    `Finik: ${env.FINIK_ENV === "prod" ? "prod (боевой)" : "beta (тестовый)"}`,
    `Donix: ${donixLine}`,
    `Баланс Donix: ${balLine}`,
    `Баланс MVP: ${mvpLine}`,
    `Порог баланса MVP: ${mvpThreshold > 0 ? mvpThreshold + " сом" : "выключен (0)"}`,
    `MVP тест-товар в боте: ${mvpTestOn ? "ПОКАЗЫВАЕТСЯ 🧪" : "скрыт"}`,
  ].join("\n");
  const keyboard = ikb([
    [btn(ffMaint ? "✅ Выключить техработы FF" : "🛠 Включить техработы FF", "admin:ffmaint")],
    [btn("🔄 Обновить цены из Donix", "admin:syncnow")],
    [btn(mvpTestOn ? "🧪 Скрыть MVP тест-товар" : "🧪 Показать MVP тест-товар", "admin:mvptest")],
    [btn("✏️ Порог баланса MVP", "admin:mvpthreshold")],
    [btn("♻️ Обновить экран", "admin:settings")],
    [btn("⬅️", "admin:home")],
  ]);
  return { text, keyboard };
}

const LOG_TYPE_ICON = { error: "🔴", donix: "🟠", finik: "💳", webhook: "📨", mvp: "🟣" };

async function adminLogsView(db) {
  const lines = ["📋 Логи"];
  const rows = [];

  // 1) Проблемные заказы: failed/refunded и застрявшие в "paid" дольше 3 минут.
  const all = await loadAllOrders(db);
  const problems = all.filter((o) => {
    if (o.status === "failed" || o.status === "refunded") return true;
    if (o.status === "paid") return Date.now() - new Date(o.updatedAt || o.createdAt).getTime() > 3 * 60 * 1000;
    return false;
  });
  lines.push("", `⚠️ Проблемные заказы: ${problems.length}`);
  for (const o of problems.slice(0, 5)) {
    const stuck = o.status === "paid";
    lines.push(`• №${escHtml(o.orderNumber)} ${escHtml(o.itemName)} — ${fmtSom(o.total)} сом — ${stuck ? "🟡 оплачен, не ушёл в Donix" : "🔴 " + escHtml(o.status)} (${fmtDateRu(o.updatedAt || o.createdAt)})`);
    if (stuck) rows.push([btn(`🔁 Повторить №${o.orderNumber}`, `admin:retry:${o.internalId}`)]);
  }
  if (problems.length > 5) lines.push(`… и ещё ${problems.length - 5}`);

  // 2) Ручные изменения баланса.
  const adj = [];
  let cursor;
  do {
    const res = await db.list({ prefix: "balancehistory:", cursor });
    for (const k of res.keys) {
      const list = (await getJSON(db, k.name, [])) || [];
      adj.push(...list.slice(0, 5));
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  adj.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  lines.push("", "💵 Ручные изменения баланса (последние):");
  if (adj.length === 0) lines.push("Пока нет.");
  for (const h of adj.slice(0, 5)) {
    lines.push(`• ${fmtDateRu(h.at)} — ${escHtml(h.userId)}: ${h.type === "topup" ? "+" : "−"}${fmtSom(h.amount)} сом (${fmtSom(h.oldBalance)} → ${fmtSom(h.newBalance)})`);
  }

  // 3) События Donix / Finik / ошибки.
  const events = (await getJSON(db, LOG_KEY, [])) || [];
  lines.push("", "🧾 События (последние):");
  if (events.length === 0) lines.push("Пока нет.");
  for (const e of events.slice(0, 12)) {
    lines.push(`${LOG_TYPE_ICON[e.type] || "•"} ${fmtDateRu(e.at)} — ${escHtml(e.text)}`);
  }

  rows.push([btn("♻️ Обновить", "admin:logs"), btn("🗑 Очистить события", "admin:logsclear")]);
  rows.push([btn("⬅️", "admin:home")]);
  let text = lines.join("\n");
  if (text.length > 3900) text = text.slice(0, 3890) + "\n…";
  return { text, keyboard: ikb(rows) };
}

async function handleAdminCallback(env, db, cq, a, b, c, lang) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;

  if (!isAdmin(env, userId)) {
    await answerCallback(env, cq.id, t(lang, "admin_only"), true);
    return;
  }

  if (a === "stats") {
    const orderKeys = await db.list({ prefix: "order:" });
    const userKeys = await db.list({ prefix: "user:" });
    let completed = 0;
    let totalRevenue = 0;
    for (const k of orderKeys.keys) {
      const o = await getJSON(db, k.name);
      if (o && (o.status === "paid" || o.status === "processing" || o.status === "completed")) {
        completed++;
        totalRevenue = round2(totalRevenue + (o.total || 0));
      }
    }
    const text = [
      "📊 Статистика",
      `Всего пользователей: ${userKeys.keys.length}`,
      `Всего заказов: ${orderKeys.keys.length}`,
      `Оплаченных заказов: ${completed}`,
      `Общая сумма оплаченных заказов: ${fmtSom(totalRevenue)} сом`,
    ].join("\n");
    await editMessage(env, chatId, messageId, text, ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "home") {
    await editMessage(env, chatId, messageId, t(lang, "admin_panel"), adminMainKeyboard());
  } else if (a === "skus") {
    donixProductsCache = { at: 0, list: null }; // force refresh
    const products = await getDonixProducts(env);
    if (!products) {
      await editMessage(env, chatId, messageId, t(lang, "service_unavailable"), ikb([[btn("⬅️", "admin:home")]]));
    } else {
      const rows = [];
      for (const [catKey, cat] of Object.entries(CATALOG)) {
        if (catKey === "tg_stars") {
          const hit = await resolveDonixSku(env, catKey, "stars_50", "50 Stars");
          rows.push(`${hit ? "✅" : "❌"} ${cat.name} (звёзды) → ${hit || "нет товара"}`);
          continue;
        }
        for (const item of cat.items) {
          if (itemProvider(item) === "mvp") {
            rows.push(`🟣 ${item.id} (${item.name}) → MVP: ${(await getMvpProductId(db, item)) || "НЕ ЗАДАН"}`);
            continue;
          }
          const sku = await resolveDonixSku(env, catKey, item.id, item.name);
          rows.push(`${sku ? "✅" : "❌"} ${item.id} (${item.name}) → ${sku || "НЕ НАЙДЕН"}`);
        }
      }
      const chunks = [];
      let cur = "🔗 Привязка товаров к Donix SKU\n";
      for (const r of rows) {
        if ((cur + r).length > 3500) {
          chunks.push(cur);
          cur = "";
        }
        cur += r + "\n";
      }
      chunks.push(cur);
      const list = "📦 Товары Donix:\n" + products.map((p) => `${p.sku} — ${p.name} — ${p.price}`).join("\n");
      await editMessage(env, chatId, messageId, chunks[0], ikb([[btn("⬅️", "admin:home")]]));
      for (const c of chunks.slice(1)) await sendMessage(env, chatId, c);
      for (let i = 0; i < list.length; i += 3500) await sendMessage(env, chatId, list.slice(i, i + 3500));
      await sendMessage(env, chatId, "Чтобы исправить ❌: /setsku ID_ТОВАРА SKU\nСбросить: /setsku ID_ТОВАРА -");
    }
  } else if (a === "mvpbalance") {
    const res = await mvpBalance(env);
    const threshold = await getMvpLowBalanceThreshold(db);
    const text = !env.SECOND_API_KEY
      ? "🟣 MVP не настроен (нет SECOND_API_KEY)"
      : res.ok && res.data
        ? `🟣 Баланс MVP: ${res.data.balance} ${res.data.currency || "KGS"}\nПорог предупреждения: ${threshold > 0 ? threshold + " сом" : "выключен"}`
        : `🟣 MVP: ${mvpErrText(res)}`;
    await editMessage(env, chatId, messageId, escHtml(text), ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "donixbalance") {
    const res = await donixBalance(env);
    const text = res.ok ? `💳 Баланс Donix: ${JSON.stringify(res.data)}` : t(lang, "service_unavailable");
    await editMessage(env, chatId, messageId, text, ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "promos") {
    await clearState(db, userId);
    await editMessage(
      env,
      chatId,
      messageId,
      [
        "🎟 Промокоды",
        "",
        "Промокод даёт покупателю скидку в процентах от суммы заказа (например, минус 15% при оплате).",
        "",
        "♾ Вечный — работает без срока действия, каждый аккаунт может использовать его только один раз.",
        "📅 На 1 год — перестаёт работать через 1 год, каждый аккаунт может использовать его только один раз.",
        "🛠 Вручную — гибкая настройка (свой лимит использований, минимальная сумма и т.д.).",
      ].join("\n"),
      ikb([
        [btn("♾ Вечный промокод", "admin:promonew:forever")],
        [btn("📅 Промокод на 1 год", "admin:promonew:year")],
        [btn("🎁 Подарочный (товар бесплатно)", "admin:giftnew")],
        [btn("💰 Промокод на баланс (деньги)", "admin:balpromonew")],
        [btn("💲 Промокод с ценами на игру", "admin:pricenew")],
        [btn("🛠 Вручную", "admin:promonew:manual")],
        [btn("📋 Список промокодов", "admin:promolist")],
        [btn("⬅️", "admin:home")],
      ])
    );
  } else if (a === "promonew") {
    const mode = b; // "forever" | "year" | "manual"
    if (mode === "manual") {
      await setState(db, userId, { step: "admin_create_promo", data: {} });
      await editMessage(env, chatId, messageId, t(lang, "promo_admin_create_hint"), ikb([[btn("⬅️", "admin:promos")]]));
      return answerCallback(env, cq.id);
    }
    await setState(db, userId, { step: "admin_create_promo_guided", data: { mode } });
    const durationLine = mode === "forever" ? "♾ Без срока действия (вечный)" : "📅 Действует 1 год с момента создания";
    await editMessage(
      env,
      chatId,
      messageId,
      [
        mode === "forever" ? "♾ Новый вечный промокод" : "📅 Новый промокод на 1 год",
        "",
        "Отправьте одним сообщением: КОД;ПРОЦЕНТ",
        "Пример: SALE15;15  (код SALE15, скидка 15%)",
        "",
        "Условия:",
        `• ${durationLine}`,
        "• Каждый аккаунт может применить его только 1 раз",
        "• Количество аккаунтов, которые могут его использовать — не ограничено",
      ].join("\n"),
      ikb([[btn("⬅️", "admin:promos")]])
    );
  } else if (a === "balpromonew") {
    await setState(db, userId, { step: "admin_create_balpromo", data: {} });
    await editMessage(
      env,
      chatId,
      messageId,
      [
        "💰 Промокод на баланс",
        "Покупатель вводит код — и сумма сразу зачисляется на его баланс в боте.",
        "",
        "Отправьте одним сообщением: КОД;СУММА;КОЛИЧЕСТВО",
        "Сумма — в сомах, количество — сколько всего человек смогут активировать (кто успел — тот получил).",
        "Пример: MONEY50;50;20  (по 50 сом, первые 20 человек)",
        "Если количество не указать — будет 1.",
        "Каждый аккаунт может активировать код только один раз.",
      ].join("\n"),
      ikb([[btn("⬅️", "admin:promos")]])
    );
  } else if (a === "pricenew") {
    await clearState(db, userId);
    const rows = Object.keys(CATALOG)
      .filter((k) => CATALOG[k].items.length > 0)
      .map((k) => [btn(CATALOG_LABELS[k] || k, `admin:pricecat:${k}`)]);
    rows.push([btn("⬅️", "admin:promos")]);
    await editMessage(
      env,
      chatId,
      messageId,
      "💲 Промокод с ценами на игру\nПромокод работает только в одной игре и ставит свои цены на выбранные товары. После использования он пропадает у покупателя, и цены снова обычные.\n\nВыберите игру:",
      ikb(rows)
    );
  } else if (a === "pricecat") {
    const catKey = b;
    if (!CATALOG[catKey] || CATALOG[catKey].items.length === 0) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    await setState(db, userId, { step: "admin_pricepromo_code", data: { catKey } });
    await editMessage(
      env,
      chatId,
      messageId,
      [
        `💲 Игра: ${CATALOG_LABELS[catKey] || catKey}`,
        "",
        "Отправьте одним сообщением: КОД;КОЛИЧЕСТВО_АКТИВАЦИЙ",
        "Пример: PRICE1;50  (50 человек смогут использовать)",
        "Если количество не указать — без ограничения (каждый аккаунт по 1 разу).",
      ].join("\n"),
      ikb([[btn("⬅️", "admin:pricenew")]])
    );
  } else if (a === "priceitem") {
    const state = await getState(db, userId);
    if (state.step !== "admin_pricepromo_items" && state.step !== "admin_pricepromo_setprice") {
      await answerCallback(env, cq.id, "Сессия создания истекла. Начните заново.", true);
      return;
    }
    const base = findItemBase(state.data.catKey, b);
    if (!base) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    const current = await getEffectivePrice(db, state.data.catKey, b, base.price);
    state.step = "admin_pricepromo_setprice";
    state.data.itemId = b;
    await setState(db, userId, state);
    await editMessage(
      env,
      chatId,
      messageId,
      `${base.name}\nОбычная цена: ${current} сом\nЦена по промокоду: ${state.data.prices[b] !== undefined ? state.data.prices[b] + " сом" : "не задана"}\n\nОтправьте цену по промокоду (число в сомах). Отправьте «-», чтобы убрать особую цену.`,
      ikb([[btn("⬅️", "admin:priceback")]])
    );
  } else if (a === "priceback") {
    const state = await getState(db, userId);
    if (state.step !== "admin_pricepromo_items" && state.step !== "admin_pricepromo_setprice") {
      await answerCallback(env, cq.id, "Сессия создания истекла. Начните заново.", true);
      return;
    }
    state.step = "admin_pricepromo_items";
    delete state.data.itemId;
    await setState(db, userId, state);
    const view = await adminPricePromoView(db, state.data);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "pricedone") {
    const state = await getState(db, userId);
    if (state.step !== "admin_pricepromo_items" && state.step !== "admin_pricepromo_setprice") {
      await answerCallback(env, cq.id, "Сессия создания истекла. Начните заново.", true);
      return;
    }
    const { catKey, code, uses, prices } = state.data;
    if (Object.keys(prices).length === 0) {
      await answerCallback(env, cq.id, "Задайте цену хотя бы для одного товара.", true);
      return;
    }
    if (await getJSON(db, kvKeyPromo(code))) {
      await answerCallback(env, cq.id, `Промокод ${code} уже существует.`, true);
      return;
    }
    const promo = await createPromo(db, {
      code,
      type: "prices",
      value: 0,
      uses: uses === null || uses === undefined ? null : uses,
      days: null,
      minSum: 0,
      onePerUser: true,
      catKey,
      prices,
    });
    await clearState(db, userId);
    await editMessage(env, chatId, messageId, ["✅ Промокод с ценами создан", `Код: ${promo.code}`, promoValText(promo), uses ? `Активаций: ${uses}` : "Активаций: без ограничения (по 1 на аккаунт)"].join("\n"), adminMainKeyboard());
  } else if (a === "giftnew") {
    await clearState(db, userId);
    const rows = Object.keys(CATALOG)
      .filter((k) => CATALOG[k].items.length > 0)
      .map((k) => [btn(CATALOG_LABELS[k] || k, `admin:giftcat:${k}`)]);
    rows.push([btn("⬅️", "admin:promos")]);
    await editMessage(
      env,
      chatId,
      messageId,
      "🎁 Подарочный промокод\nПокупатель вводит код, затем свой игровой ID — и получает выбранный товар бесплатно.\n\nВыберите игру:",
      ikb(rows)
    );
  } else if (a === "giftcat") {
    const catKey = b;
    if (!CATALOG[catKey]) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    const items = await getResolvedItems(db, catKey);
    const rows = items.map((i) => [btn(`${i.name} — ${i.price} сом`, `admin:giftitem:${catKey}:${i.id}`)]);
    rows.push([btn("⬅️", "admin:giftnew")]);
    await editMessage(env, chatId, messageId, `${CATALOG_LABELS[catKey] || catKey}\nВыберите товар, который получит покупатель:`, ikb(rows));
  } else if (a === "giftitem") {
    const catKey = b;
    const itemId = c;
    const base = findItemBase(catKey, itemId);
    if (!base) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    await setState(db, userId, { step: "admin_create_gift", data: { catKey, itemId } });
    await editMessage(
      env,
      chatId,
      messageId,
      [
        `🎁 Товар: ${CATALOG_LABELS[catKey] || catKey} — ${base.name}`,
        "",
        "Отправьте одним сообщением: КОД;КОЛИЧЕСТВО_АКТИВАЦИЙ",
        "Количество — это сколько всего раз код можно активировать (на всех вместе). Кто успел — тот получил.",
        "Пример: GIFT1;1  (только 1 активация, достанется первому)",
        "Пример: FREE5;5  (первые 5 человек)",
        "Если количество не указать — будет 1.",
      ].join("\n"),
      ikb([[btn("⬅️", `admin:giftcat:${catKey}`)]])
    );
  } else if (a === "promolist") {
    const promoKeys = await db.list({ prefix: "promo:" });
    const lines = ["📋 Промокоды:"];
    const rows = [];
    let count = 0;
    for (const k of promoKeys.keys) {
      if (k.name.startsWith("promouse:")) continue;
      const p = await getJSON(db, k.name);
      if (!p) continue;
      count++;
      const usesText = p.usesLeft === null ? "∞ (без ограничения)" : `осталось ${p.usesLeft}`;
      const expText = p.expiresAt ? `до ${p.expiresAt.slice(0, 10)}` : "бессрочно";
      const valText = promoValText(p);
      lines.push(`\n${p.active ? "🟢" : "🔴"} ${p.code} — ${valText}\nИспользований: ${usesText}${p.onePerUser ? " (1 на аккаунт)" : ""}\nСрок: ${expText}`);
      rows.push([
        p.active
          ? btn(`🚫 Отменить ${p.code}`, `admin:promotoggle:${p.code}:off`)
          : btn(`♻️ Включить ${p.code}`, `admin:promotoggle:${p.code}:on`),
      ]);
    }
    if (count === 0) lines.push("Пока нет промокодов.");
    rows.push([btn("⬅️", "admin:promos")]);
    await editMessage(env, chatId, messageId, lines.join("\n"), ikb(rows));
  } else if (a === "promotoggle") {
    const code = b;
    const wantOn = c === "on";
    const promo = await getJSON(db, kvKeyPromo(code));
    if (!promo) {
      await answerCallback(env, cq.id, "Промокод не найден.", true);
      return;
    }
    promo.active = wantOn;
    await putJSON(db, kvKeyPromo(promo.code), promo);
    await answerCallback(env, cq.id, wantOn ? `✅ ${promo.code} включён` : `🚫 ${promo.code} отменён`);
    // re-render the list so the status/button updates in place
    const promoKeys = await db.list({ prefix: "promo:" });
    const lines = ["📋 Промокоды:"];
    const rows = [];
    let count = 0;
    for (const k of promoKeys.keys) {
      if (k.name.startsWith("promouse:")) continue;
      const p = await getJSON(db, k.name);
      if (!p) continue;
      count++;
      const usesText = p.usesLeft === null ? "∞ (без ограничения)" : `осталось ${p.usesLeft}`;
      const expText = p.expiresAt ? `до ${p.expiresAt.slice(0, 10)}` : "бессрочно";
      const valText = promoValText(p);
      lines.push(`\n${p.active ? "🟢" : "🔴"} ${p.code} — ${valText}\nИспользований: ${usesText}${p.onePerUser ? " (1 на аккаунт)" : ""}\nСрок: ${expText}`);
      rows.push([
        p.active
          ? btn(`🚫 Отменить ${p.code}`, `admin:promotoggle:${p.code}:off`)
          : btn(`♻️ Включить ${p.code}`, `admin:promotoggle:${p.code}:on`),
      ]);
    }
    if (count === 0) lines.push("Пока нет промокодов.");
    rows.push([btn("⬅️", "admin:promos")]);
    await editMessage(env, chatId, messageId, lines.join("\n"), ikb(rows));
    return;
  } else if (a === "catalog") {
    await clearState(db, userId);
    await editMessage(
      env,
      chatId,
      messageId,
      "🎮 Каталог и цены\nВыберите раздел, чтобы посмотреть и изменить цены товаров:",
      adminCatalogListKeyboard()
    );
  } else if (a === "catcat") {
    const catKey = b;
    if (!CATALOG[catKey]) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    await clearState(db, userId);
    const view = await adminCategoryItemsView(db, catKey);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "catitem") {
    const catKey = b;
    const itemId = c;
    if (catKey === "tg_stars" && itemId === "__perstar") {
      await setState(db, userId, { step: "admin_set_starprice", data: {} });
      await editMessage(
        env,
        chatId,
        messageId,
        "Отправьте новый курс за 1 звезду (сом), например: 1.8",
        ikb([[btn("⬅️", "admin:catcat:tg_stars")]])
      );
      return answerCallback(env, cq.id);
    }
    if (catKey === "tg_stars" && itemId === "__prompttext") {
      await setState(db, userId, { step: "admin_set_stars_text", data: {} });
      await editMessage(
        env,
        chatId,
        messageId,
        "Отправьте новый текст запроса количества Stars (курс подставится отдельной строкой сверху автоматически).",
        ikb([[btn("⬅️", "admin:catcat:tg_stars")]])
      );
      return answerCallback(env, cq.id);
    }
    const base = findItemBase(catKey, itemId);
    if (!base) {
      await answerCallback(env, cq.id, t(lang, "invalid_input"), true);
      return;
    }
    const current = await getEffectivePrice(db, catKey, itemId, base.price);
    await setState(db, userId, { step: "admin_set_price", data: { catKey, itemId } });
    await editMessage(
      env,
      chatId,
      messageId,
      `${base.name}\nТекущая цена: ${current} сом\n\nОтправьте новую цену (только число, в сомах):`,
      ikb([[btn("⬅️", `admin:catcat:${catKey}`)]])
    );
  } else if (a === "rbx") {
    await clearState(db, userId);
    const view = await adminRobloxView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxtoggle") {
    const now = await isRobloxEnabled(db);
    await db.put("config:roblox_enabled", now ? "off" : "on");
    await logEvent(db, "settings", `Roblox в боте: ${now ? "скрыт" : "показывается"}`);
    const view = await adminRobloxView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxp") {
    await clearState(db, userId);
    const view = await adminRobloxProductView(db, b);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxnew") {
    await setState(db, userId, { step: "admin_rbx_newprod", data: {} });
    await editMessage(
      env,
      chatId,
      messageId,
      "Отправьте: КОЛИЧЕСТВО_ROBUX;ЦЕНА (в сомах)\nПример: 800;540\n\nЦену можно не указывать (просто 800) и задать позже.",
      ikb([[btn("⬅️", "admin:rbx")]])
    );
  } else if (a === "rbxprice") {
    await setState(db, userId, { step: "admin_rbx_price", data: { pid: b } });
    await editMessage(env, chatId, messageId, "Отправьте новую цену в сомах (только число), например: 70", ikb([[btn("⬅️", `admin:rbxp:${b}`)]]));
  } else if (a === "rbxamount") {
    await setState(db, userId, { step: "admin_rbx_amount", data: { pid: b } });
    await editMessage(env, chatId, messageId, "Отправьте новое количество Robux (целое число), например: 400", ikb([[btn("⬅️", `admin:rbxp:${b}`)]]));
  } else if (a === "rbxadd") {
    await setState(db, userId, { step: "admin_rbx_addcodes", data: { pid: b } });
    await editMessage(
      env,
      chatId,
      messageId,
      "Отправьте коды одним сообщением — каждый код с новой строки (можно сразу много, до 500).\nДубликаты пропускаются.",
      ikb([[btn("⬅️", `admin:rbxp:${b}`)]])
    );
  } else if (a === "rbxcodes") {
    await clearState(db, userId);
    const view = await adminRobloxCodesView(db, b, parseInt(c, 10) || 0);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxdel") {
    const idx = parseInt(c, 10);
    const codes = await getRobloxCodes(db, b);
    if (Number.isInteger(idx) && idx >= 0 && idx < codes.length) {
      codes.splice(idx, 1);
      await saveRobloxCodes(db, b, codes);
      await logEvent(db, "settings", `Roblox ${b}: код удалён`);
    }
    const view = await adminRobloxCodesView(db, b, Math.floor((Number.isInteger(idx) ? idx : 0) / RBX_CODES_PER_PAGE));
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxclear") {
    await editMessage(
      env,
      chatId,
      messageId,
      "Удалить ВСЕ коды этого номинала? Это нельзя отменить.",
      ikb([[btn("🗑 Да, удалить все", `admin:rbxclearok:${b}`), btn("Отмена", `admin:rbxcodes:${b}:0`)]])
    );
  } else if (a === "rbxclearok") {
    await saveRobloxCodes(db, b, []);
    await logEvent(db, "settings", `Roblox ${b}: все коды удалены`);
    const view = await adminRobloxProductView(db, b, "✅ Все коды удалены");
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "rbxdelprod") {
    await editMessage(
      env,
      chatId,
      messageId,
      "Удалить этот номинал вместе со всеми его кодами? Это нельзя отменить.",
      ikb([[btn("🗑 Да, удалить", `admin:rbxdelprodok:${b}`), btn("Отмена", `admin:rbxp:${b}`)]])
    );
  } else if (a === "rbxdelprodok") {
    const list = (await getRobloxProducts(db)).filter((p) => p.id !== b);
    await saveRobloxProducts(db, list);
    await db.delete(`roblox:codes:${b}`);
    await logEvent(db, "settings", `Roblox: номинал ${b} удалён`);
    const view = await adminRobloxView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "broadcast") {
    await setState(db, userId, { step: "admin_broadcast", data: {} });
    await editMessage(env, chatId, messageId, "Отправьте текст рассылки:", ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "orders") {
    const page = Math.max(0, parseInt(b, 10) || 0);
    const filter = ADMIN_ORDER_FILTERS[c] ? c : "all";
    const view = await adminOrdersView(db, page, filter, env);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "users") {
    const userKeys = await db.list({ prefix: "user:" });
    const recent = userKeys.keys.slice(-15).reverse();
    const lines = [`👥 Пользователей всего: ${userKeys.keys.length}`, "Последние:"];
    for (const k of recent) {
      const u = await getJSON(db, k.name);
      if (u) lines.push(`${u.id} @${u.username || "-"} — баланс ${u.balance} сом`);
    }
    await editMessage(env, chatId, messageId, lines.join("\n"), ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "wallets") {
    const view = await adminWalletsView(db, parseInt(b, 10) || 0);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "topups") {
    const topupKeys = await db.list({ prefix: "topup:" });
    const topups = [];
    for (const k of topupKeys.keys) {
      const tu = await getJSON(db, k.name);
      if (tu) topups.push(tu);
    }
    topups.sort((x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0));
    const recent = topups.slice(0, 15);
    const statusLabel = { pending: "🟡 ожидает", confirmed: "🟢 зачислено", rejected: "🔴 отклонено" };
    const lines = ["🧾 Пополнения баланса (последние):", ""];
    const rows = [];
    for (const tu of recent) {
      const u = await getUser(db, tu.userId);
      lines.push(
        `ID: ${tu.topupId}\nUser: ${tu.userId} (@${u.username || "-"})\nСумма: ${tu.amount} сом — ${statusLabel[tu.status] || tu.status}${tu.transactionId ? `\nПлатёж: ${tu.transactionId}` : ""}`
      );
      lines.push("");
      if (tu.status === "pending") {
        rows.push([btn(`✅ ${tu.amount} сом — ${u.username || tu.userId}`, `admin:topupok:${tu.topupId}`), btn("❌", `admin:topupno:${tu.topupId}`)]);
      }
    }
    if (recent.length === 0) lines.push("Пока нет заявок на пополнение.");
    lines.push("Если статус «ожидает», а оплата по факту прошла — нажмите ✅, чтобы зачислить баланс вручную.");
    rows.push([btn("⬅️", "admin:home")]);
    await editMessage(env, chatId, messageId, lines.join("\n").trim(), ikb(rows));
  } else if (a === "balances") {
    await setState(db, userId, { step: "admin_balance_lookup", data: {} });
    await editMessage(env, chatId, messageId, "Введите Telegram ID пользователя:", ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "baltopup") {
    const targetId = b;
    await setState(db, userId, { step: "admin_balance_topup", data: { targetId } });
    await editMessage(env, chatId, messageId, "Введите сумму пополнения (сом):", ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "baldeduct") {
    const targetId = b;
    await setState(db, userId, { step: "admin_balance_deduct", data: { targetId } });
    await editMessage(env, chatId, messageId, "Введите сумму списания (сом):", ikb([[btn("⬅️", "admin:home")]]));
  } else if (a === "settings") {
    const view = await adminSettingsView(env, db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "ffmaint") {
    const now = await isFreefireMaintenance(db);
    await db.put("config:ff_maintenance", now ? "off" : "on");
    await logEvent(db, "settings", `Техработы Free Fire: ${now ? "выключены" : "включены"}`);
    const view = await adminSettingsView(env, db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "mvptest") {
    const now = await isMvpTestEnabled(db);
    await db.put("config:mvp_test", now ? "off" : "on");
    await logEvent(db, "settings", `MVP тест-товар: ${now ? "скрыт" : "показывается"}`);
    const view = await adminSettingsView(env, db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "mvpthreshold") {
    await setState(db, userId, { step: "admin_mvp_threshold", data: {} });
    await editMessage(
      env,
      chatId,
      messageId,
      "Отправьте порог баланса MVP в сомах (например 1000). Когда остаток станет ниже — придёт сообщение. 0 — выключить предупреждения.",
      ikb([[btn("⬅️", "admin:settings")]])
    );
  } else if (a === "syncnow") {
    const markup = await db.get("config:markup_percent");
    if (markup === null || markup === undefined) {
      await answerCallback(env, cq.id, "Сначала задайте наценку: /syncprices 8", true);
      return;
    }
    const r = await syncPricesFromDonix(env, markup);
    await logEvent(db, "settings", r.ok ? `Цены обновлены (${markup}%): ${r.changed}` : "Обновление цен не удалось");
    await answerCallback(
      env,
      cq.id,
      r.ok ? `Обновлено: ${r.changed}${r.missing.length ? `, не найдено: ${r.missing.length}` : ""}` : "Donix недоступен",
      true
    );
    return;
  } else if (a === "logs") {
    const view = await adminLogsView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "logsclear") {
    await db.delete(LOG_KEY);
    const view = await adminLogsView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
  } else if (a === "retry") {
    const order = await getOrder(db, b);
    if (!order || order.status !== "paid") {
      await answerCallback(env, cq.id, "Заказ уже не в статусе «paid».", true);
      return;
    }
    await retryPaidOrder(env, db, order);
    const after = await getOrder(db, b);
    await logEvent(db, "settings", `Повтор заказа №${order.orderNumber}: статус «${after ? after.status : "?"}»`);
    await answerCallback(env, cq.id, `№${order.orderNumber}: ${after ? after.status : "?"}`, true);
    const view = await adminLogsView(db);
    await editMessage(env, chatId, messageId, view.text, view.keyboard);
    return;
  } else if (a === "topupok" || a === "topupno") {
    const topupId = b;
    const topup = await getJSON(db, `topup:${topupId}`);
    if (!topup || topup.status !== "pending") {
      await answerCallback(env, cq.id);
      return;
    }
    const first = await idempotentOnce(db, "topupdecision", topupId);
    if (!first) {
      await answerCallback(env, cq.id);
      return;
    }
    const targetUser = await getUser(db, topup.userId);
    const targetLang = targetUser.lang || "ru";
    if (a === "topupok") {
      topup.status = "confirmed";
      await putJSON(db, `topup:${topupId}`, topup);
      await walletTopUpCredit(db, topup.userId, topup.amount, "admin_confirmed");
      await sendMessage(env, topup.userId, `✅ ${t(targetLang, "wallet_topup")}: +${topup.amount} ${t(targetLang, "kg_som")}`);
      await editMessage(env, chatId, messageId, `✅ Подтверждено: ${topup.amount} сом для ${topup.userId}`, null);
    } else {
      topup.status = "rejected";
      await putJSON(db, `topup:${topupId}`, topup);
      await sendMessage(env, topup.userId, `❌ Заявка на пополнение отклонена.`);
      await editMessage(env, chatId, messageId, `❌ Отклонено: заявка ${topupId}`, null);
    }
  } else if (a === "orderpayok") {
    const orderId = b;
    const order = await getOrder(db, orderId);
    if (!order || order.status !== "pending_payment") {
      await answerCallback(env, cq.id);
      return;
    }
    const first = await idempotentOnce(db, "orderpayconfirm", orderId);
    if (!first) {
      await answerCallback(env, cq.id);
      return;
    }
    order.status = "paid";
    order.paymentMethod = "terminal";
    await saveOrder(db, order);
    await finalizeOrderPaid(db, order);

    const buyer = await getUser(db, order.userId);
    const buyerLang = buyer.lang || "ru";
    const procRes = await sendMessage(
      env,
      order.userId,
      `${t(buyerLang, "order_created", order.orderNumber)}\n${t(buyerLang, "processing")}`,
      backHomeKeyboard(buyerLang)
    );
    if (procRes && procRes.ok && procRes.result) {
      order.processingMsg = { chatId: order.userId, messageId: procRes.result.message_id };
      await saveOrder(db, order);
    }
    await editMessage(env, chatId, messageId, `✅ Оплата по заказу ${order.orderNumber} подтверждена.`, null);
    await processDonixOrder(env, db, order, buyerLang, order.userId);
  } else if (a === "referral") {
    const percent = await db.get(kvKeyConfig("referral_percent"));
    const textTpl = await db.get(kvKeyConfig("referral_text"));
    await editMessage(
      env,
      chatId,
      messageId,
      `🤝 Реферальная программа\nТекущий процент по умолчанию: ${percent || DEFAULT_REFERRAL_PERCENT}%\nТекст: ${
        textTpl || "(стандартный)"
      }`,
      ikb([
        [btn("✏️ Изменить процент", "admin:refpercent")],
        [btn("✏️ Изменить текст", "admin:reftext")],
        [btn("👤 Процент для юзера", "admin:refcustom")],
        [btn("⬅️", "admin:home")],
      ])
    );
  } else if (a === "refpercent") {
    await setState(db, userId, { step: "admin_referral_percent", data: {} });
    await editMessage(env, chatId, messageId, "Отправьте новый процент по умолчанию, например: 0.5", ikb([[btn("⬅️", "admin:referral")]]));
  } else if (a === "reftext") {
    await setState(db, userId, { step: "admin_referral_text", data: {} });
    await editMessage(
      env,
      chatId,
      messageId,
      "Отправьте новый текст программы. Используйте {percent} — он подставится автоматически.",
      ikb([[btn("⬅️", "admin:referral")]])
    );
  } else if (a === "refcustom") {
    await setState(db, userId, { step: "admin_referral_custom", data: {} });
    await editMessage(
      env,
      chatId,
      messageId,
      "Отправьте: username;процент\nПример: nurt1lek_ff;1.5",
      ikb([[btn("⬅️", "admin:referral")]])
    );
  }
  return answerCallback(env, cq.id);
}

async function handleAdminTextInput(env, db, msg, state, lang) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();

  if (await handleAdminRobloxText(env, db, msg, state)) return;

  if (state.step === "admin_create_promo") {
    const parts = text.split(";").map((p) => p.trim());
    if (parts.length < 3) {
      await sendMessage(env, chatId, "Неверный формат. " + t(lang, "promo_admin_create_hint"));
      return;
    }
    const [code, type, value, uses, days, minSum] = parts;
    if (!code || !["percent", "fixed"].includes(type) || !value) {
      await sendMessage(env, chatId, "Неверный формат. " + t(lang, "promo_admin_create_hint"));
      return;
    }
    const promo = await createPromo(db, {
      code,
      type,
      value: String(value).replace(",", "."),
      uses: uses || 100,
      days: days || 30,
      minSum: minSum || 0,
    });
    await clearState(db, userId);
    await sendMessage(env, chatId, `✅ Промокод создан: ${promo.code}`, adminMainKeyboard());
    return;
  }

  if (state.step === "admin_create_promo_guided") {
    const mode = state.data.mode; // "forever" | "year"
    const parts = text.split(";").map((p) => p.trim());
    const code = parts[0];
    const value = parseFloat((parts[1] || "").replace(",", "."));
    if (!code || !Number.isFinite(value) || value <= 0 || value > 100) {
      await sendMessage(
        env,
        chatId,
        "Неверный формат. Отправьте: КОД;ПРОЦЕНТ\nПример: SALE15;15 (процент от 1 до 100)"
      );
      return;
    }
    const promo = await createPromo(db, {
      code,
      type: "percent",
      value,
      uses: null, // unlimited accounts can use it, each only once (onePerUser below)
      days: mode === "year" ? 365 : null, // null = never expires ("вечный")
      minSum: 0,
      onePerUser: true,
    });
    await clearState(db, userId);
    const durationText = mode === "year" ? "1 год" : "бессрочно (вечный)";
    await sendMessage(
      env,
      chatId,
      [
        "✅ Промокод создан",
        `Код: ${promo.code}`,
        `Скидка: -${promo.value}% от суммы заказа`,
        `Срок действия: ${durationText}`,
        "Использование: по 1 разу на каждый аккаунт, число аккаунтов не ограничено",
      ].join("\n"),
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_pricepromo_code") {
    const parts = text.split(";").map((p) => p.trim());
    const code = (parts[0] || "").toUpperCase();
    const uses = parts[1] ? parseInt(parts[1], 10) : null;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code) || (parts[1] && (!Number.isFinite(uses) || uses < 1))) {
      await sendMessage(env, chatId, "Неверный формат. Отправьте: КОД;КОЛИЧЕСТВО\nКод — латиница/цифры, от 3 символов. Пример: PRICE1;50");
      return;
    }
    if (await getJSON(db, kvKeyPromo(code))) {
      await sendMessage(env, chatId, `Промокод ${code} уже существует. Придумайте другой код.`);
      return;
    }
    const data = { catKey: state.data.catKey, code, uses, prices: {} };
    await setState(db, userId, { step: "admin_pricepromo_items", data });
    const view = await adminPricePromoView(db, data);
    await sendMessage(env, chatId, view.text, view.keyboard);
    return;
  }

  if (state.step === "admin_pricepromo_items") {
    await sendMessage(env, chatId, "Нажмите на товар в списке выше, чтобы задать цену, или «✅ Создать промокод».");
    return;
  }

  if (state.step === "admin_pricepromo_setprice") {
    const data = state.data;
    if (text === "-") {
      delete data.prices[data.itemId];
    } else {
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        await sendMessage(env, chatId, "Неверная цена. Отправьте число, например: 70");
        return;
      }
      data.prices[data.itemId] = value;
    }
    delete data.itemId;
    await setState(db, userId, { step: "admin_pricepromo_items", data });
    const view = await adminPricePromoView(db, data);
    await sendMessage(env, chatId, view.text, view.keyboard);
    return;
  }

  if (state.step === "admin_create_balpromo") {
    const parts = text.split(";").map((p) => p.trim());
    const code = (parts[0] || "").toUpperCase();
    const amount = parseFloat((parts[1] || "").replace(",", "."));
    const uses = parts[2] ? parseInt(parts[2], 10) : 1;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000 || !Number.isFinite(uses) || uses < 1) {
      await sendMessage(env, chatId, "Неверный формат. Отправьте: КОД;СУММА;КОЛИЧЕСТВО\nКод — латиница/цифры, от 3 символов. Пример: MONEY50;50;20");
      return;
    }
    if (await getJSON(db, kvKeyPromo(code))) {
      await sendMessage(env, chatId, `Промокод ${code} уже существует. Придумайте другой код.`);
      return;
    }
    const promo = await createPromo(db, { code, type: "balance", value: round2(amount), uses, days: null, minSum: 0, onePerUser: true });
    await clearState(db, userId);
    await sendMessage(
      env,
      chatId,
      ["✅ Промокод на баланс создан", `Код: ${promo.code}`, `Сумма: +${fmtSom(promo.value)} сом на баланс`, `Всего активаций: ${uses} (по 1 на аккаунт)`, `Итого может уйти: ${fmtSom(round2(promo.value * uses))} сом`].join("\n"),
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_create_gift") {
    const parts = text.split(";").map((p) => p.trim());
    const code = (parts[0] || "").toUpperCase();
    const uses = parts[1] ? parseInt(parts[1], 10) : 1;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isFinite(uses) || uses < 1) {
      await sendMessage(env, chatId, "Неверный формат. Отправьте: КОД;КОЛИЧЕСТВО\nКод — латиница/цифры, от 3 символов. Пример: GIFT1;1");
      return;
    }
    if (await getJSON(db, kvKeyPromo(code))) {
      await sendMessage(env, chatId, `Промокод ${code} уже существует. Придумайте другой код.`);
      return;
    }
    const { catKey, itemId } = state.data;
    const promo = await createPromo(db, {
      code,
      type: "gift",
      value: 0,
      uses,
      days: null,
      minSum: 0,
      onePerUser: true,
      gift: { catKey, itemId },
    });
    await clearState(db, userId);
    await sendMessage(
      env,
      chatId,
      ["✅ Подарочный промокод создан", `Код: ${promo.code}`, giftPromoLabel(promo), `Всего активаций: ${uses} (кто успеет — тот получит)`].join("\n"),
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_balance_lookup") {
    const targetId = text.trim();
    if (!/^\d+$/.test(targetId)) {
      await sendMessage(env, chatId, "Неверный Telegram ID. Отправьте число, например: 123456789");
      return;
    }
    await clearState(db, userId);
    const targetUser = await getUser(db, targetId);
    const view = adminBalanceView(targetUser);
    await sendMessage(env, chatId, view.text, view.keyboard);
    return;
  }

  if (state.step === "admin_balance_topup") {
    const { targetId } = state.data;
    const amount = Number(text.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendMessage(env, chatId, "Неверная сумма. Отправьте число, например: 200");
      return;
    }
    const { oldBalance, newBalance } = await adminTopUpBalance(db, userId, targetId, amount);
    await clearState(db, userId);
    await sendMessage(
      env,
      chatId,
      `✅ Баланс изменён\n\nБыло: ${oldBalance} сом\nИзменение: +${amount} сом\nСтало: ${newBalance} сом`,
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_balance_deduct") {
    const { targetId } = state.data;
    const amount = Number(text.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendMessage(env, chatId, "Неверная сумма. Отправьте число, например: 150");
      return;
    }
    const result = await adminDeductBalance(db, userId, targetId, amount);
    if (!result.ok) {
      await sendMessage(env, chatId, `❌ Недостаточно средств на балансе. Текущий баланс: ${result.balance} сом`);
      return;
    }
    await clearState(db, userId);
    await sendMessage(
      env,
      chatId,
      `✅ Баланс изменён\n\nБыло: ${result.oldBalance} сом\nИзменение: -${amount} сом\nСтало: ${result.newBalance} сом`,
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_set_price") {
    const value = Number(text.replace(",", "."));
    const { catKey, itemId } = state.data;
    const base = findItemBase(catKey, itemId);
    if (!Number.isFinite(value) || value < 0 || !base) {
      await sendMessage(env, chatId, "Неверная цена. Отправьте число, например: 85");
      return;
    }
    await setPriceOverride(db, catKey, itemId, value);
    await clearState(db, userId);
    await sendMessage(
      env,
      chatId,
      `✅ Новая цена «${base.name}»: ${value} сом.\nЭта цена сразу применяется для всех покупателей.`,
      adminMainKeyboard()
    );
    return;
  }

  if (state.step === "admin_set_starprice") {
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      await sendMessage(env, chatId, "Неверная цена. Отправьте число, например: 1.8");
      return;
    }
    await db.put(kvKeyStarsPricePerStar(), String(value));
    await clearState(db, userId);
    await sendMessage(env, chatId, `✅ Новый курс за 1 звезду: ${value} сом.`, adminMainKeyboard());
    return;
  }

  if (state.step === "admin_set_stars_text") {
    await db.put(kvKeyStarsPromptText(), text);
    await clearState(db, userId);
    await sendMessage(env, chatId, "✅ Текст запроса количества Stars обновлён.", adminMainKeyboard());
    return;
  }

  if (state.step === "admin_mvp_threshold") {
    const value = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      await sendMessage(env, chatId, "Неверное число. Пример: 1000 (0 — выключить)");
      return;
    }
    await db.put(kvKeyConfig("mvp_low_balance"), String(value));
    await db.delete("mvp:lowbal_at");
    await clearState(db, userId);
    await sendMessage(env, chatId, `✅ Порог баланса MVP: ${value > 0 ? value + " сом" : "выключен"}`, adminMainKeyboard());
    return;
  }

  if (state.step === "admin_referral_percent") {
    const value = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      await sendMessage(env, chatId, "Неверное число. Пример: 0.5");
      return;
    }
    await db.put(kvKeyConfig("referral_percent"), String(value));
    await clearState(db, userId);
    await sendMessage(env, chatId, `✅ Процент по умолчанию: ${value}%`, adminMainKeyboard());
    return;
  }

  if (state.step === "admin_referral_text") {
    await db.put(kvKeyConfig("referral_text"), text);
    await clearState(db, userId);
    await sendMessage(env, chatId, "✅ Текст программы обновлён.", adminMainKeyboard());
    return;
  }

  if (state.step === "admin_referral_custom") {
    const parts = text.split(";").map((p) => p.trim());
    const uname = (parts[0] || "").replace(/^@/, "");
    const value = parseFloat((parts[1] || "").replace(",", "."));
    if (!uname || !Number.isFinite(value) || value < 0) {
      await sendMessage(env, chatId, "Неверный формат. Пример: nurt1lek_ff;1.5");
      return;
    }
    await db.put(kvKeyReferralOverride(uname), String(value));
    await clearState(db, userId);
    await sendMessage(env, chatId, `✅ Для @${uname} установлен процент: ${value}%`, adminMainKeyboard());
    return;
  }

  if (state.step === "admin_broadcast") {
    await clearState(db, userId);
    await sendMessage(env, chatId, "📢 Рассылка отправляется... (список пользователей — через KV list user:*)");
    // NOTE: iterating all users requires db.list({prefix:'user:'}) — see /donix-webhook section for list usage pattern.
    const list = await db.list({ prefix: "user:" });
    let sent = 0;
    for (const k of list.keys) {
      const u = await getJSON(db, k.name);
      if (u && u.id) {
        await sendMessage(env, u.id, text);
        sent++;
      }
    }
    await sendMessage(env, chatId, `✅ Рассылка завершена. Отправлено: ${sent}`);
    return;
  }
}


/* ================= WEBHOOK VERIFICATION ================= */

async function donixHmacHex(secret, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyDonixSignature(env, request, rawBody) {
  const signature = request.headers.get("X-Donix-Signature");
  const eventHeader = request.headers.get("X-Donix-Event");
  if (!signature || !env.DONIX_WEBHOOK_SECRET) return { ok: false, event: eventHeader, reason: !signature ? "no signature header" : "no DONIX_WEBHOOK_SECRET" };
  // Donix sends the header as "sha256=<hex>"
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  // The secret may have been stored with or without the "whsec_" prefix: accept both.
  const raw = String(env.DONIX_WEBHOOK_SECRET).trim();
  const variants = [raw];
  if (/^whsec_/i.test(raw)) variants.push(raw.replace(/^whsec_/i, ""));
  else variants.push("whsec_" + raw);
  for (const secret of variants) {
    const computed = await donixHmacHex(secret, rawBody);
    let diff = computed.length ^ received.length;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ (received.charCodeAt(i) || 0);
    if (diff === 0) return { ok: true, event: eventHeader };
  }
  return { ok: false, event: eventHeader, reason: "signature mismatch (wrong DONIX_WEBHOOK_SECRET?)" };
}

/* Only the statuses Donix documents are accepted; anything else is ignored (never guessed). */
const DONIX_KNOWN_STATUSES = ["processing", "completed", "failed", "refunded"];
function normalizeDonixStatus(raw) {
  return String(raw || "").toLowerCase().trim();
}

function extractDonixOrderInfo(payload) {
  const p = payload || {};
  // Most specific first, so an API-level "status":"success" wrapper is never mistaken for the order status.
  const nested = [p.data && p.data.order, p.order, p.data, p].filter(Boolean);
  let externalId = null;
  let status = null;
  for (const o of nested) {
    externalId = externalId || o.external_id || o.externalId || null;
    const st = normalizeDonixStatus(o.status);
    if (!status && DONIX_KNOWN_STATUSES.includes(st)) status = st;
  }
  return { externalId, status };
}

/* ================= MVP RESELLERS — ВТОРОЙ ПОСТАВЩИК =================
   Документация: https://reseller.mvpshop.kg/mvp-api.md
   Секреты (только env): SECOND_API_KEY — ключ rk_live_…, SECOND_WEBHOOK_SECRET — секрет подписи вебхуков.
   Ключи и подписи никогда не пишутся в логи и сообщения. */

const MVP_BASE = "https://reseller.mvpshop.kg/v1";
const MVP_LOW_BALANCE_DEFAULT = 1000; // сом; используется, пока порог не задан в админ-панели
const MVP_LOW_BALANCE_REPEAT_MS = 6 * 60 * 60 * 1000; // повторное предупреждение не чаще раза в 6 часов
const MVP_EVENT_TTL_SEC = 7 * 24 * 60 * 60; // MVP повторяет доставку до 24 ч — храним id событий 7 суток

const mvpSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- Выбор поставщика ---- */

function itemProvider(item) {
  return item && item.provider === "mvp" ? "mvp" : "donix";
}

/* Поставщик заказа: берём из самого заказа, а если там нет — из каталога по первому товару. */
function orderProvider(order) {
  if (order && order.provider) return order.provider === "mvp" ? "mvp" : "donix";
  const firstId = order && order.items && order.items[0] ? order.items[0].itemId : order && order.itemId;
  const cat0 = order && CATALOG[order.category];
  return itemProvider(findItemBase(order && order.category, firstId) || (cat0 && cat0.steam ? cat0.items[0] : null));
}

/* product_id в MVP: сначала правка админа (/setmvp), затем providerProductId из каталога. */
async function getMvpProductId(db, item) {
  const ov = await db.get(`mvpov:${item.id}`);
  return (ov && String(ov).trim()) || item.providerProductId || null;
}

async function isMvpTestEnabled(db) {
  return (await db.get("config:mvp_test")) === "on";
}

async function getMvpLowBalanceThreshold(db) {
  const v = await db.get(kvKeyConfig("mvp_low_balance"));
  const n = v !== null && v !== undefined && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : MVP_LOW_BALANCE_DEFAULT;
}

/* ---- HTTP-клиент ---- */

/* Возвращает { ok, status, data, error? }. Сеть/429/5xx повторяются (attempts), для заказов — с тем же Idempotency-Key. */
async function mvpRequest(env, method, path, opts = {}) {
  const { body = null, idempotencyKey = null, attempts = 1, timeoutMs = 20000 } = opts;
  if (!env.SECOND_API_KEY) return { ok: false, status: 0, data: null, error: "SECOND_API_KEY не задан" };
  const headers = { Authorization: `Bearer ${env.SECOND_API_KEY}`, Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let last = { ok: false, status: 0, data: null, error: "no attempt" };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${MVP_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json().catch(() => null);
      last = { ok: res.ok, status: res.status, data };
      const retryable = res.status === 429 || res.status >= 500;
      if (res.ok || !retryable || attempt === attempts) return last;
      const wait = Math.min(Number(res.headers.get("Retry-After")) || attempt, 5);
      await mvpSleep(wait * 1000);
    } catch (e) {
      last = { ok: false, status: 0, data: null, error: String(e).slice(0, 150) };
      if (attempt === attempts) return last;
      await mvpSleep(attempt * 1000);
    }
  }
  return last;
}

function mvpErrCode(r) {
  const e = r && r.data && r.data.error;
  if (e && e.code) return String(e.code);
  if (r && r.status) return `http_${r.status}`;
  return "network_error";
}

function mvpErrText(r) {
  const e = r && r.data && r.data.error;
  const parts = [mvpErrCode(r)];
  if (e && e.message) parts.push(String(e.message).slice(0, 150));
  if (e && e.request_id) parts.push(`request_id ${e.request_id}`);
  if (r && r.error) parts.push(String(r.error));
  return parts.join(" · ");
}

/* Можно повторять с тем же Idempotency-Key: сеть, таймаут, 429, 5xx, а также ошибки с retryable=true. */
function mvpIsRetryable(r) {
  if (!r) return true;
  if (r.status === 0 || r.status === 429 || r.status >= 500) return true;
  return !!(r.data && r.data.error && r.data.error.retryable === true);
}

/* GET /balance → { balance: "100.00", currency: "KGS", ... } */
async function mvpBalance(env) {
  return mvpRequest(env, "GET", "/balance");
}

/* POST /players/validate (деньги не списываются) */
async function mvpValidatePlayerRaw(env, productId, fields) {
  return mvpRequest(env, "POST", "/players/validate", { body: { product_id: productId, fields } });
}

/* POST /orders. Idempotency-Key и client_order_id выводятся из нашего internalId — одинаковы при всех повторах. */
async function mvpCreateOrder(env, { internalId, productId, fields }) {
  return mvpRequest(env, "POST", "/orders", {
    idempotencyKey: `shop-${internalId}`,
    body: { product_id: productId, fields, client_order_id: String(internalId) },
    attempts: 3,
  });
}

/* GET /orders/{number} */
async function mvpGetOrder(env, number) {
  return mvpRequest(env, "GET", `/orders/${encodeURIComponent(number)}`);
}

/* GET /orders?client_order_id=… → первый найденный заказ или null */
async function mvpFindOrderByClientId(env, clientOrderId) {
  const r = await mvpRequest(env, "GET", `/orders?client_order_id=${encodeURIComponent(clientOrderId)}`);
  const found = r.ok && r.data && Array.isArray(r.data.data) ? r.data.data[0] : null;
  return { ...r, order: found || null };
}

/* ---- Уведомления админу ---- */

async function notifyAdminMvp(env, text, icon = "⚠️") {
  if (env.DB) await logEvent(env.DB, "mvp", text);
  if (!env.ADMIN_ID) return;
  try {
    await sendMessage(env, env.ADMIN_ID, `${icon} MVP: ${escHtml(text)}`.slice(0, 3900));
  } catch (e) {
    console.log("notifyAdminMvp error", String(e));
  }
}

/* Остаток ниже порога → сообщение админу (не чаще раза в 6 часов). Автопополнения в API MVP нет — только уведомление. */
async function mvpCheckLowBalance(env, db, balanceValue) {
  const bal = Number(balanceValue);
  if (!Number.isFinite(bal)) return;
  const threshold = await getMvpLowBalanceThreshold(db);
  if (!(threshold > 0)) return; // порог 0 = предупреждения выключены
  if (bal >= threshold) {
    await db.delete("mvp:lowbal_at");
    return;
  }
  const last = Number(await db.get("mvp:lowbal_at")) || 0;
  if (Date.now() - last < MVP_LOW_BALANCE_REPEAT_MS) return;
  await db.put("mvp:lowbal_at", String(Date.now()));
  await notifyAdminMvp(
    env,
    `баланс ${fmtSom(bal)} сом — ниже порога ${fmtSom(threshold)} сом. Пополните в кабинете: https://reseller.mvpshop.kg (раздел «Пополнить»).`,
    "🔔"
  );
}

async function mvpCronBalanceCheck(env, db) {
  if (!env.SECOND_API_KEY) return;
  const r = await mvpBalance(env);
  if (!r.ok || !r.data) {
    console.log("mvp balance check failed", mvpErrCode(r));
    return;
  }
  await mvpCheckLowBalance(env, db, r.data.balance);
}

/* ---- Проверка ID игрока (показываем ник до оплаты) ---- */

/* Возвращает { state: "ok" | "invalid" | "down", nick }. */
async function mvpValidateForItem(env, db, item, uid) {
  const productId = await getMvpProductId(db, item);
  if (!productId) {
    await notifyAdminMvp(env, `у товара ${item.id} не задан providerProductId. Используйте /setmvp ${item.id} PRODUCT_ID`);
    return { state: "down", nick: null };
  }
  const r = await mvpValidatePlayerRaw(env, productId, { player_id: String(uid).trim() });
  if (r.ok && r.data) {
    if (r.data.valid === false) return { state: "invalid", nick: null };
    const nick = r.data.player && r.data.player.name ? String(r.data.player.name) : null;
    return { state: "ok", nick };
  }
  const code = mvpErrCode(r);
  if (code === "invalid_player_id" || code === "player_region_mismatch" || code === "validation_error") {
    return { state: "invalid", nick: null };
  }
  if (["invalid_api_key", "missing_api_key", "insufficient_scope", "ip_not_allowed", "account_blocked", "product_not_found", "product_unavailable"].includes(code)) {
    await notifyAdminMvp(env, `проверка ID: ${mvpErrText(r)}`);
  }
  return { state: "down", nick: null }; // player_unverifiable, лимиты, сеть, 5xx — «сервис временно недоступен»
}

/* ---- Выдача заказа ---- */

/* Безопасная обёртка: при исключении снимаем «уже отправлено», чтобы заказ можно было повторить
   (/retryorder N или cron) — повтор не создаст второй заказ у MVP (тот же Idempotency-Key + поиск по client_order_id). */
async function processMvpOrder(env, db, order, lang, chatId, isRetry = false) {
  try {
    await processMvpOrderInner(env, db, order, lang, chatId, isRetry);
  } catch (e) {
    console.log("processMvpOrder error", order.orderNumber, String(e).slice(0, 200));
    await logEvent(db, "error", `заказ №${order.orderNumber} (MVP): ${String(e).slice(0, 200)}`);
    await db.delete(kvKeyIdemp("mvpcreate", order.internalId));
    await notifyAdminMvp(env, `заказ №${order.orderNumber}: ошибка при отправке в MVP (${String(e).slice(0, 200)}). Повтор: /retryorder ${order.orderNumber}`);
  }
}

async function processMvpOrderInner(env, db, order, lang, chatId, isRetry) {
  const first = await idempotentOnce(db, "mvpcreate", order.internalId);
  if (!first) return;

  // Заказ точно НЕ создан у MVP (деньги там не списаны) → закрываем и возвращаем деньги клиенту.
  const failOrder = async (reason) => {
    order.status = "failed";
    if (order.items) order.items.forEach((l) => (l.status = "failed"));
    await saveOrder(db, order);
    const refundOk = await idempotentOnce(db, "refund", order.internalId);
    if (refundOk) await walletRelease(db, order.userId, order.total, `order_failed:${order.orderNumber}`);
    await restoreGiftPromo(db, order);
    await notifyAdminMvp(env, `заказ №${order.orderNumber} не создан. ${reason}. Клиенту возвращено ${fmtSom(order.total)} сом.`);
    await sendMessage(env, chatId, t(lang, order.isGift ? "gift_failed" : "failed"), backHomeKeyboard(lang));
  };

  const line0 = order.items && order.items[0] ? order.items[0] : null;
  const item = findItemBase(order.category, line0 ? line0.itemId : order.itemId) || (CATALOG[order.category] && CATALOG[order.category].steam ? CATALOG[order.category].items[0] : null);
  const productId = item ? await getMvpProductId(db, item) : null;
  const playerId = donixUidFromData(order.uidData);
  if (!productId) return failOrder(`нет providerProductId для ${order.itemId}. Используйте /setmvp ${order.itemId} PRODUCT_ID`);
  const noInput = !!(CATALOG[order.category] && CATALOG[order.category].noInput);
  if (!playerId && !noInput) return failOrder("не найден ID игрока в заказе");
  if (order.category === "steam" && !(Number(order.steamAmount) > 0)) return failOrder("не указана сумма Steam");
  // В первой версии MVP-товары продаются по 1 шт. (один заказ MVP на один заказ в боте).
  if (order.items && (order.items.length > 1 || order.items.some((l) => (l.qty || 1) > 1))) {
    return failOrder("для MVP-товаров пока разрешена только 1 шт.");
  }

  let mvpOrder = null;
  let balanceAfter = null;

  if (isRetry) {
    // Перед созданием спрашиваем MVP, нет ли уже заказа с нашим client_order_id.
    const ex = await mvpFindOrderByClientId(env, order.internalId);
    if (ex.order) mvpOrder = ex.order;
  }

  if (!mvpOrder) {
    const r = await mvpCreateOrder(env, { internalId: order.internalId, productId, fields: mvpOrderFields(order, playerId) });
    if (r.ok && r.data && r.data.order) {
      mvpOrder = r.data.order;
      balanceAfter = r.data.balance;
    } else {
      const code = mvpErrCode(r);
      if (code === "duplicate_client_order_id" || code === "idempotency_conflict") {
        const ex = await mvpFindOrderByClientId(env, order.internalId);
        if (ex.order) mvpOrder = ex.order;
        else return failOrder(`MVP: ${mvpErrText(r)}`);
      } else if (mvpIsRetryable(r)) {
        // Результат неизвестен (таймаут/5xx/503): деньги не трогаем, повтор безопасен (тот же ключ).
        throw new Error(`MVP: ${mvpErrText(r)}`);
      } else {
        const hint = code === "insufficient_balance" ? " Пополните баланс MVP!" : "";
        return failOrder(`MVP: ${mvpErrText(r)}.${hint}`);
      }
    }
  }

  // Перечитываем заказ: вебхук мог прийти раньше, чем мы дошли сюда, — финальный статус не затираем.
  const fresh = (await getOrder(db, order.internalId)) || order;
  fresh.provider = "mvp";
  fresh.mvpOrderNumber = mvpOrder.number;
  if (mvpOrder.price) fresh.providerCost = mvpOrder.price;
  if (fresh.status === "paid") {
    fresh.status = "processing";
    if (fresh.items) fresh.items.forEach((l) => { if (l.status === "pending") l.status = "processing"; });
  }
  await saveOrder(db, fresh);

  if (mvpOrder.price && Number(mvpOrder.price) > Number(fresh.total)) {
    await notifyAdminMvp(env, `заказ №${fresh.orderNumber}: цена MVP ${mvpOrder.price} сом выше цены для клиента ${fmtSom(fresh.total)} сом (убыток). Измените цену в «Каталог и цены».`);
  }
  if (balanceAfter !== null && balanceAfter !== undefined) await mvpCheckLowBalance(env, db, balanceAfter);

  // Ответ на повторный запрос мог вернуть уже финальный заказ.
  if (mvpOrder.status === "completed" || mvpOrder.status === "failed") {
    await handleMvpFinalStatus(env, db, order.internalId, mvpOrder.status, mvpOrder);
  }
}

/* Чек с кодом (Discord): код + кнопки «Скопировать» и «Активировать». */
async function sendGiftCodeReceipt(env, userId, lang, order) {
  await postPurchaseToReviewsChat(env, env.DB, order);
  if (order.processingMsg && order.processingMsg.messageId) {
    await deleteMessage(env, order.processingMsg.chatId || userId, order.processingMsg.messageId);
  }
  const code = order.giftCodes[0];
  const url = "https://discord.com/gifts";
  const text = [
    t(lang, "completed"),
    `№ ${order.orderNumber}`,
    order.itemName,
    "",
    rbxT(lang, "🔑 Ваш код:", "🔑 Сиздин код:"),
    `<code>${escHtml(code)}</code>`,
    rbxT(lang, "<i>Нажмите на код, чтобы скопировать.</i>", "<i>Кодду басыңыз — көчүрүлөт.</i>"),
    "",
    rbxT(lang, `Активация: <a href="${url}">discord.com/gifts</a> (если код — ссылка, просто откройте её).`, `Активдештирүү: <a href="${url}">discord.com/gifts</a> (код шилтеме болсо — ачыңыз).`),
  ].join("\n");
  const copyRow = [{ text: rbxT(lang, "📋 Скопировать код", "📋 Кодду көчүрүү"), copy_text: { text: String(code).slice(0, 256) } }];
  const restRows = [[btn(t(lang, "btn_home"), "menu:home")]];
  let res = await sendMessage(env, userId, text, { inline_keyboard: [copyRow, ...restRows] });
  if (!res || !res.ok) res = await sendMessage(env, userId, text, { inline_keyboard: restRows });
}

/* Поля заказа для MVP. Для Steam дополнительно передаётся сумма в долларах. */
function mvpOrderFields(order, playerId) {
  const cat = CATALOG[order.category];
  if (cat && cat.noInput) return {}; // Discord: полей нет
  const fields = { player_id: playerId };
  if (order.category === "steam") fields.amount = steamAmountText(order.steamAmount); // MVP: все значения — строки
  if (cat && cat.needsServer && order.uidData && order.uidData.Server) fields.server = String(order.uidData.Server);
  return fields;
}

/* Единая точка обработки финального статуса (вебхук и сверка по cron). Безопасна при повторах:
   статус заказа в KV, возврат — через idempotentOnce("refund"), чек и сообщения — через свои метки. */
async function handleMvpFinalStatus(env, db, internalId, status, mvpOrder) {
  const order = internalId ? await getOrder(db, internalId) : null;
  if (!order || orderProvider(order) !== "mvp") {
    // Например, заказ создан вручную в кабинете MVP — это не наш заказ, админа не беспокоим.
    await logEvent(db, "mvp", `событие по чужому/неизвестному заказу (${status})`);
    return "unknown";
  }
  if (["completed", "failed", "refunded", "cancelled"].includes(order.status)) {
    if (order.status !== status) {
      await notifyAdminMvp(env, `заказ №${order.orderNumber}: у нас «${order.status}», а MVP сообщает «${status}». Проверьте вручную.`);
    }
    return "already_final";
  }
  if (order.status !== "paid" && order.status !== "processing") {
    await logEvent(db, "mvp", `заказ №${order.orderNumber} в статусе «${order.status}», событие ${status} пропущено`);
    return "skipped";
  }

  const user = await getUser(db, order.userId);
  const lang = user.lang || "ru";
  order.provider = "mvp";
  if (mvpOrder && mvpOrder.number && !order.mvpOrderNumber) order.mvpOrderNumber = mvpOrder.number;
  if (mvpOrder && mvpOrder.price && !order.providerCost) order.providerCost = mvpOrder.price;

  if (status === "completed") {
    const catDef = CATALOG[order.category];
    if (catDef && catDef.giftcard && !(order.giftCodes && order.giftCodes.length)) {
      // Код лежит только в GET /orders/{number}; пока не получили — заказ остаётся «processing», cron повторит.
      const gr = order.mvpOrderNumber ? await mvpGetOrder(env, order.mvpOrderNumber) : null;
      const codes = gr && gr.ok && gr.data && Array.isArray(gr.data.codes) ? gr.data.codes.map(String).filter(Boolean) : [];
      if (codes.length === 0) {
        await logEvent(db, "mvp", `заказ №${order.orderNumber}: выполнен, но код пока не получен`);
        if (await idempotentOnce(db, "mvpnocode", order.internalId)) {
          await notifyAdminMvp(env, `заказ №${order.orderNumber} (MVP #${order.mvpOrderNumber || "?"}) выполнен, но код не получен. Бот повторит проверку сам; при необходимости: /checkorders`);
        }
        return "no_codes";
      }
      order.giftCodes = codes;
    }
    order.status = "completed";
    if (order.items) order.items.forEach((l) => (l.status = "completed"));
    await saveOrder(db, order);
    if (await idempotentOnce(db, "mvpreceipt", order.internalId)) {
      if (order.giftCodes && order.giftCodes.length) await sendGiftCodeReceipt(env, user.id, lang, order);
      else await sendCompletedReceipt(env, user.id, lang, order); // «✅ Заказ успешно выполнен» + отзыв, как у Donix
    }
    return "completed";
  }

  // failed: MVP уже вернул деньги себе на баланс, мы возвращаем клиенту на кошелёк в боте
  const failure = mvpOrder && mvpOrder.failure ? mvpOrder.failure : null;
  order.status = "failed";
  order.failureCode = failure && failure.code ? String(failure.code) : null;
  if (order.items) order.items.forEach((l) => (l.status = "failed"));
  await saveOrder(db, order);
  const refundOk = await idempotentOnce(db, "refund", order.internalId);
  if (refundOk) await walletRelease(db, order.userId, order.total, `mvp_failed:${order.orderNumber}`);
  await restoreGiftPromo(db, order);
  if (await idempotentOnce(db, "mvpfailmsg", order.internalId)) {
    await sendMessage(env, user.id, t(lang, order.isGift ? "gift_failed" : "failed"), backHomeKeyboard(lang));
    const why = failure ? `${failure.code || "?"}${failure.message ? ": " + String(failure.message).slice(0, 150) : ""}` : "причина не указана";
    await notifyAdminMvp(env, `заказ №${order.orderNumber} (MVP #${order.mvpOrderNumber || "?"}) не выполнен — ${why}. Клиенту возвращено ${fmtSom(order.total)} сом на кошелёк.`, "❌");
  }
  return "failed";
}

/* Сверка с MVP для заказа в «processing» (если вебхук не дошёл). Источник истины — GET /orders/{number}. */
async function mvpReconcileOrder(env, db, order) {
  let r;
  let mo = null;
  if (order.mvpOrderNumber) {
    r = await mvpGetOrder(env, order.mvpOrderNumber);
    mo = r.ok && r.data && r.data.number ? r.data : null;
  } else {
    r = await mvpFindOrderByClientId(env, order.internalId);
    mo = r.order;
  }
  if (!mo) return { updated: false, error: mvpErrText(r) };
  if (mo.status === "completed" || mo.status === "failed") {
    await handleMvpFinalStatus(env, db, order.internalId, mo.status, mo);
    return { updated: true };
  }
  return { updated: false };
}

/* ---- Вебхук ---- */

/* X-Signature: t=<unix>,v1=<hex>; v1 = HMAC-SHA256(секрет, t + "." + сырое_тело); допуск по времени — 5 минут. */
async function verifyMvpSignature(env, request, rawBody) {
  const secret = env.SECOND_WEBHOOK_SECRET ? String(env.SECOND_WEBHOOK_SECRET).trim() : "";
  if (!secret) return { ok: false, reason: "SECOND_WEBHOOK_SECRET не задан" };
  const header = request.headers.get("X-Signature") || "";
  const parts = {};
  for (const p of header.split(",")) {
    const i = p.indexOf("=");
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const ts = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(ts)) return { ok: false, reason: "нет или неверный заголовок X-Signature" };
  if (Math.abs(Date.now() / 1000 - ts) > 300) return { ok: false, reason: "метка времени отличается больше чем на 5 минут" };
  const received = parts.v1.toLowerCase();
  // Секрет в кабинете выглядит как "whsec_…": принимаем его с префиксом и без (как и у Donix).
  const variants = [secret, /^whsec_/i.test(secret) ? secret.replace(/^whsec_/i, "") : "whsec_" + secret];
  for (const key of variants) {
    const computed = await donixHmacHex(key, `${parts.t}.${rawBody}`);
    let diff = computed.length ^ received.length;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ (received.charCodeAt(i) || 0);
    if (diff === 0) return { ok: true };
  }
  return { ok: false, reason: "подпись не совпала (неверный SECOND_WEBHOOK_SECRET?)" };
}

async function processMvpEvent(env, db, event, eventId, type) {
  if (type === "webhook.test") {
    await notifyAdminMvp(env, "тестовое событие получено, подпись верна — вебхук настроен правильно.", "✅");
    return;
  }
  if (type !== "order.completed" && type !== "order.failed") {
    await logEvent(db, "webhook", `MVP: событие ${String(type).slice(0, 40)} пропущено`);
    return;
  }
  const evKey = eventId ? `mvpevt:${eventId}` : null;
  if (evKey && (await db.get(evKey))) return; // эта доставка уже обработана (повтор MVP)

  const mo = event && event.data && event.data.order;
  if (!mo) {
    await logEvent(db, "webhook", `MVP ${type}: нет data.order`);
    return;
  }
  const status = type === "order.completed" ? "completed" : "failed";
  if (mo.status && mo.status !== status) {
    await notifyAdminMvp(env, `событие ${type}, но статус заказа в нём «${mo.status}» — пропущено, ничего не изменено (MVP #${mo.number}).`);
    return;
  }
  await logEvent(db, "webhook", `MVP: заказ #${mo.number} → ${status}`);
  await handleMvpFinalStatus(env, db, mo.client_order_id || null, status, mo);
  if (evKey) await db.put(evKey, "1", { expirationTtl: MVP_EVENT_TTL_SEC });
}

async function routeMvpWebhook(env, db, request, ctx) {
  const rawBody = await request.text();
  const verification = await verifyMvpSignature(env, request, rawBody);
  if (!verification.ok) {
    await logEvent(db, "webhook", `MVP вебхук отклонён: ${verification.reason}`);
    return new Response("invalid signature", { status: 401 });
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const eventId = request.headers.get("X-Event-Id") || (event && event.id) || null;
  const type = (event && event.type) || request.headers.get("X-Event-Type") || "";

  // Быстро отвечаем 2xx, всё тяжёлое — после ответа.
  const work = (async () => {
    try {
      await processMvpEvent(env, db, event, eventId, type);
    } catch (e) {
      console.log("mvp-webhook handler error", String(e).slice(0, 200));
      await logEvent(db, "error", `MVP вебхук, обработчик: ${String(e).slice(0, 200)}`);
    }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work);
  else await work;
  return new Response("ok", { status: 200 });
}

/* ================= ROUTE HANDLERS ================= */

async function routeTelegramWebhook(env, db, request) {
  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(env, db, update.callback_query);
    } else if (update.message) {
      // Бот отвечает только в личных чатах. В группах/каналах (в т.ч. в чате отзывов)
      // он молчит на любые сообщения и команды — туда он только сам публикует выполненные заказы.
      if (update.message.chat && update.message.chat.type !== "private") {
        return new Response("ok", { status: 200 });
      }
      await handleMessage(env, db, update.message);
    }
  } catch (err) {
    console.log("telegram webhook error", err);
    await logEvent(db, "error", `Telegram: ${String(err).slice(0, 200)}`);
  }

  // Telegram only cares that we return 200 fast
  return new Response("ok", { status: 200 });
}

async function routeDonixWebhook(env, db, request) {
  const rawBody = await request.text();
  console.log("donix-webhook: received", request.headers.get("X-Donix-Event"), rawBody.slice(0, 600));
  const verification = await verifyDonixSignature(env, request, rawBody);
  if (!verification.ok) {
    console.log("donix-webhook: REJECTED —", verification.reason);
    await logEvent(db, "webhook", `Donix вебхук отклонён: ${verification.reason}`);
    return new Response("invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { externalId, status } = extractDonixOrderInfo(payload);
  console.log("donix-webhook: parsed", externalId, status);

  if (externalId && status) {
    await logEvent(db, "webhook", `Donix: ${externalId} → ${status}`);
    try {
      await handleDonixStatusUpdate(env, db, externalId, status);
    } catch (e) {
      console.log("donix-webhook: handler error", String(e));
      await logEvent(db, "error", `Donix вебхук, обработчик: ${String(e).slice(0, 200)}`);
    }
  } else {
    await logEvent(db, "webhook", "Donix вебхук без external_id/status");
    console.log("donix-webhook: could not find external_id/status in payload");
  }

  return new Response("ok", { status: 200 });
}

/* Fallback when the webhook does not arrive: asks Donix directly for every order that is
   still "processing" and feeds the answer through the same handler as the webhook. */
async function syncProcessingOrders(env, db) {
  const report = { checked: 0, updated: 0, sample: null, errors: [] };
  const list = await db.list({ prefix: "order:" });
  for (const k of list.keys) {
    if (report.checked >= 40) break;
    const order = await getJSON(db, k.name);
    if (!order) continue;
    if (orderProvider(order) === "mvp") {
      // Заказы MVP сверяем с MVP (GET /orders/{number}), Donix про них ничего не знает.
      if (order.status !== "processing") continue;
      report.checked++;
      const mr = await mvpReconcileOrder(env, db, order);
      if (mr.updated) report.updated++;
      else if (mr.error) report.errors.push(`MVP №${order.orderNumber}: ${mr.error}`);
      continue;
    }
    const hasOpenLine = order.items && order.items.some((l) => !["completed", "failed", "refunded"].includes(l.status));
    // «processing» — обычный случай; «completed» с незакрытой позицией — следствие гонки вебхуков.
    if (order.status !== "processing" && !(order.status === "completed" && hasOpenLine && !order.closedManually)) continue;
    const ids = [];
    if (order.items && order.items.length > 0) {
      for (const line of order.items) {
        const qty = Math.max(1, line.qty || 1);
        for (let i = 1; i <= qty; i++) {
          ids.push(qty > 1 ? `${order.internalId}::${line.itemId}#${i}` : `${order.internalId}::${line.itemId}`);
        }
      }
    } else {
      ids.push(order.internalId);
    }
    for (const externalId of ids) {
      report.checked++;
      const r = await donixOrderByExternal(env, externalId);
      if (!report.sample) report.sample = `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`;
      if (!r.ok || !r.data) {
        report.errors.push(`${externalId}: ${donixErrText(r)}`);
        continue;
      }
      const { status } = extractDonixOrderInfo(r.data);
      if (status === "completed" || status === "failed" || status === "refunded") {
        await handleDonixStatusUpdate(env, db, externalId, status, true);
        report.updated++;
      }
    }
  }
  return report;
}

async function routePaymentWebhook(env, db, request, ctx) {
  const url = new URL(request.url);
  const rawBody = await request.text();

  const isValid = await verifyFinikWebhookSignature(env, request, rawBody, url);
  if (!isValid) {
    await logEvent(db, "webhook", "Finik вебхук отклонён: неверная подпись");
    return new Response("invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Finik only sends this webhook on a SUCCESSFUL payment (see docs).
  const transactionId = payload.transactionId || payload.id;
  const status = (payload.status || "").toLowerCase();
  const paymentId = payload.fields && payload.fields.paymentId;

  if (!transactionId || !paymentId) {
    return new Response("ok", { status: 200 }); // nothing to do, ack anyway
  }

  // NOTE: keyed on paymentId (our own unique id per order/top-up), NOT on transactionId.
  // In Finik's beta/sandbox environment transactionId is not guaranteed unique across
  // separate payments, which was silently swallowing every top-up after the first one.
  const first = await idempotentOnce(db, "finikwebhook", paymentId);
  if (!first) return new Response("ok", { status: 200 }); // already processed (retry-safe)
  await logEvent(db, "webhook", `Finik: платёж ${paymentId} статус ${status || "?"}`);

  if (status !== "success" && status !== "succeeded") {
    return new Response("ok", { status: 200 });
  }

  // paymentId may refer to either a direct order payment or a wallet top-up.
  const order = await getOrder(db, paymentId);
  if (order) {
    if (order.status !== "pending_payment") {
      return new Response("ok", { status: 200 }); // already processed
    }
    order.status = "paid";
    order.paymentMethod = "bank";
    order.transactionId = transactionId;
    await saveOrder(db, order);
    await finalizeOrderPaid(db, order);

    const tail = (async () => {
      try {
        const buyer = await getUser(db, order.userId);
        const buyerLang = buyer.lang || "ru";
        if (order.guest && order.contact) {
          try {
            await sendMessage(env, env.ADMIN_ID, `🌐 Гостевой заказ №${order.orderNumber} оплачен (без Telegram)\nWhatsApp: ${order.contact}\nТовар: ${order.itemName}\nСумма: ${fmtSom(order.total)} сом`);
          } catch (e) {
            console.log("guest admin notify error", String(e));
          }
        }
        try {
          const procRes = await sendMessage(
            env,
            order.userId,
            `${t(buyerLang, "order_created", order.orderNumber)}\n${t(buyerLang, "processing")}`,
            backHomeKeyboard(buyerLang)
          );
          if (procRes && procRes.ok && procRes.result) {
            order.processingMsg = { chatId: order.userId, messageId: procRes.result.message_id };
            await saveOrder(db, order);
          }
        } catch (e) {
          console.log("processing msg error", String(e));
        }
        await processDonixOrder(env, db, order, buyerLang, order.userId);
      } catch (e) {
        console.log("payment tail error", String(e));
        await notifyAdminDonix(env, `заказ №${order.orderNumber} оплачен, но не отправлен: ${String(e).slice(0, 200)}. /retryorder ${order.orderNumber}`);
      }
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(tail);
    else await tail;
    return new Response("ok", { status: 200 });
  }

  const topup = await getJSON(db, `topup:${paymentId}`);
  if (!topup) {
    console.log("Finik webhook: unknown paymentId", paymentId);
    return new Response("ok", { status: 200 });
  }
  if (topup.status === "confirmed") {
    return new Response("ok", { status: 200 }); // already credited
  }

  topup.status = "confirmed";
  topup.transactionId = transactionId;
  await putJSON(db, `topup:${paymentId}`, topup);

  // Wallet top-ups never earn referral commission — only actual purchases do.
  await walletTopUpCredit(db, topup.userId, topup.amount, `finik:${transactionId}`);

  const user = await getUser(db, topup.userId);
  const lang = user.lang || "ru";
  await sendMessage(
    env,
    topup.userId,
    `✅ ${t(lang, "wallet_topup")}: +${topup.amount} ${t(lang, "kg_som")}`,
    backHomeKeyboard(lang)
  );

  return new Response("ok", { status: 200 });
}

function routeHealth() {
  return new Response(JSON.stringify({ ok: true, service: "nurtilek-shop", time: new Date().toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/* ================= MINI APP (Telegram Web App) =================
   Мини-апп отдаётся воркером по адресу /app, а его данные — через /api/*.
   Все запросы с авторизацией проверяются по подписи initData (токен бота),
   поэтому подделать пользователя или админа нельзя. */

let APP_URL = null;
let BOT_USERNAME = null;
const MA_IMG_IDX = "miniapp:imgidx";
const MA_REVIEWS = "miniapp:reviews";
const MA_HIDDEN = "miniapp:hidden"; // id игр, скрытых из магазина мини-аппа
const MA_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Init-Data, X-Guest-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function maJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...MA_CORS },
  });
}

async function getBotUsername(env) {
  if (BOT_USERNAME) return BOT_USERNAME;
  const r = await tgCall(env, "getMe", {});
  if (r.ok && r.result && r.result.username) BOT_USERNAME = r.result.username;
  return BOT_USERNAME;
}

async function maHmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

/* Проверка подписи Telegram (initData). Возвращает объект пользователя или null. */
async function maAuth(env, request) {
  const initData = request.headers.get("X-Init-Data") || "";
  if (!initData || !env.BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await maHmac(new TextEncoder().encode("WebAppData"), env.BOT_TOKEN);
  const calc = [...(await maHmac(secret, check))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = hash.toLowerCase();
  let diff = calc.length ^ got.length;
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ (got.charCodeAt(i) || 0);
  if (diff !== 0) return null;
  const authDate = Number(params.get("auth_date")) || 0;
  if (Date.now() / 1000 - authDate > 86400) return null;
  try {
    const u = JSON.parse(params.get("user") || "null");
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

async function maState(db) {
  const prices = {};
  await Promise.all(
    Object.keys(CATALOG)
      .filter((k) => k !== "tg_stars" && k !== "mvp_test")
      .map(async (ck) => {
        const items = await getResolvedItems(db, ck);
        for (const i of items) prices[`${ck}:${i.id}`] = i.price;
      })
  );
  let roblox = [];
  try {
    if (await isRobloxEnabled(db)) roblox = (await getRobloxAvailable(db)).map((p) => ({ id: p.id, robux: p.robux, price: p.price, stock: p.stock }));
  } catch (e) {
    console.log("maState roblox error", String(e));
  }
  const [idx, reviews, starRate, hidden] = await Promise.all([
    getJSON(db, MA_IMG_IDX, {}),
    getJSON(db, MA_REVIEWS, []),
    getEffectiveStarsPricePerStar(db),
    getJSON(db, MA_HIDDEN, []),
  ]);
  return {
    roblox,
    hidden: Array.isArray(hidden) ? hidden : [],
    prices,
    img: idx || {},
    reviews: (reviews || []).map(({ userId, ...r }) => r),
    starRate,
  };
}

async function maServeImg(db, url) {
  const k = url.searchParams.get("k") || "";
  if (!/^[A-Za-z0-9_:.\-]{1,80}$/.test(k)) return new Response("bad", { status: 400, headers: MA_CORS });
  const b64 = await db.get(`miniimg:${k}`);
  if (!b64) return new Response("not found", { status: 404, headers: MA_CORS });
  if (b64.startsWith("URL:")) return new Response(null, { status: 302, headers: { Location: b64.slice(4), "Cache-Control": "public, max-age=3600", ...MA_CORS } });
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", ...MA_CORS },
  });
}

function maOrderView(o) {
  const st =
    o.status === "completed" ? "ok" : o.status === "failed" || o.status === "refunded" ? "bad" : o.status === "pending_payment" ? "pay" : "wait";
  const cat = CATALOG[o.category];
  const d =
    Object.entries(o.uidData || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("  ") || "—";
  const rc = o.category === "roblox" && o.status === "completed" && o.robloxCodes && o.robloxCodes[0] ? String(o.robloxCodes[0]) : undefined;
  return { no: o.orderNumber, g: o.category === "roblox" ? o.itemName : `${cat ? cat.name : o.category}: ${o.itemName}`, d, p: fmtSom(o.total), st, rv: !!o.reviewed, rc };
}

/* Проверка ID игрока и получение ника (так же, как в боте). */
async function maValidateNick(env, db, catKey, item, uid) {
  if (itemProvider(item) === "mvp") {
    const mv = await mvpValidateForItem(env, db, item, uid);
    if (mv.state === "down") return { error: "unavailable" };
    if (mv.state === "invalid") return { error: "bad_id" };
    return { nick: mv.nick };
  }
  const sku = await resolveDonixSku(env, catKey, item.id, item.name);
  if (!sku) {
    await notifyAdminDonix(env, `не найден SKU для «${item.name}» (${item.id}). Используйте /setsku ${item.id} SKU`);
    return { error: "unavailable" };
  }
  const v = await donixValidate(env, { sku, uid });
  const st = v.status;
  if (!v.ok && (st === 0 || st === 401 || st === 403 || st === 429)) {
    if (st === 401 || st === 403) await notifyAdminDonix(env, `проверка ID: ${donixErrText(v)}`);
    return { error: "unavailable" };
  }
  const nick = v.ok && v.data && v.data.valid !== false ? v.data.player_name || v.data.nickname || v.data.name || null : null;
  if (!nick) return { error: "bad_id" };
  return { nick };
}

/* Создаёт заказ и платёж Finik. Возвращает { error } или { order, paymentUrl }. */
async function maCreateOrder(env, db, tu, b, ctx) {
  const userId = tu.id;
  const user = await getUser(db, userId);
  const lang = user.lang || "ru";
  const clean = (s) => String(s == null ? "" : s).trim();
  const catKey = clean(b.cat);
  const cat = CATALOG[catKey];
  const isRbx = catKey === "roblox";
  if (!cat && !isRbx) return { error: "bad_input" };
  if (catKey === "mvp_test" && !(await isMvpTestEnabled(db))) return { error: "unavailable" };
  if (catKey === "freefire" && (await isFreefireMaintenance(db))) return { error: "maintenance" };
  if (catKey === "tg_stars" && STARS_TEMP_DISABLED) return { error: "unavailable" };
  // Гость: нужен WhatsApp для связи; товары с выдачей кода в чат бота и оплата с баланса недоступны.
  let guestContact = null;
  if (tu.guest) {
    if (cat && cat.noInput) return { error: "guest_unsupported" };
    const c = clean(b.contact).replace(/[\s()-]/g, "");
    if (!/^\+?\d{9,15}$/.test(c)) return { error: "bad_contact" };
    guestContact = c.startsWith("+") ? c : "+" + c;
    b.useBalance = false;
  }

  const getUsername = () => {
    const u = clean(b.username);
    if (!/^@?[A-Za-z0-9_]{5,32}$/.test(u)) return null;
    return u.startsWith("@") ? u : "@" + u;
  };

  let itemId, itemName, price, uidData, lines;
  let steamAmount = null;

  if (catKey === "tg_stars") {
    const stars = Number(b.stars);
    if (!Number.isInteger(stars) || stars < cat.min || stars > cat.max) return { error: "bad_input" };
    const un = getUsername();
    if (!un) return { error: "bad_username" };
    const chk = await checkTelegramUsername(env, un);
    if (chk.state === "down") return { error: "unavailable" };
    if (chk.state === "invalid") return { error: "bad_username" };
    price = round2(stars * (await getEffectiveStarsPricePerStar(db)));
    itemId = `stars_${stars}`;
    itemName = `${stars} ⭐ Stars`;
    uidData = { Username: un, Stars: stars };
  } else if (catKey === "steam") {
    const amountStr = String(b.amount == null ? "" : b.amount).replace(",", ".");
    const amount = /^\d+(\.\d{1,2})?$/.test(amountStr) ? Number(amountStr) : NaN;
    const login = clean(b.login);
    if (!Number.isFinite(amount) || amount < cat.min || amount > cat.max) return { error: "bad_input" };
    if (login.length < 2 || login.length > 64 || /\s/.test(login)) return { error: "bad_input" };
    const stPid = await getMvpProductId(db, cat.items[0]);
    if (stPid) {
      const vr = await mvpValidatePlayerRaw(env, stPid, { player_id: login, amount: steamAmountText(amount) });
      const bad = (vr.ok && vr.data && vr.data.valid === false) || ["invalid_player_id", "player_region_mismatch"].includes(mvpErrCode(vr));
      if (bad) return { error: "bad_id" };
    }
    price = round2(amount * (await steamRate(db)));
    itemId = "steam_usd";
    itemName = `Steam $${steamAmountText(amount)}`;
    uidData = { UID: login, "Сумма": `$${steamAmountText(amount)}` };
    steamAmount = amount;
  } else if (isRbx) {
    // Roblox: цена и коды берутся со склада бота; код выдаётся сразу после оплаты.
    if (!(await isRobloxEnabled(db))) return { error: "unavailable" };
    const rp = (await getRobloxProducts(db)).find((p) => p.id === clean(b.item));
    const rStock = rp ? (await getRobloxCodes(db, rp.id)).length : 0;
    if (!rp || !(rp.price > 0) || rStock < 1) return { error: "unavailable" };
    itemId = rp.id;
    itemName = robloxItemName(rp.robux);
    price = rp.price;
    uidData = {};
  } else {
    const item = await findItem(db, catKey, clean(b.item));
    if (!item) return { error: "bad_input" };
    itemId = item.id;
    itemName = item.name;
    price = item.price;
    if (cat.inputType === "ml_id") {
      const uid = clean(b.uid);
      const sid = clean(b.sid);
      if (uid.length < 2 || uid.length > 64 || !sid || sid.length > 32) return { error: "bad_input" };
      uidData = { "Player ID": uid, "Server ID": sid };
    } else if (cat.inputType === "tg_username") {
      const un = getUsername();
      if (!un) return { error: "bad_username" };
      const chk = await checkTelegramUsername(env, un);
      if (chk.state === "down") return { error: "unavailable" };
      if (chk.state === "invalid") return { error: "bad_username" };
      uidData = { Username: un };
    } else if (cat.noInput) {
      uidData = {};
    } else {
      const uid = clean(b.uid);
      if (uid.length < 2 || uid.length > 64) return { error: "bad_input" };
      if (cat.validateNick) {
        const v = await maValidateNick(env, db, catKey, item, uid);
        if (v.error) return { error: v.error };
        uidData = v.nick ? { UID: uid, "Ник": v.nick } : { UID: uid };
      } else {
        uidData = { UID: uid };
      }
      if (cat.needsServer) {
        const key = Object.keys(HSR_SERVERS).find((k) => k === b.server || HSR_SERVERS[k] === b.server);
        if (!key) return { error: "bad_input" };
        uidData.Server = key;
      }
    }
    if (!cat.noInput) lines = [{ itemId: item.id, name: item.name, qty: 1, price: item.price, lineTotal: item.price }];
  }

  // Промокод: из поля мини-аппа или активированный ранее в боте. Steam — без скидок.
  let discount = 0;
  let promoCode = null;
  if (catKey !== "steam") {
    const given = clean(b.promo).toUpperCase();
    const code = given || (await db.get(kvKeyActivePromo(userId))) || "";
    if (code) {
      const check = await validatePromo(db, code, userId, price, { catKey, lines });
      const usable =
        check.ok && check.promo.type !== "gift" && check.promo.type !== "balance" && !(check.promo.type === "prices" && check.discount <= 0);
      if (usable) {
        discount = check.discount;
        promoCode = code;
      } else if (given) {
        return { error: "bad_promo" };
      }
    }
  }
  const total = round2(price - discount);
  if (!(total > 0)) return { error: "bad_promo" };

  const order = await createOrder(db, { userId, category: catKey, itemId, itemName, price, discount, total, uidData, promoCode, items: lines });
  order.source = "miniapp";
  if (tu.guest) { order.guest = true; order.contact = guestContact; }
  if (steamAmount) order.steamAmount = steamAmount;
  await saveOrder(db, order);

  if (b.useBalance) {
    const fresh = await getUser(db, userId);
    const paidOk = await walletReserve(db, fresh, order.total);
    if (!paidOk) {
      order.status = "cancelled";
      await saveOrder(db, order);
      return { error: "no_balance" };
    }
    order.status = "paid";
    order.paymentMethod = "balance";
    await saveOrder(db, order);
    await finalizeOrderPaid(db, order);
    const tail = (async () => {
      try {
        const buyerLang = fresh.lang || "ru";
        try {
          const procRes = await sendMessage(env, userId, `${t(buyerLang, "order_created", order.orderNumber)}\n${t(buyerLang, "processing")}`, backHomeKeyboard(buyerLang));
          if (procRes && procRes.ok && procRes.result) {
            order.processingMsg = { chatId: userId, messageId: procRes.result.message_id };
            await saveOrder(db, order);
          }
        } catch (e) {
          console.log("miniapp processing msg error", String(e));
        }
        await processDonixOrder(env, db, order, buyerLang, userId);
      } catch (e) {
        console.log("miniapp balance tail error", String(e));
        await notifyAdminDonix(env, `заказ №${order.orderNumber} оплачен балансом, но не отправлен: ${String(e).slice(0, 200)}. /retryorder ${order.orderNumber}`);
      }
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(tail);
    else await tail;
    const after = await getUser(db, userId);
    return { order, paid: true, balance: fmtSom(after.balance) };
  }

  let payment;
  try {
    const botName = await getBotUsername(env);
    payment = await createFinikPayment(env, {
      amount: round2(order.total),
      paymentId: order.internalId,
      redirectUrl: tu.guest && env.APP_BASE_URL ? `${String(env.APP_BASE_URL).replace(/\/$/, "")}/app#orders` : botName ? `https://t.me/${botName}` : env.APP_BASE_URL,
      description: `Nurtilek Shop order ${order.orderNumber}`,
      lang,
    });
  } catch (e) {
    console.log("miniapp finik error", String(e));
    payment = { ok: false };
  }
  if (!payment.ok || !payment.paymentUrl) {
    order.status = "cancelled";
    await saveOrder(db, order);
    return { error: "pay_error" };
  }
  return { order, paymentUrl: payment.paymentUrl };
}

async function handleMiniApi(env, db, request, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: MA_CORS });
  try {
    if (path === "/api/img" && request.method === "GET") return await maServeImg(db, url);
    if (path === "/api/state" && request.method === "GET") return maJson(await maState(db));

    let tu = await maAuth(env, request);
    if (!tu) {
      // Гость без Telegram (веб-версия): анонимный токен из браузера. Только покупка за Finik и просмотр своих заказов.
      const gid = request.headers.get("X-Guest-Id") || "";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gid)) {
        tu = { id: "g_" + gid.toLowerCase(), first_name: "Гость", guest: true };
      }
    }
    if (!tu) return maJson({ error: "auth" }, 401);
    if (tu.guest && (path === "/api/topup" || path === "/api/review" || path.startsWith("/api/admin/"))) return maJson({ error: "auth" }, 403);
    const clean = (s) => String(s == null ? "" : s).trim();
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

    if (path === "/api/whoami") return maJson({ admin: isAdmin(env, tu.id) });

    if (path === "/api/me") {
      const u = await getUser(db, tu.id);
      if (tu.username && tu.username !== u.username) {
        u.username = tu.username;
        await saveUser(db, u);
      }
      const bot = await getBotUsername(env);
      return maJson({
        name: tu.first_name || tu.username || "Гость",
        id: String(tu.id),
        spent: fmtSom(u.spent || 0),
        bal: fmtSom(u.balance || 0),
        earned: fmtSom(u.referralEarnings || 0),
        refLink: bot && !tu.guest ? `https://t.me/${bot}?start=ref_${tu.id}` : "",
        guest: !!tu.guest,
      });
    }

    if (path === "/api/orders") {
      const ids = ((await getJSON(db, kvKeyUserOrders(tu.id), [])) || []).slice(0, 30);
      let list = (await Promise.all(ids.map((id) => getOrder(db, id)))).filter((o) => o && o.status !== "cancelled");
      // Заказы, которые долго «в обработке»: сверяем с поставщиком прямо сейчас (не ждём cron/вебхук).
      const stuck = list
        .filter((o) => {
          const open = o.items && o.items.some((l) => !["completed", "failed", "refunded"].includes(l.status));
          const stale = Date.now() - new Date(o.updatedAt || o.createdAt).getTime() > 15000;
          return stale && (o.status === "processing" || (o.status === "completed" && open && !o.closedManually));
        })
        .slice(0, 3);
      if (stuck.length) {
        try {
          await Promise.all(stuck.map((o) => reconcileOneOrder(env, db, o).catch((e) => console.log("reconcile error", String(e)))));
          list = (await Promise.all(list.map((o) => getOrder(db, o.internalId)))).filter((o) => o && o.status !== "cancelled");
        } catch (e) {
          console.log("miniapp reconcile error", String(e));
        }
      }
      return maJson({ orders: list.map(maOrderView) });
    }

    if (path === "/api/order" && request.method === "POST") {
      const r = await maCreateOrder(env, db, tu, body, ctx);
      if (r.error) return maJson({ error: r.error }, 400);
      return maJson({ orderNumber: r.order.orderNumber, paymentUrl: r.paymentUrl || null, total: r.order.total, paid: !!r.paid, balance: r.balance });
    }

    if (path === "/api/topup" && request.method === "POST") {
      // Пополнение баланса из мини-аппа: та же заявка topup:* и Finik-платёж, что и в боте;
      // зачисление делает /payment-webhook (walletTopUpCredit), баланс общий с ботом.
      const amount = Math.floor(Number(body.amount));
      if (!Number.isFinite(amount) || amount < 10 || amount > 100000) return maJson({ error: "bad_amount" }, 400);
      const u = await getUser(db, tu.id);
      const lang = u.lang || "ru";
      const topupId = crypto.randomUUID();
      await putJSON(db, `topup:${topupId}`, {
        topupId,
        userId: tu.id,
        amount,
        status: "pending",
        source: "miniapp",
        createdAt: new Date().toISOString(),
      });
      let payment;
      try {
        const botName = await getBotUsername(env);
        payment = await createFinikPayment(env, {
          amount,
          paymentId: topupId,
          redirectUrl: botName ? `https://t.me/${botName}` : env.APP_BASE_URL,
          description: `Nurtilek Shop top-up ${topupId}`,
          lang,
        });
      } catch (e) {
        console.log("miniapp topup finik error", String(e));
        payment = { ok: false };
      }
      if (!payment.ok || !payment.paymentUrl) return maJson({ error: "pay_error" }, 400);
      try {
        await sendMessage(
          env,
          env.ADMIN_ID,
          `🧾 Новое пополнение из мини-аппа (ожидает оплаты)\nID: ${topupId}\nUser: ${tu.id} (@${u.username || tu.username || "-"})\nСумма: ${amount} сом`,
          ikb([[btn("✅ Зачислить", `admin:topupok:${topupId}`), btn("❌ Отклонить", `admin:topupno:${topupId}`)]])
        );
      } catch (e) {
        console.log("miniapp topup admin notify error", String(e));
      }
      return maJson({ paymentUrl: payment.paymentUrl, amount, topupId });
    }

    if (path === "/api/review" && request.method === "POST") {
      const o = await getOrderByNumber(db, clean(body.orderNo));
      if (!o || String(o.userId) !== String(tu.id) || o.status !== "completed") return maJson({ error: "bad_input" }, 400);
      if (o.reviewed) return maJson({ error: "already" }, 400);
      const text = clean(body.text).slice(0, 400);
      const rating = Math.round(Number(body.rating));
      if (text.length < 3 || !(rating >= 1 && rating <= 5)) return maJson({ error: "bad_input" }, 400);
      const idStr = String(tu.id);
      const list = (await getJSON(db, MA_REVIEWS, [])) || [];
      list.unshift({
        id: crypto.randomUUID(),
        userId: tu.id,
        name: String(tu.first_name || tu.username || "Покупатель").slice(0, 30),
        mask: `ID ${idStr.slice(0, 4)} • • • ${idStr.slice(-2)}`,
        sum: fmtSom(o.total),
        date: fmtDateRu(new Date().toISOString()),
        text,
        rating,
      });
      if (list.length > 200) list.length = 200;
      await putJSON(db, MA_REVIEWS, list);
      o.reviewed = true;
      await saveOrder(db, o);
      return maJson({ ok: true });
    }

    if (path.startsWith("/api/admin/")) {
      if (!isAdmin(env, tu.id)) return maJson({ error: "forbidden" }, 403);

      if (path === "/api/admin/img") {
        const key = clean(body.key);
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
        if (!/^[A-Za-z0-9_:.\-]{1,80}$/.test(key) || !m || m[1].length > 400000) return maJson({ error: "bad_input" }, 400);
        await db.put(`miniimg:${key}`, m[1]);
        const idx = (await getJSON(db, MA_IMG_IDX, {})) || {};
        idx[key] = Date.now().toString(36);
        await putJSON(db, MA_IMG_IDX, idx);
        return maJson({ ok: true, v: idx[key] });
      }

      if (path === "/api/admin/imgurl") {
        const key = clean(body.key);
        const u = String(body.url || "").trim();
        if (!/^[A-Za-z0-9_:.\-]{1,80}$/.test(key) || !/^https:\/\/[^\s"'<>\\]{4,480}$/i.test(u)) return maJson({ error: "bad_input" }, 400);
        await db.put(`miniimg:${key}`, "URL:" + u);
        const idx = (await getJSON(db, MA_IMG_IDX, {})) || {};
        idx[key] = Date.now().toString(36);
        await putJSON(db, MA_IMG_IDX, idx);
        return maJson({ ok: true, v: idx[key] });
      }

      if (path === "/api/admin/imgdel") {
        const key = clean(body.key);
        if (!/^[A-Za-z0-9_:.\-]{1,80}$/.test(key)) return maJson({ error: "bad_input" }, 400);
        await db.delete(`miniimg:${key}`);
        const idx = (await getJSON(db, MA_IMG_IDX, {})) || {};
        delete idx[key];
        await putJSON(db, MA_IMG_IDX, idx);
        return maJson({ ok: true });
      }

      if (path === "/api/admin/orders") {
        // История заказов для админа (те же заказы и фильтры, что в боте: «📦 Заказы»).
        const filter = ADMIN_ORDER_FILTERS[clean(body.filter)] ? clean(body.filter) : "all";
        const per = 15;
        const all = await loadAllOrders(db);
        const allowed = ADMIN_ORDER_FILTERS[filter].statuses;
        const list = allowed ? all.filter((o) => allowed.includes(o.status)) : all;
        const pages = Math.max(1, Math.ceil(list.length / per));
        const page = Math.min(Math.max(0, parseInt(body.page, 10) || 0), pages - 1);
        const ST = { pending_payment: "Ожидает оплаты", paid: "Оплачен", processing: "В обработке", completed: "Выполнен", failed: "Не выполнен", refunded: "Возврат", cancelled: "Отменён" };
        // «В обработке» дольше 15 сек: сверяем с поставщиком прямо сейчас и закрываем, если уже выполнен.
        let slice = list.slice(page * per, (page + 1) * per);
        const stuck = slice
          .filter((o) => o.status === "processing" && Date.now() - new Date(o.updatedAt || o.createdAt).getTime() > 15000)
          .slice(0, 5);
        if (stuck.length) {
          try {
            await Promise.all(stuck.map((o) => reconcileOneOrder(env, db, o).catch((e) => console.log("admin reconcile error", String(e)))));
            slice = await Promise.all(slice.map(async (o) => (await getOrder(db, o.internalId)) || o));
          } catch (e) {
            console.log("admin reconcile error", String(e));
          }
        }
        const out = await Promise.all(
          slice.map(async (o) => {
            const usr = o.guest ? null : await getJSON(db, kvKeyUser(o.userId));
            const cat = CATALOG[o.category];
            return {
              no: o.orderNumber,
              date: fmtDateRu(o.createdAt),
              who: o.guest ? "Гость (без Telegram)" : usr && usr.username ? `@${usr.username} (${o.userId})` : String(o.userId),
              item: `${cat ? cat.name : o.category}: ${o.itemName}`,
              uid: Object.entries(o.uidData || {}).map(([k, v]) => `${k}: ${v}`).join("  "),
              p: fmtSom(o.total),
              promo: o.promoCode || "",
              s: o.status,
              st: ST[o.status] || String(o.status),
              contact: o.contact || "",
              src: o.guest ? "веб" : o.source === "miniapp" ? "мини-апп" : "бот",
            };
          })
        );
        return maJson({ total: list.length, all: all.length, page, pages, orders: out });
      }

      if (path === "/api/admin/gamevis") {
        // Показать / скрыть игру в магазине мини-аппа (скрытые видит только админ).
        const id = clean(body.id);
        if (!/^[a-z0-9_-]{1,20}$/i.test(id)) return maJson({ error: "bad_input" }, 400);
        let list = (await getJSON(db, MA_HIDDEN, [])) || [];
        if (!Array.isArray(list)) list = [];
        list = list.filter((x) => x !== id);
        if (body.hidden) list.push(id);
        await putJSON(db, MA_HIDDEN, list.slice(0, 100));
        await logEvent(db, "settings", `Мини-апп: игра ${id} ${body.hidden ? "скрыта" : "показана"}`);
        return maJson({ ok: true, hidden: list });
      }

      if (path === "/api/admin/price") {
        const [ck, iid] = clean(body.key).split(":");
        const price = Number(body.price);
        if (!findItemBase(ck, iid) || !Number.isFinite(price) || price <= 0 || price > 10000000) return maJson({ error: "bad_input" }, 400);
        await setPriceOverride(db, ck, iid, price);
        await logEvent(db, "settings", `Мини-апп: цена ${ck}:${iid} = ${price}`);
        return maJson({ ok: true });
      }

      if (path === "/api/admin/reviewdel") {
        const id = clean(body.id);
        const list = ((await getJSON(db, MA_REVIEWS, [])) || []).filter((r) => r.id !== id);
        await putJSON(db, MA_REVIEWS, list);
        return maJson({ ok: true });
      }
    }

    return maJson({ error: "not_found" }, 404);
  } catch (e) {
    console.log("miniapp api error", path, String(e).slice(0, 200));
    await logEvent(db, "error", `Мини-апп ${path}: ${String(e).slice(0, 150)}`);
    return maJson({ error: "server" }, 500);
  }
}

/* ================= MAIN FETCH ================= */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const db = env.DB;
    APP_URL = env.APP_BASE_URL ? `${String(env.APP_BASE_URL).replace(/\/+$/, "")}/app` : null;

    if (request.method === "GET" && (url.pathname === "/app" || url.pathname === "/app/")) {
      return new Response(APP_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleMiniApi(env, db, request, ctx);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return routeHealth();
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      return routeTelegramWebhook(env, db, request);
    }

    if (request.method === "POST" && url.pathname === "/donix-webhook") {
      return routeDonixWebhook(env, db, request);
    }

    if (request.method === "POST" && url.pathname === "/mvp-webhook") {
      return routeMvpWebhook(env, db, request, ctx);
    }

    if (request.method === "POST" && url.pathname === "/payment-webhook") {
      return routePaymentWebhook(env, db, request, ctx);
    }

    return new Response("not found", { status: 404 });
  },

  // Optional cron trigger: re-syncs prices daily once /syncprices N has been used at least once.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          await retryStuckPaidOrders(env, env.DB);
        } catch (e) {
          console.log("retryStuckPaidOrders error", String(e));
        }
        try {
          await syncProcessingOrders(env, env.DB);
        } catch (e) {
          console.log("syncProcessingOrders error", String(e));
        }
        try {
          await mvpCronBalanceCheck(env, env.DB);
        } catch (e) {
          console.log("mvpCronBalanceCheck error", String(e));
        }
        const markup = await env.DB.get("config:markup_percent");
        if (markup === null || markup === undefined) return;
        const r = await syncPricesFromDonix(env, markup);
        if (!r.ok) await notifyAdminDonix(env, "автообновление цен не удалось");
        else if (r.missing.length) await notifyAdminDonix(env, `цены обновлены, не найдены: ${r.missing.join(", ")}`);
      })()
    );
  },
};
