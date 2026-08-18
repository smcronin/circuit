---
name: program
description: Use this skill whenever Seth asks to create, revise, audit, or push monthly programmed workouts for the Circuit app. Trigger for phrases like "program August", "update the monthly program", "review workout programming", "avoid collisions", "act like a calisthenics coach", or "use last month's results to build next month." This skill is specifically for date-keyed Circuit app programming in src/data/programmedWorkouts.ts.
---

# Circuit Monthly Programming

Use this skill to act as a practical calisthenics and health-focused programming coach for the Circuit app. The goal is not just to fill calendar days; it is to make the month feel intentionally coached, varied, recoverable, and tied to Seth's current health and performance priorities.

## Current Context

Default user goals:
- Body composition, metabolic health, longevity, and LDL support are the top priorities.
- Climbing strength is useful, but climbing itself is mostly for fun and skill.
- Keep sessions high-return and compact.
- Preserve freshness: avoid same-feeling circuits day after day.

Default weekly structure:
- Monday: 30-minute strength/calisthenics.
- Tuesday: 30-minute strength/calisthenics.
- Wednesday: climbing warm-up plus optional antagonist/mobility snack.
- Thursday: 30-45 minute Zone 2 road-bike cardio plus optional mobility/conditioning snack.
- Friday: strength/calisthenics.
- Saturday: primary high-aerobic interval anchor, normally a controlled jump-rope VO2-max session.
- Sunday: climbing warm-up plus optional post-climb mobility.

Known equipment:
- Pull-up bar
- Adjustable light dumbbells, usually 22.5 lb or lighter
- 20 lb weight vest
- Gymnastics rings
- Yoga wheel
- Yoga mat
- Resistance bands
- Jump rope
- Road bike
- Hangboard when explicitly appropriate

User preferences:
- Start ordinary strength warm-ups with jump rope when feasible. Treat that warm-up rope as a fun body-temperature ramp, not interval conditioning or a substitute for the Saturday high-aerobic session.
- Hangboard max-hang style work is acceptable up to twice weekly when fingers feel good.
- Avoid repetitive same-pattern circuits, especially demanding unilateral leg work or high-skill calisthenics on adjacent days.
- Treat three controlled 50 lb kettlebell clean-and-press reps per side as established capacity as of August 2026. Program crisp submaximal triples with quiet catches, and use swings, hinges, carries, high pulls, rack work, and other kettlebell variations to broaden the stimulus instead of rebuilding toward a single-rep milestone.
- Seth responds well to purposeful novelty. Within the stable weekly anchors, give each strength day a distinct conjugate emphasis by rotating calisthenics skills, grips, joint angles, contraction types, unilateral/bilateral patterns, and trunk demands.

## Programming Principles

Use a coached monthly structure:
- Keep stable weekly anchors so the program is coherent.
- Use conjugate-style variation inside that structure: rotate exercise variations, joint prep, mobility patterns, grips, unilateral/bilateral emphasis, and trunk patterns.
- Keep recognizable movement-pattern coverage while changing the exercise selection and sequence enough that consecutive weeks do not feel like minor copies. Draw from pull-up and ring variations, dips and supports, lever and inversion progressions, climbing-specific body tension, kettlebell power and strength, posture work, and whole-body longevity training.
- Progress the month with clear phases such as base, build, density/intensification, deload, and peak/benchmark, unless the user asks for a different periodization model.
- Cover major movement patterns weekly: vertical/horizontal pull, push, hinge, squat/lunge, trunk anti-extension, trunk anti-rotation/lateral flexion, loaded/support positions, aerobic base, and mobility.
- Prefer variation by movement pattern, not random novelty. A new exercise should have a job.
- Avoid adjacent-day collisions:
  - No repeated demanding exact exercise on consecutive days.
  - No repeated high-skill unilateral squat pattern on consecutive days.
  - No repeated high-load finger/hangboard dose without at least one lower-intensity day between, unless it is a climbing warm-up primer.
  - If the same body region appears on adjacent days, change intensity, joint angle, contraction type, or purpose.
