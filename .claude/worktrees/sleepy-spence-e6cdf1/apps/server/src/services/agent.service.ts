import { z } from 'zod';
import { AgentRole, TrustTier } from '@lyfestack/shared';
import { dispatch, listAgents, OrchestratorInput } from '../agents/AgentOrchestrator';
import { AgentOutput } from '../agents/BaseAgent';
import { ValidationError } from '../errors/AppError';

export const AgentActionRequestSchema = z.object({
  agentRole: z.nativeEnum(AgentRole),
  userId: z.string().uuid(),
  action: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  trustTier: z.nativeEnum(TrustTier).optional(),
});

export type AgentActionRequest = z.infer<typeof AgentActionRequestSchema>;

export class AgentService {
  dispatch(rawInput: unknown): AgentOutput {
    const parsed = AgentActionRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      throw new ValidationError(msg);
    }

    const input: OrchestratorInput = {
      agentRole: parsed.data.agentRole,
      userId: parsed.data.userId,
      action: parsed.data.action,
      payload: parsed.data.payload,
      trustTier: parsed.data.trustTier,
    };

    return dispatch(input);
  }

  listAgents() {
    return listAgents();
  }
}

export const agentService = new AgentService();
