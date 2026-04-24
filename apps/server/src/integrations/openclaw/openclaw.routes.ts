import { Router } from 'express';
import {
  getStatus,
  listAgents,
  createAgent,
  deleteAgent,
  getAgent,
  updateAgent,
  renameAgent,
  listAgentFiles,
  getAgentFile,
  updateAgentFile,
  sendMessage,
  streamMessage,
  resumeStream,
  getStreamStatus,
  getConfig,
  updateConfig,
  getAuthProfiles,
  updateAuthProfile,
  getAgentSkills,
  setAgentSkills,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
} from './openclaw.controller';

const router = Router();

router.get('/status', getStatus);
router.get('/config', getConfig);
router.patch('/config', updateConfig);
router.get('/auth-profiles', getAuthProfiles);
router.patch('/auth-profiles/:name', updateAuthProfile);
router.get('/agents', listAgents);
router.post('/agents', createAgent);
router.get('/agents/:name', getAgent);
router.put('/agents/:name', updateAgent);
router.post('/agents/:name/rename', renameAgent);
router.delete('/agents/:name', deleteAgent);
router.get('/agents/:name/skills', getAgentSkills);
router.put('/agents/:name/skills', setAgentSkills);
router.get('/agents/:name/files', listAgentFiles);
router.get('/agents/:name/files/:filename', getAgentFile);
router.put('/agents/:name/files/:filename', updateAgentFile);
router.post('/agents/:name/message', sendMessage);
router.post('/agents/:name/message/stream', streamMessage);
router.get('/agents/:name/message/stream/resume', resumeStream);
router.get('/streams/:messageId/status', getStreamStatus);

router.get('/skills', listSkills);
router.post('/skills', createSkill);
router.get('/skills/:name', getSkill);
router.put('/skills/:name', updateSkill);
router.delete('/skills/:name', deleteSkill);

export { router as openclawRoutes };

// Sessions — read-through to ~/.openclaw/agents/<agent>/sessions/*.jsonl
import { listSessions, getSession, createSession, deleteSession } from './sessions.service';

router.get('/sessions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const opts: { agentId?: string; limit: number } = { limit };
    if (typeof req.query.agentId === 'string' && req.query.agentId) opts.agentId = req.query.agentId;
    res.json({ data: await listSessions(opts) });
  } catch (err) { next(err); }
});

router.get('/sessions/detail', async (req, res, next) => {
  try {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (!key) { res.status(400).json({ error: 'key is required' }); return; }
    const opts: { limit?: number; beforeIndex?: number; afterIndex?: number } = {};
    if (req.query.limit !== undefined) opts.limit = Number(req.query.limit);
    if (req.query.beforeIndex !== undefined) opts.beforeIndex = Number(req.query.beforeIndex);
    if (req.query.afterIndex !== undefined) opts.afterIndex = Number(req.query.afterIndex);
    const session = await getSession(key, opts);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ data: session });
  } catch (err) { next(err); }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId : '';
    if (!agentId) { res.status(400).json({ error: 'agentId is required' }); return; }
    const result = await createSession(agentId);
    if (!result.ok) {
      const status = result.error === 'agent not found' ? 404 : 400;
      res.status(status).json({ error: result.error ?? 'failed to create session' });
      return;
    }
    res.status(201).json({ data: result.session });
  } catch (err) { next(err); }
});

