import { logger } from '../utils/logger';
import { listTokens } from '../integrations/push/push-tokens.service';
import { pushService } from '../integrations/push/push.service';
import { summarizeOneSentence } from '../integrations/openai/summary.service';

interface RunOutcome {
  result: string;
  status: 'success' | 'error';
  error?: string;
}

export async function notifyAutomationComplete(automationId: string, outcome: RunOutcome): Promise<void> {
  let summary = '';
  try {
    const raw = outcome.status === 'success'
      ? `Automation ${automationId} succeeded. Output: ${outcome.result || '(empty)'}`
      : `Automation ${automationId} failed. Error: ${outcome.error ?? 'unknown'}`;
    summary = await summarizeOneSentence(raw, { maxWords: 18 });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'notifyAutomationComplete: AI summary failed');
    summary = outcome.status === 'success' ? 'Automation completed.' : `Automation failed: ${outcome.error ?? 'unknown'}`;
  }

  let tokens: Awaited<ReturnType<typeof listTokens>> = [];
  try { tokens = await listTokens(); }
  catch (err) {
    logger.warn({ err: (err as Error).message }, 'notifyAutomationComplete: token list failed');
    return;
  }

  if (!tokens.length) return;

  const title = outcome.status === 'success' ? '✅ Automation done' : '⚠️ Automation failed';
  await Promise.all(tokens.map(async (t) => {
    try {
      await pushService.sendToToken(t.token, title, summary, 'agent_complete', {
        automationId,
        status: outcome.status,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'notifyAutomationComplete: push failed');
    }
  }));
}
