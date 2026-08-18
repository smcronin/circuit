import type {
  ActivityType,
  Circuit,
  CoolDownSection,
  EquipmentItem,
  Exercise,
  GeneratedWorkout,
  WarmUpSection,
} from '@/types/workout';

export type ProgrammedWorkoutSlot = 'Main' | 'Warm-up' | 'Cardio' | 'Snack' | 'Mobility';

export interface ProgrammedWorkout {
  id: string;
  date: string; // YYYY-MM-DD in the user's local calendar
  slot: ProgrammedWorkoutSlot;
  priority: number;
  coachNotes: string;
  workout: GeneratedWorkout;
}

interface HomeProgram {
  date: string;
  dateLabel: string;
  title: string;
  isToday: boolean;
  workouts: ProgrammedWorkout[];
}

type ExerciseSeed = Omit<Exercise, 'id'>;

interface CircuitSeed {
  name: string;
  rounds: number;
  restBetweenRounds: number;
  restBetweenExercises: number;
  exercises: ExerciseSeed[];
}

interface WorkoutSeed {
  id: string;
  date: string;
  name: string;
  description: string;
  difficulty: GeneratedWorkout['difficulty'];
  targetDurationMinutes: number;
  estimatedCalories: number;
  calorieRange: GeneratedWorkout['calorieRange'];
  focusAreas: string[];
  muscleGroupsTargeted: string[];
  warmUp?: ExerciseSeed[];
  circuits?: CircuitSeed[];
  coolDown?: ExerciseSeed[];
  restBetweenCircuits?: number;
  equipmentSetUsed?: string;
  partingWords: string;
  /** Routes the day to a different recorder — 'ride' opens the GPS tracker. */
  activityType?: ActivityType;
}

interface ProgramSeed extends WorkoutSeed {
  slot: ProgrammedWorkoutSlot;
  priority: number;
  coachNotes: string;
}

type Phase = 1 | 2 | 3 | 4 | 5;

const PHASE_LABELS: Record<Phase, string> = {
  1: 'Base',
  2: 'Build',
  3: 'Density',
  4: 'Deload',
  5: 'Peak',
};

const EQUIPMENT_NOTES: Record<string, string> = {
  'Yoga Mat': 'Use for floor work and cool-down stretches.',
  'Resistance Bands': 'Keep one light band ready for shoulders and scapular work.',
  Dumbbells: 'Use the 22.5 lb setting unless the note says to go lighter.',
  'Pull-up Bar': 'Use for pull-ups, scapular pulls, and active hangs.',
  'Jump Rope': 'Optional on low-impact days; substitute fast marching if needed.',
  'Mini Bands': 'Pack one light mini band for hips, shoulders, and simple pulling substitutes.',
  'Gymnastic Rings': 'Set to a stable height before starting.',
  'Weight Vest': 'Use the 20 lb vest only when reps stay crisp.',
  Hangboard: 'Use a comfortable edge and stop if finger pain appears.',
  'Yoga wheel': 'Use for thoracic mobility and chest opening.',
  'Road Bike': 'Use the road bike for steady Zone 2 work.',
  Kettlebell: 'Use the 50 lb kettlebell. Keep swings crisp and use two hands to assist setup whenever needed.',
  'Fitness Ball': 'Inflate firmly and brace it against a clear, non-slip area before trunk or hamstring work.',
  'Hotel Cardio Machine': 'Use whichever hotel option is available: treadmill, bike, elliptical, or rower.',
};

const pad = (value: number) => String(value).padStart(2, '0');

export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

export function formatProgramDateLabel(dateKey: string): string {
  return dateFromKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function ex(
  name: string,
  duration: number,
  description: string,
  muscleGroups: string[],
  equipment?: string[],
  extras?: Partial<Omit<Exercise, 'id' | 'name' | 'duration' | 'description' | 'muscleGroups' | 'equipment'>>
): ExerciseSeed {
  return {
    name,
    duration,
    description,
    muscleGroups,
    ...(equipment && equipment.length > 0 ? { equipment } : {}),
    ...extras,
  };
}

function sectionDuration(exercises: Exercise[]): number {
  return exercises.reduce((sum, exercise) => sum + exercise.duration, 0);
}

function circuitDuration(circuit: Pick<Circuit, 'rounds' | 'restBetweenRounds' | 'restBetweenExercises' | 'exercises'>): number {
  const exerciseDuration = sectionDuration(circuit.exercises);
  const exerciseRest = Math.max(0, circuit.exercises.length - 1) * circuit.restBetweenExercises;
  const roundDuration = exerciseDuration + exerciseRest;
  const roundRest = Math.max(0, circuit.rounds - 1) * circuit.restBetweenRounds;
  return roundDuration * circuit.rounds + roundRest;
}

function withIds(prefix: string, exercises: ExerciseSeed[]): Exercise[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    id: `${prefix}-${index + 1}`,
  }));
}

function collectEquipment(
  warmUp: ExerciseSeed[],
  circuits: CircuitSeed[],
  coolDown: ExerciseSeed[]
): string[] {
  const ordered = new Set<string>();
  [...warmUp, ...circuits.flatMap((circuit) => circuit.exercises), ...coolDown].forEach((exercise) => {
    exercise.equipment?.forEach((item) => ordered.add(item));
  });
  return Array.from(ordered);
}

function equipmentItems(names: string[]): EquipmentItem[] {
  return names.map((name) => ({
    name,
    notes: EQUIPMENT_NOTES[name],
  }));
}

function makeWorkout(seed: WorkoutSeed): GeneratedWorkout {
  const warmUpSeeds = seed.warmUp ?? [];
  const circuitSeeds = seed.circuits ?? [];
  const coolDownSeeds = seed.coolDown ?? [];
  const restBetweenCircuits = seed.restBetweenCircuits ?? 45;

  const warmUpExercises = withIds(`${seed.id}-warmup`, warmUpSeeds);
  const circuits: Circuit[] = circuitSeeds.map((circuit, index) => {
    const exercises = withIds(`${seed.id}-c${index + 1}`, circuit.exercises);
    const builtCircuit: Circuit = {
      ...circuit,
      id: `${seed.id}-circuit-${index + 1}`,
      exercises,
      totalDuration: 0,
    };
    return {
      ...builtCircuit,
      totalDuration: circuitDuration(builtCircuit),
    };
  });
  const coolDownExercises = withIds(`${seed.id}-cooldown`, coolDownSeeds);

  const warmUp: WarmUpSection = {
    type: 'warmup',
    exercises: warmUpExercises,
    totalDuration: sectionDuration(warmUpExercises),
  };
  const coolDown: CoolDownSection = {
    type: 'cooldown',
    exercises: coolDownExercises,
    totalDuration: sectionDuration(coolDownExercises),
  };
  const circuitRestTotal = Math.max(0, circuits.length - 1) * restBetweenCircuits;
  const actualDuration =
    warmUp.totalDuration +
    circuits.reduce((sum, circuit) => sum + circuit.totalDuration, 0) +
    circuitRestTotal +
    coolDown.totalDuration;
  const equipmentRequired = collectEquipment(warmUpSeeds, circuitSeeds, coolDownSeeds);

  return {
    id: seed.id,
    createdAt: `${seed.date}T12:00:00.000Z`,
    name: seed.name,
    description: seed.description,
    difficulty: seed.difficulty,
    targetDuration: seed.targetDurationMinutes * 60,
    actualDuration,
    equipmentSetUsed: seed.equipmentSetUsed ?? 'Minimal Home',
    equipmentRequired,
    equipment: equipmentItems(equipmentRequired),
    warmUp,
    circuits,
    coolDown,
    restBetweenCircuits,
    estimatedCalories: seed.estimatedCalories,
    calorieRange: seed.calorieRange,
    focusAreas: seed.focusAreas,
    muscleGroupsTargeted: seed.muscleGroupsTargeted,
    partingWords: seed.partingWords,
    activityType: seed.activityType,
  };
}

function programmedWorkout(seed: ProgramSeed): ProgrammedWorkout {
  return {
    id: seed.id,
    date: seed.date,
    slot: seed.slot,
    priority: seed.priority,
    coachNotes: seed.coachNotes,
    workout: makeWorkout(seed),
  };
}

type StrengthDay = 'monday' | 'tuesday' | 'friday';
type ClimbingWarmUpStyle = 'weekday' | 'long';

const strengthWarmUp = (day: StrengthDay, phase: Phase): ExerciseSeed[] => {
  const commonRamp = ex(
    day === 'friday' ? 'Jump Rope Boxer Step' : 'Jump Rope Easy Bounce',
    phase === 4 ? 35 : 45,
    phase === 4
      ? 'Keep this deliberately easy: relaxed rhythm, soft feet, and no conditioning intent. The goal is just to get moving.'
      : 'Keep the bounce relaxed and quiet. Breathe through the nose if possible and let ankles, calves, and shoulders wake up gradually.',
    ['calves', 'shoulders', 'core'],
    ['Jump Rope']
  );

  if (day === 'monday') {
    return [
      commonRamp,
      ex(
        'Wrist Tendon Glides',
        40,
        'Move through open hand, hook fist, full fist, and straight fist positions. Keep it gentle and precise.',
        ['wrists', 'forearms']
      ),
      ex(
        phase === 2 || phase === 5 ? 'Hangboard Large Edge Shoulder Set' : 'Scapular Pull-ups',
        45,
        phase === 2 || phase === 5
          ? 'Use a large edge, set shoulders down, and add tiny knee lifts. This is a primer, not a hang workout.'
          : 'Hang from the bar and move only through the shoulder blades. Pull shoulders down and away from the ears, then return under control.',
        ['back', 'lats', 'forearms'],
        phase === 2 || phase === 5 ? ['Hangboard'] : ['Pull-up Bar']
      ),
      ex(
        'Hip Hinge Sweep',
        50,
        'Sweep hands down the legs as hips move back, then stand tall and squeeze glutes. Keep shins mostly vertical.',
        ['hamstrings', 'glutes', 'back']
      ),
      ex(
        'Dead Bug Lat Press',
        45,
        'Press hands gently into the floor or a band overhead while alternating slow dead bugs.',
        ['core', 'lats', 'hip flexors'],
        ['Yoga Mat']
      ),
    ];
  }

  if (day === 'tuesday') {
    return [
      commonRamp,
      ex(
        'Ankle Rockers',
        45,
        'Drive the knee forward over the toes without the heel lifting, alternating sides smoothly.',
        ['ankles', 'calves', 'quads'],
        ['Yoga Mat']
      ),
      ex(
        '90/90 Hip Switches',
        50,
        'Rotate between 90/90 positions with tall posture. Use hands for support if needed.',
        ['hips', 'glutes', 'adductors'],
        ['Yoga Mat']
      ),
      ex(
        phase === 5 ? 'Wall Handstand Line Drill' : 'Band Wall Slides',
        45,
        phase === 5
          ? 'Face the wall or use a pike setup and find a straight overhead line without fatigue.'
          : 'Slide arms up the wall against light band tension, keeping ribs down and shoulder blades moving.',
        ['shoulders', 'serratus', 'upper back'],
        phase === 5 ? ['Yoga Mat'] : ['Resistance Bands']
      ),
      ex(
        'Cossack Squat Flow',
        45,
        'Shift side to side with a tall chest. Stay in a range that feels like preparation, not work.',
        ['adductors', 'quads', 'glutes', 'hips'],
        ['Yoga Mat']
      ),
    ];
  }

  return [
    commonRamp,
    ex(
      'Cat-Cow to Thread the Needle',
      phase === 5 ? 60 : 55,
      phase === 5
        ? 'Move through two cat-cow reps, then thread the left arm through and rotate. Switch to the right side halfway.'
        : 'Move through two cat-cow reps, then thread one arm through and rotate. Switch sides halfway.',
      ['thoracic spine', 'shoulders', 'back'],
      ['Yoga Mat'],
      phase === 5 ? { switchSides: true } : undefined
    ),
    ex(
      'Ring Support Scap Shrugs',
      40,
      'Hold an easy ring support or foot-assisted support and move only through the shoulder blades.',
      ['shoulders', 'chest', 'triceps', 'upper back'],
      ['Gymnastic Rings']
    ),
    ex(
      'Inchworm to Cobra',
      55,
      'Walk hands out, briefly open the front body, then walk back with soft knees.',
      ['hamstrings', 'core', 'chest', 'shoulders'],
      ['Yoga Mat']
    ),
    ex(
      phase === 3 ? 'Beast Hover Rock' : 'Bear Crawl Patterning',
      45,
      phase === 3
        ? 'Hover knees one inch and rock slightly forward and back with quiet hips.'
        : 'Crawl slowly forward and back, keeping hips quiet and hands active.',
      ['core', 'shoulders', 'quads', 'wrists'],
      ['Yoga Mat']
    ),
  ];
};

const climbingWarmUp = (phase: Phase, style: ClimbingWarmUpStyle = 'weekday'): ExerciseSeed[] => {
  const activeHang =
    phase === 2 || phase === 5
      ? ex(
          'Hangboard Large Edge Active Hang',
          55,
          'Use a comfortable edge, pull shoulders lightly down, and stop well before finger fatigue.',
          ['forearms', 'lats', 'core'],
          ['Hangboard']
        )
      : ex(
          'Pull-up Bar Active Hang',
          55,
          'Use a comfortable grip, pull shoulders lightly down, and alternate gentle knee lifts.',
          ['forearms', 'lats', 'core'],
          ['Pull-up Bar']
        );

  const base: ExerciseSeed[] = [
    ex(
      style === 'long' ? 'Jump Rope Boxer Step' : 'Jump Rope Easy Bounce',
      45,
      'Use a relaxed rhythm to raise temperature without fatigue. If a rope is inconvenient before climbing, substitute quiet fast feet.',
      ['calves', 'shoulders', 'core'],
      ['Jump Rope']
    ),
    ex(
      style === 'long' ? 'Finger Waves and Wrist CARs' : 'Wrist Pulses and Finger Flicks',
      45,
      'Open and close the hands, then make gentle wrist circles. Keep this easy and restorative.',
      ['forearms', 'wrists']
    ),
    ex(
      phase === 4 ? 'Band Face Pulls' : 'Band Face Pulls with External Rotation',
      55,
      'Pull the band toward eye level, pause, and rotate the knuckles slightly back. Move slowly enough to feel mid-back control.',
      ['upper back', 'rear delts', 'rotator cuff'],
      ['Resistance Bands']
    ),
    activeHang,
    ex(
      style === 'long' ? 'High-Step Rockbacks' : 'Hip CARs Standing',
      phase === 5 && style === 'weekday' ? 60 : 55,
      style === 'long'
        ? 'Set one foot high on a stable surface or floor position and rock in and out of the hip slowly.'
        : phase === 5
          ? 'Draw controlled circles with the left knee, then switch to the right halfway. Hold the wall or rings lightly if needed.'
          : 'Draw controlled circles with one knee, switching sides halfway. Hold the wall or rings lightly if needed.',
      ['hips', 'glutes', 'adductors'],
      ['Yoga Mat'],
      phase === 5 && style === 'weekday' ? { switchSides: true } : undefined
    ),
    ex(
      style === 'long' ? 'Cross-Body Dead Bug' : 'Hollow to Dead Bug Switch',
      55,
      style === 'long'
        ? 'Reach opposite elbow and knee toward each other, then extend slowly without losing rib position.'
        : 'Alternate a short hollow hold with slow dead bugs. Keep the low back gently pressed toward the floor.',
      ['core', 'hip flexors', 'obliques'],
      ['Yoga Mat']
    ),
  ];

  if (style === 'long') {
    return [
      ...base,
      ex(
        'Easy Ring Row Acceleration',
        45,
        'Do a few smooth rows with slightly faster intent on the way up and full control on the way down.',
        ['lats', 'back', 'biceps'],
        ['Gymnastic Rings']
      ),
      ex(
        'Quiet Feet Squat-to-Reach',
        50,
        'Move from a relaxed squat to an overhead reach, staying light through the feet.',
        ['quads', 'glutes', 'thoracic spine'],
        ['Yoga Mat']
      ),
    ];
  }

  return [
    ...base,
    ex(
      'Easy Squat-to-Reach',
      50,
      'Sit into a relaxed squat, then stand and reach overhead. Make the movement fluid and climbing-ready.',
      ['quads', 'glutes', 'thoracic spine'],
      ['Yoga Mat']
    ),
  ];
};

const strengthCoolDown = (day: StrengthDay, phase: Phase): ExerciseSeed[] => {
  if (day === 'monday') {
    return [
      ex(
        'Forearm Extensor Stretch - Right',
        35,
        'Extend the right arm, palm down, and gently flex the wrist until the top of the forearm eases.',
        ['forearms', 'wrists']
      ),
      ex(
        'Forearm Extensor Stretch - Left',
        35,
        'Match the right side with light pressure and slow breathing.',
        ['forearms', 'wrists']
      ),
      ex(
        phase === 4 ? 'Supine Hamstring Strapless Floss' : 'Hamstring Doorway Stretch - Alternating',
        60,
        'Alternate legs with a soft knee and calm breath. Keep the stretch mild enough to relax into.',
        ['hamstrings', 'calves'],
        ['Yoga Mat']
      ),
      ex(
        'Lat Prayer Stretch',
        45,
        'Kneel with hands forward, sink hips back, and breathe into the sides of the ribs.',
        ['lats', 'shoulders'],
        ['Yoga Mat']
      ),
    ];
  }

  if (day === 'tuesday') {
    return [
      ...(phase === 5
        ? [
            ex(
              'Couch Stretch',
              90,
              'Start with the left knee down and gently tuck the pelvis. Switch to the right side halfway and keep the front ribs quiet.',
              ['hip flexors', 'quads'],
              ['Yoga Mat'],
              { switchSides: true }
            ),
          ]
        : [
            ex(
              'Couch Stretch - Right',
              45,
              'Set the right knee on the mat and gently tuck the pelvis. Keep the front ribs quiet.',
              ['hip flexors', 'quads'],
              ['Yoga Mat']
            ),
            ex(
              'Couch Stretch - Left',
              45,
              'Repeat on the left side with the same easy breathing standard.',
              ['hip flexors', 'quads'],
              ['Yoga Mat']
            ),
          ]),
      ex(
        'Yoga Wheel Pec Opener',
        45,
        'Rest over the wheel or mat and let the chest open without forcing the shoulders.',
        ['chest', 'shoulders', 'thoracic spine'],
        ['Yoga wheel']
      ),
      ex(
        'Wrist Flexor Stretch - Alternating',
        45,
        'Gently stretch each palm and finger line after pressing work.',
        ['forearms', 'wrists']
      ),
    ];
  }

  return [
    ...(phase === 5
      ? [
          ex(
            'Pigeon Pose',
            90,
            'Start with the left shin forward and breathe into the outside hip. Switch to the right side halfway without forcing range.',
            ['glutes', 'hips'],
            ['Yoga Mat'],
            { switchSides: true }
          ),
          ex(
            'Supine Twist',
            80,
            'Start with the left knee crossing the body and keep both shoulders heavy. Switch to the right side halfway and slow the breath down.',
            ['back', 'obliques'],
            ['Yoga Mat'],
            { switchSides: true }
          ),
        ]
      : [
          ex(
            'Pigeon Pose - Right',
            45,
            'Set the front shin at a comfortable angle and breathe into the outside hip.',
            ['glutes', 'hips'],
            ['Yoga Mat']
          ),
          ex(
            'Pigeon Pose - Left',
            45,
            'Match the right side without forcing range.',
            ['glutes', 'hips'],
            ['Yoga Mat']
          ),
          ex(
            'Supine Twist - Right',
            40,
            'Let the right knee cross the body and keep shoulders heavy.',
            ['back', 'obliques'],
            ['Yoga Mat']
          ),
          ex(
            'Supine Twist - Left',
            40,
            'Repeat left and slow the breath down.',
            ['back', 'obliques'],
            ['Yoga Mat']
          ),
        ]),
    ex(
      'Box Breathing',
      45,
      'Inhale, hold, exhale, and hold for an even count. Let the session downshift.',
      ['diaphragm', 'nervous system']
    ),
  ];
};

