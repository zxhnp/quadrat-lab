# Session Handoff：样方实验

更新时间：2026-09-08

## 项目定位

- 项目目录：`C:\Users\张晓晖\Desktop\work\code\quadrat-lab`
- 应用显示名：`样方实验`
- Tauri 标识：`com.quadratlab.app`
- 类型：离线单页桌面实验工具
- 数据：仅保存在前端内存，不依赖后端、账号或云同步

## 技术栈

- Vue 3 + Composition API + TypeScript
- Vite
- Element Plus：外围按钮、卡片、标签、表格、提示和布局组件
- Canvas：按场景懒加载和分层绘制植物模型
- SVG：样方、场景辅助线和交互热区
- WebP：场景底图和 Canvas 专用轻量植物切图
- Tauri 2：Windows x64 NSIS 安装包
- Vitest：领域逻辑测试
- Playwright：浏览器 E2E 测试

Nuxt 没有采用。当前产品是离线单页桌面工具，不需要 SSR 或服务端路由，Vite 更轻量。

## 当前已实现

### 草原场景

- 场地：`50m × 50m`，面积 `2500m²`
- 目标植物：茵陈蒿
- 支持自由点击放置 `1m × 1m` 样方
- 支持中心样方 + X 型对角线五点取样
- 草原使用棕色裸土底图，不显示网格和比例刻度
- 茵陈蒿按每平方米约 5 株均匀覆盖，狗尾巴草和小草保留随机斑块分布
- 三类植物使用清晰描边切图，在泥土纹理上可直接区分
- 目标植物、狗尾巴草和小草均基于可复现随机种子生成

### 绿化带场景

- 场地：`20m × 2m`，面积 `40m²`
- 目标植物：蒲公英
- 场景包含道路、树木、鸢尾花和狗尾巴草，种植区使用棕色裸土底图
- 鸢尾花沿绿化带上下各成一行；蒲公英和狗尾巴草分散在种植区各处
- 前两个样方确定间距
- 后续点击自动保持水平和等距
- 支持“标准铺满绿化带”
- 等距位置越界时拒绝添加，不会通过裁剪破坏等距规则
- 绿化带中的 `1m × 1m` 样方按屏幕宽度基准绘制为正方形

### 通用规则

- 样方不可越界、不可重叠
- 边界规则：计上不计下，计左不计右
- 选中样方后内部高亮，并在右上角显示实时密度（如 `5株/㎡`）
- 支持撤销、清空、重新生成植物
- 支持目标植物数量、样方密度、平均密度、真实密度和误差对比

## 渲染与性能说明

- 页面只加载当前场景底图以及该场景用到的植物切图，不再一次加载全部资源
- Canvas 总览层按物种做确定性抽样；样方内部的目标植物始终补充到绘制列表，保证统计与画面一致
- 移除了逐株实时模糊阴影，改用预生成清晰描边，降低草原首次渲染和场景切换开销
- 草原/绿化带底图 WebP 约为 `789KB` / `431KB`；植物渲染切图单张约为 `67KB–116KB`
- 原始 PNG 保留为源素材，运行时统一使用 `src/assets/plants/render/` 下的 WebP

## 关键文件

- `src/App.vue`：应用状态、场景切换、样方操作和结果流程
- `src/components/SceneCanvas.vue`：专业 SVG 交互画布
- `src/components/PlantDistributionLayer.vue`：植物 Canvas 渲染、按场景懒加载和可视植物抽样
- `src/components/PlantSpecimen.vue`：植物标本卡片
- `src/components/AppLogo.vue`：应用标志
- `src/domain/generator.ts`：可复现植物分布生成
- `src/domain/geometry.ts`：边界、重叠、五点法、等距吸附
- `src/domain/calculator.ts`：样方统计、平均密度和真实值对比
- `src/data.ts`：场景和植物元数据
- `src/types.ts`：领域类型定义
- `src/style.css`：自然科普仪表盘视觉样式
- `src-tauri/tauri.conf.json`：窗口、应用标识、NSIS 和图标配置
- `src-tauri/icons/`：应用图标资源

## 设计稿

Figma 文件：<https://www.figma.com/design/odaoPG7CBlMczeIAKrDGUk>

已写入的设计内容：

- `00 设计规范 · 样方实验`
- `01 草原 · 自由取样`
- `02 草原 · 五点取样`

绿化带设计依据同一套视觉规范完成了代码实现。Figma Starter 计划在继续写入绿化带画板前达到 MCP 调用额度上限，因此不要重复尝试 Figma 写入；如需补充，可在额度恢复后继续使用该文件。

## 图标资源

主图形为“样方方框 + 四角取样点 + 中央双叶植物”，扁平矢量、透明背景、无文字和渐变。

已生成：

- `src-tauri/icons/icon.ico`
- `src-tauri/icons/32x32.png`
- `src-tauri/icons/64x64.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/128x128@2x.png`
- `src-tauri/icons/icon.png`
- `src-tauri/icons/app-icon.svg`

图标由以下命令生成：

```bash
pnpm tauri icon src-tauri/icons/app-icon.svg
```

命令同时生成了 Tauri 支持的其他平台资源，均位于 `src-tauri/icons/`。

## 验证状态

最后一次验证结果：

- `pnpm test`：通过，11 个测试全部通过
- `pnpm test:e2e`：通过，3 个测试全部通过
- `pnpm build`：通过
- `pnpm tauri build`：上一版本通过；本轮未重新打包安装程序
- 浏览器视觉检查：草原无网格和刻度，植物清晰可区分；绿化带样方实测宽高均为 `56.8`，内部高亮和密度角标正常
- 浏览器控制台：无 warning 或 error
- 手动流程：草原/绿化带切换、两场景放置样方、密度显示均已验证

## 已生成安装包

```text
C:\Users\张晓晖\Desktop\work\code\quadrat-lab\src-tauri\target\release\bundle\nsis\样方实验_0.1.0_x64-setup.exe
```

## 下一次会话启动方式

在项目目录执行：

```bash
pnpm install
pnpm dev
```

运行测试：

```bash
pnpm test
pnpm test:e2e
```

重新打包 Windows NSIS：

```bash
pnpm tauri build
```

如果新终端找不到 Rust 或 MSVC 环境，使用 Visual Studio 2022 Build Tools 的 x64 Developer Command Prompt，再执行 `pnpm tauri build`。当前机器已安装 Rust stable、Visual Studio C++ Build Tools 和 WebView2。

## 暂不实现

- 账号体系
- 云同步
- 课程编辑器
- 多语言
- macOS/Linux 发布
