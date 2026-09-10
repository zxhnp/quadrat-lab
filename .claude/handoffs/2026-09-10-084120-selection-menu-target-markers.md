# Handoff: 光标样方选择菜单与逐株标记同步

## Session Metadata
- Created: 2026-09-10 08:41:20
- Project: C:\Users\89589\Desktop\code\quadrat-lab
- Branch: main
- Session duration: 约 45 分钟（包含交互调试、端到端回归和视觉核验）

### Recent Commits (for context)
  - 2eeab24 重构样方实验取样工作区
  - 2811dd1 优化样地渲染与样方显示
  - 78bf0c5 重构绿化带裸土与动态植物分布
  - 0f9b21a feat: build quadrat lab tauri desktop app

## Handoff Chain

- **Continues from**: [2026-09-08-081210-greenbelt-soil-dynamic-distribution.md](./2026-09-08-081210-greenbelt-soil-dynamic-distribution.md)
  - Previous title: 绿化带裸土与动态植物分布重构
- **Supersedes**: None

> Review the previous handoff for full context before filling this one.

## Current State Summary

本次工作围绕样方批量选择交互完成。工具栏“光标”按钮右下角新增小型下拉菜单，仅提供“全选样方”和“取消选择”；批量状态由 `selectedQuadratIds` 统一维护，画布边框、右侧样方记录和当前样方摘要保持同步。此前全选后只有当前样方显示目标植物逐株编号，本轮已改为按样方分组生成编号，并用 `quadratId` 与右侧统计行严格对应。当前代码已完成并通过 12 项单元测试、9 项 Playwright 端到端测试和生产构建；工作区仍有本阶段及此前用户迭代的未提交代码，下一步是提交中文 commit 并推送 `origin/main`。

## Codebase Understanding

## Architecture Overview

