"use client";

// 雷达图：纯 SVG 手写，不引图表库。
// 取舍：只有 5 个维度，一个雷达图不值得新增一个 200KB 的依赖，而且手写的可以精确控制坐标轴标签。
function Radar({ dims, values, values2 }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const r = 88;
  const n = dims.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, v) => [cx + Math.cos(angle(i)) * r * (v / 5), cy + Math.sin(angle(i)) * r * (v / 5)];
  const poly = (vals) => vals.map((v, i) => pt(i, v ?? 0).map((x) => Math.round(x * 10) / 10).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size + 10}`} width="100%" style={{ maxWidth: 300 }}>
      {[1, 2, 3, 4, 5].map((ring) => (
        <polygon
          key={ring}
          points={poly(new Array(n).fill(ring))}
          fill="none"
          stroke={ring === 5 ? "#d8d5cf" : "#eceae6"}
          strokeWidth="1"
        />
      ))}
      {dims.map((d, i) => {
        const [x, y] = [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#eceae6" strokeWidth="1" />;
      })}
      {values2 && (
        <polygon points={poly(values2)} fill="#c0392b18" stroke="#c0392b" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      <polygon points={poly(values)} fill="#1f1e1c1a" stroke="#1f1e1c" strokeWidth="1.8" />
      {values.map((v, i) => {
        const [x, y] = pt(i, v ?? 0);
        return <circle key={i} cx={x} cy={y} r="3" fill="#1f1e1c" />;
      })}
      {dims.map((d, i) => {
        const lx = cx + Math.cos(angle(i)) * (r + 26);
        const ly = cy + Math.sin(angle(i)) * (r + 22);
        return (
          <text
            key={d.key}
            x={lx}
            y={ly}
            fontSize="11.5"
            fill="#78736c"
            textAnchor={Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end"}
            dominantBaseline="middle"
          >
            {d.name}
          </text>
        );
      })}
    </svg>
  );
}

function ScorePanel({ result, dims, compare }) {
  const short = (k) => dims.find((d) => d.key === k);
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <div className="score-big">
            {result.weighted?.toFixed(2)}
            <small>/ 5 加权总分</small>
          </div>
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

      <div>
        {dims.map((d) => {
          const v = result.scores[d.key];
          const c = compare?.scores?.[d.key];
          return (
            <div className="dimrow" key={d.key} style={{ gridTemplateColumns: "92px 1fr 42px", paddingBottom: 4 }}>
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
              <div className="evidence" style={{ gridColumn: "1 / -1" }}>
                {result.dimensions[d.key]?.evidence && (
                  <>
                    <b>证据</b> {result.dimensions[d.key].evidence}
                    <br />
                  </>
                )}
                {result.dimensions[d.key]?.comment}
              </div>
            </div>
          );
        })}
      </div>

      {result.top_issue && (
        <div className="verdict" style={{ borderColor: "#f0d9d4", background: "#fdf7f6" }}>
          <b>最该先改的一个问题</b>
          {result.top_issue}
        </div>
      )}
    </>
  );
}


export { Radar, ScorePanel };
