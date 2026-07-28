import type {
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
    coachNotes: `${phaseLabel} Thursday: default to steady road-bike Zone 2 for LDL, body composition, and aerobic base.`,
    name: `${phaseLabel} Zone 2 Road Ride`,
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
export const PROGRAM_END_DATE = '2026-07-31';

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
