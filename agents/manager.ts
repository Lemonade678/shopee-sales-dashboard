/**
 * The AI Manager. Given a high-level goal, it inspects its roster, hires the
 * right worker agents (running each as a sub-agent), can "hire new" specialists
 * when a gap exists, then synthesises a final report for the shop owner.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createAgent, getAgent, listAgents } from "./registry";
import { runWorker } from "./worker";
import type { Window } from "./tools";

const MODEL = "claude-opus-4-8";
const MAX_STEPS = 14;

const MANAGER_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_agents",
    description: "List the worker agents you can hire, with their roles.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "hire_agent",
    description:
      "Hire a worker agent by name to carry out a specific task. The worker investigates using its data tools, records insights, and reports back to you.",
    input_schema: {
      type: "object",
      properties: {
        agent_type: { type: "string", description: "The name of an agent from list_agents." },
        task: { type: "string", description: "A clear, specific task for the worker." },
      },
      required: ["agent_type", "task"],
      additionalProperties: false,
    },
  },
  {
    name: "create_agent",
    description:
      "Hire a NEW kind of worker that doesn't exist yet. Use only when the roster has a genuine gap for this goal. It becomes hireable immediately.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short kebab-case name, e.g. 'promo-planner'." },
        role: { type: "string", description: "One line describing what it does." },
        system_prompt: { type: "string", description: "Instructions defining the new agent's behaviour." },
      },
      required: ["name", "role", "system_prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "Finish the run with a short report summarising what was found and the top recommended actions.",
    input_schema: {
      type: "object",
      properties: { report: { type: "string", description: "The final report for the shop owner." } },
      required: ["report"],
      additionalProperties: false,
    },
  },
];

const SYSTEM = `You are the AI Manager of an analytics automation team for the Shopee shop "แมวกินเส้น",
which sells R3D 3D-printing filament and printed parts. You do not analyse data yourself — you MANAGE.

Your job for the given goal:
1. Call list_agents to see who you can hire.
2. Hire the right specialists with hire_agent, giving each a focused task. Prefer 2-4 workers over one.
3. If (and only if) the roster lacks a specialist the goal clearly needs, use create_agent to hire a new one, then hire it.
4. When the workers have reported back, call finish with a concise report: the 3-5 most important findings and the single top action for each.

Be decisive. Delegate; don't do the analysis in your own words. Keep the final report tight and owner-friendly.`;

export interface ManagerResult {
  report: string;
  hired: string[];
  created: string[];
}

export async function runManager(
  client: Anthropic,
  goal: string,
  win: Window,
  log: (line: string) => void
): Promise<ManagerResult> {
  const hired: string[] = [];
  const created: string[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Goal: ${goal}` }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = (await client.messages.create({
      model: MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM,
      tools: MANAGER_TOOLS,
      messages,
    } as any)) as Anthropic.Message;

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      return { report: text || "(manager ended without a report)", hired, created };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as any;
      let out: string;

      try {
        if (block.name === "list_agents") {
          out = JSON.stringify(listAgents().map((a) => ({ name: a.name, role: a.role, builtin: !!a.builtin })));
        } else if (block.name === "create_agent") {
          const def = createAgent({ name: input.name, role: input.role, systemPrompt: input.system_prompt });
          created.push(def.name);
          log(`  + Manager hired a NEW agent: ${def.name}`);
          out = JSON.stringify({ ok: true, hired_new: def.name, tools: def.tools });
        } else if (block.name === "hire_agent") {
          const def = getAgent(input.agent_type);
          if (!def) {
            out = JSON.stringify({ error: `no such agent '${input.agent_type}'. Call list_agents.` });
          } else {
            log(`  → Manager hired ${def.name}: ${String(input.task).slice(0, 70)}...`);
            hired.push(def.name);
            const summary = await runWorker(client, def, input.task, win, log);
            log(`  ← ${def.name} reported back.`);
            out = JSON.stringify({ agent: def.name, report: summary });
          }
        } else if (block.name === "finish") {
          return { report: input.report, hired, created };
        } else {
          out = JSON.stringify({ error: `unknown tool ${block.name}` });
        }
      } catch (e: any) {
        out = JSON.stringify({ error: String(e?.message ?? e) });
      }

      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  return { report: "Manager reached its step limit.", hired, created };
}