const cardioCoolDown = (phase: Phase): ExerciseSeed[] => {
  const shared = [
    ex('Easy Spin Downshift', 240, 'Back off to an easy spin and let heart rate drift down gradually.', ['cardiovascular system'], ['Road Bike']),
  ];

  if (phase === 5) {
    return [
      ...shared,
      ex(
        'Calf Stretch',
        90,
        'Start on the left with light pressure through the heel. Switch to the right side halfway and keep the exhale long.',
        ['calves'],
        undefined,
        { switchSides: true }
      ),
      ex(
        'Figure-4 Stretch',
        90,
        'Start with the left ankle over the right thigh and breathe into the outside hip. Switch to the right side halfway.',
        ['glutes', 'hips'],
        ['Yoga Mat'],
        { switchSides: true }
      ),
    ];
  }

  if (phase === 1) {
    return [
      ...shared,
      ex('Calf Stretch - Right', 45, 'Long exhale and easy pressure through the heel.', ['calves']),
      ex('Calf Stretch - Left', 45, 'Match the right side.', ['calves']),
      ex('Figure-4 Stretch - Right', 45, 'Cross the right ankle over the left thigh and breathe into the outside hip.', ['glutes', 'hips'], ['Yoga Mat']),
      ex('Figure-4 Stretch - Left', 45, 'Repeat on the left side with relaxed breathing.', ['glutes', 'hips'], ['Yoga Mat']),
    ];
  }

  if (phase === 2 || phase === 3) {
    return [
      ...shared,
      ex('Half-Kneeling Hip Flexor Rock - Right', 45, 'Rock gently forward and back without pinching the front hip.', ['hip flexors', 'quads'], ['Yoga Mat']),
      ex('Half-Kneeling Hip Flexor Rock - Left', 45, 'Repeat on the left side and keep ribs stacked over pelvis.', ['hip flexors', 'quads'], ['Yoga Mat']),
      ex('Thoracic Open Book - Right', 45, 'Lie on the side and rotate the top arm open with a long exhale.', ['thoracic spine', 'chest'], ['Yoga Mat']),
      ex('Thoracic Open Book - Left', 45, 'Repeat left and keep hips stacked.', ['thoracic spine', 'chest'], ['Yoga Mat']),
    ];
  }

  return [
    ...shared,
    ex('Legs-Up Breathing', 90, 'Lie on the back with legs elevated on a wall or chair and let the breath slow.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ex('Ankle Circles Easy', 60, 'Circle both ankles slowly in each direction to downshift the calves after riding.', ['ankles', 'calves']),
  ];
};

const fingerByPhase: Record<Phase, ExerciseSeed> = {
  1: ex(
    'Hangboard 7:3 Repeaters',
    70,
    'Use a comfortable edge. Repeat 7 seconds on, 3 seconds off, staying far from failure and keeping shoulders active.',
    ['forearms', 'lats', 'shoulders'],
    ['Hangboard']
  ),
  2: ex(
    'Hangboard Max Hang Singles',
    60,
    'Do short, high-quality hangs with plenty of rest inside the minute. Stop with two clean reps in reserve.',
    ['forearms', 'lats', 'shoulders'],
    ['Hangboard'],
    { targetReps: 5 }
  ),
  3: ex(
    'Hangboard 6:4 Density Repeaters',
    80,
    'Use a friendly edge and cycle 6 seconds on, 4 seconds off. Keep every rep identical and quiet.',
    ['forearms', 'lats', 'shoulders'],
    ['Hangboard']
  ),
  4: ex(
    'Hangboard Large Edge Easy Repeaters',
    60,
    'Use the easiest useful edge and treat this as tissue practice. No grinding and no failed hangs.',
    ['forearms', 'lats', 'shoulders'],
    ['Hangboard']
  ),
  5: ex(
    'Hangboard Benchmark Repeaters',
    70,
    'Repeat the best Week 1 edge or a slightly harder one only if it feels excellent. Leave the session feeling sharp.',
    ['forearms', 'lats', 'shoulders'],
    ['Hangboard']
  ),
};

const hingeByPhase: Record<Phase, ExerciseSeed[]> = {
  1: [
    ex(
      'Dumbbell Romanian Deadlift',
      45,
      'Hold both dumbbells, push hips back, keep shins mostly vertical, and stand by squeezing glutes.',
      ['hamstrings', 'glutes', 'back'],
      ['Dumbbells'],
      { targetReps: 12 }
    ),
  ],
  2: [
    ex(
      'Single-Leg Dumbbell RDL - Right',
      40,
      'Hold one or two dumbbells, hinge on the right leg, and keep hips square.',
      ['hamstrings', 'glutes', 'core'],
      ['Dumbbells'],
      { targetReps: 8 }
    ),
    ex(
      'Single-Leg Dumbbell RDL - Left',
      40,
      'Repeat on the left leg with the same tempo and balance standard.',
      ['hamstrings', 'glutes', 'core'],
      ['Dumbbells'],
      { targetReps: 8 }
    ),
  ],
  3: [
    ex(
      'Weighted Vest Hip Thrust',
      45,
      'Wear the vest, drive through heels, pause at the top, and keep ribs down.',
      ['glutes', 'hamstrings', 'core'],
      ['Weight Vest', 'Yoga Mat'],
      { targetReps: 15 }
    ),
  ],
  4: [
    ex(
      'Banded Good Morning',
      45,
      'Stand on the band, hinge slowly, and use this as a light posterior chain groove.',
      ['hamstrings', 'glutes', 'back'],
      ['Resistance Bands'],
      { targetReps: 15 }
    ),
  ],
  5: [
    ex(
      'Tempo Dumbbell Romanian Deadlift',
      50,
      'Lower for three seconds, pause for one, and stand strong. Keep the weight close and reps crisp.',
      ['hamstrings', 'glutes', 'back'],
      ['Dumbbells'],
      { targetReps: 10 }
    ),
  ],
};

const pullByPhase: Record<Phase, ExerciseSeed> = {
  1: ex(
    'Pull to Front Lever Tucks',
    40,
    'Pull hard, tuck knees toward the chest, and briefly show a hollow-body line before lowering.',
    ['lats', 'back', 'core'],
    ['Pull-up Bar'],
    { targetReps: 5 }
  ),
  2: ex(
    'Archer Pull-ups',
    40,
    'Pull toward one hand, alternate sides each rep, and keep shoulder blades packed.',
    ['lats', 'back', 'biceps'],
    ['Pull-up Bar'],
    { targetReps: 6 }
  ),
  3: ex(
    'Feet-Elevated Ring Rows',
    45,
    'Set the rings low, keep a plank line, and pull thumbs to ribs with a pause.',
    ['back', 'rear delts', 'biceps'],
    ['Gymnastic Rings'],
    { targetReps: 12 }
  ),
  4: ex(
    'Slow Scapular Pull-up to Hollow Hang',
    40,
    'Do a scapular pull-up, hold a hollow hang, then lower slowly. Keep effort moderate.',
    ['lats', 'lower traps', 'core'],
    ['Pull-up Bar'],
    { targetReps: 6 }
  ),
  5: ex(
    'Chest-to-Bar Pull-ups',
    40,
    'Pull explosively while staying strict. Stop before form changes.',
    ['lats', 'back', 'biceps'],
    ['Pull-up Bar'],
    { targetReps: 6 }
  ),
};

const chestByPhase: Record<Phase, ExerciseSeed> = {
  1: ex(
    'Ring Pushups with Turnout',
    40,
    'Lower under control, press up, and turn rings slightly out at the top.',
    ['chest', 'triceps', 'shoulders', 'core'],
    ['Gymnastic Rings'],
    { targetReps: 10 }
  ),
  2: ex(
    'Ring Dips',
    40,
    'Use a smooth range that keeps shoulders happy. Lock out with rings steady.',
    ['chest', 'triceps', 'shoulders'],
    ['Gymnastic Rings'],
    { targetReps: 8 }
  ),
  3: ex(
    'One-Arm Pushup Progression - Right',
    35,
    'Use a wide stance and elevated hand if needed. Keep hips square and ribs down.',
    ['chest', 'triceps', 'core'],
    ['Yoga Mat'],
    { targetReps: 5 }
  ),
  4: ex(
    'Tempo Pushups',
    40,
    'Lower for three seconds, pause lightly, and press with perfect shoulder position.',
    ['chest', 'triceps', 'shoulders'],
    ['Yoga Mat'],
    { targetReps: 10 }
  ),
  5: ex(
    'Weighted Vest Pushups',
    40,
    'Wear the vest only if reps stay snappy. Keep a rigid plank and full range.',
    ['chest', 'triceps', 'core'],
    ['Weight Vest', 'Yoga Mat'],
    { targetReps: 10 }
  ),
};

const chestFollowUpByPhase: Record<Phase, ExerciseSeed | undefined> = {
  1: undefined,
  2: undefined,
  3: ex(
    'One-Arm Pushup Progression - Left',
    35,
    'Match the right side rep quality and stop before twisting.',
    ['chest', 'triceps', 'core'],
    ['Yoga Mat'],
    { targetReps: 5 }
  ),
  4: undefined,
  5: undefined,
};

const squatByPhase: Record<Phase, ExerciseSeed[]> = {
  1: [
    ex(
      'Pistol Squat - Right Leg',
      35,
      'Use a controlled descent and a light counterbalance if needed.',
      ['quads', 'glutes', 'core'],
      ['Yoga Mat'],
      { targetReps: 6 }
    ),
    ex(
      'Pistol Squat - Left Leg',
      35,
      'Match depth and control on the left side.',
      ['quads', 'glutes', 'core'],
      ['Yoga Mat'],
      { targetReps: 6 }
    ),
  ],
  2: [
    ex(
      'Bulgarian Split Squat - Right Leg',
      40,
      'Hold dumbbells if clean. Drive through the front foot and keep the torso tall.',
      ['quads', 'glutes', 'hamstrings'],
      ['Dumbbells'],
      { targetReps: 8 }
    ),
    ex(
      'Bulgarian Split Squat - Left Leg',
      40,
      'Repeat on the left leg with the same range and tempo.',
      ['quads', 'glutes', 'hamstrings'],
      ['Dumbbells'],
      { targetReps: 8 }
    ),
  ],
  3: [
    ex(
      'Dumbbell Goblet Squat',
      45,
      'Hold one dumbbell at the chest, sit between the knees, and stand fast.',
      ['quads', 'glutes', 'core'],
      ['Dumbbells'],
      { targetReps: 14 }
    ),
  ],
  4: [
    ex(
      'Cossack Squat Alternating',
      45,
      'Move side to side smoothly and keep this mobility-strength focused.',
      ['quads', 'adductors', 'glutes'],
      ['Yoga Mat'],
      { targetReps: 10 }
    ),
  ],
  5: [
    ex(
      'Weighted Vest Pistol Squat - Right Leg',
      35,
      'Use the vest only if control is excellent. Otherwise remove it and own the rep.',
      ['quads', 'glutes', 'core'],
      ['Weight Vest', 'Yoga Mat'],
      { targetReps: 5 }
    ),
    ex(
      'Weighted Vest Pistol Squat - Left Leg',
      35,
      'Match the right side and keep the knee tracking clean.',
      ['quads', 'glutes', 'core'],
      ['Weight Vest', 'Yoga Mat'],
      { targetReps: 5 }
    ),
  ],
};

const tuesdayLowerByPhase: Record<Phase, ExerciseSeed[]> = {
  ...squatByPhase,
  1: [
    ex(
      'Tempo Dumbbell Goblet Squat',
      45,
      'Hold one dumbbell at the chest, lower for three seconds, pause lightly, and stand with clean knee tracking. This is controlled quad work, not another pistol squat day.',
      ['quads', 'glutes', 'core'],
      ['Dumbbells'],
      { targetReps: 10 }
    ),
    ex(
      'Glute Bridge March',
      35,
      'Keep hips level, ribs down, and alternate slow marches without letting the pelvis roll.',
      ['glutes', 'hamstrings', 'core'],
      ['Yoga Mat']
    ),
  ],
  2: [
    ex(
      'Dumbbell Front-Rack Squat',
      45,
      'Hold the dumbbells at shoulder height, sit between the knees, and keep the torso tall. This gives Tuesday a bilateral squat pattern after Monday single-leg work.',
      ['quads', 'glutes', 'core'],
      ['Dumbbells'],
      { targetReps: 10 }
    ),
    ex(
      'Tall-Kneeling Hip Hinge',
      35,
      'Kneel on the mat, push hips back toward heels, then squeeze glutes to return tall. Keep it smooth and restorative.',
      ['glutes', 'hamstrings', 'core'],
      ['Yoga Mat']
    ),
  ],
  3: [
    ex(
      'Reverse Lunge Alternating',
      45,
      'Step back into each lunge with a quiet landing and stand by driving through the front foot. Hold dumbbells only if control stays crisp.',
      ['quads', 'glutes', 'hamstrings', 'core'],
      ['Dumbbells'],
      { targetReps: 10 }
    ),
    ex(
      'Calf Raise with Slow Lower',
      35,
      'Rise smoothly, pause, and lower for three seconds. Use the wall or rings for balance if needed.',
      ['calves', 'feet'],
      [],
      { targetReps: 12 }
    ),
  ],
  4: [
    ex(
      'Supported Split Squat Iso - Alternating',
      45,
      'Use the rings lightly for balance and hold a comfortable split-squat position, alternating sides halfway through.',
      ['quads', 'glutes', 'hip flexors'],
      ['Gymnastic Rings', 'Yoga Mat']
    ),
  ],
  5: [
    ex(
      'Dumbbell Cyclist Squat',
      45,
      'Elevate heels slightly on the mat if comfortable, keep the torso tall, and use a smooth quad-dominant squat.',
      ['quads', 'glutes', 'core'],
      ['Dumbbells', 'Yoga Mat'],
      { targetReps: 12 }
    ),
    ex(
      'Supported Hip Airplane Switches',
      35,
      'Hold the rings lightly, open and close the hip with control, and keep this about coordination rather than fatigue.',
      ['glutes', 'hip stabilizers', 'core'],
      ['Gymnastic Rings']
    ),
  ],
};

const fridayPosteriorByPhase: Record<Phase, ExerciseSeed[]> = {
  1: [
    ex(
      'Weighted Vest Hip Thrust',
      45,
      'Wear the vest if it feels clean, drive through heels, and pause at the top without arching the low back.',
      ['glutes', 'hamstrings', 'core'],
      ['Weight Vest', 'Yoga Mat'],
      { targetReps: 12 }
    ),
  ],
  2: [
    ex(
      'Dumbbell Romanian Deadlift',
      45,
      'Use the bilateral hinge today so Friday does not repeat Monday single-leg balance work. Keep the weights close and reps smooth.',
      ['hamstrings', 'glutes', 'back'],
      ['Dumbbells'],
      { targetReps: 12 }
    ),
  ],
  3: [
    ex(
      'Single-Leg Glute Bridge - Right',
      35,
      'Drive through the right heel, keep hips level, and pause at the top.',
      ['glutes', 'hamstrings', 'core'],
      ['Yoga Mat'],
      { targetReps: 10 }
    ),
    ex(
      'Single-Leg Glute Bridge - Left',
      35,
      'Match the right side with the same tempo and hip height.',
      ['glutes', 'hamstrings', 'core'],
      ['Yoga Mat'],
      { targetReps: 10 }
    ),
  ],
  4: [
    ex(
      'Hamstring Walkouts',
      45,
      'Start from a glute bridge and walk heels out only as far as control allows, then return slowly.',
      ['hamstrings', 'glutes', 'core'],
      ['Yoga Mat'],
      { targetReps: 6 }
    ),
  ],
  5: [
    ex(
      'Long-Lever Glute Bridge',
      45,
      'Set heels farther from the body, keep ribs down, and squeeze glutes without cramping the hamstrings.',
      ['glutes', 'hamstrings', 'core'],
      ['Yoga Mat'],
      { targetReps: 12 }
    ),
  ],
};

function mondayStrength(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const rounds = phase === 4 ? 2 : 3;
  const chestFollowUp = chestFollowUpByPhase[phase];
  const ringCircuitExercises = [
    pullByPhase[phase],
    chestByPhase[phase],
    ...(chestFollowUp ? [chestFollowUp] : []),
    ...squatByPhase[phase],
    ex(
      phase === 3 ? 'Hollow Body Rocks' : 'Ring L-Sit Hold',
      phase === 3 ? 35 : 30,
      phase === 3
        ? 'Rock from shoulders to hips without losing the hollow shape.'
        : 'Hold a clean L-sit or tuck L-sit with rings quiet and shoulders down.',
      ['core', 'hip flexors', 'shoulders'],
      phase === 3 ? ['Yoga Mat'] : ['Gymnastic Rings']
    ),
  ];

  return programmedWorkout({
    id: `program-2026-07-${phase}-monday-strength-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${phaseLabel} Monday: lean-mass preservation, posterior chain, and a small finger-strength dose without making climbing the main goal.`,
    name: `${phaseLabel} Metabolic Strength: Hinge and Pull`,
    description:
      'A compact strength session for body composition, posterior chain development, and climbing carryover. It keeps the week broad without turning every day into the same full-body circuit.',
    difficulty: phase === 4 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 4 ? 190 : 235,
    calorieRange: phase === 4 ? { low: 160, high: 220 } : { low: 205, high: 275 },
    focusAreas: ['strength', 'body composition', 'upper body', 'lower body', 'core'],
    muscleGroupsTargeted: ['forearms', 'back', 'lats', 'hamstrings', 'glutes', 'chest', 'quads', 'core'],
    warmUp: strengthWarmUp('monday', phase),
    circuits: [
      {
        name: 'Finger and Hinge Primer',
        rounds,
        restBetweenRounds: phase === 4 ? 75 : 60,
        restBetweenExercises: 15,
        exercises: [
          fingerByPhase[phase],
          ...hingeByPhase[phase],
          ex(
            'Hollow Body Hold',
            40,
            'Press low back toward the floor and hold a shape you can own. Bend knees if the back arches.',
            ['core', 'hip flexors'],
            ['Yoga Mat']
          ),
        ],
      },
      {
        name: 'Rings, Legs, and Core',
        rounds: phase === 4 ? 2 : 3,
        restBetweenRounds: phase === 4 ? 75 : 60,
        restBetweenExercises: 12,
        exercises: ringCircuitExercises,
      },
    ],
    coolDown: strengthCoolDown('monday', phase),
    partingWords:
      'You gave the week a precise opening signal: fingers, back, hinge, push, legs, and core all got useful work. That is the kind of deliberate volume that compounds without wasting time.',
  });
}

function tuesdayStrength(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const shoulderExercise =
    phase === 1
      ? ex('Pike Handstand Pushups', 35, 'Use a high-hip pike and press the floor away. Keep reps smooth.', ['shoulders', 'triceps', 'upper chest'], ['Yoga Mat'], { targetReps: 8 })
      : phase === 2
        ? ex('Wall Handstand Pushup Negatives', 35, 'Kick to the wall, lower under control, and come down before fatigue changes the line.', ['shoulders', 'triceps', 'core'], ['Yoga Mat'], { targetReps: 4 })
        : phase === 3
          ? ex('Dumbbell Push Press', 40, 'Use a shallow dip and crisp drive, then control the dumbbells back down. This keeps the press powerful without another squat exposure.', ['shoulders', 'triceps', 'core'], ['Dumbbells'], { targetReps: 8 })
          : phase === 4
            ? ex('Half-Kneeling Band Press - Alternating', 45, 'Press a light band forward from half kneeling, alternating sides with control.', ['chest', 'shoulders', 'core'], ['Resistance Bands'], { targetReps: 12 })
            : ex('Strict Handstand Pushup Practice', 35, 'Use the hardest clean variation available today, stopping with perfect control.', ['shoulders', 'triceps', 'core'], ['Yoga Mat'], { targetReps: 5 });

  return programmedWorkout({
    id: `program-2026-07-${phase}-tuesday-strength-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${phaseLabel} Tuesday: quad-dominant legs, shoulder strength, and antagonist balance after Monday's hinge emphasis.`,
    name: `${phaseLabel} Strength: Squat, Press, and Scapula`,
    description:
      'This session moves stress away from heavy finger work and into knees, shoulders, scapular balance, and trunk control. It preserves muscle while giving the posterior chain a different job than Monday.',
    difficulty: phase === 4 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 4 ? 180 : 225,
    calorieRange: phase === 4 ? { low: 150, high: 215 } : { low: 195, high: 265 },
    focusAreas: ['strength', 'lower body', 'upper body', 'core', 'mobility'],
    muscleGroupsTargeted: ['quads', 'glutes', 'shoulders', 'chest', 'upper back', 'core', 'obliques'],
    warmUp: strengthWarmUp('tuesday', phase),
    circuits: [
      {
        name: 'Squat and Press Block',
        rounds: phase === 4 ? 2 : 3,
        restBetweenRounds: phase === 4 ? 75 : 60,
        restBetweenExercises: 12,
        exercises: [
          ...tuesdayLowerByPhase[phase],
          shoulderExercise,
          ex(
            'Ring Face Pulls',
            40,
            'Pull rings toward the face with elbows high. Pause and feel the rear delts and mid-back.',
            ['upper back', 'rear delts', 'rotator cuff'],
            ['Gymnastic Rings'],
            { targetReps: 12 }
          ),
          ex(
            'Dead Bug with Reach',
            40,
            'Move opposite arm and leg slowly while keeping the ribs heavy and low back quiet.',
            ['core', 'hip flexors'],
            ['Yoga Mat']
          ),
        ],
      },
      {
        name: 'Control Finisher',
        rounds: 2,
        restBetweenRounds: 60,
        restBetweenExercises: 12,
        exercises: [
          ex(
            phase === 4 ? 'Skin the Cat Mobility' : 'Skin the Cat Progression',
            45,
            'Move through the rings slowly and use only the range that feels controlled.',
            ['shoulders', 'back', 'core'],
            ['Gymnastic Rings']
          ),
          ...(phase === 5
            ? [
                ex(
                  'Side Plank',
                  60,
                  'Start on the left, stack shoulders and hips, and press the floor away. Switch to the right side halfway and keep breathing.',
                  ['obliques', 'shoulders', 'glutes'],
                  ['Yoga Mat'],
                  { switchSides: true }
                ),
              ]
            : [
                ex(
                  'Side Plank - Right',
                  30,
                  'Stack shoulders and hips, press the floor away, and breathe.',
                  ['obliques', 'shoulders', 'glutes'],
                  ['Yoga Mat']
                ),
                ex(
                  'Side Plank - Left',
                  30,
                  'Match the right side and avoid letting hips roll open.',
                  ['obliques', 'shoulders', 'glutes'],
                  ['Yoga Mat']
                ),
              ]),
          ex(
            'Band Pull-Aparts',
            40,
            'Keep arms mostly straight and pull the band to the chest with shoulder blades moving cleanly.',
            ['upper back', 'rear delts'],
            ['Resistance Bands'],
            { targetReps: 18 }
          ),
        ],
      },
    ],
    coolDown: strengthCoolDown('tuesday', phase),
    partingWords:
      'That was useful strength without piling more of the exact same stress onto yesterday. Your knees, shoulders, trunk, and scapular control all got a clean signal.',
  });
}

function wednesdayClimbingWarmup(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];

  return programmedWorkout({
    id: `program-2026-07-${phase}-wednesday-climb-warmup-${date}`,
    date,
    slot: 'Warm-up',
    priority: 1,
    coachNotes: `${phaseLabel} Wednesday: a short climbing primer before the real session. Keep it easy enough that the wall gets your best effort.`,
    name: `${phaseLabel} Climbing Warm-up`,
    description:
      'A shoulder, finger, hip, and trunk activation stack for climbing days. It is designed to prepare movement quality rather than create fatigue.',
    difficulty: 'intermediate',
    targetDurationMinutes: 8,
    estimatedCalories: 45,
    calorieRange: { low: 30, high: 60 },
    focusAreas: ['mobility', 'sports performance', 'upper body', 'core'],
    muscleGroupsTargeted: ['forearms', 'shoulders', 'back', 'lats', 'hips', 'core'],
    warmUp: climbingWarmUp(phase),
    circuits: [],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'You are warm, organized, and ready to climb. Save the hard effort for the wall and keep the first routes smooth.',
  });
}

