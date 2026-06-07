import { Paddle, Environment } from "@paddle/paddle-node-sdk";

declare global {
  // eslint-disable-next-line no-var
  var __paddle: Paddle | undefined;
}

function createClient(): Paddle {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY non configurée.");
  const isSandbox = process.env.PADDLE_SANDBOX === "true";
  return new Paddle(key, {
    environment: isSandbox ? Environment.sandbox : Environment.production,
  });
}

export function getPaddle(): Paddle {
  if (process.env.NODE_ENV === "production") return createClient();
  if (!global.__paddle) global.__paddle = createClient();
  return global.__paddle;
}
