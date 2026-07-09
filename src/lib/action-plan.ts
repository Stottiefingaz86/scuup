import { ANALYSIS_AREA_LABELS } from "./constants";
import { toObservation, type ActionPlan, type Project, type Recommendation } from "./types";

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["fix_now", "improve_next", "strategic_bet"],
          },
          title: { type: "string" },
          description: { type: "string" },
          area: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          effort: { type: "string", enum: ["high", "medium", "low"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          owner: { type: "string" },
          evidence: { type: "string" },
        },
        required: [
          "type",
          "title",
          "description",
          "area",
          "impact",
          "effort",
          "confidence",
          "owner",
          "evidence",
        ],
      },
    },
  },
  required: ["recommendations"],
} as const;

/** Compact text digest of every successful analysis, for the planner. */
function digestProject(project: Project): { text: string; count: number } {
  const lines: string[] = [];
  let count = 0;
  for (const brand of project.brands) {
    const who =
      brand.role === "own_brand"
        ? `${brand.name} (THE CLIENT — actions are for this brand)`
        : `${brand.name} (competitor)`;
    for (const a of Object.values(brand.analyses)) {
      if (a.blocked) continue;
      count += 1;
      const label = ANALYSIS_AREA_LABELS[a.area] ?? a.area;
      lines.push(`\n## ${who} — ${label} — score ${a.score}/100`);
      if (a.summary) lines.push(a.summary);
      for (const h of a.heuristics) {
        lines.push(`- ${h.name}: ${h.score} — ${h.note}`);
      }
      for (const o of a.observations.slice(0, 6)) {
        lines.push(`- Observed: ${toObservation(o).text}`);
      }
      for (const n of a.retentionNotes ?? []) {
        if (n.improve) lines.push(`- Retention gap (${n.key}): ${n.improve}`);
      }
    }
  }
  return { text: lines.join("\n"), count };
}

/** Synthesise a prioritised action plan from every real analysis in the
 * project. Pure text call — no screenshots — so it's fast and cheap. */
export async function buildActionPlan(project: Project): Promise<ActionPlan> {
  const { text, count } = digestProject(project);
  if (count === 0) {
    throw new Error(
      "No successful analyses yet — run the agent on at least one area first."
    );
  }
  const own = project.brands.find((b) => b.role === "own_brand");

  const prompt = `You are PlayerScope, an elite iGaming CX strategist. Below are the real analysed findings for ${own?.name} and its competitors in the ${project.market} market. Turn them into a prioritised action plan FOR ${own?.name} ONLY.

${text}

Produce 6-10 recommendations. Rules:
- Every recommendation must trace back to something actually observed above — put the specific finding (with the brand name, e.g. "Stake shows ...") in "evidence". Never invent findings.
- "type": fix_now = low/medium effort with high impact (ship this quarter); improve_next = needs product/design/dev effort (roadmap); strategic_bet = bigger directional play (executive decision).
- "title": imperative and specific (max 8 words), e.g. "Lead the hero with rakeback value".
- "description": 1-2 sentences on what to change and why it wins, written for a product team.
- "area": the analysis area key the action belongs to (one of: ${Object.keys(ANALYSIS_AREA_LABELS).join(", ")}), or "cross_journey".
- "owner": the team best placed to own it (Product, Design, CRM, Payments, VIP, Content, Engineering).
- "impact"/"effort"/"confidence": your honest read. Confidence is high only when the evidence was directly observed on ${own?.name} or a competitor; medium/low when partly inferred.
- Prioritise closing the gaps where competitors visibly outscore ${own?.name}, and stealing patterns that demonstrably work for the leaders.`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "medium" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: {
        format: {
          type: "json_schema",
          name: "action_plan",
          schema: PLAN_SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message"
  );
  const raw = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!raw) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(raw) as {
    recommendations: Omit<Recommendation, "id">[];
  };

  return {
    generatedAt: new Date().toISOString(),
    basedOnAnalyses: count,
    recommendations: parsed.recommendations.map((r, i) => ({
      ...r,
      id: `rec-${i + 1}`,
    })),
  };
}
