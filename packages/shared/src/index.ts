import { z } from 'zod';

export const VibeSchema = z.enum(['chill', 'active', 'romantic', 'adventurous']);

export const PlanRequestSchema = z.object({
  startArea: z.string().min(1),
  startTimeIso: z.string().datetime(),
  endTimeIso: z.string().datetime(),
  budgetSgd: z.number().int().positive(),
  vibe: VibeSchema,
});

export type Vibe = z.infer<typeof VibeSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
