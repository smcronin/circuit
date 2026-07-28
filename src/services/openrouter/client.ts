const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
import { LLMWorkoutResponse, ManualWorkoutMetadataResponse } from '@/types/llm';
import { GeneratedWorkout, Exercise, Circuit, WarmUpSection, CoolDownSection, EquipmentItem } from '@/types/workout';
import { buildPrompt, getSystemPrompt, GenerationContext, getManualWorkoutSystemPrompt, buildManualWorkoutPrompt, ManualWorkoutPromptInput } from './prompts';
import { uuid } from '@/utils/uuid';
import { OPENROUTER_MODELS } from './models';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const JSON_PARSE_ATTEMPTS = 2;

class LLMResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseParseError';
  }
}

interface JsonCompletionOptions {
  title: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}

async function requestJsonCompletion(
  options: JsonCompletionOptions,
  isRetry: boolean
): Promise<string> {
  const retryInstruction = isRetry
    ? '\n\nRETRY REQUIREMENT: Return one complete, valid JSON object only. Do not use markdown fences, commentary, or trailing text.'
    : '';

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://circuit.app',
      'X-Title': options.title,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODELS.workoutGeneration,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt + retryInstruction },
      ],
      response_format: { type: 'json_object' },
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage =
      errorBody?.error?.message || errorBody?.message || response.statusText;
    throw new Error(`OpenRouter API error: ${errorMessage}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new LLMResponseParseError('No JSON content in response');
  }

  return content;
}

async function requestAndParseJson<T>(
  options: JsonCompletionOptions,
  parse: (content: string) => T
): Promise<T> {
  for (let attempt = 0; attempt < JSON_PARSE_ATTEMPTS; attempt += 1) {
    try {
      const content = await requestJsonCompletion(options, attempt > 0);
      return parse(content);
    } catch (error) {
      const shouldRetry = error instanceof LLMResponseParseError && attempt < JSON_PARSE_ATTEMPTS - 1;
      if (!shouldRetry) {
        throw error;
      }

      console.warn('OpenRouter returned invalid JSON; retrying once.');
    }
  }

  throw new LLMResponseParseError('Failed to parse JSON response from LLM after retry');
}

function parseJsonObject<T>(content: string): T {
  const candidates = [content.trim()];
  const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fencedJson) candidates.push(fencedJson);

  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    candidates.push(content.slice(jsonStart, jsonEnd + 1));
  }

  for (const candidate of Array.from(new Set(candidates))) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // Try the next candidate before requesting a fresh completion.
    }
  }

  throw new LLMResponseParseError('Failed to parse JSON response from LLM');
}

export async function generateWorkout(
  context: GenerationContext
): Promise<GeneratedWorkout> {
  const prompt = buildPrompt(context);
  const llmResponse = await requestAndParseJson(
    {
      title: 'Circuit Workout Generator',
      systemPrompt: getSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 4096,
    },
    (content) => parseAndValidateResponse(content, context.includeWarmup, context.includeCooldown)
  );
  return transformToGeneratedWorkout(llmResponse, context);
}

function parseAndValidateResponse(
  content: string,
  includeWarmup: boolean,
  includeCooldown: boolean
): LLMWorkoutResponse {
  const parsed = parseJsonObject<LLMWorkoutResponse>(content);

  // Validate required fields - warmUp/coolDown only required if requested
  const requiredFields = ['name', 'circuits'];
  if (includeWarmup) requiredFields.push('warmUp');
  if (includeCooldown) requiredFields.push('coolDown');

  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed;
}

function transformToGeneratedWorkout(
  llm: LLMWorkoutResponse,
  context: GenerationContext
): GeneratedWorkout {
  const workoutId = uuid();

  // Transform warm-up exercises (or create empty section if not included)
  let warmUp: WarmUpSection;
  if (llm.warmUp && llm.warmUp.exercises.length > 0) {
    const warmUpExercises: Exercise[] = llm.warmUp.exercises.map((e) => ({
      id: uuid(),
      name: e.name,
      duration: e.duration,
      description: e.description,
      muscleGroups: e.muscleGroups,
      switchSides: e.switchSides,
    }));
    warmUp = {
      type: 'warmup',
      exercises: warmUpExercises,
      totalDuration: warmUpExercises.reduce((sum, e) => sum + e.duration, 0),
    };
  } else {
    warmUp = { type: 'warmup', exercises: [], totalDuration: 0 };
  }

  // Transform circuits
  const circuits: Circuit[] = llm.circuits.map((c) => {
    const exercises: Exercise[] = c.exercises.map((e) => ({
      id: uuid(),
      name: e.name,
      duration: e.duration,
      targetReps: e.targetReps,
      repRange: e.repRange,
      description: e.description,
      muscleGroups: e.muscleGroups,
      equipment: e.equipment,
      switchSides: e.switchSides,
      modifications: e.modifications,
    }));

    // Calculate circuit duration
    const exerciseDuration = exercises.reduce((sum, e) => sum + e.duration, 0);
    const restBetweenExercises = (exercises.length - 1) * c.restBetweenExercises;
    const singleRoundDuration = exerciseDuration + restBetweenExercises;
    const totalRestBetweenRounds = (c.rounds - 1) * c.restBetweenRounds;
    const totalDuration = singleRoundDuration * c.rounds + totalRestBetweenRounds;

    return {
      id: uuid(),
      name: c.name,
      rounds: c.rounds,
      restBetweenRounds: c.restBetweenRounds,
      restBetweenExercises: c.restBetweenExercises,
      exercises,
      totalDuration,
    };
  });

  // Transform cool-down exercises (or create empty section if not included)
  let coolDown: CoolDownSection;
  if (llm.coolDown && llm.coolDown.exercises.length > 0) {
    const coolDownExercises: Exercise[] = llm.coolDown.exercises.map((e) => ({
      id: uuid(),
      name: e.name,
      duration: e.duration,
      description: e.description,
      muscleGroups: e.muscleGroups,
      switchSides: e.switchSides,
    }));
    coolDown = {
      type: 'cooldown',
      exercises: coolDownExercises,
      totalDuration: coolDownExercises.reduce((sum, e) => sum + e.duration, 0),
    };
  } else {
    coolDown = { type: 'cooldown', exercises: [], totalDuration: 0 };
  }

  // Rest between circuits (default to 30 seconds if not provided)
  const restBetweenCircuits = llm.restBetweenCircuits || 30;

  // Calculate total duration (including rest between circuits)
  const circuitRestTotal = circuits.length > 1 ? (circuits.length - 1) * restBetweenCircuits : 0;
  const actualDuration =
    warmUp.totalDuration +
    circuits.reduce((sum, c) => sum + c.totalDuration, 0) +
    circuitRestTotal +
    coolDown.totalDuration;

  // Transform equipment list (or derive from equipmentRequired)
  const equipment: EquipmentItem[] = llm.equipment?.length
    ? llm.equipment.map(e => ({ name: e.name, notes: e.notes }))
    : (llm.equipmentRequired || []).map(name => ({ name }));

  // Default parting words if not provided
  const defaultPartingWords = "Great work completing this workout! Your body is adapting and growing stronger with every session. Keep showing up and trust the process.";

  return {
    id: workoutId,
    createdAt: new Date().toISOString(),
    name: llm.name,
    description: llm.description,
    difficulty: llm.difficulty || 'intermediate',
    targetDuration: context.requestedDuration * 60,
    actualDuration,
    equipmentSetUsed: context.equipmentAvailable.join(', ') || 'Bodyweight',
    equipmentRequired: llm.equipmentRequired || [],
    equipment,
    warmUp,
    circuits,
    coolDown,
    restBetweenCircuits,
    estimatedCalories: llm.estimatedCalories || Math.round(actualDuration / 60 * 8),
    calorieRange: llm.calorieRange || {
      low: Math.round(actualDuration / 60 * 5),
      high: Math.round(actualDuration / 60 * 12),
    },
    focusAreas: llm.focusAreas || [],
    muscleGroupsTargeted: llm.muscleGroupsTargeted || [],
    partingWords: llm.partingWords || defaultPartingWords,
  };
}

export { GenerationContext };

// ============================================
// MANUAL WORKOUT METADATA GENERATION
// ============================================

export async function generateManualWorkoutMetadata(
  input: ManualWorkoutPromptInput
): Promise<ManualWorkoutMetadataResponse> {
  const prompt = buildManualWorkoutPrompt(input);
  return requestAndParseJson(
    {
      title: 'Circuit Manual Workout Analyzer',
      systemPrompt: getManualWorkoutSystemPrompt(),
      userPrompt: prompt,
      maxTokens: 1024,
    },
    (content) => parseManualWorkoutResponse(content, input.durationMinutes)
  );
}

function parseManualWorkoutResponse(
  content: string,
  durationMinutes: number
): ManualWorkoutMetadataResponse {
  const parsed = parseJsonObject<ManualWorkoutMetadataResponse>(content);

  // Provide fallback values if LLM response is incomplete
  const fallbackCalories = Math.round(durationMinutes * 7); // 7 cal/min average

  return {
    difficulty: parsed.difficulty || 'intermediate',
    estimatedCalories: parsed.estimatedCalories || fallbackCalories,
    calorieRange: parsed.calorieRange || {
      low: Math.round(durationMinutes * 5),
      high: Math.round(durationMinutes * 10),
    },
    focusAreas: parsed.focusAreas || ['full body'],
    muscleGroupsTargeted: parsed.muscleGroupsTargeted || [],
  };
}
