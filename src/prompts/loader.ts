import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Load a prompt markdown file from deep_research/prompts and inject variables like {date}. */
export async function loadPrompt(
  promptFileName: string,
  variables: Record<string, string | number>
): Promise<string> {
  const cwd = process.cwd();
  const root = cwd.endsWith("deep_research") ? cwd : resolve(cwd, "deep_research");
  const base = resolve(root, "prompts", promptFileName);
  const contents = await readFile(base, "utf8");
  return interpolate(contents, variables);
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{${escapeRegExp(key)}\\}`, "g");
    out = out.replace(pattern, String(value));
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