router.delete('/sessions/:agentId/:sessionId', async (req, res, next) => {
  try {
    const { agentId, sessionId } = req.params;
    const result = await deleteSession(`${agentId}/${sessionId}`);
    if (!result.ok) {
      const status = result.error === 'session not found' ? 404 : 400;
      res.status(status).json({ error: result.error ?? 'failed to delete session' });
      return;
    }
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// Threads — Phase 2 LyfeStack-native visible history per agent.
import {
  listThreads,
  getThread,
  getOrCreateThread,
  appendMessage as appendThreadMessage,
  rolloverThread,
  resetThread,
  deleteThread,
} from './threads.service';

router.get('/threads', async (_req, res, next) => {
  try { res.json({ data: await listThreads() }); } catch (err) { next(err); }
});

router.get('/threads/:agentName', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    const opts: { limit?: number; beforeId?: string; afterId?: string } = {};
    if (req.query.limit !== undefined) opts.limit = Number(req.query.limit);
    if (typeof req.query.beforeId === 'string' && req.query.beforeId) opts.beforeId = req.query.beforeId;
    if (typeof req.query.afterId === 'string' && req.query.afterId) opts.afterId = req.query.afterId;
    const ensure = req.query.ensure === '1' || req.query.ensure === 'true';
    if (ensure) await getOrCreateThread(agentName);
    const detail = await getThread(agentName, opts);
    if (!detail) { res.status(404).json({ error: 'Thread not found' }); return; }
    res.json({ data: detail });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

router.post('/threads/:agentName', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    const thread = await getOrCreateThread(agentName);
    res.status(201).json({ data: thread });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

router.post('/threads/:agentName/messages', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    const { role, content, sessionKey, isError, errorType } = req.body ?? {};
    if (role !== 'user' && role !== 'agent') { res.status(400).json({ error: "role must be 'user' or 'agent'" }); return; }
    if (typeof content !== 'string') { res.status(400).json({ error: 'content must be a string' }); return; }
    const message = await appendThreadMessage(agentName, {
      role,
      content,
      ...(typeof sessionKey === 'string' && sessionKey ? { sessionKey } : {}),
      ...(isError ? { isError: true } : {}),
      ...(typeof errorType === 'string' && errorType ? { errorType } : {}),
    });
    res.status(201).json({ data: message });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

router.post('/threads/:agentName/rollover', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    const result = await rolloverThread(agentName);
    res.json({ data: result });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

router.post('/threads/:agentName/reset', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    await resetThread(agentName);
    res.json({ data: { ok: true } });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

router.delete('/threads/:agentName', async (req, res, next) => {
  try {
    const agentName = req.params.agentName;
    if (!agentName) { res.status(400).json({ error: 'agentName is required' }); return; }
    await deleteThread(agentName);
    res.json({ data: { ok: true } });
  } catch (err: any) {
    if (err?.message?.startsWith('invalid agent name')) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});

// Usage tracking
import { getUsageSummary, getUsageHistory, getUsageByAgent, getUsageByModel, getBudgetStatus } from './usage-tracker';

router.get('/usage', async (_req, res) => { res.json({ data: await getUsageSummary() }); });
router.get('/usage/history', async (req, res) => { res.json({ data: await getUsageHistory(Number(req.query.limit) || 100) }); });
router.get('/usage/by-agent', async (_req, res) => { res.json({ data: await getUsageByAgent() }); });
router.get('/usage/by-model', async (_req, res) => { res.json({ data: await getUsageByModel() }); });
router.get('/usage/budget', async (_req, res, next) => { try { res.json({ data: await getBudgetStatus() }); } catch (err) { next(err); } });

// Automations
import { automationsRouter } from '../../automations/automations.routes';
router.use('/automations', automationsRouter);

// ── Delivery queue ──────────────────────────────────────────────────────────
import {
  listQueue,
  getItem as getDeliveryItem,
  retryItem as retryDeliveryItem,
  deleteItem as deleteDeliveryItem,
  type DeliveryStatus,
} from './delivery-queue.service';

router.get('/delivery-queue', async (req, res, next) => {
  try {
    const status = (req.query.status as DeliveryStatus | undefined) ?? undefined;
    res.json({ data: await listQueue(status) });
  } catch (err) { next(err); }
});
router.get('/delivery-queue/:id', async (req, res, next) => {
  try {
    if (!req.params.id) { res.status(400).json({ error: 'id required' }); return; }
    const item = await getDeliveryItem(req.params.id);
    if (!item) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ data: item });
  } catch (err) { next(err); }
});
router.post('/delivery-queue/:id/retry', async (req, res, next) => {
  try {
    if (!req.params.id) { res.status(400).json({ error: 'id required' }); return; }
    const item = await retryDeliveryItem(req.params.id);
    if (!item) { res.status(404).json({ error: 'not found in failed/' }); return; }
    res.json({ data: item });
  } catch (err) { next(err); }
});
router.delete('/delivery-queue/:id', async (req, res, next) => {
  try {
    if (!req.params.id) { res.status(400).json({ error: 'id required' }); return; }
    const ok = await deleteDeliveryItem(req.params.id);
    if (!ok) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Approvals ───────────────────────────────────────────────────────────────
import {
  getApprovalsConfig,
  setDefaults as setApprovalDefaults,
  listAllowlist,
  addAllowlistEntry,
  removeAllowlistEntry,
  listPending as listPendingApprovals,
  decide as decideApproval,
} from './approvals.service';

router.get('/approvals/config', async (_req, res, next) => {
  try { res.json({ data: await getApprovalsConfig() }); } catch (err) { next(err); }
});
router.patch('/approvals/defaults', async (req, res, next) => {
  try { res.json({ data: await setApprovalDefaults(req.body ?? {}) }); } catch (err) { next(err); }
});
router.get('/approvals/pending', async (_req, res, next) => {
  try { res.json({ data: await listPendingApprovals() }); } catch (err) { next(err); }
});
router.get('/approvals/allowlist', async (req, res, next) => {
  try {
    const agent = typeof req.query.agent === 'string' ? req.query.agent : undefined;
    res.json({ data: await listAllowlist(agent) });
  } catch (err) { next(err); }
});
router.post('/approvals/allowlist/:agent', async (req, res, next) => {
  try {
    if (!req.params.agent) { res.status(400).json({ error: 'agent required' }); return; }
    const { pattern, source } = req.body ?? {};
    if (typeof pattern !== 'string' || !pattern.trim()) {
      res.status(400).json({ error: 'pattern required' });
      return;
    }
    const entry = await addAllowlistEntry(
      req.params.agent,
      pattern,
      typeof source === 'string' ? source : undefined,
    );
    res.status(201).json({ data: entry });
  } catch (err) { next(err); }
});
router.delete('/approvals/allowlist/:agent/:id', async (req, res, next) => {
  try {
    if (!req.params.agent || !req.params.id) {
      res.status(400).json({ error: 'agent and id required' });
      return;
    }
    const ok = await removeAllowlistEntry(req.params.agent, req.params.id);
    if (!ok) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});
router.post('/approvals/decide', async (req, res, next) => {
  try {
    const { agent, pattern, decision, notes } = req.body ?? {};
    if (typeof agent !== 'string' || typeof pattern !== 'string' || !decision) {
      res.status(400).json({ error: 'agent, pattern, decision required' });
      return;
    }
    if (!['approve', 'reject', 'allow-always'].includes(decision)) {
      res.status(400).json({ error: 'decision must be approve|reject|allow-always' });
      return;
    }
    const result = await decideApproval({ agent, pattern, decision, notes });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── Logs ────────────────────────────────────────────────────────────────────
import { listLogs, tailLog, streamLog } from './logs.service';

router.get('/logs', async (_req, res, next) => {
  try { res.json({ data: await listLogs() }); } catch (err) { next(err); }
});
router.get('/logs/:name/tail', async (req, res, next) => {
  try {
    if (!req.params.name) { res.status(400).json({ error: 'name required' }); return; }
    const bytes = Number(req.query.bytes) || undefined;
    res.json({ data: await tailLog(req.params.name, bytes) });
  } catch (err: any) {
    if (err?.message?.includes('invalid log name')) { res.status(400).json({ error: err.message }); return; }
    if (err?.code === 'ENOENT') { res.status(404).json({ error: 'log not found' }); return; }
    next(err);
  }
});
router.get('/logs/:name/stream', (req, res) => {
  const name = req.params.name;
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const sub = streamLog(name, {
    onData: (chunk) => res.write(`data: ${JSON.stringify({ chunk })}\n\n`),
    onError: (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
      sub.close();
    },
    tailBytes: 16 * 1024,
  });
  req.on('close', () => sub.close());
});

// ── Media + Canvas ──────────────────────────────────────────────────────────
import * as fsLib from 'fs';
import { listMedia, getMediaItem, getMediaPath, readCanvas } from './media.service';

router.get('/media', async (req, res, next) => {
  try {
    const opts: { source?: 'browser' | 'inbound' | 'other'; limit?: number; cursor?: string } = {};
    if (req.query.source === 'browser' || req.query.source === 'inbound' || req.query.source === 'other') {
      opts.source = req.query.source;
    }
    if (req.query.limit) opts.limit = Number(req.query.limit);
    if (typeof req.query.cursor === 'string') opts.cursor = req.query.cursor;
    res.json({ data: await listMedia(opts) });
  } catch (err) { next(err); }
});
router.get('/media/:source/:filename', async (req, res, next) => {
  try {
    const id = `${req.params.source}/${req.params.filename}`;
    const item = await getMediaItem(id);
    if (!item) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ data: item });
  } catch (err) { next(err); }
});
router.get('/media/file/:source/:filename', async (req, res) => {
  if (!req.params.source || !req.params.filename) { res.status(400).end(); return; }
  const fp = await getMediaPath(req.params.source, req.params.filename);
  if (!fp) { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'private, max-age=300');
  fsLib.createReadStream(fp).on('error', () => res.status(500).end()).pipe(res);
});
router.get('/canvas', async (_req, res, next) => {
  try {
    const html = await readCanvas();
    if (html === null) { res.status(404).json({ error: 'canvas not found' }); return; }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});
