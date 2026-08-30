import { describe, expect, it } from "vitest";
import { buildAnthropicRequestBody, buildOpenAIRequestBody } from "./chatApi";
import { pruneEmptyStreamMessage } from "../shared/chatUtils";

describe("provider adapter contracts", () => {
  const messages = [
    { role: "system" as const, content: "Be concise." },
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi" },
  ];

  it("builds an OpenAI-compatible streaming payload", () => {
    expect(buildOpenAIRequestBody(messages, "gpt-4.1")).toEqual({ model: "gpt-4.1", messages, stream: true });
  });

  it("moves the system turn into the Anthropic-compatible system field", () => {
    expect(buildAnthropicRequestBody(messages, "claude-sonnet-4-6")).toEqual({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "Be concise.",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
      stream: true,
    });
  });

  it("removes an empty assistant placeholder after cancellation", () => {
    const result = pruneEmptyStreamMessage([
      { id: "u1", role: "user", content: "Hello" },
      { id: "a1", role: "assistant", content: "" },
    ], "a1");
    expect(result).toEqual([{ id: "u1", role: "user", content: "Hello" }]);
  });
});


type Route = (req: { body?: unknown }, res: { status: (code: number) => RouteResponse; json: (body: unknown) => RouteResponse }) => unknown;
type RouteResponse = { status: (code: number) => RouteResponse; json: (body: unknown) => RouteResponse };

function routeHarness() {
  const postRoutes = new Map<string, Route>();
  const app = {
    get: () => undefined,
    post: (path: string, route: Route) => postRoutes.set(path, route),
  };
  return { app, postRoutes };
}

function responseHarness() {
  let status = 200;
  let body: unknown;
  const response: RouteResponse = {
    status: (code: number) => { status = code; return response; },
    json: (next: unknown) => { body = next; return response; },
  };
  return { response, getStatus: () => status, getBody: () => body };
}

describe("connection route behavior", () => {
  it("returns discovered models from a compatible endpoint", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: "route-model", owned_by: "router" }] }), { status: 200 });
    const { app, postRoutes } = routeHarness();
    const { response, getStatus, getBody } = responseHarness();
    const { registerChatApi } = await import("./chatApi");
    registerChatApi(app as never);
    await postRoutes.get("/api/connection/test")?.({ body: { provider: "router-openai", baseUrl: "http://router.test/v1", apiKey: "session-secret", defaultModel: "route-model" } }, response);
    expect(getStatus()).toBe(200);
    expect(getBody()).toMatchObject({ status: "connected", models: [{ id: "route-model", ownedBy: "router" }] });
    globalThis.fetch = originalFetch;
  });

  it("falls back to a minimal chat probe when model listing is unavailable", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: string; headers: Headers }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body), headers: new Headers(init?.headers) });
      return calls.length === 1 ? new Response("not found", { status: 404 }) : new Response("{}", { status: 200 });
    };
    const { app, postRoutes } = routeHarness();
    const { response, getStatus, getBody } = responseHarness();
    const { registerChatApi } = await import("./chatApi");
    registerChatApi(app as never);
    await postRoutes.get("/api/connection/test")?.({ body: { provider: "custom", customProtocol: "anthropic", baseUrl: "http://custom.test/v1", apiKey: "session-secret", defaultModel: "claude-custom" } }, response);
    expect(getStatus()).toBe(200);
    expect(getBody()).toMatchObject({ status: "connected", models: [] });
    expect(calls[1]?.url).toContain("/messages");
    expect(calls[1]?.headers.get("x-api-key")).toBe("session-secret");
    expect(JSON.parse(calls[1]?.body || "{}")).toMatchObject({ model: "claude-custom", max_tokens: 4096, stream: false });
    globalThis.fetch = originalFetch;
  });

  it("sanitizes authentication failures without echoing the key", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("bad key sk-abcdefghijkl", { status: 401 });
    const { app, postRoutes } = routeHarness();
    const { response, getStatus, getBody } = responseHarness();
    const { registerChatApi } = await import("./chatApi");
    registerChatApi(app as never);
    await postRoutes.get("/api/connection/test")?.({ body: { provider: "openai", baseUrl: "http://provider.test/v1", apiKey: "sk-abcdefghijkl", defaultModel: "gpt-test" } }, response);
    expect(getStatus()).toBe(502);
    expect(JSON.stringify(getBody())).not.toContain("sk-abcdefghijkl");
    globalThis.fetch = originalFetch;
  });
});
