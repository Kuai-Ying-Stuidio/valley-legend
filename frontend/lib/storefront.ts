import type { StoryTrigger } from "@/lib/storyline";

export type StoreResourceKey = "sunleaf" | "wood" | "stone" | "science" | "energy";

export type ResourceCost = Partial<Record<StoreResourceKey, number>>;

export type StoreReward = {
  resources?: Partial<Record<StoreResourceKey, number>>;
  rates?: Partial<Record<StoreResourceKey, number>>;
  capacity?: Partial<Record<StoreResourceKey, number>>;
  milestones?: string[];
  skills?: string[];
  civilizationLevel?: number;
  flag?: string;
};

export type StoreItem = {
  id: string;
  name: string;
  description: string;
  category: "essentials" | "infrastructure" | "scholar" | "diplomacy";
  cost: ResourceCost;
  rewards: StoreReward;
  limit?: number | "once";
  unlockStage?: number;
  trigger?: StoryTrigger;
};

export type StoreCatalog = StoreItem[];

export type StorePurchaseSnapshot = Record<StoreResourceKey, { amount: number; capacity: number; rate: number }>;

export const STORE_CATALOG: StoreCatalog = [
  {
    id: "sunleaf-bundles",
    name: "Sunleaf Bundles",
    description: "Pre-packed fronds appease the landlord's morning rounds.",
    category: "essentials",
    cost: { sunleaf: 45 },
    rewards: {
      resources: { sunleaf: 30 },
      milestones: ["purchase:sunleaf-bundles"],
    },
    limit: 3,
  },
  {
    id: "ledger-seal",
    name: "Ledger Seal",
    description: "Stamped guarantees smooth over the landlord's audits.",
    category: "essentials",
    cost: { wood: 25, sunleaf: 20 },
    rewards: {
      milestones: ["purchase:ledger-seal"],
      flag: "ledger-seal",
    },
    limit: "once",
    unlockStage: 0,
  },
  {
    id: "reinforced-silos",
    name: "Reinforced Silos",
    description: "Braided supports raise storage ceilings across the terraces.",
    category: "infrastructure",
    cost: { wood: 120, stone: 40 },
    rewards: {
      capacity: { wood: 140 },
      milestones: ["storage:reinforced"],
    },
    limit: "once",
    unlockStage: 1,
    trigger: { type: "stage", stage: 1 },
  },
  {
    id: "scholar-stipend",
    name: "Scholar Stipend",
    description: "Endowments keep the archives humming through the night.",
    category: "scholar",
    cost: { sunleaf: 60, energy: 12 },
    rewards: {
      rates: { science: 0.6 },
      resources: { science: 12 },
      milestones: ["purchase:scholar-stipend"],
    },
    limit: 2,
    unlockStage: 1,
  },
  {
    id: "market-charter",
    name: "Market Charter",
    description: "Sanctioned stalls expand the landlord's rent portfolio.",
    category: "diplomacy",
    cost: { stone: 60, energy: 16 },
    rewards: {
      milestones: ["market:charter-approved"],
      civilizationLevel: 1,
      flag: "market-charter",
    },
    limit: "once",
    unlockStage: 2,
    trigger: { type: "purchase", itemId: "market-charter" },
  },
  {
    id: "radiant-promissory",
    name: "Radiant Promissory",
    description: "Pledges ember dividends toward late-cycle megastructures.",
    category: "diplomacy",
    cost: { energy: 24, science: 14 },
    rewards: {
      resources: { energy: 12 },
      rates: { energy: 0.4 },
      milestones: ["market:radiant"],
      civilizationLevel: 1,
    },
    limit: "once",
    unlockStage: 3,
    trigger: { type: "milestone", label: "market:charter-approved" },
  },
] as const;

export type StoreRewardEffect = {
  resources?: ResourceCost;
  rates?: Partial<Record<StoreResourceKey, number>>;
  capacity?: Partial<Record<StoreResourceKey, number>>;
  milestones?: string[];
  skills?: string[];
  civilizationDelta?: number;
  flag?: string;
};

export function deriveRewardEffect(item: StoreItem): StoreRewardEffect {
  const { rewards } = item;
  return {
    resources: rewards.resources,
    rates: rewards.rates,
    capacity: rewards.capacity,
    milestones: rewards.milestones,
    skills: rewards.skills,
    civilizationDelta: rewards.civilizationLevel,
    flag: rewards.flag,
  };
}

export function canAfford(cost: ResourceCost, snapshot: StorePurchaseSnapshot) {
  return Object.entries(cost).every(([key, value]) => {
    if (!value) {
      return true;
    }
    const details = snapshot[key as StoreResourceKey];
    return Boolean(details && details.amount >= value);
  });
}

export function nextPurchaseCount(
  itemId: string,
  currentCounts: Record<string, number>,
  limit: number | "once" | undefined,
): { count: number; allowed: boolean } {
  const existing = currentCounts[itemId] ?? 0;
  if (limit === "once") {
    return { count: existing + 1, allowed: existing === 0 };
  }
  if (typeof limit === "number") {
    return { count: existing + 1, allowed: existing < limit };
  }
  return { count: existing + 1, allowed: true };
}
