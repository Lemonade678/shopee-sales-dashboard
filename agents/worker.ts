/**
 * Runs a single worker agent: a bounded Claude tool-use loop over the worker's
 * granted tools. Returns the worker's final text report to the Manager.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AgentDefinition } from "./registry";
import { makeExecutor, schemasFor, type Window } from "./tools";

const MODEL = "claude-opus-4-8";
const MAX_STEPS = 8;

function textOf(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runWorker(
  client: Anthropic,
  def: AgentDefinition,
  task: string,
  win: Window,
  log: (line: string) => void
): Promise<string> {
  const execute = makeExecutor(win, def.name);
  const tools = schemasFor(def.tools);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Task from your manager:\n${task}\n\nUse your tools to investigate, then record findings with save_insight and give me a 2-3 sentence summary.` },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = (await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: def.systemPrompt,
      tools,
      messages,
    } as any)) as Anthropic.Message;

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") return textOf(res) || "(no summary)";

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      log(`    · ${def.name} → ${block.name}`);
      let out: string;
      try {
        out = await execute(block.name, block.input);
      } catch (e: any) {
        out = JSON.stringify({ error: String(e?.message ?? e) });
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return `${def.name} hit the step limit before finishing.`;
}
