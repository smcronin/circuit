const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
import { LLMWorkoutResponse, ManualWorkoutMetadataResponse } from '@/types/llm';
import { GeneratedWorkout, Exercise, Circuit, WarmUpSection, CoolDownSection, EquipmentItem } from '@/types/workout';
import { buildPrompt, getSystemPrompt, GenerationContext, getManualWorkoutSystemPrompt, buildManualWorkoutPrompt, ManualWorkoutPromptInput } from './prompts';
import { uuid } from '@/utils/uuid';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-3-flash-preview';

export async function generateWorkout(
  context: GenerationContext
): Promise<GeneratedWorkout> {
  const prompt = buildPrompt(context);

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://circuit.app',
      'X-Title': 'Circuit Workout Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  const llmResponse = parseAndValidateResponse(content, context.includeWarmup, context.includeCooldown);
  return transformToGeneratedWorkout(llmResponse, context);
}

function parseAndValidateResponse(
  content: string,
  includeWarmup: boolean,
  includeCooldown: boolean
): LLMWorkoutResponse {
  let parsed: LLMWorkoutResponse;

  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Try to find JSON object in the response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error('Invalid JSON response from LLM');
      }
    }
  }

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

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://circuit.app',
      'X-Title': 'Circuit Workout Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: getManualWorkoutSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5, // Lower temperature for more consistent metadata
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  return parseManualWorkoutResponse(content, input.durationMinutes);
}

function parseManualWorkoutResponse(
  content: string,
  durationMinutes: number
): ManualWorkoutMetadataResponse {
  let parsed: ManualWorkoutMetadataResponse;

  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Try to find JSON object in the response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error('Invalid JSON response from LLM');
      }
    }
  }

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
