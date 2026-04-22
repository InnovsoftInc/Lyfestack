import { Router, Request, Response } from 'express';
import { CalendarService } from '../integrations/calendar/calendar.service';
import { BufferService } from '../integrations/buffer/buffer.service';

const router = Router();
const calendarService = new CalendarService();
const bufferService = new BufferService();

// Calendar
router.get('/calendar/auth', (req: Request, res: Response) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/calendar/callback`;
  res.json({ url: calendarService.getAuthUrl(redirectUri) });
});

router.get('/calendar/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/calendar/callback`;
  const tokens = await calendarService.exchangeCode(code as string, redirectUri);
  res.json({ success: true, tokens });
});

// Buffer
router.get('/buffer/auth', (req: Request, res: Response) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/buffer/callback`;
  res.json({ url: bufferService.getAuthUrl(redirectUri) });
});

router.get('/buffer/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/buffer/callback`;
  const accessToken = await bufferService.exchangeCode(code as string, redirectUri);
  res.json({ success: true, accessToken });
});

export { router as integrationRoutes };
