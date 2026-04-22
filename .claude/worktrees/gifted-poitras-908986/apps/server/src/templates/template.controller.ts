import type { Request, Response, NextFunction } from 'express';
import { templateService } from './template.service';
import type { TemplateCategory } from './template.types';

export function getTemplates(req: Request, res: Response, next: NextFunction): void {
  try {
    const { category } = req.query;
    const templates = category
      ? templateService.getByCategory(category as TemplateCategory)
      : templateService.getAll();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

export function getTemplateById(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ error: { code: 'MISSING_ID', message: 'Template ID required' } });
      return;
    }
    const template = templateService.getById(id);
    res.json({ template });
  } catch (err) {
    next(err);
  }
}
