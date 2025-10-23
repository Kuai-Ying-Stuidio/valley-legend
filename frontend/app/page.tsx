"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Brain, Flame, Hammer, Leaf, Moon, Mountain, Sun, Clock, Lock, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STORY_CHAPTERS, type StoryChapter, type StoryTrigger } from "@/lib/storyline";
import { getLocalizedChapterContent } from "@/lib/storyline-translations";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/language";

// Wails runtime imports
declare global {
  interface Window {
    go?: {
      main?: {
        SaveManager?: {
          SaveGame: (saveName: string, saveData: string) => Promise<void>;
          LoadGame: (saveName: string) => Promise<string>;
          GetAllSaves: () => Promise<string[]>;
          SetLastSave: (saveName: string) => Promise<void>;
          GetLastSave: () => Promise<string>;
          DeleteSave: (saveName: string) => Promise<void>;
        };
      };
    };
  }
}

type BlueprintCategory = "tools" | "items";
type NavigationPanel = "resources" | "facilities" | "council" | "crafting" | "story" | "citizens" | "settings";

type ResourceKey = "sunleaf" | "wood" | "stone" | "science" | "energy" | "execution";

type Resource = {
  key: ResourceKey;
  label: string;
  labelZh: string;
  amount: number;
  rate: number;
  capacity: number;
  icon: LucideIcon;
};

type IntroDialogueLine = {
  id: string;
  speaker: string;
  speakerZh: string;
  text: string;
  textZh: string;
};

type ResourceDelta = Partial<Record<ResourceKey, number>>;

type Action = {
  id: string;
  label: string;
  labelZh: string;
  description: string;
  descriptionZh: string;
  cost: string;
  costZh: string;
  cooldown: string;
  duration?: number;
  delta?: ResourceDelta;
  rateDelta?: Partial<Record<ResourceKey, number>>;
  capacityDelta?: Partial<Record<ResourceKey, number>>;
  log: string;
  logZh: string;
  requiredStage: number;
};

type District = {
  id: string;
  title: string;
  titleZh: string;
  focus: string;
  focusZh: string;
  description: string;
  descriptionZh: string;
  progress: number;
  stability: number;
  requiredStage: number;
  buildingCount: number;
  expansionCost: ResourceDelta;
  productionBoost: Partial<Record<ResourceKey, number>>;
  resourceTag?: ResourceKey;
};

type Recipe = {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  cost: ResourceDelta;
  craftTime: number;
  capacityBoost: number;
  requiredStage: number;
};

type ToolMaterial = "wooden" | "stone" | "celestial" | "alloy";

type ToolRecipe = {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  cost: ResourceDelta;
  craftTime: number;
  material: ToolMaterial;
  toolType: "saw" | "pickaxe" | "shears";
  harvestBonus: Partial<Record<ResourceKey, number>>;
  cooldownReduction: number;
  requiredStage: number;
};

type Facility = {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  cost: ResourceDelta;
  capacity: number;
  requiredStage: number;
};

type SkillType = "mining" | "gathering";

type Skill = {
  type: SkillType;
  name: string;
  nameZh: string;
  level: number;
  experience: number;
  maxLevel: number;
};

const SKILL_EXP_PER_LEVEL = 100;
const MAX_SKILL_LEVEL = 100;

const SKILL_RESOURCE_MAP: Record<ResourceKey, SkillType | null> = {
  sunleaf: "gathering",
  wood: "gathering",
  stone: "mining",
  science: null,
  energy: "gathering",
  execution: null,
};

const INITIAL_SKILLS: Skill[] = [
  {
    type: "mining",
    name: "Mining",
    nameZh: "采矿等级",
    level: 1,
    experience: 0,
    maxLevel: MAX_SKILL_LEVEL,
  },
  {
    type: "gathering",
    name: "Gathering",
    nameZh: "采集等级",
    level: 1,
    experience: 0,
    maxLevel: MAX_SKILL_LEVEL,
  },
];

const INITIAL_RESOURCES: Resource[] = [
  { key: "sunleaf", label: "Sunleaf", labelZh: "向日叶", amount: 0, rate: 0, capacity: 40, icon: Leaf },
  { key: "wood", label: "Timber", labelZh: "木材", amount: 0, rate: 0, capacity: 40, icon: Hammer },
  { key: "stone", label: "Stone", labelZh: "石料", amount: 0, rate: 0, capacity: 30, icon: Mountain },
  { key: "science", label: "Insight", labelZh: "灵感", amount: 0, rate: 0, capacity: 25, icon: Brain },
  { key: "energy", label: "Ember", labelZh: "余烬", amount: 0, rate: 0, capacity: 20, icon: Flame },
  { key: "execution", label: "Execution", labelZh: "执行力", amount: 0, rate: 0, capacity: 10, icon: Sparkles },
];

const RECIPES: Recipe[] = [
  {
    id: "storage-chest",
    name: "Storage Chest",
    nameZh: "储物箱",
    description: "Craft a sturdy chest to expand resource capacity.",
    descriptionZh: "制作坚固的箱子以扩大资源储量。",
    cost: { wood: -10 },
    craftTime: 60,
    capacityBoost: 10,
    requiredStage: 0,
  },
  {
    id: "reinforced-vault",
    name: "Reinforced Vault",
    nameZh: "加固库房",
    description: "A fortified vault for precious materials.",
    descriptionZh: "用于珍贵材料的加固库房。",
    cost: { wood: -20, stone: -15 },
    craftTime: 120,
    capacityBoost: 25,
    requiredStage: 2,
  },
];

const TOOL_RECIPES: ToolRecipe[] = [
  {
    id: "wooden-saw",
    name: "Wooden Saw",
    nameZh: "木质锯子",
    description: "A basic saw for harvesting timber more efficiently.",
    descriptionZh: "基础锯子，提高木材采集效率。",
    cost: { wood: -5 },
    craftTime: 30,
    material: "wooden",
    toolType: "saw",
    harvestBonus: { wood: 1 },
    cooldownReduction: 5,
    requiredStage: 0,
  },
  {
    id: "stone-saw",
    name: "Stone Saw",
    nameZh: "石质锯子",
    description: "A reinforced saw with stone teeth.",
    descriptionZh: "带有石齿的加固锯子。",
    cost: { wood: -8, stone: -6 },
    craftTime: 45,
    material: "stone",
    toolType: "saw",
    harvestBonus: { wood: 2 },
    cooldownReduction: 8,
    requiredStage: 1,
  },
  {
    id: "celestial-saw",
    name: "Celestial Saw",
    nameZh: "天梭锯子",
    description: "A mystical saw imbued with celestial energy.",
    descriptionZh: "注入天界能量的神秘锯子。",
    cost: { wood: -12, energy: -8 },
    craftTime: 60,
    material: "celestial",
    toolType: "saw",
    harvestBonus: { wood: 3 },
    cooldownReduction: 12,
    requiredStage: 2,
  },
  {
    id: "alloy-saw",
    name: "Alloy Saw",
    nameZh: "合金锯子",
    description: "An advanced saw forged from rare alloys.",
    descriptionZh: "由稀有合金锻造的先进锯子。",
    cost: { wood: -15, stone: -10, energy: -5 },
    craftTime: 90,
    material: "alloy",
    toolType: "saw",
    harvestBonus: { wood: 5 },
    cooldownReduction: 15,
    requiredStage: 3,
  },
  {
    id: "wooden-pickaxe",
    name: "Wooden Pickaxe",
    nameZh: "木质镐子",
    description: "A simple pickaxe for mining stone.",
    descriptionZh: "简易镐子，用于采石。",
    cost: { wood: -6 },
    craftTime: 30,
    material: "wooden",
    toolType: "pickaxe",
    harvestBonus: { stone: 1 },
    cooldownReduction: 5,
    requiredStage: 0,
  },
  {
    id: "stone-pickaxe",
    name: "Stone Pickaxe",
    nameZh: "石质镐子",
    description: "A durable pickaxe with a stone head.",
    descriptionZh: "带有石头的耐用镐子。",
    cost: { wood: -5, stone: -8 },
    craftTime: 45,
    material: "stone",
    toolType: "pickaxe",
    harvestBonus: { stone: 2 },
    cooldownReduction: 8,
    requiredStage: 1,
  },
  {
    id: "celestial-pickaxe",
    name: "Celestial Pickaxe",
    nameZh: "天梭镐子",
    description: "A radiant pickaxe blessed by the stars.",
    descriptionZh: "受星辰祝福的耀眼镐子。",
    cost: { wood: -8, stone: -10, energy: -6 },
    craftTime: 60,
    material: "celestial",
    toolType: "pickaxe",
    harvestBonus: { stone: 4 },
    cooldownReduction: 12,
    requiredStage: 2,
  },
  {
    id: "alloy-pickaxe",
    name: "Alloy Pickaxe",
    nameZh: "合金镐子",
    description: "A masterwork pickaxe of unmatched strength.",
    descriptionZh: "无与伦比的工艺镐子。",
    cost: { wood: -10, stone: -15, energy: -8 },
    craftTime: 90,
    material: "alloy",
    toolType: "pickaxe",
    harvestBonus: { stone: 6 },
    cooldownReduction: 15,
    requiredStage: 3,
  },
  {
    id: "wooden-shears",
    name: "Wooden Shears",
    nameZh: "木质剪刀",
    description: "Basic shears for harvesting sunleaf.",
    descriptionZh: "基础剪刀，用于收割向日叶。",
    cost: { wood: -4 },
    craftTime: 25,
    material: "wooden",
    toolType: "shears",
    harvestBonus: { sunleaf: 2 },
    cooldownReduction: 5,
    requiredStage: 0,
  },
  {
    id: "stone-shears",
    name: "Stone Shears",
    nameZh: "石质剪刀",
    description: "Sharpened shears with stone blades.",
    descriptionZh: "带有石刃的锋利剪刀。",
    cost: { wood: -6, stone: -5 },
    craftTime: 40,
    material: "stone",
    toolType: "shears",
    harvestBonus: { sunleaf: 4 },
    cooldownReduction: 8,
    requiredStage: 1,
  },
  {
    id: "celestial-shears",
    name: "Celestial Shears",
    nameZh: "天梭剪刀",
    description: "Ethereal shears that never dull.",
    descriptionZh: "永不铝化的虚灵剪刀。",
    cost: { wood: -8, stone: -6, energy: -5 },
    craftTime: 55,
    material: "celestial",
    toolType: "shears",
    harvestBonus: { sunleaf: 6 },
    cooldownReduction: 12,
    requiredStage: 2,
  },
  {
    id: "alloy-shears",
    name: "Alloy Shears",
    nameZh: "合金剪刀",
    description: "Precision shears crafted from advanced alloys.",
    descriptionZh: "由先进合金制成的精密剪刀。",
    cost: { wood: -10, stone: -8, energy: -6 },
    craftTime: 80,
    material: "alloy",
    toolType: "shears",
    harvestBonus: { sunleaf: 8 },
    cooldownReduction: 15,
    requiredStage: 3,
  },
];

const TOOL_MATERIAL_UNLOCK_STAGE: Record<ToolMaterial, number> = {
  wooden: 0,
  stone: 1,
  celestial: 2,
  alloy: 3,
};

const FACILITIES: Facility[] = [
  {
    id: "cabin",
    name: "Cabin",
    nameZh: "小屋",
    description: "A compact shelter providing housing for two tenants.",
    descriptionZh: "紧凑型居所，可供两名租户栖身。",
    cost: { wood: -20 },
    capacity: 2,
    requiredStage: 0,
  },
  {
    id: "city-hall",
    name: "City Hall",
    nameZh: "市政厅",
    description: "A central hub for recruiting and managing tenants.",
    descriptionZh: "招募与管理租户的中心枢纽。",
    cost: { sunleaf: -40, wood: -10 },
    capacity: 0,
    requiredStage: 0,
  },
];

const INITIAL_FACILITY_COUNTS: Record<string, number> = FACILITIES.reduce(
  (acc, facility) => {
    acc[facility.id] = 0;
    return acc;
  },
  {} as Record<string, number>,
);

const INTRO_DIALOGUE: IntroDialogueLine[] = [
  {
    id: "welcome-council",
    speaker: "Landlord",
    speakerZh: "房东",
    text: "Hey, kid, this land is now yours. You have to pay rent on time.",
    textZh: "小子，这块地可就交给你了，你可要定时上交租金。",
  },
  {
    id: "inspection-warning",
    speaker: "Landlord",
    speakerZh: "房东",
    text: "I'll be inspecting the rental this week. Remember to neatly stack the sunleaf and wood you've gathered.",
    textZh: "本周内便要验租。记得将采摘而得的向日叶和木头码放整齐。",
  },
  {
    id: "council-charge",
    speaker: "Me",
    speakerZh: "我",
    text: "I'll do my best to keep things in order here.",
    textZh: "是，我会好好管理这里的。",
  },
  {
    id: "begin-brief",
    speaker: "Me",
    speakerZh: "我",
    text: "Let's open the ledger brief and assign the first objectives.",
    textZh: "打开账本，安排第一批目标吧。",
  },
  {
    id: "landlord-expectations",
    speaker: "Landlord",
    speakerZh: "房东",
    text: "I expect the first rent payment on schedule. No excuses, no delays.",
    textZh: "我期待第一次租金按时交付。不要借口，不要拖延。",
  },
  {
    id: "councilor-assurance",
    speaker: "Me",
    speakerZh: "我",
    text: "I understand the terms. I'll ensure all quotas are met.",
    textZh: "明白。我会确保所有配额都达标。",
  },
  {
    id: "landlord-warning",
    speaker: "Landlord",
    speakerZh: "房东",
    text: "Good. Remember, I'm watching the ledgers closely. Don't disappoint me.",
    textZh: "很好。记住，我会仔细监控账目。别让我失望。",
  },
];

const DISTRICTS: District[] = [
  {
    id: "terraced-fields",
    title: "Terraced Fields",
    titleZh: "梯田农圃",
    focus: "Growth",
    focusZh: "增产",
    description: "Hydroponic sunleaf gardens shimmer under woven mirrors.",
    descriptionZh: "水耕向日叶在编织镜面下闪烁。",
    progress: 0,
    stability: 0,
    requiredStage: 0,
    buildingCount: 0,
    expansionCost: { sunleaf: -10, wood: -5 },
    productionBoost: { sunleaf: 0.5 },
    resourceTag: "sunleaf",
  },
  {
    id: "lumber-groves",
    title: "Lumber Groves",
    titleZh: "林场营地",
    focus: "Harvest",
    focusZh: "采伐",
    description: "Timber crews tend coppiced groves for steady beams.",
    descriptionZh: "伐木队管理复萌林，源源不断提供梁木。",
    progress: 0,
    stability: 0,
    requiredStage: 0,
    buildingCount: 0,
    expansionCost: { sunleaf: -30, wood: -10 },
    productionBoost: { wood: 1.5 },
    resourceTag: "wood",
  },
  {
    id: "aurora-forge",
    title: "Aurora Forge",
    titleZh: "极光铸坊",
    focus: "Industry",
    focusZh: "工业",
    description: "Smelters pulse in rhythm, refining alloys without smoke.",
    descriptionZh: "冶炉随节奏脉动，无烟精炼合金。",
    progress: 0,
    stability: 0,
    requiredStage: 1,
    buildingCount: 0,
    expansionCost: { wood: -8, stone: -6 },
    productionBoost: { stone: 0.3 },
  },
  {
    id: "moonwater-archives",
    title: "Moonwater Archives",
    titleZh: "月泉文库",
    focus: "Knowledge",
    focusZh: "学术",
    description: "Scholars inscribe crystalline tablets with newfound lore.",
    descriptionZh: "学者将新知刻写于晶片之上。",
    progress: 0,
    stability: 0,
    requiredStage: 2,
    buildingCount: 0,
    expansionCost: { stone: -10, science: -4 },
    productionBoost: { science: 0.2 },
  },
  {
    id: "sky-harbor",
    title: "Sky Harbor",
    titleZh: "云岬港",
    focus: "Diplomacy",
    focusZh: "外交",
    description: "Dirigibles ferry envoys across the cloudbound horizon.",
    descriptionZh: "飞艇载着使节穿越云海天际。",
    progress: 0,
    stability: 0,
    requiredStage: 3,
    buildingCount: 0,
    expansionCost: { wood: -12, energy: -6 },
    productionBoost: { energy: 0.4 },
  },
];

