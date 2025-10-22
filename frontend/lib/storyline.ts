export type StoryTrigger =
  | { type: "stage"; stage: number }
  | { type: "purchase"; itemId: string }
  | { type: "resource"; resource: string; amount: number }
  | { type: "milestone"; label: string };

export type StoryChapter = {
  id: string;
  order: number;
  title: string;
  synopsis: string;
  highlight: string;
  objectives: string[];
  unlocks: string[];
  trigger: StoryTrigger;
  notes?: string;
};

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "chapter-1",
    order: 1,
    title: "Move-In Mandate",
    synopsis:
      "The landlord hands over the lease ledgers and expects the council to dress the settlement for inspection.",
    highlight: "Stabilise the first harvest and present a tidy ledger before dusk.",
    objectives: [
      "Introduce sunleaf harvesting and timber milling basics.",
      "Explain how rent stages align with tutorial goals.",
      "Nudge the player to review the Resource Ledger.",
    ],
    unlocks: [
      "Opens access to the tutorial overlay and Stage 0 actions.",
      "Flags `Terraced Fields` as ready for detailed oversight.",
    ],
    trigger: { type: "stage", stage: 0 },
    notes: "Always available on first load; provides the anchor for lease terminology.",
  },
  {
    id: "chapter-2",
    order: 2,
    title: "First Inspection",
    synopsis:
      "A surprise walkthrough keeps the council on edge while the landlord cross-checks the sunleaf stacks.",
    highlight: "Demonstrate how goals and progress bars reflect real rent pressure.",
    objectives: [
      "Highlight completion tracking inside the tutorial overlay.",
      "Encourage the player to enact their first directive.",
      "Introduce the council log as a narrative feed.",
    ],
    unlocks: [
      "Adds flavour entries to the council log once Chapter 2 concludes.",
      "Enables Stage 0 to advance when goals are met.",
    ],
    trigger: { type: "resource", resource: "sunleaf", amount: 80 },
  },
  {
    id: "chapter-3",
    order: 3,
    title: "Market Errand",
    synopsis:
      "The landlord requisitions a visit to the night market, hinting at upcoming shop mechanics.",
    highlight: "Prep the player for the forthcoming store without enabling it yet.",
    objectives: [
      "Present the planned store categories and currencies.",
      "Explain how purchases may unlock skills or boosts later on.",
    ],
    unlocks: [
      "Marks the store UI as discoverable once implemented.",
      "Queues special rent log entries about market demands.",
    ],
    trigger: { type: "resource", resource: "wood", amount: 15 },
  },
  {
    id: "chapter-4",
    order: 4,
    title: "Ledger Lessons",
    synopsis:
      "Scholars host a late-night crash course so the landlord's accountant stops breathing down everyone’s neck.",
    highlight: "Tie the insight resource to narrative momentum and unlock opportunities.",
    objectives: [
      "Explain the importance of the Insight ledger and research-focused actions.",
      "Foreshadow skills that deepen production efficiency.",
    ],
    unlocks: [
      "Unlocks the `Archive Colloquium` directive guidance.",
      "Signals Stage 1 availability once prerequisites are complete.",
    ],
    trigger: { type: "resource", resource: "stone", amount: 10 },
  },
  {
    id: "chapter-5",
    order: 5,
    title: "Timbers of Trust",
    synopsis:
      "The landlord demands reinforced platforms before approving any expansion permits.",
    highlight: "Focus on the interplay between timber capacity and structural upgrades.",
    objectives: [
      "Surface the importance of capacity upgrades in the UI.",
      "Prepare the player for storage-focused purchases in the store.",
    ],
    unlocks: [
      "Grants access to the `Reinforce Trusses` briefing.",
      "Partially reveals the Moonwater Archives dossier.",
    ],
    trigger: { type: "resource", resource: "wood", amount: 150 },
  },
  {
    id: "chapter-6",
    order: 6,
    title: "Night Market Lights",
    synopsis:
      "Vendors assemble in the plaza, offering deals that the landlord wants logged for future audits.",
    highlight: "Introduce store browsing and hint at bundled unlocks.",
    objectives: [
      "Showcase how purchases will be recorded against rent obligations.",
      "Outline at least one premium blueprint awaiting a later chapter.",
    ],
    unlocks: [
      "Activates store preview within the UI (read-only stage).",
      "Unlocks cosmetic ledger entries tied to market visits.",
    ],
    trigger: { type: "milestone", label: "store-preview-opened" },
  },
  {
    id: "chapter-7",
    order: 7,
    title: "Quarterly Audit",
    synopsis:
      "An audit summons pushes the council to formalise ember quotas and energy reserves.",
    highlight: "Align energy production with landlord expectations and upcoming tech unlocks.",
    objectives: [
      "Educate players on ember expenditure versus savings.",
      "Introduce the concept of civilisation level requirements.",
    ],
    unlocks: [
      "Signals Stage 2 tasks and unlock notifications.",
      "Reveals the lease terms for the Sky Harbor district.",
    ],
    trigger: { type: "stage", stage: 2 },
  },
  {
    id: "chapter-8",
    order: 8,
    title: "Sky Harbor Charter",
    synopsis:
      "Diplomatic couriers arrive with terms that can elevate the settlement’s standing if honoured.",
    highlight: "Shift focus toward diplomacy, trade lanes, and future skill unlocks.",
    objectives: [
      "Explain how global projects affect civilisation ranking.",
      "Tease late-game skills tied to inter-valley agreements.",
    ],
    unlocks: [
      "Unlocks the Sky Harbor district dossier in full.",
      "Queues store bundles for diplomacy-focused upgrades.",
    ],
    trigger: { type: "purchase", itemId: "market-charter" },
  },
  {
    id: "chapter-9",
    order: 9,
    title: "Radiant Promissory",
    synopsis:
      "An ambitious infrastructure deal promises radiant growth if ember debts are serviced promptly.",
    highlight: "Connect major projects to civilisation level milestones and landlord expectations.",
    objectives: [
      "Guide the player through multi-resource investment decisions.",
      "Promote long-term planning for store purchases.",
    ],
    unlocks: [
      "Unlocks the `Radiant Aquifer` roadmap narration.",
      "Advances civilisation level towards the late-game tier.",
    ],
    trigger: { type: "stage", stage: 3 },
  },
  {
    id: "chapter-10",
    order: 10,
    title: "Lease Renewal",
    synopsis:
      "With the landlord placated, the council negotiates terms that open the entire valley for self-directed play.",
    highlight: "Celebrate completion of the core storyline while teasing ongoing content.",
    objectives: [
      "Summarise the systems now available to the player.",
      "Encourage replayability through alternate rent strategies.",
    ],
    unlocks: [
      "Marks the tutorial storyline as complete while keeping optional tasks visible.",
      "Introduces prestige hooks for future expansions.",
    ],
    trigger: { type: "milestone", label: "all-chapters-complete" },
    notes: "Serve as the hand-off into freeform or seasonal content updates.",
  },
];
