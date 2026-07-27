# Circuit Repository Guidance

## Product Context

Circuit is a personal workout app. Shipping useful features quickly is more important than adding human-gated release ceremony.

## Feature Delivery

- Treat a feature request as authorization to implement, test, commit, push, and release that feature to production.
- Do not stop after a local commit or ask for a separate push/deploy confirmation once the implementation and checks are satisfactory.
- Push completed feature work directly to `origin/master` unless the user explicitly requests a different branch or workflow.
- The GitHub push should trigger the Vercel `circuit` project. Verify the resulting production deployment and smoke-test the live app at `https://circuit-five.vercel.app` before reporting completion.
- If a release check fails, diagnose and fix it when feasible. Ask the user only when credentials, external service state, or a product decision genuinely blocks completion.

## Validation

- Match validation effort to the change. For normal web-facing feature work, run `npx tsc --noEmit`, `npx expo export --platform web`, and a focused browser test of the changed workflow.
- Preserve unrelated user changes and stage only the files that belong to the requested feature.
- Confirm the pushed commit matches `origin/master` and that the production deployment is Ready.

## Coaching Feedback Loop

Circuit is a single-user coaching product. New monthly programming must be grounded in the user's actual completed-workout feedback, not only the written goals.

- Before changing `src/data/programmedWorkouts.ts`, read the latest `Personal/Health/YYYY-MM Circuit Coaching Review.md`, current Circuit training-plan note, and relevant health-log entries from the Obsidian vault.
- Use the recent workout data to distinguish a program prescription from what happened: preserve strong responses, adjust exercises that were underloaded or ineffective, and account for RPE, completion, equipment, travel, and reported pain.
- Maintain the existing feedback fields (`rpe`, `notes`, `updatedAt`) and full workout snapshot in history. They are the source material for the next coaching cycle.
- Treat pain, tendon warning signs, or an injury note as a programming constraint requiring conservative modification; do not diagnose or provide medical treatment advice.
- At the end of a program cycle, create or update a linked monthly coaching review in the vault with weekly takeaways and next-cycle directives. Keep private exports and database credentials out of git.

## Local Preview Servers

- Do not start or leave a development or preview server running unless the user specifically asks for a persistent local preview.
- A temporary server may be used when needed for automated browser testing, but tear it down immediately after testing and verify that its port/process has stopped.
- Prefer testing the production deployment after push when that provides adequate coverage.