function wednesdaySnack(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];

  return programmedWorkout({
    id: `program-2026-07-${phase}-wednesday-snack-${date}`,
    date,
    slot: 'Snack',
    priority: 2,
    coachNotes: `${phaseLabel} Wednesday snack: antagonist and mobility work that complements climbing without stealing recovery.`,
    name: `${phaseLabel} Antagonist Snack`,
    description:
      'A small mid-day stack for the muscles climbing underloads: pushing, rotator cuff, trunk extension control, and hips. It should feel like maintenance, not another main workout.',
    difficulty: 'intermediate',
    targetDurationMinutes: 10,
    estimatedCalories: 55,
    calorieRange: { low: 40, high: 75 },
    focusAreas: ['mobility', 'upper body', 'core', 'recovery'],
    muscleGroupsTargeted: ['chest', 'triceps', 'rear delts', 'rotator cuff', 'core', 'hips'],
    warmUp: [],
    circuits: [
      {
        name: 'Antagonist Mini-Circuit',
        rounds: phase === 4 ? 1 : 2,
        restBetweenRounds: 30,
        restBetweenExercises: 8,
        exercises: [
          ex(
            phase === 2 ? 'Ring Support Hold' : 'Ring Pushup Easy Tempo',
            phase === 2 ? 35 : 40,
            phase === 2
              ? 'Hold the top of the rings with shoulders down and elbows locked. Keep it clean and stop early if shaky.'
              : 'Move slowly and keep elbows about 45 degrees from the body.',
            ['chest', 'triceps', 'shoulders', 'core'],
            ['Gymnastic Rings']
          ),
          ...(phase === 5
            ? [
                ex(
                  'Band External Rotation',
                  60,
                  'Start on the left with the elbow pinned near the ribs. Switch to the right side halfway and keep every rep small and controlled.',
                  ['rotator cuff', 'shoulders'],
                  ['Resistance Bands'],
                  { switchSides: true }
                ),
              ]
            : [
                ex(
                  'Band External Rotation - Right',
                  30,
                  'Pin the elbow near the ribs and rotate the hand away slowly.',
                  ['rotator cuff', 'shoulders'],
                  ['Resistance Bands'],
                  { targetReps: 12 }
                ),
                ex(
                  'Band External Rotation - Left',
                  30,
                  'Match the right side with small, controlled reps.',
                  ['rotator cuff', 'shoulders'],
                  ['Resistance Bands'],
                  { targetReps: 12 }
                ),
              ]),
          ex(
            'Reverse Plank',
            35,
            'Open the chest, squeeze glutes, and keep the neck long.',
            ['glutes', 'hamstrings', 'chest', 'shoulders'],
            ['Yoga Mat']
          ),
          ex(
            'Yoga Wheel Chest Opener',
            45,
            'Settle onto the wheel and breathe into the front of the ribs.',
            ['chest', 'thoracic spine'],
            ['Yoga wheel']
          ),
        ],
      },
    ],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'That little dose keeps the shoulders balanced and the hips moving. Small maintenance sessions are part of staying climb-ready.',
  });
}

function thursdayCardio(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const zoneTwoDuration = phase === 4 ? 1800 : 2100;

  return programmedWorkout({
    id: `program-2026-07-${phase}-thursday-cardio-${date}`,
    date,
    slot: 'Cardio',
    priority: 1,
    coachNotes: `${phaseLabel} Thursday: default to steady road-bike Zone 2 for LDL, body composition, and aerobic base. Hit Record Ride and let GPS log it.`,
    name: `${phaseLabel} Zone 2 Road Ride`,
    activityType: 'ride',
    description:
      'A steady road-bike Zone 2 session for aerobic health, LDL support, and body composition. Keep the pace conversational and boring in the best possible way.',
    difficulty: 'intermediate',
    targetDurationMinutes: 45,
    estimatedCalories: phase === 4 ? 300 : 380,
    calorieRange: phase === 4 ? { low: 240, high: 360 } : { low: 310, high: 460 },
    focusAreas: ['cardio', 'endurance', 'longevity', 'body composition'],
    muscleGroupsTargeted: ['quads', 'hamstrings', 'glutes', 'calves', 'core', 'hip flexors'],
    warmUp: [
      ex('Easy Spin Ramp',
        300,
        'Start with a very easy cadence and gradually settle into a smooth rhythm. Keep breathing calm and nasal if possible.',
        ['quads', 'hamstrings', 'glutes', 'calves'],
        ['Road Bike']
      ),
    ],
    circuits: [
      {
        name: 'Zone 2 Block',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 0,
        exercises: [
          ex(
            'Road Bike Zone 2',
            zoneTwoDuration,
            'Ride at a conversational effort, roughly RPE 4-5. You should feel like you could keep going, with steady cadence and no surges.',
            ['quads', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'],
            ['Road Bike']
          ),
        ],
      },
    ],
    coolDown: cardioCoolDown(phase),
    restBetweenCircuits: 60,
    partingWords:
      'That was the kind of quiet aerobic work that pays rent: heart health, metabolic fitness, recovery capacity, and body composition all get a useful signal.',
  });
}

function thursdayHealthSnack(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const intervalExercise =
    phase === 4
      ? ex('Brisk Walk or Easy Rope', 45, 'Move easily and keep this restorative.', ['calves', 'quads', 'cardiovascular system'], ['Jump Rope'])
      : ex('Jump Rope Pickup', 30, 'Do a short, crisp pickup. Stop before it feels like a workout.', ['calves', 'shoulders', 'core'], ['Jump Rope']);

  return programmedWorkout({
    id: `program-2026-07-${phase}-thursday-health-snack-${date}`,
    date,
    slot: 'Snack',
    priority: 2,
    coachNotes: `${phaseLabel} Thursday optional: mobility plus a tiny conditioning touch if you want more movement volume.`,
    name: `${phaseLabel} Mobility and Pickup Snack`,
    description:
      'A short add-on for mobility, posture, and a small optional conditioning touch. Use this when you want more health-oriented movement without compromising recovery.',
    difficulty: 'beginner',
    targetDurationMinutes: 12,
    estimatedCalories: phase === 4 ? 35 : 55,
    calorieRange: phase === 4 ? { low: 25, high: 50 } : { low: 40, high: 80 },
    focusAreas: ['mobility', 'cardio', 'recovery', 'longevity'],
    muscleGroupsTargeted: ['hips', 'thoracic spine', 'calves', 'shoulders', 'core'],
    warmUp: [],
    circuits: [
      {
        name: 'Health Snack',
        rounds: 2,
        restBetweenRounds: 20,
        restBetweenExercises: 8,
        exercises: [
          ex('Yoga Wheel Thoracic Opener', 45, 'Settle over the wheel and breathe into the front of the ribs.', ['thoracic spine', 'chest'], ['Yoga wheel']),
          ex('Deep Squat Pry', 45, 'Sit into a comfortable squat and gently shift side to side.', ['hips', 'adductors', 'quads'], ['Yoga Mat']),
          intervalExercise,
          ex('Dead Bug Breathing', 45, 'Slow reps with a full exhale and quiet low back.', ['core', 'diaphragm'], ['Yoga Mat']),
        ],
      },
    ],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'Good extra movement. These small mobility and conditioning doses make the bigger health goal easier to sustain.',
  });
}

function fridayStrength(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const rounds = phase === 4 ? 2 : 3;
  const fridayPush =
    phase === 1
      ? ex('Ring Dips', 40, 'Smooth reps with rings quiet. Stop before the shoulder position degrades.', ['chest', 'triceps', 'shoulders'], ['Gymnastic Rings'], { targetReps: 8 })
      : phase === 3
        ? ex('Feet-Elevated Ring Pushups', 40, 'Set the rings low, elevate feet only if shoulders stay happy, and keep a rigid plank line.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings'], { targetReps: 10 })
        : chestByPhase[phase];

  return programmedWorkout({
    id: `program-2026-07-${phase}-friday-strength-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${phaseLabel} Friday: a second strength exposure with different angles and density from Monday and Tuesday.`,
    name: `${phaseLabel} Strength Density and Core Lock`,
    description:
      'This closes the strength week with rings, vertical pulling, hinge or glute work, and trunk stiffness. It is broad enough for health and lean-mass retention, with useful climbing carryover.',
    difficulty: phase === 4 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 4 ? 185 : 240,
    calorieRange: phase === 4 ? { low: 155, high: 220 } : { low: 205, high: 285 },
    focusAreas: ['strength', 'body composition', 'upper body', 'posterior chain', 'core'],
    muscleGroupsTargeted: ['chest', 'lats', 'back', 'forearms', 'glutes', 'hamstrings', 'shoulders', 'core'],
    warmUp: strengthWarmUp('friday', phase),
    circuits: [
      {
        name: 'Power Pull and Push',
        rounds,
        restBetweenRounds: phase === 4 ? 75 : 60,
        restBetweenExercises: 15,
        exercises: [
          phase === 1 || phase === 4 ? pullByPhase[phase] : fingerByPhase[phase],
          fridayPush,
          ex(
            phase === 3 ? 'Typewriter Pull-ups' : 'Ring Archer Rows',
            40,
            phase === 3
              ? 'Pull up and shift side to side under control. Use fewer reps rather than losing position.'
              : 'Row toward one ring, return, then alternate sides with a rigid body line.',
            ['lats', 'back', 'biceps', 'core'],
            phase === 3 ? ['Pull-up Bar'] : ['Gymnastic Rings'],
            { targetReps: phase === 3 ? 5 : 8 }
          ),
          ex(
            'Ring Knee Tuck',
            35,
            'Support on the rings and tuck knees toward the chest without swinging.',
            ['core', 'hip flexors', 'shoulders'],
            ['Gymnastic Rings'],
            { targetReps: 8 }
          ),
        ],
      },
      {
        name: 'Posterior Chain and Trunk',
        rounds,
        restBetweenRounds: 60,
        restBetweenExercises: 12,
        exercises: [
          ...fridayPosteriorByPhase[phase],
          ex(
            phase === 2 ? 'Weighted Vest Bear Crawl' : 'Bear Crawl Shoulder Tap',
            40,
            'Move slowly with quiet hips. Use the vest only if the crawl stays clean.',
            ['core', 'shoulders', 'quads'],
            phase === 2 ? ['Weight Vest', 'Yoga Mat'] : ['Yoga Mat']
          ),
          ex(
            'Reverse Nordic Lean',
            35,
            'Keep hips extended and lean back only as far as knees tolerate comfortably.',
            ['quads', 'hip flexors', 'core'],
            ['Yoga Mat'],
            { targetReps: 6 }
          ),
        ],
      },
    ],
    coolDown: strengthCoolDown('friday', phase),
    partingWords:
      'Strong finish. You touched power, tendon capacity, posterior chain, and trunk stiffness without just replaying the same workout again.',
  });
}

function saturdaySnack(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];
  const isMobility = phase === 4;

  return programmedWorkout({
    id: `program-2026-07-${phase}-saturday-snack-${date}`,
    date,
    slot: 'Snack',
    priority: 1,
    coachNotes: `${phaseLabel} Saturday: optional 10-minute movement snack. Keep it fun and leave fresher than you started.`,
    name: isMobility ? `${phaseLabel} Rest-Day Mobility Snack` : `${phaseLabel} Rest-Day Rope Snack`,
    description:
      'A small rest-day session to keep consistency alive without turning Saturday into a training day. Do it easy, or skip it if recovery is calling louder.',
    difficulty: 'beginner',
    targetDurationMinutes: 10,
    estimatedCalories: isMobility ? 35 : 70,
    calorieRange: isMobility ? { low: 25, high: 50 } : { low: 50, high: 95 },
    focusAreas: isMobility ? ['mobility', 'recovery'] : ['cardio', 'mobility', 'coordination'],
    muscleGroupsTargeted: ['calves', 'hips', 'shoulders', 'core'],
    warmUp: [],
    circuits: [
      {
        name: 'Movement Snack',
        rounds: 2,
        restBetweenRounds: 20,
        restBetweenExercises: 5,
        exercises: isMobility
          ? [
              ex('Yoga Wheel Thoracic Opener', 45, 'Relax over the wheel and breathe slowly.', ['thoracic spine', 'chest'], ['Yoga wheel']),
              ex('Deep Squat Pry', 45, 'Sit into a squat and gently shift side to side.', ['hips', 'adductors', 'quads'], ['Yoga Mat']),
              ex('Band Dislocates Easy', 45, 'Use a wide grip and stay relaxed.', ['shoulders', 'chest'], ['Resistance Bands']),
              ex('Dead Bug Breathing', 45, 'Slow reps with a full exhale.', ['core'], ['Yoga Mat']),
            ]
          : [
              ex('Jump Rope Boxer Step', 45, 'Light rhythm, easy shoulders, relaxed jaw.', ['calves', 'shoulders'], ['Jump Rope']),
              ex('Animal Flow Ape Reach', 45, 'Shift into a squat and reach across the body.', ['hips', 'thoracic spine', 'core'], ['Yoga Mat']),
              ex('Fast Feet In Place', 30, 'Quick feet with low impact and soft knees.', ['calves', 'quads', 'core']),
              ex('Yoga Wheel Chest Opener', 45, 'Open the chest and breathe slowly.', ['chest', 'thoracic spine'], ['Yoga wheel']),
            ],
      },
    ],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'Tiny session, useful signal. You kept the body moving without spending recovery you need for the next climb.',
  });
}

function sundayClimbingWarmup(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];

  return programmedWorkout({
    id: `program-2026-07-${phase}-sunday-climb-warmup-${date}`,
    date,
    slot: 'Warm-up',
    priority: 1,
    coachNotes: `${phaseLabel} Sunday: longer climbing day primer. Stay conservative so the session itself can be high quality.`,
    name: `${phaseLabel} Long Climb Warm-up`,
    description:
      'A slightly longer climbing-day warm-up that opens shoulders and hips, primes grip, and turns on trunk tension before a longer wall session.',
    difficulty: 'intermediate',
    targetDurationMinutes: 9,
    estimatedCalories: 55,
    calorieRange: { low: 40, high: 75 },
    focusAreas: ['mobility', 'sports performance', 'upper body', 'core'],
    muscleGroupsTargeted: ['forearms', 'shoulders', 'lats', 'back', 'hips', 'core', 'glutes'],
    warmUp: [
      ...climbingWarmUp(phase, 'long'),
      ex(
        phase === 4 ? 'Easy Ring Row' : 'Explosive Ring Row Primer',
        45,
        phase === 4
          ? 'Row gently and focus on shoulder blade motion.'
          : 'Do crisp ring rows with a fast pull and slow lower. Keep reps low and sharp.',
        ['back', 'rear delts', 'biceps'],
        ['Gymnastic Rings'],
        { targetReps: phase === 4 ? 8 : 6 }
      ),
    ],
    circuits: [],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'You are warm without being cooked. Go climb with patience, precision, and enough restraint to finish strong.',
  });
}

function sundayMobility(date: string, phase: Phase): ProgrammedWorkout {
  const phaseLabel = PHASE_LABELS[phase];

  return programmedWorkout({
    id: `program-2026-07-${phase}-sunday-mobility-${date}`,
    date,
    slot: 'Mobility',
    priority: 2,
    coachNotes: `${phaseLabel} Sunday optional: post-climb shoulder, lat, hip, and forearm downshift.`,
    name: `${phaseLabel} Post-Climb Downshift`,
    description:
      'A quiet optional reset for after climbing. It focuses on the tissues that tend to get tight: lats, chest, forearms, hip flexors, and the thoracic spine.',
    difficulty: 'beginner',
    targetDurationMinutes: 12,
    estimatedCalories: 35,
    calorieRange: { low: 25, high: 50 },
    focusAreas: ['mobility', 'recovery', 'flexibility'],
    muscleGroupsTargeted: ['forearms', 'lats', 'chest', 'hip flexors', 'glutes', 'thoracic spine'],
    warmUp: [],
    circuits: [
      {
        name: 'Post-Climb Reset',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 5,
        exercises: [
          ex('Forearm Flexor Stretch - Right', 45, 'Extend the right arm and gently stretch the palm and fingers back.', ['forearms']),
          ex('Forearm Flexor Stretch - Left', 45, 'Repeat on the left with gentle pressure only.', ['forearms']),
          ex('Lat Prayer Stretch', 60, 'Sink hips back and breathe into the side ribs.', ['lats', 'shoulders'], ['Yoga Mat']),
          ex('Supported Heart Opener', 60, 'Use the yoga wheel or mat to open the chest comfortably.', ['chest', 'thoracic spine'], ['Yoga wheel']),
          ex('Pigeon Pose - Right', 60, 'Set the front shin at a comfortable angle and breathe.', ['glutes', 'hips'], ['Yoga Mat']),
          ex('Pigeon Pose - Left', 60, 'Match the right side and stay relaxed.', ['glutes', 'hips'], ['Yoga Mat']),
          ex('Supine Twist - Right', 45, 'Let the right knee cross the body and keep shoulders heavy.', ['back', 'obliques'], ['Yoga Mat']),
          ex('Supine Twist - Left', 45, 'Repeat left and slow the breath down.', ['back', 'obliques'], ['Yoga Mat']),
        ],
      },
    ],
    coolDown: [],
    restBetweenCircuits: 0,
    partingWords:
      'Good downshift. Recovery work is not filler; it is what lets the next high-quality session happen.',
  });
}

function travelDriveReset(date: string, direction: 'Departure' | 'Return'): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-drive-reset`,
    date,
    slot: 'Mobility',
    priority: 1,
    coachNotes: `${direction} driving day: keep the streak alive with joint nutrition, hips, calves, T-spine, and easy circulation.`,
    name: `${direction} Drive-Day Reset`,
    description:
      'A compact travel-day decompression session for long car time. It is deliberately easy: move blood, open hips, and undo sitting without pretending this is a full training day.',
    difficulty: 'beginner',
    targetDurationMinutes: 14,
    estimatedCalories: 45,
    calorieRange: { low: 30, high: 65 },
    focusAreas: ['mobility', 'recovery', 'longevity'],
    muscleGroupsTargeted: ['hips', 'calves', 'thoracic spine', 'shoulders', 'core'],
    equipmentSetUsed: 'Bodyweight Travel',
    warmUp: [],
    circuits: [
      {
        name: 'Car-Seat Antidote',
        rounds: 2,
        restBetweenRounds: 15,
        restBetweenExercises: 5,
        exercises: [
          ex(
            'Walk or March Ramp',
            45,
            'Walk around the lot, march in place, or use quiet fast feet until the legs feel awake.',
            ['calves', 'quads', 'cardiovascular system']
          ),
          ex(
            'Standing Hip CARs',
            40,
            'Draw slow circles with one knee, switching sides halfway. Hold a wall or car door lightly if useful.',
            ['hips', 'glutes', 'core']
          ),
          ex(
            'Standing Lunge Hip Flexor Reach - Right',
            35,
            'Step the right leg back, squeeze the right glute, and reach overhead without arching.',
            ['hip flexors', 'quads', 'lats']
          ),
          ex(
            'Standing Lunge Hip Flexor Reach - Left',
            35,
            'Match the left side with a long exhale and easy range.',
            ['hip flexors', 'quads', 'lats']
          ),
          ex(
            'Mini Band Pull-Aparts or Wall Angels',
            40,
            'Use the mini band if it is handy; otherwise slide arms on a wall and keep ribs quiet.',
            ['upper back', 'rear delts', 'shoulders'],
            ['Mini Bands']
          ),
          ex(
            'Deep Squat Breathing',
            45,
            'Sit into a comfortable squat, shift slightly side to side, and take slow nasal breaths.',
            ['hips', 'adductors', 'ankles', 'diaphragm']
          ),
        ],
      },
    ],
    coolDown: [
      ex('Box Breathing Downshift', 60, 'Use an even inhale, hold, exhale, and hold to leave the session calmer.', ['diaphragm', 'nervous system']),
    ],
    restBetweenCircuits: 0,
    partingWords:
      'That is the right dose for a drive day. You gave the body a reason to feel less folded up without spending tomorrow.',
  });
}

function travelHotelGymMain(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-hotel-gym-main`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Travel Friday: use the hotel gym for low-friction aerobic work, then add enough bodyweight strength to feel normal again after the drive.',
    name: 'Travel Hotel Gym Reset',
    description:
      'A hotel-friendly reset that prioritizes Zone 2, posture, and simple strength after car time. Use any cardio machine available and keep the strength block clean rather than heroic.',
    difficulty: 'intermediate',
    targetDurationMinutes: 30,
    estimatedCalories: 220,
    calorieRange: { low: 170, high: 280 },
    focusAreas: ['cardio', 'body composition', 'mobility', 'strength'],
    muscleGroupsTargeted: ['quads', 'glutes', 'calves', 'chest', 'upper back', 'core', 'hips'],
    equipmentSetUsed: 'Hotel Gym + Travel Kit',
    warmUp: [
      ex(
        'Jump Rope Easy Bounce',
        45,
        'Use the rope if there is a good spot. If not, substitute quiet fast feet or a treadmill walk.',
        ['calves', 'shoulders', 'core'],
        ['Jump Rope']
      ),
      ex(
        'Hotel Cardio Ramp',
        180,
        'Start very easy and gradually settle into a conversational rhythm on the treadmill, bike, elliptical, or rower.',
        ['cardiovascular system', 'quads', 'glutes', 'calves'],
        ['Hotel Cardio Machine']
      ),
    ],
    circuits: [
      {
        name: 'Zone 2 Travel Block',
        rounds: 1,
        restBetweenRounds: 0,
        restBetweenExercises: 0,
        exercises: [
          ex(
            'Hotel Cardio Zone 2',
            900,
            'Stay at RPE 4-5: conversational, smooth, and boring in the best way. No intervals today.',
            ['cardiovascular system', 'quads', 'glutes', 'calves'],
            ['Hotel Cardio Machine']
          ),
        ],
      },
      {
        name: 'Post-Drive Strength Reset',
        rounds: 2,
        restBetweenRounds: 30,
        restBetweenExercises: 12,
        exercises: [
          ex(
            'Incline Pushups',
            40,
            'Hands on a bench or bed edge if needed. Keep shoulders down and stop before form changes.',
            ['chest', 'triceps', 'shoulders', 'core'],
            [],
            { targetReps: 12 }
          ),
          ex(
            'Walking Lunge Alternating',
            45,
            'Take controlled steps with a tall chest and quiet knees. Keep it like movement quality, not a sufferfest.',
            ['quads', 'glutes', 'hamstrings', 'core'],
            [],
            { targetReps: 12 }
          ),
          ex(
            'Mini Band Seated Row',
            45,
            'Loop the mini band around the feet, sit tall, and row elbows back with a one-count squeeze.',
            ['upper back', 'lats', 'rear delts'],
            ['Mini Bands'],
            { targetReps: 15 }
          ),
          ex(
            'Dead Bug Reach',
            40,
            'Reach long through opposite arm and leg while keeping the low back quiet.',
            ['core', 'hip flexors'],
            ['Yoga Mat']
          ),
        ],
      },
    ],
    coolDown: [
      ex(
        'Half-Kneeling Hip Flexor Rock - Right',
        45,
        'Tuck the pelvis gently and rock forward and back without pinching.',
        ['hip flexors', 'quads'],
        ['Yoga Mat']
      ),
      ex(
        'Half-Kneeling Hip Flexor Rock - Left',
        45,
        'Match the left side and keep the ribs stacked.',
        ['hip flexors', 'quads'],
        ['Yoga Mat']
      ),
      ex(
        'Thoracic Open Book - Right',
        45,
        'Rotate open with a long exhale and keep hips stacked.',
        ['thoracic spine', 'chest'],
        ['Yoga Mat']
      ),
      ex(
        'Thoracic Open Book - Left',
        45,
        'Repeat left and let the breath slow down.',
        ['thoracic spine', 'chest'],
        ['Yoga Mat']
      ),
    ],
    restBetweenCircuits: 45,
    partingWords:
      'Perfect travel dose: enough aerobic work to support the health goal, enough strength to feel like yourself, and no equipment drama.',
  });
}

