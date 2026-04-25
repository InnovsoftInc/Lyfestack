import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { OpenClawService, resolveOpenClawAgentId, type MessageAttachmentInput } from './openclaw.service';
import {
  appendChunk,
  appendToolEvent,
  buildResume,
  createBuffer,
  getBuffer,
  getLatestActiveBuffer,
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

function normalizeAttachments(input: unknown): MessageAttachmentInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((attachment) => attachment && typeof attachment === 'object')
    .map((attachment: any) => ({
      ...(attachment.id ? { id: String(attachment.id) } : {}),
      name: String(attachment.name ?? 'attachment'),
      type: attachment.type === 'image' ? 'image' : attachment.type === 'text' ? 'text' : 'file',
      mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
      size: Number(attachment.size ?? 0) || 0,
      ...(typeof attachment.textContent === 'string' ? { textContent: attachment.textContent } : {}),
      ...(typeof attachment.dataBase64 === 'string' ? { dataBase64: attachment.dataBase64 } : {}),
    }));
}

function writeSse(res: Response, payload: Record<string, unknown>): void {
  logger.debug({ payload }, 'openclaw sse event');
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export const getStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getStatus() }); } catch (err) { next(err); }
};

export const listAgents = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.listAgents() }); } catch (err) { next(err); }
};

export const listCommands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    res.json({ data: await service.listCommands(agentId) });
  } catch (err) { next(err); }
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
    let { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    name = await resolveOpenClawAgentId(name);
    const agent = await service.getAgent(name);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ data: agent });
  } catch (err) { next(err); }
};

export const updateAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
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
    const files = await service.listAgentFiles(req.params.name!);
    res.json({ data: files });
  } catch (err) { next(err); }
};

export const getAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await service.getAgentFile(req.params.name!, req.params.filename!);
    res.json({ data: { filename: req.params.filename!, content } });
  } catch (err: any) {
    if (err.message?.includes('not accessible')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const updateAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateAgentFile(req.params.name!, req.params.filename!, req.body.content as string);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not writable')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    name = await resolveOpenClawAgentId(name);
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    const attachments = normalizeAttachments(req.body?.attachments);
    if (!message.trim() && attachments.length === 0) { res.status(400).json({ error: 'message or attachments are required' }); return; }

    // Lyfestack owns only the visible transcript. OpenClaw owns runtime
    // session selection, memory, usage, and compression.
    const thread = await getOrCreateThread(name).catch((err) => {
      logger.warn({ err, agent: name }, 'getOrCreateThread failed; continuing without thread');
      return null;
    });
    const activeSession = thread
      ? await ensureActiveSession(name).catch((err) => {
          logger.warn({ err, agent: name }, 'ensureActiveSession failed; continuing with default session');
          return null;
        })
      : null;

    if (thread) {
      await appendThreadMessage(name, {
        role: 'user',
        content: message,
        ...(attachments.length ? {
          attachments: attachments.map((attachment) => ({
            id: attachment.id ?? randomUUID(),
            name: attachment.name,
            type: attachment.type,
            mimeType: attachment.mimeType,
            size: attachment.size,
          })),
        } : {}),
      }).catch((err) => logger.warn({ err, agent: name }, 'append user message failed'));
    }

    const response = await service.sendMessage(name, message, attachments, activeSession?.sessionKey ?? thread?.activeSessionKey ?? null);

    if (thread) {
      await appendThreadMessage(name, {
        role: 'agent',
        content: response,
      }).catch((err) => logger.warn({ err, agent: name }, 'append agent message failed'));
    }

    res.json({ data: { response, threadId: thread?.threadId, activeSessionKey: activeSession?.sessionKey ?? thread?.activeSessionKey ?? null } });
  } catch (err) { next(err); }
};

