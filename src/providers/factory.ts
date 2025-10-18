import { CreateModelOptions, ChatModel } from "./types.js";
import type { BaseMessageLike } from "@langchain/core/messages";

// LangChain providers
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatFireworks } from "@langchain/community/chat_models/fireworks";
import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";
import { ChatXAI } from "@langchain/xai";

function stripProviderPrefix(modelId: string): string {
  return String(modelId || "").replace(/^(openai|anthropic|google|xai|fireworks|together):/i, "");
}

/** Create an OpenAI chat model via LangChain. */
export function createOpenAI(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const base: Record<string, unknown> = {
    model: stripProviderPrefix(options.modelId),
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
  };
  if (options.apiKey) base["apiKey"] = options.apiKey;
  const llm = new ChatOpenAI(base as any);
  return llm as unknown as ChatModel<BaseMessageLike, unknown>;
}

/** Create an Anthropic chat model via LangChain. */
export function createAnthropic(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const base: Record<string, unknown> = {
    model: stripProviderPrefix(options.modelId),
    topP: 1,
  };
  if (options.apiKey) base["apiKey"] = options.apiKey;
  if (options.baseUrl) base["baseURL"] = options.baseUrl;
  const llm = new ChatAnthropic(base as any);
  try {
    (llm as any).temperature = undefined;
  } catch {}
  return llm as unknown as ChatModel<BaseMessageLike, unknown>;
}

/** Create an Anthropic chat model with the long-context beta header enabled. */
export function createAnthropicWithLongContext(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const base: Record<string, unknown> = {
    model: stripProviderPrefix(options.modelId),
    clientOptions: { betas: ["context-1m-2025-08-07"] },
  };
  if (options.apiKey) base["apiKey"] = options.apiKey;
  const llm = new ChatAnthropic(base as any);
  return llm as unknown as ChatModel<BaseMessageLike, unknown>;
}

/** Create a Google Gemini chat model via LangChain. */
export function createGemini(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const base: Record<string, unknown> = { model: stripProviderPrefix(options.modelId) };
  if (options.apiKey) base["apiKey"] = options.apiKey;
  const llm = new ChatGoogleGenerativeAI(base as any);
  return llm as unknown as ChatModel<BaseMessageLike, unknown>;
}


/** Create a Fireworks chat model via LangChain community provider. */
export function createFireworks(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const model = stripProviderPrefix(options.modelId);
  const shortModel = model.includes("/") ? model.split("/").pop()! : model;
  // Prefer native ChatFireworks first
  try {
    const base: Record<string, unknown> = { model };
    if (options.apiKey) base["apiKey"] = options.apiKey;
    const llm = new ChatFireworks(base as any);
    return llm as unknown as ChatModel<BaseMessageLike, unknown>;
  } catch (_e) {
    // Fallback to OpenAI-compatible endpoint for Fireworks
    const base: Record<string, unknown> = {
      model: model.includes("/") ? model : shortModel,
      baseURL: options.baseUrl || "https://api.fireworks.ai/inference/v1",
    };
    if (options.apiKey) base["apiKey"] = options.apiKey;
    const llm = new ChatOpenAI(base as any);
    return llm as unknown as ChatModel<BaseMessageLike, unknown>;
  }
}

/** Create an xAI (Grok) chat model via LangChain. */
export function createXAI(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const base: Record<string, unknown> = { model: stripProviderPrefix(options.modelId) };
  if (options.apiKey) base["apiKey"] = options.apiKey;
  const llm = new ChatXAI(base as any);
  return llm as unknown as ChatModel<BaseMessageLike, unknown>;
}

/** Create a Together AI chat model (prefer native; fallback to OpenAI-compatible API). */
export function createTogether(options: CreateModelOptions): ChatModel<BaseMessageLike, unknown> {
  const togetherBase = options.baseUrl || "https://api.together.xyz/v1";
  try {
    const base: Record<string, unknown> = {
      model: stripProviderPrefix(options.modelId),
      baseURL: togetherBase,
    };
    if (options.apiKey) base["apiKey"] = options.apiKey;
    const llm = new ChatTogetherAI(base as any);
    if (typeof (llm as any).bindTools !== "function") {
      throw new Error("ChatTogetherAI missing bindTools; fallback to OpenAI-compatible");
    }
    return llm as unknown as ChatModel<BaseMessageLike, unknown>;
  } catch (_e) {
    const base: Record<string, unknown> = {
      model: stripProviderPrefix(options.modelId),
      baseURL: togetherBase,
      configuration: { baseURL: togetherBase } as any,
    };
    if (options.apiKey) base["apiKey"] = options.apiKey;
    const llm = new ChatOpenAI(base as any);
    return llm as unknown as ChatModel<BaseMessageLike, unknown>;
  }
}
