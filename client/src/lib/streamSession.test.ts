import { describe, expect, it } from "vitest";
import { runStreamSession } from "./streamSession";

describe("runStreamSession", () => {
  it("removes an empty assistant placeholder when the user cancels", async () => {
    const controller = new AbortController();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const updates: Array<Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: number }>> = [];
    const stream = new ReadableStream<Uint8Array>({ start(stream) { streamController = stream; } });
    const fetchImpl: typeof fetch = async (_input, init) => {
      init?.signal?.addEventListener("abort", () => streamController?.error(new DOMException("The operation was aborted.", "AbortError")));
      return new Response(stream, { status: 200 });
    };

    const promise = runStreamSession({
      model: "gpt-test",
      messages: [{ id: "u1", role: "user", content: "Hello", createdAt: Date.now() }],
      signal: controller.signal,
      fetchImpl,
      createId: () => "a1",
      onUpdate: messages => updates.push(messages),
    });

    await Promise.resolve();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(updates.at(-1)).toEqual([{ id: "u1", role: "user", content: "Hello", createdAt: expect.any(Number) }]);
  });
});
