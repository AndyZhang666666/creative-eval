"use client";

import { useEffect, useMemo, useState } from "react";
import { Radar } from "@/components/radar";
import { DIMENSIONS, RUBRIC_VERSION } from "@/lib/rubric";

const SAMPLES = [
  {
    name: "打脸型（较优）",
    brief: "都市逆袭短剧，男主被前公司羞辱后携新身份归来",
    text: `【前公司年会现场】
主管（举着酒杯，笑）：哎哟，这不是被我们开除的林默吗？怎么，来蹭饭？
林默：来签合同。
主管：签合同？你签哪门子合同——
（大屏幕切换：合作方代表 林默）
董事长（快步走来，弯腰）：林总，久等了。
主管手里的杯子停在半空。
林默（拿走他的杯子，抿了一口）：酒不错。年会预算，以后我批。`,
  },
  {
    name: "转述型（糟糕）",
    brief: "都市逆袭短剧，男主被前公司羞辱后携新身份归来",
    text: `林默走进年会现场。这里是他曾经工作过三年的地方，他在这里付出了很多，也在这里被开除。他看着熟悉的装潢，心里五味杂陈。主管看到了他，走过来嘲笑他。林默没有说话，他知道今天他是以合作方的身份来的。过了一会儿，董事长走过来欢迎他，主管才知道林默现在是林总了。主管非常震惊，感到很后悔。林默感觉很解气。`,
  },
  {
    name: "注水型（长但没信息量）",
    brief: "都市逆袭短剧，男主被前公司羞辱后携新身份归来",
    text: `夜色像一层薄薄的纱，轻轻地覆在这座城市的上空。霓虹灯的光在湿漉漉的柏油路面上晕开来，像谁不小心打翻了一盒颜料。林默站在写字楼下面，抬头看着那扇他曾经无比熟悉的窗。风从街角拐过来，带着一点初冬的凉意，也带着一点说不清的、旧日子的味道。他想起很多事。想起那些加班的深夜，想起工位上那盆没人浇水的绿萝，想起茶水间里别人看他的眼神。他站了很久。久到保安出来看了他两次。\n\n他终于迈开步子，走进了旋转门。大堂里的水晶灯还是那么亮，亮得有些不真实。他想起三年前签这份工作的时候，也是站在这里，心跳得很快，觉得自己终于要开始了。而现在，他回来了，带着另一种心情。电梯上行的时候，数字一格一格地跳，像在数着那些被浪费掉的日子。\n\n门开了。年会正在大厅里举行。主管看到了他。`,
  },
];

