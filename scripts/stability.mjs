// 裁判稳定性：同一输入打 3 次，看维度分数的方差。
// 温度固定为 0 也不代表结果确定 —— 这是 LLM-as-judge 最容易被面试官问到的点。
import "./_env.mjs";
import fs from "node:fs";
import { GOLDEN } from "../data/golden/set.js";
import { judge, DEFAULT_JUDGE_MODEL } from "../lib/judge.js";
import { DIMENSIONS, RUBRIC_VERSION } from "../lib/rubric.js";

const model = process.argv[2] || DEFAULT_JUDGE_MODEL;
const runs = Number(process.argv[3] || 3);
// 默认取分布覆盖度好的一批，不必跑满 40 条 ×N 次
const ids = process.argv[4] ? process.argv[4].split(",") : ["g01", "g05", "g09", "g14", "g19", "g26", "e04", "e06", "e07", "e08"];
const items = GOLDEN.filter((g) => ids.includes(g.id));

console.log(`稳定性测试 | rubric ${RUBRIC_VERSION} | judge ${model} | ${items.length} 条 × ${runs} 次`);
const rows = [];

const jobs = [];
for (const g of items) for (let r = 0; r < runs; r++) jobs.push({ g, r });
let cursor = 0;
const raws = new Map(items.map((g) => [g.id, []]));
async function worker() {
  while (cursor < jobs.length) {
    const { g } = jobs[cursor++];
    const res = await judge({ text: g.text, brief: g.brief, model });
    if (res.status === "ok") raws.get(g.id).push(res.scores);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

for (const g of items) {
  const scoresList = raws.get(g.id);
  const perDim = {};
  let maxStd = 0;
  for (const d of DIMENSIONS) {
    const vals = scoresList.map((s) => s[d.key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    perDim[d.key] = { vals, mean: Math.round(mean * 100) / 100, std: Math.round(std * 100) / 100, range: Math.max(...vals) - Math.min(...vals) };
    maxStd = Math.max(maxStd, std);
  }
  const wvals = scoresList.map((s) => DIMENSIONS.reduce((a, d) => a + s[d.key] * d.weight, 0) / DIMENSIONS.reduce((a, d) => a + d.weight, 0));
  const wmean = wvals.reduce((a, b) => a + b, 0) / wvals.length;
  const weightedStd = Math.sqrt(wvals.reduce((a, b) => a + (b - wmean) ** 2, 0) / wvals.length);
  rows.push({ id: g.id, runs: scoresList.length, perDim, max_dim_std: Math.round(maxStd*100)/100, weighted_mean: Math.round(wmean * 100) / 100, weighted_std: Math.round(weightedStd * 100) / 100 });
  console.log(`${g.id}  加权总分标准差 ${weightedStd.toFixed(2)}  单维度最大标准差 ${maxStd.toFixed(2)}`);
}

const avgWeightedStd = rows.reduce((a, r) => a + r.weighted_std, 0) / rows.length;
const perfectStable = rows.filter((r) => r.weighted_std === 0).length;
const summary = {
  rubric_version: RUBRIC_VERSION,
  model,
  runs_per_item: runs,
  items: rows.length,
  avg_weighted_std: Math.round(avgWeightedStd * 1000) / 1000,
  fully_stable_items: perfectStable,
  // 判定标准：单维度标准差 <= 0.5 视为可接受（1-5 分制下不到半档）
  items_with_dim_std_gt_0_5: rows.filter((r) => r.max_dim_std > 0.5).map((r) => r.id),
};
console.log("\n" + JSON.stringify(summary, null, 2));
fs.mkdirSync("results", { recursive: true });
fs.writeFileSync("results/stability.json", JSON.stringify({ summary, rows }, null, 2));
console.log("saved results/stability.json");
