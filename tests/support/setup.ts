import { beforeEach, vi } from "vitest";
import { resetRateLimitMemory } from "@/lib/rate-limit";
import { resetMemoryDb } from "@/lib/store/memory-store";

// Tests laufen immer im Demo-Workspace ohne externe Dienste.
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ALLOW_DEMO_MODE",
  "APP_ORIGIN",
  "OPERATOR_NAME",
  "OPERATOR_ADDRESS",
  "OPERATOR_EMAIL",
  "OPERATOR_PHONE",
  "OPERATOR_REPRESENTATIVE",
  "OPERATOR_VAT_ID",
  "LOCAL_SUBSCRIPTION_MODE",
  "BYOK_ENCRYPTION_KEY",
  "LOG_HASH_SECRET",
  "TRUSTED_PROXY_HOPS",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_TEAM",
  "STRIPE_WEBHOOK_SECRET",
  "ROUTER_MODEL",
  "SUMMARY_MODEL",
  "STRIPE_SECRET_KEY",
]) {
  delete process.env[name];
}

process.env.DEMO_STREAM_DELAY_MS = "0";

beforeEach(() => {
  resetRateLimitMemory();
  resetMemoryDb();
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
