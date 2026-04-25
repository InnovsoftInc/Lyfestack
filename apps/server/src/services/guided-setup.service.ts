import { v4 as uuidv4 } from 'uuid';
import { aiClient } from '../agents/ai-client';
import type { ChatMessage } from '../agents/ai-client';
import { templateService } from '../templates/template.service';
import { logger } from '../utils/logger';
import type { Response } from 'express';

export interface GuidedQuestion {
  sessionId: string;
  step: number;
  estimatedTotalSteps: number;
  question: string;
  context?: string;
  inputType: 'text' | 'select' | 'multiselect' | 'slider' | 'number' | 'toggle';
  options?: string[];
  min?: number;
  max?: number;
  default?: number;
  unit?: string;
  placeholder?: string;
  isLastQuestion?: boolean;
}

interface QAPair {
  question: string;
  answer: string;
}

interface SessionData {
  templateId: string;
  templateName: string;
  templateDescription: string;
  messages: ChatMessage[];
  answers: QAPair[];
  step: number;
}

const sessions = new Map<string, SessionData>();

const GUIDED_SYSTEM_PROMPT = `You are an expert life coach and goal-setting specialist for Lyfestack, a personal growth app. Your job is to guide users through a personalized goal setup process by asking one focused, insightful question at a time.

You will receive the template context and previous Q&A. Based on this, determine the single most important next question to uncover what the user truly needs. After 6-9 questions (depending on depth of answers), signal you have enough context.

CRITICAL: Always respond with ONLY valid JSON matching this exact structure:
{
  "step": <current step number>,
  "estimatedTotalSteps": <your current estimate, between 6 and 9>,
  "question": "<the question text — concise, warm, motivational>",
  "context": "<1 sentence explaining why this matters for their plan>",
  "inputType": "<one of: text, select, multiselect, slider, number, toggle>",
  "options": ["<option>", ...],
  "min": <number>,
  "max": <number>,
  "default": <number>,
  "unit": "<e.g. hours/week, kg, %>",
  "placeholder": "<hint text for text inputs>",
  "isLastQuestion": <true or false>
}

Input type selection rules:
- select: 3-6 mutually exclusive options (current fitness level, primary goal, etc.)
- multiselect: 4-8 options where multiple apply (barriers, preferences, days available)
- slider: natural range like 1-10 or 0-100 (motivation level, effort capacity)
- number: specific numeric values (target weight, weekly hours, budget)
- toggle: binary yes/no decisions (have gym access, have prior experience)
- text: only for truly open-ended answers (specific goal description, notes)

Adaptation rules:
- If they indicate low experience → ask simpler follow-up questions
- If they indicate high motivation → ask about stretch goals
- After learning constraints → ask about preferences within those constraints
- Set isLastQuestion: true when you have sufficient context for a comprehensive plan

Do not include null/undefined fields — omit optional fields entirely when not needed.`;

function buildUserTurn(
  templateName: string,
  templateDescription: string,
  answers: QAPair[],
  step: number,
): string {
  const history =
    answers.length > 0
      ? `\n\nPrevious answers:\n${answers.map((a, i) => `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`).join('\n')}`
      : '';
  return `Goal template: ${templateName}\nTemplate description: ${templateDescription}\nCurrent step: ${step}${history}\n\nProvide the next question as JSON.`;
}

function parseQuestion(raw: string, sessionId: string, step: number): GuidedQuestion {
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch?.[1] ?? raw;
    const parsed = JSON.parse(jsonStr.trim()) as Partial<GuidedQuestion>;
    return {
      sessionId,
      step: parsed.step ?? step,
      estimatedTotalSteps: parsed.estimatedTotalSteps ?? 8,
      question: parsed.question ?? 'What specific outcome do you want to achieve?',
      ...(parsed.context !== undefined && { context: parsed.context }),
      inputType: parsed.inputType ?? 'text',
      ...(parsed.options !== undefined && { options: parsed.options }),
      ...(parsed.min !== undefined && { min: parsed.min }),
      ...(parsed.max !== undefined && { max: parsed.max }),
      ...(parsed.default !== undefined && { default: parsed.default }),
      ...(parsed.unit !== undefined && { unit: parsed.unit }),
      ...(parsed.placeholder !== undefined && { placeholder: parsed.placeholder }),
      isLastQuestion: parsed.isLastQuestion ?? false,
    };
  } catch (err) {
    logger.warn({ err, raw }, 'Failed to parse guided question JSON — using fallback');
    return {
      sessionId,
      step,
      estimatedTotalSteps: 8,
      question: 'What specific outcome do you want to achieve with this goal?',
      inputType: 'text',
      placeholder: 'Describe your desired outcome...',
      isLastQuestion: step >= 8,
    };
  }
}

