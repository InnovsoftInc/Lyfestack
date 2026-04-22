import type { Request, Response } from 'express';
import { z } from 'zod';
import { goalTemplateService } from '../services/goalTemplate.service';

export function listTemplates(_req: Request, res: Response): void {
  const templates = goalTemplateService.listTemplates();
  res.status(200).json({ data: templates, count: templates.length });
}

export function getTemplate(req: Request, res: Response): void {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const template = goalTemplateService.getTemplate(id);
  res.status(200).json({ data: template });
}