function lakeRopePrimalMain(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-rope-primal-main`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Lake house Saturday: reintroduce training with rope rhythm and ground-based patterns instead of trying to replace the home gym.',
    name: 'Lake House Rope and Primal Flow',
    description:
      'A fun travel session built around jump rope, animal-flow patterns, hips, shoulders, and trunk control. This starts the lake-house block with athletic movement instead of repetitive calisthenics.',
    difficulty: 'intermediate',
    targetDurationMinutes: 30,
    estimatedCalories: 220,
    calorieRange: { low: 175, high: 280 },
    focusAreas: ['cardio', 'mobility', 'coordination', 'core'],
    muscleGroupsTargeted: ['calves', 'hips', 'quads', 'shoulders', 'chest', 'core', 'glutes'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Boxer Step', 60, 'Relax the shoulders and find an easy rhythm before the ground work.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Wrist Rocks and Palm Lifts', 45, 'Rock gently over the hands, then lift the palms with fingers planted.', ['wrists', 'forearms', 'shoulders'], ['Yoga Mat']),
      ex('Ape Reach Prep', 45, 'Sit into a squat and reach one arm across the body, alternating sides smoothly.', ['hips', 'thoracic spine', 'core'], ['Yoga Mat']),
      ex('Scap Pushup Wave', 40, 'Move only through the shoulder blades, then add a small spine wave if it feels good.', ['serratus', 'upper back', 'shoulders'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Rope and Ground Flow',
        rounds: 3,
        restBetweenRounds: 40,
        restBetweenExercises: 10,
        exercises: [
          ex('Jump Rope Easy Cruise', 60, 'Stay smooth and aerobic. If calves feel cooked, switch to fast feet.', ['calves', 'cardiovascular system', 'shoulders'], ['Jump Rope']),
          ex('Ape Reach to Lateral Shift', 45, 'Move side to side from a squat and reach across the body with control.', ['hips', 'adductors', 'thoracic spine'], ['Yoga Mat']),
          ex('Frogger Step-Through', 40, 'Step or lightly hop feet outside the hands, then step one foot through to rotate.', ['hips', 'quads', 'core', 'shoulders'], ['Yoga Mat']),
          ex('Side Kick-Through', 35, 'From a beast position, kick one leg through and rotate the torso. Keep it crisp, not rushed.', ['core', 'shoulders', 'obliques'], ['Yoga Mat']),
          ex('Prone Swimmer', 40, 'Lie face down and sweep arms from overhead to hips without shrugging.', ['upper back', 'shoulders', 'thoracic spine'], ['Yoga Mat']),
        ],
      },
      {
        name: 'Trunk Finish',
        rounds: 2,
        restBetweenRounds: 25,
        restBetweenExercises: 8,
        exercises: [
          ex('Quadruped Knee Hover Breath', 35, 'Hover knees one inch and breathe slowly without hips drifting.', ['core', 'quads', 'shoulders'], ['Yoga Mat']),
          ex('Cross-Body Mountain Climber Slow', 40, 'Drive knee toward opposite elbow with quiet hips and controlled tempo.', ['core', 'hip flexors', 'shoulders'], ['Yoga Mat']),
        ],
      },
    ],
    coolDown: [
      ex('90/90 Hip Breathing', 60, 'Settle into 90/90 and breathe into the outside hip, switching sides halfway.', ['hips', 'glutes'], ['Yoga Mat']),
      ex('Child Pose Lat Reach', 60, 'Reach one hand forward and one hand across to open the lats and ribs.', ['lats', 'thoracic spine'], ['Yoga Mat']),
      ex('Calf Wall Stretch - Alternating', 60, 'Alternate sides and keep the pressure easy after rope work.', ['calves', 'ankles']),
    ],
    partingWords:
      'That is exactly the travel-training mood: athletic, light on logistics, and still useful for health and movement quality.',
  });
}

function lakeMobilityFlowMain(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-mobility-flow-main`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Travel Sunday: no climbing today, so use the slot for tissue quality, breath, hips, shoulders, and low-intensity trunk work.',
    name: 'Lake House Mobility Flow and Core',
    description:
      'A non-climbing Sunday session that keeps the body moving without pretending you need another hard workout. It uses animal-flow transitions, hip work, and quiet core control.',
    difficulty: 'beginner',
    targetDurationMinutes: 28,
    estimatedCalories: 135,
    calorieRange: { low: 100, high: 175 },
    focusAreas: ['mobility', 'recovery', 'core', 'longevity'],
    muscleGroupsTargeted: ['hips', 'shoulders', 'thoracic spine', 'glutes', 'core', 'wrists'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Easy Bounce', 45, 'Use this as a temperature ramp only. Keep it very easy.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Spinal Wave to Child Pose', 50, 'Move through cat-cow, then sit back into child pose and breathe.', ['spine', 'lats', 'shoulders'], ['Yoga Mat']),
      ex('Ankle Knee Circles', 45, 'Circle knees over ankles in both directions with feet planted.', ['ankles', 'calves', 'quads']),
      ex('Scapular Clock', 45, 'In a plank or quadruped position, move the shoulder blades in small controlled circles.', ['shoulders', 'serratus', 'upper back'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Sunday Ground Flow',
        rounds: 3,
        restBetweenRounds: 30,
        restBetweenExercises: 8,
        exercises: [
          ex('Slow Beast to Down Dog', 45, 'Hover the knees, then press back into down dog and return with control.', ['shoulders', 'core', 'hamstrings', 'calves'], ['Yoga Mat']),
          ex('Crab Reach Alternating', 45, 'Bridge through the hips and reach one arm overhead, alternating slowly.', ['glutes', 'shoulders', 'thoracic spine', 'core'], ['Yoga Mat']),
          ex('Shinbox to Hip Extension', 45, 'Move through shinbox, then squeeze glutes into a tall hip extension.', ['hips', 'glutes', 'adductors'], ['Yoga Mat']),
          ex('Low Lizard Switch', 45, 'Step into a low lizard position, switch sides, and keep the breath calm.', ['hips', 'hamstrings', 'thoracic spine'], ['Yoga Mat']),
          ex('Mini Band Dead Bug Press', 40, 'Press gently into the band while alternating slow dead bug reps.', ['core', 'lats', 'hip flexors'], ['Mini Bands', 'Yoga Mat']),
        ],
      },
    ],
    coolDown: [
      ex('Supine Figure-4 - Right', 55, 'Breathe into the outside right hip without forcing range.', ['glutes', 'hips'], ['Yoga Mat']),
      ex('Supine Figure-4 - Left', 55, 'Match the left side and let the jaw relax.', ['glutes', 'hips'], ['Yoga Mat']),
      ex('Open-Chain Shoulder CARs', 60, 'Make slow shoulder circles in a pain-free range.', ['shoulders', 'upper back']),
      ex('Legs-Up Breathing', 90, 'Elevate legs on a couch or wall and downshift the nervous system.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords:
      'Good Sunday choice. You skipped the climbing-specific work and still banked mobility, breath, and quality movement.',
  });
}

function lakeBodyweightStrengthA(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-bodyweight-strength-a`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Lake house Monday: bodyweight strength with push, legs, posterior chain, rows via mini band, and trunk control.',
    name: 'Lake House Bodyweight Strength A',
    description:
      'A no-home-equipment strength session that keeps the weekly muscle-retention signal alive. It uses tempo, unilateral work, mini-band pulling, and trunk control instead of load.',
    difficulty: 'intermediate',
    targetDurationMinutes: 30,
    estimatedCalories: 210,
    calorieRange: { low: 170, high: 260 },
    focusAreas: ['strength', 'body composition', 'core', 'mobility'],
    muscleGroupsTargeted: ['chest', 'quads', 'glutes', 'hamstrings', 'upper back', 'core', 'calves'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Easy Bounce', 50, 'Stay light and elastic. Keep this below workout intensity.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Inchworm Walkout', 50, 'Walk hands to plank, pause, then walk back with soft knees.', ['hamstrings', 'core', 'shoulders'], ['Yoga Mat']),
      ex('Cossack Pry', 45, 'Shift side to side in a comfortable range and keep heels down if possible.', ['adductors', 'quads', 'hips'], ['Yoga Mat']),
      ex('Mini Band Lateral Walk', 45, 'Use a small step and keep knees tracking over toes.', ['glutes', 'hips'], ['Mini Bands']),
    ],
    circuits: [
      {
        name: 'Bodyweight Strength',
        rounds: 3,
        restBetweenRounds: 50,
        restBetweenExercises: 12,
        exercises: [
          ex('Slow Tempo Pushup', 40, 'Lower for three seconds, pause, and press cleanly. Elevate hands if needed.', ['chest', 'triceps', 'shoulders', 'core'], ['Yoga Mat'], { targetReps: 10 }),
          ex('Squat to Reverse Lunge', 45, 'Do one bodyweight squat, then step back into a reverse lunge and alternate legs.', ['quads', 'glutes', 'hamstrings', 'core'], ['Yoga Mat'], { targetReps: 8 }),
          ex('Mini Band Seated Row Tall Posture', 45, 'Loop the band around the feet and row with a one-count squeeze.', ['upper back', 'lats', 'rear delts'], ['Mini Bands'], { targetReps: 15 }),
          ex('Glute Bridge Walkout', 40, 'Bridge up, walk heels away a few inches, then return without dropping hips.', ['hamstrings', 'glutes', 'core'], ['Yoga Mat'], { targetReps: 6 }),
          ex('Hollow Body March', 35, 'Hold a hollow position and alternate slow marches without arching.', ['core', 'hip flexors'], ['Yoga Mat']),
        ],
      },
      {
        name: 'Posture and Calves',
        rounds: 2,
        restBetweenRounds: 25,
        restBetweenExercises: 8,
        exercises: [
          ex('Prone Y-T-W', 45, 'Move through Y, T, and W positions with thumbs up and neck long.', ['upper back', 'rear delts', 'shoulders'], ['Yoga Mat']),
          ex('Side Plank Thread - Right', 35, 'Thread the top arm under the ribs, then rotate open under control.', ['obliques', 'shoulders', 'glutes'], ['Yoga Mat']),
          ex('Side Plank Thread - Left', 35, 'Match the left side and keep hips stacked.', ['obliques', 'shoulders', 'glutes'], ['Yoga Mat']),
          ex('Calf Raise Iso Ladder', 40, 'Rise up, hold briefly, lower slowly, and keep reps springy but controlled.', ['calves', 'feet'], [], { targetReps: 15 }),
        ],
      },
    ],
    coolDown: [
      ex('Kneeling Quad Stretch - Right', 45, 'Tuck pelvis and breathe into the front of the right thigh.', ['quads', 'hip flexors'], ['Yoga Mat']),
      ex('Kneeling Quad Stretch - Left', 45, 'Repeat left with the same easy pressure.', ['quads', 'hip flexors'], ['Yoga Mat']),
      ex('Thread the Needle - Alternating', 60, 'Rotate through the upper back and let shoulders settle.', ['thoracic spine', 'shoulders'], ['Yoga Mat']),
      ex('Hamstring Floss - Alternating', 60, 'Alternate legs with a soft knee and relaxed breath.', ['hamstrings', 'calves'], ['Yoga Mat']),
    ],
    partingWords:
      'That is the lake-house strength template: simple tools, real tissue signal, and enough variation to avoid grinding the same pattern every day.',
  });
}

function lakeRopeCardio(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-rope-cardio`,
    date,
    slot: 'Cardio',
    priority: 1,
    coachNotes:
      'Lake house Tuesday: swap the usual road-bike Zone 2 idea for rope-based aerobic work and shoulder/hip maintenance.',
    name: 'Lake House Rope Cardio and Band Armor',
    description:
      'A jump-rope-forward aerobic session with enough band and mobility work to keep joints happy. Keep most intervals conversational and stop before calves get irritated.',
    difficulty: 'intermediate',
    targetDurationMinutes: 32,
    estimatedCalories: 260,
    calorieRange: { low: 205, high: 330 },
    focusAreas: ['cardio', 'coordination', 'mobility', 'longevity'],
    muscleGroupsTargeted: ['calves', 'quads', 'shoulders', 'upper back', 'hips', 'core'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Easy Bounce', 60, 'Very easy rhythm. If calves feel tight, use fast marching instead.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Ankle Pogos Low Amplitude', 35, 'Tiny elastic bounces with quiet feet and soft knees.', ['calves', 'ankles', 'feet']),
      ex('Mini Band Shoulder Halo', 45, 'Move the band around the head slowly with ribs down.', ['shoulders', 'upper back'], ['Mini Bands']),
      ex('Hip Opener Step-Back', 45, 'Step back, open the hip, and alternate sides smoothly.', ['hips', 'glutes', 'quads']),
    ],
    circuits: [
      {
        name: 'Rope Aerobic Ladder',
        rounds: 6,
        restBetweenRounds: 25,
        restBetweenExercises: 8,
        exercises: [
          ex('Jump Rope Zone 2 Cruise', 95, 'Stay relaxed and conversational. Use boxer step, bounce, or fast feet as needed.', ['calves', 'cardiovascular system', 'shoulders'], ['Jump Rope']),
          ex('Nasal Walk or March', 45, 'Walk around or march slowly until breathing settles.', ['cardiovascular system', 'calves']),
        ],
      },
      {
        name: 'Band Armor',
        rounds: 2,
        restBetweenRounds: 25,
        restBetweenExercises: 8,
        exercises: [
          ex('Mini Band Face Pull', 45, 'Pull toward eye level and rotate knuckles back slightly.', ['upper back', 'rear delts', 'rotator cuff'], ['Mini Bands'], { targetReps: 15 }),
          ex('Mini Band Monster Walk', 45, 'Step forward and back with knees tracking and hips level.', ['glutes', 'hips'], ['Mini Bands']),
          ex('Dead Bug Breathing Reset', 45, 'Slow dead bugs with full exhales and quiet ribs.', ['core', 'diaphragm'], ['Yoga Mat']),
        ],
      },
    ],
    coolDown: [
      ex('Calf Stretch - Right', 45, 'Long exhale and light pressure through the heel.', ['calves']),
      ex('Calf Stretch - Left', 45, 'Match the left side and keep the foot straight.', ['calves']),
      ex('90/90 Hip Switch Downshift', 60, 'Move between sides slowly and stay relaxed.', ['hips', 'glutes'], ['Yoga Mat']),
      ex('Supine Twist Breathing', 60, 'Alternate sides and let the rib cage soften.', ['back', 'obliques'], ['Yoga Mat']),
    ],
    restBetweenCircuits: 45,
    partingWords:
      'That scratches the cardio itch without needing the bike. Keep the calves honest and this can be a great travel staple.',
  });
}

