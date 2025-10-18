import type { Configuration } from "../shared/config.js";
import { DynamicStructuredTool } from "langchain/tools";

/**
 * Load MCP tools using LangChain MCP adapters when available.
 * This is optional and feature-flagged via cfg.mcp_config?.url.
 */
export async function loadMcpTools(cfg: Configuration): Promise<DynamicStructuredTool[]> {
  const url = cfg.mcp_config?.url ?? null;
  if (!url) return [];

  // Dynamic import of official LangChain MCP adapters package (runtime-only)
  let adapters: unknown = null;
  try {
    const packageName = "@langchain/mcp-adapters";
    adapters = await import(packageName);
  } catch (_e) {
    console.warn("[mcp] @langchain/mcp-adapters package not installed; skipping MCP tools");
    return [];
  }

  const MultiServerMCPClient = (adapters as any)?.MultiServerMCPClient;
  const load_mcp_tools = (adapters as any)?.load_mcp_tools ?? (adapters as any)?.loadMcpTools;
  if (!MultiServerMCPClient) {
    console.warn("[mcp] MCP client not found in adapters; skipping");
    return [];
  }

  // Build minimal server config; prefer streamable HTTP/SSE
  const servers: Record<string, any> = {
    server_1: {
      url,
      transport: url.startsWith("http") ? "streamable_http" : "stdio",
    },
  };

  try {
    const client = new MultiServerMCPClient({ mcpServers: servers });
    // Prefer client.get_tools(); fall back to load_mcp_tools(session) if exposed
    if (typeof client.get_tools === "function") {
      const tools = await client.get_tools();
      return Array.isArray(tools) ? tools : [];
    }
    if (load_mcp_tools && typeof load_mcp_tools === "function") {
      // Some adapters expose session-based tool loading
      const tools = await load_mcp_tools(client);
      return Array.isArray(tools) ? tools : [];
    }
  } catch (e) {
    console.warn("[mcp] Failed to load MCP tools:", (e as Error).message);
  }
  return [];
}


