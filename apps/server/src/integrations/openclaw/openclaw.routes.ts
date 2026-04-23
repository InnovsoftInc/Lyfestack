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

// Usage tracking
import { getUsageSummary, getUsageHistory, getUsageByAgent, getUsageByModel } from './usage-tracker';

router.get('/usage', async (_req, res) => { res.json({ data: await getUsageSummary() }); });
router.get('/usage/history', async (req, res) => { res.json({ data: await getUsageHistory(Number(req.query.limit) || 100) }); });
router.get('/usage/by-agent', async (_req, res) => { res.json({ data: await getUsageByAgent() }); });
router.get('/usage/by-model', async (_req, res) => { res.json({ data: await getUsageByModel() }); });

// Automations
import { automationsRouter } from '../../automations/automations.routes';
router.use('/automations', automationsRouter);
