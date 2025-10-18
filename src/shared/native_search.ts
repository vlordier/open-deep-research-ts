import type { AIMessage } from "@langchain/core/messages";

export function openaiWebsearchCalled(msg: AIMessage | undefined): boolean {
  if (!msg) return false;
  const anyMsg: any = msg as any;
  // Mirror Python: additional_kwargs.tool_outputs contains web_search_call
  try {
    const toolOutputs = anyMsg?.additional_kwargs?.tool_outputs;
    if (Array.isArray(toolOutputs)) {
      for (const t of toolOutputs) {
        if (t && typeof t === "object" && String((t as any).type || "").toLowerCase() === "web_search_call") {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

export function anthropicWebsearchCalled(msg: AIMessage | undefined): boolean {
  if (!msg) return false;
  const anyMsg: any = msg as any;
  // Mirror Python: response_metadata.usage.server_tool_use.web_search_requests > 0
  try {
    const usage = anyMsg?.response_metadata?.usage;
    const serverToolUse = usage?.server_tool_use;
    const webSearchRequests = serverToolUse?.web_search_requests;
    if (typeof webSearchRequests === "number" && webSearchRequests > 0) return true;
  } catch {}
  return false;
}

export function hasNativeWebsearch(msg: AIMessage | undefined): boolean {
  return openaiWebsearchCalled(msg) || anthropicWebsearchCalled(msg);
}


