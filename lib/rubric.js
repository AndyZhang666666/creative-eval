// 评分维度定义。这是整个项目里最"产品"的一个文件：
// 维度是什么、为什么是这几个、每一档长什么样，全部写死在这里，裁判 prompt 直接从这里生成。
// 改维度 = 改这个文件 + 重跑金标集，不允许在 prompt 里偷偷加维度。

export const RUBRIC_VERSION = "v1.1";

export const DIMENSIONS = [
  {
    key: "hook",
    name: "开场钩子",
    weight: 1.0,
    question: "前 3 句话之内，有没有让人想继续往下看的东西（冲突、悬念、反差、危机）？",
    anchors: {
      1: "前 3 句全是铺垫或环境描写，没有任何冲突或悬念",
      3: "有冲突或悬念，但要读到 5-8 句才出现，或者力度平淡",
      5: "第 1-2 句就把冲突/反差/危机拍在读者脸上，让人必须往下读",
    },
  },
  {
    key: "pacing",
    name: "节奏推进",
    weight: 1.0,
    question: "每一段是否都在推进剧情？有没有原地打转、重复信息、大段无效对白？",
    anchors: {
      1: "超过一半篇幅在重复已知信息或空转，剧情几乎没有前进",
      3: "整体在推进，但有 1-2 处明显拖沓或可以整段删掉的内容",
      5: "每段都有新信息或新转折，删掉任何一段都会让剧情断裂",
    },
  },
  {
    key: "consistency",
    name: "人设与逻辑一致",
    weight: 1.2,
    question: "人物言行是否符合其身份设定？前后事实是否自洽（名字、关系、时间、地点、已发生的事）？",
    anchors: {
      1: "出现人设崩坏（如懦弱角色无铺垫突然强硬）或明显事实矛盾（名字/关系/时间对不上）",
      3: "人设基本稳，但有 1 处小的逻辑瑕疵或反应不够合理",
      5: "所有人物言行都能从设定推出来，事实链条完全自洽",
    },
  },
  {
    key: "payoff",
    name: "爽点/情绪释放",
    weight: 1.0,
    question: "有没有让观众产生情绪反应的时刻（打脸、反转、揭秘、逆袭、虐点）？释放前有没有足够的压抑铺垫？",
    anchors: {
      1: "没有任何情绪高点，或有高点但完全没有铺垫，显得莫名其妙",
      3: "有 1 个情绪释放点，铺垫和释放的比例大致合理",
      5: "至少 1 个强释放点，压抑—释放的节奏精准，观众会想截图或转发",
    },
  },
  {
    key: "dialogue",
    name: "对白口语度",
    weight: 0.8,
    question: "对白像不像真人说话？有没有书面语、解释性台词（把观众已经看到的事再说一遍）、翻译腔？",
    anchors: {
      1: "大量书面语或解释性台词，人物像在念旁白",
      3: "整体自然，但有 2-3 句明显不像人说的话",
      5: "每句对白都有说话人的个人语气，短、有潜台词，可以直接拿去拍",
    },
  },
];

// 硬性检查：不走 LLM，纯规则。这些情况直接判定为不合格，不参与打分。
// 原因：让 LLM 给一段空输入打 3 分是没有意义的，边界问题应该在裁判之前拦住。
export const HARD_CHECKS = {
  MIN_CHARS: 80,
  MAX_CHARS: 6000,
};

export function totalWeight() {
  return DIMENSIONS.reduce((s, d) => s + d.weight, 0);
}

export function weightedScore(scores) {
  const tw = totalWeight();
  const sum = DIMENSIONS.reduce((s, d) => s + (scores[d.key] ?? 0) * d.weight, 0);
  return Math.round((sum / tw) * 100) / 100;
}

// 供裁判 prompt 使用的维度说明文本
export function rubricText() {
  return DIMENSIONS.map((d, i) => {
    const anchors = Object.entries(d.anchors)
      .map(([k, v]) => `    ${k} 分：${v}`)
      .join("\n");
    return `${i + 1}. ${d.name}（key: ${d.key}）\n   问题：${d.question}\n   评分锚点：\n${anchors}`;
  }).join("\n\n");
}
