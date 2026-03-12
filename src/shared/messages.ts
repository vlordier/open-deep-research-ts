import type { BaseMessageLike } from "@langchain/core/messages";

export function messageContentToString(msg: BaseMessageLike | undefined): string {
  if (!msg) return "";
  const content = (msg as { content?: unknown })?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content as Array<{ text?: string }>;
    const text = parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
    if (text) return text;
  }
  if (content && typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch {
      // ignore serialization failure
    }
  }
  return String(content ?? "");
}

export function findLastAssistantMessage(messages: BaseMessageLike[]): BaseMessageLike | undefined {
  return messages
    .slice()
    .reverse()
    .find((message) => (message as { role?: unknown })?.role === "assistant");
}

export function extractTextFromResponse(resp: unknown): string {
  if (resp && typeof resp === "object") {
    const content = (resp as { content?: unknown }).content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      const parts = content as Array<{ text?: string }>;
      const text = parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
      return text.trim();
    }
    return String(content ?? "").trim();
  }
  return String(resp ?? "").trim();
}

