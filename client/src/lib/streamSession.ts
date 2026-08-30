import { pruneEmptyStreamMessage } from "@shared/chatUtils";

export type StreamSessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type StreamPayload = { text?: string; error?: string; done?: boolean };

type StreamSessionOptions = {
  model: string;
  messages: StreamSessionMessage[];
  signal: AbortSignal;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  createId?: () => string;
  onUpdate: (messages: StreamSessionMessage[]) => void;
};

export async function runStreamSession({ model, messages, signal, endpoint = "/api/chat/stream", fetchImpl = fetch, createId = () => `assistant-${Date.now()}`, onUpdate }: StreamSessionOptions) {
  const assistantMessage: StreamSessionMessage = { id: createId(), role: "assistant", content: "", createdAt: Date.now() };
  let currentMessages = [...messages, assistantMessage];
  onUpdate(currentMessages);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: messages.map(message => ({ role: message.role, content: message.content })) }),
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "The chat request could not be started.");
    }
    if (!response.body) throw new Error("The provider did not return a stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find(item => item.startsWith("data:"));
        if (!line) continue;
        const payload = JSON.parse(line.slice(5).trim()) as StreamPayload;
        if (payload.error) throw new Error(payload.error);
        if (payload.text) {
          currentMessages = currentMessages.map(message => message.id === assistantMessage.id ? { ...message, content: message.content + payload.text } : message);
          onUpdate(currentMessages);
        }
      }
    }
    return currentMessages;
  } catch (error) {
    currentMessages = pruneEmptyStreamMessage(currentMessages, assistantMessage.id);
    onUpdate(currentMessages);
    throw error;
  }
}
