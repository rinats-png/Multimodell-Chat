import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./auth-policy";
import { COUNCIL_PRESET_IDS } from "./council-presets";
import { PROVIDER_KEY_IDS } from "./types";

export const uuidSchema = z.uuid();

export const roomPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    orchestration_mode: z.enum(["router", "round-robin", "manual"]),
    sliding_window_size: z.number().int().min(2).max(40),
    max_auto_turns: z.number().int().min(1).max(10),
  })
  .partial()
  .strict();

const modelId = z
  .string()
  .trim()
  .max(100)
  .regex(/^[a-z0-9._-]+\/[a-zA-Z0-9._:-]+$/, "Format: anbieter/modell, z. B. openai/gpt-4o");

export const agentPatchSchema = z
  .object({
    model_identifier: modelId,
    display_name: z.string().trim().min(1).max(40),
    role_title: z.string().trim().min(1).max(120),
    system_prompt: z.string().trim().min(10).max(4000),
    is_active: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict();

export const agentCreateSchema = agentPatchSchema.required({
  model_identifier: true,
  display_name: true,
  role_title: true,
  system_prompt: true,
});

export const orchestrateSchema = z
  .object({
    roomId: uuidSchema,
    content: z.string().trim().max(4000).optional(),
    agentId: uuidSchema.optional(),
    /** Ratssitzung: Runde 1 (Eröffnung), 2 (Streit) oder 3 (Abstimmung). */
    round: z.number().int().min(1).max(3).optional(),
  })
  .strict()
  .refine((v) => v.round === undefined || v.agentId === undefined, { message: "Runde und Agent schließen sich aus" })
  .refine((v) => v.round === undefined || v.round === 1 || v.content === undefined, { message: "Nur Runde 1 nimmt eine Nachricht an" });

export const openRouterKeySchema = z
  .string()
  .trim()
  .regex(/^sk-or-[A-Za-z0-9_-]{10,200}$/, "Ungültiger OpenRouter-Key (beginnt mit sk-or-)");

/** Erkennungsmuster der Anbieter-Keys – nur Format, die Gültigkeit prüft der Anbieter. */
export const PROVIDER_KEY_PATTERNS = {
  gateway: /^[A-Za-z0-9_-]{20,300}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,300}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
  google: /^AIza[0-9A-Za-z_-]{30,60}$/,
  xai: /^xai-[A-Za-z0-9_-]{20,300}$/,
} as const;

export const connectionPatchSchema = z
  .object({
    provider: z.enum(["openrouter", ...PROVIDER_KEY_IDS]),
    key: z.string().trim().max(400).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.key === null) return;
    const ok = value.provider === "openrouter" ? openRouterKeySchema.safeParse(value.key).success : PROVIDER_KEY_PATTERNS[value.provider].test(value.key);
    if (!ok) ctx.addIssue({ code: "custom", path: ["key"], message: "Dieser Key hat nicht das erwartete Format des Anbieters." });
  });

export const profilePatchSchema = z.object({ custom_openrouter_key: openRouterKeySchema.nullable() }).strict();

export const planSchema = z.object({ tier: z.enum(["free", "pro", "team"]) }).strict();

const email = z.email("Bitte eine gültige E-Mail-Adresse angeben").max(254);
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`)
  .max(PASSWORD_MAX_LENGTH, `Höchstens ${PASSWORD_MAX_LENGTH} Zeichen`);

export const loginSchema = z.object({ email, password: z.string().min(1).max(PASSWORD_MAX_LENGTH) }).strict();
export const signupSchema = z.object({ email, password, acceptTerms: z.literal(true) }).strict();
export const resetRequestSchema = z.object({ email }).strict();
export const passwordUpdateSchema = z.object({ password }).strict();
export const reauthSchema = z.object({ password: z.string().min(1).max(PASSWORD_MAX_LENGTH) }).strict();

export const reportShareSchema = z.object({ enabled: z.boolean() }).strict();

export const councilSchema = z.object({ preset: z.enum(COUNCIL_PRESET_IDS) }).strict();
