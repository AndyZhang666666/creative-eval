import "./globals.css";

export const metadata = {
  title: "Creative Eval — 长文本创作产出评测台",
  description: "按固定维度给 AI 生成的长文本打分，输出雷达图、Bad Case 与版本对比。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
