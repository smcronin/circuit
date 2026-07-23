import type { GeneratedWorkout } from '@/types/workout';

export const STARTER_SAVED_WORKOUTS: GeneratedWorkout[] = [
  {
    id: 'saved-morning-mobility-5',
    createdAt: '2026-07-22T12:00:00.000Z',
    name: '5-Minute Morning Mobility',
    description:
      'A compact joint-by-joint reset for hips, ankles, shoulders, and the upper back. Move through a comfortable range and use support whenever it helps.',
    difficulty: 'beginner',
    targetDuration: 300,
    actualDuration: 300,
    equipmentSetUsed: 'Bodyweight',
    equipmentRequired: [],
    equipment: [],
    warmUp: {
      type: 'warmup',
      exercises: [],
      totalDuration: 0,
    },
    circuits: [
      {
        id: 'saved-morning-mobility-5-flow',
        name: 'Wake-Up Flow',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 0,
        totalDuration: 300,
        exercises: [
          {
            id: 'saved-morning-mobility-5-squat',
            name: 'Deep Squat Hold',
            duration: 120,
            description:
              'Use a doorframe or counter for support if needed. Keep the whole foot grounded, breathe slowly, and make small weight shifts without forcing depth.',
            muscleGroups: ['hips', 'ankles', 'adductors', 'quads'],
            modifications: {
              easier: 'Hold a support, raise the heels, or alternate 20-second holds with standing.',
              harder: 'Add gentle side-to-side shifts while keeping both heels grounded.',
            },
          },
          {
            id: 'saved-morning-mobility-5-9090',
            name: '90/90 Hip Switches',
            duration: 60,
            description:
              'Sit tall with knees bent and rotate both legs side to side under control. Use your hands behind you if that keeps the motion smooth.',
            muscleGroups: ['hips', 'glutes', 'adductors'],
            modifications: {
              easier: 'Lean back onto the hands and use a smaller range.',
              harder: 'Keep the hands off the floor and pause briefly on each side.',
            },
          },
          {
            id: 'saved-morning-mobility-5-crab',
            name: 'Crab Reach',
            duration: 60,
            description:
              'From a supported crab position, press the hips up and reach one arm overhead. Alternate sides slowly, opening the chest without loading the wrist sharply.',
            muscleGroups: ['shoulders', 'thoracic spine', 'glutes', 'hips'],
            modifications: {
              easier: 'Keep the hips low and make the reach smaller.',
              harder: 'Pause for one full breath at the top of each reach.',
            },
          },
          {
            id: 'saved-morning-mobility-5-lunge',
            name: "World's Greatest Stretch",
            duration: 60,
            description:
              'Step into a long lunge, place the inside hand down, and rotate the other arm toward the ceiling. Switch sides halfway through.',
            muscleGroups: ['hip flexors', 'hamstrings', 'thoracic spine', 'shoulders'],
            switchSides: true,
            modifications: {
              easier: 'Lower the back knee and place the hand on a block or sturdy support.',
              harder: 'Straighten the front leg briefly between rotations for a hamstring glide.',
            },
          },
        ],
      },
    ],
    coolDown: {
      type: 'cooldown',
      exercises: [],
      totalDuration: 0,
    },
    restBetweenCircuits: 0,
    estimatedCalories: 18,
    calorieRange: { low: 10, high: 25 },
    focusAreas: ['mobility', 'hips', 'spine'],
    muscleGroupsTargeted: ['hips', 'ankles', 'glutes', 'shoulders', 'thoracic spine'],
    partingWords: 'Five minutes done. You are moving better before the day even gets a vote.',
  },
  {
    id: 'saved-jump-rope-snack-10',
    createdAt: '2026-07-22T12:00:00.000Z',
    name: '10-Minute Jump Rope Snack',
    description:
      'Five crisp intervals: 90 seconds of relaxed jumping followed by 30 seconds to reset. Stay light, quiet, and repeatable.',
    difficulty: 'intermediate',
    targetDuration: 600,
    actualDuration: 600,
    equipmentSetUsed: 'Jump Rope',
    equipmentRequired: ['Jump Rope'],
    equipment: [
      {
        name: 'Jump Rope',
        notes: 'Choose a length that lets the rope clear with relaxed shoulders and low jumps.',
      },
    ],
    warmUp: {
      type: 'warmup',
      exercises: [],
      totalDuration: 0,
    },
    circuits: [
      {
        id: 'saved-jump-rope-snack-10-intervals',
        name: '90 / 30 Intervals',
        rounds: 5,
        restBetweenRounds: 30,
        restBetweenExercises: 0,
        totalDuration: 570,
        exercises: [
          {
            id: 'saved-jump-rope-snack-10-jump',
            name: 'Jump Rope',
            duration: 90,
            description:
              'Use an easy bounce or boxer step. Keep jumps low, elbows near the ribs, and finish each interval with enough control to repeat it.',
            muscleGroups: ['calves', 'shoulders', 'forearms', 'core'],
            equipment: ['Jump Rope'],
            modifications: {
              easier: 'Use invisible rope, fast marching, or 30 seconds on and 15 seconds easy within the work interval.',
              harder: 'Mix in boxer steps or brief high-knee bursts without increasing jump height.',
            },
          },
        ],
      },
    ],
    coolDown: {
      type: 'cooldown',
      exercises: [
        {
          id: 'saved-jump-rope-snack-10-recovery',
          name: 'Final Recovery',
          duration: 30,
          description: 'Walk in place, loosen the shoulders, and let your breathing settle.',
          muscleGroups: ['calves', 'shoulders'],
        },
      ],
      totalDuration: 30,
    },
    restBetweenCircuits: 0,
    estimatedCalories: 105,
    calorieRange: { low: 70, high: 140 },
    focusAreas: ['cardio', 'coordination', 'conditioning'],
    muscleGroupsTargeted: ['calves', 'shoulders', 'forearms', 'core'],
    partingWords: 'Small window, real work. Ten focused minutes absolutely counts.',
  },
];
