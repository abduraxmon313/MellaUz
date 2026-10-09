import postgres from "postgres";
import { config } from "./config.js";

/**
 * O'zimizning ma'lumotlar ombori: mijozlar, buyurtmalar, admin kartalari,
 * rasm keshi va kalit-qiymat (BILLZ tokenlari, katalog snapshot'i).
 *
 * DATABASE_URL bo'lsa — PostgreSQL, bo'lmasa xotira (faqat lokal sinov;
 * qayta ishga tushganda ma'lumot yo'qoladi).
 */

export type Lang = "uz" | "ru" | "en";

export const ORDER_STATUSES = [
  "created",
  "confirmed",
  "preparing",
  "on_way",
  "delivered",
  "canceled",
  "rejected",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface User {
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  lang: Lang | "";
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  sku: string;
  price: number;
  qty: number;
  lineTotal: number;
  image: string;
}

export interface OrderHistory {
  status: OrderStatus;
  at: string;
  by: number | null;
  note?: string;
}

export interface Order {
  id: number;
  number: number;
  userId: number;
  customerName: string;
  username: string;
  phone: string;
  items: OrderItem[];
  itemsTotal: number;
  deliveryFee: number;
  grandTotal: number;
  deliveryType: "delivery" | "pickup";
  address: string;
  lat: number | null;
  lng: number | null;
  deliveryTime: string;
  express: boolean;
  note: string;
  paymentMethod: "cash" | "click";
  isPaid: boolean;
  status: OrderStatus;
  cancelReason: string;
  lang: Lang;
  billzOrderId: string;
  /** BILLZ sotuvi to'liq o'tkazildi (to'lov bilan). */
  billzDone: boolean;
  billzError: string;
  history: OrderHistory[];
  createdAt: string;
  updatedAt: string;
}

export type NewOrder = Omit<Order, "id" | "number" | "createdAt" | "updatedAt" | "history" | "billzOrderId" | "billzDone" | "billzError" | "cancelReason" | "isPaid" | "status">;

export interface AdminCard {
  orderId: number;
  chatId: number;
  messageId: number;
}

export interface Media {
  key: string;
  contentType: string;
  data: Buffer;
}

export interface Store {
  kind: "postgres" | "memory";
  init(): Promise<void>;
  close(): Promise<void>;

  getUser(id: number): Promise<User | null>;
  upsertUser(u: Partial<User> & { telegramId: number }): Promise<User>;

  createOrder(o: NewOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | null>;
  listOrdersByUser(userId: number, limit?: number): Promise<Order[]>;
  listOrdersByStatus(statuses: OrderStatus[], limit?: number): Promise<Order[]>;
  listOrdersSince(sinceIso: string): Promise<Order[]>;
  updateOrder(id: number, patch: Partial<Order>): Promise<Order | null>;

  addAdminCard(c: AdminCard): Promise<void>;
  getAdminCards(orderId: number): Promise<AdminCard[]>;

  getMedia(key: string): Promise<Media | null>;
  putMedia(m: Media): Promise<void>;

  kvGet<T = unknown>(key: string): Promise<T | null>;
  kvSet(key: string, value: unknown): Promise<void>;
}

const nowIso = () => new Date().toISOString();

// ═════════════════════════════════════════════════════════════
//  XOTIRA (lokal sinov)
// ═════════════════════════════════════════════════════════════
class MemoryStore implements Store {
  kind = "memory" as const;
  private users = new Map<number, User>();
  private orders = new Map<number, Order>();
  private cards: AdminCard[] = [];
  private media = new Map<string, Media>();
  private kv = new Map<string, unknown>();
  private seq = 0;

  async init() {}
  async close() {}

  async getUser(id: number) {
    return this.users.get(id) ?? null;
  }
  async upsertUser(u: Partial<User> & { telegramId: number }) {
    const prev = this.users.get(u.telegramId);
    const next: User = {
      telegramId: u.telegramId,
      firstName: u.firstName ?? prev?.firstName ?? "",
      lastName: u.lastName ?? prev?.lastName ?? "",
      username: u.username ?? prev?.username ?? "",
      phone: u.phone ?? prev?.phone ?? "",
      lang: u.lang ?? prev?.lang ?? "",
      createdAt: prev?.createdAt ?? nowIso(),
    };
    this.users.set(u.telegramId, next);
    return next;
  }

  async createOrder(o: NewOrder) {
    const id = ++this.seq;
    const t = nowIso();
    const order: Order = {
      ...o,
      id,
      number: 1000 + id,
      status: "created",
      isPaid: false,
      cancelReason: "",
      billzOrderId: "",
      billzDone: false,
      billzError: "",
      history: [{ status: "created", at: t, by: o.userId }],
      createdAt: t,
      updatedAt: t,
    };
    this.orders.set(id, order);
    return structuredClone(order);
  }
  async getOrder(id: number) {
    const o = this.orders.get(id);
    return o ? structuredClone(o) : null;
  }
  async listOrdersByUser(userId: number, limit = 50) {
    return [...this.orders.values()]
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map((o) => structuredClone(o));
  }
  async listOrdersByStatus(statuses: OrderStatus[], limit = 50) {
    return [...this.orders.values()]
      .filter((o) => statuses.includes(o.status))
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map((o) => structuredClone(o));
  }
  async listOrdersSince(sinceIso: string) {
    return [...this.orders.values()].filter((o) => o.createdAt >= sinceIso).map((o) => structuredClone(o));
  }
  async updateOrder(id: number, patch: Partial<Order>) {
    const o = this.orders.get(id);
    if (!o) return null;
    Object.assign(o, patch, { updatedAt: nowIso() });
    return structuredClone(o);
  }

  async addAdminCard(c: AdminCard) {
    this.cards.push(c);
  }
  async getAdminCards(orderId: number) {
    return this.cards.filter((c) => c.orderId === orderId);
  }

  async getMedia(key: string) {
    return this.media.get(key) ?? null;
  }
  async putMedia(m: Media) {
    // Xotirani to'ldirib yubormaslik uchun cheklov.
    if (this.media.size > 2000) this.media.clear();
    this.media.set(m.key, m);
  }

  async kvGet<T>(key: string) {
    return (this.kv.has(key) ? (this.kv.get(key) as T) : null) ?? null;
  }
  async kvSet(key: string, value: unknown) {
    this.kv.set(key, value);
  }
}

// ═════════════════════════════════════════════════════════════
//  POSTGRESQL
// ═════════════════════════════════════════════════════════════
type Row = Record<string, unknown>;

function rowToUser(r: Row): User {
  return {
    telegramId: Number(r.telegram_id),
    firstName: String(r.first_name ?? ""),
    lastName: String(r.last_name ?? ""),
    username: String(r.username ?? ""),
    phone: String(r.phone ?? ""),
    lang: (String(r.lang ?? "") as Lang) || "",
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function rowToOrder(r: Row): Order {
  const d = (r.data ?? {}) as Partial<Order>;
  return {
    ...(d as Order),
    id: Number(r.id),
    number: Number(r.id) + 1000,
    userId: Number(r.user_id),
    status: r.status as OrderStatus,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** Order obyektidan JSONB `data` ustuniga yoziladigan qism. */
function orderData(o: Partial<Order>): Partial<Order> {
  const rest: Partial<Order> = { ...o };
  delete rest.id;
  delete rest.number;
  delete rest.userId;
  delete rest.status;
  delete rest.createdAt;
  delete rest.updatedAt;
  return rest;
}

class PgStore implements Store {
  kind = "postgres" as const;
  private sql: postgres.Sql;

  constructor(url: string) {
    const local = /localhost|127\.0\.0\.1|\.railway\.internal/.test(url);
    this.sql = postgres(url, {
      max: 5,
      ssl: local ? false : "require",
      idle_timeout: 30,
      onnotice: () => {},
    });
  }

  async init() {
    const sql = this.sql;
    await sql`
      CREATE TABLE IF NOT EXISTS bot_users (
        telegram_id BIGINT PRIMARY KEY,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        username TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        lang TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, id DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, id DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_cards (
        order_id BIGINT NOT NULL,
        chat_id BIGINT NOT NULL,
        message_id BIGINT NOT NULL,
        PRIMARY KEY (order_id, chat_id, message_id)
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS media_cache (
        key TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  }

  async close() {
    await this.sql.end({ timeout: 5 });
  }

  async getUser(id: number) {
    const rows = await this.sql`SELECT * FROM bot_users WHERE telegram_id = ${id}`;
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async upsertUser(u: Partial<User> & { telegramId: number }) {
    const prev = await this.getUser(u.telegramId);
    const n = {
      first_name: u.firstName ?? prev?.firstName ?? "",
      last_name: u.lastName ?? prev?.lastName ?? "",
      username: u.username ?? prev?.username ?? "",
      phone: u.phone ?? prev?.phone ?? "",
      lang: u.lang ?? prev?.lang ?? "",
    };
    const rows = await this.sql`
      INSERT INTO bot_users (telegram_id, first_name, last_name, username, phone, lang)
      VALUES (${u.telegramId}, ${n.first_name}, ${n.last_name}, ${n.username}, ${n.phone}, ${n.lang})
      ON CONFLICT (telegram_id) DO UPDATE SET
        first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
        username = EXCLUDED.username, phone = EXCLUDED.phone, lang = EXCLUDED.lang
      RETURNING *`;
    return rowToUser(rows[0]!);
  }

  async createOrder(o: NewOrder) {
    const t = nowIso();
    const data: Partial<Order> = {
      ...orderData(o),
      isPaid: false,
      cancelReason: "",
      billzOrderId: "",
      billzDone: false,
      billzError: "",
      history: [{ status: "created", at: t, by: o.userId }],
    };
    const rows = await this.sql`
      INSERT INTO orders (user_id, status, data)
      VALUES (${o.userId}, 'created', ${this.sql.json(data as postgres.JSONValue)})
      RETURNING *`;
    return rowToOrder(rows[0]!);
  }

  async getOrder(id: number) {
    const rows = await this.sql`SELECT * FROM orders WHERE id = ${id}`;
    return rows[0] ? rowToOrder(rows[0]) : null;
  }

  async listOrdersByUser(userId: number, limit = 50) {
    const rows = await this.sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit}`;
    return rows.map(rowToOrder);
  }

  async listOrdersByStatus(statuses: OrderStatus[], limit = 50) {
    const rows = await this.sql`
      SELECT * FROM orders WHERE status IN ${this.sql(statuses as string[])} ORDER BY id DESC LIMIT ${limit}`;
    return rows.map(rowToOrder);
  }

  async listOrdersSince(sinceIso: string) {
    const rows = await this.sql`SELECT * FROM orders WHERE created_at >= ${sinceIso} ORDER BY id DESC`;
    return rows.map(rowToOrder);
  }

  async updateOrder(id: number, patch: Partial<Order>) {
    const cur = await this.getOrder(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    const rows = await this.sql`
      UPDATE orders SET status = ${next.status}, data = ${this.sql.json(orderData(next) as postgres.JSONValue)}, updated_at = now()
      WHERE id = ${id} RETURNING *`;
    return rows[0] ? rowToOrder(rows[0]) : null;
  }

  async addAdminCard(c: AdminCard) {
    await this.sql`
      INSERT INTO admin_cards (order_id, chat_id, message_id) VALUES (${c.orderId}, ${c.chatId}, ${c.messageId})
      ON CONFLICT DO NOTHING`;
  }

  async getAdminCards(orderId: number) {
    const rows = await this.sql`SELECT * FROM admin_cards WHERE order_id = ${orderId}`;
    return rows.map((r) => ({ orderId: Number(r.order_id), chatId: Number(r.chat_id), messageId: Number(r.message_id) }));
  }

  async getMedia(key: string) {
    const rows = await this.sql`SELECT content_type, data FROM media_cache WHERE key = ${key}`;
    const r = rows[0];
    return r ? { key, contentType: String(r.content_type), data: Buffer.from(r.data as Uint8Array) } : null;
  }

  async putMedia(m: Media) {
    await this.sql`
      INSERT INTO media_cache (key, content_type, data) VALUES (${m.key}, ${m.contentType}, ${m.data})
      ON CONFLICT (key) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, created_at = now()`;
  }

  async kvGet<T>(key: string) {
    const rows = await this.sql`SELECT value FROM kv WHERE key = ${key}`;
    return rows[0] ? (rows[0].value as T) : null;
  }

  async kvSet(key: string, value: unknown) {
    await this.sql`
      INSERT INTO kv (key, value) VALUES (${key}, ${this.sql.json(value as postgres.JSONValue)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
}

export const store: Store = config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore();
