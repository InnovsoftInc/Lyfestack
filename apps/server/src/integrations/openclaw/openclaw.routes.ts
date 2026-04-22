import { Router } from 'express';
import {
  getStatus,
  listAgents,
  createAgent,
  deleteAgent,
  sendMessage,
} from './openclaw.controller';

const router = Router();

router.get('/status', getStatus);
router.get('/agents', listAgents);
router.post('/agents', createAgent);
router.delete('/agents/:name', deleteAgent);
router.post('/agents/:name/message', sendMessage);

export { router as openclawRoutes };
