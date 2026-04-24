import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { OpenClawService } from './openclaw.service';
import {
  appendChunk,
  buildResume,
  createBuffer,
  getBuffer,
  markDone,
  markError,
  subscribe,
} from './stream-buffer';
import {
  appendMessage as appendThreadMessage,
  ensureActiveSession,
  getOrCreateThread,
} from './threads.service';
import { logger } from '../../utils/logger';

const service = new OpenClawService();

function writeSse(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export const getStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getStatus() }); } catch (err) { next(err); }
};

export const listAgents = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.listAgents() }); } catch (err) { next(err); }
};

export const createAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.createAgent(req.body);
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
};

export const deleteAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    await service.deleteAgent(name);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const getAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const agent = await service.getAgent(name);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ data: agent });
  } catch (err) { next(err); }
};

export const updateAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    await service.updateAgent(name, req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const renameAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const newName = typeof req.body?.newName === 'string' ? req.body.newName : '';
    if (!name || !newName) { res.status(400).json({ error: 'name and newName are required' }); return; }
    await service.renameAgent(name, newName);
    res.json({ success: true, data: { name: newName.trim() } });
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('Invalid agent name')) { res.status(400).json({ error: msg }); return; }
    if (msg.includes('already exists')) { res.status(409).json({ error: msg }); return; }
    if (msg.includes('Agent not found')) { res.status(404).json({ error: msg }); return; }
    next(err);
  }
};

export const listAgentFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = await service.listAgentFiles(req.params.name);
    res.json({ data: files });
  } catch (err) { next(err); }
};

export const getAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await service.getAgentFile(req.params.name, req.params.filename);
    res.json({ data: { filename: req.params.filename, content } });
  } catch (err: any) {
    if (err.message?.includes('not accessible')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const updateAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateAgentFile(req.params.name, req.params.filename, req.body.content as string);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not writable')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim()) { res.status(400).json({ error: 'message is required' }); return; }

    // Phase 2: make sure the thread exists and has an active session before we
    // hand the message to the CLI. Persist both sides of the exchange.
    const thread = await getOrCreateThread(name).catch((err) => {
      logger.warn({ err, agent: name }, 'getOrCreateThread failed; continuing without thread');
      return null;
    });
    let sessionKey: string | null = thread?.activeSessionKey ?? null;
    try {
      const ensure = await ensureActiveSession(name);
      sessionKey = ensure.sessionKey;
    } catch (err) {
      logger.warn({ err, agent: name }, 'ensureActiveSession failed');
    }

    if (thread) {
      await appendThreadMessage(name, {
        role: 'user',
        content: message,
        ...(sessionKey ? { sessionKey } : {}),
      }).catch((err) => logger.warn({ err, agent: name }, 'append user message failed'));
    }

    const response = await service.sendMessage(name, message);

    if (thread) {
      await appendThreadMessage(name, {
        role: 'agent',
        content: response,
        ...(sessionKey ? { sessionKey } : {}),
      }).catch((err) => logger.warn({ err, agent: name }, 'append agent message failed'));
    }

    res.json({ data: { response, threadId: thread?.threadId, sessionKey } });
  } catch (err) { next(err); }
};

export const streamMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const message = req.body?.message;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    if (typeof message !== 'string' || !message.trim()) { res.status(400).json({ error: 'message is required' }); return; }

    const messageId =
      typeof req.body?.messageId === 'string' && req.body.messageId.length > 0
        ? (req.body.messageId as string)
        : randomUUID();
    const explicitSessionId = typeof req.body?.sessionId === 'string' ? (req.body.sessionId as string) : undefined;

    // Phase 2: make sure a thread exists and has a healthy active session.
    // Auto-rollover happens here (before the CLI is spawned) so the visible
    // thread stays continuous even when the runtime session rotates.
    const thread = await getOrCreateThread(name).catch((err) => {
      logger.warn({ err, agent: name }, 'getOrCreateThread failed; continuing without thread');
      return null;
    });
    let activeSessionKey: string | null = thread?.activeSessionKey ?? null;
    let rolledOver = false;
    let previousSessionKey: string | null = null;
    try {
      const ensure = await ensureActiveSession(name);
      activeSessionKey = ensure.sessionKey;
      rolledOver = ensure.rolledOver;
      previousSessionKey = ensure.previousSessionKey;
    } catch (err) {
      logger.warn({ err, agent: name }, 'ensureActiveSession failed; streaming without rollover guard');
    }

    // Persist the user message to the thread before we start the CLI. This
    // way, even if the stream is interrupted, the visible history survives.
    let userMessageId: string | undefined;
    if (thread) {
      try {
        const persisted = await appendThreadMessage(name, {
          role: 'user',
          content: message,
          ...(activeSessionKey ? { sessionKey: activeSessionKey } : {}),
        });
        userMessageId = persisted.id;
      } catch (err) {
        logger.warn({ err, agent: name }, 'append user message failed');
      }
    }

    const sessionIdForBuf =
      explicitSessionId ?? (activeSessionKey?.split('/').slice(1).join('/') || undefined);
    const buf = createBuffer(messageId, name, sessionIdForBuf);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    writeSse(res, {
      type: 'init',
      messageId,
      threadId: thread?.threadId,
      activeSessionKey,
      userMessageId,
    });
    if (rolledOver && previousSessionKey && previousSessionKey !== activeSessionKey) {
      writeSse(res, {
        type: 'rollover',
        previousSessionKey,
        activeSessionKey,
      });
    }

    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    await service.sendMessageStream(
      name,
      message,
      (chunk) => {
        const cursor = appendChunk(buf.messageId, chunk);
        if (!clientGone) writeSse(res, { chunk, cursor });
      },
      (response) => {
        markDone(buf.messageId, response);
        // Fire-and-forget thread persistence — don't hold the stream response.
        if (thread) {
          void appendThreadMessage(name, {
            role: 'agent',
            content: response,
            ...(activeSessionKey ? { sessionKey: activeSessionKey } : {}),
          }).catch((err) => logger.warn({ err, agent: name }, 'append agent message failed'));
        }
        if (!clientGone) {
          writeSse(res, { done: true, response, threadId: thread?.threadId, activeSessionKey });
          res.end();
        }
      },
      (err) => {
        markError(buf.messageId, err.message);
        if (thread) {
          void appendThreadMessage(name, {
            role: 'agent',
            content: err.message,
            isError: true,
            ...(activeSessionKey ? { sessionKey: activeSessionKey } : {}),
          }).catch((persistErr) => logger.warn({ err: persistErr, agent: name }, 'append error message failed'));
        }
        if (!clientGone) {
          writeSse(res, { error: err.message });
          res.end();
        }
      },
      (toolName) => {
        if (!clientGone) writeSse(res, { type: 'tool_use', name: toolName });
      },
    );
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      writeSse(res, { error: 'Internal server error' });
      res.end();
    }
  }
};

