import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var __stripe: Stripe | undefined;
}

function createClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurée.");
  }
  return new Stripe(key);
}

export function getStripe(): Stripe {
  if (process.env.NODE_ENV === "production") {
    return createClient();
  }
  if (!global.__stripe) {
    global.__stripe = createClient();
  }
  return global.__stripe;
}