export async function startGuidedSession(templateId: string): Promise<GuidedQuestion> {
  const template = await templateService.getById(templateId);
  const sessionId = uuidv4();
  const step = 1;

  const userTurn = buildUserTurn(template.name, template.description, [], step);
  const messages: ChatMessage[] = [
    { role: 'system', content: GUIDED_SYSTEM_PROMPT },
    { role: 'user', content: userTurn },
  ];

  const result = await aiClient.complete(messages, { temperature: 0.6, maxTokens: 512 });

  sessions.set(sessionId, {
    templateId,
    templateName: template.name,
    templateDescription: template.description,
    messages: [...messages, { role: 'assistant', content: result.content }],
    answers: [],
    step,
  });

  return parseQuestion(result.content, sessionId, step);
}

export async function submitAnswer(sessionId: string, answer: string): Promise<GuidedQuestion> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found or expired');

  const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant');
  let lastQuestion = 'Previous question';
  try {
    const p = JSON.parse(lastAssistant?.content ?? '{}') as { question?: string };
    if (p.question) lastQuestion = p.question;
  } catch { /* ok */ }

  session.answers.push({ question: lastQuestion, answer });
  session.step += 1;

  const userTurn = buildUserTurn(
    session.templateName,
    session.templateDescription,
    session.answers,
    session.step,
  );
  session.messages.push({ role: 'user', content: userTurn });

  const result = await aiClient.complete(session.messages, { temperature: 0.6, maxTokens: 512 });
  session.messages.push({ role: 'assistant', content: result.content });

  return parseQuestion(result.content, sessionId, session.step);
}

function sseWrite(res: Response, type: string, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
}

export async function streamPlanGeneration(sessionId: string, res: Response): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseWrite(res, 'error', { message: 'Session not found or expired' });
    res.end();
    return;
  }

  const template = await templateService.getById(session.templateId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    sseWrite(res, 'thinking', { message: 'Analyzing your responses...' });

    const answerSummary = session.answers
      .map((a, i) => `${i + 1}. ${a.question}\n   → ${a.answer}`)
      .join('\n');

    sseWrite(res, 'progress', { message: 'Building your personalized milestones...' });

    const planPrompt = `Create a detailed, personalized goal plan for a user who chose the "${session.templateName}" template.

User's answers:
${answerSummary}

Template defaults:
- Duration: ${template.durationDays} days
- Default milestones: ${Array.isArray(template.milestones) ? template.milestones.join(', ') : ''}

Return ONLY valid JSON:
{
  "goalTitle": "<personalized title>",
  "goalDescription": "<motivating 2-sentence description tailored to their answers>",
  "estimatedDurationDays": <number>,
  "milestones": [
    {
      "title": "<milestone title>",
      "description": "<what they achieve at this milestone>",
      "dueDayOffset": <days from start>,
      "tasks": [
        {
          "title": "<task title>",
          "description": "<specific action to take>",
          "estimatedMinutes": <number>,
          "dayOffset": <day from start>
        }
      ]
    }
  ],
  "insights": [
    "<personalized insight based on their specific context>",
    "<second insight>"
  ]
}`;

    const planMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a strategic planning specialist. Create detailed, personalized goal plans. Respond with valid JSON only — no markdown, no explanation.',
      },
      { role: 'user', content: planPrompt },
    ];

    const result = await aiClient.complete(planMessages, { temperature: 0.4, maxTokens: 2048 });

    sseWrite(res, 'progress', { message: 'Finalizing your action plan...' });

    let planData: Record<string, unknown>;
    try {
      const jsonMatch =
        result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ??
        result.content.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? result.content;
      planData = JSON.parse(jsonStr.trim()) as Record<string, unknown>;
    } catch {
      planData = {
        goalTitle: session.templateName,
        goalDescription: 'Your personalized plan has been created based on your answers.',
        estimatedDurationDays: template.durationDays,
        milestones: [],
        insights: [],
      };
    }

    sseWrite(res, 'complete', {
      message: 'Your plan is ready!',
      plan: planData,
      sessionId,
      templateId: session.templateId,
    });

    sessions.delete(sessionId);
  } catch (err) {
    logger.error({ err, sessionId }, 'Plan generation SSE failed');
    sseWrite(res, 'error', { message: 'Failed to generate plan. Please try again.' });
  } finally {
    res.end();
  }
}
