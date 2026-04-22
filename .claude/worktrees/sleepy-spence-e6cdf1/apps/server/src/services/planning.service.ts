import { z } from 'zod';
import { generatePlan, GeneratedPlan, PlanInput } from '../engine/PlanningEngine';
import { goalTemplateService } from './goalTemplate.service';
import { ValidationError } from '../errors/AppError';

export const GeneratePlanSchema = z.object({
  userId: z.string().uuid(),
  templateId: z.string().min(1),
  goalTitle: z.string().min(1).max(200),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
});

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>;

export class PlanningService {
  generatePlan(rawInput: unknown): GeneratedPlan {
    const parsed = GeneratePlanSchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      throw new ValidationError(msg);
    }

    const input: PlanInput = parsed.data;
    const template = goalTemplateService.getTemplate(input.templateId);
    return generatePlan(input, template);
  }
}

export const planningService = new PlanningService();
