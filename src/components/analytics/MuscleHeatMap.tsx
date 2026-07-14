import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Rect, Line, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, typography } from '@/theme';

// ─── Canonical muscle regions ────────────────────────────────────────────────

export type MuscleKey =
  | 'chest'
  | 'back'
  | 'lats'
  | 'traps'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

const MUSCLE_LABELS: Record<MuscleKey, string> = {
  chest: 'Chest',
  back: 'Back',
  lats: 'Lats',
  traps: 'Traps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleKey[];

// Workouts label muscles with free-form strings (AI-generated), so map by
// keyword with weights: e.g. "back" lights the mid-back fully and the lats
// partially; "hip flexors" warms quads and core.
type WeightedTarget = Partial<Record<MuscleKey, number>>;

function targetsFor(raw: string): WeightedTarget {
  const s = raw.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => s.includes(k));

  if (has('chest', 'pec')) return { chest: 1 };
  if (has('lat')) return { lats: 1, back: 0.3 };
  if (has('trap')) return { traps: 1 };
  if (has('lower back', 'erector', 'spinal', 'lumbar')) return { back: 1 };
  if (has('upper back', 'rhomboid', 'thoracic', 'scapula'))
    return { back: 1, lats: 0.45, traps: 0.35 };
  if (has('back')) return { back: 1, lats: 0.7 };
  if (has('rear delt', 'rotator')) return { shoulders: 0.8 };
  if (has('shoulder', 'delt')) return { shoulders: 1 };
  if (has('bicep')) return { biceps: 1 };
  if (has('tricep')) return { triceps: 1 };
  if (has('forearm', 'grip', 'wrist', 'finger')) return { forearms: 1 };
  if (has('core', 'ab', 'oblique', 'trunk')) return { core: 1 };
  if (has('quad')) return { quads: 1 };
  if (has('hamstring')) return { hamstrings: 1 };
  if (has('glute')) return { glutes: 1 };
  if (has('calv', 'calf', 'ankle')) return { calves: 1 };
  if (has('hip flexor')) return { quads: 0.4, core: 0.3 };
  if (has('hip')) return { glutes: 0.6, quads: 0.3 };
  if (has('leg')) return { quads: 0.7, hamstrings: 0.7, glutes: 0.6, calves: 0.4 };
  if (has('arm')) return { biceps: 0.7, triceps: 0.7, forearms: 0.4 };
  if (has('full body', 'total body')) {
    const all: WeightedTarget = {};
    ALL_MUSCLES.forEach((m) => (all[m] = 0.35));
    return all;
  }
  return {};
}

export function computeMuscleHeat(stats: [string, number][]): Record<MuscleKey, number> {
  const heat = {} as Record<MuscleKey, number>;
  ALL_MUSCLES.forEach((m) => (heat[m] = 0));
  stats.forEach(([raw, count]) => {
    const targets = targetsFor(raw);
    (Object.keys(targets) as MuscleKey[]).forEach((m) => {
      heat[m] += (targets[m] || 0) * count;
    });
  });
  return heat;
}

// ─── Heat colors ─────────────────────────────────────────────────────────────

const COLD = '#242E4A'; // untouched muscle
const NEUTRAL = '#1A2236'; // head, hands, joints — never heat-mapped
const HEAT_STOPS = ['#4451E6', '#A438E0', '#FF6B2C'] as const;

