import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { GOLDEN_STATS } from "@/data/golden/set";

export const runtime = "nodejs";

function readJson(file) {
  const p = path.join(process.cwd(), "results", file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// 把校验脚本的输出拼成一页报告。缺哪个就返回 null，页面显示"还没跑"。
export async function GET() {
  const stability = readJson("stability.json");
  const agreement = readJson("agreement.json");
  const bias = readJson("bias.json");
  const badCases = readJson("bad-cases.json");
  return NextResponse.json({
    golden_total: GOLDEN_STATS.total,
    golden_normal: GOLDEN_STATS.normal,
    golden_edge: GOLDEN_STATS.edge,
    summary: agreement?.summary || null,
    stability: stability?.summary || null,
    stability_rows: stability?.rows || null,
    bias: bias || null,
    bad_cases: badCases?.cases || null,
  });
}
