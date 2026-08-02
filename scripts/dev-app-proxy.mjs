import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const listenPort = Number(process.env.EXPO_PORT ?? "6770");
const metroPort = Number(process.env.PASEO_METRO_PORT ?? String(listenPort + 1));
const daemonPort = Number(process.env.PASEO_DEV_DAEMON_PORT ?? "6767");
const daemonHost = process.env.PASEO_DEV_DAEMON_HOST ?? "127.0.0.1";
const metroHost = "127.0.0.1";
const daemonPaths = ["/api/", "/mcp/", "/public/"];

function isDaemonPath(pathname) {
  return (
    pathname === "/api" ||
    pathname === "/mcp" ||
    pathname === "/public" ||
    daemonPaths.some((prefix) => pathname.startsWith(prefix))
  );
}

function proxyHeaders(headers, targetHost, origin) {
  return {
    ...headers,
    host: targetHost,
    ...(origin ? { origin } : {}),
  };
}

function proxyHttpRequest(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const daemon = isDaemonPath(url.pathname);
  const host = daemon ? daemonHost : metroHost;
  const port = daemon ? daemonPort : metroPort;
  const targetHost = `${host}:${port}`;
  const upstream = http.request({
    host,
    port,
    method: req.method,
    path: `${url.pathname}${url.search}`,
    headers: proxyHeaders(
      req.headers,
      targetHost,
      daemon ? `http://localhost:${daemonPort}` : undefined,
    ),
  });
  upstream.on("response", (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end();
  });
  req.pipe(upstream);
}

function proxyWebSocket(req, socket, head) {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  const daemon = pathname === "/ws" || pathname.startsWith("/ws/");
  const host = daemon ? daemonHost : metroHost;
  const port = daemon ? daemonPort : metroPort;
  const targetHost = `${host}:${port}`;
  const upstream = net.connect(port, host, () => {
    const headers = proxyHeaders(
      req.headers,
      targetHost,
      daemon ? `http://localhost:${daemonPort}` : undefined,
    );
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const item of value) lines.push(`${name}: ${item}`);
      } else if (value !== undefined) {
        lines.push(`${name}: ${value}`);
      }
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

const metro = spawn(
  process.env.npm_execpath ?? "npm",
  ["run", "start:expo", "--workspace=@getpaseo/app", "--", "--port", String(metroPort)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

const proxy = http.createServer(proxyHttpRequest);
proxy.on("upgrade", proxyWebSocket);
proxy.listen(listenPort, "127.0.0.1", () => {
  console.log(`  Proxy:   http://localhost:${listenPort}`);
  console.log(`  Metro:   http://localhost:${metroPort}`);
  console.log(`  Daemon:  http://${daemonHost}:${daemonPort}`);
});

function stop(signal) {
  metro.kill(signal);
  proxy.close(() => process.exit(0));
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
metro.once("exit", (code) => {
  if (code !== 0) process.exitCode = code ?? 1;
  proxy.close();
});
