const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
import { LLMWorkoutResponse } from '@/types/llm';
import { GeneratedWorkout, Exercise, Circuit, WarmUpSection, CoolDownSection } from '@/types/workout';
import { buildPrompt, getSystemPrompt, GenerationContext } from './prompts';
import { v4 as uuid } from 'uuid';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-2.0-flash-001';

export async function generateWorkout(
  context: GenerationContext
): Promise<GeneratedWorkout> {
  const prompt = buildPrompt(context);

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://llm-wod.app',
      'X-Title': 'LLM-WOD Workout Generator',
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

  const llmResponse = parseAndValidateResponse(content);
  return transformToGeneratedWorkout(llmResponse, context);
}

function parseAndValidateResponse(content: string): LLMWorkoutResponse {
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

  // Validate required fields
  const requiredFields = ['name', 'warmUp', 'circuits', 'coolDown'];
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

  // Transform warm-up exercises
  const warmUpExercises: Exercise[] = llm.warmUp.exercises.map((e) => ({
    id: uuid(),
    name: e.name,
    duration: e.duration,
    description: e.description,
    muscleGroups: e.muscleGroups,
  }));

  const warmUp: WarmUpSection = {
    type: 'warmup',
    exercises: warmUpExercises,
    totalDuration: warmUpExercises.reduce((sum, e) => sum + e.duration, 0),
  };

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

  // Transform cool-down exercises
  const coolDownExercises: Exercise[] = llm.coolDown.exercises.map((e) => ({
    id: uuid(),
    name: e.name,
    duration: e.duration,
    description: e.description,
    muscleGroups: e.muscleGroups,
  }));

  const coolDown: CoolDownSection = {
    type: 'cooldown',
    exercises: coolDownExercises,
    totalDuration: coolDownExercises.reduce((sum, e) => sum + e.duration, 0),
  };

  // Calculate total duration
  const actualDuration =
    warmUp.totalDuration +
    circuits.reduce((sum, c) => sum + c.totalDuration, 0) +
    coolDown.totalDuration;

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
    warmUp,
    circuits,
    coolDown,
    estimatedCalories: llm.estimatedCalories || Math.round(actualDuration / 60 * 8),
    calorieRange: llm.calorieRange || {
      low: Math.round(actualDuration / 60 * 5),
      high: Math.round(actualDuration / 60 * 12),
    },
    focusAreas: llm.focusAreas || [],
    muscleGroupsTargeted: llm.muscleGroupsTargeted || [],
  };
}

export { GenerationContext };
