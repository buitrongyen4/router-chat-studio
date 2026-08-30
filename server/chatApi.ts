import type { Express, Response } from "express";
import { providerEndpoint } from "../shared/chatUtils";

type ProviderType = "router-openai" | "openai" | "anthropic" | "custom";

type ConnectionConfig = {
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  customProtocol?: "openai" | "anthropic";
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

let activeConnection: ConnectionConfig | null = null;

function cleanBaseUrl(input: string) {
  return input.trim().replace(/\/+$/, "");
}

function usesAnthropicProtocol(config: ConnectionConfig) {
  return config.provider === "anthropic" || (config.provider === "custom" && config.customProtocol === "anthropic");
}

function authHeaders(config: ConnectionConfig): Record<string, string> {
  if (usesAnthropicProtocol(config)) {
    return {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      accept: "application/json",
      "content-type": "application/json",
    };
  }
  return {
    authorization: `Bearer ${config.apiKey}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "Request cancelled.";
  if (error instanceof Error) return error.message.replace(/(?:sk|key|token)[-_]?[a-z0-9_-]{8,}/gi, "[redacted]");
  return "The provider request could not be completed.";
}

function sanitizedConnection(config: ConnectionConfig | null) {
  if (!config) return null;
  return {
    name: config.name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    hasApiKey: Boolean(config.apiKey),
  };
}

export function buildOpenAIRequestBody(messages: ChatMessage[], model: string, stream = true) {
  return { model, messages, stream };
}

export function buildAnthropicRequestBody(messages: ChatMessage[], model: string, stream = true) {
  const system = messages.find(message => message.role === "system")?.content;
  const turns = messages.filter(message => message.role !== "system").map(message => ({ role: message.role, content: message.content }));
  return { model, max_tokens: 4096, ...(system ? { system } : {}), messages: turns, stream };
}

async function fetchModels(config: ConnectionConfig) {
  const response = await fetch(providerEndpoint(config.baseUrl, "models"), {
    headers: authHeaders(config),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? "Authentication failed" : `Provider returned ${response.status}`;
    throw new Error(`${status}. ${body.slice(0, 180)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The provider returned an unreadable model list.");
  }
  const items = Array.isArray(parsed) ? parsed : (parsed as { data?: unknown[] })?.data;
  if (!Array.isArray(items)) throw new Error("No model list was found at this endpoint.");
  return items
    .map(item => {
      if (typeof item === "string") return { id: item, ownedBy: "custom" };
      if (item && typeof item === "object" && "id" in item && typeof item.id === "string") {
        return { id: item.id, ownedBy: "owned_by" in item && typeof item.owned_by === "string" ? item.owned_by : "custom" };
      }
      return null;
    })
    .filter((item): item is { id: string; ownedBy: string } => Boolean(item));
}

async function probeConnection(config: ConnectionConfig) {
  const anthropic = usesAnthropicProtocol(config);
  const model = config.defaultModel || (anthropic ? "claude-3-haiku-20240307" : "gpt-4.1-mini");
  const messages: ChatMessage[] = [{ role: "user", content: "ping" }];
  const response = await fetch(providerEndpoint(config.baseUrl, anthropic ? "messages" : "chat/completions"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(anthropic ? buildAnthropicRequestBody(messages, model, false) : buildOpenAIRequestBody(messages, model, false)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text();
    const status = response.status === 401 || response.status === 403 ? "Authentication failed" : response.status === 404 ? "Model unavailable" : `Provider returned ${response.status}`;
    throw new Error(`${status}. ${body.slice(0, 180)}`);
  }
  return model;
}

function writeSse(res: Response, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamOpenAI(config: ConnectionConfig, messages: ChatMessage[], model: string, res: Response, signal: AbortSignal) {
  const upstream = await fetch(providerEndpoint(config.baseUrl, "chat/completions"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(buildOpenAIRequestBody(messages, model)),
    signal,
  });
  if (!upstream.ok || !upstream.body) throw new Error(`Provider returned ${upstream.status}. ${await upstream.text().then(text => text.slice(0, 180))}`);
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const dataLine = event.split("\n").find(line => line.startsWith("data:"));
      if (!dataLine) continue;
      const data = dataLine.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const text = parsed?.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) writeSse(res, { text });
      } catch {
        // Ignore non-JSON keep-alive frames from compatible providers.
      }
    }
  }
}

async function streamAnthropic(config: ConnectionConfig, messages: ChatMessage[], model: string, res: Response, signal: AbortSignal) {
  const upstream = await fetch(providerEndpoint(config.baseUrl, "messages"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(buildAnthropicRequestBody(messages, model)),
    signal,
  });
  if (!upstream.ok || !upstream.body) throw new Error(`Provider returned ${upstream.status}. ${await upstream.text().then(text => text.slice(0, 180))}`);
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const dataLine = event.split("\n").find(line => line.startsWith("data:"));
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine.slice(5).trim());
        const text = parsed?.delta?.text;
        if (typeof text === "string" && text) writeSse(res, { text });
      } catch {
        // Ignore provider-specific non-JSON frames.
      }
    }
  }
}

