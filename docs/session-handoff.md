# Session Handoff：样方实验

更新时间：2026-09-09

## 项目定位

- 项目目录：`C:\Users\张晓晖\Desktop\work\code\quadrat-lab`
- 应用显示名：`样方实验`
- Tauri 标识：`com.quadratlab.app`
- 类型：离线单页桌面实验工具
- 数据：仅保存在前端内存，不依赖后端、账号或云同步

## 技术栈

- Vue 3 + Composition API + TypeScript
- Vite + Element Plus
- SVG：样方、辅助线、标签和交互热区
- Canvas / DOM 图片节点：植物动态分布与高倍清晰渲染
- WebP：场景底图和植物运行时素材
- Tauri 2：Windows x64 NSIS 安装包
- Vitest：领域逻辑测试
- Playwright：浏览器 E2E 测试

## 当前已实现

### 页面排版

- 顶部保留应用导航与实验步骤。
- 左侧场景选择和植物标本栏已压缩为窄栏，常规桌面视口无需垂直滚动。
- 新增独立的 PS 风格取样工具栏，工具包括光标、框选、拖动画布、辅助线、缩放、重置、撤销和清空。
- 中央画布承担场景展示与取样交互，右侧统计栏承担样方记录、计数和估算。
- 移除底部重复的流程展示与操作区，四栏布局在同一主工作区内对齐。

### 草原场景

- 场地：`50m × 50m`，面积 `2500m²`。
- 目标植物：茵陈蒿；辅助植物：狗尾巴草、小草。
- 使用棕色裸土底图，不显示网格和刻度。
- 植物按可复现随机种子生成，草原保持斑块式自然分布。
- 框选工具支持鼠标拖拽选择固定 `1m × 1m` 样方，不能越界或重叠。
- 支持光标选择、拖动画布、缩放和重置；高倍缩放时样方按比例放大。
- 中心样方、X 型对角线和五点取样逻辑继续保留。

### 绿化带场景

- 场地：`20m × 2m`，面积 `40m²`。
- 目标植物：蒲公英；辅助植物：鸢尾花、狗尾巴草。
- 使用与草原一致的棕色裸土种植区底图，同时保留道路、树木和边界层次。
- 鸢尾花沿绿化带上下各成一行；蒲公英和狗尾巴草在种植区内不规则分散。
- 前两个样方确定间距，后续样方自动水平等距吸附；支持“标准铺满绿化带”。
- 绿化带样方保持 `1m × 1m` 正方形，越界或重叠时拒绝添加。

### 样方与统计

- 选中样方后只在样方内部显示橙色高亮。
- 样方右上角显示当前株数和密度，例如 `5株/㎡`。
- 右侧显示样方数量、目标植物数量、样方密度、平均密度和真实结果。
- 支持标记并计数、撤销、清空和重新生成植物。
- 边界规则：计上不计下，计左不计右。

## 渲染与性能说明

- 页面按场景预载对应底图和植物素材，场景切换不再重复等待资源。
- 草原高倍缩放使用平铺土壤背景，避免直接放大整张位图。
- 高倍视口附近的植物使用独立图片节点渲染，保持茵陈蒿、狗尾巴草和小草的轮廓清晰、易于辨认。
- SVG 仅承载交互层，不再承担整片草地的静态绘制。
- 植物分布使用确定性随机种子，重新生成植物时画面和统计数据同步更新。

## 关键文件

- `src/App.vue`：应用状态、场景切换、样方操作和右侧统计流程
- `src/components/SamplingToolbar.vue`：独立取样工具栏
- `src/components/SceneCanvas.vue`：缩放、平移、框选和 SVG 交互画布
- `src/components/PlantDistributionLayer.vue`：动态植物分布与高倍清晰渲染
- `src/domain/generator.ts`：可复现植物分布生成
- `src/domain/geometry.ts`：边界、重叠、五点法和等距吸附
- `src/domain/calculator.ts`：样方统计、平均密度和真实值对比
- `src/data.ts`：场景和植物元数据
- `src/types.ts`：领域类型定义，包含画布工具类型
- `src/style.css`：四栏桌面布局和视觉样式
- `tests/app.spec.ts`：场景切换、框选、缩放、平移和工具栏 E2E 测试
- `design-qa.md`：确认稿对照和最终视觉验收记录

## 验证状态

- `pnpm run build`：通过。
- `pnpm exec vitest run --testTimeout 15000`：通过，11/11。
- `pnpm exec playwright test`：通过，6/6。
- `pnpm exec vue-tsc -b`：通过。
- 浏览器视口：`1646 × 912` 主验收、`1280 × 800` 窄桌面复核。
- 浏览器控制台：最终检查无 error 或 warning。
- 已验证：草原/绿化带切换、固定 1m² 框选、内部高亮、密度标签、200% 缩放、拖动画布、辅助线、撤销、清空和绿化带铺满。
- 设计验收：`design-qa.md` 的 `final result` 为 `passed`。
- Tauri 安装包：本轮未重新打包；上一版本安装包仍位于 `src-tauri/target/release/bundle/nsis/`。

## 运行方式

```bash
pnpm install
pnpm dev
```

运行测试：

```bash
pnpm exec vitest run --testTimeout 15000
pnpm exec playwright test
```

重新打包 Windows NSIS：

```bash
pnpm tauri build
```

## Git 交接

- 当前分支：`main`
- 远程：`origin` → `https://github.com/zxhnp/quadrat-lab.git`
- 本轮实现、测试和 `docs/session-handoff.md` 已整理在同一次提交中并推送到 `origin/main`。
- `.idea/` 下的现有用户文件随工作区保留，未做清理或重置。

## 暂不实现

- 账号体系
- 云同步
- 课程编辑器
- 多语言
- macOS/Linux 发布
