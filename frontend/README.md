# Legend Of Tianji Valley

Legend Of Tianji Valley 是一款以租约与资源调配为核心的叙事向城管模拟原型。你将与房东、议员和各行政区周旋，在紧张的周期内完成租约目标，解锁更高阶段的设施与剧情。

## Features

- **阶段化租约目标**：`TUTORIAL_STAGES` 定义四个阶段，每个阶段有中文/英文双语目标、解锁条件与剧情提示。
- **章节叙事系统**：`STORY_CHAPTERS` 根据资源/阶段触发事件，展示房东与首席议员等角色对话。
- **多资源管理**：支持 Sunleaf、Timber、Stone、Insight、Ember 与 Execution（执行力）等资源，包含产率、容量提升和消耗逻辑。
- **配方制作**：`RECIPES` 面板可制作储物箱等道具，完成后可分配储量增益。
- **独立手动收集**：每种资源拥有独立冷却的手动收集按钮，产出适量资源或执行力。
- **自动存档/导入**：支持 JSON 序列化的保存与导入，便于调试与版本回滚。

## Quick Start

```bash
npm install
npm run dev
# open http://localhost:3000
```

- `npm run build`：生成生产构建。
- `npm run start`：以生产模式启动。
- `npm run lint`：运行 ESLint 检查。

## Gameplay Overview

- **周期与时间**：界面右上角显示当前 Cycle、Phase、时代。每 4 秒变更一次相位。
- **阶段目标**：左侧卡片展示当前阶段目标，满足后自动推进下一阶段并解锁对应动作/剧情。
- **议会指令**：使用 `Execution`（执行力）消耗来执行指令，执行力会以 `+0.05/cycle` 速度恢复。
- **手动收集**：在资源面板中按下按钮，可即时获得小额资源，按钮独立 30 秒冷却。
- **配方制作**：右侧“配方制作”卡片可消耗资源制作储物箱，制作完成后需选择要提升储量的资源。
- **剧情对话**：开局展示房东与首席议员的对话，后续章节根据进度逐步解锁。

## Project Structure

- `app/page.tsx`：主要页面与全部交互逻辑。
- `lib/storyline.ts`：章节/剧情触发配置。
- `lib/storefront.ts`：商店与奖励效果计算。
- `components/ui/*`：基于 shadcn/ui 的 UI 组件。

## Development Notes

- 资源、配方、章节数据以常量形式存放，可通过编辑对应数组扩展内容。
- 状态保存使用 React hooks 与 `useMemo`/`useCallback` 优化，调试时请注意依赖列表更新。
- UI 采用 Tailwind CSS 4 + shadcn 组件，建议遵守现有命名与样式约定。

## Roadmap

详细的版本计划请参阅 [`ROADMAP.md`](./ROADMAP.md)。当前重点：

- 0.1：Tutorial 章节、指令与配方原型（进行中）。
- 0.2：Bug 修复与界面细化（计划中）。
- 0.3：扩展剧情与更多配方（计划中）。

## License

本项目遵循MIT协议。