export function registerChatApi(app: Express) {
  app.get("/api/connection", (_req, res) => res.json({ connection: sanitizedConnection(activeConnection) }));

  app.post("/api/connection", (req, res) => {
    const { name, provider, baseUrl, apiKey, defaultModel, customProtocol } = req.body ?? {};
    if (!baseUrl || !provider) return res.status(400).json({ message: "Provider type and base URL are required." });
    if (typeof apiKey !== "string" || apiKey.trim().length < 1) return res.status(400).json({ message: "An API key is required for this session." });
    activeConnection = {
      name: typeof name === "string" && name.trim() ? name.trim() : "Primary connection",
      provider,
      baseUrl: cleanBaseUrl(baseUrl),
      apiKey: apiKey.trim(),
      defaultModel: typeof defaultModel === "string" ? defaultModel.trim() : "",
      customProtocol: customProtocol === "anthropic" ? "anthropic" : "openai",
    };
    res.json({ connection: sanitizedConnection(activeConnection) });
  });

  app.post("/api/connection/test", async (req, res) => {
    const { name, provider, baseUrl, apiKey, defaultModel, customProtocol } = req.body ?? {};
    if (!baseUrl || !provider || !apiKey) return res.status(400).json({ status: "error", message: "Provider type, base URL, and API key are required." });
    const config: ConnectionConfig = { name: name || "Test connection", provider, baseUrl: cleanBaseUrl(baseUrl), apiKey, defaultModel: defaultModel || "", customProtocol: customProtocol === "anthropic" ? "anthropic" : "openai" };
    try {
      try {
        const models = await fetchModels(config);
        res.json({ status: "connected", message: `Connected. ${models.length} models available.`, models, connection: sanitizedConnection(config) });
      } catch {
        const model = await probeConnection(config);
        res.json({ status: "connected", message: `Connected. Model listing unavailable; using ${model}.`, models: [], connection: sanitizedConnection(config) });
      }
    } catch (error) {
      res.status(502).json({ status: "error", message: safeErrorMessage(error) });
    }
  });

  app.get("/api/models", async (_req, res) => {
    if (!activeConnection) return res.status(400).json({ message: "Configure a connection before discovering models." });
    try {
      res.json({ models: await fetchModels(activeConnection) });
    } catch (error) {
      res.status(502).json({ message: safeErrorMessage(error) });
    }
  });

  app.post("/api/chat/stream", async (req, res) => {
    const config = activeConnection;
    const messages = req.body?.messages as ChatMessage[] | undefined;
    const model = typeof req.body?.model === "string" ? req.body.model : config?.defaultModel;
    if (!config) return res.status(400).json({ message: "Configure a connection before starting a chat." });
    if (!model) return res.status(400).json({ message: "Choose a model before sending a message." });
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ message: "A conversation is required." });

    const controller = new AbortController();
    res.on("close", () => controller.abort());
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    try {
      if (usesAnthropicProtocol(config)) await streamAnthropic(config, messages, model, res, controller.signal);
      else await streamOpenAI(config, messages, model, res, controller.signal);
      if (!res.writableEnded) {
        writeSse(res, { done: true });
        res.end();
      }
    } catch (error) {
      if (!res.writableEnded && !controller.signal.aborted) {
        writeSse(res, { error: safeErrorMessage(error) });
        res.end();
      }
    }
  });
}
