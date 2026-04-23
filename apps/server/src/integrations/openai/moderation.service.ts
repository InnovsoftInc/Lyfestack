import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';

interface ModerationResponse {
  results?: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
  model?: string;
}

export interface ModerationResult {
  flagged: boolean;
  topCategory?: string;
  topScore?: number;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
  model: string;
}

/**
 * Cheap pre-check used to gate user input before forwarding to expensive
 * models or to OpenClaw agents. Falls back to "not flagged" on transport
 * errors so a moderation outage doesn't block the user.
 */
export async function check(input: string): Promise<ModerationResult> {
  if (!input.trim()) {
    return { flagged: false, categories: {}, scores: {}, model: 'none' };
  }
  const resolved = await resolveModel('moderation');
  try {
    const res = await openaiJson<ModerationResponse>({
      path: '/moderations',
      method: 'POST',
      apiKey: resolved.apiKey,
      body: { model: resolved.model, input },
    });
    const first = res.results?.[0];
    if (!first) return { flagged: false, categories: {}, scores: {}, model: res.model ?? resolved.model };
    let topCategory: string | undefined;
    let topScore = 0;
    for (const [cat, score] of Object.entries(first.category_scores)) {
      if (score > topScore) { topCategory = cat; topScore = score; }
    }
    const out: ModerationResult = {
      flagged: first.flagged,
      categories: first.categories,
      scores: first.category_scores,
      model: res.model ?? resolved.model,
    };
    if (topCategory) out.topCategory = topCategory;
    if (topScore > 0) out.topScore = topScore;
    return out;
  } catch {
    return { flagged: false, categories: {}, scores: {}, model: resolved.model };
  }
}
