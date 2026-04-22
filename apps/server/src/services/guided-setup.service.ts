import { OpenClawService } from '../integrations/openclaw/openclaw.service';

export interface GuidedQuestion {
  question: string;
  inputType: 'text' | 'number' | 'select' | 'slider' | 'date';
  options?: string[];
  placeholder?: string;
  context?: string;
  min?: number;
  max?: number;
  unit?: string;
  isLastQuestion: boolean;
}

export interface DiagnosticAnswer {
  questionId: string;
  value: string | number | boolean;
}

const openClawService = new OpenClawService();

export class GuidedSetupService {
  async getNextQuestion(
    templateName: string,
    previousAnswers: DiagnosticAnswer[],
    agentName = 'main',
  ): Promise<GuidedQuestion> {
    const answersText = previousAnswers.length > 0
      ? previousAnswers.map((a) => `${a.questionId}: ${a.value}`).join('\n')
      : 'None yet';

    const prompt =
      `You are helping a user set up a goal. Based on the template '${templateName}' ` +
      `and their previous answers:\n${answersText}\n\n` +
      `Ask the NEXT question. Return ONLY valid JSON: ` +
      `{"question":"...","inputType":"text|number|select|slider|date","options":[],"placeholder":"...","context":"...","min":0,"max":0,"unit":"...","isLastQuestion":false}`;

    const raw = await openClawService.sendMessage(agentName, prompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Agent returned invalid JSON for guided question');
    }

    return JSON.parse(jsonMatch[0]) as GuidedQuestion;
  }

  async generatePlan(
    templateName: string,
    answers: DiagnosticAnswer[],
    agentName = 'main',
  ): Promise<unknown> {
    const answersText = answers.map((a) => `${a.questionId}: ${a.value}`).join('\n');

    const prompt =
      `Generate a structured goal plan for the template '${templateName}' based on these answers:\n` +
      `${answersText}\n\n` +
      `Return ONLY valid JSON with: {"tasks":[{"title":"...","description":"...","type":"HABIT|TASK|MILESTONE","dayOffset":0,"durationMinutes":30}],"milestones":[],"summary":"..."}`;

    const raw = await openClawService.sendMessage(agentName, prompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Agent returned invalid JSON for plan');
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export const guidedSetupService = new GuidedSetupService();