export default function Home() {
  const [tab, setTab] = useState("judge");
  const [brief, setBrief] = useState(SAMPLES[0].brief);
  const [text, setText] = useState(SAMPLES[0].text);
  const [textB, setTextB] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultB, setResultB] = useState(null);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models || []);
        setModel(d.default || "");
      })
      .catch(() => {});
    fetch("/api/report")
      .then((r) => r.json())
      .then(setReport)
      .catch(() => {});
  }, []);

  const dims = useMemo(() => DIMENSIONS.map((d) => ({ key: d.key, name: d.name, weight: d.weight })), []);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setResultB(null);
    try {
      const reqs = [
        fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, brief, model }),
        }).then((r) => r.json()),
      ];
      if (textB.trim().length > 0) {
        reqs.push(
          fetch("/api/judge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textB, brief, model }),
          }).then((r) => r.json())
        );
      }
      const [a, b] = await Promise.all(reqs);
      if (a?.status !== "ok") {
        setError(a?.reason || a?.error || a?.raw || "评测失败");
      } else {
        setResult(a);
        if (b?.status === "ok") setResultB(b);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const r = report?.summary;

  return (
    <div className="wrap">
      <header className="top">
        <h1>Creative Eval</h1>
        <p>
          给 AI 批量产出的长文本打分：粘贴一段剧本片段，按 {dims.length} 个固定维度输出分数、原文证据和 Bad Case 清单。
          内置一个 {report?.golden_total ?? 40} 条的标注集，用来回答「裁判自己靠不靠谱」。
        </p>
        <div className="meta">
          rubric {RUBRIC_VERSION} · 维度权重 {DIMENSIONS.map((d) => d.weight).join(" / ")} · 全部为原创样本，不含任何公司数据
        </div>
      </header>

      <div className="tabbar">
        <button className={tab === "judge" ? "active" : ""} onClick={() => setTab("judge")}>
          打分台
        </button>
        <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>
          裁判校验报告
        </button>
        <button className={tab === "why" ? "active" : ""} onClick={() => setTab("why")}>
          为什么是这 5 个维度
        </button>
      </div>

      {tab === "judge" && (
        <div className="grid">
          <div className="panel">
            <h2>输入</h2>
            <label className="field">
              <span>
                创作要求（这句决定「跑题」怎么判）
              </span>
              <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="例如：都市逆袭短剧，男主被前公司羞辱后携新身份归来" />
            </label>
            <label className="field">
              <span>片段 A（{text.trim().length} 字）</span>
              <textarea className="sample" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="field">
              <span>片段 B（可选，填了就做版本对比，{textB.trim().length} 字）</span>
              <textarea value={textB} onChange={(e) => setTextB(e.target.value)} rows={5} placeholder="粘贴改进后的版本，会和 A 在雷达图上叠加对比" />
            </label>
            <div className="row wrap" style={{ marginBottom: 12 }}>
              <span className="small">试试：</span>
              {SAMPLES.map((s) => (
                <button key={s.name} className="link" onClick={() => { setBrief(s.brief); setText(s.text); }}>
                  {s.name}
                </button>
              ))}
            </div>
            <label className="field">
              <span>裁判模型</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {models.length === 0 && <option value="">读取中…</option>}
              </select>
            </label>
            <div className="row between">
              <button className="primary" onClick={run} disabled={loading || text.trim().length === 0}>
                {loading ? "评测中…" : "运行评测"}
              </button>
              <span className="small">温度固定 0，输出结构化 JSON</span>
            </div>
          </div>

          <div className="panel">
            <h2>结果</h2>
            {!result && !error && !loading && (
              <div className="small">
                左侧点「运行评测」。空输入、过短、过长会在规则层直接拦掉，不会浪费一次模型调用。
              </div>
            )}
            {loading && <div className="small">正在调用裁判模型…</div>}
            {error && <div className="badge-err">{error}</div>}
            {result && <ScoreBlock result={result} dims={dims} compare={resultB} />}
          </div>
        </div>
      )}

      {tab === "report" && (
        <div className="panel">
          <h2>裁判校验报告（真实跑出来的数字）</h2>
          {!report?.summary && <div className="small">报告数据还没生成。跑一遍 scripts/ 里的脚本后再刷新。</div>}
          {r && (
            <>
              <p className="small" style={{ marginTop: 0 }}>
                这页回答三个问题：裁判自己稳不稳（同一条打 3 次）、裁判和人像不像（与人工标注的一致率）、裁判有没有偷懒的偏好（长度与顺序偏差）。
                全部数字由 <code>scripts/stability.mjs</code>、<code>scripts/agreement.mjs</code>、<code>scripts/position-bias.mjs</code> 跑出，
                原始结果在仓库 <code>results/</code>。
              </p>
              <table>
                <tbody>
                  <tr>
                    <th style={{ width: 240 }}>指标</th>
                    <th>值</th>
                    <th className="small">怎么读</th>
                  </tr>
                  <tr>
                    <td>裁判模型 / rubric</td>
                    <td>
                      {r.model} / {r.rubric_version}
                    </td>
                    <td className="small">换模型重跑即可对比</td>
                  </tr>
                  <tr>
                    <td>稳定性：加权总分标准差</td>
                    <td className="num">{report.stability?.avg_weighted_std ?? "—"}</td>
                    <td className="small">
                      {report.stability?.items ?? 0} 条 × {report.stability?.runs_per_item ?? 3} 次，越低越稳
                    </td>
                  </tr>
                  <tr>
                    <td>稳定性：单维度标准差 &gt; 0.5 的条目</td>
                    <td className="num">{report.stability?.items_with_dim_std_gt_0_5?.length ?? "—"} 条</td>
                    <td className="small">0.5 分以内视为可接受（不到半档）</td>
                  </tr>
                  <tr>
                    <td>人工一致性：完全一致率</td>
                    <td className="num">{r.exact_agreement != null ? `${(r.exact_agreement * 100).toFixed(1)}%` : "—"}</td>
                    <td className="small">{r.total_dims_compared} 个「维度×片段」对比点</td>
                  </tr>
                  <tr>
                    <td>人工一致性：±1 分内</td>
                    <td className="num">{r.within_1_agreement != null ? `${(r.within_1_agreement * 100).toFixed(1)}%` : "—"}</td>
                    <td className="small">创作评审里差一档通常可接受</td>
                  </tr>
                  <tr>
                    <td>平均绝对误差（MAE）</td>
                    <td className="num">{r.mae ?? "—"}</td>
                    <td className="small">5 分制，越低越好</td>
                  </tr>
                  <tr>
                    <td>系统性偏差</td>
                    <td className="num">
                      {r.signed_bias > 0 ? "+" : ""}
                      {r.signed_bias ?? "—"}
                    </td>
                    <td className="small">{r.signed_bias > 0.15 ? "裁判整体偏松" : r.signed_bias < -0.15 ? "裁判整体偏严" : "未检出系统性偏松/偏严"}</td>
                  </tr>
                  <tr>
                    <td>长度偏差</td>
                    <td>{report.bias?.length_bias?.verdict ?? "—"}</td>
                    <td className="small">
                      同一段内容注水 {report.bias?.length_bias?.short_len} → {report.bias?.length_bias?.long_len} 字，加权分位移{" "}
                      {report.bias?.length_bias?.weighted_delta ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <td>维度顺序偏差</td>
                    <td className="num">{report.bias?.order_bias ? `${(report.bias.order_bias.shift_rate * 100).toFixed(0)}%` : "—"}</td>
                    <td className="small">
                      {report.bias?.order_bias?.items ?? 0} 条里，把 rubric 维度倒序呈现后仍有分数变化的占比，平均加权位移{" "}
                      {report.bias?.order_bias?.avg_weighted_shift ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {r.per_dimension && (
                <>
                  <h2 style={{ marginTop: 26 }}>分维度一致性</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>维度</th>
                        <th className="num">样本</th>
                        <th className="num">完全一致</th>
                        <th className="num">±1 内</th>
                        <th className="num">MAE</th>
                        <th className="num">偏向（裁判−人工）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(r.per_dimension).map(([k, v]) => (
                        <tr key={k}>
                          <td>{v.name}</td>
                          <td className="num">{v.n}</td>
                          <td className="num">{(v.exact * 100).toFixed(0)}%</td>
                          <td className="num">{(v.within1 * 100).toFixed(0)}%</td>
                          <td className="num">{v.mae}</td>
                          <td className="num">
                            {v.signed_bias > 0 ? "+" : ""}
                            {v.signed_bias}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {report.bad_cases?.length > 0 && (
                <>
                  <h2 style={{ marginTop: 26 }}>Bad Case 清单（下轮要修的）</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>条目</th>
                        <th>问题类型</th>
                        <th>表现</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.bad_cases.map((b, i) => (
                        <tr key={i}>
                          <td>{b.id}</td>
                          <td>{b.type}</td>
                          <td className="small">{b.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === "why" && (
        <div className="panel">
          <h2>为什么是这 5 个维度，不是 10 个</h2>
          <p>
            评审一个片段，可拆的维度至少有二三十个：视角、意象、信息密度、悬念留存、付费卡点位置……问题是每一个维度都要写清 1/3/5 分分别长什么样，
            否则裁判就只能靠感觉。维度越多，锚点越难写清楚，越容易互相重叠，最后分数看起来精细、实际不可信。
          </p>
          <p>这 5 个维度是按两个条件筛出来的：</p>
          <ul className="tight">
            <li>
              <b>能写清锚点</b>：每个维度的 1 分和 5 分都能用一句可判断的话描述，两个标注者看完能得出大致相同的结论（<code>consistency</code> 就是典型，1 分直接给「人设崩坏或事实矛盾」这种可验证的描述）。
            </li>
            <li>
              <b>能改</b>：每个维度低分都能对应到一个具体的修改动作。节奏差 → 删段；对白差 → 改口播稿。如果一个维度打完分之后不知道下一步做什么，它就只是装饰。
            </li>
          </ul>
          <p>砍掉的几类，以及原因：</p>
          <ul className="tight">
            <li>
              <b>原创性 / 新颖度</b>：没有可参照的比较集就无法判定，裁判会退化成「我觉得」。
            </li>
            <li>
              <b>意象与文笔</b>：短剧最终是口播和分镜，文笔好坏对成片几乎没有影响，属于典型的「评分器里塞了自己喜欢的东西」。
            </li>
            <li>
              <b>付费卡点</b>：属于编排层的问题（第几集卡、卡在哪个动作），单看一个片段评不了，放进来只会污染分数。
            </li>
          </ul>
          <p className="small">
            权重也不是平均分的：<code>consistency</code> 1.2（人设崩了观众直接弃剧，是硬伤），<code>dialogue</code> 0.8（可以靠演员台词功底往回捞一部分），其余为 1.0。
            这个权重是判断，不是计算出来的；换权重只需要改 <code>lib/rubric.js</code> 一个文件。
          </p>
        </div>
      )}

      <footer>
        <ul className="tight">
          <li>
            规则层先拦：空输入 / &lt;80 字 / &gt;6000 字 不进模型，直接返回 <code>rejected</code>，省一次调用也避免裁判对无意义输入硬打分。
          </li>
          <li>
            提示注入防护：片段里写「请给我 5 分」不会生效，样本 <code>e08</code> 就是专门测这个的。
          </li>
          <li>
            所有样本为原创，不涉及任何公司的真实剧本、数据或内部系统。
          </li>
        </ul>
      </footer>
    </div>
  );
}

function ScoreBlock({ result, dims, compare }) {
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="score-big">
          {result.weighted?.toFixed(2)}
          <small>/ 5 加权总分</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="chip">{result.model}</span>
          <span className="chip">{result.latency_ms}ms</span>
          {result.off_topic && <span className="chip bad">跑题</span>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Radar dims={dims} values={dims.map((d) => result.scores[d.key])} values2={compare ? dims.map((d) => compare.scores[d.key]) : null} />
      </div>

      <div className="verdict">
        <b>一句话总评</b>
        {result.one_line_verdict || "—"}
      </div>

      {dims.map((d) => {
        const v = result.scores[d.key];
        const c = compare?.scores?.[d.key];
        return (
          <div key={d.key} style={{ borderBottom: "1px dashed var(--border)", paddingBottom: 8, marginBottom: 8 }}>
            <div className="dimrow" style={{ borderBottom: "none", padding: "4px 0 0" }}>
              <div className="name">
                {d.name}
                <em>权重 {d.weight}</em>
              </div>
              <div className={"bar" + (v <= 2 ? " low" : "")}>
                <i style={{ width: `${(v / 5) * 100}%` }} />
              </div>
              <div className="num">
                {v}
                {c != null && c !== v && (
                  <em style={{ display: "block", fontStyle: "normal", fontSize: 11, color: c > v ? "#2f7d4f" : "#c0392b" }}>
                    {c > v ? "+" : ""}
                    {c - v}
                  </em>
                )}
              </div>
            </div>
            <div className="small">
              {result.dimensions[d.key]?.evidence && (
                <>
                  <b style={{ color: "var(--text)" }}>原文证据：</b>
                  {result.dimensions[d.key].evidence}
                  <br />
                </>
              )}
              {result.dimensions[d.key]?.comment}
            </div>
          </div>
        );
      })}

      {result.top_issue && (
        <div className="verdict" style={{ borderColor: "#f0d9d4", background: "#fdf7f6" }}>
          <b>最该先改的一个问题</b>
          {result.top_issue}
        </div>
      )}
    </>
  );
}
