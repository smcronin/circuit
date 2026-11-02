# Circuit security controls

AI requests are paused as of November 2, 2026. The previous browser-side
provider integration exposed a credential through an Expo public environment
variable. The retired key must never be reused. Clearing an environment variable
does not remove it from already-built deployments, browser caches, or native apps;
provider revocation is essential.

## Release gate

Run `npm run security:test`, `npx tsc --noEmit`, and `npm run build:web`.
Vercel invokes `build:web`, which rejects recognizable literal credentials and
secret-bearing public variable names before export, then inspects all output
files and source maps for credentials and configured private environment values.
The scanner prints only locations and rule names, never matching secret values.
It fails if the output directory is absent, empty, or inaccessible.

This targeted scanner complements a maintained secret scanner such as Gitleaks;
it is not a comprehensive security audit. Review scanner changes carefully.
Git scanning alone misses values injected during builds. Obfuscation, minification,
an encrypted hosting setting, CORS, and a Referer header do not keep client-side
credentials private or authenticate a caller. Do not bypass a failed release gate.

## Requirements before restoring paid AI

- Provider key only in a server-side secret store, isolated by project and environment.
- Authenticate the owner on every AI request; the public app and a profile ID
  alone are not authentication. Use secure sessions, authorization, and CSRF
  protection as appropriate. Never replace the provider key with another shared
  secret embedded in the application.
- Persistent per-user and global rate/concurrency limits across server instances;
  request size limits, model allowlist, output-token cap, bounded timeout/retries.
- Verified OpenRouter key spending limit and expiry. Use organization guardrails
  where available to restrict models and aggregate spend. Alerts supplement a
  hard cap; they do not replace it. Review automatic credit top-ups separately.
- Default off without complete configuration. Failed auth, absent limits, or
  dependency failures must not allow unbounded paid requests.
- Test unauthenticated denial without spending, authorized behavior within the
  approved budget, built-artifact scans, and the live deployed workflow.

## Incident response

Revoke exposed credentials at the provider first. Inventory all environments,
branches, old deployment URLs and native builds, and every other project that
shared the key. Preserve sanitized timestamps, deployment IDs, key fingerprints,
request IDs and usage evidence. Never paste a full credential in a support ticket.
Request provider-side abuse investigation; hosting logs do not capture subsequent
direct calls made with a stolen key. Do not rewrite Git history as a substitute
for rotation or delete incident evidence before it has been preserved.

## Remaining scope

The paused AI integration does not establish comprehensive app authentication.
Existing history/context endpoints require a separate authorization review in
the laptop-wide audit. No new AI proxy is deployed by this containment patch.

References: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/),
[OpenRouter support](https://openrouter.ai/support),
[OpenRouter guardrails](https://openrouter.ai/docs/guides/features/guardrails/overview),
[Vercel support](https://vercel.com/help).
