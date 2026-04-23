import * as fs from 'fs/promises';
import * as path from 'path';

export const OPENCLAW_HOME = path.join(process.env.HOME ?? '', '.openclaw');
export const OPENCLAW_JSON = path.join(OPENCLAW_HOME, 'openclaw.json');

let writeQueue: Promise<void> = Promise.resolve();

export async function readOpenclawJson<T = Record<string, unknown>>(): Promise<T> {
  const raw = await fs.readFile(OPENCLAW_JSON, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function writeOpenclawJson(data: unknown): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const json = JSON.stringify(data, null, 2);
    const tmp = `${OPENCLAW_JSON}.tmp`;
    await fs.writeFile(tmp, json);
    await fs.rename(tmp, OPENCLAW_JSON);
  });
  return writeQueue;
}

export async function patchOpenclawJson<T = Record<string, unknown>>(
  mutator: (current: T) => T | void,
): Promise<T> {
  const current = await readOpenclawJson<T>();
  const next = mutator(current);
  const resolved = (next ?? current) as T;
  await writeOpenclawJson(resolved);
  return resolved;
}

export function resolveEnvValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('env:')) {
    const varName = raw.slice(4);
    return process.env[varName];
  }
  return raw;
}