function hexLerp(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function heatColor(t: number): string {
  if (t <= 0) return COLD;
  if (t <= 0.5) return hexLerp(HEAT_STOPS[0], HEAT_STOPS[1], t / 0.5);
  return hexLerp(HEAT_STOPS[1], HEAT_STOPS[2], (t - 0.5) / 0.5);
}

// ─── Anatomy shapes ──────────────────────────────────────────────────────────
// One figure = viewBox 0 0 170 400, centered on x=85. Shapes marked
// mirror:true are defined for the RIGHT side of the body and rendered twice
// (once flipped across the center axis).

interface ShapeDef {
  muscle?: MuscleKey; // undefined = neutral silhouette piece
  mirror?: boolean;
  d?: string;
  ellipse?: { cx: number; cy: number; rx: number; ry: number; rot?: number };
  rect?: { x: number; y: number; w: number; h: number; r: number };
}

const SHARED_NEUTRAL: ShapeDef[] = [
  { ellipse: { cx: 85, cy: 26, rx: 13, ry: 16 } }, // head
  { rect: { x: 77, y: 38, w: 16, h: 14, r: 5 } }, // neck
  { ellipse: { cx: 136.5, cy: 184, rx: 6, ry: 10, rot: 12 }, mirror: true }, // hand
  { ellipse: { cx: 100, cy: 361, rx: 8.5, ry: 7 }, mirror: true }, // foot
];

const FRONT_SHAPES: ShapeDef[] = [
  ...SHARED_NEUTRAL,
  { ellipse: { cx: 98, cy: 279, rx: 8, ry: 7 }, mirror: true }, // knee
  // traps peeking over the shoulders
  { muscle: 'traps', mirror: true, d: 'M 93 44 Q 104 47 114 55 Q 104 59 96 58 Q 93 51 93 44 Z' },
  // chest
  {
    muscle: 'chest',
    mirror: true,
    d: 'M 88 61 Q 107 59 115 72 Q 119 85 111 96 Q 99 104 89 99 Q 86 79 88 61 Z',
  },
  // shoulders (drawn after chest so the cap sits on top)
  { muscle: 'shoulders', mirror: true, ellipse: { cx: 122.5, cy: 68, rx: 12, ry: 14, rot: 14 } },
  { muscle: 'biceps', mirror: true, ellipse: { cx: 124.5, cy: 108, rx: 9.5, ry: 19, rot: 13 } },
  { muscle: 'forearms', mirror: true, ellipse: { cx: 131, cy: 150, rx: 7.5, ry: 22, rot: 9 } },
  // abs + obliques
  { muscle: 'core', rect: { x: 72.5, y: 104, w: 25, h: 62, r: 11 } },
  {
    muscle: 'core',
    mirror: true,
    d: 'M 100 106 Q 107 108 109 114 Q 111 138 104 158 Q 100 161 98 156 Q 101 130 100 106 Z',
  },
  // quads
  {
    muscle: 'quads',
    mirror: true,
    d: 'M 89 178 Q 105 175 110 195 Q 114 233 104 264 Q 98 272 93 265 Q 88 220 89 178 Z',
  },
  // pelvis on top of the quads, like shorts
  { d: 'M 68 170 L 102 170 L 97 195 Q 85 203 73 195 Z' },
  // shins read as the lower-leg complex
  { muscle: 'calves', mirror: true, ellipse: { cx: 99.5, cy: 320, rx: 8, ry: 29, rot: 2 } },
];

const BACK_SHAPES: ShapeDef[] = [
  ...SHARED_NEUTRAL,
  { ellipse: { cx: 98, cy: 280, rx: 7, ry: 6 }, mirror: true }, // knee
  // full back slab (bottom layer — lats and traps paint over it)
  {
    muscle: 'back',
    d: 'M 66 60 L 104 60 Q 109 62 107 70 L 98 156 Q 85 166 72 156 L 63 70 Q 61 62 66 60 Z',
  },
  // lats
  {
    muscle: 'lats',
    mirror: true,
    d: 'M 91 90 Q 104 82 113 78 Q 119 97 113 121 Q 106 143 93 152 Q 88 122 91 90 Z',
  },
  // traps kite
  {
    muscle: 'traps',
    d: 'M 85 42 Q 97 47 112 56 Q 100 63 93 76 Q 87 88 85 92 Q 83 88 77 76 Q 70 63 58 56 Q 73 47 85 42 Z',
  },
  { muscle: 'shoulders', mirror: true, ellipse: { cx: 122.5, cy: 68, rx: 12, ry: 14, rot: 14 } },
  { muscle: 'triceps', mirror: true, ellipse: { cx: 124.5, cy: 108, rx: 9.5, ry: 19, rot: 13 } },
  { muscle: 'forearms', mirror: true, ellipse: { cx: 131, cy: 150, rx: 7.5, ry: 22, rot: 9 } },
  { muscle: 'glutes', mirror: true, ellipse: { cx: 96.5, cy: 186, rx: 12, ry: 14 } },
  {
    muscle: 'hamstrings',
    mirror: true,
    d: 'M 90 206 Q 104 203 108 221 Q 111 247 102 267 Q 97 273 92 266 Q 87 233 90 206 Z',
  },
  { muscle: 'calves', mirror: true, ellipse: { cx: 99.5, cy: 317, rx: 8.5, ry: 27, rot: 2 } },
];

// ─── Figure renderer ─────────────────────────────────────────────────────────

function Figure({
  shapes,
  heat,
  maxHeat,
  selected,
  onSelect,
  width,
}: {
  shapes: ShapeDef[];
  heat: Record<MuscleKey, number>;
  maxHeat: number;
  selected: MuscleKey | null;
  onSelect: (m: MuscleKey) => void;
  width: number;
}) {
  const renderShape = (shape: ShapeDef, key: string) => {
    const fill = shape.muscle
      ? heatColor(maxHeat > 0 ? heat[shape.muscle] / maxHeat : 0)
      : NEUTRAL;
    const isSelected = shape.muscle && shape.muscle === selected;
    const press = shape.muscle ? () => onSelect(shape.muscle!) : undefined;
    // Hairline stroke in the card color keeps adjacent same-heat muscles
    // reading as separate segments. onClick covers react-native-svg on web,
    // onPress covers native.
    const common = {
      fill,
      stroke: isSelected ? '#FFFFFF' : colors.surface,
      strokeWidth: isSelected ? 1.75 : 1.25,
      onPress: press,
      onClick: press,
    } as any;

    if (shape.d) return <Path key={key} d={shape.d} {...common} />;
    if (shape.rect) {
      const { x, y, w, h, r } = shape.rect;
      return <Rect key={key} x={x} y={y} width={w} height={h} rx={r} {...common} />;
    }
    const { cx, cy, rx, ry, rot } = shape.ellipse!;
    return (
      <Ellipse
        key={key}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
        {...common}
      />
    );
  };

  const rightShapes = shapes.filter((s) => s.mirror);
  const centerShapes = shapes.filter((s) => !s.mirror);

  return (
    <Svg width={width} height={width * (400 / 170)} viewBox="0 0 170 400">
      {centerShapes.map((s, i) => renderShape(s, `c${i}`))}
      {rightShapes.map((s, i) => renderShape(s, `r${i}`))}
      <G transform="translate(170,0) scale(-1,1)">
        {rightShapes.map((s, i) => renderShape(s, `l${i}`))}
      </G>
      {/* six-pack etching over the abs block (front figure only). The lines
          forward presses to the core so they don't swallow taps. */}
      {shapes === FRONT_SHAPES &&
        (() => {
          const pressCore = () => onSelect('core');
          const lineProps = {
            stroke: colors.surface,
            strokeWidth: 2,
            onPress: pressCore,
            onClick: pressCore,
          } as any;
          return (
            <G>
              <Line x1={85} y1={107} x2={85} y2={163} {...lineProps} />
              <Line x1={75} y1={123} x2={95} y2={123} {...lineProps} />
              <Line x1={75} y1={142} x2={95} y2={142} {...lineProps} />
            </G>
          );
        })()}
    </Svg>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export function MuscleHeatMap({
  stats,
  figureWidth = 136,
}: {
  stats: [string, number][];
  figureWidth?: number;
}) {
  const [selected, setSelected] = useState<MuscleKey | null>(null);

  const heat = useMemo(() => computeMuscleHeat(stats), [stats]);
  const maxHeat = Math.max(...ALL_MUSCLES.map((m) => heat[m]));
  const hasData = maxHeat > 0;

  const handleSelect = (m: MuscleKey) => setSelected((prev) => (prev === m ? null : m));

  const selectedHits = selected ? Math.round(heat[selected] * 10) / 10 : 0;

  return (
    <View>
      <View style={styles.figuresRow}>
        <View style={styles.figureCol}>
          <Figure
            shapes={FRONT_SHAPES}
            heat={heat}
            maxHeat={maxHeat}
            selected={selected}
            onSelect={handleSelect}
            width={figureWidth}
          />
          <Text style={styles.figureLabel}>FRONT</Text>
        </View>
        <View style={styles.figureCol}>
          <Figure
            shapes={BACK_SHAPES}
            heat={heat}
            maxHeat={maxHeat}
            selected={selected}
            onSelect={handleSelect}
            width={figureWidth}
          />
          <Text style={styles.figureLabel}>BACK</Text>
        </View>
      </View>

      <Text style={styles.caption}>
        {selected
          ? `${MUSCLE_LABELS[selected].toUpperCase()} · ${
              heat[selected] > 0 ? `${selectedHits}× this week` : 'not hit yet'
            }`
          : hasData
            ? 'Tap a muscle for details'
            : 'Complete a workout to light it up'}
      </Text>

      <View style={styles.legendRow}>
        <View style={[styles.legendSwatch, { backgroundColor: COLD }]} />
        <Text style={styles.legendLabel}>NOT HIT</Text>
        <LinearGradient
          colors={HEAT_STOPS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.legendBar}
        />
        <Text style={styles.legendLabel}>MAX</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  figureCol: {
    alignItems: 'center',
  },
  figureLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2.5,
    marginTop: spacing.xs,
  },
  caption: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typography.base,
    color: colors.primaryLight,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendSwatch: {
    width: 14,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  legendBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
});
