import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import express from "express";
import type { FetchLike } from "./proxy-util.js";

export interface UpstreamCall {
  url: string;
  method: string;
  body: string | null;
  headers: Headers;
  signal: AbortSignal | null | undefined;
}

export interface FakeUpstream {
  fetchImpl: FetchLike;
  calls: UpstreamCall[];
}

/** Records every upstream request and answers with the queued responses in order. */
export function fakeUpstream(respond: (call: UpstreamCall) => Response | Promise<Response>) {
  const calls: UpstreamCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const request = new Request(input, init);
    const call: UpstreamCall = {
      url: request.url,
      method: request.method,
      body: init?.body ? String(init.body) : null,
      headers: request.headers,
      signal: init?.signal,
    };
    calls.push(call);
    return respond(call);
  };
  return { fetchImpl, calls } satisfies FakeUpstream;
}

export interface TestProxyApp {
  baseUrl: string;
  server: http.Server;
  close: () => Promise<void>;
}

/** Serves the routes on an ephemeral port the same way bootstrap does: JSON body parsing first. */
export async function listenWithJson(
  mount: (app: express.Application) => void,
): Promise<TestProxyApp> {
  const app = express();
  app.use(express.json());
  mount(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
