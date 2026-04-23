import { Router } from 'express';
import {
  getStatus,
  listAgents,
  createAgent,
  deleteAgent,
  getAgent,
  updateAgent,
  listAgentFiles,
  getAgentFile,
  updateAgentFile,
  sendMessage,
  getConfig,
  updateConfig,
  getAuthProfiles,
  updateAuthProfile,
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
router.delete('/agents/:name', deleteAgent);
router.get('/agents/:name/files', listAgentFiles);
router.get('/agents/:name/files/:filename', getAgentFile);
router.put('/agents/:name/files/:filename', updateAgentFile);
router.post('/agents/:name/message', sendMessage);

router.get('/skills', listSkills);
router.post('/skills', createSkill);
router.get('/skills/:name', getSkill);
router.put('/skills/:name', updateSkill);
router.delete('/skills/:name', deleteSkill);

export { router as openclawRoutes };

// Sessions (chat history — stub returning empty until persistence is implemented)
router.get('/sessions', (_req, res) => { res.json({ data: [] }); });
router.get('/sessions/detail', (_req, res) => { res.json({ data: { messages: [] } }); });
router.post('/sessions', (req, res) => { res.status(201).json({ data: { key: `session-${Date.now()}`, ...req.body } }); });

// Usage tracking
import { getUsageSummary, getUsageHistory, getUsageByAgent, getUsageByModel } from './usage-tracker';

router.get('/usage', async (_req, res) => { res.json({ data: await getUsageSummary() }); });
router.get('/usage/history', async (req, res) => { res.json({ data: await getUsageHistory(Number(req.query.limit) || 100) }); });
router.get('/usage/by-agent', async (_req, res) => { res.json({ data: await getUsageByAgent() }); });
router.get('/usage/by-model', async (_req, res) => { res.json({ data: await getUsageByModel() }); });

// Automations
import { automationsRouter } from '../../automations/automations.routes';
router.use('/automations', automationsRouter);
