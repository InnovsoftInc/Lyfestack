import { Router } from 'express';
import { listTemplates, getTemplate, getCategories } from '../controllers/template.controller';

const router = Router();

router.get('/', listTemplates);
router.get('/categories', getCategories);
router.get('/:id', getTemplate);

export default router;