export const resumeStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = (req.query.messageId as string) ?? (req.body?.messageId as string);
    const cursorParam = (req.query.cursor as string) ?? (req.body?.cursor as string);
    if (!messageId) {
      res.status(400).json({ error: 'messageId is required' });
      return;
    }
    const fromCursor = Number(cursorParam) || 0;
    const replay = buildResume(messageId, fromCursor);
    if (!replay) {
      res.status(410).json({ error: 'stream evicted', code: 'STREAM_EVICTED' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    writeSse(res, { type: 'init', messageId, resumed: true, fromCursor });

    for (const item of replay.missedChunks) {
      writeSse(res, item);
    }

    if (replay.finalEvent) {
      if (replay.finalEvent.type === 'done') {
        writeSse(res, { done: true, response: replay.finalEvent.response });
      } else if (replay.finalEvent.type === 'error') {
        writeSse(res, { error: replay.finalEvent.message });
      }
      res.end();
      return;
    }

    let clientGone = false;
    const unsubscribe = subscribe(messageId, (event) => {
      if (clientGone) return;
      if (event.type === 'chunk') {
        writeSse(res, { chunk: event.chunk, cursor: event.cursor });
      } else if (event.type === 'done') {
        writeSse(res, { done: true, response: event.response });
        res.end();
      } else if (event.type === 'error') {
        writeSse(res, { error: event.message });
        res.end();
      } else if (event.type === 'tool') {
        writeSse(res, event.payload);
      }
    });

    req.on('close', () => {
      clientGone = true;
      unsubscribe();
    });

    // Safety: if buffer was already done by the time we subscribed (race), close.
    const buf = getBuffer(messageId);
    if (buf?.done) {
      writeSse(res, buf.error ? { error: buf.error } : { done: true, response: buf.response ?? '' });
      res.end();
      unsubscribe();
    }
  } catch (err) {
    if (!res.headersSent) next(err);
    else { writeSse(res, { error: 'Internal server error' }); res.end(); }
  }
};

export const getStreamStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId;
    if (!messageId) { res.status(400).json({ error: 'messageId required' }); return; }
    const buf = getBuffer(messageId);
    if (!buf) {
      res.status(410).json({ error: 'stream evicted', code: 'STREAM_EVICTED' });
      return;
    }
    res.json({
      data: {
        messageId: buf.messageId,
        agentId: buf.agentId,
        sessionId: buf.sessionId,
        cursor: buf.chunks.length,
        done: buf.done,
        error: buf.error,
      },
    });
  } catch (err) { next(err); }
};

export const getConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getConfig() }); } catch (err) { next(err); }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateConfig(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const getAuthProfiles = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getAuthProfiles() }); } catch (err) { next(err); }
};

export const updateAuthProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const { key } = req.body as { key: string };
    if (!name || !key) { res.status(400).json({ error: 'Profile name and key required' }); return; }
    await service.updateAuthProfile(name, key);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not found')) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
};

export const getAgentSkills = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getAgentSkills(req.params.name) }); } catch (err) { next(err); }
};

export const setAgentSkills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skills } = req.body as { skills: unknown };
    if (!Array.isArray(skills)) { res.status(400).json({ error: 'skills must be an array' }); return; }
    await service.setAgentSkills(req.params.name, skills as string[]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const listSkills = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.listSkills() }); } catch (err) { next(err); }
};

export const getSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = await service.getSkill(req.params.name);
    if (!skill) { res.status(404).json({ error: 'Skill not found' }); return; }
    res.json({ data: skill });
  } catch (err) { next(err); }
};

export const createSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, content } = req.body as { name: string; content: string };
    if (!name || !content) { res.status(400).json({ error: 'name and content required' }); return; }
    await service.createSkill(name, content);
    res.status(201).json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('already exists')) { res.status(409).json({ error: err.message }); return; }
    next(err);
  }
};

export const updateSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body as { content: string };
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    await service.updateSkill(req.params.name, content);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const deleteSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteSkill(req.params.name);
    res.json({ success: true });
  } catch (err) { next(err); }
};