应用使用 Vue 3 Composition API + TypeScript + Vite + Element Plus。`App.vue` 集中管理场景、样方和选择状态，`SamplingToolbar.vue` 通过 props/emits 提供工具操作，`SceneCanvas.vue` 负责 SVG 样方和 Canvas 植物层。当前选择分为“当前样方 ID”（驱动右侧详细统计与当前样方逐株标记）和“已选择样方 ID 列表”（驱动画布/列表批量高亮及所有已选样方的逐株标记）；后者是唯一批量选择来源，派生 Set 只用于高效判断。

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/App.vue` | 场景、样方、当前焦点和批量选择状态 | 全选/取消选择入口与右侧记录同步 |
| `src/components/SamplingToolbar.vue` | 工具栏和光标下拉菜单 | 小箭头、两项菜单及事件契约 |
| `src/components/SceneCanvas.vue` | 样方 SVG、密度标签和逐株标记 | 为每个已选样方独立生成标记组 |
| `src/main.ts` | Element Plus 按需组件注册 | 注册 `ElDropdown`、`ElDropdownMenu`、`ElDropdownItem` |
| `src/style.css` | 工具栏与下拉菜单视觉样式 | 控制箭头尺寸、定位和弹层宽度 |
| `tests/app.spec.ts` | Playwright UI 回归 | 验证全选/取消以及标记数与统计行按 ID 对齐 |

## Key Patterns Discovered

组件遵循“Props Down / Events Up”，子组件不直接改父状态。派生数据使用 `computed`，不要在 computed 中做副作用。样方统计统一调用 `countPlantsInQuadrat` / `plantsInQuadrat`，逐株标记按同一边界规则计算；SVG 标记使用稳定 `quadratId` key，防止排序或批量状态更新时串位。全局 Element Plus 组件在 `src/main.ts` 显式注册，新增组件必须同步注册。

## Work Completed

## Tasks Finished

- [x] 在“光标”按钮右下角增加 17×17px 小下拉箭头。
- [x] 下拉菜单限制为“全选样方”和“取消选择”两项。
- [x] 增加批量选择状态，并同步画布样方与右侧样方记录高亮。
- [x] 全选时为每个样方独立显示目标植物逐株编号，编号从 1 开始。
- [x] 增加按样方 ID 比对标记数量与右侧统计数量的回归断言。
- [x] 解决 Element Plus 下拉组件未注册导致菜单不展开的问题。
- [x] 通过单元测试、端到端测试、生产构建和 1256×912 视觉核验。

## Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `src/components/SceneCanvas.vue` | 接收批量选择 ID，按样方生成逐株标记组 | 保证全选后每个样方均有自己的编号和标记数量 |
| `src/style.css` | 新增光标箭头、下拉弹层和工具项定位样式 | 保持小箭头不增加工具栏行高 |
| `src/main.ts` | 注册三个 Element Plus 下拉组件 | 让下拉菜单在运行时正确展开 |
| `src/components/SamplingToolbar.vue` | 增加光标下拉菜单、props 和 emits | 提供全选/取消选择入口 |
| `src/domain/generator.test.ts` | 保留此前场景植物生成回归覆盖 | 防止本轮提交覆盖既有生成规则 |
| `src/domain/geometry.test.ts` | 保留此前样方几何回归覆盖 | 防止本轮提交影响样方边界规则 |
| `src/domain/geometry.ts` | 保留此前 1m²、五点取样和间距逻辑 | 支撑当前 400% 取样视觉与计算规则 |
| `src/App.vue` | 管理 `selectedQuadratIds`，处理全选/取消并传递到画布 | 统一画布、列表和统计选择状态 |
| `tests/app.spec.ts` | 新增全选/取消交互及按 ID 标记数对齐断言 | 固化用户反馈对应的回归场景 |
| `src/components/PlantDistributionLayer.vue` | 保留此前动态植物 Canvas 渲染调整 | 确保样方内计数使用完整点集、视觉层不受影响 |
| `src/assets/`、`design-qa.md` | 保留此前场景素材和视觉验收记录 | 属于用户已确认的基础迭代内容 |

## Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 批量选择与当前焦点分离 | 只维护一个选择 ID；或让右侧统计代表全部样方 | 保留“当前样方”详情语义，同时支持全选高亮 |
| 逐株标记按样方分组渲染 | 把所有植物合并为一个编号列表；或每个样方独立编号 | 每个样方编号从 1 开始，数量可以与对应统计行核对 |
| 复用 Element Plus Dropdown | 自制绝对定位菜单 | 具备点击外部关闭、键盘交互和可访问菜单语义，新增代码更少 |
| 菜单命令后切换到光标工具 | 保持原框选工具 | 批量选择完成后避免下一次点击误创建样方，符合光标菜单语义 |

## Pending Work

## Immediate Next Steps

1. 检查本次提交范围，只暂存项目代码、测试、资源、QA 和 `.claude/handoffs/`，不要暂存 `work/` 或其他本地中间文件。
2. 创建中文 commit，包含光标选择菜单和逐株标记同步修复。
3. 推送到 `origin/main`，随后检查本地 HEAD 与远程 `origin/main` 一致并向用户报告 commit。

## Blockers/Open Questions

- [ ] 当前无代码阻塞；远程推送前需确认工作区暂存范围，避免纳入 `work/` 未跟踪目录。

## Deferred Items

- Tauri 桌面构建暂未执行，之前按用户要求优先浏览器验证；如正式发布再单独构建安装包。
- 100% 缩放沿用现有规则不显示逐株编号，200% 及以上显示，以避免小比例遮挡。

## Context for Resuming Agent

## Important Context

当前分支是 `main`，远程是 `origin`，目标为 `origin/main`。不要执行 `git reset --hard`、`git checkout --` 或清理未跟踪文件；`work/` 是用户已有中间内容，必须保留。样方创建/单击时会把选择集合设为单个当前样方；“全选样方”将集合设为全部样方并保留当前焦点；“取消选择”清空集合和当前焦点但不会删除样方。右侧上方卡片只展示当前焦点，标签“已选 N 个”表示批量选择数量。`SceneCanvas.vue` 的 `selectedTargetMarkerGroups` 按 `selectedQuadratIds` 过滤，每组带 `data-quadrat-id`，每个组内编号从 1 开始；测试把它与右侧 `.sample-row[data-quadrat-id]` 的 `strong` 株数按 ID 比对。

## Assumptions Made

- 用户希望全选是视觉和统计联动，不是把多个样方合并为一个统计面积。
- 右上“当前样方”保留单样方详情，因此全选后仍显示最后焦点样方，批量数量通过标签表达。
- 100% 下不显示逐株编号是既有可读性规则，本轮只修复 200% 以上的全选标记同步。

## Potential Gotchas

- 新增 Element Plus 组件必须在 `src/main.ts` 显式注册，否则模板会原样输出 `<el-dropdown>` 且菜单不会展开。
- `selectedQuadratId` 与 `selectedQuadratIds` 不能混用：前者是当前焦点，后者是批量集合；逐株标记必须读取后者。
- 标记组 key 必须使用 `quadratId`，标记项 key 在组内使用 `marker.index`；不能把全部样方的 index 放在同一层，否则会重复 key。
- 植物统计始终使用完整 `scene.plants`，Canvas 的视觉抽样层不参与计数。

## Environment State

## Tools/Services Used

- Vue 3 + TypeScript + Vite + Element Plus。
- `pnpm test`：Vitest 单元测试，共 12 项通过。
- `pnpm test:e2e`：Playwright + 系统 Chrome，共 9 项通过；Browser plugin 不可用，因此按技能规范使用 Playwright fallback。
- `pnpm build`：`vue-tsc -b` 与 Vite 生产构建通过。
- 视觉截图保存在 `C:\Users\89589\.codex\visualizations\2026\09\10\01a08957-fce8-72e0-8ace-1075672e4537\`，包括 `all-selected-target-markers-1256.png`。

## Active Processes

- Vite 开发服务器监听 `127.0.0.1:1420`，用户页面为 `http://127.0.0.1:1420/`。
- 用户 Chrome 页面此前已打开该地址；后续验证可复用当前开发服务器。

## Environment Variables

- 无项目专用环境变量；`.env` / `.env.*` 已忽略。

## Related Resources

- [场景编排](../../src/App.vue)
- [取样工具栏](../../src/components/SamplingToolbar.vue)
- [交互画布](../../src/components/SceneCanvas.vue)
- [Element Plus 入口注册](../../src/main.ts)
- [浏览器回归测试](../../tests/app.spec.ts)
- [视觉验收记录](../../design-qa.md)
- [前一份交接](./2026-09-08-081210-greenbelt-soil-dynamic-distribution.md)

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
