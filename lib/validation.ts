import { z } from "zod";

export const roomPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    orchestration_mode: z.enum(["router", "round-robin", "manual"]),
    sliding_window_size: z.number().int().min(2).max(100),
    max_auto_turns: z.number().int().min(1).max(10),
  })
  .partial();

const modelId = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]+\/[a-zA-Z0-9._:-]+$/, "Format: anbieter/modell, z. B. openai/gpt-4o");

export const agentPatchSchema = z
  .object({
    model_identifier: modelId,
    display_name: z.string().trim().min(1).max(40),
    role_title: z.string().trim().min(1).max(120),
    system_prompt: z.string().trim().min(10).max(8000),
    is_active: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .partial();

export const agentCreateSchema = agentPatchSchema.required({
  model_identifier: true,
  display_name: true,
  role_title: true,
  system_prompt: true,
});

export const orchestrateSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().trim().max(8000).optional(),
  agentId: z.string().uuid().optional(),
});

export const profilePatchSchema = z.object({
  custom_openrouter_key: z
    .string()
    .trim()
    .regex(/^sk-or-[A-Za-z0-9_-]{10,}$/, "Ungültiger OpenRouter-Key (beginnt mit sk-or-)")
    .nullable(),
});

export const planSchema = z.object({ tier: z.enum(["free", "pro", "team"]) });