function lakePrimalDensityMain(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-primal-density-main`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Lake house Wednesday: animal-flow density with different patterns from Saturday and a trunk emphasis that does not need equipment.',
    name: 'Lake House Primal Density',
    description:
      'A denser ground-movement session built around crawling, lateral travel, rotation, and trunk stiffness. It is fresh, athletic, and still compact.',
    difficulty: 'intermediate',
    targetDurationMinutes: 30,
    estimatedCalories: 230,
    calorieRange: { low: 185, high: 285 },
    focusAreas: ['conditioning', 'mobility', 'core', 'coordination'],
    muscleGroupsTargeted: ['shoulders', 'core', 'hips', 'quads', 'glutes', 'obliques'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Boxer Step', 50, 'Find rhythm, breathe through the nose if possible, and keep calves relaxed.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Wrist Rockers to Palm Lifts', 45, 'Rock forward over hands, then lift palms with fingers down.', ['wrists', 'forearms', 'shoulders'], ['Yoga Mat']),
      ex('Loaded Beast Rock', 45, 'Sit hips toward heels, hover knees, and rock forward and back quietly.', ['quads', 'core', 'shoulders'], ['Yoga Mat']),
      ex('Hip Airplane Switch', 45, 'Open and close the hip while standing, using a wall if needed.', ['glutes', 'hip stabilizers', 'core']),
      ex('Thoracic Reach-Through', 45, 'Thread one arm under, then rotate open and switch sides.', ['thoracic spine', 'shoulders'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Locomotion Density',
        rounds: 3,
        restBetweenRounds: 45,
        restBetweenExercises: 10,
        exercises: [
          ex('Bear Crawl Compass', 45, 'Crawl forward, sideways, back, and sideways again with hips quiet.', ['core', 'shoulders', 'quads'], ['Yoga Mat']),
          ex('Lateral Ape Travel', 45, 'Travel side to side from a squat, planting hands softly and landing quietly.', ['hips', 'adductors', 'shoulders'], ['Yoga Mat']),
          ex('Crab Toe Touch', 40, 'Lift opposite hand and foot to touch while keeping hips from collapsing.', ['core', 'glutes', 'shoulders'], ['Yoga Mat']),
          ex('Panther Step Back', 40, 'Hover knees and step one foot back at a time with quiet hips.', ['core', 'quads', 'shoulders'], ['Yoga Mat']),
          ex('Cossack Sweep', 45, 'Shift into a side lunge and sweep hands across the floor as the torso rotates.', ['adductors', 'quads', 'thoracic spine'], ['Yoga Mat']),
        ],
      },
      {
        name: 'Trunk Control',
        rounds: 2,
        restBetweenRounds: 25,
        restBetweenExercises: 8,
        exercises: [
          ex('Plank Wave', 40, 'Move from forearm plank to a gentle pike and back without sagging.', ['core', 'shoulders', 'hamstrings'], ['Yoga Mat']),
          ex('Reverse Plank March', 40, 'Hold a reverse plank and alternate slow marches if hip position stays high.', ['glutes', 'hamstrings', 'shoulders', 'core'], ['Yoga Mat']),
          ex('Hollow-to-Arch Roll', 40, 'Roll from hollow to arch under control, scaling with bent knees as needed.', ['core', 'low back', 'glutes'], ['Yoga Mat']),
        ],
      },
    ],
    coolDown: [
      ex('Pigeon Pose - Right', 50, 'Breathe into the outside hip without forcing the knee angle.', ['glutes', 'hips'], ['Yoga Mat']),
      ex('Pigeon Pose - Left', 50, 'Match the left side and keep the breath slow.', ['glutes', 'hips'], ['Yoga Mat']),
      ex('Forearm Flexor Stretch - Alternating', 60, 'Gently stretch palm and finger lines after the ground work.', ['forearms', 'wrists']),
      ex('Crocodile Breathing', 75, 'Lie face down and breathe into the floor to downshift.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords:
      'That was the good kind of weird: coordinated, sweaty, joint-friendly, and very hard to get from standard sets and reps.',
  });
}

function lakeBodyweightStrengthB(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-07-travel-${date}-bodyweight-strength-b`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes:
      'Lake house Thursday: second bodyweight strength exposure with different angles from Monday and no climbing-specific work.',
    name: 'Lake House Bodyweight Strength B',
    description:
      'A second travel strength day using split squats, pike pressing, posterior chain, scapular work, and anti-extension core. It complements Monday without copying it.',
    difficulty: 'intermediate',
    targetDurationMinutes: 30,
    estimatedCalories: 215,
    calorieRange: { low: 175, high: 270 },
    focusAreas: ['strength', 'body composition', 'upper body', 'lower body', 'core'],
    muscleGroupsTargeted: ['quads', 'glutes', 'hamstrings', 'shoulders', 'chest', 'upper back', 'core'],
    equipmentSetUsed: 'Travel Kit',
    warmUp: [
      ex('Jump Rope Easy Bounce', 50, 'Keep it springy and light. This is just the opener.', ['calves', 'shoulders', 'core'], ['Jump Rope']),
      ex('Squat Pry to Tall Reach', 45, 'Sit into a squat, pry gently, then stand and reach tall.', ['hips', 'quads', 'thoracic spine'], ['Yoga Mat']),
      ex('Mini Band No-Money Drill', 45, 'Elbows by ribs, rotate hands apart, and feel shoulder blades settle.', ['rotator cuff', 'upper back'], ['Mini Bands']),
      ex('Hamstring Sweep Walk', 45, 'Step forward, sweep the hands down the front leg, and alternate sides.', ['hamstrings', 'calves', 'glutes']),
    ],
    circuits: [
      {
        name: 'Split Squat and Press',
        rounds: 3,
        restBetweenRounds: 55,
        restBetweenExercises: 12,
        exercises: [
          ex('Split Squat Pulse - Right', 40, 'Hold the bottom half of the range and pulse smoothly without knee irritation.', ['quads', 'glutes', 'hip flexors'], ['Yoga Mat'], { targetReps: 12 }),
          ex('Split Squat Pulse - Left', 40, 'Match the left side with the same range and tempo.', ['quads', 'glutes', 'hip flexors'], ['Yoga Mat'], { targetReps: 12 }),
          ex('Pike Pushup', 40, 'Press the floor away from a high-hip pike. Elevate hands if needed.', ['shoulders', 'triceps', 'upper chest', 'core'], ['Yoga Mat'], { targetReps: 8 }),
          ex('Prone Lat Sweep', 45, 'Lie face down and sweep arms from overhead toward hips as if pulling water.', ['lats', 'upper back', 'shoulders'], ['Yoga Mat']),
          ex('Body Saw Forearm Plank', 35, 'Shift forward and back in a forearm plank with ribs down.', ['core', 'shoulders'], ['Yoga Mat']),
        ],
      },
      {
        name: 'Posterior Chain Finish',
        rounds: 2,
        restBetweenRounds: 30,
        restBetweenExercises: 10,
        exercises: [
          ex('Single-Leg Hip Bridge - Right', 35, 'Drive through the right heel and pause at the top.', ['glutes', 'hamstrings', 'core'], ['Yoga Mat'], { targetReps: 10 }),
          ex('Single-Leg Hip Bridge - Left', 35, 'Match the left side and keep hips level.', ['glutes', 'hamstrings', 'core'], ['Yoga Mat'], { targetReps: 10 }),
          ex('Superman Pull', 40, 'Lift lightly, pull elbows toward ribs, then reach long again.', ['low back', 'upper back', 'glutes'], ['Yoga Mat']),
          ex('Mini Band Reverse Fly', 40, 'Pull the band apart with soft elbows and shoulder blades sliding back.', ['rear delts', 'upper back'], ['Mini Bands'], { targetReps: 15 }),
        ],
      },
    ],
    coolDown: [
      ex('Low Lunge Quad Opener - Right', 45, 'Open the front of the right hip and thigh with an easy glute squeeze.', ['quads', 'hip flexors'], ['Yoga Mat']),
      ex('Low Lunge Quad Opener - Left', 45, 'Repeat left and avoid forcing range.', ['quads', 'hip flexors'], ['Yoga Mat']),
      ex('Lat Prayer Stretch', 55, 'Sink hips back and breathe into side ribs.', ['lats', 'shoulders'], ['Yoga Mat']),
      ex('Supine Hamstring Strapless Floss', 60, 'Alternate legs slowly and keep the stretch mild.', ['hamstrings', 'calves'], ['Yoga Mat']),
    ],
    partingWords:
      'Nice close to the lake-house work block. You got a real strength signal with zero home-gym dependency.',
  });
}

const TRAVEL_OVERRIDE_START_DATE = '2026-07-16';
const TRAVEL_OVERRIDE_END_DATE = '2026-07-24';

const TRAVEL_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  travelDriveReset('2026-07-16', 'Departure'),
  travelHotelGymMain('2026-07-17'),
  lakeRopePrimalMain('2026-07-18'),
  lakeMobilityFlowMain('2026-07-19'),
  lakeBodyweightStrengthA('2026-07-20'),
  lakeRopeCardio('2026-07-21'),
  lakePrimalDensityMain('2026-07-22'),
  lakeBodyweightStrengthB('2026-07-23'),
  travelDriveReset('2026-07-24', 'Return'),
];

type AugustPhase = 1 | 2 | 3 | 4;

const AUGUST_PHASE_LABELS: Record<AugustPhase, string> = {
  1: 'Kettlebell Base',
  2: 'Kettlebell Build',
  3: 'Travel Return',
  4: 'Clean and Press Intensification',
};

function augustRopeRamp(duration = 45): ExerciseSeed {
  return ex(
    'Jump Rope Easy Bounce or Fast March',
    duration,
    'Use quiet basic bounces only if both arches feel normal. If either arch feels sensitive, fast-march in place and skip boxer steps today.',
    ['calves', 'feet', 'shoulders', 'core'],
    ['Jump Rope']
  );
}

function augustMondayStrength(date: string, phase: AugustPhase): ProgrammedWorkout {
  const rounds = phase === 3 ? 2 : 3;
  const phaseLabel = AUGUST_PHASE_LABELS[phase];
  const swingByPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Two-Hand Kettlebell Swing', 45, 'Use the 50 lb bell for crisp sets of 10-12. Hinge, snap the hips, and finish each set before speed or back position changes.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 12 }),
    2: ex('Dead-Stop Kettlebell Swing', 45, 'Reset the bell on the floor every 5 reps. Rebuild the hike and keep each rep explosive rather than chasing fatigue.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 10 }),
    3: ex('Kettlebell Swing Technique Set', 40, 'Keep this return-week set submaximal: 8-10 clean reps with relaxed grip and no conditioning chase.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 10 }),
    4: ex('Hardstyle Kettlebell Swing', 45, 'Use the 50 lb bell for 12-15 sharp reps. Stop the set if the bell floats lower or the hinge turns into a squat.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 15 }),
  };
  const hingeByAugustPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Kettlebell Romanian Deadlift', 45, 'Hold the 50 lb bell with both hands, lower for two seconds, and pause briefly at the deepest clean hinge.', ['hamstrings', 'glutes', 'back'], ['Kettlebell'], { targetReps: 10 }),
    2: ex('Kickstand Kettlebell Romanian Deadlift', 60, 'Keep most of the load on the left leg, then switch to the right halfway. Use the back toes only as a kickstand.', ['hamstrings', 'glutes', 'core'], ['Kettlebell'], { switchSides: true }),
    3: ex('Tempo Kettlebell Romanian Deadlift', 45, 'Lower for three seconds, pause, then stand smoothly. Keep the load moderate in feel after travel.', ['hamstrings', 'glutes', 'back'], ['Kettlebell'], { targetReps: 8 }),
    4: ex('Supported Single-Leg Kettlebell RDL', 60, 'Use the rings lightly. Hinge on the left leg, switch to the right halfway, and keep the pelvis square.', ['hamstrings', 'glutes', 'core'], ['Kettlebell', 'Gymnastic Rings'], { switchSides: true }),
  };
  const pullByAugustPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Neutral-Grip Pull-ups', 40, 'Use the most shoulder-friendly grip available and stop with one or two clean reps in reserve.', ['lats', 'back', 'biceps'], ['Pull-up Bar'], { targetReps: 7 }),
    2: ex('Typewriter Pull-up Practice', 40, 'Pull high, shift only as far as the shoulders stay packed, and alternate the lead side.', ['lats', 'back', 'biceps'], ['Pull-up Bar'], { targetReps: 5 }),
    3: ex('Feet-Elevated Ring Rows', 45, 'Keep a rigid plank, pull thumbs to ribs, and pause without shrugging.', ['back', 'rear delts', 'biceps'], ['Gymnastic Rings'], { targetReps: 10 }),
    4: ex('Chest-to-Bar Pull-ups', 40, 'Pull explosively while staying strict. End the set before height drops.', ['lats', 'back', 'biceps'], ['Pull-up Bar'], { targetReps: 6 }),
  };
  const chestByAugustPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Ring Pushups with Turnout', 40, 'Lower under control, press cleanly, and turn the rings out only after reaching the top.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings'], { targetReps: 10 }),
    2: ex('Weighted Vest Pushups', 40, 'Use the vest only while every rep stays fast and the ribs remain stacked.', ['chest', 'triceps', 'core'], ['Weight Vest', 'Yoga Mat'], { targetReps: 10 }),
    3: ex('Tempo Pushups', 40, 'Lower for three seconds, pause lightly, and press without shoulder discomfort.', ['chest', 'triceps', 'shoulders'], ['Yoga Mat'], { targetReps: 8 }),
    4: ex('Ring Dips', 40, 'Use a shoulder-friendly depth and keep the rings quiet. Leave one clean rep in reserve.', ['chest', 'triceps', 'shoulders'], ['Gymnastic Rings'], { targetReps: 7 }),
  };
  const ballCoreByPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Fitness Ball Stir-the-Pot', 45, 'Set forearms on the ball and draw small circles without letting the ribs flare or low back sag.', ['core', 'shoulders'], ['Fitness Ball', 'Yoga Mat']),
    2: ex('Fitness Ball Pike', 40, 'Start in a plank with shins on the ball, lift the hips under control, and stop before shoulder position changes.', ['core', 'shoulders', 'hip flexors'], ['Fitness Ball', 'Yoga Mat'], { targetReps: 8 }),
    3: ex('Dead Bug Ball Squeeze', 45, 'Press the ball between hands and knees while alternating one arm and leg. Keep the low back quiet.', ['core', 'hip flexors'], ['Fitness Ball', 'Yoga Mat']),
    4: ex('Fitness Ball Body Saw', 45, 'Use forearms on the ball and glide a few inches forward and back while holding a strong plank.', ['core', 'shoulders'], ['Fitness Ball', 'Yoga Mat']),
  };

  return programmedWorkout({
    id: `program-2026-08-${phase}-monday-kb-hinge-pull-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${phaseLabel}: the 50 lb kettlebell is the primary hinge load. Keep the whole session around RPE ${phase === 3 ? '6-7' : '7-8'} and stop swings before technique fades.`,
    name: `${phaseLabel}: Hinge, Pull, and Trunk`,
    description: 'A compact posterior-chain session that combines loaded kettlebell hinging, pulling, chest work, medium-edge finger strength, carries, and fitness-ball trunk control.',
    difficulty: phase === 3 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 3 ? 205 : 245,
    calorieRange: phase === 3 ? { low: 170, high: 250 } : { low: 205, high: 300 },
    focusAreas: ['strength', 'posterior chain', 'upper body', 'core', 'grip'],
    muscleGroupsTargeted: ['hamstrings', 'glutes', 'back', 'lats', 'chest', 'forearms', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Kettlebell Deadlift Groove', 45, 'Do slow deadlifts from the floor and make the start position repeatable before any swings.', ['hamstrings', 'glutes', 'back'], ['Kettlebell'], { targetReps: 8 }),
      ex('Wrist Tendon Glides', 40, 'Move through open hand, hook fist, full fist, and straight fist positions without strain.', ['wrists', 'forearms']),
      ex('Scapular Pull-ups', 40, 'Move only through the shoulder blades and keep the neck long.', ['lats', 'lower traps', 'shoulders'], ['Pull-up Bar']),
      ex('Dead Bug Lat Press', 45, 'Press the hands down while alternating slow leg reaches and keeping ribs heavy.', ['core', 'lats'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Kettlebell Strength Circuit',
        rounds,
        restBetweenRounds: phase === 3 ? 75 : 60,
        restBetweenExercises: 12,
        exercises: [swingByPhase[phase], pullByAugustPhase[phase], chestByAugustPhase[phase], hingeByAugustPhase[phase], ballCoreByPhase[phase]],
      },
      {
        name: 'Grip, Carry, and Hamstrings',
        rounds: 2,
        restBetweenRounds: 45,
        restBetweenExercises: 12,
        exercises: [
          ex('Hangboard Medium-Edge 7:3 Repeaters', 70, 'Use the familiar medium edge for controlled 7-second hangs and 3-second rests. Stop immediately for finger or elbow warning signs.', ['forearms', 'lats', 'shoulders'], ['Hangboard']),
          ex('Kettlebell Suitcase March', 60, 'Hold the bell on the left and march without leaning. Switch to the right side halfway.', ['obliques', 'grip', 'hips'], ['Kettlebell'], { switchSides: true }),
          ex('Fitness Ball Hamstring Curl', 45, 'Bridge the hips, curl the ball toward you, and keep the pelvis level.', ['hamstrings', 'glutes', 'core'], ['Fitness Ball', 'Yoga Mat'], { targetReps: 10 }),
          ex('Side Plank Reach', 60, 'Hold the left side plank and reach the top arm under the ribs. Switch to the right halfway.', ['obliques', 'shoulders', 'glutes'], ['Yoga Mat'], { switchSides: true }),
        ],
      },
    ],
    coolDown: [
      ex('Forearm Extensor Stretch - Alternating', 60, 'Use light pressure on the left forearm, then switch to the right halfway.', ['forearms', 'wrists'], undefined, { switchSides: true }),
      ex('Hamstring Doorway Stretch - Alternating', 70, 'Stretch the left hamstring with a soft knee, then switch to the right halfway and keep the range mild.', ['hamstrings', 'calves'], ['Yoga Mat'], { switchSides: true }),
      ex('Lat Prayer Stretch', 50, 'Sink the hips back and breathe into the side ribs.', ['lats', 'shoulders'], ['Yoga Mat']),
    ],
    partingWords: 'That is the hinge load July was missing: strong reps, real posterior-chain tension, and enough restraint to repeat it next week.',
  });
}

function augustTuesdayStrength(date: string, phase: AugustPhase): ProgrammedWorkout {
  const rounds = phase === 3 ? 2 : 3;
  const phaseLabel = AUGUST_PHASE_LABELS[phase];
  const lowerByPhase: Record<AugustPhase, ExerciseSeed> = {
    1: ex('Kettlebell Goblet Squat', 45, 'Hold the 50 lb bell close, sit between the knees, and stand without losing the brace.', ['quads', 'glutes', 'core'], ['Kettlebell'], { targetReps: 10 }),
    2: ex('Goblet Reverse Lunge Alternating', 50, 'Hold the bell at the chest and alternate reverse lunges. Use bodyweight if the rack or knees become the limiter.', ['quads', 'glutes', 'hamstrings', 'core'], ['Kettlebell'], { targetReps: 8 }),
    3: ex('Dumbbell Cyclist Squat', 45, 'Use a moderate dumbbell load and a controlled quad-focused range during the return week.', ['quads', 'glutes', 'core'], ['Dumbbells', 'Yoga Mat'], { targetReps: 10 }),
    4: ex('Tempo Kettlebell Goblet Squat', 50, 'Lower for three seconds, pause, and stand hard while keeping the 50 lb bell close.', ['quads', 'glutes', 'core'], ['Kettlebell'], { targetReps: 8 }),
  };
  const pressSkillByPhase: Record<AugustPhase, ExerciseSeed[]> = {
    1: [
      ex('Kettlebell Clean to Rack - Right', 35, 'Practice one or two clean singles with the 50 lb bell. Keep it close and finish in a quiet rack; do not press yet.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Kettlebell Clean to Rack - Left', 35, 'Match the right side with a vertical forearm and no impact on the wrist.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Half-Kneeling Dumbbell Press', 70, 'Press the dumbbell on the left for half the interval, then switch right. Build strict pressing strength without forcing the 50 lb bell overhead.', ['shoulders', 'triceps', 'core'], ['Dumbbells', 'Yoga Mat'], { switchSides: true }),
    ],
    2: [
      ex('Kettlebell Clean to Rack - Right', 35, 'Practice two crisp clean singles and hold the final rack for five seconds.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Kettlebell Clean to Rack - Left', 35, 'Match the right side and keep the wrist neutral.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Kettlebell Push Press Skill', 70, 'Start on the left and switch right halfway. If the rack is stable, try one 50 lb push press single; otherwise use a 22.5 lb dumbbell strict press.', ['shoulders', 'triceps', 'legs', 'core'], ['Kettlebell', 'Dumbbells'], { switchSides: true, targetReps: 2 }),
    ],
    3: [
      ex('Kettlebell Clean Technique - Right', 35, 'Use easy singles and stop if travel stiffness changes the catch.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Kettlebell Clean Technique - Left', 35, 'Match the right side without chasing speed.', ['glutes', 'back', 'biceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Half-Kneeling Dumbbell Press', 70, 'Press left, switch halfway, then press right with a quiet rib cage.', ['shoulders', 'triceps', 'core'], ['Dumbbells', 'Yoga Mat'], { switchSides: true }),
    ],
    4: [
      ex('Kettlebell Clean and Push Press - Right', 40, 'Use one crisp clean and one push press single with the 50 lb bell only if the rack is secure. Lower slowly and stop before grinding.', ['glutes', 'shoulders', 'triceps', 'core'], ['Kettlebell'], { targetReps: 2 }),
      ex('Kettlebell Clean and Push Press - Left', 40, 'Match the right side. Use a dumbbell press if the clean or overhead path is not controlled.', ['glutes', 'shoulders', 'triceps', 'core'], ['Kettlebell', 'Dumbbells'], { targetReps: 2 }),
      ex('Strict Handstand Pushup Practice', 40, 'Accumulate two or three perfect strict reps or controlled eccentrics, stopping well before form breaks.', ['shoulders', 'triceps', 'core'], ['Yoga Mat'], { targetReps: 3 }),
    ],
  };

  return programmedWorkout({
    id: `program-2026-08-${phase}-tuesday-squat-press-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${phaseLabel}: build the 50 lb clean and press from clean quality, rack control, and strict supporting volume. No missed or ugly overhead reps.`,
    name: `${phaseLabel}: Squat and Press Skill`,
    description: 'A complementary squat and shoulder session that builds toward a 50 lb clean and press without turning every week into a max test.',
    difficulty: phase === 3 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 3 ? 195 : 225,
    calorieRange: phase === 3 ? { low: 160, high: 235 } : { low: 185, high: 270 },
    focusAreas: ['strength', 'lower body', 'shoulders', 'clean technique', 'core'],
    muscleGroupsTargeted: ['quads', 'glutes', 'shoulders', 'triceps', 'upper back', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Ankle Rockers', 45, 'Drive the knee over the toes without lifting the heel and alternate smoothly.', ['ankles', 'calves', 'quads'], ['Yoga Mat']),
      ex('90/90 Hip Switches', 50, 'Rotate through both hips with a tall torso and no forced range.', ['hips', 'glutes', 'adductors'], ['Yoga Mat']),
      ex('Kettlebell Clean Path Drill', 45, 'Use two hands or no load to rehearse a close zipper path and quiet rack position before working singles.', ['hips', 'upper back', 'shoulders', 'core'], ['Kettlebell']),
      ex('Band Wall Slides', 45, 'Keep ribs down while the shoulder blades rotate upward against light band tension.', ['shoulders', 'serratus', 'upper back'], ['Resistance Bands']),
    ],
    circuits: [
      {
        name: 'Squat and Press Progression',
        rounds,
        restBetweenRounds: phase === 3 ? 75 : 65,
        restBetweenExercises: 15,
        exercises: [lowerByPhase[phase], ...pressSkillByPhase[phase], ex('Ring Face Pulls', 40, 'Pull toward eye level, pause, and keep the shoulders away from the ears.', ['upper back', 'rear delts', 'rotator cuff'], ['Gymnastic Rings'], { targetReps: 12 })],
      },
      {
        name: 'Hip Control and Ball Core',
        rounds: 2,
        restBetweenRounds: 40,
        restBetweenExercises: 12,
        exercises: [
          ex('Supported Hip Airplane - Right', 45, 'Use the rings lightly and take the full interval to open and close the right hip for two or three controlled reps.', ['glutes', 'hip stabilizers', 'core'], ['Gymnastic Rings']),
          ex('Supported Hip Airplane - Left', 45, 'Match the right side with the same slow range and pelvis control.', ['glutes', 'hip stabilizers', 'core'], ['Gymnastic Rings']),
          ex('Fitness Ball Crunch with Reach', 45, 'Let the upper back extend over the ball, then curl the ribs toward the pelvis without pulling the neck.', ['core'], ['Fitness Ball'], { targetReps: 12 }),
          ex('Band Pull-Aparts', 40, 'Keep the arms long and finish with the shoulder blades, not the neck.', ['upper back', 'rear delts'], ['Resistance Bands'], { targetReps: 15 }),
        ],
      },
    ],
    coolDown: [
      ex('Couch Stretch', 90, 'Open the left hip and quad, then switch to the right halfway.', ['hip flexors', 'quads'], ['Yoga Mat'], { switchSides: true }),
      ex('Yoga Wheel Pec Opener', 50, 'Let the chest open over the wheel without forcing the shoulders.', ['chest', 'shoulders', 'thoracic spine'], ['Yoga wheel']),
      ex('Wrist Flexor Stretch - Alternating', 50, 'Stretch the left wrist gently, then switch to the right halfway after cleans and pressing.', ['forearms', 'wrists'], undefined, { switchSides: true }),
    ],
    partingWords: 'The goal is one strong 50 lb rep per side, and this is how it gets earned: clean catches, stable racks, and zero wasted grinders.',
  });
}

function augustClimbingWarmup(date: string, long = false): ProgrammedWorkout {
  const exercises = [
    augustRopeRamp(40),
    ex('Finger Waves and Wrist CARs', 45, 'Open and close the hands, then circle the wrists slowly in both directions.', ['forearms', 'wrists']),
    ex('Band Face Pull with External Rotation', 50, 'Pull to eye level and rotate without shrugging.', ['upper back', 'rear delts', 'rotator cuff'], ['Resistance Bands']),
    ex('Hangboard Large-Edge Active Hang', 50, 'Use a large edge and lightly set the shoulders. This is preparation, not a finger-strength set.', ['forearms', 'lats', 'shoulders'], ['Hangboard']),
    ex('Standing Hip CARs', 70, 'Take the full first half on the left hip, then switch to the right and use a wall for balance.', ['hips', 'glutes', 'adductors'], ['Yoga Mat'], { switchSides: true }),
    ex('Cross-Body Dead Bug', 50, 'Extend opposite arm and leg while the ribs stay heavy.', ['core', 'obliques', 'hip flexors'], ['Yoga Mat']),
    ex('Quiet Feet Squat-to-Reach', 45, 'Move fluidly from a relaxed squat to a tall reach without fatigue.', ['quads', 'glutes', 'thoracic spine'], ['Yoga Mat']),
  ];
  if (long) {
    exercises.push(ex('Easy Ring Row Acceleration', 45, 'Do a few smooth rows with faster intent up and full control down.', ['lats', 'back', 'biceps'], ['Gymnastic Rings']));
  }

  return programmedWorkout({
    id: `program-2026-08-climbing-${long ? 'long' : 'weekday'}-${date}`,
    date,
    slot: 'Warm-up',
    priority: 1,
    coachNotes: 'Climbing preparation only. Keep every hang comfortable and arrive at the wall fresher than you started.',
    name: long ? 'August Long Climbing Warm-up' : 'August Climbing Warm-up',
    description: 'A low-fatigue climbing primer for fingers, shoulders, hips, and trunk.',
    difficulty: 'intermediate',
    targetDurationMinutes: long ? 8 : 7,
    estimatedCalories: 55,
    calorieRange: { low: 35, high: 75 },
    focusAreas: ['climbing', 'mobility', 'warm-up'],
    muscleGroupsTargeted: ['forearms', 'shoulders', 'upper back', 'hips', 'core'],
    warmUp: exercises,
    partingWords: 'Warm fingers, awake shoulders, mobile hips. Save the hard work for the wall.',
  });
}

function augustAntagonistSnack(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-antagonist-snack-${date}`,
    date,
    slot: 'Snack',
    priority: 2,
    coachNotes: 'Optional after climbing or later in the day. Skip it if shoulders or elbows are already taxed.',
    name: 'August Antagonist and Posture Snack',
    description: 'A brief chest, external-rotation, and posterior-support counterweight to climbing.',
    difficulty: 'intermediate',
    targetDurationMinutes: 8,
    estimatedCalories: 55,
    calorieRange: { low: 35, high: 75 },
    focusAreas: ['antagonist strength', 'shoulder health', 'posture'],
    muscleGroupsTargeted: ['chest', 'rotator cuff', 'rear delts', 'triceps', 'core'],
    circuits: [{
      name: 'Antagonist Mini-Circuit',
      rounds: 2,
      restBetweenRounds: 25,
      restBetweenExercises: 8,
      exercises: [
        ex('Ring Pushup Easy Tempo', 35, 'Use a comfortable angle and smooth reps with no shoulder strain.', ['chest', 'triceps', 'core'], ['Gymnastic Rings'], { targetReps: 8 }),
        ex('Band External Rotation', 60, 'Rotate the left arm for half the interval, then switch right.', ['rotator cuff', 'rear delts'], ['Resistance Bands'], { switchSides: true }),
        ex('Reverse Plank', 40, 'Lift the chest and hips while keeping the neck relaxed.', ['posterior chain', 'shoulders', 'triceps'], ['Yoga Mat']),
        ex('Yoga Wheel Chest Opener', 45, 'Breathe over the wheel and let the chest relax.', ['chest', 'thoracic spine'], ['Yoga wheel']),
      ],
    }],
    partingWords: 'Small dose, useful balance. That is enough.',
  });
}

function augustZone2(date: string, phase: AugustPhase): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-${phase}-zone-2-${date}`,
    date,
    slot: 'Cardio',
    priority: 1,
    coachNotes: 'Road bike is the default while the arches settle. Hit Record Ride and let GPS log it. A run-walk substitution is fine only when both feet feel completely normal.',
    name: `${AUGUST_PHASE_LABELS[phase]}: Zone 2 Aerobic Base`,
    activityType: 'ride',
    description: 'A repeatable conversational aerobic session for cardiovascular fitness, recovery, and longevity.',
    difficulty: 'intermediate',
    targetDurationMinutes: 45,
    estimatedCalories: 360,
    calorieRange: { low: 285, high: 455 },
    focusAreas: ['cardio', 'Zone 2', 'aerobic base', 'recovery'],
    muscleGroupsTargeted: ['cardiovascular system', 'quads', 'glutes', 'calves'],
    warmUp: [
      ex('Easy Bike Ramp', 180, 'Start very easy and gradually find a smooth cadence.', ['cardiovascular system', 'quads', 'glutes'], ['Road Bike']),
    ],
    circuits: [{
      name: 'Conversational Zone 2',
      rounds: 1,
      restBetweenRounds: 0,
      restBetweenExercises: 0,
      exercises: [ex('Steady Road Bike Zone 2', 2040, 'Ride at a pace where full-sentence conversation remains possible. Keep the first ten minutes almost too easy.', ['cardiovascular system', 'quads', 'glutes', 'calves'], ['Road Bike'])],
    }],
    coolDown: [
      ex('Easy Spin Downshift', 240, 'Back off and let breathing settle gradually.', ['cardiovascular system'], ['Road Bike']),
      ex('Half-Kneeling Hip Flexor Stretch', 90, 'Open the left hip, then switch to the right halfway.', ['hip flexors', 'quads'], ['Yoga Mat'], { switchSides: true }),
      ex('Thoracic Open Book', 90, 'Rotate on the left side, then switch to the right halfway.', ['thoracic spine', 'chest'], ['Yoga Mat'], { switchSides: true }),
    ],
    partingWords: 'Boring in the best way: a clean aerobic deposit with almost no recovery bill.',
  });
}

