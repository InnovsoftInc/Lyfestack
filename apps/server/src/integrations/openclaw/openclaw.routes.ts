import { Router } from 'express';
import {
  getStatus,
  listAgents,
  createAgent,
  deleteAgent,
  sendMessage,
  listSessions,
  getSession,
  createSession,
} from './openclaw.controller';

const router = Router();

// Agent management
router.get('/status', getStatus);
router.get('/agents', listAgents);
router.post('/agents', createAgent);
router.delete('/agents/:name', deleteAgent);
router.post('/agents/:name/message', sendMessage);

// Session management
router.get('/sessions', listSessions);
router.get('/sessions/detail', getSession);
router.post('/sessions', createSession);

export { router as openclawRoutes };
