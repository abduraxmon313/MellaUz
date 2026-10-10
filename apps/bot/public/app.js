'use strict';
/* ═══════════════════════════════════════════════════════════
   MELLA Mini App
   Ishlash tuzilmasi — Gunesh Mini App (ko'rinishlar, sheet'lar, savat,
   ikki qadamli checkout + Yandex xarita, buyurtma timeline'i, profil).
   Dizayn — MELLA sayti. Ma'lumot — BILLZ (bot serveri /api orqali).
   ═══════════════════════════════════════════════════════════ */

const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); tg.enableClosingConfirmation && tg.enableClosingConfirmation(); } catch (e) {} }

const TASHKENT = { lat: 41.311081, lng: 69.279729 };
const THEME_BG = '#2a1d1b';
const CART_KEY = 'mella_cart_v1';
const FAV_KEY = 'mella_fav_v1';

const State = {
  config: null, categories: [], products: [], cart: loadCart(), favorites: loadFavorites(),
  currentCategory: null, search: '', sort: 'popular',
  lang: localStorage.getItem('mella_lang') || ((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'uz'),
  view: 'home',
  _map: null, _pickLat: null, _pickLng: null, _pickAddr: '', _geoT: null,
  _express: false, _payment: 'cash', _deliveryType: 'delivery', _checkoutData: null, _mapOk: false,
};
State.lang = String(State.lang).slice(0, 2);
if (!['uz', 'ru', 'en'].includes(State.lang)) State.lang = 'uz';

let _ymapsPromise = null;
const MAP_PIN_SVG = '<svg viewBox="0 0 24 24" width="42" height="42" fill="#d9a867" stroke="#2a1d1b" stroke-width="1.4"><path d="M12 23s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13Z"/><circle cx="12" cy="10" r="3" fill="#180f0f" stroke="none"/></svg>';

/* ── Lucide uslubidagi SVG ikonalar ── */
const ICONS = {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
  store: '<svg viewBox="0 0 24 24"><path d="M4 9V4h16v5"/><path d="M4 9h16l-1 11H5L4 9Z"/><path d="M9 20v-6h6v6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  truck: '<svg viewBox="0 0 24 24"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8L19 15Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
  zap: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v14"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  message: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>',
  trendDown: '<svg viewBox="0 0 24 24"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>',
  trendUp: '<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  map: '<svg viewBox="0 0 24 24"><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  ruler: '<svg viewBox="0 0 24 24"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
};

function applyIcons(root) {
  (root || document).querySelectorAll('[data-ic]').forEach((node) => {
    if (node.dataset.icDone === '1') return;
    const name = node.getAttribute('data-ic');
    if (ICONS[name]) { node.innerHTML = ICONS[name]; node.dataset.icDone = '1'; }
  });
}

/* ═══════════════════════════════════════════════════════════
   I18N — uz / ru / en
   ═══════════════════════════════════════════════════════════ */
const I18N = {
  brand_tagline: { uz: 'Uslub · Sifat · Tajriba', ru: 'Стиль · Качество · Опыт', en: 'Style · Quality · Craft' },
  search: { uz: 'Mahsulot qidirish…', ru: 'Поиск товаров…', en: 'Search products…' },
  collection: { uz: 'Kolleksiya', ru: 'Коллекция', en: 'Collection' },
  hero_eyebrow: { uz: 'Yangi mavsum', ru: 'Новый сезон', en: 'New season' },
  hero_title: { uz: 'Tabiiy charm.<br>Nafis uslub.', ru: 'Натуральная кожа.<br>Изящный стиль.', en: 'Genuine leather.<br>Refined style.' },
  hero_cta: { uz: 'Ko‘rish', ru: 'Смотреть', en: 'Explore' },
  all: { uz: 'Hammasi', ru: 'Все', en: 'All' },
  add: { uz: 'Savatga', ru: 'В корзину', en: 'Add to bag' },
  choose: { uz: 'Tanlash', ru: 'Выбрать', en: 'Select' },
  from: { uz: 'dan', ru: 'от', en: 'from' },
  out_of_stock: { uz: 'Tugagan', ru: 'Нет в наличии', en: 'Sold out' },
  in_stock: { uz: 'Mavjud', ru: 'В наличии', en: 'In stock' },
  low_stock: { uz: 'Oxirgi {n} dona', ru: 'Осталось {n} шт', en: 'Only {n} left' },
  count_items: { uz: '{n} ta', ru: '{n} шт', en: '{n} items' },
  no_products: { uz: 'Mahsulot topilmadi', ru: 'Ничего не найдено', en: 'Nothing found' },
  sort_popular: { uz: 'Ommabop', ru: 'Популярные', en: 'Popular' },
  sort_new: { uz: 'Yangi', ru: 'Новинки', en: 'New' },
  sort_cheap: { uz: 'Arzonroq', ru: 'Дешевле', en: 'Price ↑' },
  sort_expensive: { uz: 'Qimmatroq', ru: 'Дороже', en: 'Price ↓' },
  sale: { uz: 'Chegirma', ru: 'Скидка', en: 'Sale' },
  size: { uz: 'O‘lcham', ru: 'Размер', en: 'Size' },
  variant: { uz: 'Variant', ru: 'Вариант', en: 'Option' },
  choose_size: { uz: 'O‘lchamni tanlang', ru: 'Выберите размер', en: 'Select a size' },
  choose_variant_first: { uz: 'Avval o‘lchamni tanlang', ru: 'Сначала выберите размер', en: 'Please select a size first' },
  qty_label: { uz: 'Miqdor', ru: 'Количество', en: 'Quantity' },
  added_to_cart: { uz: 'Savatga qo‘shildi', ru: 'Добавлено в корзину', en: 'Added to bag' },
  max_qty: { uz: 'Omborda faqat {n} dona bor', ru: 'На складе только {n} шт', en: 'Only {n} in stock' },

  favorites_title: { uz: 'Sevimlilar', ru: 'Избранное', en: 'Favourites' },
  favorites_sub: { uz: 'Yoqqan mahsulotlaringiz', ru: 'Понравившиеся товары', en: 'Pieces you love' },
  no_favorites: { uz: 'Sevimlilar hali bo‘sh', ru: 'В избранном пока пусто', en: 'No favourites yet' },
  fav_added: { uz: '♥ Sevimlilarga qo‘shildi', ru: '♥ Добавлено в избранное', en: '♥ Added to favourites' },
  fav_removed: { uz: 'Sevimlilardan olindi', ru: 'Удалено из избранного', en: 'Removed from favourites' },

  cart_title: { uz: 'Savat', ru: 'Корзина', en: 'Bag' },
  cart_empty: { uz: 'Savat bo‘sh', ru: 'Корзина пуста', en: 'Your bag is empty' },
  start_shopping: { uz: 'Kolleksiyani ko‘rish', ru: 'Смотреть коллекцию', en: 'Explore collection' },
  in_cart: { uz: 'Savatda', ru: 'В корзине', en: 'In bag' },
  view_cart: { uz: 'Ko‘rish', ru: 'Открыть', en: 'View' },
  checkout: { uz: 'Rasmiylashtirish', ru: 'Оформить', en: 'Checkout' },
  items_total: { uz: 'Mahsulotlar', ru: 'Товары', en: 'Items' },
  delivery_fee: { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery' },
  total: { uz: 'Jami', ru: 'Итого', en: 'Total' },
  free: { uz: 'Bepul', ru: 'Бесплатно', en: 'Free' },
  min_order: { uz: 'Minimal buyurtma', ru: 'Мин. заказ', en: 'Min. order' },
  free_left: { uz: 'Bepul yetkazishgacha yana {sum}', ru: 'До бесплатной доставки ещё {sum}', en: '{sum} more for free delivery' },
  free_done: { uz: 'Yetkazib berish bepul!', ru: 'Доставка бесплатно!', en: 'Delivery is free!' },
  cart_updated: { uz: 'Savat yangilandi: narx yoki qoldiq o‘zgargan', ru: 'Корзина обновлена: изменились цены или остатки', en: 'Bag updated: prices or stock changed' },

  checkout_title: { uz: 'Rasmiylashtirish', ru: 'Оформление', en: 'Checkout' },
  step_delivery: { uz: 'Yetkazish', ru: 'Доставка', en: 'Delivery' },
  step_payment: { uz: 'To‘lov', ru: 'Оплата', en: 'Payment' },
  delivery_type: { uz: 'Qabul qilish usuli', ru: 'Способ получения', en: 'How to receive' },
  delivery: { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery' },
  pickup: { uz: 'Olib ketish', ru: 'Самовывоз', en: 'Pickup' },
  pickup_from: { uz: 'Do‘kondan olib ketasiz', ru: 'Заберёте из магазина', en: 'Pick up from our store' },
  address_label: { uz: 'Yetkazish manzili', ru: 'Адрес доставки', en: 'Delivery address' },
  address_ph: { uz: 'Ko‘cha, uy…', ru: 'Улица, дом…', en: 'Street, house…' },
  landmark: { uz: 'Xonadon / qavat / mo‘ljal (ixtiyoriy)', ru: 'Квартира / этаж / ориентир (необяз.)', en: 'Apt / floor / landmark (optional)' },
  map_hint: { uz: 'Xaritani suring — belgi kerakli joyga to‘g‘rilansin', ru: 'Двигайте карту, чтобы указать точку', en: 'Drag the map to set the point' },
  map_note: { uz: 'Xarita yuklanmadi — manzilni matn ko‘rinishida yozing yoki «Olib ketish»ni tanlang.', ru: 'Карта не загрузилась — введите адрес текстом или выберите «Самовывоз».', en: 'Map didn’t load — type your address or choose “Pickup”.' },
  loc_fail: { uz: 'Joylashuvni aniqlab bo‘lmadi', ru: 'Не удалось определить локацию', en: 'Could not detect location' },
  delivery_time: { uz: 'Yetkazib berish vaqti', ru: 'Время доставки', en: 'Delivery time' },
  deliv_day: { uz: 'Kun davomida', ru: 'В течение дня', en: 'During the day' },
  asap: { uz: 'Tezkor', ru: 'Срочно', en: 'Express' },
  contact_label: { uz: 'Qabul qiluvchi', ru: 'Получатель', en: 'Recipient' },
  name_ph: { uz: 'Ismingiz', ru: 'Ваше имя', en: 'Your name' },
  phone_ph: { uz: '+998 90 123 45 67', ru: '+998 90 123 45 67', en: '+998 90 123 45 67' },
  share_phone: { uz: 'Telegram', ru: 'Telegram', en: 'Telegram' },
  note: { uz: 'Izoh (ixtiyoriy)', ru: 'Комментарий (необязательно)', en: 'Note (optional)' },
  need_address: { uz: 'Iltimos, yetkazish manzilini kiriting', ru: 'Пожалуйста, укажите адрес доставки', en: 'Please enter a delivery address' },
  need_phone: { uz: 'Telefon raqamingizni kiriting', ru: 'Укажите номер телефона', en: 'Please enter your phone number' },
  to_payment: { uz: 'To‘lovga o‘tish', ru: 'К оплате', en: 'Continue to payment' },
  back: { uz: 'Ortga', ru: 'Назад', en: 'Back' },
  choose_payment: { uz: 'To‘lov usuli', ru: 'Способ оплаты', en: 'Payment method' },
  pay_cash: { uz: 'Naqd pul', ru: 'Наличные', en: 'Cash' },
  pay_cash_hint: { uz: 'Buyurtmani qabul qilganda to‘laysiz', ru: 'Оплата при получении заказа', en: 'Pay when you receive the order' },
  pay_click: { uz: 'Click', ru: 'Click', en: 'Click' },
  pay_click_hint: { uz: 'Kartadan onlayn to‘lov', ru: 'Онлайн-оплата картой', en: 'Online card payment' },
  soon: { uz: 'Tez kunda', ru: 'Скоро', en: 'Soon' },
  confirm_order: { uz: 'Buyurtmani tasdiqlash', ru: 'Подтвердить заказ', en: 'Place order' },
  saving: { uz: 'Yuborilmoqda…', ru: 'Отправка…', en: 'Sending…' },
  order_accepted: { uz: 'Buyurtma qabul qilindi', ru: 'Заказ принят', en: 'Order received' },
  order_cash_hint: { uz: 'Operatorimiz tez orada siz bilan bog‘lanib, buyurtmani tasdiqlaydi. Holat o‘zgarishlari botga keladi.', ru: 'Оператор скоро свяжется с вами для подтверждения. Обновления статуса придут в бот.', en: 'Our operator will contact you shortly to confirm. Status updates will arrive in the bot.' },
  my_orders: { uz: 'Buyurtmalarim', ru: 'Мои заказы', en: 'My orders' },
  continue_shopping: { uz: 'Xaridni davom ettirish', ru: 'Продолжить покупки', en: 'Continue shopping' },

  orders_title: { uz: 'Buyurtmalarim', ru: 'Мои заказы', en: 'My orders' },
  no_orders: { uz: 'Hali buyurtmalar yo‘q', ru: 'Заказов пока нет', en: 'No orders yet' },
  paid: { uz: 'To‘langan', ru: 'Оплачено', en: 'Paid' },
  tl_created: { uz: 'Qabul', ru: 'Принят', en: 'Placed' },
  tl_confirmed: { uz: 'Tasdiq', ru: 'Подтв.', en: 'Confirmed' },
  tl_preparing: { uz: 'Qadoq', ru: 'Упаковка', en: 'Packing' },
  tl_on_way: { uz: 'Yo‘lda', ru: 'В пути', en: 'On the way' },
  tl_delivered: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered' },
  tl_handed: { uz: 'Topshirildi', ru: 'Выдан', en: 'Picked up' },
  order_details: { uz: 'Buyurtma tafsilotlari', ru: 'Детали заказа', en: 'Order details' },
  ord_placed_at: { uz: 'Berilgan vaqti', ru: 'Оформлен', en: 'Placed' },
  ord_pay_method: { uz: 'To‘lov usuli', ru: 'Способ оплаты', en: 'Payment' },
  ord_pay_state: { uz: 'To‘lov holati', ru: 'Статус оплаты', en: 'Payment status' },
  ord_unpaid: { uz: 'Qabul qilganda', ru: 'При получении', en: 'On delivery' },
  ord_address: { uz: 'Manzil', ru: 'Адрес', en: 'Address' },
  ord_time: { uz: 'Yetkazish vaqti', ru: 'Время доставки', en: 'Delivery time' },
  ord_phone: { uz: 'Telefon', ru: 'Телефон', en: 'Phone' },
  ord_note: { uz: 'Izoh', ru: 'Комментарий', en: 'Note' },
  ord_cancel_reason: { uz: 'Sabab', ru: 'Причина', en: 'Reason' },
  ord_items: { uz: 'Buyurtma tarkibi', ru: 'Состав заказа', en: 'Items' },
  ord_close: { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },

  profile_title: { uz: 'Profil', ru: 'Профиль', en: 'Profile' },
  customer: { uz: 'Mijoz', ru: 'Клиент', en: 'Customer' },
  language: { uz: 'Til', ru: 'Язык', en: 'Language' },
  contacts: { uz: 'Aloqa', ru: 'Контакты', en: 'Contacts' },
  contact_admin: { uz: 'Operator bilan bog‘lanish', ru: 'Связаться с оператором', en: 'Contact the operator' },
  working_hours: { uz: 'Ish vaqti', ru: 'Часы работы', en: 'Working hours' },
  shop_address: { uz: 'Do‘kon manzili', ru: 'Адрес магазина', en: 'Store address' },
  open_map: { uz: 'Xaritada ochish', ru: 'Открыть на карте', en: 'Open on map' },
  website: { uz: 'Rasmiy sayt', ru: 'Официальный сайт', en: 'Official website' },
  delivery_info: { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery' },
  free_from_short: { uz: '{sum} dan bepul', ru: 'бесплатно от {sum}', en: 'free from {sum}' },
  express_short: { uz: 'Tezkor yetkazish', ru: 'Срочная доставка', en: 'Express delivery' },
  our_promise: { uz: 'MELLA kafolati', ru: 'Гарантия MELLA', en: 'The MELLA promise' },
  promise_leather: { uz: '100% tabiiy charm', ru: '100% натуральная кожа', en: '100% genuine leather' },
  promise_craft: { uz: 'Har bir detalga e’tibor', ru: 'Внимание к каждой детали', en: 'Attention to every detail' },
  promise_care: { uz: 'Qabul qilganda ko‘rib to‘lash', ru: 'Оплата после осмотра', en: 'Inspect before you pay' },

  nav_home: { uz: 'Asosiy', ru: 'Главная', en: 'Home' },
  nav_cart: { uz: 'Savat', ru: 'Корзина', en: 'Bag' },
  nav_orders: { uz: 'Buyurtmalar', ru: 'Заказы', en: 'Orders' },
  nav_profile: { uz: 'Profil', ru: 'Профиль', en: 'Profile' },
  open_in_bot: { uz: 'Buyurtma berish uchun do‘konni Telegram bot orqali oching.', ru: 'Чтобы оформить заказ, откройте магазин через Telegram-бот.', en: 'Open the shop via the Telegram bot to place an order.' },
  open_bot: { uz: 'Botga', ru: 'В бот', en: 'Open' },
  error: { uz: 'Xatolik yuz berdi', ru: 'Произошла ошибка', en: 'Something went wrong' },
};
const ST = {
  created: { uz: 'Yangi', ru: 'Новый', en: 'New' },
  confirmed: { uz: 'Tasdiqlandi', ru: 'Подтверждён', en: 'Confirmed' },
  preparing: { uz: 'Qadoqlanmoqda', ru: 'Упаковывается', en: 'Packing' },
  on_way: { uz: 'Yo‘lda', ru: 'В пути', en: 'On the way' },
  delivered: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered' },
  canceled: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Canceled' },
  rejected: { uz: 'Rad etildi', ru: 'Отклонён', en: 'Rejected' },
};
const L = (k) => (I18N[k] && (I18N[k][State.lang] || I18N[k].uz)) || k;
function L2(k, vars) { let s = L(k); Object.keys(vars || {}).forEach((key) => { s = s.split('{' + key + '}').join(vars[key]); }); return s; }
const el = (id) => document.getElementById(id);

/* ── Yordamchilar ── */
window.__imgErr = function (img) { const w = img.parentNode; if (w) { w.innerHTML = '<div class="ph"><span data-ic="bag"></span></div>'; applyIcons(w); } };
function imgHtml(src, eager) { if (src) return `<img src="${escAttr(src)}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" onerror="window.__imgErr(this)">`; return '<div class="ph"><span data-ic="bag"></span></div>'; }
function money(n) {
  let cur = State.config ? State.config.currency : 'so‘m';
  if (/^so[‘'’`]?m$/i.test(cur)) cur = State.lang === 'ru' ? 'сум' : State.lang === 'en' ? 'UZS' : 'so‘m';
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + cur; }
function haptic(t) { try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {} }
function notifyHaptic(t) { try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(t || 'success'); } catch (e) {} }
function toast(msg) { const t = el('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escAttr(s) { return esc(s); }
function openLink(url) { try { if (tg && tg.openLink) tg.openLink(url); else window.open(url, '_blank'); } catch (e) {} }
function isInTelegram() { return !!(tg && tg.initData); }

const MONTHS = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${(MONTHS[State.lang] || MONTHS.uz)[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function api(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const initData = (tg && tg.initData) ? tg.initData : '';
  let url = '/api' + path;
  const sep = () => (url.includes('?') ? '&' : '?');
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
    // Zaxira: ba'zi proksi'lar maxsus header'ni olib tashlaydi.
    if (options.method && options.method !== 'GET') url += sep() + 'tgWebAppData=' + encodeURIComponent(initData);
  }
  url += sep() + 'lang=' + encodeURIComponent(State.lang);
  const res = await fetch(url, Object.assign({}, options, { headers, cache: 'no-store' }));
  if (!res.ok) { let d = L('error'); try { d = (await res.json()).detail || d; } catch (e) {} throw new Error(d); }
  return res.json();
}

/* ═══════════════════════════════════════════════════════════
   SEVIMLILAR — faqat ID'lar (ma'lumot har safar serverdan yangilanadi)
   ═══════════════════════════════════════════════════════════ */
function loadFavorites() { try { const r = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(r) ? r.map(String).filter(Boolean) : []; } catch (e) { return []; } }
function saveFavorites() { localStorage.setItem(FAV_KEY, JSON.stringify(State.favorites)); updateFavBadge(); }
function isFav(id) { return State.favorites.includes(String(id)); }
function toggleFav(id) {
  id = String(id);
  const added = !isFav(id);
  State.favorites = added ? [id, ...State.favorites] : State.favorites.filter((x) => x !== id);
  saveFavorites();
  haptic(added ? 'medium' : 'light');
  toast(L(added ? 'fav_added' : 'fav_removed'));
  return added;
}
function updateFavBadge() { const b = el('favBadge'); if (!b) return; const n = State.favorites.length; b.textContent = n; b.hidden = n === 0; }

async function renderFavorites() {
  const wrap = el('favProducts'), empty = el('emptyFav');
  if (!State.favorites.length) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); return; }
  empty.hidden = true;
  wrap.innerHTML = skeletonCards(Math.min(4, State.favorites.length));
  try {
    const items = await api('/products?ids=' + encodeURIComponent(State.favorites.join(',')));
    const alive = items.map((p) => p.id);
    if (alive.length !== State.favorites.length) { State.favorites = State.favorites.filter((id) => alive.includes(id)); saveFavorites(); }
    if (!items.length) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); return; }
    State.favProducts = items;
    wrap.innerHTML = items.map((p, i) => productCard(p, i)).join('');
    applyIcons(wrap);
    bindCards(wrap, items);
  } catch (e) { wrap.innerHTML = ''; toast(e.message); }
}

/* ═══════════════════════════════════════════════════════════
   SAVAT — kalit: variant (o'lcham) ID
   ═══════════════════════════════════════════════════════════ */
function loadCart() { try { const r = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(r) ? r.filter((x) => x && x.vid && x.qty > 0) : []; } catch (e) { return []; } }
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(State.cart)); updateBadge(); }
function cartQtyVariant(vid) { const it = State.cart.find((x) => x.vid === vid); return it ? it.qty : 0; }
function cartQtyProduct(pid) { return State.cart.filter((x) => x.pid === pid).reduce((s, x) => s + x.qty, 0); }
function cartCount() { return State.cart.reduce((s, x) => s + x.qty, 0); }
function cartItemsTotal() { return State.cart.reduce((s, x) => s + x.price * x.qty, 0); }
function setCartQty(item, qty) {
  const max = item.max > 0 ? item.max : 99;
  const it = State.cart.find((x) => x.vid === item.vid);
  const n = Math.min(max, Math.max(0, qty));
  if (n !== qty && qty > max) toast(L2('max_qty', { n: max }));
  if (it) { if (n <= 0) State.cart = State.cart.filter((x) => x.vid !== item.vid); else it.qty = n; }
  else if (n > 0) State.cart.push(Object.assign({}, item, { qty: n }));
  saveCart(); haptic('light');
}
function changeQty(vid, d) { const it = State.cart.find((x) => x.vid === vid); if (it) setCartQty(it, it.qty + d); }
function updateBadge() { const c = cartCount(); const b = el('navCartBadge'); if (b) { b.textContent = c; b.hidden = c === 0; } updateFabCart(); }
function updateFabCart() {
  const fab = el('fabCart'); if (!fab) return;
  const c = cartCount(); const show = c > 0 && State.view === 'home';
  el('fabCount').textContent = c;
  el('fabTotal').textContent = money(cartItemsTotal());
  fab.classList.toggle('show', show);
  document.body.classList.toggle('has-fab-cart', show);
}

/* Savatni katalog bilan solishtiradi: narx/qoldiq o'zgargan yoki o'chirilgan variantlarni yangilaydi. */
async function refreshCart() {
  const pids = [...new Set(State.cart.map((x) => x.pid))];
  if (!pids.length) return false;
  let changed = false;
  const results = await Promise.all(pids.map((pid) => api('/products/' + encodeURIComponent(pid)).catch(() => null)));
  const byPid = {}; pids.forEach((pid, i) => { byPid[pid] = results[i]; });
  const next = [];
  for (const it of State.cart) {
    const p = byPid[it.pid];
    if (p === undefined) { next.push(it); continue; }
    const v = p && p.variants ? p.variants.find((x) => x.id === it.vid) : null;
    if (!v || !v.in_stock) { changed = true; continue; }
    const qty = Math.min(it.qty, v.stock || it.qty);
    if (v.price !== it.price || qty !== it.qty) changed = true;
    next.push(Object.assign({}, it, { price: v.price, max: v.stock, qty, name: p.name, image: (p.images && p.images[0]) || it.image }));
  }
  State.cart = next; saveCart();
  return changed;
}

/* ═══════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════ */
function renderHero() {
  const wrap = el('heroWrap'); if (!wrap) return;
  const withImg = State.products.find((p) => p.image && p.in_stock) || State.products.find((p) => p.image);
  const img = withImg ? withImg.image : '/images/products/samarqand-1.jpg';
  wrap.innerHTML = `<div class="hero grain">
      <div class="hero-img">${imgHtml(img, true)}</div>
      <div class="hero-body">
        <span class="hero-eyebrow">${L('hero_eyebrow')}</span>
        <h2 class="hero-title">${L('hero_title')}</h2>
        <button class="btn btn-sm hero-cta" id="heroCta">${L('hero_cta')}<span data-ic="arrowRight"></span></button>
      </div>
    </div>`;
  applyIcons(wrap);
  el('heroCta').onclick = () => { haptic('light'); el('catWrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
}

/* ═══════════════════════════════════════════════════════════
   KATEGORIYALAR / SARALASH
   ═══════════════════════════════════════════════════════════ */
function renderCategories() {
  const wrap = el('categories');
  let html = `<button class="cat-chip stagger-chip ${State.currentCategory === null ? 'active' : ''}" style="--i:0" data-cat=""><span class="lbl">${L('all')}</span></button>`;
  html += State.categories.map((c, i) => `<button class="cat-chip stagger-chip ${State.currentCategory === c.id ? 'active' : ''}" style="--i:${i + 1}" data-cat="${escAttr(c.id)}"><span class="lbl">${esc(c.name)}</span><span class="cnt">${c.count}</span></button>`).join('');
  wrap.innerHTML = html;
  wrap.querySelectorAll('.cat-chip').forEach((chip) => chip.onclick = () => {
    State.currentCategory = chip.dataset.cat || null;
    haptic('light'); renderCategories(); loadProducts();
  });
}

const SORTS = [['popular', 'sort_popular', 'flame'], ['new', 'sort_new', 'sparkles'], ['cheap', 'sort_cheap', 'trendDown'], ['expensive', 'sort_expensive', 'trendUp']];
function renderSortbar() {
  const wrap = el('sortbar');
  if (!wrap) return; // saralash qatori olib tashlangan — standart: 'popular'
  wrap.innerHTML = SORTS.map(([key, lbl, ic]) => `<button class="sort-chip ${State.sort === key ? 'active' : ''}" data-sort="${key}"><span data-ic="${ic}"></span>${L(lbl)}</button>`).join('');
  applyIcons(wrap);
  wrap.querySelectorAll('[data-sort]').forEach((b) => b.onclick = () => {
    if (State.sort === b.dataset.sort) return;
    State.sort = b.dataset.sort; haptic('light'); renderSortbar(); loadProducts();
  });
}

/* ═══════════════════════════════════════════════════════════
   MAHSULOTLAR
   ═══════════════════════════════════════════════════════════ */
function skeletonCards(n) { return Array.from({ length: n }).map(() => '<div class="skeleton"><div class="sk-img"></div><div class="sk-line" style="width:45%"></div><div class="sk-line" style="width:80%"></div></div>').join(''); }
function renderProducts() {
  const wrap = el('products'), empty = el('emptyProducts'), cnt = el('productsCount');
  cnt.hidden = !State.products.length; cnt.textContent = L2('count_items', { n: State.products.length });
  if (!State.products.length) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); return; }
  empty.hidden = true;
  wrap.innerHTML = State.products.map((p, i) => productCard(p, i)).join('');
  applyIcons(wrap); bindCards();
}
function discountPct(p) { return p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0; }
function productCard(p, i) {
  const pct = discountPct(p);
  const badge = !p.in_stock ? `<div class="out-badge">${L('out_of_stock')}</div>` : (pct ? `<div class="discount-badge">−${pct}%</div>` : '');
  const fav = `<button type="button" class="fav-badge ${isFav(p.id) ? 'on' : ''}" data-fav="${escAttr(p.id)}" aria-label="${escAttr(L('favorites_title'))}"><span data-ic="heart"></span></button>`;
  let action;
  if (!p.in_stock) action = `<button class="add" disabled>${L('out_of_stock')}</button>`;
  else if (p.single_variant_id && !p.has_variants) {
    const q = cartQtyVariant(p.single_variant_id);
    action = q > 0
      ? `<div class="qty-mini" data-vid="${escAttr(p.single_variant_id)}"><button data-act="dec" aria-label="-"><span data-ic="minus"></span></button><span>${q}</span><button data-act="inc" aria-label="+"><span data-ic="plus"></span></button></div>`
      : `<button class="add" data-add="${escAttr(p.id)}"><span data-ic="plus"></span>${L('add')}</button>`;
  } else {
    const q = cartQtyProduct(p.id);
    action = `<button class="add" data-open="${escAttr(p.id)}">${q > 0 ? `<span data-ic="check"></span>${L('in_cart')} · ${q}` : `<span data-ic="ruler"></span>${L('choose')}`}</button>`;
  }
  const from = p.price_from ? `<span class="from">${L('from')}</span>` : '';
  const old = pct ? `<span class="old">${money(p.old_price)}</span>` : '';
  return `<div class="card stagger-in ${p.in_stock ? '' : 'is-out'}" style="--i:${Math.min(i, 12)}">
    <div class="imgwrap gold-ring" data-open="${escAttr(p.id)}">${badge}${imgHtml(p.image)}</div>${fav}
    <div class="info">
      ${p.category ? `<div class="pcat">${esc(p.category)}</div>` : ''}
      <div class="pname" data-open="${escAttr(p.id)}">${esc(p.name)}</div>
      <div class="price">${State.lang === 'ru' || State.lang === 'en' ? from : ''}${money(p.price)}${State.lang === 'uz' ? from : ''}${old}</div>
      ${action}
    </div></div>`;
}
function cardItem(p) { return { vid: p.single_variant_id, pid: p.id, name: p.name, label: '', price: p.price, image: p.image, max: p.stock }; }
function bindCards(wrap, items) {
  wrap = wrap || el('products'); items = items || State.products;
  const rerender = () => (wrap === el('products') ? renderProducts() : renderFavorites());
  const find = (id) => items.find((x) => x.id === id);
  wrap.querySelectorAll('[data-open]').forEach((c) => c.onclick = (e) => { e.stopPropagation(); openProduct(c.dataset.open); });
  wrap.querySelectorAll('[data-add]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); const p = find(b.dataset.add); if (!p) return;
    setCartQty(cardItem(p), 1); toast(L('added_to_cart')); rerender();
  });
  wrap.querySelectorAll('[data-fav]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); const on = toggleFav(b.dataset.fav); b.classList.toggle('on', on);
    if (wrap !== el('products')) renderFavorites();
  });
  wrap.querySelectorAll('.qty-mini').forEach((q) => {
    const vid = q.dataset.vid;
    const p = items.find((x) => x.single_variant_id === vid);
    q.querySelector('[data-act="inc"]').onclick = (e) => { e.stopPropagation(); if (p) setCartQty(cardItem(p), cartQtyVariant(vid) + 1); rerender(); };
    q.querySelector('[data-act="dec"]').onclick = (e) => { e.stopPropagation(); changeQty(vid, -1); rerender(); };
  });
}

