import type { PackKey } from "./stripe-packs";

export const PADDLE_PACK_PRICE_ENV: Record<PackKey, string> = {
  starter: "PADDLE_PRICE_STARTER",
  pro: "PADDLE_PRICE_PRO",
  premium: "PADDLE_PRICE_PREMIUM",
};