- Keep Wednesday/Sunday climbing warm-ups as preparation, not workouts.
- Keep Thursday Zone 2 boring and repeatable. Vary cooldown/mobility around it rather than turning it into intervals by default.
- Use Saturday as the primary high-aerobic interval slot because it is the most reliable opening. Wednesday after climbing may be a fallback when Saturday is missed, but never schedule duplicate interval workouts on both days.
- Program jump-rope VO2 work as controlled high-aerobic training, not all-out sprinting: approximately RPE 8/10, hard breathing with only a few words possible, and enough cadence control to complete the final interval without collapse. Heart rate may take 1-2 minutes to rise.
- Use basic low-bounce or alternating-foot skipping for interval sessions. Avoid boxer step because of prior arch sensitivity.
- Keep three minutes of walking or marching between 4x4-style work intervals. If foot, calf, Achilles, or knee discomfort appears, or coordination becomes the limiting factor, substitute fast low-impact step-ups or running/marching in place. Stop for sharp or escalating pain.
- Progress the first September exposure to 4 x 4 minutes only if both August 22 (4 x 2 minutes) and August 29 (4 x 3 minutes) were completed without foot, calf, Achilles, knee, or coordination problems. Thereafter, default to one 4 x 4 session weekly or every 7-10 days, backing off when recovery or symptoms warrant.

Warm-ups and cooldowns:
- Start strength and climbing warm-ups with jump rope or a clear no-rope substitute.
- Make warm-ups day-specific:
  - Monday: rope, wrist/finger/shoulder prep, hinge prep, trunk brace.
  - Tuesday: rope, ankle/hip prep, overhead/scap prep, squat patterning.
  - Friday: rope, thoracic/ring/crawl prep, trunk and support prep.
  - Climbing: rope, wrist/finger prep, scapular activation, active hang, hip/core movement.
- Make cooldowns day-specific:
  - Monday: forearms/lats/hamstrings.
  - Tuesday: quads/hip flexors/pecs/wrists.
  - Friday: hips/spine/breathing downshift.
  - Cardio: calves/hips/T-spine/breathing rotation across phases.
- For Saturday high-aerobic intervals, use approximately eight progressive warm-up minutes: brisk marching, ankle/calf preparation, and easy rope. Finish with approximately five minutes of easy walking, calf mobility, and breathing.

## Implementation Workflow

1. Gather inputs before changing the program:
   - User's latest notes, soreness/injury warnings, and goals.
   - Current app data export if provided.
   - Relevant health notes if the user asks to use the vault.
   - Existing `src/data/programmedWorkouts.ts`.

2. Inspect the current generated calendar:
   - Run `node scripts/audit-programming.js`.
   - Read any reported adjacent exact repeats, warm-up signatures, and main-session summaries.
   - Do not rely on eyeballing only one day.

3. Edit `src/data/programmedWorkouts.ts`:
   - Keep the `GeneratedWorkout` structure valid.
   - Keep programmed workouts routed through the normal review/timer/history flow; do not create a parallel logging path.
   - Support multiple workouts per day when useful.
   - Keep private backup JSON and local data out of git.

4. Re-run checks:
   - `node scripts/audit-programming.js`
   - `npx tsc --noEmit`
   - `npx expo export --platform web`

5. If the user asked to ship:
   - Check `git status --short --branch --ignored`.
   - Commit the focused program changes.
   - Push `master` so Vercel deploys.

## Review Checklist

Before finalizing a monthly program, confirm:
- The first week matches the user's immediate calendar and current body status.
- No adjacent main sessions repeat the same demanding exercise.
- Remaining strength days have distinct names, skill problems, exercise sequences, and joint angles rather than repeating a weekly template with small parameter changes.
- Monday and Tuesday are complementary, not copies.
- Friday is a second strength exposure with different angles and tissue stress.
- Warm-ups are varied but still recognizable and efficient.
- Cooldowns are varied and targeted to the day.
- Zone 2 remains a health anchor.
- Saturday is the single scheduled high-aerobic interval anchor, with no duplicate Wednesday interval session or same-day mobility snack.
- Jump-rope interval progression is gated by completion, stable coordination, and no foot, calf, Achilles, or knee warning signs.
- Climbing warm-ups prepare without stealing climbing performance.
- Deload week actually reduces intensity or complexity.
- The final week has a clear purpose without reckless peak loading.
