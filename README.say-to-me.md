# Paseo fork development

This fork keeps its development-only web integration in this file so rebasing
onto upstream stays narrow. The runtime change is limited to the root
`dev:app` command; shared scripts and CLI behavior remain upstream-compatible.

## Web app

Run `npm run dev:app` to start ordinary Expo on `http://localhost:6770`.
The app connects directly to the already-running daemon at
`127.0.0.1:6767`. This command does not start, stop, or restart a daemon.

Before using the app, `~/.paseo/config.json` must contain the exact origin
`http://localhost:6770` in `daemon.cors.allowedOrigins`. Changing that daemon
setting requires one authorized restart of the main daemon before the browser
can connect. Do not use `npm run dev:server` for this workflow.

`npm run cli -- ...` and `scripts/dev-home.sh` are unchanged; CLI commands
retain their checkout-local behavior.

The earlier same-origin proxy is intentionally not included. The daemon's
exact origin allowlist now permits the browser's direct WebSocket connection,
so a proxy would add a process and an internal Metro port without solving a
remaining compatibility problem.

## Boundaries

Say To Me code lives under `packages/app/src/say-to-me/`. Existing Paseo
files should contain only the smallest integration points needed to mount the
widget and play its notification sounds:

- `packages/app/src/panels/agent-panel.tsx` mounts `<SayToMeWidgetHost>`.
- `packages/app/src/composer/index.tsx` calls `playSendDing()` on submit and
  `useIdleCompletionDing()` to watch the active turn.

`packages/app/src/utils/send-ding.*` predates this convention and still lives
in `utils/`; new Say To Me sound/behavior files belong in `say-to-me/`
instead. Do not move general Paseo utilities into `say-to-me/` or modify
unrelated Paseo behavior for Say To Me features.

## Rebase Workflow

1. Start a new branch from the latest `origin/main`.
2. Keep new Say To Me files inside `packages/app/src/say-to-me/`.
3. Resolve conflicts in the small composer/agent-panel integration points
   first.
4. Run the focused tests and typecheck for changed files.
5. Review `git diff origin/main` and confirm no unrelated Paseo files
   changed.
