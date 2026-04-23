import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
}

export async function embed(text: string): Promise<{ vector: number[]; model: string }> {
  if (!text.trim()) throw new Error('text required');
  await checkBudget();
  const resolved = await resolveModel('embeddings');
  const res = await openaiJson<EmbeddingResponse>({
    path: '/embeddings',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: { model: resolved.model, input: text.slice(0, 8000) },
  });
  return { vector: res.data[0]?.embedding ?? [], model: res.model };
}

const BATCH_SIZE = 96;

export async function embedBatch(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  if (texts.length === 0) return { vectors: [], model: '' };
  await checkBudget();
  const resolved = await resolveModel('embeddings');
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const res = await openaiJson<EmbeddingResponse>({
      path: '/embeddings',
      method: 'POST',
      apiKey: resolved.apiKey,
      body: { model: resolved.model, input: slice },
    });
    res.data.sort((a, b) => a.index - b.index);
    for (const item of res.data) vectors.push(item.embedding);
  }
  return { vectors, model: resolved.model };
}
