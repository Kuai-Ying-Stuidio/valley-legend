import type { StoryChapter } from "@/lib/storyline";

type ChapterContent = {
  title?: string;
  synopsis?: string;
  highlight?: string;
  objectives?: string[];
  unlocks?: string[];
  notes?: string;
};

type SupportedTranslation = "zh";

type ChapterTranslations = Partial<Record<SupportedTranslation, ChapterContent>>;

type LocalizedChapterContent = {
  title: string;
  synopsis: string;
  highlight?: string;
  objectives: string[];
  unlocks: string[];
  notes?: string;
};

const STORY_CHAPTER_TRANSLATIONS: Record<string, ChapterTranslations> = {
  "chapter-1": {
    zh: {
      title: "搬迁命令",
      synopsis: "房东递来租约账册，要求议会先把定居点收拾妥当，再谈后续计划。",
      highlight: "稳住第一批收成，日落前呈上干净整齐的账页。",
      objectives: [
        "介绍向日叶采集与木材锯制的基础操作。",
        "解释租期阶段如何与教学目标对应。",
        "引导玩家查看资源账本。",
      ],
      unlocks: [
        "开放教学浮层与阶段 0 的指令。",
        "标记 Terraced Fields 进入精细监管状态。",
      ],
      notes: "首次加载必定出现，用于统一租约术语。",
    },
  },
  "chapter-2": {
    zh: {
      title: "首次巡检",
      synopsis: "房东突击巡视，仔细核对向日叶库藏，让议会人人紧绷。",
      highlight: "展示目标与进度条如何体现真实的租金压力。",
      objectives: [
        "强调教学浮层中的完成度追踪。",
        "鼓励玩家执行第一条指令。",
        "介绍议会日志作为叙事信息源。",
      ],
      unlocks: [
        "章节结束后，向议会日志追加风味条目。",
        "允许阶段 0 在目标满足后推进。",
      ],
    },
  },
  "chapter-3": {
    zh: {
      title: "市集差事",
      synopsis: "房东催促前往夜市，暗示即将开放的商店机制。",
      highlight: "为即将上线的商店做好铺垫，但暂不解锁。",
      objectives: [
        "展示计划中的商店分类与货币。",
        "说明购买行为将来如何解锁技能或增益。",
      ],
      unlocks: [
        "商店界面在实现后标记为可探索。",
        "安排关于市集需求的特别租约日志条目。",
      ],
    },
  },
  "chapter-4": {
    zh: {
      title: "账册讲义",
      synopsis: "学者连夜开课，好让房东的会计别再盯得所有人透不过气。",
      highlight: "把灵感资源与叙事推进和解锁机会结合起来。",
      objectives: [
        "说明灵感账本与科研指令的重要性。",
        "铺垫提升生产效率的进阶技能。",
      ],
      unlocks: [
        "解锁 Archive Colloquium 指令指引。",
        "在前置条件达成后提示阶段 1 可用。",
      ],
    },
  },
  "chapter-5": {
    zh: {
      title: "信任之梁",
      synopsis: "房东要求先加固平台，才肯签字批准扩建许可。",
      highlight: "聚焦木材容量与结构升级之间的联动。",
      objectives: [
        "强调界面中容量升级的重要性。",
        "为商店里的仓储类购买做准备。",
      ],
      unlocks: [
        "开放 Reinforce Trusses 简报。",
        "部分揭示 Moonwater Archives 卷宗。",
      ],
    },
  },
  "chapter-6": {
    zh: {
      title: "夜市灯火",
      synopsis: "商贩聚集广场，房东要求将每笔潜在交易记录在案。",
      highlight: "介绍浏览商店并暗示即将上线的捆绑解锁。",
      objectives: [
        "展示购买记录如何记入租约义务。",
        "列举至少一项待后续章节解锁的高级图纸。",
      ],
      unlocks: [
        "在界面中开启商店预览（只读阶段）。",
        "解锁与市集访问相关的装饰性账目。",
      ],
    },
  },
  "chapter-7": {
    zh: {
      title: "季度审计",
      synopsis: "审计召唤迫使议会正式规划余烬配额与能量储备。",
      highlight: "让能量产出符合房东预期，并为科技解锁做准备。",
      objectives: [
        "教育玩家评估余烬支出与储蓄。",
        "引入文明等级需求的概念。",
      ],
      unlocks: [
        "提示阶段 2 的任务与解锁。",
        "揭示 Sky Harbor 区的租约条款。",
      ],
    },
  },
  "chapter-8": {
    zh: {
      title: "天空港宪章",
      synopsis: "外交使节带来条款，只要履行即可提升定居点声望。",
      highlight: "转向外交、贸易航线与未来技能的解锁。",
      objectives: [
        "说明全球项目如何影响文明排名。",
        "预告与跨峡协议相关的后期技能。",
      ],
      unlocks: [
        "完整解锁 Sky Harbor 区卷宗。",
        "排入针对外交升级的商店组合包。",
      ],
    },
  },
  "chapter-9": {
    zh: {
      title: "灿辉契据",
      synopsis: "一项雄心勃勃的基建交易承诺光辉发展，前提是余烬债务及时偿付。",
      highlight: "将大型项目与文明等级里程碑及房东期望连接起来。",
      objectives: [
        "引导玩家处理多资源投资决策。",
        "提倡为商店采购做长期规划。",
      ],
      unlocks: [
        "解锁 Radiant Aquifer 路线图叙事。",
        "推动文明等级迈向后期层级。",
      ],
    },
  },
  "chapter-10": {
    zh: {
      title: "租约续签",
      synopsis: "房东心满意足地数钱，议会得以谈判让整个山谷开放自主管理。",
      highlight: "庆祝主线完结，同时预告后续内容。",
      objectives: [
        "总结当前玩家可用的系统。",
        "鼓励通过不同租金策略再次挑战。",
      ],
      unlocks: [
        "标记教学剧情结束，同时保留可选任务。",
        "引出未来扩展的声望钩子。",
      ],
      notes: "作为进入自由模式或赛季内容的衔接节点。",
    },
  },
};

export function getLocalizedChapterContent(
  chapter: StoryChapter,
  language: "en" | "zh",
): LocalizedChapterContent {
  if (language === "zh") {
    const overrides = STORY_CHAPTER_TRANSLATIONS[chapter.id]?.zh;
    if (overrides) {
      return {
        title: overrides.title ?? chapter.title,
        synopsis: overrides.synopsis ?? chapter.synopsis,
        highlight: overrides.highlight ?? chapter.highlight,
        objectives: overrides.objectives ?? chapter.objectives,
        unlocks: overrides.unlocks ?? chapter.unlocks,
        notes: overrides.notes ?? chapter.notes,
      };
    }
  }

  return {
    title: chapter.title,
    synopsis: chapter.synopsis,
    highlight: chapter.highlight,
    objectives: chapter.objectives,
    unlocks: chapter.unlocks,
    notes: chapter.notes,
  };
}