function augustFridayStrength(date: string, phase: AugustPhase): ProgrammedWorkout {
  const rounds = phase === 3 ? 2 : 3;
  const swingName = phase === 4 ? 'Kettlebell Swing Power Set' : phase === 3 ? 'Dead-Stop Kettlebell Swing' : 'Kettlebell Swing Density Set';
  return programmedWorkout({
    id: `program-2026-08-${phase}-friday-density-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: `${AUGUST_PHASE_LABELS[phase]}: Friday uses different angles from Tuesday and finishes with ball core and loaded carries. Keep RPE ${phase === 3 ? '6-7' : '7-8'}.`,
    name: `${AUGUST_PHASE_LABELS[phase]}: Kettlebell Density and Ball Core`,
    description: 'A whole-body density session with kettlebell power, unilateral legs, horizontal pulling and pushing, crawling, anti-rotation, and fitness-ball core work.',
    difficulty: phase === 3 ? 'intermediate' : 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: phase === 3 ? 210 : 255,
    calorieRange: phase === 3 ? { low: 170, high: 255 } : { low: 215, high: 315 },
    focusAreas: ['strength', 'power', 'conditioning', 'core', 'body composition'],
    muscleGroupsTargeted: ['glutes', 'hamstrings', 'quads', 'back', 'chest', 'shoulders', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Cat-Cow to Thread the Needle', 60, 'Move through cat-cow, rotate left, then switch to the right halfway.', ['thoracic spine', 'shoulders', 'back'], ['Yoga Mat'], { switchSides: true }),
      ex('Kettlebell Hike-Pass Rehearsal', 45, 'Practice the hike without standing up, then park the bell cleanly.', ['hamstrings', 'glutes', 'back'], ['Kettlebell']),
      ex('Ring Support Scap Shrugs', 40, 'Use foot assistance if needed and move only through the shoulder blades.', ['shoulders', 'chest', 'upper back'], ['Gymnastic Rings']),
      ex('Bear Crawl Patterning', 45, 'Crawl slowly with quiet hips and active hands.', ['core', 'shoulders', 'quads'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Power and Strength Density',
        rounds,
        restBetweenRounds: phase === 3 ? 70 : 55,
        restBetweenExercises: 10,
        exercises: [
          ex(swingName, 45, 'Use 10-15 crisp two-hand reps with the 50 lb bell. Park it before power fades.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: phase === 4 ? 15 : 12 }),
          ex('Ring Archer Row', 45, 'Pull toward one ring, alternate emphasis each rep, and keep the pelvis square.', ['back', 'lats', 'biceps', 'core'], ['Gymnastic Rings'], { targetReps: 10 }),
          ex('Weighted Vest Pushup', 40, 'Use the vest only if the plank and shoulder position remain clean.', ['chest', 'triceps', 'core'], ['Weight Vest', 'Yoga Mat'], { targetReps: 10 }),
          ex('Kettlebell Front-Rack Reverse Lunge', 60, 'Rack the bell on the left and lunge for half the interval, then switch to the right. Use goblet hold or bodyweight if needed.', ['quads', 'glutes', 'core'], ['Kettlebell'], { switchSides: true }),
          ex('Fitness Ball Pike or Knee Tuck', 45, 'Use pikes while control is excellent; switch to knee tucks before the shoulders or low back compensate.', ['core', 'shoulders', 'hip flexors'], ['Fitness Ball', 'Yoga Mat']),
        ],
      },
      {
        name: 'Carry and Anti-Rotation Finish',
        rounds: 2,
        restBetweenRounds: 35,
        restBetweenExercises: 10,
        exercises: [
          ex('Band Pallof Press', 60, 'Press away on the left side and resist rotation, then switch right halfway.', ['core', 'obliques', 'shoulders'], ['Resistance Bands'], { switchSides: true }),
          ex('Fitness Ball Hamstring Curl', 45, 'Bridge the hips and curl smoothly without cramping.', ['hamstrings', 'glutes', 'core'], ['Fitness Ball', 'Yoga Mat'], { targetReps: 10 }),
          ex('Bear Crawl Shoulder Tap', 40, 'Hover the knees and alternate shoulder taps with minimal hip shift.', ['core', 'shoulders', 'quads'], ['Yoga Mat']),
          ex('Kettlebell Suitcase March', 60, 'March with the bell on the left, then switch right halfway without leaning.', ['obliques', 'grip', 'hips'], ['Kettlebell'], { switchSides: true }),
        ],
      },
    ],
    coolDown: [
      ex('Pigeon Pose', 90, 'Open the left hip, then switch to the right halfway.', ['glutes', 'hips'], ['Yoga Mat'], { switchSides: true }),
      ex('Supine Twist', 80, 'Rotate left, then switch right halfway and slow the breath.', ['back', 'obliques'], ['Yoga Mat'], { switchSides: true }),
      ex('Crocodile Breathing', 60, 'Breathe into the floor and let the trunk relax.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords: 'Power, muscle, trunk, and conditioning all got a clean signal. Leave a little in the tank for the weekend.',
  });
}

function augustSaturdayMobility(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-saturday-mobility-${date}`,
    date,
    slot: 'Mobility',
    priority: 1,
    coachNotes: 'Optional low-cost movement. Use it when sitting, climbing, or Friday strength left the body feeling compressed.',
    name: 'Fitness Ball Mobility and Trunk Reset',
    description: 'A short recovery session for hips, thoracic spine, hamstrings, and easy trunk control.',
    difficulty: 'beginner',
    targetDurationMinutes: 10,
    estimatedCalories: 45,
    calorieRange: { low: 30, high: 65 },
    focusAreas: ['mobility', 'recovery', 'core'],
    muscleGroupsTargeted: ['hips', 'thoracic spine', 'hamstrings', 'core'],
    circuits: [{
      name: 'Ball Reset Flow',
      rounds: 2,
      restBetweenRounds: 15,
      restBetweenExercises: 5,
      exercises: [
        ex('Fitness Ball Thoracic Extension', 50, 'Support the upper back on the ball and breathe into a gentle extension.', ['thoracic spine', 'chest'], ['Fitness Ball']),
        ex('90/90 Hip Switches', 50, 'Move slowly through both hips and use the hands as needed.', ['hips', 'glutes', 'adductors'], ['Yoga Mat']),
        ex('Fitness Ball Dead Bug Press', 45, 'Press hands and knees into the ball while extending one limb at a time.', ['core', 'hip flexors'], ['Fitness Ball', 'Yoga Mat']),
        ex('Adductor Rockback', 60, 'Rock on the left side, then switch right halfway.', ['adductors', 'hips'], ['Yoga Mat'], { switchSides: true }),
      ],
    }],
    partingWords: 'Ten minutes of space and control is plenty for a recovery day.',
  });
}

