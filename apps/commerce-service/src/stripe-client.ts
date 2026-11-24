import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { serviceUrl } from "@ok-family/service-kit";
import Stripe from "stripe";

export function stripeLivemode() {
  return process.env.STRIPE_MODE === "live";
}

export function stripeConfigured() {
  const mode = process.env.STRIPE_MODE ?? "test";
  const key = /^(?:rk|sk)_(test|live)_[a-zA-Z0-9_]+$/.exec(process.env.STRIPE_SECRET_KEY ?? "");
  return key?.[1] === mode && /^whsec_[a-zA-Z0-9_-]+$/.test(process.env.STRIPE_WEBHOOK_SECRET ?? "");
}

export function stripeCheckoutEnabled() {
  const enabled = process.env.STRIPE_CHECKOUT_ENABLED;
  return stripeConfigured() && (stripeLivemode() ? enabled === "true" : enabled !== "false");
}

export function validateStripeConfiguration() {
  const { STRIPE_MODE, STRIPE_CHECKOUT_ENABLED, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;
  if (STRIPE_MODE !== undefined && !["test", "live"].includes(STRIPE_MODE)) {
    throw new Error("STRIPE_MODE debe ser test o live.");
  }
  if (STRIPE_CHECKOUT_ENABLED !== undefined && !["true", "false"].includes(STRIPE_CHECKOUT_ENABLED)) {
    throw new Error("STRIPE_CHECKOUT_ENABLED debe ser true o false.");
  }
  if (stripeLivemode() || STRIPE_SECRET_KEY || STRIPE_WEBHOOK_SECRET) {
    if (!stripeConfigured()) {
      throw new Error("La clave de Stripe debe corresponder a STRIPE_MODE y el secreto del webhook debe estar configurado.");
    }
    if (stripeLivemode() && !serviceUrl("WEB_ORIGIN", "http://localhost:3000").startsWith("https://")) {
      throw new Error("WEB_ORIGIN debe usar HTTPS con Stripe en modo live.");
    }
  }
}

@Injectable()
export class StripeClient {
  private sdk?: Stripe;
  get api() {
    if (!stripeConfigured()) throw new ServiceUnavailableException("El pago con Stripe no está configurado.");
    return this.sdk ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {timeout: 6000, maxNetworkRetries: 1});
  }
}
