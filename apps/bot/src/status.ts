import type { Order, OrderStatus } from "./store.js";

/** Ruxsat etilgan holat o'tishlari. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["confirmed", "rejected"],
  confirmed: ["preparing", "on_way", "delivered", "canceled"],
  preparing: ["on_way", "delivered", "canceled"],
  on_way: ["delivered", "canceled"],
  delivered: [],
  canceled: [],
  rejected: [],
};

export function nextStatuses(o: Pick<Order, "status" | "deliveryType">): OrderStatus[] {
  const all = TRANSITIONS[o.status];
  // Olib ketishda "yo'lda" bosqichi yo'q.
  return o.deliveryType === "pickup" ? all.filter((s) => s !== "on_way") : all;
}

export const ACTIVE_STATUSES: OrderStatus[] = ["created", "confirmed", "preparing", "on_way"];
