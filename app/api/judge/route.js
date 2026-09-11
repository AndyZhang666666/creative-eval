import { NextResponse } from "next/server";
import { judge, DEFAULT_JUDGE_MODEL } from "@/lib/judge";
import { DIMENSIONS, RUBRIC_VERSION } from "@/lib/rubric";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const text = String(body?.text ?? "");
  const brief = String(body?.brief ?? "");
  const model = String(body?.model || DEFAULT_JUDGE_MODEL);

  try {
    const result = await judge({ text, brief, model });
    return NextResponse.json({ ...result, rubric: DIMENSIONS.map((d) => ({ key: d.key, name: d.name, weight: d.weight })), rubric_version: RUBRIC_VERSION });
  } catch (e) {
    return NextResponse.json({ status: "error", error: String(e.message || e) }, { status: 500 });
  }
}
