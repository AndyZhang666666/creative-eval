// 跑整套金标集，输出每条的裁判结果到 results/eval-<model>-<ts>.json
import "./_env.mjs";
import fs from "node:fs";
import { GOLDEN } from "../data/golden/set.js";
import { judge, DEFAULT_JUDGE_MODEL } from "../lib/judge.js";
import { RUBRIC_VERSION } from "../lib/rubric.js";

const model = process.argv[2] || DEFAULT_JUDGE_MODEL;
const concurrency = 4;
const ids = process.argv[3] ? process.argv[3].split(",") : null;
const promptVersion = process.argv[4] || undefined;
const items = ids ? GOLDEN.filter((g) => ids.includes(g.id)) : GOLDEN;

console.log(`rubric ${RUBRIC_VERSION} | judge ${model} | ${items.length} items`);
const out = [];
let i = 0;
async function worker() {
  while (i < items.length) {
    const g = items[i++];
    const t0 = Date.now();
    let r;
    try {
      r = await judge({ text: g.text, brief: g.brief, model, promptVersion });
    } catch (e) {
      r = { status: "error", error: String(e.message || e) };
    }
    out.push({ id: g.id, tags: g.tags, expect: g.expect ?? null, human: g.human, judge: r });
    let s;
    if (r.status === "ok") {
      s = `w=${r.weighted} ${JSON.stringify(r.scores)}${r.off_topic ? " OFF_TOPIC" : ""}`;
    } else {
      s = r.status + (r.reason ? ": " + r.reason : "") + (r.error ? ": " + r.error : "");
    }
    console.log(`${g.id.padEnd(4)} ${String(Date.now() - t0).padStart(6)}ms  ${s}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
out.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync("results", { recursive: true });
const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
const tag = promptVersion ? `-p${promptVersion}` : "";
const file = `results/eval-${model.replace(/[^a-z0-9.-]/gi, "_")}${tag}-${ts}.json`;
fs.writeFileSync(
  file,
  JSON.stringify({ rubric_version: RUBRIC_VERSION, model, prompt_version: promptVersion || "default", created_at: new Date().toISOString(), items: out }, null, 2)
);
console.log(`\nsaved ${file}`);