export const streamMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { name } = req.params;
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    const attachments = normalizeAttachments(req.body?.attachments);
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    name = await resolveOpenClawAgentId(name);
    if (!message.trim() && attachments.length === 0) { res.status(400).json({ error: 'message or attachments are required' }); return; }

    const messageId =
      typeof req.body?.messageId === 'string' && req.body.messageId.length > 0
        ? (req.body.messageId as string)
        : randomUUID();
    // Lyfestack owns only the visible transcript. OpenClaw owns runtime
    // session selection, memory, usage, and compression.
    const thread = await getOrCreateThread(name).catch((err) => {
      logger.warn({ err, agent: name }, 'getOrCreateThread failed; continuing without thread');
      return null;
    });
    const activeSession = thread
      ? await ensureActiveSession(name).catch((err) => {
          logger.warn({ err, agent: name }, 'ensureActiveSession failed; continuing with default session');
          return null;
        })
      : null;

    // Persist the user message to the thread before we start the CLI. This
    // way, even if the stream is interrupted, the visible history survives.
    let userMessageId: string | undefined;
    if (thread) {
      try {
        const persisted = await appendThreadMessage(name, {
          role: 'user',
          content: message,
          ...(activeSession?.sessionKey ? { sessionKey: activeSession.sessionKey } : {}),
          ...(attachments.length ? {
            attachments: attachments.map((attachment) => ({
              id: attachment.id ?? randomUUID(),
              name: attachment.name,
              type: attachment.type,
              mimeType: attachment.mimeType,
              size: attachment.size,
            })),
          } : {}),
        });
        userMessageId = persisted.id;
      } catch (err) {
        logger.warn({ err, agent: name }, 'append user message failed');
      }
    }

    const buf = createBuffer(messageId, name);

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
      activeSessionKey: activeSession?.sessionKey ?? thread?.activeSessionKey ?? null,
      userMessageId,
    });

    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    await service.sendMessageStream(
      name,
      message,
      attachments,
      activeSession?.sessionKey ?? thread?.activeSessionKey ?? null,
      (chunk) => {
        const cursor = appendChunk(buf.messageId, chunk);
        if (!clientGone) writeSse(res, { chunk, cursor });
      },
      async (response) => {
        let persisted: Awaited<ReturnType<typeof appendThreadMessage>> | null = null;
        if (thread) {
          try {
            persisted = await appendThreadMessage(name, {
              role: 'agent',
              content: response,
              ...(activeSession?.sessionKey ? { sessionKey: activeSession.sessionKey } : {}),
            });
          } catch (err) {
            logger.warn({ err, agent: name }, 'append agent message failed');
          }
        }
        markDone(buf.messageId, response);
        if (!clientGone) {
          writeSse(res, { done: true, response, threadId: thread?.threadId, activeSessionKey: activeSession?.sessionKey ?? thread?.activeSessionKey ?? null, assistantMessageId: persisted?.id ?? null });
          res.end();
        }
      },
      async (err) => {
        if (thread) {
          try {
            await appendThreadMessage(name, {
              role: 'agent',
              content: err.message,
              isError: true,
              ...(activeSession?.sessionKey ? { sessionKey: activeSession.sessionKey } : {}),
            });
          } catch (persistErr) {
            logger.warn({ err: persistErr, agent: name }, 'append error message failed');
          }
        }
        markError(buf.messageId, err.message);
        if (!clientGone) {
          writeSse(res, { error: err.message });
          res.end();
        }
      },
      (toolName, phase = 'use') => {
        const payload = phase === 'result'
          ? { type: 'tool_result', name: toolName }
          : { type: 'tool_use', name: toolName };
        appendToolEvent(buf.messageId, payload);
        if (!clientGone) writeSse(res, payload);
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

export const getActiveStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    name = await resolveOpenClawAgentId(name);
    const buf = getLatestActiveBuffer(name);
    res.json({
      data: buf ? {
        messageId: buf.messageId,
        agentId: buf.agentId,
        sessionId: buf.sessionId,
        cursor: buf.chunks.length,
        done: buf.done,
        error: buf.error,
        response: buf.response,
        createdAt: buf.createdAt,
        updatedAt: buf.updatedAt,
      } : null,
    });
  } catch (err) { next(err); }
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

    const missedEvents = replay.missedEvents.length > 0 ? replay.missedEvents : replay.missedChunks;
    for (const item of missedEvents) {
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
  try { res.json({ data: await service.getAgentSkills(req.params.name!) }); } catch (err) { next(err); }
};

export const setAgentSkills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skills } = req.body as { skills: unknown };
    if (!Array.isArray(skills)) { res.status(400).json({ error: 'skills must be an array' }); return; }
    await service.setAgentSkills(req.params.name!, skills as string[]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const listSkills = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.listSkills() }); } catch (err) { next(err); }
};

export const getSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = await service.getSkill(req.params.name!);
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
    await service.updateSkill(req.params.name!, content);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const deleteSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteSkill(req.params.name!);
    res.json({ success: true });
  } catch (err) { next(err); }
};
