// 与人工标注的一致性：把金标集的人工分和裁判分对齐，算一致率。
// 口径写清楚（这是 PM 的活）：
//   1) 完全一致率：维度分完全相同
//   2) 相邻一致率：差值 <= 1 分（1-5 分制下，"差一档"在创作评审里通常可接受）
//   3) 加权一致率：所有维度合并统计的加权平均一致率，权重与 rubric 一致
//   4) 每条片段的加权总分偏差
import "./_env.mjs";
import fs from "node:fs";
import { GOLDEN } from "../data/golden/set.js";
import { DIMENSIONS, RUBRIC_VERSION, weightedScore } from "../lib/rubric.js";

const file = process.argv[2] || "results/latest.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

// 只统计有人工标注的条目
const pairs = [];
for (const item of data.items) {
  const g = GOLDEN.find((x) => x.id === item.id);
  if (!g?.human || item.judge?.status !== "ok") continue;
  for (const d of DIMENSIONS) {
    pairs.push({ id: item.id, dim: d.key, weight: d.weight, human: g.human[d.key], judge: item.judge.scores[d.key] });
  }
}

const exact = pairs.filter((p) => p.human === p.judge).length / pairs.length;
const within1 = pairs.filter((p) => Math.abs(p.human - p.judge) <= 1).length / pairs.length;
const wExact = pairs.reduce((a, p) => a + p.weight * (p.human === p.judge ? 1 : 0), 0) / pairs.reduce((a, p) => a + p.weight, 0);
const wWithin1 = pairs.reduce((a, p) => a + p.weight * (Math.abs(p.human - p.judge) <= 1 ? 1 : 0), 0) / pairs.reduce((a, p) => a + p.weight, 0);
const mae = pairs.reduce((a, p) => a + Math.abs(p.human - p.judge), 0) / pairs.length;

// 系统性偏差：裁判是否整体偏松/偏严
const signed = pairs.reduce((a, p) => a + (p.judge - p.human), 0) / pairs.length;

// 分维度看
const perDim = {};
for (const d of DIMENSIONS) {
  const sub = pairs.filter((p) => p.dim === d.key);
  perDim[d.key] = {
    name: d.name,
    n: sub.length,
    exact: Math.round((sub.filter((p) => p.human === p.judge).length / sub.length) * 1000) / 1000,
    within1: Math.round((sub.filter((p) => Math.abs(p.human - p.judge) <= 1).length / sub.length) * 1000) / 1000,
    mae: Math.round((sub.reduce((a, p) => a + Math.abs(p.human - p.judge), 0) / sub.length) * 100) / 100,
    signed_bias: Math.round((sub.reduce((a, p) => a + (p.judge - p.human), 0) / sub.length) * 100) / 100,
  };
}

// 每条的总分偏差
const itemRows = [];
for (const item of data.items) {
  const g = GOLDEN.find((x) => x.id === item.id);
  if (!g?.human || item.judge?.status !== "ok") continue;
  itemRows.push({
    id: item.id,
    human_weighted: weightedScore(g.human),
    judge_weighted: item.judge.weighted,
    delta: Math.round((item.judge.weighted - weightedScore(g.human)) * 100) / 100,
  });
}
const maxAbsDelta = itemRows.length ? Math.max(...itemRows.map((r) => Math.abs(r.delta))) : 0;

const summary = {
  rubric_version: RUBRIC_VERSION,
  source: file,
  model: data.model,
  labeled_items: new Set(pairs.map((p) => p.id)).size,
  total_dims_compared: pairs.length,
  exact_agreement: Math.round(exact * 1000) / 1000,
  within_1_agreement: Math.round(within1 * 1000) / 1000,
  weighted_exact_agreement: Math.round(wExact * 1000) / 1000,
  weighted_within_1_agreement: Math.round(wWithin1 * 1000) / 1000,
  mae: Math.round(mae * 100) / 100,
  signed_bias: Math.round(signed * 100) / 100,
  max_item_weighted_delta: Math.round(maxAbsDelta * 100) / 100,
  per_dimension: perDim,
};

console.log(JSON.stringify(summary, null, 2));
console.log("\n总分偏差最大的条目：");
itemRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8).forEach((r) => console.log(`${r.id}  人工 ${r.human_weighted}  裁判 ${r.judge_weighted}  偏差 ${r.delta > 0 ? "+" : ""}${r.delta}`));

fs.mkdirSync("results", { recursive: true });
fs.writeFileSync("results/agreement.json", JSON.stringify({ summary, item_rows: itemRows, pairs }, null, 2));
console.log("\nsaved results/agreement.json");
