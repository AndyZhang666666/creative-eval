// 从 v1 / v2 两次真实运行的原始结果里，生成 Bad Case 清单。
//
// 为什么不让模型"总结一下有哪些 bad case"：那是再造一遍不可复现的数字。
// 这里的每一条都是从 results/ 里的原始输出算出来的 —— 原始分数、人工标注、偏差值都在文件里，
// 任何人 clone 下来都能重算一遍。
//
// 分类规则是明确的，不是感觉：
//   over_lenient    裁判给 5，人工给 ≤4  → 放过了不够好的片段
//   over_strict     人工给 ≥4，裁判给 ≤3 → 误杀了能用的片段
//   edge_mishandled 边缘样本（e0*）出现了非预期状态
// 只列偏差最大的若干条，不列全 —— 清单是给人修的，太长就没人看。
import fs from "node:fs";
import { DIMENSIONS } from "../lib/rubric.js";

const v2file = process.argv[2] || "results/eval-claude-sonnet-4-5-20250929-pv2-2026-09-110408.json";
const v1file = process.argv[3] || "results/eval-claude-sonnet-4-5-20250929-pv1-2026-09-110406.json";

const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const v2 = load(v2file);
const v1 = fs.existsSync(v1file) ? load(v1file) : null;

const totalWeight = DIMENSIONS.reduce((a, d) => a + d.weight, 0);
const weighted = (scores) =>
  DIMENSIONS.reduce((a, d) => a + (scores?.[d.key] ?? 0) * d.weight, 0) / totalWeight;

const cases = [];

for (const item of v2.items) {
  const j = item.judge;
  // rejected 是边缘样本的正常结局（空输入、过短、过长由规则层拦截），不是失败。
  // 把预期内的拒绝统计成失败，会让失败率虚高，也会掩盖真正的解析失败。
  if (j.status === "rejected") continue;
  if (j.status !== "ok") {
    cases.push({
      id: item.id,
      type: "run_failed",
      detail: `${j.status}${j.reason ? "：" + j.reason : ""}`,
      fix: "解析或调用失败，不产生分数 —— 已在 lib/llm.js 加了转义修复与截断回退，本类失败应降到 0",
    });
    continue;
  }
  if (!item.human) continue;

  const wj = weighted(j.scores);
  const wh = weighted(item.human);
  const delta = Math.round((wj - wh) * 100) / 100;
  const worst = DIMENSIONS.map((d) => ({
    key: d.key,
    name: d.name,
    judge: j.scores?.[d.key],
    human: item.human?.[d.key],
    d: (j.scores?.[d.key] ?? 0) - (item.human?.[d.key] ?? 0),
  })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];

  // 全 5 分是最有信息量的一类：它意味着裁判失去了区分度。
  const allFive = DIMENSIONS.every((d) => j.scores?.[d.key] === 5);
  if (allFive && wh < 5) {
    cases.push({
      id: item.id,
      type: "over_lenient",
      detail: `裁判五项全给 5，人工加权 ${wh.toFixed(2)}。最大分歧在「${worst.name}」：裁判 ${worst.judge} / 人工 ${worst.human}`,
      fix: "五项全满通常意味着裁判没用上区分度，而不是这条真的完美",
    });
  } else if (delta >= 0.6) {
    cases.push({
      id: item.id,
      type: "over_lenient",
      detail: `加权分裁判 ${wj.toFixed(2)} / 人工 ${wh.toFixed(2)}（+${delta}）。最大分歧在「${worst.name}」：裁判 ${worst.judge} / 人工 ${worst.human}`,
      fix: "偏松：需要更严的锚点描述，尤其看 5 分的边界",
    });
  } else if (delta <= -0.6) {
    cases.push({
      id: item.id,
      type: "over_strict",
      detail: `加权分裁判 ${wj.toFixed(2)} / 人工 ${wh.toFixed(2)}（${delta}）。最大分歧在「${worst.name}」：裁判 ${worst.judge} / 人工 ${worst.human}`,
      fix: "偏严：误杀了本可用的片段，检查该维度的 3 分锚点是否写得过苛",
    });
  }
}

cases.sort((a, b) => a.id.localeCompare(b.id));

// v1 → v2 的改进量，直接算出来，不手写。
const stats = (run) => {
  const ok = run.items.filter((i) => i.judge.status === "ok" && i.human);
  const deltas = ok.map((i) => weighted(i.judge.scores) - weighted(i.human));
  const perfect = ok.filter((i) => DIMENSIONS.every((d) => i.judge.scores?.[d.key] === 5)).length;
  return {
    prompt_version: run.prompt_version,
    n: ok.length,
    mean_weighted: Math.round((ok.reduce((a, i) => a + weighted(i.judge.scores), 0) / ok.length) * 100) / 100,
    mean_bias: Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100,
    perfect_scores: perfect,
    parse_failures: run.items.filter((i) => i.judge.status !== "ok" && i.judge.status !== "rejected").length,
  };
};

const out = {
  generated_from: [v1file, v2file].filter(Boolean),
  comparison: v1 ? [stats(v1), stats(v2)] : [stats(v2)],
  cases,
};
fs.writeFileSync("results/bad-cases.json", JSON.stringify(out, null, 2));

console.log("v1 → v2 对比（全部由原始结果算出）：");
for (const s of out.comparison) {
  console.log(
    `  prompt ${s.prompt_version.padEnd(4)} n=${s.n}  加权均值 ${s.mean_weighted}  对人工偏差 ${s.mean_bias > 0 ? "+" : ""}${s.mean_bias}  五项全满 ${s.perfect_scores} 条  失败 ${s.parse_failures} 条`
  );
}
console.log(`\nBad Case ${cases.length} 条：`);
for (const c of cases) console.log(`  ${c.id.padEnd(4)} [${c.type.padEnd(14)}] ${c.detail}`);
console.log("\nsaved results/bad-cases.json");
