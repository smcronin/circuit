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
  {
    id: 'saved-night-mobility-10',
    createdAt: '2026-07-23T12:00:00.000Z',
    name: '10-Minute Restorative Night Mobility',
    description:
      'A quiet floor-based sequence pairing long, pain-free holds with slow breathing to release common tension and help your body settle before sleep.',
    difficulty: 'beginner',
    targetDuration: 600,
    actualDuration: 600,
    equipmentSetUsed: 'Bodyweight',
    equipmentRequired: [],
    equipment: [],
    warmUp: {
      type: 'warmup',
      exercises: [
        {
          id: 'saved-night-mobility-10-breathing',
          name: 'Constructive Rest Breathing',
          duration: 120,
          description:
            'Lie on your back with knees bent and feet planted. Let the ribs expand on a gentle nasal inhale, then take an unforced, slightly longer exhale. Aim for about five or six easy breaths per minute.',
          muscleGroups: ['diaphragm', 'rib cage', 'lower back'],
          modifications: {
            easier: 'Place a pillow under the knees or head wherever it helps the body relax.',
            harder: 'Keep the effort low; this is a downshift, not a breath-hold challenge.',
          },
        },
      ],
      totalDuration: 120,
    },
    circuits: [
      {
        id: 'saved-night-mobility-10-flow',
        name: 'Evening Release',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 0,
        totalDuration: 360,
        exercises: [
          {
            id: 'saved-night-mobility-10-childs-pose',
            name: "Child's Pose Side Reach",
            duration: 120,
            description:
              'Sink the hips toward the heels, then walk both hands gently to one side. Breathe into the open side of the ribs and switch halfway through without forcing the shoulders or knees.',
            muscleGroups: ['lats', 'shoulders', 'thoracic spine', 'hips'],
            switchSides: true,
            modifications: {
              easier: 'Support the torso with pillows or stay centered in a comfortable child\'s pose.',
              harder: 'Reach the top hand a little farther while keeping the hips heavy and relaxed.',
            },
          },
          {
            id: 'saved-night-mobility-10-figure-four',
            name: 'Reclined Figure Four',
            duration: 120,
            description:
              'Cross one ankle over the opposite thigh and draw the legs in only until a mild glute stretch appears. Keep the head and shoulders heavy; switch sides halfway through.',
            muscleGroups: ['glutes', 'outer hips', 'piriformis'],
            switchSides: true,
            modifications: {
              easier: 'Leave the supporting foot on the floor or place it against a wall.',
              harder: 'Draw the supporting thigh slightly closer without lifting the tailbone.',
            },
          },
          {
            id: 'saved-night-mobility-10-twist',
            name: 'Supine Spinal Twist',
            duration: 120,
            description:
              'Let bent knees fall gently to one side while both shoulders remain comfortable on the floor. Use each exhale to soften, then switch sides halfway through.',
            muscleGroups: ['lower back', 'obliques', 'glutes', 'thoracic spine'],
            switchSides: true,
            modifications: {
              easier: 'Place a pillow under the knees so the twist is fully supported.',
              harder: 'Move the knees slightly higher toward the chest while keeping the stretch easy.',
            },
          },
        ],
      },
    ],
    coolDown: {
      type: 'cooldown',
      exercises: [
        {
          id: 'saved-night-mobility-10-legs-up-wall',
          name: 'Legs Up the Wall',
          duration: 120,
          description:
            'Rest the legs against a wall, couch, or bed with the hips a comfortable distance away. Let the arms settle, unclench the jaw, and return to slow, quiet breathing.',
          muscleGroups: ['hamstrings', 'calves', 'lower back'],
          modifications: {
            easier: 'Rest the lower legs on a chair or bed with the knees bent.',
            harder: 'There is no need to intensify this position; choose the version that feels most restful.',
          },
        },
      ],
      totalDuration: 120,
    },
    restBetweenCircuits: 0,
    estimatedCalories: 20,
    calorieRange: { low: 10, high: 30 },
    focusAreas: ['restorative', 'mobility', 'relaxation'],
    muscleGroupsTargeted: ['hips', 'spine', 'shoulders', 'glutes', 'hamstrings'],
    partingWords: 'That is enough for tonight. Let the day be done.',
  },
];
