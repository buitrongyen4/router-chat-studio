export type MarkdownExportMessage = {
  role: "user" | "assistant";
  content: string;
};

export type MarkdownExportConversation = {
  title: string;
  model: string;
  messages: MarkdownExportMessage[];
};

export function normalizeBaseUrl(input: string) {
  return input.trim().replace(/\/+$/, "");
}

export function providerEndpoint(baseUrl: string, path: string) {
  const base = normalizeBaseUrl(baseUrl);
  return base.endsWith("/v1") ? `${base}/${path}` : `${base}/v1/${path}`;
}

export function pruneEmptyStreamMessage<T extends { id: string; role: string; content: string }>(messages: T[], messageId: string) {
  return messages.filter(message => message.id !== messageId || message.content.trim().length > 0);
}

export function buildMarkdownExport(conversation: MarkdownExportConversation, exportedAt = new Date()) {
  const lines = [
    `# ${conversation.title}`,
    "",
    `Model: ${conversation.model}`,
    `Exported: ${exportedAt.toLocaleString()}`,
    "",
    "---",
    "",
  ];
  conversation.messages.forEach(message => {
    lines.push(`## ${message.role === "user" ? "You" : "Assistant"}`);
    lines.push("");
    lines.push(message.content || "_");
    lines.push("");
  });
  return lines.join("\n");
}