function augustDriveReset(date: string, direction: 'Departure' | 'Return'): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-travel-${direction.toLowerCase()}-${date}`,
    date,
    slot: 'Mobility',
    priority: 1,
    coachNotes: `${direction} travel day. This is specifically for the five-hour car ride; no strength or conditioning obligation.`,
    name: `${direction} Drive Mobility Reset`,
    description: 'A no-equipment hips, spine, and shoulders reset for a long car day.',
    difficulty: 'beginner',
    targetDurationMinutes: 12,
    estimatedCalories: 45,
    calorieRange: { low: 30, high: 65 },
    focusAreas: ['mobility', 'travel recovery', 'circulation'],
    muscleGroupsTargeted: ['hips', 'thoracic spine', 'hamstrings', 'shoulders'],
    circuits: [{
      name: 'Post-Drive Unfold',
      rounds: 2,
      restBetweenRounds: 10,
      restBetweenExercises: 5,
      exercises: [
        ex('Standing Hip Flexor Reach', 60, 'Step the left leg back and reach tall, then switch right halfway.', ['hip flexors', 'quads', 'side body'], undefined, { switchSides: true }),
        ex('Bodyweight Good Morning', 45, 'Hinge slowly with soft knees and stand tall.', ['hamstrings', 'glutes', 'back'], undefined, { targetReps: 12 }),
        ex('World Greatest Stretch', 70, 'Take the left side first, rotate gently, then switch right halfway.', ['hips', 'hamstrings', 'thoracic spine'], undefined, { switchSides: true }),
        ex('Wall or Standing Shoulder Slides', 45, 'Slide the arms overhead while keeping the ribs quiet.', ['shoulders', 'upper back']),
        ex('Deep Squat Breathing', 50, 'Use support if needed and take slow breaths into the back ribs.', ['hips', 'quads', 'ankles', 'diaphragm']),
      ],
    }],
    partingWords: 'The assignment was to undo the car, not prove anything. Done.',
  });
}

function augustCottageDensity(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-cottage-density-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'No-equipment cottage session with deliberately brief rests. Keep it at RPE 6-7 and stop short of soreness that would make Monday travel worse.',
    name: 'Cottage No-Equipment Density',
    description: 'A short, dense bodyweight session for legs, pressing, posterior chain, upper back, and trunk with no equipment assumptions.',
    difficulty: 'intermediate',
    targetDurationMinutes: 24,
    estimatedCalories: 180,
    calorieRange: { low: 145, high: 225 },
    focusAreas: ['strength', 'conditioning', 'travel', 'core'],
    muscleGroupsTargeted: ['quads', 'glutes', 'hamstrings', 'chest', 'shoulders', 'upper back', 'core'],
    warmUp: [
      ex('Fast March with Arm Swing', 60, 'Raise temperature without jumping and keep the feet comfortable.', ['hips', 'calves', 'shoulders', 'core']),
      ex('Squat Pry to Reach', 50, 'Sit into a comfortable squat, pry gently, then stand and reach tall.', ['hips', 'quads', 'thoracic spine']),
      ex('Inchworm to Cobra', 50, 'Walk to plank, open the chest gently, and walk back.', ['hamstrings', 'core', 'chest', 'shoulders']),
    ],
    circuits: [{
      name: 'Cottage Density Block',
      rounds: 4,
      restBetweenRounds: 30,
      restBetweenExercises: 8,
      exercises: [
        ex('Reverse Lunge Alternating', 45, 'Alternate smooth reverse lunges and keep the front foot planted.', ['quads', 'glutes', 'hamstrings'], undefined, { targetReps: 12 }),
        ex('Pike Pushup', 40, 'Press from a high-hip position and stop before the head or shoulders lose control.', ['shoulders', 'triceps', 'upper chest', 'core'], undefined, { targetReps: 8 }),
        ex('Single-Leg Hip Bridge Alternating', 50, 'Use the left leg first, then switch right halfway.', ['glutes', 'hamstrings', 'core'], undefined, { switchSides: true }),
        ex('Prone Lat Sweep', 40, 'Sweep the arms from overhead toward the hips while keeping the neck long.', ['lats', 'upper back', 'rear delts']),
        ex('Body Saw Forearm Plank', 40, 'Shift a few inches forward and back without losing rib position.', ['core', 'shoulders']),
      ],
    }],
    coolDown: [
      ex('Low Lunge Quad Opener', 70, 'Open the left hip and quad, then switch right halfway.', ['hip flexors', 'quads'], undefined, { switchSides: true }),
      ex('Child Pose Side Reach', 70, 'Reach left, then right, and breathe into the lats.', ['lats', 'shoulders', 'back'], undefined, { switchSides: true }),
    ],
    partingWords: 'Short rests made that a real session. Now go enjoy the cottage.',
  });
}

function augustCottageFullBodyB(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-cottage-full-body-b-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'Second no-equipment cottage strength session. Keep it at RPE 6-7, use the mini band only if you brought it, and leave enough in reserve for the return-drive reset tomorrow.',
    name: 'Cottage Full-Body Calisthenics B',
    description: 'A complementary no-equipment full-body session: squat pattern, horizontal push, hamstrings, upper-back work, and lateral trunk strength without climbing-specific prep.',
    difficulty: 'intermediate',
    targetDurationMinutes: 24,
    estimatedCalories: 175,
    calorieRange: { low: 140, high: 220 },
    focusAreas: ['strength', 'conditioning', 'travel', 'core'],
    muscleGroupsTargeted: ['quads', 'glutes', 'hamstrings', 'chest', 'triceps', 'upper back', 'core'],
    warmUp: [
      ex('Fast March with Arm Swing', 60, 'Raise temperature without jumping and keep the feet comfortable.', ['hips', 'calves', 'shoulders', 'core']),
      ex('Lateral Squat Shift', 50, 'Shift gently left and right, keeping one heel down and using a comfortable range.', ['adductors', 'glutes', 'quads']),
      ex('Scapular Pushup', 45, 'Keep elbows straight and glide the shoulder blades without shrugging.', ['serratus', 'shoulders', 'upper back']),
    ],
    circuits: [
      {
        name: 'Cottage Full-Body Block',
        rounds: 3,
        restBetweenRounds: 35,
        restBetweenExercises: 8,
        exercises: [
          ex('Tempo Bodyweight Squat', 45, 'Lower for three seconds, pause briefly, then stand tall with a quiet torso.', ['quads', 'glutes', 'core'], undefined, { targetReps: 10 }),
          ex('Pushup', 40, 'Use floor, knees, or a sturdy counter height that keeps every rep smooth and pain-free.', ['chest', 'triceps', 'shoulders', 'core'], undefined, { targetReps: 8 }),
          ex('Hamstring Walkout', 45, 'Bridge the hips, walk the heels out slowly, then walk them back in with control.', ['hamstrings', 'glutes', 'core']),
          ex('Prone W-to-Reach', 45, 'Lift lightly into a W, pull elbows toward ribs, then reach long without cranking the neck.', ['upper back', 'rear delts', 'lats']),
          ex('Side Plank Knee Drive - Alternating', 50, 'Start on the left side, then switch right halfway. Keep the hips lifted as the top knee drives forward.', ['obliques', 'glutes', 'shoulders', 'core'], undefined, { switchSides: true }),
        ],
      },
      {
        name: 'Optional Mini-Band Finish',
        rounds: 2,
        restBetweenRounds: 20,
        restBetweenExercises: 8,
        exercises: [
          ex('Mini Band Pull-Apart or Prone T Raise', 45, 'If you brought the mini band, pull it apart at chest height; otherwise lift the arms into a prone T with thumbs up.', ['upper back', 'rear delts', 'rotator cuff']),
          ex('Bear Hover Shoulder Tap', 45, 'Hover the knees just off the floor and tap opposite shoulder slowly; raise the knees or use a high plank if needed.', ['core', 'shoulders', 'quads']),
        ],
      },
    ],
    coolDown: [
      ex('Figure-4 Hip Stretch - Alternating', 70, 'Cross the left ankle first, then switch right halfway and keep the stretch easy.', ['glutes', 'hips'], undefined, { switchSides: true }),
      ex('Thread the Needle - Alternating', 70, 'Reach the left arm under first, then switch to the right and breathe into the upper back.', ['upper back', 'shoulders', 'thoracic spine'], undefined, { switchSides: true }),
      ex('Box Breathing', 75, 'Use even inhales, holds, exhales, and holds to downshift.', ['diaphragm', 'nervous system']),
    ],
    partingWords: 'Two cottage strength days, two different jobs, no equipment dependency. Save the optional rope for play, not obligation.',
  });
}

function augustSaturdayJumpRopeVo2(date: string, workIntervalSeconds: 120 | 180): ProgrammedWorkout {
  const intervalMinutes = workIntervalSeconds / 60;
  const isIntroductory = workIntervalSeconds === 120;

  return programmedWorkout({
    id: `program-2026-08-saturday-jump-rope-vo2-${intervalMinutes}min-${date}`,
    date,
    slot: 'Cardio',
    priority: 1,
    coachNotes: `Saturday high-aerobic anchor: 4 x ${intervalMinutes}-minute controlled jump-rope intervals at about RPE 8 with 3 minutes of active recovery. If Saturday is missed, Wednesday after climbing is the fallback; complete it once, not on both days.`,
    name: `${isIntroductory ? 'Introductory' : 'Build'} Jump-Rope VO₂ Intervals: 4 × ${intervalMinutes} Minutes`,
    description: `A controlled high-aerobic jump-rope session with four ${intervalMinutes}-minute work intervals and walking or marching recovery. This is not an all-out effort: heart rate may take 1-2 minutes to rise, and cadence should remain stable through the final interval. Use basic low-bounce or alternating-foot skipping, not boxer step. If foot, calf, Achilles, or knee discomfort appears, or rope coordination becomes the limiting factor, switch to fast low-impact step-ups or running/marching in place. Stop for sharp or escalating pain.`,
    difficulty: 'intermediate',
    targetDurationMinutes: isIntroductory ? 30 : 34,
    estimatedCalories: isIntroductory ? 260 : 310,
    calorieRange: isIntroductory ? { low: 210, high: 320 } : { low: 250, high: 380 },
    focusAreas: ['cardio', 'VO2 max', 'high-aerobic conditioning', 'coordination'],
    muscleGroupsTargeted: ['cardiovascular system', 'calves', 'quads', 'glutes', 'core'],
    warmUp: [
      ex('Brisk Marching Ramp', 120, 'Start easy and build to a brisk march with relaxed arm swing and progressively deeper breathing.', ['cardiovascular system', 'hips', 'calves']),
      ex('Ankle Rockers and Calf Raises', 120, 'Alternate controlled ankle rockers with easy calf raises. Keep the feet relaxed and use a pain-free range.', ['ankles', 'calves', 'feet']),
      ex('Easy Low-Bounce Rope', 120, 'Use basic low-bounce or alternating-foot skipping at an easy pace. Do not use boxer step; fast marching is the no-rope option.', ['cardiovascular system', 'calves', 'coordination'], ['Jump Rope']),
      ex('Progressive Rope Primer', 120, 'Gradually approach workout cadence without straining. Finish warm, springy, and coordinated rather than fatigued.', ['cardiovascular system', 'calves', 'coordination'], ['Jump Rope']),
    ],
    circuits: [{
      name: `Controlled 4 × ${intervalMinutes}-Minute High-Aerobic Intervals`,
      rounds: 4,
      restBetweenRounds: 180,
      restBetweenExercises: 0,
      exercises: [
        ex(
          `Jump Rope VO₂ Interval - ${intervalMinutes} Minutes`,
          workIntervalSeconds,
          'Work at about RPE 8/10: hard breathing with only a few words possible, but controlled enough to finish the fourth interval without cadence collapsing. This is not an all-out sprint, and heart rate may take 1-2 minutes to rise. Use basic low-bounce or alternating-foot skipping, not boxer step. During each three-minute round recovery, keep moving with easy walking or marching. If discomfort or coordination limits the rope, substitute fast low-impact step-ups or running/marching in place.',
          ['cardiovascular system', 'calves', 'quads', 'glutes', 'core'],
          ['Jump Rope']
        ),
      ],
    }],
    coolDown: [
      ex('Easy Walking Downshift', 150, 'Walk easily and let breathing and heart rate settle without stopping abruptly.', ['cardiovascular system', 'calves', 'hips']),
      ex('Calf Mobility - Alternating', 90, 'Use a gentle calf stretch on the left, then switch to the right halfway. Stay well below pain.', ['calves', 'ankles'], undefined, { switchSides: true }),
      ex('Standing Recovery Breathing', 60, 'Breathe slowly through the nose if comfortable, lengthening the exhale while the shoulders relax.', ['diaphragm', 'cardiovascular system']),
    ],
    partingWords: `Four controlled ${intervalMinutes}-minute intervals are the win. Record RPE, cadence quality, coordination, and any foot, calf, Achilles, or knee response so the next exposure can progress safely.`,
  });
}

type RemainingAugustClimbingStyle = 'high-step' | 'lock-off' | 'tension' | 'flow';

function augustConjugateClimbingWarmup(
  date: string,
  style: RemainingAugustClimbingStyle
): ProgrammedWorkout {
  const variants: Record<RemainingAugustClimbingStyle, {
    name: string;
    coachNotes: string;
    exercises: ExerciseSeed[];
  }> = {
    'high-step': {
      name: 'High-Step and Compression Climbing Primer',
      coachNotes: 'Climbing preparation only: open the hips, wake up compression, and keep every finger and shoulder drill easy.',
      exercises: [
        augustRopeRamp(40),
        ex('Wrist Rocks and Finger Waves', 45, 'Rock gently through the wrists, then open and close the fingers without fatigue.', ['wrists', 'forearms']),
        ex('Scapular Pull-ups', 40, 'Move only through the shoulder blades and keep the elbows straight.', ['lats', 'lower traps', 'shoulders'], ['Pull-up Bar']),
        ex('Hangboard Large-Edge Active Hang', 45, 'Use a comfortable large edge and lightly set the shoulders. Stop for any finger or elbow warning.', ['forearms', 'lats', 'shoulders'], ['Hangboard']),
        ex('Cossack to High-Step Reach', 60, 'Shift toward the left hip and reach high, then switch toward the right hip halfway.', ['hips', 'adductors', 'quads', 'core'], ['Yoga Mat'], { switchSides: true }),
        ex('Hollow Tuck Compression', 40, 'Pull the knees toward the chest while keeping the low back heavy and shoulders relaxed.', ['core', 'hip flexors'], ['Yoga Mat']),
      ],
    },
    'lock-off': {
      name: 'Lock-Off and Hip-Turn Climbing Primer',
      coachNotes: 'Sunday primer: rehearse quiet lock-off positions and hip turns without creating pull fatigue before climbing.',
      exercises: [
        augustRopeRamp(40),
        ex('Finger Tendon Glides', 40, 'Move through open hand, hook, fist, and straight-fist shapes without squeezing hard.', ['fingers', 'forearms']),
        ex('Band Face Pull to Press-Out', 50, 'Pull to eye level, then press the band forward while the shoulder blades stay controlled.', ['upper back', 'rear delts', 'rotator cuff'], ['Resistance Bands']),
        ex('Foot-Assisted Lock-Off - Alternating', 60, 'Use the feet to hold an easy left-arm lock-off, then switch to the right arm halfway.', ['lats', 'biceps', 'shoulders'], ['Gymnastic Rings'], { switchSides: true }),
        ex('Hip Turn and Flag Step', 60, 'Practice turning the left hip toward an imaginary wall, then switch to the right halfway.', ['hips', 'glutes', 'obliques'], ['Yoga Mat'], { switchSides: true }),
        ex('Dead Bug Band Pulldown', 45, 'Hold a light band toward the thighs while alternating leg reaches and keeping the ribs down.', ['core', 'lats'], ['Resistance Bands', 'Yoga Mat']),
      ],
    },
    tension: {
      name: 'Body-Tension and Flagging Climbing Primer',
      coachNotes: 'Climbing preparation only: connect shoulders, trunk, and hips, but leave grip strength for the wall.',
      exercises: [
        augustRopeRamp(40),
        ex('Wrist CARs and Finger Pulses', 45, 'Circle both wrists slowly, then use easy open-hand finger pulses.', ['wrists', 'forearms']),
        ex('Band Straight-Arm Pulldown', 45, 'Pull the band toward the thighs with straight elbows and ribs stacked.', ['lats', 'shoulders', 'core'], ['Resistance Bands']),
        ex('Active Hang Knee-Tuck Rehearsal', 45, 'Use a comfortable grip for two or three easy knee tucks. Stop well before grip fatigue.', ['lats', 'forearms', 'core'], ['Pull-up Bar']),
        ex('Side Plank Flag Line - Alternating', 60, 'Hold a short left side-plank line, then switch to the right halfway without straining the shoulder.', ['obliques', 'shoulders', 'glutes'], ['Yoga Mat'], { switchSides: true }),
        ex('90/90 Hip Switch to Reach', 55, 'Flow through both hips and add a relaxed overhead reach without forcing range.', ['hips', 'adductors', 'thoracic spine'], ['Yoga Mat']),
      ],
    },
    flow: {
      name: 'Scapular Flow and Quiet-Feet Climbing Primer',
      coachNotes: 'End-of-month climbing primer: smooth scapular rhythm, mobile hips, and precise feet with no pre-climb fatigue.',
      exercises: [
        augustRopeRamp(40),
        ex('Finger Waves and Wrist Extension Rocks', 45, 'Warm the fingers, then rock gently through a pain-free wrist range.', ['fingers', 'wrists', 'forearms']),
        ex('Scapular Pushup Wave', 45, 'Move from protraction to retraction with straight elbows and a quiet trunk.', ['serratus', 'shoulders', 'upper back'], ['Yoga Mat']),
        ex('Easy Ring Row Acceleration', 45, 'Use foot assistance for three or four smooth rows with fast intent up and full control down.', ['lats', 'back', 'biceps'], ['Gymnastic Rings']),
        ex('Shinbox to High-Step Stand', 60, 'Rise from the left shinbox position, then switch to the right halfway and use hand support as needed.', ['hips', 'glutes', 'core'], ['Yoga Mat'], { switchSides: true }),
        ex('Cross-Body Dead Bug', 50, 'Extend opposite arm and leg while the ribs stay heavy and breathing stays easy.', ['core', 'obliques', 'hip flexors'], ['Yoga Mat']),
      ],
    },
  };
  const variant = variants[style];

  return programmedWorkout({
    id: `program-2026-08-conjugate-climbing-${style}-${date}`,
    date,
    slot: 'Warm-up',
    priority: 1,
    coachNotes: variant.coachNotes,
    name: variant.name,
    description: 'A date-specific, low-fatigue climbing primer that changes the movement problem without stealing performance from the wall.',
    difficulty: 'intermediate',
    targetDurationMinutes: 7,
    estimatedCalories: 50,
    calorieRange: { low: 35, high: 70 },
    focusAreas: ['climbing', 'mobility', 'skill', 'warm-up'],
    muscleGroupsTargeted: ['forearms', 'shoulders', 'back', 'hips', 'core'],
    warmUp: variant.exercises,
    partingWords: 'Warm, coordinated, and ready. The climbing session is still the hard work today.',
  });
}

function augustConjugateAntagonistSnack(
  date: string,
  style: 'ring-support' | 'scapular-balance'
): ProgrammedWorkout {
  const isRingSupport = style === 'ring-support';
  return programmedWorkout({
    id: `program-2026-08-conjugate-snack-${style}-${date}`,
    date,
    slot: 'Snack',
    priority: 2,
    coachNotes: 'Optional after climbing or later. Keep this restorative and skip any movement that reproduces shoulder, elbow, wrist, or finger discomfort.',
    name: isRingSupport ? 'Ring Support and Posture Snack' : 'Scapular Balance and Extension Snack',
    description: isRingSupport
      ? 'A small ring-support, serratus, and upper-back dose that balances climbing without becoming another workout.'
      : 'A different low-cost shoulder-balance stack for pressing, external rotation, thoracic extension, and trunk support.',
    difficulty: 'intermediate',
    targetDurationMinutes: 8,
    estimatedCalories: 50,
    calorieRange: { low: 35, high: 70 },
    focusAreas: ['antagonist strength', 'shoulder health', 'posture', 'recovery'],
    muscleGroupsTargeted: ['chest', 'serratus', 'rotator cuff', 'rear delts', 'triceps', 'core'],
    circuits: [{
      name: isRingSupport ? 'Support and Serratus Reset' : 'Scapular Balance Reset',
      rounds: 2,
      restBetweenRounds: 25,
      restBetweenExercises: 8,
      exercises: isRingSupport
        ? [
            ex('Foot-Assisted Ring Support Hold', 35, 'Use the feet to unload the rings, press tall, and keep the rings quiet.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings']),
            ex('Pushup Plus', 35, 'Use a wall, bench, or floor and finish each rep by spreading the shoulder blades.', ['serratus', 'chest', 'triceps'], ['Yoga Mat'], { targetReps: 10 }),
            ex('Ring Reverse Fly Easy Range', 35, 'Use a tall body angle and open the arms only as far as the shoulders stay comfortable.', ['rear delts', 'upper back', 'rotator cuff'], ['Gymnastic Rings'], { targetReps: 8 }),
            ex('Prone Y-T-W', 50, 'Move through Y, T, and W shapes with very light effort and a relaxed neck.', ['lower traps', 'rear delts', 'rotator cuff'], ['Yoga Mat']),
          ]
        : [
            ex('Ring Pushup with Scapular Finish', 35, 'Use an easy angle and add a controlled protraction at the top.', ['chest', 'triceps', 'serratus'], ['Gymnastic Rings'], { targetReps: 8 }),
            ex('Band External Rotation - Alternating', 60, 'Rotate the left arm with light tension, then switch to the right halfway.', ['rotator cuff', 'rear delts'], ['Resistance Bands'], { switchSides: true }),
            ex('Reverse Plank March', 40, 'Lift the chest and alternate small marches without shrugging.', ['posterior chain', 'shoulders', 'triceps', 'core'], ['Yoga Mat']),
            ex('Yoga Wheel Thoracic Reach', 45, 'Support the upper back on the wheel and reach overhead without forcing the shoulders.', ['thoracic spine', 'chest', 'shoulders'], ['Yoga wheel']),
          ],
    }],
    partingWords: 'Small maintenance dose complete. Save adaptation capacity for the main sessions.',
  });
}

function augustRingsPowerConjugate(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-conjugate-rings-power-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'Fresh post-travel conjugate session: kettlebell power, vertical pulling, ring support, loaded posture, and trunk strength. Keep it RPE 6-7 before Saturday intervals.',
    name: 'Conjugate Rings, Pull-ups, and Kettlebell Power',
    description: 'A whole-body return session built around power, ring support, a new pull-up angle, loaded posture, and shoulder-balance work rather than the prior Friday template.',
    difficulty: 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: 235,
    calorieRange: { low: 195, high: 285 },
    focusAreas: ['strength', 'power', 'advanced calisthenics', 'posture', 'core'],
    muscleGroupsTargeted: ['glutes', 'hamstrings', 'lats', 'back', 'chest', 'triceps', 'shoulders', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Kettlebell Deadlift to Hike Prep', 45, 'Alternate controlled deadlifts with two or three crisp hike rehearsals.', ['hamstrings', 'glutes', 'back'], ['Kettlebell']),
      ex('Scapular Pull-ups', 40, 'Move only through the shoulder blades and keep the neck long.', ['lats', 'lower traps', 'shoulders'], ['Pull-up Bar']),
      ex('Foot-Assisted Ring Support Scap Press', 40, 'Use the feet and practice pressing tall through quiet rings.', ['shoulders', 'chest', 'triceps'], ['Gymnastic Rings']),
      ex('Half-Kneeling Hip Flexor Reach', 60, 'Open the left hip with a tall reach, then switch to the right halfway.', ['hip flexors', 'quads', 'side body'], ['Yoga Mat'], { switchSides: true }),
    ],
    circuits: [
      {
        name: 'Power, Pull, and Support',
        rounds: 3,
        restBetweenRounds: 60,
        restBetweenExercises: 10,
        exercises: [
          ex('Dead-Stop Kettlebell Swing', 45, 'Use eight to ten crisp reps, rebuild the hike each set, and stop before snap fades.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 10 }),
          ex('Ring Dips', 40, 'Use a shoulder-friendly depth and leave one or two clean reps in reserve.', ['chest', 'triceps', 'shoulders'], ['Gymnastic Rings'], { targetReps: 6 }),
          ex('Commando Pull-ups - Alternating Lead', 40, 'Pull toward one side of the bar, alternate the lead side each rep, and stop before rotation becomes sloppy.', ['lats', 'back', 'biceps', 'obliques'], ['Pull-up Bar'], { targetReps: 6 }),
          ex('Kettlebell Front-Rack March - Alternating', 60, 'March with the bell racked on the left, then switch to the right halfway. Keep the wrist neutral and use two hands to assist the change.', ['core', 'obliques', 'shoulders', 'hips'], ['Kettlebell'], { switchSides: true }),
          ex('Hollow-to-Tuck Rock', 40, 'Rock through a controlled hollow shape and tuck before the low back lifts.', ['core', 'hip flexors'], ['Yoga Mat']),
        ],
      },
      {
        name: 'Posture and Posterior Balance',
        rounds: 2,
        restBetweenRounds: 35,
        restBetweenExercises: 10,
        exercises: [
          ex('Ring Face Pull to External Rotation', 45, 'Pull toward the eyes, rotate smoothly, and keep the neck relaxed.', ['upper back', 'rear delts', 'rotator cuff'], ['Gymnastic Rings'], { targetReps: 10 }),
          ex('Single-Leg Glute Bridge - Alternating', 60, 'Bridge on the left leg, then switch to the right halfway and keep the pelvis level.', ['glutes', 'hamstrings', 'core'], ['Yoga Mat'], { switchSides: true }),
          ex('Band Chop - Alternating', 60, 'Chop from high to low on the left, then switch to the right halfway without twisting the knees.', ['obliques', 'lats', 'shoulders'], ['Resistance Bands'], { switchSides: true }),
        ],
      },
    ],
    coolDown: [
      ex('Forearm Extensor Stretch - Alternating', 60, 'Stretch the left forearm gently, then switch to the right halfway.', ['forearms', 'wrists'], undefined, { switchSides: true }),
      ex('Lat and Triceps Prayer Stretch', 70, 'Bias the left side, then switch toward the right halfway and breathe into the ribs.', ['lats', 'triceps', 'shoulders'], ['Yoga Mat'], { switchSides: true }),
      ex('Crocodile Breathing', 60, 'Breathe into the floor and let the trunk downshift.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords: 'Power, rings, pull-ups, posture, and trunk all got a distinct signal. Leave the legs springy for Saturday.',
  });
}

function augustLeverAndCleanPressConjugate(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-conjugate-lever-clean-press-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'Monday conjugate emphasis: lever pulling and offset hinging first, then crisp three-rep clean-and-press sets per side. No grinding or wrist impact.',
    name: 'Front Lever, Offset Hinge, and Clean-Press Triples',
    description: 'A climbing-relevant pull and trunk session that pairs lever practice with a new offset hinge angle and treats three clean-and-press reps per side as established training capacity.',
    difficulty: 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: 240,
    calorieRange: { low: 200, high: 290 },
    focusAreas: ['advanced calisthenics', 'strength', 'posterior chain', 'clean and press', 'climbing'],
    muscleGroupsTargeted: ['lats', 'back', 'biceps', 'hamstrings', 'glutes', 'shoulders', 'triceps', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Wrist Tendon Glides', 45, 'Move through open hand, hook, fist, and straight-fist shapes without strain.', ['wrists', 'forearms']),
      ex('Scapular Pull-up to Hollow', 45, 'Set the shoulder blades, then briefly connect the ribs and pelvis into a hollow line.', ['lats', 'lower traps', 'core'], ['Pull-up Bar']),
      ex('Kettlebell Kickstand Hinge Groove', 60, 'Hinge with the left leg loaded, then switch to the right halfway using the back toes for balance.', ['hamstrings', 'glutes', 'core'], ['Kettlebell'], { switchSides: true }),
      ex('Ring Pushup Turnout Rehearsal', 40, 'Use an easy angle and practice a quiet turnout only at full support.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings']),
    ],
    circuits: [
      {
        name: 'Lever and Offset Strength',
        rounds: 3,
        restBetweenRounds: 60,
        restBetweenExercises: 12,
        exercises: [
          ex('Tuck Front Lever Pulls', 40, 'Pull from an active hang toward a compact tuck lever and stop before the shoulders lose position.', ['lats', 'back', 'biceps', 'core'], ['Pull-up Bar'], { targetReps: 5 }),
          ex('Ring Pushups with Turnout', 45, 'Lower under control, press cleanly, and turn the rings out only at the top.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings'], { targetReps: 10 }),
          ex('Kickstand Kettlebell Romanian Deadlift - Alternating', 60, 'Load the left leg with the back toes down, then switch to the right halfway and keep the pelvis square.', ['hamstrings', 'glutes', 'core'], ['Kettlebell'], { switchSides: true }),
          ex('Fitness Ball Stir-the-Pot', 45, 'Draw small circles in both directions without letting the ribs flare.', ['core', 'shoulders'], ['Fitness Ball', 'Yoga Mat']),
        ],
      },
      {
        name: 'Established Clean-Press Capacity',
        rounds: 2,
        restBetweenRounds: 60,
        restBetweenExercises: 15,
        exercises: [
          ex('50 lb Kettlebell Clean and Press - Right', 50, 'Perform up to three crisp right-side reps with a quiet catch and stable lockout. Stop before grinding or wrist impact.', ['glutes', 'back', 'shoulders', 'triceps', 'core'], ['Kettlebell'], { targetReps: 3 }),
          ex('50 lb Kettlebell Clean and Press - Left', 50, 'Match the right side with up to three crisp left-side reps. Use fewer reps if the rack or overhead path changes.', ['glutes', 'back', 'shoulders', 'triceps', 'core'], ['Kettlebell'], { targetReps: 3 }),
          ex('Ring L-Sit or Tuck Support', 40, 'Press tall through the rings and hold the hardest clean tuck or L-sit variation available.', ['core', 'hip flexors', 'shoulders', 'triceps'], ['Gymnastic Rings']),
        ],
      },
    ],
    coolDown: [
      ex('Forearm and Wrist Reset', 60, 'Move both wrists gently through flexion, extension, and circles.', ['forearms', 'wrists']),
      ex('Hamstring Floss - Alternating', 70, 'Floss the left hamstring gently, then switch to the right halfway without forcing range.', ['hamstrings', 'calves'], ['Yoga Mat'], { switchSides: true }),
      ex('Lat Prayer Breathing', 60, 'Sink back, breathe into the side ribs, and let the shoulders soften.', ['lats', 'shoulders', 'diaphragm'], ['Yoga Mat']),
    ],
    partingWords: 'The clean and press is now training, not a one-rep goal. Quality triples and lever control move the baseline forward.',
  });
}

function augustHandstandSkinTheCatConjugate(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-conjugate-handstand-skin-the-cat-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'Post-blood-draw session: train after eating and hydrating, keep RPE 6-7, and use this as skill practice rather than a conditioning test.',
    name: 'Handstand Line, Skin the Cat, and Unilateral Legs',
    description: 'A moderate conjugate skill day for vertical pressing, shoulder extension, supported single-leg strength, anti-rotation, and knee-friendly lower-leg capacity.',
    difficulty: 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: 210,
    calorieRange: { low: 170, high: 255 },
    focusAreas: ['advanced calisthenics', 'skill', 'shoulder mobility', 'unilateral strength', 'longevity'],
    muscleGroupsTargeted: ['shoulders', 'triceps', 'back', 'quads', 'glutes', 'calves', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Ankle Rockers and Tibialis Raises', 60, 'Alternate smooth ankle rocks with easy wall-supported tibialis raises. Stop if the left knee becomes uncomfortable.', ['ankles', 'tibialis anterior', 'calves', 'knees']),
      ex('Wrist Rocks and Palm Lifts', 45, 'Warm wrist extension gradually and keep pressure comfortable.', ['wrists', 'forearms'], ['Yoga Mat']),
      ex('Wall Handstand Line Drill', 45, 'Use a chest-to-wall or pike setup and practice stacked ribs, hips, and shoulders without fatigue.', ['shoulders', 'core', 'triceps'], ['Yoga Mat']),
      ex('Ring Shoulder-Extension Rehearsal', 45, 'Use low rings and foot support to explore a shallow, pain-free shoulder-extension range.', ['shoulders', 'chest', 'biceps'], ['Gymnastic Rings']),
    ],
    circuits: [
      {
        name: 'Calisthenics Skill Rotation',
        rounds: 3,
        restBetweenRounds: 70,
        restBetweenExercises: 15,
        exercises: [
          ex('Supported Pistol Squat - Right', 45, 'Use the rings for balance and perform controlled right-leg reps with two reps in reserve.', ['quads', 'glutes', 'core'], ['Gymnastic Rings'], { targetReps: 5 }),
          ex('Supported Pistol Squat - Left', 45, 'Use the same assistance on the left and stop for any knee discomfort.', ['quads', 'glutes', 'core'], ['Gymnastic Rings'], { targetReps: 4 }),
          ex('Pike Handstand Pushups', 40, 'Use a high-hip pike or wall-assisted variation and stop before the line changes.', ['shoulders', 'triceps', 'upper chest', 'core'], ['Yoga Mat'], { targetReps: 6 }),
          ex('Skin the Cat Progression', 45, 'Use low rings and foot assistance as needed. Move through a comfortable range without dropping into the shoulders.', ['shoulders', 'lats', 'chest', 'core'], ['Gymnastic Rings'], { targetReps: 3 }),
          ex('Band Pallof Press - Alternating', 60, 'Press from the left side, then switch to the right halfway while resisting rotation.', ['core', 'obliques', 'shoulders'], ['Resistance Bands'], { switchSides: true }),
        ],
      },
      {
        name: 'Knee and Groin Capacity',
        rounds: 2,
        restBetweenRounds: 35,
        restBetweenExercises: 10,
        exercises: [
          ex('Wall Tibialis Raise', 45, 'Lift the toes toward the shins with the heels planted and use a small pain-free range.', ['tibialis anterior', 'ankles'], undefined, { targetReps: 15 }),
          ex('Copenhagen Plank - Alternating', 60, 'Use a short-lever left-side hold, then switch to the right halfway and keep the shoulder stacked.', ['adductors', 'obliques', 'shoulders'], ['Yoga Mat'], { switchSides: true }),
          ex('Band Reverse Fly', 45, 'Open the band at chest height with soft elbows and a relaxed neck.', ['rear delts', 'upper back'], ['Resistance Bands'], { targetReps: 12 }),
        ],
      },
    ],
    coolDown: [
      ex('Couch Stretch - Alternating', 90, 'Open the left hip and quad, then switch to the right halfway.', ['hip flexors', 'quads'], ['Yoga Mat'], { switchSides: true }),
      ex('Wrist Flexor Stretch - Alternating', 60, 'Stretch the left wrist gently, then switch to the right halfway.', ['forearms', 'wrists'], undefined, { switchSides: true }),
      ex('Supine Breathing', 60, 'Lie down and lengthen the exhale until breathing feels settled.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords: 'New skills, different angles, and no need to turn a blood-draw day into a toughness test.',
  });
}

function augustRingTransitionConjugate(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-conjugate-ring-transition-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'Friday skill-density session: learn a ring transition and kettlebell high-pull pattern at RPE 7, leaving the calves and feet fresh for Saturday intervals.',
    name: 'Ring Transition, Archer Push, and Kettlebell High Pull',
    description: 'A distinct whole-body skill session combining assisted ring-transition mechanics, a new pressing angle, lateral leg strength, kettlebell power, and trunk control.',
    difficulty: 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: 235,
    calorieRange: { low: 195, high: 285 },
    focusAreas: ['advanced calisthenics', 'skill', 'power', 'full body', 'core'],
    muscleGroupsTargeted: ['back', 'lats', 'chest', 'shoulders', 'triceps', 'glutes', 'hamstrings', 'quads', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('False-Grip Wrist Prep', 50, 'Use the rings lightly to explore a comfortable false-grip angle without loading body weight.', ['wrists', 'forearms'], ['Gymnastic Rings']),
      ex('Kettlebell Hike to High-Pull Path', 45, 'Rehearse a close, powerful path without muscling the bell with the arms.', ['glutes', 'hamstrings', 'upper back'], ['Kettlebell']),
      ex('Ring Support Scap Shrugs', 40, 'Use foot assistance and move only through the shoulder blades.', ['shoulders', 'chest', 'upper back'], ['Gymnastic Rings']),
      ex('Lateral Squat Shift', 60, 'Shift toward the left hip, then the right, keeping both feet planted and the left knee comfortable.', ['adductors', 'quads', 'glutes'], ['Yoga Mat']),
    ],
    circuits: [
      {
        name: 'Transition and Power Skill',
        rounds: 3,
        restBetweenRounds: 60,
        restBetweenExercises: 10,
        exercises: [
          ex('Foot-Assisted Ring Muscle-Up Transition', 45, 'Keep the feet down, pull the rings toward the ribs, and rotate smoothly into a supported dip position.', ['lats', 'back', 'biceps', 'chest', 'triceps'], ['Gymnastic Rings'], { targetReps: 5 }),
          ex('Kettlebell High Pull Technique', 45, 'Use five to eight hip-driven reps with a relaxed grip. Keep the bell close and stop if the arm starts muscling it.', ['glutes', 'hamstrings', 'upper back', 'core'], ['Kettlebell'], { targetReps: 8 }),
          ex('Ring Archer Pushup', 40, 'Shift toward one ring, alternate sides each rep, and use a body angle that keeps both shoulders controlled.', ['chest', 'triceps', 'shoulders', 'core'], ['Gymnastic Rings'], { targetReps: 8 }),
          ex('Supported Cossack Squat - Alternating', 60, 'Use the rings and move toward the left leg, then switch toward the right halfway. Keep the range pain-free.', ['quads', 'glutes', 'adductors'], ['Gymnastic Rings'], { switchSides: true }),
          ex('Ring Body Saw', 45, 'Use forearms or hands in the rings and glide through a short range without sagging.', ['core', 'shoulders', 'lats'], ['Gymnastic Rings']),
        ],
      },
      {
        name: 'Rotation and Shoulder Finish',
        rounds: 2,
        restBetweenRounds: 40,
        restBetweenExercises: 10,
        exercises: [
          ex('Half-Kneeling Dumbbell Windmill - Alternating', 60, 'Hold a light dumbbell on the left and rotate slowly, then switch to the right halfway.', ['obliques', 'shoulders', 'hips'], ['Dumbbells', 'Yoga Mat'], { switchSides: true }),
          ex('Ring Tuck Support Hold', 40, 'Press tall and float one or both feet only while the rings stay quiet.', ['core', 'hip flexors', 'triceps', 'shoulders'], ['Gymnastic Rings']),
          ex('Band No-Money Drill', 45, 'Rotate the hands apart with elbows near the ribs and the neck relaxed.', ['rotator cuff', 'rear delts'], ['Resistance Bands'], { targetReps: 12 }),
        ],
      },
    ],
    coolDown: [
      ex('Pigeon Pose - Alternating', 90, 'Open the left hip, then switch to the right halfway without forcing range.', ['glutes', 'hips'], ['Yoga Mat'], { switchSides: true }),
      ex('Forearm Flexor Stretch - Alternating', 60, 'Stretch the left forearm gently, then switch to the right halfway.', ['forearms', 'wrists'], undefined, { switchSides: true }),
      ex('Box Breathing', 60, 'Use easy equal-count inhales, holds, exhales, and pauses.', ['diaphragm', 'core'], ['Yoga Mat']),
    ],
    partingWords: 'A new ring pathway, a new kettlebell pathway, and enough restraint to hit Saturday well.',
  });
}

function augustConjugateSkillCheckpoint(date: string): ProgrammedWorkout {
  return programmedWorkout({
    id: `program-2026-08-conjugate-skill-checkpoint-${date}`,
    date,
    slot: 'Main',
    priority: 1,
    coachNotes: 'End-of-month conjugate checkpoint, not a max test: repeat established clean-press triples, then sample pull-up, rings, skin-the-cat, pistol, and trunk skills with clean technique.',
    name: 'August Conjugate Whole-Body Skill Checkpoint',
    description: 'A broad quality check across kettlebell power, clean-and-press capacity, advanced pulling, ring support, unilateral legs, shoulder mobility, and trunk strength.',
    difficulty: 'advanced',
    targetDurationMinutes: 30,
    estimatedCalories: 245,
    calorieRange: { low: 205, high: 295 },
    focusAreas: ['advanced calisthenics', 'strength', 'clean and press', 'skill checkpoint', 'full body'],
    muscleGroupsTargeted: ['glutes', 'hamstrings', 'quads', 'shoulders', 'triceps', 'back', 'lats', 'chest', 'core'],
    warmUp: [
      augustRopeRamp(),
      ex('Kettlebell Hike and Clean Path Prep', 45, 'Rehearse a crisp hike, then a close clean path with a quiet catch.', ['hamstrings', 'glutes', 'back', 'shoulders'], ['Kettlebell']),
      ex('Ring Support and Turnout Prep', 45, 'Use the feet to assist a tall support and gentle turnout.', ['shoulders', 'chest', 'triceps'], ['Gymnastic Rings']),
      ex('Scapular Pull-up to Tuck', 45, 'Set the shoulder blades and add one or two easy tuck raises.', ['lats', 'shoulders', 'core'], ['Pull-up Bar']),
      ex('Supported Squat-to-Pistol Shift', 45, 'Use the rings to shift toward each leg and check that the left knee feels normal.', ['quads', 'glutes', 'core'], ['Gymnastic Rings']),
    ],
    circuits: [
      {
        name: 'Power, Pull, and Press Baseline',
        rounds: 2,
        restBetweenRounds: 75,
        restBetweenExercises: 15,
        exercises: [
          ex('Two-Hand Kettlebell Swing', 45, 'Use ten to twelve crisp reps and park the bell before power fades.', ['glutes', 'hamstrings', 'back', 'core'], ['Kettlebell'], { targetReps: 12 }),
          ex('Chest-to-Bar Pull-ups', 40, 'Use strict high pulls while speed and shoulder position stay consistent.', ['lats', 'back', 'biceps'], ['Pull-up Bar'], { targetReps: 5 }),
          ex('Ring Dips', 40, 'Use a controlled shoulder-friendly depth and leave a rep in reserve.', ['chest', 'triceps', 'shoulders'], ['Gymnastic Rings'], { targetReps: 6 }),
          ex('50 lb Kettlebell Clean and Press - Right', 50, 'Perform up to three crisp right-side reps with a quiet catch. No grinding.', ['glutes', 'back', 'shoulders', 'triceps', 'core'], ['Kettlebell'], { targetReps: 3 }),
          ex('50 lb Kettlebell Clean and Press - Left', 50, 'Match the right side with up to three crisp left-side reps and no wrist impact.', ['glutes', 'back', 'shoulders', 'triceps', 'core'], ['Kettlebell'], { targetReps: 3 }),
        ],
      },
      {
        name: 'Mobility, Single-Leg, and Support Skills',
        rounds: 2,
        restBetweenRounds: 50,
        restBetweenExercises: 10,
        exercises: [
          ex('Skin the Cat Progression', 45, 'Use foot assistance and a pain-free shoulder range for two or three controlled reps.', ['shoulders', 'lats', 'chest', 'core'], ['Gymnastic Rings'], { targetReps: 3 }),
          ex('Supported Pistol Squat - Right', 40, 'Use the rings for controlled right-leg reps with no grinding.', ['quads', 'glutes', 'core'], ['Gymnastic Rings'], { targetReps: 5 }),
          ex('Supported Pistol Squat - Left', 40, 'Use the same assistance on the left and stop for any knee warning.', ['quads', 'glutes', 'core'], ['Gymnastic Rings'], { targetReps: 4 }),
          ex('Ring L-Sit or Tuck Support', 35, 'Press tall and hold the hardest clean variation that keeps the rings quiet.', ['core', 'hip flexors', 'shoulders', 'triceps'], ['Gymnastic Rings']),
          ex('Kettlebell Suitcase March - Alternating', 60, 'March with the bell on the left, then switch to the right halfway without leaning.', ['obliques', 'grip', 'hips'], ['Kettlebell'], { switchSides: true }),
        ],
      },
    ],
    coolDown: [
      ex('Forearm and Wrist Reset', 60, 'Move the wrists gently through flexion, extension, and circles.', ['forearms', 'wrists']),
      ex('Yoga Wheel Chest Opener', 55, 'Let the chest and shoulders relax over the wheel.', ['chest', 'shoulders', 'thoracic spine'], ['Yoga wheel']),
      ex('Crocodile Breathing', 70, 'Breathe into the floor and let the whole trunk downshift.', ['diaphragm', 'low back'], ['Yoga Mat']),
    ],
    partingWords: 'This is the new baseline: broad skill, strong positions, balanced tissue stress, and no need to chase a one-rep milestone already surpassed.',
  });
}

function buildAugustHomeWeek(startDate: string, phase: AugustPhase): ProgrammedWorkout[] {
  const saturdayDate = addDays(startDate, 5);
  const saturdayWorkout = saturdayDate === '2026-08-22'
    ? augustSaturdayJumpRopeVo2(saturdayDate, 120)
    : saturdayDate === '2026-08-29'
      ? augustSaturdayJumpRopeVo2(saturdayDate, 180)
      : augustSaturdayMobility(saturdayDate);

  return [
    augustMondayStrength(startDate, phase),
    augustTuesdayStrength(addDays(startDate, 1), phase),
    augustClimbingWarmup(addDays(startDate, 2)),
    augustAntagonistSnack(addDays(startDate, 2)),
    augustZone2(addDays(startDate, 3), phase),
    augustFridayStrength(addDays(startDate, 4), phase),
    saturdayWorkout,
    augustClimbingWarmup(addDays(startDate, 6), true),
  ];
}

const AUGUST_TRAVEL_OVERRIDE_START_DATE = '2026-08-14';
const AUGUST_TRAVEL_OVERRIDE_END_DATE = '2026-08-17';

const AUGUST_TRAVEL_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  augustDriveReset('2026-08-14', 'Departure'),
  augustCottageDensity('2026-08-15'),
  augustCottageFullBodyB('2026-08-16'),
  augustDriveReset('2026-08-17', 'Return'),
];

const AUGUST_TRANSITION_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  augustSaturdayMobility('2026-08-01'),
  augustClimbingWarmup('2026-08-02', true),
];

const AUGUST_HOME_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  ...buildAugustHomeWeek('2026-08-03', 1),
  ...buildAugustHomeWeek('2026-08-10', 2),
  ...buildAugustHomeWeek('2026-08-17', 3),
  ...buildAugustHomeWeek('2026-08-24', 4),
].filter(
  (programmedWorkout) =>
    (programmedWorkout.date < AUGUST_TRAVEL_OVERRIDE_START_DATE ||
      programmedWorkout.date > AUGUST_TRAVEL_OVERRIDE_END_DATE) &&
    programmedWorkout.date < '2026-08-19'
);

const AUGUST_REMAINING_CONJUGATE_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  augustConjugateClimbingWarmup('2026-08-19', 'high-step'),
  augustConjugateAntagonistSnack('2026-08-19', 'ring-support'),
  augustZone2('2026-08-20', 3),
  augustRingsPowerConjugate('2026-08-21'),
  augustSaturdayJumpRopeVo2('2026-08-22', 120),
  augustConjugateClimbingWarmup('2026-08-23', 'lock-off'),
  augustLeverAndCleanPressConjugate('2026-08-24'),
  augustHandstandSkinTheCatConjugate('2026-08-25'),
  augustConjugateClimbingWarmup('2026-08-26', 'tension'),
  augustConjugateAntagonistSnack('2026-08-26', 'scapular-balance'),
  augustZone2('2026-08-27', 4),
  augustRingTransitionConjugate('2026-08-28'),
  augustSaturdayJumpRopeVo2('2026-08-29', 180),
  augustConjugateClimbingWarmup('2026-08-30', 'flow'),
  augustConjugateSkillCheckpoint('2026-08-31'),
];

const AUGUST_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  ...AUGUST_TRANSITION_PROGRAMMED_WORKOUTS,
  ...AUGUST_HOME_PROGRAMMED_WORKOUTS,
  ...AUGUST_TRAVEL_PROGRAMMED_WORKOUTS,
  ...AUGUST_REMAINING_CONJUGATE_PROGRAMMED_WORKOUTS,
];

function buildTrainingWeek(startDate: string, phase: Phase, includeWeekend: boolean): ProgrammedWorkout[] {
  const monday = startDate;
  const tuesday = addDays(startDate, 1);
  const wednesday = addDays(startDate, 2);
  const thursday = addDays(startDate, 3);
  const friday = addDays(startDate, 4);
  const saturday = addDays(startDate, 5);
  const sunday = addDays(startDate, 6);

  const workouts = [
    mondayStrength(monday, phase),
    tuesdayStrength(tuesday, phase),
    wednesdayClimbingWarmup(wednesday, phase),
    wednesdaySnack(wednesday, phase),
    thursdayCardio(thursday, phase),
    thursdayHealthSnack(thursday, phase),
    fridayStrength(friday, phase),
  ];

  if (includeWeekend) {
    workouts.push(
      saturdaySnack(saturday, phase),
      sundayClimbingWarmup(sunday, phase),
      sundayMobility(sunday, phase)
    );
  }

  return workouts;
}

export const PROGRAM_START_DATE = '2026-06-29';
export const PROGRAM_END_DATE = '2026-08-31';

const BASE_PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  ...buildTrainingWeek('2026-06-29', 1, true),
  ...buildTrainingWeek('2026-07-06', 2, true),
  ...buildTrainingWeek('2026-07-13', 3, true),
  ...buildTrainingWeek('2026-07-20', 4, true),
  ...buildTrainingWeek('2026-07-27', 5, false),
];

export const PROGRAMMED_WORKOUTS: ProgrammedWorkout[] = [
  ...BASE_PROGRAMMED_WORKOUTS.filter(
    (programmedWorkout) =>
      programmedWorkout.date < TRAVEL_OVERRIDE_START_DATE || programmedWorkout.date > TRAVEL_OVERRIDE_END_DATE
  ),
  ...TRAVEL_PROGRAMMED_WORKOUTS,
  ...AUGUST_PROGRAMMED_WORKOUTS,
].sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);

export function getProgrammedWorkoutsForDate(date: Date | string = new Date()): ProgrammedWorkout[] {
  const dateKey = typeof date === 'string' ? date : getLocalDateKey(date);
  return PROGRAMMED_WORKOUTS.filter((programmedWorkout) => programmedWorkout.date === dateKey).sort(
    (a, b) => a.priority - b.priority
  );
}

export function getProgrammedWorkoutsForHome(date: Date = new Date()): HomeProgram | null {
  const todayKey = getLocalDateKey(date);
  const todaysWorkouts = getProgrammedWorkoutsForDate(todayKey);

  if (todaysWorkouts.length > 0) {
    return {
      date: todayKey,
      dateLabel: formatProgramDateLabel(todayKey),
      title: "Today's Program",
      isToday: true,
      workouts: todaysWorkouts,
    };
  }

  const nextDate = PROGRAMMED_WORKOUTS.find((programmedWorkout) => programmedWorkout.date >= todayKey)?.date;
  if (!nextDate) {
    return null;
  }

  return {
    date: nextDate,
    dateLabel: formatProgramDateLabel(nextDate),
    title: 'Next Program',
    isToday: false,
    workouts: getProgrammedWorkoutsForDate(nextDate),
  };
}
