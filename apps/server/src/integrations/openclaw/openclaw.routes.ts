import { Router } from 'express';
import { openClawController } from './openclaw.controller';

export function createOpenClawRouter(): Router {
  const router = Router();

  router.get('/status', openClawController.getStatus);
  router.get('/agents', openClawController.listAgents);
  router.post('/agents', openClawController.createAgent);
  router.get('/agents/:name', openClawController.getAgent);
  router.delete('/agents/:name', openClawController.deleteAgent);
  router.post('/agents/:name/message', openClawController.sendMessage);
  router.get('/agents/:name/history', openClawController.getHistory);
  router.get('/agents/:name/status', openClawController.getAgentStatus);

  return router;
}
