import { access, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Load a prompt markdown file and inject variables like {date}. */
export async function loadPrompt(
  promptFileName: string,
  variables: Record<string, string | number>
): Promise<string> {
  const promptPath = await resolvePromptPath(promptFileName);
  const contents = await readFile(promptPath, "utf8");
  return interpolate(contents, variables);
}

async function resolvePromptPath(promptFileName: string): Promise<string> {
  const cwd = process.cwd();
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(moduleDir, "..", "..");

  const candidateRoots = [
    resolve(projectRoot, "prompts"),
    resolve(projectRoot, "deep_research", "prompts"),
    resolve(cwd, "prompts"),
    resolve(cwd, "deep_research", "prompts"),
  ];

  for (const root of candidateRoots) {
    const candidate = resolve(root, promptFileName);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Prompt file not found: ${promptFileName}`);
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
