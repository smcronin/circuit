import type { GeneratedWorkout } from '@/types/workout';

export const STARTER_SAVED_WORKOUTS: GeneratedWorkout[] = [
  // General-to-specific preparation, followed by progressively easier-to-harder climbing:
  // https://entralpi.com/help/train/plan-your-training/warm-up-routine
  // https://www.mendcolorado.com/physical-therapy-blog/2026/2/23/the-most-effective-warm-up-for-rock-climbing/
  {
    id: 'saved-climbing-warmup-5',
    createdAt: '2026-11-02T21:30:00.000Z',
    name: '5-Minute Climbing Warm-Up',
    description:
      'Five easy minutes: rope, lower-body mobility, shoulder and hand prep, a pulling primer, and light finger recruitment. Set up your equipment first; transitions fit inside each minute. Finish fresh, then build through easy climbs before hard moves. Take longer if you still feel cold or stiff.',
    difficulty: 'beginner',
    targetDuration: 300,
    actualDuration: 300,
    equipmentSetUsed: 'Climbing Gym / Home Setup',
    equipmentRequired: ['Rings or Resistance Band', 'Large Climbing Hold or Hangboard Jug'],
    equipment: [
      { name: 'Jump Rope (Optional)', notes: 'Basic low bounces or alternating feet; brisk marching works without a rope.' },
      { name: 'Rings or Resistance Band', notes: 'Set rings at chest height for easy upright rows, or securely anchor a light band at chest height.' },
      { name: 'Large Climbing Hold or Hangboard Jug', notes: 'Use a secure, comfortable hold you can reach with both feet supported. Keep most of your weight on your feet.' },
    ],
    warmUp: { type: 'warmup', exercises: [], totalDuration: 0 },
    circuits: [
      {
        id: 'saved-climbing-warmup-5-flow',
        name: 'Climbing Readiness Flow',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 0,
        totalDuration: 300,
        exercises: [
          {
            id: 'saved-climbing-warmup-5-rope',
            name: 'Easy Jump Rope or March',
            duration: 60,
            description:
              'Start with relaxed low bounces or alternating-foot skipping, gradually raising your pulse. Stay conversational at RPE 2-3; no sprinting or boxer step. Set the rope aside before the minute ends.',
            muscleGroups: ['calves', 'ankles', 'cardiovascular system'],
            modifications: { easier: 'March briskly with arm swings if space or lower-leg comfort makes jumping unsuitable.' },
          },
          {
            id: 'saved-climbing-warmup-5-hips',
            name: 'Squat-to-Stand and Lateral Lunges',
            duration: 60,
            description:
              'First 30 seconds: use a comfortable squat, gently shift the knees forward over the toes with heels down, then stand tall. Last 30 seconds: alternate shallow lateral lunges to open the hips and inner thighs. Keep moving without forcing depth or holding a stretch.',
            muscleGroups: ['hips', 'ankles', 'adductors', 'glutes'],
            modifications: { easier: 'Hold a stable support, shorten the range, or use standing hip circles and ankle rocks.' },
          },
          {
            id: 'saved-climbing-warmup-5-joints',
            name: 'Shoulders, Wrists and Finger Glides',
            duration: 60,
            description:
              'Use 20 seconds of small-to-larger arm circles and gentle shoulder-blade squeezes, 20 seconds of relaxed wrist circles and palm turns, then 20 seconds opening the hands, making a hook fist, and closing a loose fist. Use smooth, pain-free motion; keep the neck relaxed and breathe normally.',
            muscleGroups: ['shoulders', 'upper back', 'wrists', 'fingers'],
            modifications: { easier: 'Keep arm circles below shoulder height and make every motion smaller.' },
          },
          {
            id: 'saved-climbing-warmup-5-pull',
            name: 'Easy Ring or Band Row Primer',
            duration: 60,
            targetReps: 6,
            repRange: '4-6 easy reps, then reset',
            description:
              'Take the first 10 seconds to get set. Do just 4-6 smooth rows with upright rings or a light band: gently draw the shoulder blades back, pull the elbows toward the ribs, and return slowly. Keep at least 5 reps in reserve at RPE 3-4. Spend the remaining time shaking out and moving to the finger hold; do not row for the whole minute.',
            muscleGroups: ['lats', 'upper back', 'biceps'],
            equipment: ['Rings or Resistance Band'],
            modifications: { easier: 'Stand more upright or use a lighter band. Without equipment, gently squeeze the shoulder blades with elbows bent by your sides.' },
          },
          {
            id: 'saved-climbing-warmup-5-fingers',
            name: 'Feet-Supported Finger Recruitment',
            duration: 60,
            description:
              'On a large comfortable hold, keep both feet planted and most weight on the legs. Repeat four cycles of 5 seconds gently taking up tension, then 10 seconds fully released. Use an open, relaxed grip at RPE 2-3, about 20-30% effort, and ease into each pull. No full crimp, small edges, added weight, or hard hangs. Stop loading if fingers, elbows, or shoulders hurt.',
            muscleGroups: ['fingers', 'forearms'],
            equipment: ['Large Climbing Hold or Hangboard Jug'],
            modifications: { easier: 'Keep more weight on the feet. Without a suitable hold, use unloaded finger glides and do the gradual loading on easy large-hold climbs afterward.' },
          },
        ],
      },
    ],
    coolDown: { type: 'cooldown', exercises: [], totalDuration: 0 },
    restBetweenCircuits: 0,
    estimatedCalories: 20,
    calorieRange: { low: 10, high: 30 },
    focusAreas: ['climbing', 'mobility', 'activation'],
    muscleGroupsTargeted: ['hips', 'ankles', 'shoulders', 'upper back', 'lats', 'forearms', 'fingers'],
    partingWords:
      'Primer complete. Start with very easy climbing on large holds, then increase difficulty gradually while staying pain-free. Five minutes is a starting point: keep warming up until you feel ready for harder moves.',
  },
  {
    id: 'saved-morning-mobility-5',
    createdAt: '2026-07-22T12:00:00.000Z',
    name: '6-Minute Morning Mobility',
    description:
      'A compact joint-by-joint reset for hips, ankles, shoulders, and the upper back, finished with a gentle hang. Move through a comfortable range and use support whenever it helps.',
    difficulty: 'beginner',
    targetDuration: 360,
    actualDuration: 360,
    equipmentSetUsed: 'Bodyweight + Pull-Up Bar',
    equipmentRequired: ['Pull-Up Bar'],
    equipment: [
      {
        name: 'Pull-Up Bar',
        notes: 'Use a stable bar with space to hang or keep the feet lightly supported.',
      },
    ],
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
        totalDuration: 360,
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
          {
            id: 'saved-morning-mobility-5-dead-hang',
            name: 'Dead Hang',
            duration: 60,
            description:
              'Hang from a secure bar with the hands just outside shoulder width. Breathe steadily, keep the shoulders comfortable, and step down whenever your grip or shoulder position starts to fade.',
            muscleGroups: ['shoulders', 'lats', 'forearms', 'grip'],
            equipment: ['Pull-Up Bar'],
            modifications: {
              easier: 'Keep the toes on the floor or a sturdy step and use only as much body weight as feels comfortable.',
              harder: 'Stay relaxed and add a few gentle scapular glides without swinging or shrugging into discomfort.',
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
    estimatedCalories: 20,
    calorieRange: { low: 10, high: 30 },
    focusAreas: ['mobility', 'hips', 'shoulders'],
    muscleGroupsTargeted: [
      'hips',
      'ankles',
      'glutes',
      'shoulders',
      'thoracic spine',
      'lats',
      'forearms',
    ],
    partingWords: 'Six minutes done. You are moving better before the day even gets a vote.',
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
    id: 'saved-jump-rope-vo2-4x4',
    createdAt: '2026-09-03T12:00:00.000Z',
    name: 'Norwegian 4×4 Jump-Rope VO₂',
    description:
      'Four controlled four-minute jump-rope intervals at about RPE 8, each separated by three minutes of active walking or marching. Keep cadence stable rather than sprinting, and use basic low-bounce or alternating-foot skipping—never boxer step.',
    difficulty: 'advanced',
    targetDuration: 2280,
    actualDuration: 2280,
    equipmentSetUsed: 'Jump Rope',
    equipmentRequired: ['Jump Rope'],
    equipment: [
      {
        name: 'Jump Rope',
        notes:
          'Use a rope length that clears easily with relaxed shoulders. Fast low-impact step-ups or running or marching in place are the no-rope substitutions.',
      },
    ],
    warmUp: {
      type: 'warmup',
      exercises: [
        {
          id: 'saved-jump-rope-vo2-4x4-march',
          name: 'Brisk Marching Ramp',
          duration: 120,
          description:
            'Start easy and build to a brisk march with relaxed arm swing and progressively deeper breathing.',
          muscleGroups: ['cardiovascular system', 'hips', 'calves'],
        },
        {
          id: 'saved-jump-rope-vo2-4x4-ankles',
          name: 'Ankle Rockers and Calf Raises',
          duration: 120,
          description:
            'Alternate controlled ankle rockers with easy calf raises. Keep the feet relaxed and use a pain-free range.',
          muscleGroups: ['ankles', 'calves', 'feet'],
        },
        {
          id: 'saved-jump-rope-vo2-4x4-easy-rope',
          name: 'Easy Low-Bounce Rope',
          duration: 120,
          description:
            'Use basic low-bounce or alternating-foot skipping at an easy pace. Do not use boxer step; fast marching is the no-rope option.',
          muscleGroups: ['cardiovascular system', 'calves', 'coordination'],
          equipment: ['Jump Rope'],
        },
        {
          id: 'saved-jump-rope-vo2-4x4-primer',
          name: 'Progressive Rope Primer',
          duration: 120,
          description:
            'Gradually approach workout cadence without straining. Finish warm, springy, and coordinated rather than fatigued.',
          muscleGroups: ['cardiovascular system', 'calves', 'coordination'],
          equipment: ['Jump Rope'],
        },
      ],
      totalDuration: 480,
    },
    circuits: [
      {
        id: 'saved-jump-rope-vo2-4x4-intervals',
        name: 'Controlled 4 × 4-Minute High-Aerobic Intervals',
        rounds: 4,
        restBetweenRounds: 180,
        restBetweenExercises: 0,
        totalDuration: 1500,
        exercises: [
          {
            id: 'saved-jump-rope-vo2-4x4-work',
            name: 'Jump Rope VO₂ Interval - 4 Minutes',
            duration: 240,
            description:
              'Work at about RPE 8: hard breathing with only a few words possible, but controlled enough to preserve cadence through round four. During each three-minute recovery, walk or march easily. If foot, calf, Achilles, knee, or coordination trouble appears, switch to fast low-impact step-ups or running or marching in place. Stop for sharp or escalating pain.',
            muscleGroups: [
              'cardiovascular system',
              'calves',
              'quads',
              'glutes',
              'core',
            ],
            equipment: ['Jump Rope'],
            modifications: {
              easier:
                'Alternate short rope bouts with fast marching while keeping the interval controlled and continuous.',
              harder:
                'Keep the same RPE target and make the cadence more even; do not turn the early rounds into sprints.',
            },
          },
        ],
      },
    ],
    coolDown: {
      type: 'cooldown',
      exercises: [
        {
          id: 'saved-jump-rope-vo2-4x4-walk',
          name: 'Easy Walking Downshift',
          duration: 150,
          description: 'Walk easily and let breathing settle without stopping abruptly.',
          muscleGroups: ['cardiovascular system', 'calves', 'hips'],
        },
        {
          id: 'saved-jump-rope-vo2-4x4-calf',
          name: 'Calf Mobility - Alternating',
          duration: 90,
          description: 'Stretch the left calf, then the right, gently.',
          muscleGroups: ['calves', 'ankles'],
          switchSides: true,
        },
        {
          id: 'saved-jump-rope-vo2-4x4-breathing',
          name: 'Standing Recovery Breathing',
          duration: 60,
          description: 'Lengthen the exhale while the shoulders relax.',
          muscleGroups: ['diaphragm', 'cardiovascular system'],
        },
      ],
      totalDuration: 300,
    },
    restBetweenCircuits: 0,
    estimatedCalories: 335,
    calorieRange: { low: 270, high: 410 },
    focusAreas: ['cardio', 'VO2 max', 'high-aerobic conditioning', 'coordination'],
    muscleGroupsTargeted: [
      'cardiovascular system',
      'calves',
      'quads',
      'glutes',
      'core',
    ],
    partingWords:
      'Four controlled fours are in the bank. Record RPE, cadence, and every lower-leg signal.',
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
