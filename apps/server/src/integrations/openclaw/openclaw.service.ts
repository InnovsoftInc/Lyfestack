import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);
const OPENCLAW_CONFIG = path.join(process.env.HOME ?? '', '.openclaw');

export interface OpenClawAgent {
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
}

export class OpenClawService {
  async listAgents(): Promise<OpenClawAgent[]> {
    try {
      const agentsDir = path.join(OPENCLAW_CONFIG, 'agents');
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const agents: OpenClawAgent[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const configPath = path.join(agentsDir, entry.name, 'agent', 'config.json');
          const raw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
          const config = JSON.parse(raw);
          agents.push({
            name: entry.name,
            role: config.role ?? entry.name,
            model: config.model?.primary ?? 'openrouter/auto',
            systemPrompt: config.systemPrompt,
            tools: config.tools ?? [],
            status: 'idle',
          });
        } catch {
          agents.push({ name: entry.name, role: entry.name, model: 'unknown', tools: [], status: 'offline' });
        }
      }
      return agents;
    } catch (err) {
      logger.error({ err }, 'Failed to list OpenClaw agents');
      return [];
    }
  }

  async sendMessage(agentName: string, message: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `openclaw agent --agent ${agentName} -m "${message.replace(/"/g, '\\"')}"`,
        { timeout: 120000 }
      );
      return stdout.trim();
    } catch (err: any) {
      logger.error({ agent: agentName, err: err.message }, 'OpenClaw message failed');
      throw new Error(`Agent ${agentName} failed: ${err.message}`);
    }
  }

  async createAgent(config: { name: string; role: string; model: string; systemPrompt: string }): Promise<void> {
    const agentDir = path.join(OPENCLAW_CONFIG, 'agents', config.name, 'agent');
    await fs.mkdir(agentDir, { recursive: true });
    
    const agentConfig = {
      role: config.role,
      model: { primary: config.model, fallbacks: [] },
      systemPrompt: config.systemPrompt,
      tools: [],
    };
    
    await fs.writeFile(path.join(agentDir, 'config.json'), JSON.stringify(agentConfig, null, 2));
    logger.info({ agent: config.name }, 'OpenClaw agent created');
  }

  async deleteAgent(name: string): Promise<void> {
    const agentDir = path.join(OPENCLAW_CONFIG, 'agents', name);
    await fs.rm(agentDir, { recursive: true, force: true });
    logger.info({ agent: name }, 'OpenClaw agent deleted');
  }

  async getStatus(): Promise<{ running: boolean; agentCount: number }> {
    try {
      const agents = await this.listAgents();
      return { running: true, agentCount: agents.length };
    } catch {
      return { running: false, agentCount: 0 };
    }
  }
}