const ACTIONS: Action[] = [
  {
    id: "forage-sunleaf",
    label: "Harvest Sunleaf",
    labelZh: "收割向日叶",
    description: "Boost manual harvest efficiency by 20% for 5 minutes.",
    descriptionZh: "手动采集效率提升 20%，持续 5 分钟。",
    cost: "-5 Execution",
    costZh: "-5 执行力",
    cooldown: "30:00",
    duration: 300,
    delta: { execution: -5 },
    rateDelta: { sunleaf: 0.2 },
    log: "Council decree: Harvest crews work with renewed vigor (+20% efficiency, 5 min).",
    logZh: "议会指令：采集队效率提升（+20%，持续 5 分钟）。",
    requiredStage: 0,
  },
  {
    id: "reinforce-trusses",
    label: "Reinforce Trusses",
    labelZh: "加固桁梁",
    description: "Stabilize the sky harbor with braided timber supports.",
    descriptionZh: "用交织木梁稳定云岳的结构。",
    cost: "-3 Execution",
    costZh: "-3 执行力",
    cooldown: "45:00",
    delta: { execution: -3 },
    capacityDelta: { wood: 120 },
    log: "Engineers weave new trusses; storage expands across the harbor.",
    logZh: "技师编织新桁梁，仓储空间随之扩张。",
    requiredStage: 2,
  },
  {
    id: "archive-colloquium",
    label: "Archive Colloquium",
    labelZh: "文库研讨会",
    description: "Host a symposium to accelerate scholarly breakthroughs.",
    descriptionZh: "举办研讨会以加速学术突破。",
    cost: "-2 Execution",
    costZh: "-2 执行力",
    cooldown: "40:00",
    delta: { execution: -2, science: 24 },
    rateDelta: { science: 1.6 },
    log: "Archivists publish luminous diagrams, insight flows faster.",
    logZh: "档案员发布发光图谱，灵感涌动更快。",
    requiredStage: 1,
  },
  {
    id: "ignite-furnaces",
    label: "Ignite Furnaces",
    labelZh: "点燃熔炉",
    description: "Fuel aurora forges to smelt stone into refined alloys.",
    descriptionZh: "为极光炉添燃料，将石料熔炼成合金。",
    cost: "-3 Execution",
    costZh: "-3 执行力",
    cooldown: "60:00",
    delta: { execution: -3, stone: 28 },
    rateDelta: { stone: 1.8 },
    log: "Forges flare sapphire; stone output surges across the ridge.",
    logZh: "熔炉迸发蓝焰，山脊石料产量激增。",
    requiredStage: 3,
  },
];

const MANUAL_HARVEST_REWARDS: Record<ResourceKey, ResourceDelta> = {
  sunleaf: { sunleaf: 3 },
  wood: { wood: 1 },
  stone: { stone: 2 },
  science: { science: 1 },
  energy: { energy: 1 },
  execution: { execution: 0.5 },
};

const MANUAL_HARVEST_COOLDOWN_SECONDS = 30;

const PHASES = ["Dawn", "Radiance", "Dusk", "Night"] as const;
const PHASES_ZH = ["黎明", "炽光", "暮色", "夜巡"] as const;
const PHASE_INTERVAL_MS = 5000;
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
const SEASONS_ZH = ["春季", "夏季", "秋季", "冬季"] as const;
const DAYS_PER_SEASON = 91;
const DAYS_PER_YEAR = 365;

const SUNLEAF_SEASON_MULTIPLIERS = [1.2, 1.2, 0.8, 0.5];
const WAGE_PER_TENANT_PER_DAY = 5;

type ResourceUnlockInfo = {
  stage: number | null;
  cost?: ResourceDelta;
  costLabel?: string;
  costLabelZh?: string;
  log?: string;
  logZh?: string;
};

const RESOURCE_UNLOCK_DATA: Record<ResourceKey, ResourceUnlockInfo> = {
  sunleaf: {
    stage: 0,
  },
  wood: {
    stage: null,
    cost: { sunleaf: -40 },
    costLabel: "Spend 40 sunleaf",
    costLabelZh: "消耗 40 份向日叶",
    log: "Landlord unlocks the timber ledger after receiving 40 sunleaf.",
    logZh: "缴纳 40 份向日叶后，房东开放木材账册。",
  },
  stone: {
    stage: 1,
  },
  science: {
    stage: 1,
  },
  energy: {
    stage: 2,
  },
  execution: {
    stage: null,
    cost: { wood: -30 },
    costLabel: "Spend 30 timber",
    costLabelZh: "消耗 30 单位木材",
    log: "Landlord grants execution authority after a timber tribute.",
    logZh: "缴纳 30 单位木材后，房东准许动用执行力。",
  },
};

type TutorialGoal = {
  resource: ResourceKey;
  target: number;
  label: string;
  labelZh: string;
  metric?: "amount" | "capacity";
};

type TutorialStage = {
  index: number;
  title: string;
  titleZh: string;
  cycleDeadline?: number;
  intro: string;
  introZh: string;
  goals: TutorialGoal[];
  unlocks: string[];
  unlocksZh: string[];
};

const TUTORIAL_STAGES: TutorialStage[] = [
  {
    index: 0,
    title: "Move-In Night",
    titleZh: "搬迁之夜",
    cycleDeadline: 20,
    intro: "The landlord pounds on the door, demanding tidy stacks of sunleaf before signing off",
    introZh: "房东要求在签字前先把向日叶堆得整整齐齐",
    goals: [
      {
        resource: "sunleaf",
        target: 20,
        label: "Tie up 20 bundles of sunleaf to reassure the landlord",
        labelZh: "捆好 20 份向日叶使房东放心",
      },
    ],
    unlocks: [
      "Landlord allows access to the Stone and Insight ledgers—no more closed books.",
      "Landlord signs the `Archive Colloquium` directive to audit scholars during rent calls.",
      "Rental brief for `Aurora Forge` becomes available.",
    ],
    unlocksZh: [
      "房东准许开启石料与灵感账册。",
      "房东签署《文库研讨会》指令以便审计学者。",
      "《极光铸坊》租约简报开放。",
    ],
  },
  {
    index: 1,
    title: "Second Collection",
    titleZh: "二次收租",
    intro: "Ledger in hand, the landlord returns expecting respectable stone and insight figures.",
    introZh: "房东带着账本回访，期待可靠的石料与灵感数据。",
    goals: [
      {
        resource: "stone",
        target: 30,
        label: "Pile up 30 stone to prove the foundations are steady",
        labelZh: "囤积 30 单位石料证明地基稳固"
      },
      {
        resource: "science",
        target: 5,
        label: "Report 5 insight to keep the landlord's ledger satisfied",
        labelZh: "上报 5 点灵感令房东满意"
      },
    ],
    unlocks: [
      "Landlord approves the `Reinforce Trusses` directive for expanded storage rent.",
      "Dossier for `Moonwater Archives` opens for landlord review.",
      "Landlord delivers the `Sky Loom` megaproject rent statement.",
    ],
    unlocksZh: [
      "房东批准《加固桁梁》指令以扩展仓储。",
      "《月泉文库》档案向房东开放审阅。",
      "房东递交《天织机》巨构租金账。",
    ],
  },
  {
    index: 2,
    title: "Quarterly Audit",
    titleZh: "季度审计",
    intro: "The landlord now demands ember reserves and timber capacity for the quarter's reconciliation.",
    introZh: "房东要求出示余烬储备与木材上限，以便季度对账。",
    goals: [
      {
        resource: "energy",
        target: 12,
        label: "Hold 12 ember to offset the landlord's red ink",
        labelZh: "持有 12 点余烬抵消赤字"
      },
      {
        resource: "wood",
        target: 100,
        label: "Lift timber capacity to 100 before the landlord relents",
        labelZh: "将木材容量提升到 100，让房东点头",
        metric: "capacity",
      },
    ],
    unlocks: [
      "Landlord authorises `Ignite Furnaces`, adding an ember surcharge.",
      "Lease and lookout rights for `Sky Harbor` activate together.",
      "Landlord reveals the long-term rent sheet for `Radiant Aquifer`.",
    ],
    unlocksZh: [
      "房东授权《点燃熔炉》，附加余烬附加费。",
      "《云岬港》租约与守望权同步启用。",
      "房东公开《灿辉含水层》的长期租金表。",
    ],
  },
  {
    index: 3,
    title: "End-of-Month Inspection",
    titleZh: "月终验租",
    intro: "Counting the coin with a smile, the landlord unlocks everything—just don't miss the due date.",
    introZh: "房东数着账目，笑着放开所有限制——别忘了按时缴租。",
    goals: [],
    unlocks: [
      "Tutorial lease complete. Every directive and facility is now open to you.",
    ],
    unlocksZh: [
      "教学租约完成，所有指令与设施对你开放。",
    ],
  },
];

