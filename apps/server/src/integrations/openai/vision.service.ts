import * as fs from 'fs/promises';
import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';
import { getMediaPath } from '../openclaw/media.service';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

export interface VisionInput {
  prompt: string;
  imageUrl?: string;
  mediaId?: string; // "<source>/<filename>" relative to ~/.openclaw/media/
}

export interface VisionResult {
  answer: string;
  model: string;
}

function inferMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

async function buildImagePart(input: VisionInput): Promise<{ type: 'image_url'; image_url: { url: string } }> {
  if (input.imageUrl) {
    return { type: 'image_url', image_url: { url: input.imageUrl } };
  }
  if (input.mediaId) {
    const [sub, ...rest] = input.mediaId.split('/');
    const filename = rest.join('/');
    if (!sub || !filename) throw new Error('mediaId must look like "<source>/<filename>"');
    const fp = await getMediaPath(sub, filename);
    if (!fp) throw new Error(`media not found: ${input.mediaId}`);
    const buf = await fs.readFile(fp);
    const dataUri = `data:${inferMime(filename)};base64,${buf.toString('base64')}`;
    return { type: 'image_url', image_url: { url: dataUri } };
  }
  throw new Error('imageUrl or mediaId is required');
}

export async function analyze(input: VisionInput): Promise<VisionResult> {
  await checkBudget();
  const resolved = await resolveModel('vision');
  const imagePart = await buildImagePart(input);
  const result = await openaiJson<ChatResponse>({
    path: '/chat/completions',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: {
      model: resolved.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: input.prompt || 'Describe this image briefly.' },
            imagePart,
          ],
        },
      ],
      max_tokens: 512,
    },
  });
  return {
    answer: (result.choices?.[0]?.message?.content ?? '').trim(),
    model: result.model ?? resolved.model,
  };
}
