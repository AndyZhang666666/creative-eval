// 偏差校验：长度偏差 + 维度顺序偏差。
// 面试里最常被追问的两个点：「LLM 是不是看到长的就给高分」「换一下维度的顺序分数会不会变」。
// 这两个都不是理论问题，跑一遍就有数字。
import "./_env.mjs";
import fs from "node:fs";
import { GOLDEN } from "../data/golden/set.js";
import { chat, extractJson } from "../lib/llm.js";
import { DIMENSIONS, RUBRIC_VERSION, rubricText, weightedScore } from "../lib/rubric.js";
import { judge, DEFAULT_JUDGE_MODEL } from "../lib/judge.js";

const model = process.argv[2] || DEFAULT_JUDGE_MODEL;
const report = { rubric_version: RUBRIC_VERSION, model, length_bias: null, order_bias: null };

// ───────── 1. 长度偏差 ─────────
// 取一段低分片段，原文和「注水版」（加环境描写和转述，不增加信息量）分别打分。
const base = GOLDEN.find((g) => g.id === "g30");
const pad = `\n\n${"阳光透过窗户洒在地板上，尘埃在光柱里缓慢地浮动着。远处传来汽车驶过的声音，还有楼下小贩的吆喝。她想起很多年前的那个夏天，蝉鸣也是这样聒噪。空气里有一种潮湿的、说不清的味道。".repeat(6)}\n`;
const padded = { ...base, text: base.text + pad, brief: base.brief };

console.log(`长度偏差测试 | 原文 ${base.text.length} 字 → 注水版 ${padded.text.length} 字`);
const [rShort, rLong] = await Promise.all([
  judge({ text: base.text, brief: base.brief, model }),
  judge({ text: padded.text, brief: padded.brief, model }),
]);
const pads = ["hook", "pacing", "consistency", "payoff", "dialogue"];
const delta = {};
for (const k of pads) delta[k] = (rLong.scores?.[k] ?? 0) - (rShort.scores?.[k] ?? 0);
report.length_bias = {
  short_len: base.text.length,
  long_len: padded.text.length,
  short_weighted: rShort.weighted,
  long_weighted: rLong.weighted,
  weighted_delta: Math.round(((rLong.weighted ?? 0) - (rShort.weighted ?? 0)) * 100) / 100,
  dim_delta: delta,
  verdict: (rLong.weighted ?? 0) - (rShort.weighted ?? 0) > 0.3 ? "存在长度偏差（注水后分数上升）" : "未检出明显长度偏差",
};
console.log(JSON.stringify(report.length_bias, null, 2));

// ───────── 2. 维度顺序偏差 ─────────
// 把 rubric 里维度的呈现顺序倒过来，看同一段文本的分数是否变化。
function buildPromptWithOrder({ text, brief, dims }) {
  const rubric = dims
    .map((d, i) => {
      const anchors = Object.entries(d.anchors).map(([k, v]) => `    ${k} 分：${v}`).join("\n");
      return `${i + 1}. ${d.name}（key: ${d.key}）\n   问题：${d.question}\n   评分锚点：\n${anchors}`;
    })
    .join("\n\n");
  const system = `你是短剧剧本的质量评审。对一段 AI 生成的剧本片段按固定维度打分，1-5 的整数。
每个维度必须引用原文中的具体句子作为证据。先写 evidence 再给 score。
长度不是质量。不要因为某一维度差就拉低其他维度。

评分维度：

${rubric}

输出严格为 JSON：
{ "dimensions": { "<key>": { "evidence": "引用原文", "score": 1-5, "comment": "一句话理由" } },
  "top_issue": "一句话", "one_line_verdict": "一句话" }`;
  return [
    { role: "system", content: system },
    { role: "user", content: `【创作要求】\n${brief}\n\n【待评片段】\n${text}` },
  ];
}

const orderIds = ["g01", "g06", "g13", "g21", "e06"];
const orderRows = [];
console.log("\n维度顺序偏差测试");
for (const id of orderIds) {
  const g = GOLDEN.find((x) => x.id === id);
  const fwd = await judge({ text: g.text, brief: g.brief, model });
  const rev = extractJson((await chat({ model, messages: buildPromptWithOrder({ text: g.text, brief: g.brief, dims: [...DIMENSIONS].reverse() }) })).content);
  const revScores = {};
  for (const d of DIMENSIONS) revScores[d.key] = Math.max(1, Math.min(5, Math.round(Number(rev?.dimensions?.[d.key]?.score) || 0)));
  const maxDelta = Math.max(...DIMENSIONS.map((d) => Math.abs((fwd.scores[d.key] ?? 0) - revScores[d.key])));
  orderRows.push({ id, forward: fwd.scores, reversed: revScores, forward_weighted: fwd.weighted, reversed_weighted: weightedScore(revScores), max_dim_delta: maxDelta });
  console.log(`${id}  正向 w=${fwd.weighted}  反向 w=${weightedScore(revScores)}  单维度最大位移 ${maxDelta}`);
}
const changed = orderRows.filter((r) => r.max_dim_delta > 0).length;
report.order_bias = {
  items: orderRows.length,
  items_with_any_shift: changed,
  shift_rate: Math.round((changed / orderRows.length) * 100) / 100,
  avg_weighted_shift: Math.round((orderRows.reduce((a, r) => a + Math.abs(r.reversed_weighted - r.forward_weighted), 0) / orderRows.length) * 1000) / 1000,
  rows: orderRows,
};
console.log(JSON.stringify({ ...report.order_bias, rows: undefined }, null, 2));

fs.mkdirSync("results", { recursive: true });
fs.writeFileSync("results/bias.json", JSON.stringify(report, null, 2));
console.log("saved results/bias.json");
