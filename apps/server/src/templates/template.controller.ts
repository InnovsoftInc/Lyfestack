import type { Request, Response, NextFunction } from 'express';
import { templateService } from './template.service';
import type { TemplateCategory } from './template.types';

export async function getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category } = req.query;
    const templates = category
      ? await templateService.getByCategory(category as TemplateCategory)
      : await templateService.getAll();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: { code: 'MISSING_ID', message: 'Template ID required' } });
      return;
    }
    const template = await templateService.getById(id);
    res.json({ template });
  } catch (err) {
    next(err);
  }
}
