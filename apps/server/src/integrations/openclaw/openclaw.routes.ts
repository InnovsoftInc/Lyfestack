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
  getUsage,
  getUsageHistory,
  getUsageByAgent,
  getUsageByModel,
} from './openclaw.controller';

const router = Router();

router.get('/status', getStatus);
router.get('/agents', listAgents);
router.post('/agents', createAgent);
router.get('/agents/:name', getAgent);
router.put('/agents/:name', updateAgent);
router.delete('/agents/:name', deleteAgent);
router.get('/agents/:name/files', listAgentFiles);
router.get('/agents/:name/files/:filename', getAgentFile);
router.put('/agents/:name/files/:filename', updateAgentFile);
router.post('/agents/:name/message', sendMessage);

router.get('/usage', getUsage);
router.get('/usage/history', getUsageHistory);
router.get('/usage/by-agent', getUsageByAgent);
router.get('/usage/by-model', getUsageByModel);

export { router as openclawRoutes };
