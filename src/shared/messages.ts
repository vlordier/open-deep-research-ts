import type { BaseMessageLike } from "@langchain/core/messages";

export function messageContentToString(msg: BaseMessageLike | undefined): string {
  if (!msg) return "";
  const anyMsg = msg as any;
  const c = anyMsg?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    // OpenAI-style content parts with text fields
    const text = c.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
    if (text) return text;
  }
  try {
    return JSON.stringify(c);
  } catch {
    return String(c ?? "");
  }
}

export function extractTextFromResponse(resp: unknown): string {
  const r: any = resp as any;
  const content = r?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const t = content.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
    return t.trim();
  }
  return String(content ?? "").trim();
}


