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

export { router as openclawRoutes };
