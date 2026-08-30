import { describe, expect, it } from "vitest";
import { buildMarkdownExport, normalizeBaseUrl, providerEndpoint } from "../shared/chatUtils";

describe("chat utilities", () => {
  it("normalizes provider base URLs without duplicating /v1", () => {
    expect(normalizeBaseUrl(" http://localhost:9000/v1/// ")).toBe("http://localhost:9000/v1");
    expect(providerEndpoint("http://localhost:9000/v1", "models")).toBe("http://localhost:9000/v1/models");
    expect(providerEndpoint("https://api.example.com", "chat/completions")).toBe("https://api.example.com/v1/chat/completions");
  });

  it("keeps Markdown content and labels each turn", () => {
    const markdown = buildMarkdownExport({
      title: "Research notes",
      model: "claude-sonnet-4-6",
      messages: [
        { role: "user", content: "Summarize **this**." },
        { role: "assistant", content: "Here is the answer.\n\n```ts\nconst ok = true;\n```" },
      ],
    }, new Date("2026-08-26T00:00:00.000Z"));

    expect(markdown).toContain("# Research notes");
    expect(markdown).toContain("Model: claude-sonnet-4-6");
    expect(markdown).toContain("## You");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("```ts");
    expect(markdown).toContain("Summarize **this**.");
  });
});