export default function Home() {
  const [resources, setResources] = useState<Resource[]>(INITIAL_RESOURCES);
  const [tick, setTick] = useState(0);
  const [manualCooldowns, setManualCooldowns] = useState<Record<ResourceKey, number>>({
    sunleaf: 0,
    wood: 0,
    stone: 0,
    science: 0,
    energy: 0,
    execution: 0,
  });
  const [manualHarvestActive, setManualHarvestActive] = useState<Record<ResourceKey, boolean>>({
    sunleaf: false,
    wood: false,
    stone: false,
    science: false,
    energy: false,
    execution: false,
  });
  const { language } = useLanguage();
  const localizedDefaults = useMemo(
    () =>
      language === "zh"
        ? [
            "议会在极光散去时集结。",
            "月泉书记整编上一周的收成账册。",
            "云岬港的工程队汇报上空依旧平稳。",
          ]
        : [
            "Council convenes as aurora veils fade over the valley.",
            "Moonwater scribes compile last cycle's harvest ledgers.",
            "Sky harbor crews report calm currents across the upper winds.",
          ],
    [language],
  );
  const [log, setLog] = useState<string[]>(localizedDefaults);
  const [stageIndex, setStageIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const nextStageRef = useRef<number>(0);
  const initialChapterId = STORY_CHAPTERS[0]?.id ?? "";
  const [unlockedChapters, setUnlockedChapters] = useState<string[]>(initialChapterId ? [initialChapterId] : []);
  const [activeChapterId, setActiveChapterId] = useState<string>(initialChapterId);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [completedPurchases, setCompletedPurchases] = useState<string[]>([]);
  const [purchaseCounts, setPurchaseCounts] = useState<Record<string, number>>({});
  const [civilizationLevel, setCivilizationLevel] = useState(0);
  const [gameState, setGameState] = useState<'main-menu' | 'playing' | 'paused'>('main-menu');
  const [currentSaveName, setCurrentSaveName] = useState<string>("");
  const [showNewGameDialog, setShowNewGameDialog] = useState(false);
  const [newGameName, setNewGameName] = useState("");
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showSaveListDialog, setShowSaveListDialog] = useState(false);
  const [hasLastSave, setHasLastSave] = useState(false);
  const [availableSaves, setAvailableSaves] = useState<string[]>([]);
  const [showIntroDialogue, setShowIntroDialogue] = useState(true);
  const [introIndex, setIntroIndex] = useState(0);
  const [districts, setDistricts] = useState<District[]>(DISTRICTS);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [craftingRecipe, setCraftingRecipe] = useState<string | null>(null);
  const [craftingProgress, setCraftingProgress] = useState(0);
  const [pendingAllocation, setPendingAllocation] = useState<{ recipeId: string; boost: number } | null>(null);
  const [equippedTools, setEquippedTools] = useState<Record<string, string>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<ToolMaterial>("wooden");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    districts: false,
    projects: false,
    facilities: true,
    council: false,
    recipes: false,
    tools: false,
    story: false,
    tutorial: false,
    workers: false,
    skills: false,
    save: false,
  });
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [showBlueprintSelector, setShowBlueprintSelector] = useState(false);
  const [selectedBlueprintCategory, setSelectedBlueprintCategory] = useState<BlueprintCategory | null>(null);
  const [activePanel, setActivePanel] = useState<NavigationPanel>("resources");

  const toggleCard = useCallback((cardId: string) => {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }, []);
  const [facilityCounts, setFacilityCounts] = useState<Record<string, number>>(INITIAL_FACILITY_COUNTS);
  const [tenantRecruitCooldown, setTenantRecruitCooldown] = useState(0);
  const [pendingTenants, setPendingTenants] = useState(0);
  const [tenantTimeout, setTenantTimeout] = useState(0);
  const [assignedTenants, setAssignedTenants] = useState(0);
  const [tenantMorale, setTenantMorale] = useState<number[]>([]);
  const [autoPayWages, setAutoPayWages] = useState(false);
  const [lastPayDay, setLastPayDay] = useState(0);
  const [skills, setSkills] = useState<Skill[]>(INITIAL_SKILLS);
  const [resourceWorkers, setResourceWorkers] = useState<Record<ResourceKey, number>>({
    sunleaf: 0,
    wood: 0,
    stone: 0,
    science: 0,
    energy: 0,
    execution: 0,
  });
  const [manuallyUnlockedResources, setManuallyUnlockedResources] = useState<ResourceKey[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<Array<{
    actionId: string;
    label: string;
    labelZh: string;
    remainingTicks: number;
    totalDuration: number;
    rateDelta: Partial<Record<ResourceKey, number>>;
  }>>([]);

  useEffect(() => {
    if (showIntroDialogue) {
      return;
    }
    const id = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, PHASE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [showIntroDialogue]);

  const saveGame = useCallback(async (saveName: string) => {
    if (typeof window === 'undefined') return;
    const payload = {
      version: 1,
      resources,
      tick,
      stageIndex,
      showTutorial,
      showIntroDialogue,
      introIndex,
      unlockedChapters,
      activeChapterId,
      milestones,
      completedPurchases,
      purchaseCounts,
      civilizationLevel,
      manualCooldowns,
      manualHarvestActive,
      log,
      language,
      districts,
      craftingRecipe,
      craftingProgress,
      equippedTools,
      facilityCounts,
      selectedFacilityId,
      tenantRecruitCooldown,
      pendingTenants,
      tenantTimeout,
      assignedTenants,
      tenantMorale,
      autoPayWages,
      lastPayDay,
      skills,
      resourceWorkers,
      manuallyUnlockedResources,
    };
    const saveData = JSON.stringify(payload);
    
    try {
      if (window.go?.main?.SaveManager) {
        // Use Wails API
        await window.go.main.SaveManager.SaveGame(saveName, saveData);
        await window.go.main.SaveManager.SetLastSave(saveName);
      } else {
        // Fallback to localStorage for development
        localStorage.setItem(`save_${saveName}`, saveData);
        localStorage.setItem('lastSaveName', saveName);
      }
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, [resources, tick, stageIndex, showTutorial, showIntroDialogue, introIndex, unlockedChapters, activeChapterId, milestones, completedPurchases, purchaseCounts, civilizationLevel, manualCooldowns, manualHarvestActive, log, language, districts, craftingRecipe, craftingProgress, equippedTools, facilityCounts, selectedFacilityId, tenantRecruitCooldown, pendingTenants, tenantTimeout, assignedTenants, tenantMorale, autoPayWages, lastPayDay, skills, resourceWorkers, manuallyUnlockedResources]);

  const loadGame = useCallback(async (saveName: string) => {
    if (typeof window === 'undefined') return false;
    
    let saveData: string | null = null;
    
    try {
      if (window.go?.main?.SaveManager) {
        // Use Wails API
        saveData = await window.go.main.SaveManager.LoadGame(saveName);
      } else {
        // Fallback to localStorage for development
        saveData = localStorage.getItem(`save_${saveName}`);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
    
    if (!saveData) {
      return false;
    }
    try {
      const parsed = JSON.parse(saveData);
      if (!parsed || typeof parsed !== "object") {
        return false;
      }
      if (Array.isArray(parsed.resources)) {
        setResources(
          INITIAL_RESOURCES.map((resource) => {
            const incoming = parsed.resources.find((item: Resource) => item?.key === resource.key);
            if (!incoming) {
              return resource;
            }
            return {
              ...resource,
              amount: typeof incoming.amount === "number" ? incoming.amount : resource.amount,
              rate: typeof incoming.rate === "number" ? incoming.rate : resource.rate,
              capacity: typeof incoming.capacity === "number" ? incoming.capacity : resource.capacity,
            };
          }),
        );
      } else {
        setResources(INITIAL_RESOURCES);
      }
      setTick(typeof parsed.tick === "number" ? parsed.tick : 0);
      setStageIndex(typeof parsed.stageIndex === "number" ? parsed.stageIndex : 0);
      setShowTutorial(Boolean(parsed.showTutorial));
      setShowIntroDialogue(Boolean(parsed.showIntroDialogue));
      setIntroIndex(typeof parsed.introIndex === "number" ? parsed.introIndex : 0);
      setUnlockedChapters(Array.isArray(parsed.unlockedChapters) ? parsed.unlockedChapters : []);
      setActiveChapterId(typeof parsed.activeChapterId === "string" ? parsed.activeChapterId : initialChapterId);
      setMilestones(Array.isArray(parsed.milestones) ? parsed.milestones : []);
      setCompletedPurchases(Array.isArray(parsed.completedPurchases) ? parsed.completedPurchases : []);
      setPurchaseCounts(typeof parsed.purchaseCounts === "object" && parsed.purchaseCounts ? parsed.purchaseCounts : {});
      setCivilizationLevel(typeof parsed.civilizationLevel === "number" ? parsed.civilizationLevel : 0);
      if (parsed.manualCooldowns && typeof parsed.manualCooldowns === "object") {
        setManualCooldowns(parsed.manualCooldowns);
      }
      if (parsed.manualHarvestActive && typeof parsed.manualHarvestActive === "object") {
        setManualHarvestActive(parsed.manualHarvestActive);
      }
      setLog(Array.isArray(parsed.log) ? parsed.log.slice(0, 6) : localizedDefaults);
      if (Array.isArray(parsed.districts)) {
        setDistricts(
          DISTRICTS.map((district) => {
            const incoming = parsed.districts.find((item: District) => item?.id === district.id);
            if (!incoming) {
              return district;
            }
            return {
              ...district,
              buildingCount: typeof incoming.buildingCount === "number" ? incoming.buildingCount : 0,
              progress: typeof incoming.progress === "number" ? incoming.progress : 0,
              stability: typeof incoming.stability === "number" ? incoming.stability : 0,
            };
          }),
        );
      } else {
        setDistricts(DISTRICTS);
      }
      setCraftingRecipe(typeof parsed.craftingRecipe === "string" ? parsed.craftingRecipe : null);
      if (parsed.craftingProgress !== undefined) {
        setCraftingProgress(typeof parsed.craftingProgress === "number" ? parsed.craftingProgress : 0);
      }
      if (parsed.equippedTools && typeof parsed.equippedTools === "object") {
        setEquippedTools(parsed.equippedTools);
      }
      if (parsed.facilityCounts && typeof parsed.facilityCounts === "object") {
        setFacilityCounts(parsed.facilityCounts);
      }
      if (typeof parsed.selectedFacilityId === "string") {
        setSelectedFacilityId(parsed.selectedFacilityId);
      }
      if (typeof parsed.tenantRecruitCooldown === "number") {
        setTenantRecruitCooldown(parsed.tenantRecruitCooldown);
      }
      if (typeof parsed.pendingTenants === "number") {
        setPendingTenants(parsed.pendingTenants);
      }
      if (typeof parsed.tenantTimeout === "number") {
        setTenantTimeout(parsed.tenantTimeout);
      }
      if (typeof parsed.assignedTenants === "number") {
        setAssignedTenants(parsed.assignedTenants);
      }
      if (typeof parsed.tenantMorale === "number") {
        setTenantMorale(parsed.tenantMorale);
      }
      if (typeof parsed.autoPayWages === "boolean") {
        setAutoPayWages(parsed.autoPayWages);
      }
      if (typeof parsed.lastPayDay === "number") {
        setLastPayDay(parsed.lastPayDay);
      }
      if (Array.isArray(parsed.skills)) {
        setSkills(parsed.skills);
      } else {
        setSkills(INITIAL_SKILLS);
      }
      if (parsed.resourceWorkers && typeof parsed.resourceWorkers === "object") {
        setResourceWorkers({
          sunleaf: typeof parsed.resourceWorkers.sunleaf === "number" ? parsed.resourceWorkers.sunleaf : 0,
          wood: typeof parsed.resourceWorkers.wood === "number" ? parsed.resourceWorkers.wood : 0,
          stone: typeof parsed.resourceWorkers.stone === "number" ? parsed.resourceWorkers.stone : 0,
          science: typeof parsed.resourceWorkers.science === "number" ? parsed.resourceWorkers.science : 0,
          energy: typeof parsed.resourceWorkers.energy === "number" ? parsed.resourceWorkers.energy : 0,
          execution: typeof parsed.resourceWorkers.execution === "number" ? parsed.resourceWorkers.execution : 0,
        });
      } else {
        setResourceWorkers({
          sunleaf: 0,
          wood: 0,
          stone: 0,
          science: 0,
          energy: 0,
          execution: 0,
        });
      }
      if (Array.isArray(parsed.manuallyUnlockedResources)) {
        setManuallyUnlockedResources(parsed.manuallyUnlockedResources);
      }
      setCurrentSaveName(saveName);
      
      // Set last save
      try {
        if (window.go?.main?.SaveManager) {
          await window.go.main.SaveManager.SetLastSave(saveName);
        } else {
          localStorage.setItem('lastSaveName', saveName);
        }
      } catch (error) {
        console.error('Failed to set last save:', error);
      }
      
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [initialChapterId, localizedDefaults]);

  const serializeState = useCallback(() => {
    const payload = {
      version: 1,
      resources,
      tick,
      stageIndex,
      showTutorial,
      showIntroDialogue,
      introIndex,
      unlockedChapters,
      activeChapterId,
      milestones,
      completedPurchases,
      purchaseCounts,
      civilizationLevel,
      manualCooldowns,
      manualHarvestActive,
      log,
      language,
      districts,
      craftingRecipe,
      craftingProgress,
      equippedTools,
      facilityCounts,
      selectedFacilityId,
      tenantRecruitCooldown,
      pendingTenants,
      tenantTimeout,
      assignedTenants,
      tenantMorale,
      autoPayWages,
      lastPayDay,
      skills,
      resourceWorkers,
      manuallyUnlockedResources,
    };
    return JSON.stringify(payload);
  }, [resources, tick, stageIndex, showTutorial, showIntroDialogue, introIndex, unlockedChapters, activeChapterId, milestones, completedPurchases, purchaseCounts, civilizationLevel, manualCooldowns, manualHarvestActive, log, language, districts, craftingRecipe, craftingProgress, equippedTools, facilityCounts, selectedFacilityId, tenantRecruitCooldown, pendingTenants, tenantTimeout, assignedTenants, tenantMorale, autoPayWages, lastPayDay, skills, resourceWorkers, manuallyUnlockedResources]);

  const deserializeState = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid save format.");
        }
        if (Array.isArray(parsed.resources)) {
          setResources(
            INITIAL_RESOURCES.map((resource) => {
              const incoming = parsed.resources.find((item: Resource) => item?.key === resource.key);
              if (!incoming) {
                return resource;
              }
              return {
                ...resource,
                amount: typeof incoming.amount === "number" ? incoming.amount : resource.amount,
                rate: typeof incoming.rate === "number" ? incoming.rate : resource.rate,
                capacity: typeof incoming.capacity === "number" ? incoming.capacity : resource.capacity,
              };
            }),
          );
        } else {
          setResources(INITIAL_RESOURCES);
        }
        setTick(typeof parsed.tick === "number" ? parsed.tick : 0);
        setStageIndex(typeof parsed.stageIndex === "number" ? parsed.stageIndex : 0);
        setShowTutorial(Boolean(parsed.showTutorial));
        setShowIntroDialogue(Boolean(parsed.showIntroDialogue));
        setIntroIndex(typeof parsed.introIndex === "number" ? parsed.introIndex : 0);
        setUnlockedChapters(Array.isArray(parsed.unlockedChapters) ? parsed.unlockedChapters : []);
        setActiveChapterId(typeof parsed.activeChapterId === "string" ? parsed.activeChapterId : initialChapterId);
        setMilestones(Array.isArray(parsed.milestones) ? parsed.milestones : []);
        setCompletedPurchases(Array.isArray(parsed.completedPurchases) ? parsed.completedPurchases : []);
        setPurchaseCounts(typeof parsed.purchaseCounts === "object" && parsed.purchaseCounts ? parsed.purchaseCounts : {});
        setCivilizationLevel(typeof parsed.civilizationLevel === "number" ? parsed.civilizationLevel : 0);
        if (parsed.manualCooldowns && typeof parsed.manualCooldowns === "object") {
          setManualCooldowns(parsed.manualCooldowns);
        }
        if (parsed.manualHarvestActive && typeof parsed.manualHarvestActive === "object") {
          setManualHarvestActive(parsed.manualHarvestActive);
        } else if (parsed.manualHarvestPending && typeof parsed.manualHarvestPending === "object") {
          setManualHarvestActive(parsed.manualHarvestPending);
        }
        setLog(Array.isArray(parsed.log) ? parsed.log.slice(0, 6) : localizedDefaults);
        if (Array.isArray(parsed.districts)) {
          setDistricts(
            DISTRICTS.map((district) => {
              const incoming = parsed.districts.find((item: District) => item?.id === district.id);
              if (!incoming) {
                return district;
              }
              return {
                ...district,
                buildingCount: typeof incoming.buildingCount === "number" ? incoming.buildingCount : district.buildingCount,
                progress: typeof incoming.progress === "number" ? incoming.progress : district.progress,
                stability: typeof incoming.stability === "number" ? incoming.stability : district.stability,
              };
            }),
          );
        } else {
          setDistricts(DISTRICTS);
        }
        setCraftingRecipe(typeof parsed.craftingRecipe === "string" ? parsed.craftingRecipe : null);
        if (parsed.craftingProgress !== undefined) {
          setCraftingProgress(parsed.craftingProgress);
        }
        if (parsed.equippedTools && typeof parsed.equippedTools === "object") {
          setEquippedTools(parsed.equippedTools);
        }
        if (parsed.facilityCounts && typeof parsed.facilityCounts === "object") {
          setFacilityCounts({ ...INITIAL_FACILITY_COUNTS, ...parsed.facilityCounts });
        } else {
          setFacilityCounts(INITIAL_FACILITY_COUNTS);
        }
        setSelectedFacilityId(typeof parsed.selectedFacilityId === "string" ? parsed.selectedFacilityId : null);
        setTenantRecruitCooldown(typeof parsed.tenantRecruitCooldown === "number" ? parsed.tenantRecruitCooldown : 0);
        setPendingTenants(typeof parsed.pendingTenants === "number" ? parsed.pendingTenants : 0);
        setTenantTimeout(typeof parsed.tenantTimeout === "number" ? parsed.tenantTimeout : 0);
        setAssignedTenants(typeof parsed.assignedTenants === "number" ? parsed.assignedTenants : 0);
        setTenantMorale(Array.isArray(parsed.tenantMorale) ? parsed.tenantMorale : []);
        setAutoPayWages(Boolean(parsed.autoPayWages));
        setLastPayDay(typeof parsed.lastPayDay === "number" ? parsed.lastPayDay : 0);
        if (Array.isArray(parsed.skills)) {
          setSkills(
            INITIAL_SKILLS.map((skill) => {
              const incoming = parsed.skills.find((s: Skill) => s?.type === skill.type);
              if (!incoming) {
                return skill;
              }
              return {
                ...skill,
                level: typeof incoming.level === "number" ? Math.min(MAX_SKILL_LEVEL, incoming.level) : skill.level,
                experience: typeof incoming.experience === "number" ? incoming.experience : skill.experience,
              };
            }),
          );
        } else {
          setSkills(INITIAL_SKILLS);
        }
        if (parsed.resourceWorkers && typeof parsed.resourceWorkers === "object") {
          setResourceWorkers({
            sunleaf: typeof parsed.resourceWorkers.sunleaf === "number" ? parsed.resourceWorkers.sunleaf : 0,
            wood: typeof parsed.resourceWorkers.wood === "number" ? parsed.resourceWorkers.wood : 0,
            stone: typeof parsed.resourceWorkers.stone === "number" ? parsed.resourceWorkers.stone : 0,
            science: typeof parsed.resourceWorkers.science === "number" ? parsed.resourceWorkers.science : 0,
            energy: typeof parsed.resourceWorkers.energy === "number" ? parsed.resourceWorkers.energy : 0,
            execution: typeof parsed.resourceWorkers.execution === "number" ? parsed.resourceWorkers.execution : 0,
          });
        } else {
          setResourceWorkers({
            sunleaf: 0,
            wood: 0,
            stone: 0,
            science: 0,
            energy: 0,
            execution: 0,
          });
        }
        if (Array.isArray(parsed.manuallyUnlockedResources)) {
          setManuallyUnlockedResources(parsed.manuallyUnlockedResources);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [initialChapterId, localizedDefaults, language],
  );

  const {
    cycle,
    cycleLabel,
    phaseIndex,
    phaseLabel,
    phaseDisplay,
    isNight,
    day,
    seasonIndex,
    seasonBadge,
    yearLabel,
  } = useMemo(() => {
    const phaseIndex = tick % PHASES.length;
    const phaseLabel = PHASES[phaseIndex];
    const phaseDisplay = (language === "zh" ? PHASES_ZH : PHASES)[phaseIndex];
    const cycleCount = Math.floor(tick / PHASES.length);
    const cycleLabel = `Cycle ${String(cycleCount + 1).padStart(3, "0")}`;
    const dayCount = cycleCount + 1;
    const dayLabel =
      language === "zh"
        ? `第${dayCount}日`
        : `Day ${String(dayCount).padStart(3, "0")}`;
    const seasonIndex = Math.floor(((dayCount - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
    const seasonName = (language === "zh" ? SEASONS_ZH : SEASONS)[seasonIndex];
    const seasonBadge = language === "zh" ? seasonName : `Season ${seasonName}`;
    const yearCount = Math.floor((dayCount - 1) / DAYS_PER_YEAR) + 1;
    const yearLabel =
      language === "zh"
        ? `第${yearCount}年`
        : `Year ${String(yearCount).padStart(3, "0")}`;
    const isNight = phaseIndex === PHASES.length - 1;
    return {
      cycle: cycleCount,
      cycleLabel,
      phaseIndex,
      phaseLabel,
      phaseDisplay,
      isNight,
      day: dayCount,
      dayLabel,
      seasonIndex,
      seasonBadge,
      yearLabel,
    };
  }, [tick, language]);

  const sunleafResource = useMemo(() => resources.find((resource) => resource.key === "sunleaf"), [resources]);
  const passiveRates = useMemo(() => {
    const rates: Partial<Record<ResourceKey, number>> = {};
    districts.forEach((district) => {
      if (!district.buildingCount) {
        return;
      }
      Object.entries(district.productionBoost).forEach(([key, boost]) => {
        if (!boost) {
          return;
        }
        rates[key as ResourceKey] = (rates[key as ResourceKey] ?? 0) + boost * district.buildingCount;
      });
    });
    return rates;
  }, [districts]);
  const baseSunleafRate = useMemo(
    () => INITIAL_RESOURCES.find((resource) => resource.key === "sunleaf")?.rate ?? 0,
    [],
  );
  const sunleafMultiplier = useMemo(
    () => (seasonIndex != null ? SUNLEAF_SEASON_MULTIPLIERS[seasonIndex] ?? 1 : 1),
    [seasonIndex],
  );
  const sunleafWorkers = resourceWorkers.sunleaf ?? 0;
  const sunleafPassiveRate = passiveRates.sunleaf ?? 0;
  const sunleafRateBeforeSeason = (sunleafResource?.rate ?? 0) * sunleafWorkers + sunleafPassiveRate;
  const sunleafTotalRate = sunleafRateBeforeSeason * sunleafMultiplier;
  const sunleafTotalMultiplier = baseSunleafRate > 0 ? sunleafTotalRate / baseSunleafRate : 0;

  useEffect(() => {
    const activeKeys = Object.keys(manualCooldowns).filter(
      (key) => manualHarvestActive[key as ResourceKey],
    ) as ResourceKey[];
    if (!activeKeys.length) {
      return;
    }
    const id = window.setInterval(() => {
      setManualCooldowns((prevCooldowns) => {
        const nextCooldowns = { ...prevCooldowns };
        const cooledKeys: ResourceKey[] = [];
        activeKeys.forEach((key) => {
          const current = prevCooldowns[key];
          const nextValue = Math.max(0, current - 1);
          nextCooldowns[key] = nextValue;
          if (nextValue <= 0) {
            cooledKeys.push(key);
          }
        });
        if (cooledKeys.length) {
          setManualHarvestActive((prevActive) => {
            const nextActive = { ...prevActive };
            cooledKeys.forEach((key) => {
              nextActive[key] = false;
            });
            return nextActive;
          });
        }
        return nextCooldowns;
      });
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [manualHarvestActive, manualCooldowns]);

  useEffect(() => {
    if (tenantRecruitCooldown <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setTenantRecruitCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [tenantRecruitCooldown]);

  useEffect(() => {
    if (tenantTimeout <= 0 || pendingTenants <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setTenantTimeout((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0 && pendingTenants > 0) {
          const entry =
            language === "zh"
              ? `${pendingTenants} 名租客因超时未分配离开市政厅。`
              : `${pendingTenants} tenants left City Hall due to timeout.`;
          setLog((prevLog) => [entry, ...prevLog].slice(0, 6));
          setPendingTenants(0);
        }
        return next;
      });
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [tenantTimeout, pendingTenants, language]);

  useEffect(() => {
    if (activeBoosts.length === 0) {
      return;
    }
    setActiveBoosts((prev) => {
      const updated = prev.map((boost) => ({
        ...boost,
        remainingTicks: boost.remainingTicks - 1,
      })).filter((boost) => boost.remainingTicks > 0);
      return updated;
    });
  }, [tick]);

  useEffect(() => {
    const totalRateBoost: Partial<Record<ResourceKey, number>> = {};
    activeBoosts.forEach((boost) => {
      Object.entries(boost.rateDelta).forEach(([key, value]) => {
        const resourceKey = key as ResourceKey;
        totalRateBoost[resourceKey] = (totalRateBoost[resourceKey] ?? 0) + (value ?? 0);
      });
    });
    setResources((prev) => {
      return prev.map((resource) => {
        const baseRate = resource.rate - (totalRateBoost[resource.key] ?? 0);
        return {
          ...resource,
          rate: baseRate + (totalRateBoost[resource.key] ?? 0),
        };
      });
    });
  }, [activeBoosts]);

  const PhaseIcon = isNight ? Moon : Sun;
  const eraLabel = seasonBadge;

  const activeStage = useMemo(() => TUTORIAL_STAGES[stageIndex], [stageIndex]);
  const stageGoals = useMemo(() => activeStage?.goals ?? [], [activeStage]);
  const stageUnlocks = useMemo(() => activeStage?.unlocks ?? [], [activeStage]);

  const registerMilestone = useCallback((label: string) => {
    setMilestones((prev) => (prev.includes(label) ? prev : [...prev, label]));
  }, []);

  const handleDismissTutorial = useCallback(() => {
    setShowTutorial(false);
    if (stageIndex > 0) {
      registerMilestone("tutorial-overlay-dismissed");
    }
  }, [stageIndex, registerMilestone]);

  const isTriggerMet = useCallback(
    (trigger: StoryTrigger) => {
      if (trigger.type === "stage") {
        return stageIndex >= trigger.stage;
      }
      if (trigger.type === "resource") {
        const resource = resources.find((item) => item.key === trigger.resource);
        return Boolean(resource && resource.amount >= trigger.amount);
      }
      if (trigger.type === "milestone") {
        return milestones.includes(trigger.label);
      }
      if (trigger.type === "purchase") {
        return completedPurchases.includes(trigger.itemId);
      }
      return false;
    },
    [stageIndex, resources, milestones, completedPurchases],
  );

  const activeChapter = useMemo(() => {
    if (activeChapterId) {
      const match = STORY_CHAPTERS.find((chapter) => chapter.id === activeChapterId);
      if (match) {
        return match;
      }
    }
    return STORY_CHAPTERS[0] ?? null;
  }, [activeChapterId]);

  const nextChapter = useMemo(
    () => STORY_CHAPTERS.find((chapter) => !unlockedChapters.includes(chapter.id)),
    [unlockedChapters],
  );

  const languageLabels = useMemo(() => {
    if (language === "zh") {
      return {
        bannerLabel: yearLabel,
        bannerTitle: "天机谷传奇",
        bannerSubtitle: "统筹山谷复兴，平衡资源、扶植学者、迎接下一道曙光。",
        reviewLedgerLabel: "查看账册",
        backToWorkLabel: "返回作业",
        storylineHeading: "剧情布告",
        storylineSubheading: "随着教程任务推进，章节会自动解锁。",
        objectivesLabel: "目标",
        unlocksLabel: "解锁",
        notesLabel: "备注",
        nextUnlockLabel: "下一章",
        allUnlockedLabel: "所有章节已解锁。",
        tutorialHeading: "房东阶段简报",
        tutorialObjectives: "日常租金目标",
        tutorialUnlocks: "房东承诺",
        tutorialEmpty: "房东暂且满意，不过别忘了月底的账单。",
        tutorialRevisit: "重温房东简报",
        dispatchTitle: "议会广播",
        dispatchDescription: "本周期山谷内的关键讯息。",
        dispatchBadgeNow: "现在",
        dispatchBadgePast: (index: number) => `-${index} 周期`,
        resourceLedgerTitle: "资源账册",
        resourceLedgerDescription: "关注产能与仓储压力。",
        lockedBadge: "锁定",
        districtTitle: "山谷总览",
        districtDescription: "快速洞察各区脉动。",
        districtLocked: (stage: string) => `${stage} 解锁后可访问。`,
        districtOutputLabel: "产出",
        districtStabilityLabel: "稳态",
        projectsTitle: "天穹工程",
        projectsDescription: "排队推进中的地标项目。",
        projectCompletionLabel: "完工程度",
        councilTitle: "议会指令",
        councilDescription: "待批复的关键决策。",
        councilInsufficient: "不足",
        councilEnact: "执行",
        councilLockedMessage: "准备迎接更难的决策吧，房东已经想好计划。",
        councilUnlocksDuring: "解锁于",
        emporiumTitle: "房东杂货铺",
        emporiumDescription: "审慎消费，影响租金、技能与剧情。",
        emporiumTrigger: "剧情触发",
        emporiumCost: "成本",
        emporiumLimitReached: "已达上限",
        emporiumPurchase: "购买",
        emporiumGatherMore: "需收集更多资源。",
        tutorialSatisfied: "房东暂且满意——准时缴纳租金维持现状。",
        ledgerTitle: "房东账本",
        ledgerDescription: "掌握房东阶段要求，别错过任何缴纳。",
        stageBadge: "阶段",
        dispatchRateSuffix: "每周期",
        emporiumStageLocked: (stage: number) => `解锁于阶段 ${stage}。`,
        manualHarvestReady: "手动收集",
        manualHarvestCooldown: (time: string) => `${time} 后可再次收集`,
        districtDetailTitle: "设施详情",
        districtDetailBuildingCount: "建筑数量",
        districtDetailExpansionCost: "扩建成本",
        districtDetailClose: "关闭",
        recipesTitle: "配方制作",
        recipesDescription: "制作物品以扩大资源储量。",
        recipeCost: "成本",
        recipeCraftTime: "制作时间",
        recipeCapacityBoost: "储量提升",
        recipeCrafting: "制作中",
        recipeStartCraft: "开始制作",
        recipeAllocate: "分配储量",
        recipeAllocatePrompt: "选择资源分配目标",
        facilityTitle: "设施建设",
        facilityDescription: "搭建为租户服务的设施。",
        facilityCapacity: (capacity: number) => `可容纳 ${capacity} 人`,
        facilityBuilt: (count: number) => `已建造：${count}`,
        facilityBuild: "建造",
        facilityLocked: (stage: string) => `${stage} 解锁后可建造。`,
        tenantRecruitTitle: "招贴广告",
        tenantRecruitButton: "招取租客",
        tenantRecruitCooldown: (time: string) => `冷却中 ${time}`,
        tenantPending: (count: number) => `待分配：${count} 人`,
        tenantAssigned: (count: number) => `已分配：${count} 人`,
        tenantTimeout: (time: string) => `超时离开：${time}`,
        tenantAssignButton: "分配居处",
        tenantNoCityHall: "需要先建造市政厅",
        tenantNoCapacity: "没有空余居所",
        skillsTitle: "技能等级",
        skillLevel: (level: number) => `Lv.${level}`,
        skillExp: (current: number, required: number) => `${current}/${required} EXP`,
        workerAssignmentTitle: "人员分配",
        workerAssignmentDescription: "分配租客到资源采集工作。",
        workersAssigned: (count: number) => `已分配：${count} 人`,
        assignWorker: "分配 +1",
        unassignWorker: "取消 -1",
        idleWorkers: (count: number) => `空闲人员：${count}`,
        populationManagementTitle: "人口管理",
        populationManagementDescription: "管理租客心情与工资发放。",
        tenantMorale: "租客心情",
        averageMorale: (morale: number) => `平均心情：${morale.toFixed(0)}%`,
        autoPayWages: "自动支付工资",
        payWagesButton: "立即支付工资",
        wageInfo: (wage: number, tenants: number) => `每日工资：${wage} 向日叶 (${tenants} 人 × 5)`,
        lowMoraleWarning: "心情低于 50% 的租客每天有 50% 概率离开！",
        tutorialCycleDeadlineLabel: "周期期限",
        tutorialCycleDeadlineProgress: (current: number, deadline: number) => `第 ${current}/${deadline} 周期`,
        tutorialCycleDeadlineRemaining: (remaining: number) => `剩余周期：${remaining}`,
        tutorialCycleDeadlineExceeded: "已超过期限，请重新规划！",
      } as const;
    }

    return {
      bannerLabel: yearLabel,
      bannerTitle: "Legend Of Tianji Valley",
      bannerSubtitle:
        "Orchestrate the valley's renaissance. Balance resources, empower scholars, and chart the next luminous century.",
      reviewLedgerLabel: "Review Ledger",
      backToWorkLabel: "Back to Work",
      storylineHeading: "Storyline Bulletin",
      storylineSubheading: "Chapters unlock as tutorial obligations are fulfilled.",
      objectivesLabel: "Objectives",
      unlocksLabel: "Unlocks",
      notesLabel: "Notes",
      nextUnlockLabel: "Next Unlock",
      allUnlockedLabel: "All storyline chapters are unlocked.",
      tutorialHeading: "Landlord Stage Brief",
      tutorialObjectives: "Daily Rent Objectives",
      tutorialUnlocks: "Landlord Promises",
      tutorialEmpty: "The landlord shrugs—rent is clear for now, but the month-end payment better arrive.",
      tutorialRevisit: "Revisit Landlord Brief",
      dispatchTitle: "Council Dispatches",
      dispatchDescription: "Signals echoing through the valley this cycle.",
      dispatchBadgeNow: "Now",
      dispatchBadgePast: (index: number) => `-${index} cycles`,
      resourceLedgerTitle: "Resource Ledger",
      resourceLedgerDescription: "Monitor production flow and storage pressure.",
      lockedBadge: "Locked",
      districtTitle: "Valley Overview",
      districtDescription: "Track the pulse of each district at a glance.",
      districtLocked: (stage: string) => `Unlocks during ${stage}.`,
      districtOutputLabel: "Output",
      districtStabilityLabel: "Stability",
      projectsTitle: "Skyline Projects",
      projectsDescription: "Queued endeavours reshaping the horizon.",
      projectCompletionLabel: "Completion",
      councilTitle: "Council Directives",
      councilDescription: "High-impact decisions awaiting approval.",
      councilInsufficient: "Insufficient",
      councilEnact: "Enact",
      councilLockedMessage: "Get ready to make some tough decisions, landlord's got a plan for you.",
      councilUnlocksDuring: "Unlocks during",
      emporiumTitle: "Landlord Emporium",
      emporiumDescription: "Spend carefully; purchases ripple through rent, skills, and story beats.",
      emporiumTrigger: "Story Trigger",
      emporiumCost: "Cost",
      emporiumLimitReached: "Limit Reached",
      emporiumPurchase: "Purchase",
      emporiumGatherMore: "Gather more resources to proceed.",
      tutorialSatisfied: "The landlord is content for now—keep it that way by paying on time.",
      ledgerTitle: "Landlord Ledger",
      ledgerDescription: "Stay ahead of the landlord’s staged demands and never miss a payment.",
      stageBadge: "Stage",
      dispatchRateSuffix: "/cycle",
      emporiumStageLocked: (stage: number) => `Unlocks during Stage ${stage}.`,
      manualHarvestReady: "Manual Harvest",
      manualHarvestCooldown: (time: string) => `Ready in ${time}`,
      districtDetailTitle: "District Details",
      districtDetailBuildingCount: "Building Count",
      districtDetailExpansionCost: "Expansion Cost",
      districtDetailClose: "Close",
      recipesTitle: "Recipes",
      recipesDescription: "Craft items to expand resource capacity.",
      recipeCost: "Cost",
      recipeCraftTime: "Craft Time",
      recipeCapacityBoost: "Capacity Boost",
      recipeCrafting: "Crafting",
      recipeStartCraft: "Start Craft",
      recipeAllocate: "Allocate Capacity",
      recipeAllocatePrompt: "Select a resource to receive the boost",
      facilityTitle: "Facility Construction",
      facilityDescription: "Build supportive housing and amenities for tenants.",
      facilityCapacity: (capacity: number) => `Capacity: ${capacity} residents`,
      facilityBuilt: (count: number) => `Built: ${count}`,
      facilityBuild: "Build",
      facilityLocked: (stage: string) => `Unlocks during ${stage}.`,
      tenantRecruitTitle: "Recruitment Notice",
      tenantRecruitButton: "Recruit Tenants",
      tenantRecruitCooldown: (time: string) => `Cooldown ${time}`,
      tenantPending: (count: number) => `Pending: ${count} tenants`,
      tenantAssigned: (count: number) => `Assigned: ${count} tenants`,
      tenantTimeout: (time: string) => `Leaving in ${time}`,
      tenantAssignButton: "Assign Housing",
      tenantNoCityHall: "Build City Hall first",
      tenantNoCapacity: "No available housing",
      skillsTitle: "Skill Levels",
      skillLevel: (level: number) => `Lv.${level}`,
      skillExp: (current: number, required: number) => `${current}/${required} EXP`,
      workerAssignmentTitle: "Worker Assignment",
      workerAssignmentDescription: "Assign tenants to resource gathering tasks.",
      workersAssigned: (count: number) => `Assigned: ${count} workers`,
      assignWorker: "Assign +1",
      unassignWorker: "Unassign -1",
      idleWorkers: (count: number) => `Idle: ${count}`,
      populationManagementTitle: "Population Management",
      populationManagementDescription: "Manage tenant morale and wage payments.",
      tenantMorale: "Tenant Morale",
      averageMorale: (morale: number) => `Average Morale: ${morale.toFixed(0)}%`,
      autoPayWages: "Auto-Pay Wages",
      payWagesButton: "Pay Wages Now",
      wageInfo: (wage: number, tenants: number) => `Daily Wage: ${wage} sunleaf (${tenants} × 5)`,
      lowMoraleWarning: "Tenants with morale below 50% have a 50% chance to leave daily!",
      tutorialCycleDeadlineLabel: "Cycle Deadline",
      tutorialCycleDeadlineProgress: (current: number, deadline: number) => `Cycle ${current}/${deadline}`,
      tutorialCycleDeadlineRemaining: (remaining: number) => `Cycles Remaining: ${remaining}`,
      tutorialCycleDeadlineExceeded: "Deadline exceeded! Reassess your plan.",
    } as const;
  }, [language, yearLabel]);

  const unlockedResources = useMemo(() => {
    return resources.filter((resource) => {
      const info = RESOURCE_UNLOCK_DATA[resource.key];
      if (!info) {
        return true;
      }
      if (info.stage != null && stageIndex >= info.stage) {
        return true;
      }
      if (manuallyUnlockedResources.includes(resource.key)) {
        return true;
      }
      return false;
    });
  }, [resources, stageIndex, manuallyUnlockedResources]);
  const lockedResources = useMemo(() => {
    return resources.filter((resource) => {
      const info = RESOURCE_UNLOCK_DATA[resource.key];
      if (!info) {
        return false;
      }
      if (info.stage != null && stageIndex >= info.stage) {
        return false;
      }
      if (manuallyUnlockedResources.includes(resource.key)) {
        return false;
      }
      return true;
    });
  }, [resources, stageIndex, manuallyUnlockedResources]);

  const unlockedDistricts = useMemo(
    () => districts.filter((district) => stageIndex >= district.requiredStage),
    [districts, stageIndex],
  );


  const unlockedFacilities = useMemo(
    () => FACILITIES.filter((facility) => stageIndex >= facility.requiredStage),
    [stageIndex],
  );


  const unlockedActions = useMemo(
    () => ACTIONS.filter((action) => stageIndex >= action.requiredStage),
    [stageIndex],
  );
  const lockedActions = useMemo(
    () => ACTIONS.filter((action) => stageIndex < action.requiredStage),
    [stageIndex],
  );

  const unlockedRecipes = useMemo(
    () => RECIPES.filter((recipe) => stageIndex >= recipe.requiredStage),
    [stageIndex],
  );
  const lockedRecipes = useMemo(
    () => RECIPES.filter((recipe) => stageIndex < recipe.requiredStage),
    [stageIndex],
  );

  const stageCompletionPercent = useMemo(() => {
    if (!stageGoals.length) {
      return 100;
    }
    const total = stageGoals.reduce((acc, goal) => {
      const resource = resources.find((item) => item.key === goal.resource);
      if (!resource) {
        return acc;
      }
      const value = goal.metric === "capacity" ? resource.capacity : resource.amount;
      return acc + Math.min(1, value / goal.target);
    }, 0);
    return Math.round((total / stageGoals.length) * 100);
  }, [resources, stageGoals]);

  const cycleDeadlineInfo = useMemo(() => {
    if (!activeStage?.cycleDeadline) {
      return null;
    }
    const deadline = activeStage.cycleDeadline;
    const currentCycleNumber = cycle + 1;
    const progressPercent = Math.min(100, (currentCycleNumber / deadline) * 100);
    return {
      deadline,
      currentCycleNumber,
      percent: progressPercent,
      remaining: Math.max(0, deadline - currentCycleNumber),
      exceeded: currentCycleNumber > deadline,
    };
  }, [activeStage, cycle]);

  const getGoalProgress = useCallback(
    (goal: TutorialGoal) => {
      const resource = resources.find((item) => item.key === goal.resource);
      if (!resource) {
        return { currentDisplay: "0", percent: 0 };
      }
      const rawValue = goal.metric === "capacity" ? resource.capacity : resource.amount;
      const percent = Math.min(100, Math.max(0, (rawValue / goal.target) * 100));
      const currentDisplay = goal.metric === "capacity" ? Math.round(rawValue).toString() : rawValue.toFixed(1);
      return { currentDisplay, percent };
    },
    [resources],
  );


  const applyResourceDelta = useCallback(
    (list: Resource[], delta: ResourceDelta) =>
      list.map((resource) => {
        const change = delta[resource.key];
        if (!change) {
          return resource;
        }
        const next = resource.amount + change;
        const limited = Math.min(resource.capacity, Math.max(0, next));
        return {
          ...resource,
          amount: Number(limited.toFixed(1)),
        };
      }),
    [],
  );

  const applyRateDelta = useCallback(
    (list: Resource[], delta: Partial<Record<ResourceKey, number>>) =>
      list.map((resource) => {
        const change = delta[resource.key];
        if (!change) {
          return resource;
        }
        return {
          ...resource,
          rate: Number((resource.rate + change).toFixed(1)),
        };
      }),
    [],
  );

  const applyCapacityDelta = useCallback(
    (list: Resource[], delta: Partial<Record<ResourceKey, number>>) =>
      list.map((resource) => {
        const change = delta[resource.key];
        if (!change) {
          return resource;
        }
        return {
          ...resource,
          capacity: Math.max(0, resource.capacity + change),
        };
      }),
    [],
  );

  const getEquippedToolBonus = useCallback(
    (resourceKey: ResourceKey) => {
      const toolTypeMap: Record<ResourceKey, string> = {
        wood: "saw",
        stone: "pickaxe",
        sunleaf: "shears",
        science: "",
        energy: "",
        execution: "",
      };
      const toolType = toolTypeMap[resourceKey];
      if (!toolType) {
        return { bonus: 0, cooldownReduction: 0 };
      }
      const equippedToolId = equippedTools[toolType];
      if (!equippedToolId) {
        return { bonus: 0, cooldownReduction: 0 };
      }
      const tool = TOOL_RECIPES.find((t) => t.id === equippedToolId);
      if (!tool) {
        return { bonus: 0, cooldownReduction: 0 };
      }
      return {
        bonus: tool.harvestBonus[resourceKey] || 0,
        cooldownReduction: tool.cooldownReduction,
      };
    },
    [equippedTools],
  );

  const handleUnlockResource = useCallback(
    (resourceKey: ResourceKey) => {
      const unlockInfo = RESOURCE_UNLOCK_DATA[resourceKey];
      if (!unlockInfo || !unlockInfo.cost) {
        return;
      }
      const canAfford = resources.every((resource) => {
        const cost = unlockInfo.cost?.[resource.key] ?? 0;
        return resource.amount + cost >= 0;
      });
      if (!canAfford) {
        return;
      }
      setResources((prev) => applyResourceDelta(prev, unlockInfo.cost!));
      setManuallyUnlockedResources((prev) => [...prev, resourceKey]);
      const logEntry = language === "zh" ? unlockInfo.logZh : unlockInfo.log;
      if (logEntry) {
        setLog((prev) => [logEntry, ...prev].slice(0, 6));
      }
    },
    [resources, language, applyResourceDelta],
  );

  const handleManualHarvest = useCallback(
    (resourceKey: ResourceKey) => {
      if (manualCooldowns[resourceKey] > 0) {
        return;
      }
      const baseReward = MANUAL_HARVEST_REWARDS[resourceKey];
      if (!baseReward) {
        return;
      }
      const { bonus, cooldownReduction } = getEquippedToolBonus(resourceKey);
      const boostedReward: ResourceDelta = {};
      Object.keys(baseReward).forEach((key) => {
        const rKey = key as ResourceKey;
        boostedReward[rKey] = (baseReward[rKey] || 0) + bonus;
      });
      setResources((prev) => applyResourceDelta(prev, boostedReward));
      const adjustedCooldown = Math.max(5, MANUAL_HARVEST_COOLDOWN_SECONDS - cooldownReduction);
      setManualCooldowns((prev) => ({ ...prev, [resourceKey]: adjustedCooldown }));
      setManualHarvestActive((prev) => ({ ...prev, [resourceKey]: true }));

      const skillType = SKILL_RESOURCE_MAP[resourceKey];
      if (skillType) {
        setSkills((prev) =>
          prev.map((skill) => {
            if (skill.type !== skillType || skill.level >= skill.maxLevel) {
              return skill;
            }
            const newExp = skill.experience + 10;
            const requiredExp = skill.level * SKILL_EXP_PER_LEVEL;
            if (newExp >= requiredExp) {
              const newLevel = skill.level + 1;
              const entry =
                language === "zh"
                  ? `${skill.nameZh}提升至 Lv.${newLevel}！`
                  : `${skill.name} leveled up to Lv.${newLevel}!`;
              setLog((prevLog) => [entry, ...prevLog].slice(0, 6));
              return {
                ...skill,
                level: newLevel,
                experience: newExp - requiredExp,
              };
            }
            return {
              ...skill,
              experience: newExp,
            };
          }),
        );
      }

      const resource = resources.find((r) => r.key === resourceKey);
      const entry =
        language === "zh"
          ? `手动收集${resource?.labelZh}完成，获得 +${boostedReward[resourceKey]}。`
          : `Manual ${resource?.label} harvest complete, gained +${boostedReward[resourceKey]}.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [manualCooldowns, applyResourceDelta, resources, language, getEquippedToolBonus],
  );

  const canAffordExpansion = useCallback(
    (district: District) => {
      return Object.entries(district.expansionCost).every(([key, cost]) => {
        const resource = resources.find((r) => r.key === key);
        if (!resource) return true;
        return resource.amount + cost >= 0;
      });
    },
    [resources],
  );

  const handleExpand = useCallback(
    (districtId: string) => {
      const district = districts.find((d) => d.id === districtId);
      if (!district || !canAffordExpansion(district)) {
        return;
      }
      setResources((prev) => {
        let updated = applyResourceDelta(prev, district.expansionCost);
        updated = applyRateDelta(updated, district.productionBoost);
        return updated;
      });
      setDistricts((prev) =>
        prev.map((d) => (d.id === districtId ? { ...d, buildingCount: d.buildingCount + 1 } : d)),
      );
      const entry =
        language === "zh"
          ? `${district.titleZh}新建设施完工，建筑总数 +1。`
          : `${district.title} expansion complete; building count +1.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [districts, canAffordExpansion, applyResourceDelta, applyRateDelta, language],
  );

  const handleDemolish = useCallback(
    (districtId: string) => {
      const district = districts.find((d) => d.id === districtId);
      if (!district || district.buildingCount <= 0) {
        return;
      }
      const negativeBoost = Object.fromEntries(
        Object.entries(district.productionBoost).map(([key, value]) => [key, -value]),
      ) as Partial<Record<ResourceKey, number>>;
      setResources((prev) => applyRateDelta(prev, negativeBoost));
      setDistricts((prev) =>
        prev.map((d) => (d.id === districtId ? { ...d, buildingCount: d.buildingCount - 1 } : d)),
      );
      const entry =
        language === "zh"
          ? `${district.titleZh}拆除一处设施，建筑总数 -1（不返还材料）。`
          : `${district.title} demolition complete; building count -1 (no refund).`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [districts, applyRateDelta, language],
  );

  const handleDistrictClick = useCallback(
    (district: District) => {
      setSelectedDistrict(district);
    },
    [],
  );

  const handleCloseDistrictDetail = useCallback(() => {
    setSelectedDistrict(null);
  }, []);

  const canAffordRecipe = useCallback(
    (recipe: Recipe) => {
      return Object.entries(recipe.cost).every(([key, cost]) => {
        const resource = resources.find((r) => r.key === key);
        if (!resource) return true;
        return resource.amount + cost >= 0;
      });
    },
    [resources],
  );

  const canAffordToolRecipe = useCallback(
    (recipe: ToolRecipe) => {
      return Object.entries(recipe.cost).every(([key, cost]) => {
        const resource = resources.find((r) => r.key === key);
        if (!resource) return true;
        return resource.amount + cost >= 0;
      });
    },
    [resources],
  );

  const canAffordFacility = useCallback(
    (facility: Facility) => {
      return Object.entries(facility.cost).every(([key, cost]) => {
        const resource = resources.find((r) => r.key === key);
        if (!resource) return true;
        return resource.amount + cost >= 0;
      });
    },
    [resources],
  );

  const handleStartCraft = useCallback(
    (recipeId: string) => {
      const recipe = RECIPES.find((r) => r.id === recipeId);
      if (!recipe || !canAffordRecipe(recipe) || craftingRecipe) {
        return;
      }
      setResources((prev) => applyResourceDelta(prev, recipe.cost));
      setCraftingRecipe(recipeId);
      setCraftingProgress(0);
      const entry =
        language === "zh"
          ? `开始制作「${recipe.nameZh}」，预计 ${recipe.craftTime} 秒后完成。`
          : `Started crafting "${recipe.name}"; estimated ${recipe.craftTime}s to complete.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [craftingRecipe, canAffordRecipe, applyResourceDelta, language],
  );

  const handleStartToolCraft = useCallback(
    (recipeId: string) => {
      const recipe = TOOL_RECIPES.find((r) => r.id === recipeId);
      if (!recipe || !canAffordToolRecipe(recipe) || craftingRecipe) {
        return;
      }
      setResources((prev) => applyResourceDelta(prev, recipe.cost));
      setCraftingRecipe(recipeId);
      setCraftingProgress(0);
      const entry =
        language === "zh"
          ? `开始制作「${recipe.nameZh}」，预计 ${recipe.craftTime} 秒后完成。`
          : `Started crafting "${recipe.name}"; estimated ${recipe.craftTime}s to complete.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [craftingRecipe, canAffordToolRecipe, applyResourceDelta, language],
  );

  const handleBuildFacility = useCallback(
    (facilityId: string) => {
      const facility = FACILITIES.find((f) => f.id === facilityId);
      if (!facility) {
        return;
      }
      if (stageIndex < facility.requiredStage) {
        return;
      }
      if (!canAffordFacility(facility)) {
        return;
      }
      setResources((prev) => applyResourceDelta(prev, facility.cost));
      setFacilityCounts((prev) => ({ ...prev, [facilityId]: (prev[facilityId] ?? 0) + 1 }));
      const entry =
        language === "zh"
          ? `成功建造「${facility.nameZh}」，新增住宿容量 ${facility.capacity} 人。`
          : `Constructed "${facility.name}"; added housing for ${facility.capacity} residents.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [stageIndex, canAffordFacility, applyResourceDelta, language],
  );

  const hasCityHall = useMemo(() => (facilityCounts["city-hall"] ?? 0) > 0, [facilityCounts]);

  const totalHousingCapacity = useMemo(() => {
    return FACILITIES.reduce((total, facility) => {
      const count = facilityCounts[facility.id] ?? 0;
      return total + count * facility.capacity;
    }, 0);
  }, [facilityCounts]);

  const availableHousing = useMemo(
    () => totalHousingCapacity - assignedTenants,
    [totalHousingCapacity, assignedTenants],
  );

  useEffect(() => {
    if (unlockedFacilities.length === 0) {
      setSelectedFacilityId(null);
      return;
    }
    if (!selectedFacilityId || !unlockedFacilities.some((facility) => facility.id === selectedFacilityId)) {
      setSelectedFacilityId(unlockedFacilities[0].id);
    }
  }, [unlockedFacilities, selectedFacilityId]);

  const selectedFacility = useMemo(
    () => unlockedFacilities.find((facility) => facility.id === selectedFacilityId) ?? null,
    [unlockedFacilities, selectedFacilityId],
  );

  const selectedFacilityDetails = useMemo(() => {
    if (!selectedFacility) {
      return null;
    }
    const builtCount = facilityCounts[selectedFacility.id] ?? 0;
    const totalCapacity = builtCount * selectedFacility.capacity;
    if (totalCapacity <= 0) {
      return {
        builtCount,
        totalCapacity,
        residents: 0,
        available: 0,
        utilization: 0,
      };
    }
    const housingCapacity = totalHousingCapacity || 0;
    const utilizationRatio = housingCapacity > 0 ? Math.min(1, assignedTenants / housingCapacity) : 0;
    const residents = Math.min(totalCapacity, Math.round(totalCapacity * utilizationRatio));
    const available = Math.max(0, totalCapacity - residents);
    const utilization = (residents / totalCapacity) * 100;
    return {
      builtCount,
      totalCapacity,
      residents,
      available,
      utilization,
    };
  }, [selectedFacility, facilityCounts, totalHousingCapacity, assignedTenants]);

  const handleRecruitTenants = useCallback(() => {
    if (!hasCityHall) {
      return;
    }
    if (tenantRecruitCooldown > 0) {
      return;
    }
    setPendingTenants((prev) => prev + 5);
    setTenantRecruitCooldown(300);
    setTenantTimeout(120);
    const entry =
      language === "zh"
        ? `招募广告张贴，5 名租客前来市政厅等待分配。`
        : `Recruitment notice posted; 5 tenants arrived at City Hall awaiting assignment.`;
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }, [hasCityHall, tenantRecruitCooldown, language]);

  const handleAssignTenants = useCallback(() => {
    if (pendingTenants <= 0) {
      return;
    }
    const toAssign = Math.min(pendingTenants, availableHousing);
    if (toAssign <= 0) {
      return;
    }
    setPendingTenants((prev) => prev - toAssign);
    setAssignedTenants((prev) => prev + toAssign);
    setTenantMorale((prev) => [...prev, ...Array(toAssign).fill(100)]);
    setTenantTimeout(0);
    const entry =
      language === "zh"
        ? `成功分配 ${toAssign} 名租客入住小屋。`
        : `Successfully assigned ${toAssign} tenants to housing.`;
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }, [pendingTenants, availableHousing, language]);

  const totalAssignedWorkers = useMemo(
    () => Object.values(resourceWorkers).reduce((sum, count) => sum + count, 0),
    [resourceWorkers],
  );

  const idleWorkers = useMemo(
    () => assignedTenants - totalAssignedWorkers,
    [assignedTenants, totalAssignedWorkers],
  );

  const handleAssignWorker = useCallback(
    (resourceKey: ResourceKey) => {
      if (idleWorkers <= 0) {
        return;
      }
      setResourceWorkers((prev) => ({
        ...prev,
        [resourceKey]: (prev[resourceKey] || 0) + 1,
      }));
      const resource = resources.find((r) => r.key === resourceKey);
      const entry =
        language === "zh"
          ? `分配 1 名工人到${resource?.labelZh}采集。`
          : `Assigned 1 worker to ${resource?.label} gathering.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [idleWorkers, resources, language],
  );

  const handleUnassignWorker = useCallback(
    (resourceKey: ResourceKey) => {
      const current = resourceWorkers[resourceKey] || 0;
      if (current <= 0) {
        return;
      }
      setResourceWorkers((prev) => ({
        ...prev,
        [resourceKey]: current - 1,
      }));
      const resource = resources.find((r) => r.key === resourceKey);
      const entry =
        language === "zh"
          ? `从${resource?.labelZh}采集取消 1 名工人。`
          : `Unassigned 1 worker from ${resource?.label} gathering.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    },
    [resourceWorkers, resources, language],
  );

  const handlePayWages = useCallback(() => {
    const totalWage = assignedTenants * WAGE_PER_TENANT_PER_DAY;
    const sunleafResource = resources.find((r) => r.key === "sunleaf");
    if (!sunleafResource || sunleafResource.amount < totalWage) {
      const entry =
        language === "zh"
          ? `向日叶不足，无法支付工资！需要 ${totalWage}，当前仅有 ${sunleafResource?.amount.toFixed(1) || 0}。`
          : `Insufficient sunleaf to pay wages! Need ${totalWage}, have ${sunleafResource?.amount.toFixed(1) || 0}.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
      return false;
    }
    setResources((prev) =>
      prev.map((resource) =>
        resource.key === "sunleaf"
          ? { ...resource, amount: resource.amount - totalWage }
          : resource
      )
    );
    const entry =
      language === "zh"
        ? `已支付工资：${totalWage} 向日叶分发给 ${assignedTenants} 名租客。`
        : `Wages paid: ${totalWage} sunleaf distributed to ${assignedTenants} tenants.`;
    setLog((prev) => [entry, ...prev].slice(0, 6));
    return true;
  }, [assignedTenants, resources, language]);

  const handleAllocateCapacity = useCallback(
    (resourceKey: ResourceKey) => {
      if (!pendingAllocation) {
        return;
      }
      const recipe = RECIPES.find((r) => r.id === pendingAllocation.recipeId);
      if (!recipe) {
        return;
      }
      setResources((prev) =>
        prev.map((r) =>
          r.key === resourceKey ? { ...r, capacity: r.capacity + pendingAllocation.boost } : r,
        ),
      );
      const resource = resources.find((r) => r.key === resourceKey);
      const entry =
        language === "zh"
          ? `「${recipe.nameZh}」分配至${resource?.labelZh}，储量 +${pendingAllocation.boost}。`
          : `"${recipe.name}" allocated to ${resource?.label}; capacity +${pendingAllocation.boost}.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
      setPendingAllocation(null);
    },
    [pendingAllocation, resources, language],
  );

  useEffect(() => {
    if (!STORY_CHAPTERS.length) {
      return;
    }
    const newlyUnlocked: StoryChapter[] = [];
    STORY_CHAPTERS.forEach((chapter) => {
      if (!unlockedChapters.includes(chapter.id) && isTriggerMet(chapter.trigger)) {
        newlyUnlocked.push(chapter);
      }
    });
    if (!newlyUnlocked.length) {
      return;
    }
    const updated = [...unlockedChapters, ...newlyUnlocked.map((chapter) => chapter.id)];
    setUnlockedChapters(updated);
    const latest = newlyUnlocked[newlyUnlocked.length - 1];
    setActiveChapterId(latest.id);
    const entry =
      language === "zh"
        ? `房东公布新章节：「${latest.title}」。`
        : `Landlord posts a new chapter: "${latest.title}".`;
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }, [isTriggerMet, unlockedChapters, language]);

  useEffect(() => {
    if (tick === 0) {
      return;
    }
    setResources((prev) =>
      prev.map((resource) => {
        const workers = resourceWorkers[resource.key] || 0;
        const passiveRate = passiveRates[resource.key] ?? 0;
        const workerRate = resource.rate * workers;
        let totalRate = workerRate + passiveRate;
        if (resource.key === "sunleaf") {
          const seasonMultiplier = SUNLEAF_SEASON_MULTIPLIERS[seasonIndex] || 1;
          totalRate *= seasonMultiplier;
        }
        if (totalRate <= 0) {
          return resource;
        }
        const perPhaseGain = totalRate / (20 / 5);
        if (perPhaseGain === 0) {
          return resource;
        }
        const nextAmount = resource.amount + perPhaseGain;
        const limited = Math.min(resource.capacity, Math.max(0, nextAmount));
        return {
          ...resource,
          amount: limited,
        };
      }),
    );
  }, [tick, resourceWorkers, passiveRates, seasonIndex]);

  useEffect(() => {
    const currentDay = day;
    if (currentDay === lastPayDay || assignedTenants === 0) {
      return;
    }
    if (autoPayWages) {
      const paid = handlePayWages();
      if (paid) {
        setLastPayDay(currentDay);
        return;
      }
    }
    if (currentDay > lastPayDay + 1) {
      setTenantMorale((prev) =>
        prev.map((morale) => Math.max(0, morale - 10))
      );
      const entry =
        language === "zh"
          ? `未支付工资！所有租客心情下降 10%。`
          : `Wages not paid! All tenant morale decreased by 10%.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
      setLastPayDay(currentDay);
    }
  }, [day, lastPayDay, assignedTenants, autoPayWages, handlePayWages, language]);

  useEffect(() => {
    const currentDay = day;
    if (assignedTenants === 0 || tenantMorale.length === 0) {
      return;
    }
    if (currentDay === lastPayDay) {
      return;
    }
    const departures: number[] = [];
    const updatedMorale = tenantMorale.filter((morale, index) => {
      if (morale < 50 && Math.random() < 0.5) {
        departures.push(index);
        return false;
      }
      return true;
    });
    if (departures.length > 0) {
      setTenantMorale(updatedMorale);
      setAssignedTenants((prev) => prev - departures.length);
      const excessWorkers = totalAssignedWorkers - (assignedTenants - departures.length);
      if (excessWorkers > 0) {
        setResourceWorkers((prev) => {
          const updated = { ...prev };
          let toRemove = excessWorkers;
          for (const key of Object.keys(updated) as ResourceKey[]) {
            if (toRemove <= 0) break;
            const remove = Math.min(updated[key], toRemove);
            updated[key] -= remove;
            toRemove -= remove;
          }
          return updated;
        });
      }
      const entry =
        language === "zh"
          ? `${departures.length} 名租客因心情低落而离开。`
          : `${departures.length} tenants left due to low morale.`;
      setLog((prev) => [entry, ...prev].slice(0, 6));
    }
  }, [day, tenantMorale, assignedTenants, totalAssignedWorkers, lastPayDay, language]);

  useEffect(() => {
    const activeStage = TUTORIAL_STAGES[stageIndex];
    if (!activeStage) {
      return;
    }
    const goalsMet = activeStage.goals.every((goal) => {
      const resource = resources.find((item) => item.key === goal.resource);
      if (!resource) {
        return false;
      }
      const value = goal.metric === "capacity" ? resource.capacity : resource.amount;
      return value >= goal.target;
    });
    if (goalsMet && stageIndex < TUTORIAL_STAGES.length - 1) {
      const nextIndex = stageIndex + 1;
      if (nextStageRef.current !== nextIndex) {
        nextStageRef.current = nextIndex;
        const stageTitle = language === "zh" ? TUTORIAL_STAGES[nextIndex].titleZh : TUTORIAL_STAGES[nextIndex].title;
        const stageEntry =
          language === "zh"
            ? `房东敲门催促：「${stageTitle}」已开账。`
            : `Landlord pounds on the door: "${stageTitle}" ledger just opened.`;
        setLog((prev) => [stageEntry, ...prev].slice(0, 6));
      }
      window.setTimeout(() => {
        setStageIndex(nextIndex);
        setShowTutorial(true);
      }, 750);
    }
  }, [resources, stageIndex, language]);

  useEffect(() => {
    if (tick === 0 || tick % (PHASES.length * 2) !== 0) {
      return;
    }
    const entry =
      language === "zh"
        ? isNight
          ? `夜巡队汇报：${phaseDisplay} 将至，天穹宁静。`
          : `${phaseDisplay} 点燃了梯田间的匠人热情。`
        : isNight
          ? `Night watch reports tranquil skies as ${phaseLabel.toLowerCase()} settles.`
          : `${phaseLabel} invigorates artisans across the terraces.`;
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }, [tick, isNight, phaseLabel, phaseDisplay, language]);

  useEffect(() => {
    if (!craftingRecipe || craftingProgress >= 100) {
      return;
    }
    const recipe = RECIPES.find((r) => r.id === craftingRecipe);
    const toolRecipe = TOOL_RECIPES.find((r) => r.id === craftingRecipe);
    const activeRecipe = recipe || toolRecipe;
    if (!activeRecipe) {
      return;
    }
    const id = window.setInterval(() => {
      setCraftingProgress((prev) => {
        const next = prev + 1;
        if (next >= activeRecipe.craftTime) {
          if (recipe) {
            setPendingAllocation({ recipeId: craftingRecipe, boost: recipe.capacityBoost });
          } else if (toolRecipe) {
            setEquippedTools((prevTools) => ({ ...prevTools, [toolRecipe.toolType]: toolRecipe.id }));
            const entry =
              language === "zh"
                ? `「${toolRecipe.nameZh}」制作完成，已装备。`
                : `"${toolRecipe.name}" crafting complete; equipped.`;
            setLog((prev) => [entry, ...prev].slice(0, 6));
          }
          setCraftingRecipe(null);
          if (recipe) {
            const entry =
              language === "zh"
                ? `「${recipe.nameZh}」制作完成，请分配储量提升。`
                : `"${recipe.name}" crafting complete; allocate capacity boost.`;
            setLog((prev) => [entry, ...prev].slice(0, 6));
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [craftingRecipe, craftingProgress, language]);

  const canExecute = useCallback(
    (action: Action) =>
      !action.delta ||
      resources.every((resource) => {
        const change = action.delta?.[resource.key] ?? 0;
        if (change >= 0) {
          return true;
        }
        return resource.amount + change >= 0;
      }),
    [resources],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState === 'playing') {
        setGameState('paused');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    const checkLastSave = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        let lastSave: string | null = null;
        
        if (window.go?.main?.SaveManager) {
          lastSave = await window.go.main.SaveManager.GetLastSave();
        } else {
          lastSave = localStorage.getItem('lastSaveName');
        }
        
        setHasLastSave(Boolean(lastSave));
      } catch (error) {
        console.error('Failed to check last save:', error);
        setHasLastSave(false);
      }
    };
    
    checkLastSave();
  }, [gameState]);

  useEffect(() => {
    const loadSaves = async () => {
      if (!showSaveListDialog || typeof window === 'undefined') return;
      
      try {
        if (window.go?.main?.SaveManager) {
          const saves = await window.go.main.SaveManager.GetAllSaves();
          setAvailableSaves(saves.sort());
        } else {
          const saves: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('save_')) {
              saves.push(key.replace('save_', ''));
            }
          }
          setAvailableSaves(saves.sort());
        }
      } catch (error) {
        console.error('Failed to get saves:', error);
        setAvailableSaves([]);
      }
    };
    
    loadSaves();
  }, [showSaveListDialog]);

  const handleNewGame = useCallback(() => {
    if (!newGameName.trim()) {
      return;
    }
    setResources(INITIAL_RESOURCES);
    setTick(0);
    setStageIndex(0);
    setShowTutorial(false);
    setShowIntroDialogue(true);
    setIntroIndex(0);
    setUnlockedChapters(initialChapterId ? [initialChapterId] : []);
    setActiveChapterId(initialChapterId);
    setMilestones([]);
    setCompletedPurchases([]);
    setPurchaseCounts({});
    setCivilizationLevel(0);
    setManualCooldowns({ sunleaf: 0, wood: 0, stone: 0, science: 0, energy: 0, execution: 0 });
    setManualHarvestActive({ sunleaf: false, wood: false, stone: false, science: false, energy: false, execution: false });
    setLog(localizedDefaults);
    setDistricts(DISTRICTS);
    setCraftingRecipe(null);
    setCraftingProgress(0);
    setEquippedTools({});
    setFacilityCounts(INITIAL_FACILITY_COUNTS);
    setSelectedFacilityId(null);
    setTenantRecruitCooldown(0);
    setPendingTenants(0);
    setTenantTimeout(0);
    setAssignedTenants(0);
    setTenantMorale([]);
    setAutoPayWages(false);
    setLastPayDay(0);
    setSkills(INITIAL_SKILLS);
    setResourceWorkers({ sunleaf: 0, wood: 0, stone: 0, science: 0, energy: 0, execution: 0 });
    setManuallyUnlockedResources([]);
    setCurrentSaveName(newGameName.trim());
    saveGame(newGameName.trim());
    setGameState('playing');
    setShowNewGameDialog(false);
    setNewGameName("");
  }, [newGameName, initialChapterId, localizedDefaults, saveGame]);

  const getAllSaves = useCallback(async () => {
    if (typeof window === 'undefined') return [];
    
    try {
      if (window.go?.main?.SaveManager) {
        // Use Wails API
        const saves = await window.go.main.SaveManager.GetAllSaves();
        return saves.sort();
      } else {
        // Fallback to localStorage for development
        const saves: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('save_')) {
            saves.push(key.replace('save_', ''));
          }
        }
        return saves.sort();
      }
    } catch (error) {
      console.error('Failed to get saves:', error);
      return [];
    }
  }, []);

  const handleContinueGame = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      let lastSave: string | null = null;
      
      if (window.go?.main?.SaveManager) {
        lastSave = await window.go.main.SaveManager.GetLastSave();
      } else {
        lastSave = localStorage.getItem('lastSaveName');
      }
      
      if (lastSave && await loadGame(lastSave)) {
        setGameState('playing');
      }
    } catch (error) {
      console.error('Failed to continue game:', error);
    }
  }, [loadGame]);

  const handleLoadSelectedSave = useCallback(async (saveName: string) => {
    if (await loadGame(saveName)) {
      setGameState('playing');
      setShowSaveListDialog(false);
    }
  }, [loadGame]);

  const handleSaveAndExit = useCallback(() => {
    if (currentSaveName) {
      saveGame(currentSaveName);
    }
    setGameState('main-menu');
  }, [currentSaveName, saveGame]);

  const handleAction = (action: Action) => {
    if (!canExecute(action)) {
      return;
    }
    setResources((prev) => {
      let next = prev.map((resource) => ({ ...resource }));
      if (action.delta) {
        next = applyResourceDelta(next, action.delta);
      }
      if (action.rateDelta && !action.duration) {
        next = applyRateDelta(next, action.rateDelta);
      }
      if (action.capacityDelta) {
        next = applyCapacityDelta(next, action.capacityDelta);
      }
      return next;
    });
    if (action.duration && action.rateDelta) {
      const durationInTicks = Math.ceil(action.duration / (PHASE_INTERVAL_MS / 1000));
      const rateDelta = action.rateDelta;
      setActiveBoosts((prev) => [
        ...prev.filter((b) => b.actionId !== action.id),
        {
          actionId: action.id,
          label: action.label,
          labelZh: action.labelZh,
          remainingTicks: durationInTicks,
          totalDuration: durationInTicks,
          rateDelta,
        },
      ]);
    }
    const entry = language === "zh" ? action.logZh : action.log;
    setLog((prev) => [entry, ...prev].slice(0, 6));
  };

  if (gameState === 'main-menu') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/90 to-primary/10">
        <div className="w-full max-w-md space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">{language === "zh" ? "天机谷传奇" : "Valley Legend"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{language === "zh" ? "欢迎回到山谷" : "Welcome to the Valley"}</p>
          </div>
          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setShowNewGameDialog(true)}
              type="button"
            >
              {language === "zh" ? "新游戏" : "New Game"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              disabled={!hasLastSave}
              onClick={handleContinueGame}
              type="button"
            >
              {language === "zh" ? "继续游戏" : "Continue"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => setShowSaveListDialog(true)}
              type="button"
            >
              {language === "zh" ? "选择存档" : "Select Save"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => {}}
              type="button"
            >
              {language === "zh" ? "设置" : "Settings"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => setShowAboutDialog(true)}
              type="button"
            >
              {language === "zh" ? "关于" : "About"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => window.close()}
              type="button"
            >
              {language === "zh" ? "退出" : "Exit"}
            </Button>
          </div>
        </div>
        {showNewGameDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <h2 className="text-lg font-semibold">{language === "zh" ? "新游戏" : "New Game"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {language === "zh" ? "请输入存档名称" : "Enter save name"}
              </p>
              <input
                type="text"
                className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2"
                placeholder={language === "zh" ? "存档名称" : "Save name"}
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNewGame();
                  }
                }}
              />
              <div className="mt-6 flex gap-3">
                <Button
                  className="flex-1"
                  onClick={handleNewGame}
                  disabled={!newGameName.trim()}
                  type="button"
                >
                  {language === "zh" ? "开始" : "Start"}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setShowNewGameDialog(false);
                    setNewGameName("");
                  }}
                  type="button"
                >
                  {language === "zh" ? "取消" : "Cancel"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {showSaveListDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <h2 className="text-lg font-semibold">{language === "zh" ? "选择存档" : "Select Save"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {language === "zh" ? "选择要加载的存档" : "Choose a save to load"}
              </p>
              <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                {availableSaves.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {language === "zh" ? "暂无存档" : "No saves found"}
                  </p>
                ) : (
                  availableSaves.map((saveName) => (
                    <button
                      key={saveName}
                      className="w-full rounded-lg border border-border bg-background/60 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => handleLoadSelectedSave(saveName)}
                    >
                      <p className="text-sm font-semibold">{saveName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {language === "zh" ? "点击加载" : "Click to load"}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <Button
                className="mt-6 w-full"
                variant="outline"
                onClick={() => setShowSaveListDialog(false)}
                type="button"
              >
                {language === "zh" ? "取消" : "Cancel"}
              </Button>
            </div>
          </div>
        )}
        {showAboutDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <h2 className="text-lg font-semibold">{language === "zh" ? "关于" : "About"}</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                {language === "zh" ? "天机谷传奇" : "Valley Legend"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {language === "zh" ? "版本 1.0.0" : "Version 1.0.0"}
              </p>
              <Button
                className="mt-6 w-full"
                onClick={() => setShowAboutDialog(false)}
                type="button"
              >
                {language === "zh" ? "关闭" : "Close"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'paused') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/90 to-primary/10">
        <div className="w-full max-w-md space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">{language === "zh" ? "游戏暂停" : "Game Paused"}</h1>
          </div>
          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setGameState('playing')}
              type="button"
            >
              {language === "zh" ? "继续游戏" : "Continue"}
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={handleSaveAndExit}
              type="button"
            >
              {language === "zh" ? "保存并退出" : "Save & Exit"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-primary/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        {showIntroDialogue && gameState === 'playing' ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                    {language === "zh" ? "开场对话" : "Opening Dialogue"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">
                    {language === "zh"
                      ? INTRO_DIALOGUE[introIndex].speakerZh
                      : INTRO_DIALOGUE[introIndex].speaker}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <LanguageToggle />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => {
                      setShowIntroDialogue(false);
                      setShowTutorial(true);
                    }}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {language === "zh"
                  ? INTRO_DIALOGUE[introIndex].textZh
                  : INTRO_DIALOGUE[introIndex].text}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (introIndex < INTRO_DIALOGUE.length - 1) {
                      setIntroIndex((prev) => prev + 1);
                    } else {
                      setShowIntroDialogue(false);
                      setShowTutorial(true);
                    }
                  }}
                  type="button"
                >
                  {introIndex < INTRO_DIALOGUE.length - 1
                    ? language === "zh"
                      ? "继续"
                      : "Continue"
                    : language === "zh"
                      ? "开启教学"
                      : "Begin Tutorial"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowIntroDialogue(false);
                    setShowTutorial(true);
                  }}
                  type="button"
                >
                  {language === "zh" ? "跳过" : "Skip"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedDistrict?.id === "terraced-fields" ? (
          <div className="pointer-events-none fixed top-6 left-1/2 z-[60] -translate-x-1/2">
            <div className="rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-center shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">
                {language === "zh" ? "向日叶概览" : "Sunleaf Summary"}
              </p>
              <p className="mt-1 text-sm text-primary">
                {language === "zh"
                  ? `当前储量：${sunleafResource?.amount.toFixed(1) ?? "0.0"}`
                  : `Current Stock: ${sunleafResource?.amount.toFixed(1) ?? "0.0"}`}
              </p>
              <p className="text-xs text-primary/80">
                {language === "zh"
                  ? `当前产量倍率：×${sunleafTotalMultiplier.toFixed(2)}`
                  : `Current Yield Multiplier: ×${sunleafTotalMultiplier.toFixed(2)}`}
              </p>
            </div>
          </div>
        ) : null}

        {selectedDistrict ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-2xl rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                    {languageLabels.districtDetailTitle}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">
                    {language === "zh" ? selectedDistrict.titleZh : selectedDistrict.title}
                  </h2>
                  <Badge variant="accent" className="mt-2 text-[11px] uppercase tracking-wide">
                    {language === "zh" ? selectedDistrict.focusZh : selectedDistrict.focus}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={handleCloseDistrictDetail}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {language === "zh" ? selectedDistrict.descriptionZh : selectedDistrict.description}
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {languageLabels.districtDetailBuildingCount}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{selectedDistrict.buildingCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {languageLabels.districtDetailExpansionCost}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(selectedDistrict.expansionCost).map(([key, cost]) => {
                      const resource = resources.find((r) => r.key === key);
                      if (!resource) return null;
                      const RateIcon = resource.icon;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                        >
                          <RateIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {cost > 0 ? `+${cost}` : cost}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {languageLabels.districtOutputLabel}
                    </p>
                    <Progress value={selectedDistrict.progress} className="mt-2" />
                    <p className="mt-1 text-xs text-muted-foreground">{selectedDistrict.progress}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {languageLabels.districtStabilityLabel}
                    </p>
                    <Progress value={selectedDistrict.stability} className="mt-2 bg-muted/40" />
                    <p className="mt-1 text-xs text-muted-foreground">{selectedDistrict.stability}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canAffordExpansion(selectedDistrict)}
                  onClick={() => {
                    handleExpand(selectedDistrict.id);
                    handleCloseDistrictDetail();
                  }}
                  type="button"
                >
                  {language === "zh" ? "扩建" : "Expand"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedDistrict.buildingCount <= 0}
                  onClick={() => {
                    handleDemolish(selectedDistrict.id);
                    handleCloseDistrictDetail();
                  }}
                  type="button"
                >
                  {language === "zh" ? "拆除" : "Demolish"}
                </Button>
                <Button size="sm" onClick={handleCloseDistrictDetail} type="button">
                  {languageLabels.districtDetailClose}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingAllocation ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                    {languageLabels.recipeAllocate}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">
                    {languageLabels.recipeAllocatePrompt}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setPendingAllocation(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {language === "zh"
                  ? `选择一个资源类型来增加 +${pendingAllocation.boost} 储量。`
                  : `Select a resource type to increase capacity by +${pendingAllocation.boost}.`}
              </p>
              <div className="mt-6 grid gap-3">
                {unlockedResources.map((resource) => {
                  const RateIcon = resource.icon;
                  return (
                    <Button
                      key={resource.key}
                      variant="outline"
                      className="flex h-auto items-center justify-between gap-4 p-4"
                      onClick={() => handleAllocateCapacity(resource.key)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <RateIcon className="h-5 w-5" />
                        <span className="text-sm font-semibold">
                          {language === "zh" ? resource.labelZh : resource.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {resource.capacity} → {resource.capacity + pendingAllocation.boost}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {showTutorial && activeStage && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="relative w-full max-w-xl rounded-3xl border border-border/60 bg-card/95 p-8 shadow-lg">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Stage {activeStage.index + 1}</p>
                    <h2 className="text-xl font-semibold tracking-tight">{activeStage.title}</h2>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={handleDismissTutorial}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {language === "zh" ? activeStage.introZh : activeStage.intro}
              </p>
              {stageGoals.length > 0 ? (
                <div className="mt-6 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {language === "zh" ? languageLabels.tutorialObjectives : languageLabels.tutorialObjectives}
                        </span>
                        <span>{stageCompletionPercent}%</span>
                      </div>
                      <Progress value={stageCompletionPercent} className="mt-2" />
                    </div>
                    {cycleDeadlineInfo ? (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-primary">
                          <span>{language === "zh" ? languageLabels.tutorialCycleDeadlineLabel : languageLabels.tutorialCycleDeadlineLabel}</span>
                          <span>
                            {language === "zh"
                              ? languageLabels.tutorialCycleDeadlineProgress(
                                  cycleDeadlineInfo.currentCycleNumber,
                                  cycleDeadlineInfo.deadline,
                                )
                              : languageLabels.tutorialCycleDeadlineProgress(
                                  cycleDeadlineInfo.currentCycleNumber,
                                  cycleDeadlineInfo.deadline,
                                )}
                          </span>
                        </div>
                        <Progress value={cycleDeadlineInfo.percent} className="mt-2 h-2" />
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {language === "zh"
                              ? languageLabels.tutorialCycleDeadlineRemaining(cycleDeadlineInfo.remaining)
                              : languageLabels.tutorialCycleDeadlineRemaining(cycleDeadlineInfo.remaining)}
                          </span>
                          {cycleDeadlineInfo.exceeded ? (
                            <span className="text-destructive">
                              {language === "zh"
                                ? languageLabels.tutorialCycleDeadlineExceeded
                                : languageLabels.tutorialCycleDeadlineExceeded}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {stageGoals.map((goal) => {
                      const { currentDisplay, percent } = getGoalProgress(goal);
                      return (
                        <div key={goal.label} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === "zh" ? goal.labelZh : goal.label}</span>
                            <span>
                              {currentDisplay} / {goal.target}
                            </span>
                          </div>
                          <Progress value={percent} className="mt-2 h-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  {language === "zh" ? languageLabels.tutorialEmpty : languageLabels.tutorialEmpty}
                </div>
              )}
              {stageUnlocks.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                    {language === "zh" ? languageLabels.tutorialUnlocks : languageLabels.tutorialUnlocks}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {stageUnlocks.map((entry) => (
                      <li key={entry} className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                        <span>
                          {language === "zh"
                            ? activeStage.unlocksZh[activeStage.unlocks.indexOf(entry)] ?? entry
                            : entry}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <Button variant="outline" className="rounded-full" onClick={handleDismissTutorial} type="button">
                  {languageLabels.backToWorkLabel}
                </Button>
              </div>
            </div>
          </div>
        )}

        <header className="rounded-3xl border border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {activeStage ? (
                  <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Stage {activeStage.index + 1}
                  </Badge>
                ) : null}
                <Badge variant="accent" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase">
                  <Mountain className="h-3 w-3" />
                  {eraLabel}
                </Badge>
                <Badge variant="outline" className="bg-background/70 px-3 py-1 text-[10px] uppercase">
                  {languageLabels.bannerLabel}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase">
                  <Clock className="h-3 w-3" />
                  {cycleLabel}
                </Badge>
                <Badge className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase">
                  <PhaseIcon className="h-3 w-3" />
                  {phaseDisplay}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LanguageToggle />
                {!showTutorial && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setShowTutorial(true)}
                    type="button"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {language === "zh" ? "查看教程" : "View Tutorial"}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="inline-flex gap-2 rounded-full border border-border bg-background/50 p-1">
                <Button
                  variant={activePanel === "resources" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("resources")}
                  type="button"
                >
                  {language === "zh" ? "资源" : "Resources"}
                </Button>
                <Button
                  variant={activePanel === "facilities" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("facilities")}
                  type="button"
                >
                  {language === "zh" ? "设施" : "Facilities"}
                </Button>
                <Button
                  variant={activePanel === "council" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("council")}
                  type="button"
                >
                  {language === "zh" ? "记录" : "Records"}
                </Button>
                <Button
                  variant={activePanel === "crafting" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("crafting")}
                  type="button"
                >
                  {language === "zh" ? "制造" : "Crafting"}
                </Button>
                <Button
                  variant={activePanel === "story" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("story")}
                  type="button"
                >
                  {language === "zh" ? "任务" : "Story"}
                </Button>
                <Button
                  variant={activePanel === "citizens" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("citizens")}
                  type="button"
                >
                  {language === "zh" ? "市民" : "Citizens"}
                </Button>
                <Button
                  variant={activePanel === "settings" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActivePanel("settings")}
                  type="button"
                >
                  {language === "zh" ? "设置" : "Settings"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-6 px-2">
            {activePanel === "resources" && (<>
            <Card>
              <CardHeader>
                <CardTitle>{languageLabels.resourceLedgerTitle}</CardTitle>
                <CardDescription>{languageLabels.resourceLedgerDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4" style={{ minWidth: "max-content" }}>
                    {unlockedResources.map((resource) => {
                      const RateIcon = resource.icon;
                      const workers = resourceWorkers[resource.key] || 0;
                      const effectiveRate = workers > 0 ? resource.rate * workers : resource.rate;
                      const hasProduction = effectiveRate > 0;
                      let displayRate = effectiveRate;
                      if (resource.key === "sunleaf" && hasProduction) {
                        const seasonMultiplier = SUNLEAF_SEASON_MULTIPLIERS[seasonIndex] || 1;
                        displayRate = effectiveRate * seasonMultiplier;
                      }
                      const rateLabel = hasProduction
                        ? `${displayRate >= 0 ? "+" : ""}${displayRate.toFixed(1)}`
                        : "";
                      const progress = Math.min(100, (resource.amount / resource.capacity) * 100);
                      const cooldown = manualCooldowns[resource.key];
                      const reward = MANUAL_HARVEST_REWARDS[resource.key];
                      const rewardAmount = reward ? Object.values(reward)[0] : 0;
                      const minutes = Math.floor(cooldown / 60);
                      const seconds = cooldown % 60;
                      const cooldownLabel = cooldown > 0
                        ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
                        : language === "zh" ? "收集" : "Harvest";
                      return (
                        <div
                          key={resource.key}
                          className="flex w-64 flex-shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
                              <RateIcon className="h-6 w-6 text-muted-foreground" />
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">
                                {language === "zh" ? resource.labelZh : resource.label}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>
                                  {resource.amount.toFixed(1)} / {resource.capacity}
                                </span>
                                {hasProduction && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {rateLabel}/cycle
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <Button
                            size="sm"
                            disabled={cooldown > 0}
                            onClick={() => handleManualHarvest(resource.key)}
                            type="button"
                            className="w-full"
                          >
                            <RateIcon className="mr-1.5 h-3.5 w-3.5" />
                            {cooldownLabel}
                            {cooldown === 0 && (
                              <span className="ml-1.5 text-[10px] opacity-70">+{rewardAmount}</span>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                    {lockedResources.map((resource) => {
                      const unlockInfo = RESOURCE_UNLOCK_DATA[resource.key];
                      const stageRequirement = unlockInfo?.stage;
                      const hasCostUnlock = unlockInfo?.cost != null;
                      const canAffordUnlock = hasCostUnlock && resources.every((r) => {
                        const cost = unlockInfo.cost?.[r.key] ?? 0;
                        return r.amount + cost >= 0;
                      });
                      const unlockDescription = stageRequirement != null
                        ? language === "zh"
                          ? languageLabels.districtLocked(TUTORIAL_STAGES[stageRequirement].titleZh)
                          : languageLabels.districtLocked(TUTORIAL_STAGES[stageRequirement].title)
                        : language === "zh"
                          ? unlockInfo?.costLabelZh ?? "通过议会指令解锁。"
                          : unlockInfo?.costLabel ?? "Unlock via council directive.";
                      return (
                        <div
                          key={resource.key}
                          className="flex w-64 flex-shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
                            <Lock className="h-6 w-6 text-muted-foreground" />
                          </span>
                          <p className="text-sm font-semibold text-muted-foreground">
                            {language === "zh" ? resource.labelZh : resource.label}
                          </p>
                          <p className="text-center text-xs text-muted-foreground">
                            {unlockDescription}
                          </p>
                          {hasCostUnlock ? (
                            <Button
                              size="sm"
                              disabled={!canAffordUnlock}
                              onClick={() => handleUnlockResource(resource.key)}
                              type="button"
                              className="w-full"
                            >
                              {language === "zh" ? "解锁" : "Unlock"}
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {languageLabels.lockedBadge}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{languageLabels.dispatchTitle}</CardTitle>
                <CardDescription>{languageLabels.dispatchDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-3">
                  <div className="flex gap-3" style={{ minWidth: "max-content" }}>
                    {log.map((entry, index) => {
                      const badgeLabel = index === 0 ? languageLabels.dispatchBadgeNow : languageLabels.dispatchBadgePast(index);
                      const phaseIndexShifted = (phaseIndex + PHASES.length - index) % PHASES.length;
                      const phaseName = language === "zh" ? ["黎明", "炽光", "暮色", "夜巡"][phaseIndexShifted] : PHASES[phaseIndexShifted];
                      return (
                        <div
                          key={`${entry}-${index}`}
                          className={cn(
                            "flex w-80 flex-shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-background/60 p-3 shadow-sm",
                            index === 0 && "border-primary/60 bg-primary/10",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {badgeLabel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{phaseName}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{entry}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>  
        )}

            {activePanel === "facilities" && (<Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleCard("districts")}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{language === "zh" ? "山谷管理" : "Valley Management"}</CardTitle>
                    <CardDescription>
                      {language === "zh" ? "管理山谷区域与设施。" : "Manage valley districts and facilities."}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
                    {expandedCards.districts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {expandedCards.districts && (<CardContent className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    {language === "zh" ? "山谷区域" : "Valley Districts"}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {unlockedDistricts.map((district) => (
                    <div
                      key={district.title}
                      className="cursor-pointer rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => handleDistrictClick(district)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {language === "zh" ? district.titleZh : district.title}
                        </p>
                        <Badge variant="accent" className="text-[11px] uppercase tracking-wide">
                          {language === "zh" ? district.focusZh : district.focus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {language === "zh" ? district.descriptionZh : district.description}
                      </p>
                      <div className="mt-4 space-y-2">
                        <div>
                          <Progress value={district.progress} />
                          <p className="mt-1 text-xs text-muted-foreground">Output tide {district.progress}%</p>
                        </div>
                        <div>
                          <Progress value={district.stability} className="bg-muted/40" />
                          <p className="mt-1 text-xs text-muted-foreground">Stability {district.stability}%</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {language === "zh" ? "建筑数量" : "Building Count"}: {district.buildingCount}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canAffordExpansion(district)}
                            onClick={() => handleExpand(district.id)}
                            type="button"
                          >
                            {language === "zh" ? "扩建" : "Expand"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={district.buildingCount <= 0}
                            onClick={() => handleDemolish(district.id)}
                            type="button"
                          >
                            {language === "zh" ? "拆除" : "Demolish"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    {language === "zh" ? "设施管理" : "Facility Management"}
                  </h3>
                  <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary text-center">
                      {languageLabels.tenantRecruitTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        size="sm"
                        disabled={!hasCityHall || tenantRecruitCooldown > 0}
                        onClick={handleRecruitTenants}
                        type="button"
                        className="rounded-full px-6"
                      >
                        {tenantRecruitCooldown > 0
                          ? languageLabels.tenantRecruitCooldown(
                              `${Math.floor(tenantRecruitCooldown / 60)}:${String(tenantRecruitCooldown % 60).padStart(2, "0")}`,
                            )
                          : languageLabels.tenantRecruitButton}
                      </Button>
                      {pendingTenants > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={availableHousing <= 0}
                          onClick={handleAssignTenants}
                          type="button"
                          className="rounded-full px-6"
                        >
                          {languageLabels.tenantAssignButton}
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <div className="rounded-xl bg-primary/10 px-3 py-2 text-center">
                        <p className="font-semibold text-primary">
                          {language === "zh" ? "总容量" : "Total Capacity"}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{totalHousingCapacity}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-3 py-2 text-center">
                        <p className="font-semibold">
                          {languageLabels.tenantAssigned(assignedTenants)}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{assignedTenants}</p>
                      </div>
                      <div className="rounded-xl bg-muted/20 px-3 py-2 text-center">
                        <p className="font-semibold">
                          {language === "zh" ? "剩余床位" : "Beds Available"}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{Math.max(0, availableHousing)}</p>
                      </div>
                    </div>
                    {!hasCityHall && (
                      <p className="mt-3 text-center text-xs text-destructive">{languageLabels.tenantNoCityHall}</p>
                    )}
                    {pendingTenants > 0 && availableHousing <= 0 && (
                      <p className="mt-3 text-center text-xs text-destructive">{languageLabels.tenantNoCapacity}</p>
                    )}
                    {pendingTenants > 0 && tenantTimeout > 0 ? (
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        {languageLabels.tenantTimeout(
                          `${Math.floor(tenantTimeout / 60)}:${String(tenantTimeout % 60).padStart(2, "0")}`,
                        )}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {unlockedFacilities.map((facility) => {
                      const builtCount = facilityCounts[facility.id] ?? 0;
                      const isSelected = selectedFacilityId === facility.id;
                      return (
                        <button
                          key={facility.id}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left shadow-sm transition hover:border-primary/60 hover:bg-primary/10",
                            isSelected ? "border-primary/60 bg-primary/10" : "border-border/60 bg-background/60",
                          )}
                          onClick={() => setSelectedFacilityId(facility.id)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {language === "zh" ? facility.nameZh : facility.name}
                            </p>
                            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                              {languageLabels.facilityCapacity(facility.capacity)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {language === "zh" ? facility.descriptionZh : facility.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{languageLabels.facilityBuilt(builtCount)}</span>
                            <span>
                              {languageLabels.recipeCost}:
                              <span className="ml-2 inline-flex items-center gap-2">
                                {Object.entries(facility.cost).map(([key, cost]) => {
                                  const resource = resources.find((r) => r.key === key);
                                  if (!resource) return null;
                                  const RateIcon = resource.icon;
                                  return (
                                    <span key={key} className="inline-flex items-center gap-1">
                                      <RateIcon className="h-3.5 w-3.5" />
                                      {Math.abs(cost)}
                                    </span>
                                  );
                                })}
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedFacility ? (
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">
                            {language === "zh" ? selectedFacility.nameZh : selectedFacility.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "zh" ? selectedFacility.descriptionZh : selectedFacility.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAffordFacility(selectedFacility)}
                          onClick={() => handleBuildFacility(selectedFacility.id)}
                          type="button"
                          className="self-start"
                        >
                          {languageLabels.facilityBuild}
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/30 p-3">
                          <p className="font-semibold text-foreground">
                            {language === "zh" ? "累计建造" : "Built"}
                          </p>
                          <p className="mt-1 text-sm">
                            {selectedFacilityDetails?.builtCount ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/20 p-3">
                          <p className="font-semibold text-foreground">
                            {language === "zh" ? "总容量" : "Capacity"}
                          </p>
                          <p className="mt-1 text-sm">
                            {selectedFacilityDetails?.totalCapacity ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/20 p-3">
                          <p className="font-semibold text-foreground">
                            {language === "zh" ? "预估入住" : "Estimated Residents"}
                          </p>
                          <p className="mt-1 text-sm">
                            {selectedFacilityDetails?.residents ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/20 p-3">
                          <p className="font-semibold text-foreground">
                            {language === "zh" ? "剩余床位" : "Beds Available"}
                          </p>
                          <p className="mt-1 text-sm">
                            {selectedFacilityDetails?.available ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={selectedFacilityDetails?.utilization ?? 0} className="h-2" />
                        <p className="mt-1 text-right text-[11px] text-muted-foreground">
                          {language === "zh"
                            ? `入住率：${Math.round(selectedFacilityDetails?.utilization ?? 0)}%`
                            : `Utilization: ${Math.round(selectedFacilityDetails?.utilization ?? 0)}%`}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>)}
            </Card>)}

            {activePanel === "council" && (<Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleCard("council")}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{languageLabels.councilTitle}</CardTitle>
                    <CardDescription>{languageLabels.councilDescription}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
                    {expandedCards.council ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {expandedCards.council && (<CardContent className="space-y-4">
                {activeBoosts.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      {language === "zh" ? "激活的增益" : "Active Boosts"}
                    </p>
                    {activeBoosts.map((boost) => {
                      const remainingSeconds = Math.ceil(boost.remainingTicks * (PHASE_INTERVAL_MS / 1000));
                      const totalSeconds = Math.ceil(boost.totalDuration * (PHASE_INTERVAL_MS / 1000));
                      const progress = (boost.remainingTicks / boost.totalDuration) * 100;
                      const minutes = Math.floor(remainingSeconds / 60);
                      const seconds = remainingSeconds % 60;
                      return (
                        <div
                          key={boost.actionId}
                          className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-primary">
                              {language === "zh" ? boost.labelZh : boost.label}
                            </p>
                            <Badge variant="outline" className="text-[11px] text-primary">
                              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                            </Badge>
                          </div>
                          <Progress value={progress} className="mt-3 h-2" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {Object.entries(boost.rateDelta).map(([key, value]) => {
                              const resource = resources.find((r) => r.key === key);
                              if (!resource) return null;
                              return (
                                <span key={key}>
                                  {language === "zh" ? resource.labelZh : resource.label} +{Math.round((value ?? 0) * 100)}%
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {unlockedActions.map((action) => {
                  const disabled = !canExecute(action);
                  return (
                    <div key={action.id} className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {language === "zh" ? action.labelZh : action.label}
                        </p>
                        <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                          {action.cooldown}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {language === "zh" ? action.descriptionZh : action.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span>{language === "zh" ? action.costZh : action.cost}</span>
                        <Button size="sm" disabled={disabled} onClick={() => handleAction(action)} type="button">
                          {disabled
                            ? language === "zh"
                              ? languageLabels.councilInsufficient
                              : languageLabels.councilInsufficient
                            : language === "zh"
                              ? languageLabels.councilEnact
                              : languageLabels.councilEnact}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {lockedActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-muted/10 p-4 text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {language === "zh" ? action.labelZh : action.label}
                        </p>
                        <p>
                          {language === "zh"
                            ? "准备迎接更难的决策吧，房东已经安排妥当。"
                            : "Get ready to make some tough decisions, landlord's got a plan for you."}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                      {language === "zh"
                        ? `${languageLabels.councilUnlocksDuring} ${TUTORIAL_STAGES[action.requiredStage].titleZh}`
                        : `${languageLabels.councilUnlocksDuring} ${TUTORIAL_STAGES[action.requiredStage].title}`}
                    </Badge>
                  </div>
                ))}
              </CardContent>)}
            </Card>)}

            {activePanel === "crafting" && (<Card>
              <CardHeader>
                <CardTitle>{language === "zh" ? "制作工坊" : "Crafting Workshop"}</CardTitle>
                <CardDescription>
                  {language === "zh" ? "使用图纸制作工具与器具。" : "Use blueprints to craft tools and items."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showBlueprintSelector ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="flex-1"
                      onClick={() => setShowBlueprintSelector(true)}
                      type="button"
                    >
                      {language === "zh" ? "使用现有图纸" : "Use Existing Blueprints"}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      disabled
                      type="button"
                    >
                      {language === "zh" ? "购买图纸" : "Purchase Blueprints"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant={selectedBlueprintCategory === "items" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedBlueprintCategory("items")}
                          type="button"
                        >
                          {language === "zh" ? "器具" : "Items"}
                        </Button>
                        <Button
                          variant={selectedBlueprintCategory === "tools" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedBlueprintCategory("tools")}
                          type="button"
                        >
                          {language === "zh" ? "工具" : "Tools"}
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowBlueprintSelector(false);
                          setSelectedBlueprintCategory(null);
                        }}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {selectedBlueprintCategory === "items" && (
                      <>
                {unlockedRecipes.map((recipe) => {
                  const disabled = !canAffordRecipe(recipe) || Boolean(craftingRecipe);
                  const isCrafting = craftingRecipe === recipe.id;
                  const progress = isCrafting ? Math.min(100, (craftingProgress / recipe.craftTime) * 100) : 0;
                  return (
                    <div key={recipe.id} className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {language === "zh" ? recipe.nameZh : recipe.name}
                        </p>
                        {isCrafting ? (
                          <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                            {languageLabels.recipeCrafting}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {language === "zh" ? recipe.descriptionZh : recipe.description}
                      </p>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{languageLabels.recipeCost}:</span>
                          <div className="flex gap-2">
                            {Object.entries(recipe.cost).map(([key, cost]) => {
                              const resource = resources.find((r) => r.key === key);
                              if (!resource) return null;
                              const RateIcon = resource.icon;
                              return (
                                <div key={key} className="flex items-center gap-1">
                                  <RateIcon className="h-3.5 w-3.5" />
                                  <span>{Math.abs(cost)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{languageLabels.recipeCraftTime}:</span>
                          <span>{recipe.craftTime}s</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{languageLabels.recipeCapacityBoost}:</span>
                          <span>+{recipe.capacityBoost}</span>
                        </div>
                      </div>
                      {isCrafting ? (
                        <div className="mt-3 space-y-1.5">
                          <Progress value={progress} />
                          <p className="text-xs text-muted-foreground">
                            {craftingProgress}s / {recipe.craftTime}s
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => handleStartCraft(recipe.id)}
                            type="button"
                          >
                            {languageLabels.recipeStartCraft}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {lockedRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-muted/10 p-4 text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {language === "zh" ? recipe.nameZh : recipe.name}
                        </p>
                        <p>
                          {language === "zh"
                            ? `解锁于 ${TUTORIAL_STAGES[recipe.requiredStage].titleZh}。`
                            : `Unlocks during ${TUTORIAL_STAGES[recipe.requiredStage].title}.`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                      {languageLabels.lockedBadge}
                    </Badge>
                  </div>
                ))}
                      </>
                    )}

                    {selectedBlueprintCategory === "tools" && (
                      <>
                        <div className="flex gap-2">
                          {(["wooden", "stone", "celestial", "alloy"] as ToolMaterial[]).map((material) => {
                            const unlocked = stageIndex >= TOOL_MATERIAL_UNLOCK_STAGE[material];
                            const materialLabels: Record<ToolMaterial, { en: string; zh: string }> = {
                              wooden: { en: "Wooden", zh: "木质" },
                              stone: { en: "Stone", zh: "石质" },
                              celestial: { en: "Celestial", zh: "天梭" },
                              alloy: { en: "Alloy", zh: "合金" },
                            };
                            return (
                              <Button
                                key={material}
                                variant={selectedMaterial === material ? "default" : "outline"}
                                size="sm"
                                disabled={!unlocked}
                                onClick={() => setSelectedMaterial(material)}
                                type="button"
                              >
                                {language === "zh" ? materialLabels[material].zh : materialLabels[material].en}
                              </Button>
                            );
                          })}
                        </div>
                        {TOOL_RECIPES.filter((tool) => tool.material === selectedMaterial && stageIndex >= tool.requiredStage).map(
                  (tool) => {
                    const disabled = !canAffordToolRecipe(tool) || Boolean(craftingRecipe);
                    const isCrafting = craftingRecipe === tool.id;
                    const isEquipped = equippedTools[tool.toolType] === tool.id;
                    const progress = isCrafting ? Math.min(100, (craftingProgress / tool.craftTime) * 100) : 0;
                    return (
                      <div
                        key={tool.id}
                        className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {language === "zh" ? tool.nameZh : tool.name}
                          </p>
                          <div className="flex gap-2">
                            {isEquipped && (
                              <Badge variant="default" className="text-[11px] uppercase tracking-wide">
                                {language === "zh" ? "已装备" : "Equipped"}
                              </Badge>
                            )}
                            {isCrafting && (
                              <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                                {languageLabels.recipeCrafting}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {language === "zh" ? tool.descriptionZh : tool.description}
                        </p>
                        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>{languageLabels.recipeCost}:</span>
                            <div className="flex gap-2">
                              {Object.entries(tool.cost).map(([key, cost]) => {
                                const resource = resources.find((r) => r.key === key);
                                if (!resource) return null;
                                const RateIcon = resource.icon;
                                return (
                                  <div key={key} className="flex items-center gap-1">
                                    <RateIcon className="h-3.5 w-3.5" />
                                    <span>{Math.abs(cost)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{languageLabels.recipeCraftTime}:</span>
                            <span>{tool.craftTime}s</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{language === "zh" ? "收集加成" : "Harvest Bonus"}:</span>
                            <span>
                              +{Object.values(tool.harvestBonus)[0]} {language === "zh" ? "资源" : "resource"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{language === "zh" ? "冷却减少" : "Cooldown Reduction"}:</span>
                            <span>-{tool.cooldownReduction}s</span>
                          </div>
                        </div>
                        {isCrafting ? (
                          <div className="mt-3 space-y-1.5">
                            <Progress value={progress} />
                            <p className="text-xs text-muted-foreground">
                              {craftingProgress}s / {tool.craftTime}s
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              disabled={disabled || isEquipped}
                              onClick={() => handleStartToolCraft(tool.id)}
                              type="button"
                            >
                              {isEquipped
                                ? language === "zh"
                                  ? "已装备"
                                  : "Equipped"
                                : languageLabels.recipeStartCraft}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  },
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>)}

            {activePanel === "story" && activeChapter && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>{languageLabels.storylineHeading}</CardTitle>
                    <LanguageToggle />
                  </div>
                  <CardDescription>{languageLabels.storylineSubheading}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const localized = getLocalizedChapterContent(activeChapter, language);
                    return (
                      <>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                              Chapter {activeChapter.order}
                            </Badge>
                            <p className="text-sm font-semibold text-foreground/90">{localized.title}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{localized.synopsis}</p>
                          {localized.highlight ? (
                            <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">{localized.highlight}</p>
                          ) : null}
                        </div>

                        {unlockedChapters.length > 1 ? (
                          <div className="flex flex-wrap gap-2">
                            {unlockedChapters.map((chapterId) => {
                              const chapter = STORY_CHAPTERS.find((item) => item.id === chapterId);
                              if (!chapter) {
                                return null;
                              }
                              const isActive = chapterId === activeChapter.id;
                              return (
                                <Button
                                  key={chapter.id}
                                  variant={isActive ? "default" : "outline"}
                                  size="sm"
                                  className="rounded-full text-[11px] uppercase"
                                  onClick={() => setActiveChapterId(chapter.id)}
                                  type="button"
                                >
                                  Chapter {chapter.order}
                                </Button>
                              );
                            })}
                          </div>
                        ) : null}

                        {localized.objectives?.length ? (
                          <section className="space-y-2">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                              {languageLabels.objectivesLabel}
                            </h2>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {localized.objectives.map((objective) => (
                                <li key={objective} className="rounded-xl bg-muted/30 px-3 py-2">
                                  {objective}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {localized.unlocks?.length ? (
                          <section className="space-y-2">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                              {languageLabels.unlocksLabel}
                            </h2>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {localized.unlocks.map((unlock) => (
                                <li key={unlock} className="rounded-xl bg-background/70 px-3 py-2">
                                  {unlock}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {localized.notes ? (
                          <p className="rounded-xl bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{localized.notes}</p>
                        ) : null}
                      </>
                    );
                  })()}

                  {nextChapter ? (
                    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-4 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground/80">{languageLabels.nextUnlockLabel}</p>
                      <p className="mt-1 text-sm text-foreground/70">
                        Chapter {nextChapter.order}: {nextChapter.title}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">Trigger</p>
                      <span className="mt-1 inline-flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {nextChapter.trigger.type}
                        </Badge>
                        {nextChapter.trigger.type === "stage" ? `Stage ${nextChapter.trigger.stage}` : null}
                        {nextChapter.trigger.type === "resource"
                          ? `${nextChapter.trigger.resource} ≥ ${nextChapter.trigger.amount}`
                          : null}
                        {nextChapter.trigger.type === "purchase" ? `Item ${nextChapter.trigger.itemId}` : null}
                        {nextChapter.trigger.type === "milestone" ? nextChapter.trigger.label : null}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{languageLabels.allUnlockedLabel}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activePanel === "story" && activeStage && (
              <Card>
                <CardHeader>
                  <CardTitle>{languageLabels.ledgerTitle}</CardTitle>
                  <CardDescription>{languageLabels.ledgerDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{language === "zh" ? activeStage.titleZh : activeStage.title}</span>
                      <span>{stageCompletionPercent}%</span>
                    </div>
                    <Progress value={stageCompletionPercent} className="mt-2" />
                  </div>
                  {stageGoals.length > 0 ? (
                    <div className="space-y-3">
                      {stageGoals.map((goal) => {
                        const { currentDisplay, percent } = getGoalProgress(goal);
                        return (
                          <div key={goal.label} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{language === "zh" ? goal.labelZh : goal.label}</span>
                              <span>
                                {currentDisplay} / {goal.target}
                              </span>
                            </div>
                            <Progress value={percent} className="mt-2 h-2" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The landlord is content for now—keep it that way by paying on time.
                    </p>
                  )}
                  <Button variant="outline" className="rounded-full" onClick={() => setShowTutorial(true)} type="button">
                    <Sparkles className="h-4 w-4" />
                    Revisit Landlord Brief
                  </Button>
                </CardContent>
              </Card>
            )}

            {activePanel === "citizens" && (<>
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => toggleCard("workers")}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{languageLabels.workerAssignmentTitle}</CardTitle>
                    <CardDescription>{languageLabels.workerAssignmentDescription}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
                    {expandedCards.workers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {expandedCards.workers ? (
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {language === "zh" ? "工人状态" : "Worker Status"}
                      </p>
                      <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                        {languageLabels.idleWorkers(idleWorkers)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>{languageLabels.tenantAssigned(assignedTenants)}</p>
                      <p>{language === "zh" ? `工作中：${totalAssignedWorkers} 人` : `Working: ${totalAssignedWorkers}`}</p>
                    </div>
                  </div>
                  {unlockedResources.map((resource) => {
                    const workers = resourceWorkers[resource.key] || 0;
                    const RateIcon = resource.icon;
                    return (
                      <div
                        key={resource.key}
                        className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <RateIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-semibold">
                                {language === "zh" ? resource.labelZh : resource.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {languageLabels.workersAssigned(workers)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={idleWorkers <= 0}
                            onClick={() => handleAssignWorker(resource.key)}
                            type="button"
                          >
                            {languageLabels.assignWorker}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workers <= 0}
                            onClick={() => handleUnassignWorker(resource.key)}
                            type="button"
                          >
                            {languageLabels.unassignWorker}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              ) : null}
            </Card>

            {assignedTenants > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{languageLabels.populationManagementTitle}</CardTitle>
                  <CardDescription>{languageLabels.populationManagementDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{languageLabels.tenantMorale}</p>
                      <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                        {languageLabels.averageMorale(
                          tenantMorale.length > 0
                            ? tenantMorale.reduce((sum, m) => sum + m, 0) / tenantMorale.length
                            : 100
                        )}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>{languageLabels.wageInfo(assignedTenants * WAGE_PER_TENANT_PER_DAY, assignedTenants)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
                    <label htmlFor="auto-pay-wages" className="text-sm font-semibold cursor-pointer">
                      {languageLabels.autoPayWages}
                    </label>
                    <input
                      id="auto-pay-wages"
                      type="checkbox"
                      checked={autoPayWages}
                      onChange={(e) => setAutoPayWages(e.target.checked)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </div>
                  <Button
                    onClick={handlePayWages}
                    disabled={assignedTenants === 0}
                    className="w-full"
                    type="button"
                  >
                    {languageLabels.payWagesButton}
                  </Button>
                  {tenantMorale.some((m) => m < 50) && (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                      {languageLabels.lowMoraleWarning}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{languageLabels.skillsTitle}</CardTitle>
                <CardDescription>
                  {language === "zh" ? "通过手动采集提升技能等级。" : "Level up skills through manual harvesting."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {skills.map((skill) => {
                  const requiredExp = skill.level * SKILL_EXP_PER_LEVEL;
                  const progress = skill.level >= skill.maxLevel ? 100 : (skill.experience / requiredExp) * 100;
                  return (
                    <div
                      key={skill.type}
                      className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {language === "zh" ? skill.nameZh : skill.name}
                        </p>
                        <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                          {languageLabels.skillLevel(skill.level)}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <Progress value={progress} />
                        <p className="text-xs text-muted-foreground">
                          {skill.level >= skill.maxLevel
                            ? language === "zh"
                              ? "已达最高等级"
                              : "Max Level"
                            : languageLabels.skillExp(skill.experience, requiredExp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </>)}

            {activePanel === "settings" && (<Card>
              <CardHeader>
                <CardTitle>{language === "zh" ? "设置" : "Settings"}</CardTitle>
                <CardDescription>
                  {language === "zh" ? "游戏设置与语言选项。" : "Game settings and language options."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{language === "zh" ? "语言" : "Language"}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "zh" ? "切换界面语言" : "Switch interface language"}
                    </p>
                  </div>
                  <LanguageToggle />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{language === "zh" ? "当前存档" : "Current Save"}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentSaveName || (language === "zh" ? "未命名" : "Unnamed")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </main>
      </div>
    </div>
  );
}
