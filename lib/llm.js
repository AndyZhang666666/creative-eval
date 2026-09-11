// 最小 LLM 客户端：只依赖 fetch，兼容 OpenAI Chat Completions 协议。
// 不引 SDK 的原因：这个项目只调一个接口，多一层依赖就多一层解释成本。

const BASE_URL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const API_KEY = process.env.LLM_API_KEY;

export async function chat({ model, messages, temperature = 0, maxTokens = 1500, timeoutMs = 60000 }) {
  if (!API_KEY) throw new Error("缺少 LLM_API_KEY，请在 .env 里配置");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${raw.slice(0, 300)}`);
    const data = JSON.parse(raw);
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string") throw new Error(`LLM 返回结构异常: ${raw.slice(0, 300)}`);
    return { content, usage: data.usage || null, finishReason: choice?.finish_reason || null };
  } finally {
    clearTimeout(timer);
  }
}

// 模型有时会把 JSON 包在 ``` 里，前后还带一句废话。剥壳 + 首尾大括号截取。
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("输出里找不到 JSON 对象");
  return JSON.parse(candidate.slice(start, end + 1));
}
