export const STRIPE_ENABLED = false;

export const PADDLE_ENABLED = true;

export const PRICING_PUBLIC = true;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_STARTER &&
      process.env.STRIPE_PRICE_PRO &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}

export function isPaddleConfigured(): boolean {
  return Boolean(
    process.env.PADDLE_API_KEY &&
      process.env.PADDLE_WEBHOOK_SECRET &&
      process.env.PADDLE_PRICE_STARTER &&
      process.env.PADDLE_PRICE_PRO &&
      process.env.PADDLE_PRICE_PREMIUM
  );
}