/* ── Mahsulot oynasi: galereya + o'lcham tanlash + miqdor ── */
async function openProduct(id) {
  el('productContent').innerHTML = '<div class="od-loading"><div class="spinner"></div></div>';
  openSheet('sheetProduct');
  let p;
  try { p = await api('/products/' + encodeURIComponent(id)); } catch (e) { closeSheets(); toast(e.message); return; }
  const variants = p.variants || [];
  const hasChoice = variants.length > 1 || (variants[0] && variants[0].label);
  // Savatda bor variant yoki yagona variant oldindan tanlanadi.
  const inCartV = variants.find((v) => cartQtyVariant(v.id) > 0);
  let sel = inCartV || (variants.length === 1 ? variants[0] : null) || (variants.filter((v) => v.in_stock).length === 1 ? variants.find((v) => v.in_stock) : null);
  let qty = sel ? Math.max(1, cartQtyVariant(sel.id) || 1) : 1;

  const images = (p.images && p.images.length) ? p.images : [p.image].filter(Boolean);
  const slides = (images.length ? images : ['']).map((src, i) => `<div class="pd-slide gold-ring">${imgHtml(src, i === 0)}</div>`).join('');
  const dots = images.length > 1 ? `<div class="pd-dots">${images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : '';
  const attrName = p.attribute_name || L('size');

  el('productContent').innerHTML = `
    <div class="pd-gallery">
      <div class="pd-track ${images.length > 1 ? 'multi' : ''}" id="pdTrack">${slides}</div>
      <button type="button" class="fav-badge ${isFav(p.id) ? 'on' : ''}" id="pdFav"><span data-ic="heart"></span></button>
      ${dots}
    </div>
    <div class="pd-tags">${p.category ? `<span class="tag">${esc(p.category)}</span>` : ''}<span id="pdSale"></span></div>
    <div class="pd-name">${esc(p.name)}</div>
    <div class="pd-price-row"><span class="pd-price" id="pdPrice"></span><span class="pd-old" id="pdOld"></span></div>
    ${p.sku ? `<div class="pd-sku">${esc(p.sku)}${p.brand ? ' · ' + esc(p.brand) : ''}</div>` : ''}
    ${hasChoice ? `<div class="var-block" id="varBlock">
      <div class="var-head"><span class="var-title">${esc(attrName)}</span><span class="var-hint" id="varHint"></span></div>
      <div class="var-list">${variants.map((v) => `<button type="button" class="var-chip ${v.in_stock ? '' : 'out'}" data-vid="${escAttr(v.id)}" ${v.in_stock ? '' : 'disabled'}>${esc(v.label || '—')}</button>`).join('')}</div>
    </div>` : ''}
    <div id="pdStock"></div>
    ${p.description ? `<div class="pd-desc">${esc(p.description)}</div>` : ''}
    <div style="height:14px"></div>
    <div class="stepper" id="pdStepper" ${p.in_stock ? '' : 'hidden'}>
      <span class="st-lbl">${L('qty_label')}</span>
      <span class="st-ctl"><button type="button" id="pdMinus"><span data-ic="minus"></span></button><span class="st-val" id="pdQty">1</span><button type="button" id="pdPlus"><span data-ic="plus"></span></button></span>
    </div>
    <button class="btn" id="pdAdd" ${p.in_stock ? '' : 'disabled'}><span data-ic="bag"></span><span id="pdAddLbl"></span></button>`;
  applyIcons(el('productContent'));

  // Galereya nuqtalari
  const track = el('pdTrack');
  if (images.length > 1) {
    track.onscroll = () => {
      const w = track.firstElementChild ? track.firstElementChild.offsetWidth + 10 : 1;
      const idx = Math.round(track.scrollLeft / w);
      document.querySelectorAll('.pd-dots span').forEach((d, i) => d.classList.toggle('active', i === idx));
    };
  }
  el('pdFav').onclick = () => { const on = toggleFav(p.id); el('pdFav').classList.toggle('on', on); if (State.view === 'home') renderProducts(); };

  const sync = () => {
    const v = sel;
    const price = v ? v.price : p.price;
    const oldP = v ? v.old_price : p.old_price;
    el('pdPrice').textContent = (!v && p.price_from ? (State.lang === 'uz' ? '' : L('from') + ' ') : '') + money(price) + (!v && p.price_from && State.lang === 'uz' ? ' ' + L('from') : '');
    el('pdOld').textContent = oldP && oldP > price ? money(oldP) : '';
    const pct = oldP && oldP > price ? Math.round((1 - price / oldP) * 100) : 0;
    el('pdSale').innerHTML = pct ? `<span class="tag solid">−${pct}% · ${L('sale')}</span>` : '';
    document.querySelectorAll('.var-chip').forEach((c) => c.classList.toggle('active', !!v && c.dataset.vid === v.id));
    const hint = el('varHint');
    if (hint) { hint.textContent = v ? (v.label || '') : L('choose_size'); hint.classList.toggle('warn', !v); }
    const stockBox = el('pdStock');
    if (!p.in_stock) stockBox.innerHTML = `<div class="pd-meta out"><span data-ic="alert"></span>${L('out_of_stock')}</div>`;
    else if (v && v.stock > 0 && v.stock <= 3) stockBox.innerHTML = `<div class="pd-meta low"><span data-ic="flame"></span>${L2('low_stock', { n: v.stock })}</div>`;
    else stockBox.innerHTML = `<div class="pd-meta"><span data-ic="checkCircle"></span>${L('in_stock')}</div>`;
    applyIcons(stockBox);
    if (p.in_stock) {
      el('pdQty').textContent = qty;
      el('pdMinus').disabled = qty <= 1;
      el('pdPlus').disabled = !!v && qty >= v.stock;
      el('pdAddLbl').textContent = v ? `${L('add')} · ${money(price * qty)}` : L('choose_size');
    }
  };
  document.querySelectorAll('.var-chip').forEach((c) => c.onclick = () => {
    const v = variants.find((x) => x.id === c.dataset.vid); if (!v || !v.in_stock) return;
    sel = v; qty = Math.max(1, Math.min(cartQtyVariant(v.id) || qty, v.stock)); haptic('light'); sync();
  });
  if (p.in_stock) {
    el('pdMinus').onclick = () => { if (qty > 1) { qty -= 1; haptic('light'); sync(); } };
    el('pdPlus').onclick = () => { const max = sel ? sel.stock : 99; if (qty < max) { qty += 1; haptic('light'); sync(); } else toast(L2('max_qty', { n: max })); };
    el('pdAdd').onclick = () => {
      if (!sel) {
        const vb = el('varBlock'); if (vb) { vb.classList.remove('shake'); void vb.offsetWidth; vb.classList.add('shake'); }
        notifyHaptic('warning'); toast(L('choose_variant_first')); return;
      }
      // Oynadagi miqdor savatdagi sonni ALMASHTIRADI (stepper savatdagi sonni ko'rsatadi).
      State.cart = State.cart.filter((x) => x.vid !== sel.id);
      setCartQty({ vid: sel.id, pid: p.id, name: p.name, label: sel.label, price: sel.price, image: images[0] || '', max: sel.stock }, qty);
      closeSheets(); notifyHaptic('success'); toast(`${L('added_to_cart')} · ${qty}`);
      if (State.view === 'home') renderProducts(); else if (State.view === 'favorites') renderFavorites(); else if (State.view === 'cart') renderCart();
    };
  }
  sync();
}

/* ═══════════════════════════════════════════════════════════
   SAVAT SAHIFASI
   ═══════════════════════════════════════════════════════════ */
function freeProgressHtml(itemsTotal) {
  const from = (State.config && State.config.free_delivery_from) || 0;
  if (!from || !(State.config.delivery_fee > 0)) return '';
  const done = itemsTotal >= from;
  const pct = Math.min(100, Math.round((itemsTotal / from) * 100));
  const label = done ? L('free_done') : L2('free_left', { sum: money(from - itemsTotal) });
  return `<div class="free-prog ${done ? 'done' : ''}"><div class="fp-top"><span data-ic="${done ? 'gift' : 'truck'}"></span><span>${label}</span></div><div class="fp-bar"><div class="fp-fill" style="width:${pct}%"></div></div></div>`;
}
function renderCart() {
  const wrap = el('cartItems'), empty = el('cartEmpty'), footer = el('cartFooter'), sub = el('cartSub');
  if (!State.cart.length) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); footer.innerHTML = ''; sub.hidden = true; return; }
  empty.hidden = true; sub.hidden = false; sub.textContent = L2('count_items', { n: cartCount() });
  wrap.innerHTML = State.cart.map((it, i) => `<div class="cart-item" style="--i:${i}">
      <div class="ci-img" data-open="${escAttr(it.pid)}">${imgHtml(it.image)}</div>
      <div class="ci-info"><div class="ci-name">${esc(it.name)}</div>${it.label ? `<span class="ci-var">${esc(it.label)}</span>` : ''}<div class="ci-price">${money(it.price * it.qty)}</div></div>
      <div class="qty"><button data-inc="${escAttr(it.vid)}" ${it.max && it.qty >= it.max ? 'disabled' : ''}><span data-ic="plus"></span></button><span>${it.qty}</span><button data-dec="${escAttr(it.vid)}"><span data-ic="${it.qty > 1 ? 'minus' : 'trash'}"></span></button></div>
    </div>`).join('');
  applyIcons(wrap);
  wrap.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => openProduct(b.dataset.open));
  wrap.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => { changeQty(b.dataset.inc, 1); renderCart(); });
  wrap.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => { changeQty(b.dataset.dec, -1); renderCart(); });

  const c = State.config || {};
  const itemsTotal = cartItemsTotal(), min = c.min_order_amount || 0, belowMin = min > 0 && itemsTotal < min;
  footer.innerHTML = `<div class="cf-inner">${freeProgressHtml(itemsTotal)}
    <div class="sum-row"><span>${L('items_total')}</span><b>${money(itemsTotal)}</b></div>
    <div class="sum-row total"><span>${L('total')}</span><span>${money(itemsTotal)}</span></div>
    ${belowMin ? `<div class="min-warn">${L('min_order')}: ${money(min)}</div>` : ''}
    <button class="btn" id="goCheckout" ${belowMin ? 'disabled' : ''}>${L('checkout')}<span data-ic="arrowRight"></span></button></div>`;
  applyIcons(footer);
  const go = el('goCheckout');
  if (go && !belowMin) go.onclick = () => {
    if (!isInTelegram() && !(State.config && State.config.dev)) { toast(L('open_in_bot')); return; }
    haptic('medium'); openCheckout();
  };
}

/* ═══════════════════════════════════════════════════════════
   YANDEX XARITA
   ═══════════════════════════════════════════════════════════ */
function ymLang() { return State.lang === 'en' ? 'en_US' : (State.lang === 'uz' ? 'uz_UZ' : 'ru_RU'); }
function loadYandexMaps() {
  if (window.ymaps && window.ymaps.Map) return Promise.resolve();
  if (_ymapsPromise) return _ymapsPromise;
  const key = State.config && State.config.maps_api_key;
  if (!key) return Promise.reject(new Error('no_key'));
  _ymapsPromise = new Promise((resolve, reject) => {
    const fail = (e) => { _ymapsPromise = null; reject(e || new Error('load')); };
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${ymLang()}`;
    s.async = true;
    s.onload = () => { if (window.ymaps && window.ymaps.ready) window.ymaps.ready(resolve); else fail(new Error('no_ymaps')); };
    s.onerror = () => fail(new Error('script_error'));
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.ymaps && window.ymaps.Map)) fail(new Error('timeout')); }, 15000);
  });
  return _ymapsPromise;
}
function initAddressMap(node) {
  if (!node || !window.ymaps) return;
  const start = (State._pickLat && State._pickLng) ? [State._pickLat, State._pickLng] : [TASHKENT.lat, TASHKENT.lng];
  State._map = new ymaps.Map(node, { center: start, zoom: 15, controls: [] }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
  State._map.events.add('boundschange', () => { clearTimeout(State._geoT); State._geoT = setTimeout(reverseGeocodeCenter, 450); });
  setTimeout(() => { try { State._map && State._map.container.fitToViewport(); } catch (e) {} }, 250);
  reverseGeocodeCenter();
}
function reverseGeocodeCenter() {
  if (!State._map || !window.ymaps) return;
  const c = State._map.getCenter();
  State._pickLat = c[0]; State._pickLng = c[1];
  ymaps.geocode(c, { results: 1 }).then((res) => {
    const obj = res.geoObjects.get(0);
    const addr = obj ? obj.getAddressLine() : '';
    State._pickAddr = addr;
    const inp = el('afAddress'); if (inp && addr) inp.value = addr;
  }).catch(() => {});
}
function locateMe(btn) {
  if (!navigator.geolocation) { toast(L('loc_fail')); return; }
  btn && btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(
    (pos) => { if (State._map) { State._map.setCenter([pos.coords.latitude, pos.coords.longitude], 17); haptic('medium'); } btn && btn.classList.remove('busy'); },
    () => { btn && btn.classList.remove('busy'); toast(L('loc_fail')); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

/* ═══════════════════════════════════════════════════════════
   CHECKOUT — IKKI QADAM (Gunesh): 1) yetkazish  2) to'lov
   Ikkala qadam DOM'da qoladi — orqaga qaytganda xarita/manzil saqlanadi.
   ═══════════════════════════════════════════════════════════ */
function deliveryFeeFor(total, type, express) {
  const c = State.config || {};
  if (type !== 'delivery') return 0;
  let f = c.delivery_fee || 0;
  if (c.free_delivery_from && total >= c.free_delivery_from) f = 0;
  if (express) f += c.express_delivery_fee || 0;
  return f;
}
function summaryHtml(type, express) {
  const itemsTotal = cartItemsTotal(), fee = deliveryFeeFor(itemsTotal, type, express);
  return `<div class="ck-summary"><div class="sum-row"><span>${L('items_total')}</span><b>${money(itemsTotal)}</b></div>${type === 'delivery' ? `<div class="sum-row"><span>${L('delivery_fee')}</span><b class="${fee ? '' : 'sum-free'}">${fee ? money(fee) : L('free')}</b></div>` : ''}<div class="sum-row total"><span>${L('total')}</span><span>${money(itemsTotal + fee)}</span></div></div>`;
}
function openCheckout() {
  const c = State.config || {};
  const hasMap = !!c.maps_api_key;
  State._deliveryType = 'delivery'; State._express = false; State._payment = 'cash'; State._mapOk = false;
  const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
  const defName = c.user_name || [u.first_name, u.last_name].filter(Boolean).join(' ');
  const exFee = c.express_delivery_fee || 0;

  el('checkoutTitle').hidden = false;
  el('checkoutContent').innerHTML = `
    <div class="ck-step-bar"><span class="ck-crumb active" data-s="1"><b>1</b>${L('step_delivery')}</span><span class="ck-crumb-sep"></span><span class="ck-crumb" data-s="2"><b>2</b>${L('step_payment')}</span></div>
    <div id="ckStep1">
      ${c.allow_pickup !== false ? `<div class="field"><span class="lbl">${L('delivery_type')}</span>
        <div class="seg" id="segDelivery"><button class="active" data-v="delivery"><span data-ic="truck"></span>${L('delivery')}</button><button data-v="pickup"><span data-ic="store"></span>${L('pickup')}</button></div></div>` : ''}
      <div id="addrBlock">
        <div class="map-wrap" id="mapWrap"><div id="mapEl"></div><div class="map-pin">${MAP_PIN_SVG}</div><button type="button" class="map-locate" id="locBtn"><span data-ic="locate"></span></button><div id="mapLoading" class="map-loading"><div class="spinner"></div></div></div>
        <p class="map-hint" id="mapHint">${L('map_hint')}</p>
        <div id="mapNote" class="map-warn" hidden><span data-ic="alert"></span><span>${L('map_note')}</span></div>
        <div class="field"><label for="afAddress">${L('address_label')}</label><input id="afAddress" placeholder="${escAttr(L('address_ph'))}" autocomplete="street-address" /></div>
        <div class="field"><input id="afLandmark" placeholder="${escAttr(L('landmark'))}" /></div>
        <div class="field"><span class="lbl">${L('delivery_time')}</span><div class="time-slots" id="timeSlots">
          <button type="button" class="slot active" data-express="0">${L('deliv_day')}</button>
          <button type="button" class="slot" data-express="1"><span>${L('asap')}${exFee ? ' · +' + money(exFee) : ''}</span></button>
        </div></div>
      </div>
      <div id="pickupBlock" hidden>
        <div class="ck-summary"><div class="prof-row" style="border:0;padding:0"><span class="pr-ic"><span data-ic="store"></span></span><div class="pr-text">${L('pickup_from')}<small>${esc(c.shop_address || '')}${c.working_hours ? ' · ' + esc(c.working_hours) : ''}</small></div></div></div>
      </div>
      <div class="field"><span class="lbl">${L('contact_label')}</span>
        <input id="ckName" placeholder="${escAttr(L('name_ph'))}" value="${escAttr(defName)}" autocomplete="name" style="margin-bottom:8px" />
        <div class="field-row"><input id="ckPhone" type="tel" inputmode="tel" placeholder="${escAttr(L('phone_ph'))}" value="${escAttr(c.user_phone || '')}" autocomplete="tel" />
        ${tg && tg.requestContact ? `<button type="button" class="tg-phone-btn" id="ckPhoneTg"><span data-ic="phone"></span>${L('share_phone')}</button>` : ''}</div>
      </div>
      <div class="field"><label for="ckNote">${L('note')}</label><textarea id="ckNote" maxlength="600"></textarea></div>
      <div id="ckSummary"></div>
      <button class="btn" id="goPayment">${L('to_payment')}<span data-ic="arrowRight"></span></button>
    </div>
    <div id="ckStep2" hidden></div>`;
  applyIcons(el('checkoutContent'));

  const setType = (v) => {
    State._deliveryType = v;
    document.querySelectorAll('#segDelivery button').forEach((x) => x.classList.toggle('active', x.dataset.v === v));
    el('addrBlock').style.display = v === 'delivery' ? '' : 'none';
    el('pickupBlock').hidden = v !== 'pickup';
    el('ckSummary').innerHTML = summaryHtml(v, State._express);
    if (v === 'delivery' && State._map) setTimeout(() => { try { State._map.container.fitToViewport(); } catch (e) {} }, 60);
  };
  document.querySelectorAll('#segDelivery button').forEach((b) => b.onclick = () => { haptic('light'); setType(b.dataset.v); });
  document.querySelectorAll('#timeSlots .slot').forEach((b) => b.onclick = () => {
    document.querySelectorAll('#timeSlots .slot').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); State._express = b.dataset.express === '1'; haptic('light');
    el('ckSummary').innerHTML = summaryHtml(State._deliveryType, State._express);
  });
  const tgBtn = el('ckPhoneTg');
  if (tgBtn) tgBtn.onclick = () => {
    try {
      tg.requestContact((ok, res) => {
        if (!ok) return;
        const ph = res && res.responseUnsafe && res.responseUnsafe.contact && res.responseUnsafe.contact.phone_number;
        if (ph) { el('ckPhone').value = (String(ph).startsWith('+') ? '' : '+') + ph; notifyHaptic('success'); return; }
        // Eski klientlar: raqam botga keladi — serverdan qayta o'qiymiz.
        setTimeout(async () => { try { const cfg = await api('/config'); if (cfg.user_phone) el('ckPhone').value = cfg.user_phone; } catch (e) {} }, 1500);
      });
    } catch (e) {}
  };
  el('goPayment').onclick = goToPaymentStep;
  setType('delivery');
  openSheet('sheetCheckout');

  // Xarita: yuklanmasa yetkazishni bloklamaymiz — manzil matn bilan yoziladi.
  let settled = false;
  const settle = (ok) => {
    if (settled) return; settled = true; State._mapOk = ok;
    const ld = el('mapLoading'); if (ld) ld.style.display = 'none';
    if (!ok) { const w = el('mapWrap'); if (w) w.style.display = 'none'; const h = el('mapHint'); if (h) h.style.display = 'none'; const n = el('mapNote'); if (n) n.hidden = false; }
  };
  if (!hasMap) { settle(false); return; }
  const locBtn = el('locBtn'); if (locBtn) locBtn.onclick = () => locateMe(locBtn);
  loadYandexMaps().then(() => {
    const tryInit = (attempt) => {
      if (settled) return;
      const node = el('mapEl');
      if (node && !State._map) { try { initAddressMap(node); } catch (e) { console.error('map init', e); } }
      if (State._map && node && node.children.length > 0) { settle(true); return; }
      if (attempt < 5) { setTimeout(() => tryInit(attempt + 1), 400); return; }
      settle(false);
    };
    requestAnimationFrame(() => setTimeout(() => tryInit(0), 100));
  }).catch(() => settle(false));
}

function showCheckoutStep(n) {
  el('ckStep1').hidden = n !== 1; el('ckStep2').hidden = n !== 2;
  document.querySelectorAll('.ck-crumb').forEach((c) => c.classList.toggle('active', Number(c.dataset.s) <= n));
  const card = document.querySelector('#sheetCheckout .sheet-card'); if (card) card.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToPaymentStep() {
  const type = State._deliveryType;
  if (!State.cart.length) { toast(L('cart_empty')); return; }
  let address = '', lat = null, lng = null;
  if (type === 'delivery') {
    const base = el('afAddress').value.trim() || State._pickAddr || '';
    const lm = el('afLandmark').value.trim();
    address = [base, lm].filter(Boolean).join(', ');
    if (!base) { toast(L('need_address')); el('afAddress').focus(); notifyHaptic('error'); return; }
    if (State._mapOk) { lat = State._pickLat; lng = State._pickLng; }
  }
  const phone = el('ckPhone').value.trim();
  if (phone.replace(/\D/g, '').length < 9) { toast(L('need_phone')); el('ckPhone').focus(); notifyHaptic('error'); return; }
  State._checkoutData = { type, address, lat, lng, express: type === 'delivery' && State._express, note: el('ckNote').value.trim(), phone, name: el('ckName').value.trim() };

  const c = State.config || {};
  const methods = (c.payment_methods || [{ id: 'cash', enabled: true }]);
  const click = methods.find((m) => m.id === 'click');
  const step2 = el('ckStep2');
  step2.innerHTML = `
    <button type="button" class="ck-back" id="ckBack"><span data-ic="arrowLeft"></span>${L('back')}</button>
    <h3 class="ck-pay-title">${L('choose_payment')}</h3>
    <div class="pay-methods" id="payMethods">
      <button type="button" class="pay-card active" data-pay="cash"><span class="pay-badge cash"><span data-ic="cash"></span></span><span class="pay-main"><b>${L('pay_cash')}</b><small>${L('pay_cash_hint')}</small></span><span class="pay-check"><span data-ic="checkCircle"></span></span></button>
      <button type="button" class="pay-card" data-pay="click" style="--pay-hue:#1e6be6" ${click && click.enabled ? '' : 'disabled'}><span class="pay-badge">C</span><span class="pay-main"><b>${L('pay_click')}${click && click.enabled ? '' : `<span class="pay-soon">${L('soon')}</span>`}</b><small>${L('pay_click_hint')}</small></span><span class="pay-check"><span data-ic="checkCircle"></span></span></button>
    </div>
    <div style="height:16px"></div>
    ${summaryHtml(type, State._checkoutData.express)}
    <button class="btn" id="submitOrder"><span data-ic="check"></span>${L('confirm_order')}</button>`;
  applyIcons(step2);
  step2.querySelectorAll('.pay-card').forEach((b) => b.onclick = () => {
    if (b.disabled) return;
    State._payment = b.dataset.pay; haptic('light');
    step2.querySelectorAll('.pay-card').forEach((x) => x.classList.toggle('active', x === b));
  });
  el('ckBack').onclick = () => { haptic('light'); showCheckoutStep(1); };
  el('submitOrder').onclick = submitOrder;
  showCheckoutStep(2);
}

async function submitOrder() {
  const d = State._checkoutData; if (!d) return;
  const btn = el('submitOrder'); btn.disabled = true; btn.textContent = L('saving');
  const body = {
    items: State.cart.map((x) => ({ variant_id: x.vid, qty: x.qty })),
    delivery_type: d.type, address: d.address, lat: d.lat, lng: d.lng,
    express: d.express, note: d.note, payment_method: State._payment, phone: d.phone, name: d.name,
  };
  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify(body) });
    State.cart = []; saveCart(); notifyHaptic('success');
    showOrderSuccess(order);
    if (State.view === 'cart') renderCart();
    renderProducts();
  } catch (e) {
    toast(e.message); notifyHaptic('error');
    btn.disabled = false; btn.innerHTML = `<span data-ic="check"></span>${L('confirm_order')}`; applyIcons(btn);
    // Qoldiq/narx o'zgargan bo'lishi mumkin — savatni yangilaymiz.
    refreshCart().then((ch) => { if (ch) { renderCart(); } }).catch(() => {});
  }
}

function showOrderSuccess(order) {
  destroyMap();
  el('checkoutTitle').hidden = true;
  el('checkoutContent').innerHTML = `
    <div class="order-success">
      <div class="os-check"><span data-ic="check"></span></div>
      <h3>${L('order_accepted')}</h3>
      <p class="os-num">№ ${order.order_number} · ${money(order.grand_total)}</p>
      <div class="os-hint">${L('order_cash_hint')}</div>
      <button class="btn" id="osOrders"><span data-ic="receipt"></span>${L('my_orders')}</button>
      <button class="btn btn-ghost" id="osShop">${L('continue_shopping')}</button>
    </div>`;
  applyIcons(el('checkoutContent'));
  el('osOrders').onclick = () => { closeSheets(); switchView('orders'); };
  el('osShop').onclick = () => { closeSheets(); switchView('home'); };
}

/* ═══════════════════════════════════════════════════════════
   BUYURTMALAR — timeline bilan
   ═══════════════════════════════════════════════════════════ */
function timelineHtml(o) {
  if (o.status === 'canceled' || o.status === 'rejected') return '';
  const steps = o.delivery_type === 'pickup' ? ['created', 'confirmed', 'preparing', 'delivered'] : ['created', 'confirmed', 'preparing', 'on_way', 'delivered'];
  const cur = steps.indexOf(o.status);
  if (cur < 0) return '';
  const finished = o.status === 'delivered';
  return `<div class="otl">${steps.map((s, i) => {
    const done = finished || i < cur;
    const cls = done ? 'done' : (i === cur ? 'current' : '');
    const lbl = s === 'delivered' && o.delivery_type === 'pickup' ? L('tl_handed') : L('tl_' + s);
    return `<div class="otl-step ${cls}"><span class="otl-dot">${done ? '<span data-ic="check"></span>' : ''}</span><span class="otl-lbl">${lbl}</span></div>`;
  }).join('')}</div>`;
}
function statusLabel(o) {
  if (o.status === 'delivered' && o.delivery_type === 'pickup') return L('tl_handed');
  return (ST[o.status] && ST[o.status][State.lang]) || o.status;
}
async function loadOrders() {
  const wrap = el('ordersList'), empty = el('emptyOrders');
  empty.hidden = true;
  wrap.innerHTML = Array.from({ length: 3 }).map(() => '<div class="sk-block" style="height:150px"></div>').join('');
  if (!isInTelegram() && !(State.config && State.config.dev)) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); return; }
  try {
    const orders = await api('/orders');
    if (!orders.length) { wrap.innerHTML = ''; empty.hidden = false; applyIcons(empty); return; }
    wrap.innerHTML = orders.map((o, i) => {
      const thumbs = o.items.slice(0, 4).map((it) => `<span class="th">${imgHtml(it.image)}</span>`).join('') + (o.items.length > 4 ? `<span class="th more">+${o.items.length - 4}</span>` : '');
      const names = o.items.map((it) => `${esc(it.name)}${it.variant ? ' (' + esc(it.variant) + ')' : ''} ×${it.qty}`).join(', ');
      return `<button type="button" class="order-card" data-oid="${o.id}" style="--i:${i}">
        <div class="order-head"><div><div class="order-num">№ ${o.order_number}</div><div class="order-date">${esc(shortDate(o.created_at))}</div></div><span class="order-status st-${o.status}">${esc(statusLabel(o))}</span></div>
        ${timelineHtml(o)}
        <div class="order-thumbs">${thumbs}</div>
        <div class="order-items-mini">${names}</div>
        <div class="order-total">${money(o.grand_total)}${o.is_paid ? `<span class="order-paid"><span data-ic="check"></span>${L('paid')}</span>` : ''}<span class="order-open" data-ic="chevron"></span></div>
      </button>`;
    }).join('');
    applyIcons(wrap);
    wrap.querySelectorAll('.order-card').forEach((b) => b.onclick = () => { haptic('light'); openOrderDetail(Number(b.dataset.oid)); });
  } catch (e) { wrap.innerHTML = ''; toast(e.message); }
}
async function openOrderDetail(id) {
  const box = el('orderContent');
  box.innerHTML = '<div class="od-loading"><div class="spinner"></div></div>';
  openSheet('sheetOrder');
  try {
    const o = await api('/orders/' + id);
    const canceled = o.status === 'canceled' || o.status === 'rejected';
    const row = (ic, label, value) => `<div class="od-row"><span class="odr-ic" data-ic="${ic}"></span><div class="odr-body"><small>${label}</small><span>${value}</span></div></div>`;
    const payState = o.is_paid ? `<span class="pill pill-ok"><span data-ic="check"></span>${L('paid')}</span>` : `<span class="pill pill-warn">${L('ord_unpaid')}</span>`;
    box.innerHTML = `
      <header class="od-head"><h2>${L('order_details')}</h2><span class="order-num">№ ${o.order_number}</span><span class="order-status st-${o.status}">${esc(statusLabel(o))}</span></header>
      ${canceled ? '' : timelineHtml(o)}
      ${canceled && o.cancel_reason ? `<div class="od-reason"><div class="odr-title"><span data-ic="alert"></span>${L('ord_cancel_reason')}</div><div class="odr-text">${esc(o.cancel_reason)}</div></div>` : ''}
      <div class="od-meta">
        ${row('clock', L('ord_placed_at'), esc(shortDate(o.created_at)))}
        ${row('cash', L('ord_pay_method'), o.payment_method === 'click' ? 'Click' : L('pay_cash'))}
        ${row('check', L('ord_pay_state'), payState)}
        ${row(o.delivery_type === 'delivery' ? 'truck' : 'store', L('delivery_type'), o.delivery_type === 'delivery' ? L('delivery') : L('pickup'))}
        ${o.delivery_type === 'delivery' && o.address ? row('pin', L('ord_address'), esc(o.address)) : ''}
        ${o.delivery_type === 'delivery' && o.delivery_time ? row('zap', L('ord_time'), o.delivery_time === 'express' ? L('asap') : L('deliv_day')) : ''}
        ${o.phone ? row('phone', L('ord_phone'), esc(o.phone)) : ''}
        ${o.note ? row('message', L('ord_note'), esc(o.note)) : ''}
      </div>
      <div class="od-section-title">${L('ord_items')}</div>
      <div class="od-items">${o.items.map((it) => `<div class="od-item"><span class="th">${imgHtml(it.image)}</span><div class="odi-main"><b>${esc(it.name)}</b><small>${it.variant ? esc(it.variant) + ' · ' : ''}${it.qty} × ${money(it.price)}</small></div><div class="odi-total">${money(it.line_total)}</div></div>`).join('')}</div>
      <div class="ck-summary"><div class="sum-row"><span>${L('items_total')}</span><b>${money(o.items_total)}</b></div>${o.delivery_type === 'delivery' ? `<div class="sum-row"><span>${L('delivery_fee')}</span><b class="${o.delivery_fee ? '' : 'sum-free'}">${o.delivery_fee ? money(o.delivery_fee) : L('free')}</b></div>` : ''}<div class="sum-row total"><span>${L('total')}</span><span>${money(o.grand_total)}</span></div></div>
      <button class="btn btn-ghost" data-close-sheet>${L('ord_close')}</button>`;
    applyIcons(box);
    box.querySelectorAll('[data-close-sheet]').forEach((b) => b.onclick = closeSheets);
  } catch (e) {
    box.innerHTML = `<div class="od-err"><span data-ic="alert"></span><span>${esc(e.message)}</span></div>`; applyIcons(box);
  }
}

