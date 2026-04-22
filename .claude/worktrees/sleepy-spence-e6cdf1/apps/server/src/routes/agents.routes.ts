import { Router } from 'express';
import { dispatchAction, listAgents } from '../controllers/agent.controller';

const router = Router();

router.get('/', listAgents);
router.post('/action', dispatchAction);

export default router;
