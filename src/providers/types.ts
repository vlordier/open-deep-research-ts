/** Provider and model type definitions used by the factory. */
import type { BaseMessageLike } from "@langchain/core/messages";

export interface ProviderInitOptions {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface ModelInvokeOptions {
  [key: string]: unknown;
}

/** Minimal, typed chat model interface sufficient for wiring and tests. */
export interface ChatModel<M extends BaseMessageLike = BaseMessageLike, R = unknown> {
  /** Invoke the model with a list of message-like objects. */
  invoke(messages: M[], options?: ModelInvokeOptions): Promise<R>;
  /** Optional LangChain tool binding API (when available on the underlying model). */
  bindTools?: (tools: unknown[], options?: Record<string, unknown>) => ChatModel<M, R>;
}

/** Options passed to provider-specific constructors. */
export interface CreateModelOptions extends ProviderInitOptions {
  modelId: string;
}
