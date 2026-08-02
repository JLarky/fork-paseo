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
