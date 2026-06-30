const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const programPath = path.join(__dirname, '..', 'src', 'data', 'programmedWorkouts.ts');
const source = fs.readFileSync(programPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const sandbox = { exports: {}, require: () => ({}), console };
vm.createContext(sandbox);
vm.runInContext(compiled, sandbox);

const workouts = sandbox.exports.PROGRAMMED_WORKOUTS;
if (!Array.isArray(workouts)) {
  throw new Error('PROGRAMMED_WORKOUTS was not exported as an array.');
}

const benignAdjacentRepeats = new Set([
  'Jump Rope Easy Bounce',
  'Jump Rope Boxer Step',
  'Easy Spin Ramp',
  'Easy Spin Downshift',
]);

function exerciseNames(workout, section) {
  if (section === 'warmUp') {
    return workout.workout.warmUp.exercises.map((exercise) => exercise.name);
  }
  if (section === 'coolDown') {
    return workout.workout.coolDown.exercises.map((exercise) => exercise.name);
  }
  return workout.workout.circuits.flatMap((circuit) => circuit.exercises.map((exercise) => exercise.name));
}

function localDayDistance(a, b) {
  const first = new Date(`${a}T00:00:00`);
  const second = new Date(`${b}T00:00:00`);
  return Math.round((second.getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizedForCollision(name) {
  return name
    .replace(/\s+-\s+(Right|Left|Right Leg|Left Leg|Alternating)$/i, '')
    .replace(/\s+\((Right|Left)\)$/i, '')
    .trim();
}

function relevantCircuitNames(workout) {
  return exerciseNames(workout, 'circuits')
    .map(normalizedForCollision)
    .filter((name) => !benignAdjacentRepeats.has(name));
}

function signature(names) {
  return names.join(' -> ');
}

const byDate = new Map();
for (const workout of workouts) {
  if (!byDate.has(workout.date)) {
    byDate.set(workout.date, []);
  }
  byDate.get(workout.date).push(workout);
}

const mainWorkouts = workouts.filter((workout) => workout.slot === 'Main');
const adjacentCircuitRepeats = [];
for (let index = 1; index < mainWorkouts.length; index += 1) {
  const previous = mainWorkouts[index - 1];
  const current = mainWorkouts[index];
  if (localDayDistance(previous.date, current.date) !== 1) {
    continue;
  }

  const previousNames = new Set(relevantCircuitNames(previous));
  const overlap = relevantCircuitNames(current).filter((name) => previousNames.has(name));
  if (overlap.length > 0) {
    adjacentCircuitRepeats.push({
      from: previous.date,
      to: current.date,
      exercises: Array.from(new Set(overlap)),
    });
  }
}

const warmupSignatures = mainWorkouts.map((workout) => ({
  date: workout.date,
  name: workout.workout.name,
  signature: signature(exerciseNames(workout, 'warmUp')),
}));

const duplicateWarmupSignatures = [];
for (let index = 1; index < warmupSignatures.length; index += 1) {
  const previous = warmupSignatures[index - 1];
  const current = warmupSignatures[index];
  if (previous.signature === current.signature) {
    duplicateWarmupSignatures.push({ from: previous.date, to: current.date, signature: current.signature });
  }
}

console.log(`Programmed workouts: ${workouts.length}`);
console.log(`Date range: ${workouts[0]?.date ?? 'n/a'} to ${workouts[workouts.length - 1]?.date ?? 'n/a'}`);
console.log('');
console.log('Main-session summary:');
for (const workout of mainWorkouts) {
  console.log(`- ${workout.date}: ${workout.workout.name}`);
  console.log(`  warm-up: ${signature(exerciseNames(workout, 'warmUp')) || '(none)'}`);
  console.log(`  circuits: ${signature(exerciseNames(workout, 'circuits')) || '(none)'}`);
  console.log(`  cool-down: ${signature(exerciseNames(workout, 'coolDown')) || '(none)'}`);
}

console.log('');
if (adjacentCircuitRepeats.length === 0) {
  console.log('Adjacent main-session circuit repeats: none');
} else {
  console.log('Adjacent main-session circuit repeats:');
  for (const repeat of adjacentCircuitRepeats) {
    console.log(`- ${repeat.from} -> ${repeat.to}: ${repeat.exercises.join(', ')}`);
  }
}

console.log('');
if (duplicateWarmupSignatures.length === 0) {
  console.log('Duplicate adjacent main warm-up signatures: none');
} else {
  console.log('Duplicate adjacent main warm-up signatures:');
  for (const duplicate of duplicateWarmupSignatures) {
    console.log(`- ${duplicate.from} -> ${duplicate.to}: ${duplicate.signature}`);
  }
}

if (adjacentCircuitRepeats.length > 0 || duplicateWarmupSignatures.length > 0) {
  process.exitCode = 1;
}
