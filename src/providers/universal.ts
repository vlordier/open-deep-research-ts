import { initChatModel } from "langchain/chat_models/universal";
import type { ChatModel } from "./types.js";

/**
 * Create a universal chat model using LangChain's provider-agnostic initializer.
 * Suitable for most providers; keep specialized factories for edge cases
 * (e.g., Anthropic long-context beta headers, custom gateways).
 */
export async function createUniversalModel(
  modelId: string,
  options?: Record<string, unknown>
): Promise<ChatModel> {
  // Ensure modelId is a string and remove provider prefix if present
  const id = String(modelId || "");
  if (!id) {
    throw new Error(`Invalid modelId: ${modelId}`);
  }
  const modelName = id.includes(":") ? id.split(":")[1] : id;

  // Filter out undefined values which can confuse LangChain
  const cleanOptions: Record<string, any> = {};
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null) {
        cleanOptions[key] = value;
      }
    }
  }

  // Model creation with filtered options
  // Return the underlying LC ChatModel to preserve methods like bindTools
  const llm = (await initChatModel(modelName, cleanOptions)) as unknown as ChatModel;
  return llm;
}


