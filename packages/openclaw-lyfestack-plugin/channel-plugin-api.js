import { createChannelPluginBase, createChatChannelPlugin } from 'openclaw/plugin-sdk/channel-core';
import { createTopLevelChannelConfigAdapter } from 'openclaw/plugin-sdk/channel-config-helpers';

function getLyfeStackChannelConfig(ctx) {
  return ctx?.cfg?.channels?.lyfestack ?? ctx?.cfg?.plugins?.entries?.lyfestack?.config ?? {};
}

async function sendToLyfeStack(payload, ctx) {
  const channelConfig = getLyfeStackChannelConfig(ctx);
  const receiverUrl = String(channelConfig.receiverUrl ?? '').trim();
  if (!receiverUrl) {
    throw new Error('LyfeStack receiverUrl is required in channels.lyfestack');
  }
  const webhookSecret = String(channelConfig.webhookSecret ?? '').trim();
  const res = await fetch(receiverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookSecret ? { 'X-LyfeStack-Secret': webhookSecret } : {}),
    },
    body: JSON.stringify({
      ...payload,
      createdAt: payload.createdAt ?? new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LyfeStack receiver rejected delivery (${res.status}): ${detail || res.statusText}`);
  }

  const json = await res.json().catch(() => null);
  const messageId = json?.data?.messageId ?? payload.deliveryKey;
  return { messageId };
}

const configAdapter = createTopLevelChannelConfigAdapter({
  sectionKey: 'lyfestack',
  resolveAccount: (cfg) => cfg.channels?.lyfestack ?? {},
  listAccountIds: (cfg) => (cfg.channels?.lyfestack ? ['default'] : []),
  defaultAccountId: () => 'default',
  inspectAccount: (cfg) => ({
    configured: Boolean(cfg.channels?.lyfestack?.receiverUrl),
  }),
  clearBaseFields: ['receiverUrl', 'webhookSecret'],
  resolveAllowFrom: () => undefined,
  formatAllowFrom: (allowFrom) => allowFrom.map(String),
  resolveDefaultTo: () => undefined,
});

const base = createChannelPluginBase({
  id: 'lyfestack',
  meta: {
    label: 'LyfeStack',
    selectionLabel: 'LyfeStack',
    detailLabel: 'LyfeStack bridge',
    docsPath: '/integrations/lyfestack',
    docsLabel: 'lyfestack',
    blurb: 'Streams OpenClaw replies and progress into LyfeStack.',
    systemImage: 'message-square',
    markdownCapable: true,
  },
  config: configAdapter,
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      receiverUrl: { type: 'string' },
      webhookSecret: { type: 'string' },
    },
  },
  capabilities: {
    chatTypes: ['direct'],
    blockStreaming: true,
  },
});

export const lyfestackPlugin = createChatChannelPlugin({
  base,
  outbound: {
    deliveryMode: 'direct',
    sendPayload: async (ctx) => {
      const deliveryKey = [ctx.to, ctx.threadId ?? '', ctx.replyToId ?? ''].join(':');
      const result = await sendToLyfeStack({
        deliveryKey,
        channel: 'lyfestack',
        target: ctx.to,
        text: typeof ctx.text === 'string' ? ctx.text : '',
        threadId: ctx.threadId ?? null,
        replyToId: ctx.replyToId ?? null,
        accountId: ctx.accountId ?? null,
        payload: ctx.payload,
      }, ctx);
      return {
        channel: 'lyfestack',
        messageId: result.messageId,
        chatId: ctx.to,
        conversationId: ctx.to,
        meta: {
          deliveryKey,
          threadId: ctx.threadId ?? null,
          replyToId: ctx.replyToId ?? null,
        },
      };
    },
    sendText: async (ctx) => {
      const deliveryKey = [ctx.to, ctx.threadId ?? '', ctx.replyToId ?? ''].join(':');
      const result = await sendToLyfeStack({
        deliveryKey,
        channel: 'lyfestack',
        target: ctx.to,
        text: ctx.text,
        threadId: ctx.threadId ?? null,
        replyToId: ctx.replyToId ?? null,
        accountId: ctx.accountId ?? null,
      }, ctx);
      return {
        channel: 'lyfestack',
        messageId: result.messageId,
        chatId: ctx.to,
        conversationId: ctx.to,
        meta: {
          deliveryKey,
        },
      };
    },
  },
});