/* ═══════════════════════════════════════════════════════════
   PROFIL
   ═══════════════════════════════════════════════════════════ */
function renderProfile() {
  const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
  const c = State.config || {};
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || c.user_name || L('customer');
  const initial = (name.trim()[0] || 'M').toUpperCase();
  const langs = [['uz', 'O‘zbek'], ['ru', 'Русский'], ['en', 'English']];
  const row = (ic, text, sub, link) => link
    ? `<button class="prof-row link" data-open-link="${escAttr(link)}"><span class="pr-ic" data-ic="${ic}"></span><div class="pr-text">${text}${sub ? `<small>${sub}</small>` : ''}</div><span class="pr-go" data-ic="arrowRight"></span></button>`
    : `<div class="prof-row"><span class="pr-ic" data-ic="${ic}"></span><div class="pr-text">${text}${sub ? `<small>${sub}</small>` : ''}</div></div>`;

  const contacts = [];
  if (c.phone) contacts.push(`<a class="prof-row link" href="tel:${escAttr(String(c.phone).replace(/[^\d+]/g, ''))}"><span class="pr-ic" data-ic="phone"></span><div class="pr-text">${esc(c.phone)}</div><span class="pr-go" data-ic="arrowRight"></span></a>`);
  if (c.admin_contact) contacts.push(row('message', L('contact_admin'), '@' + esc(c.admin_contact), 'https://t.me/' + c.admin_contact));
  if (c.working_hours) contacts.push(row('clock', L('working_hours'), esc(c.working_hours)));
  if (c.shop_address || (c.shop_lat && c.shop_lng)) contacts.push(row('map', L('shop_address'), esc(c.shop_address || L('open_map')), c.shop_lat && c.shop_lng ? `https://yandex.uz/maps/?pt=${c.shop_lng},${c.shop_lat}&z=17&l=map` : ''));
  if (c.instagram) contacts.push(row('instagram', 'Instagram', esc(String(c.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')), c.instagram));
  if (c.site_url) contacts.push(row('globe', L('website'), esc(c.site_url.replace(/^https?:\/\//, '')), c.site_url));

  const deliv = [row('truck', L('delivery_fee'), c.delivery_fee ? money(c.delivery_fee) : L('free'))];
  if (c.free_delivery_from > 0 && c.delivery_fee > 0) deliv.push(row('gift', L('free'), L2('free_from_short', { sum: money(c.free_delivery_from) })));
  if (c.express_delivery_fee > 0) deliv.push(row('zap', L('express_short'), '+' + money(c.express_delivery_fee)));
  if (c.min_order_amount > 0) deliv.push(row('bag', L('min_order'), money(c.min_order_amount)));

  el('profileContent').innerHTML = `<div class="profile">
    <div class="prof-card hero-card grain" style="--i:0"><div class="prof-head"><div class="prof-avatar">${esc(initial)}</div><div><div class="prof-name">${esc(name)}</div><div class="prof-phone">${esc(c.user_phone || (user.username ? '@' + user.username : ''))}</div></div></div></div>
    <div class="prof-card" style="--i:1"><div class="prof-section-title">${L('language')}</div><div class="lang-row">${langs.map((l) => `<button class="lang-pick ${State.lang === l[0] ? 'active' : ''}" data-lang="${l[0]}">${l[1]}</button>`).join('')}</div></div>
    ${contacts.length ? `<div class="prof-card" style="--i:2"><div class="prof-section-title">${L('contacts')}</div>${contacts.join('')}</div>` : ''}
    <div class="prof-card" style="--i:3"><div class="prof-section-title">${L('delivery_info')}</div>${deliv.join('')}</div>
    <div class="prof-card" style="--i:4"><div class="prof-section-title">${L('our_promise')}</div>${row('sparkles', L('promise_leather'))}${row('ruler', L('promise_craft'))}${row('shield', L('promise_care'))}</div>
    <div class="prof-foot">MELLA · ${L('brand_tagline')}</div>
  </div>`;
  applyIcons(el('profileContent'));
  el('profileContent').querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { haptic('light'); setLang(b.dataset.lang); renderProfile(); });
  el('profileContent').querySelectorAll('[data-open-link]').forEach((b) => { if (b.dataset.openLink) b.onclick = () => openLink(b.dataset.openLink); });
}

/* ═══════════════════════════════════════════════════════════
   SHEET / NAV / TIL
   ═══════════════════════════════════════════════════════════ */
function destroyMap() { try { if (State._map && State._map.destroy) State._map.destroy(); } catch (e) {} State._map = null; }
function openSheet(id) { el(id).classList.add('open'); document.body.style.overflow = 'hidden'; if (tg && tg.BackButton) tg.BackButton.show(); }
function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open'));
  document.body.style.overflow = '';
  destroyMap();
  if (tg && tg.BackButton) { if (State.view === 'favorites') tg.BackButton.show(); else tg.BackButton.hide(); }
}
function anySheetOpen() { return !!document.querySelector('.sheet.open'); }

function switchView(view) {
  State.view = view;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  el('view-' + view).classList.add('active');
  el('tbFav').classList.toggle('on', view === 'favorites');
  if (view === 'home') renderProducts();
  if (view === 'cart') { renderCart(); refreshCart().then((ch) => { if (ch) { toast(L('cart_updated')); if (State.view === 'cart') renderCart(); } }).catch(() => {}); }
  if (view === 'favorites') renderFavorites();
  if (view === 'orders') loadOrders();
  if (view === 'profile') renderProfile();
  if (tg && tg.BackButton) { if (view === 'favorites') tg.BackButton.show(); else if (!anySheetOpen()) tg.BackButton.hide(); }
  updateFabCart();
  window.scrollTo(0, 0);
}

function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((n) => { const k = n.getAttribute('data-i18n'); if (I18N[k]) n.textContent = L(k); });
  scope.querySelectorAll('[data-i18n-ph]').forEach((n) => { const k = n.getAttribute('data-i18n-ph'); if (I18N[k]) n.setAttribute('placeholder', L(k)); });
  scope.querySelectorAll('[data-i18n-aria]').forEach((n) => { const k = n.getAttribute('data-i18n-aria'); if (I18N[k]) n.setAttribute('aria-label', L(k)); });
  document.documentElement.lang = State.lang;
}

async function reloadCatalog() {
  try { State.categories = await api('/categories'); } catch (e) { /* eski ro'yxat qoladi */ }
  if (State.currentCategory && !State.categories.some((c) => c.id === State.currentCategory)) State.currentCategory = null;
  renderCategories();
  await loadProducts();
}

async function loadProducts() {
  el('products').innerHTML = skeletonCards(6);
  try {
    const params = new URLSearchParams();
    if (State.currentCategory) params.set('category', State.currentCategory);
    if (State.search) params.set('q', State.search);
    params.set('sort', State.sort);
    State.products = await api('/products?' + params.toString());
    renderProducts();
  } catch (e) { el('products').innerHTML = ''; toast(e.message); }
}

function setLang(lang, opts) {
  if (!['uz', 'ru', 'en'].includes(lang)) return;
  const changed = State.lang !== lang;
  State.lang = lang;
  localStorage.setItem('mella_lang', lang);
  applyI18n(); renderSortbar(); renderHero(); updateFabCart();
  if (changed) reloadCatalog();
  if (changed && !(opts && opts.silent) && isInTelegram()) api('/lang', { method: 'POST', body: JSON.stringify({ lang }) }).catch(() => {});
}

function applyTheme() {
  if (!tg) return;
  try {
    tg.setHeaderColor && tg.setHeaderColor(THEME_BG);
    tg.setBackgroundColor && tg.setBackgroundColor(THEME_BG);
    tg.setBottomBarColor && tg.setBottomBarColor(THEME_BG);
  } catch (e) {}
}

function showAuthBanner() {
  if (el('authBanner')) return;
  const b = document.createElement('div');
  b.id = 'authBanner'; b.className = 'auth-banner';
  const u = State.config && State.config.bot_username;
  b.innerHTML = `<span data-ic="alert"></span><span>${L('open_in_bot')}</span>${u ? `<a href="https://t.me/${escAttr(u)}">${L('open_bot')}</a>` : ''}`;
  document.body.appendChild(b); applyIcons(b);
}

async function init() {
  applyTheme();
  applyIcons(document);
  try { State.config = await api('/config'); }
  catch (e) { State.config = { shop_name: 'MELLA', currency: 'so‘m', delivery_fee: 0, free_delivery_from: 0, express_delivery_fee: 0, min_order_amount: 0, payment_methods: [{ id: 'cash', enabled: true }] }; }
  if (State.config.user_lang && ['uz', 'ru', 'en'].includes(State.config.user_lang) && State.config.user_lang !== State.lang) {
    State.lang = State.config.user_lang; localStorage.setItem('mella_lang', State.lang);
  }
  applyI18n();
  renderSortbar();
  el('products').innerHTML = skeletonCards(6);
  try { State.categories = await api('/categories'); } catch (e) { State.categories = []; }
  renderCategories();
  await loadProducts();
  renderHero();
  updateBadge(); updateFavBadge();
  if (!isInTelegram() && !State.config.dev) showAuthBanner();
  const sp = el('splash'); sp.style.opacity = '0'; setTimeout(() => { sp.style.display = 'none'; }, 500);
  // Savatdagi narx/qoldiqni fonda tekshiramiz.
  refreshCart().then(() => updateBadge()).catch(() => {});
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((n) => n.onclick = () => { haptic('light'); switchView(n.dataset.nav); });
  document.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeSheets);
  el('tbFav').onclick = () => { haptic('light'); switchView(State.view === 'favorites' ? 'home' : 'favorites'); };
  el('fabCart').onclick = () => { haptic('medium'); switchView('cart'); };
  ['emptyGoShop', 'favGoShop', 'ordersGoShop'].forEach((id) => { const b = el(id); if (b) b.onclick = () => switchView('home'); });
  el('favBack').onclick = () => { haptic('light'); switchView('home'); };
  let searchTimer;
  el('searchInput').oninput = (e) => { State.search = e.target.value.trim(); el('searchClear').hidden = !State.search; clearTimeout(searchTimer); searchTimer = setTimeout(loadProducts, 350); };
  el('searchInput').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  el('searchClear').onclick = () => { el('searchInput').value = ''; State.search = ''; el('searchClear').hidden = true; loadProducts(); };
  if (tg && tg.BackButton) tg.BackButton.onClick(() => { if (anySheetOpen()) closeSheets(); else if (State.view !== 'home') switchView('home'); });
  // Mini App qayta ko'ringanda (masalan botda til o'zgartirilgach) sozlamalarni yangilaymiz.
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    try {
      const cfg = await api('/config');
      State.config = Object.assign({}, State.config, cfg);
      if (cfg.user_lang && cfg.user_lang !== State.lang) setLang(cfg.user_lang, { silent: true });
    } catch (e) {}
  });
}

bindEvents();
init();
