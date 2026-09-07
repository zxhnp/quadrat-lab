# 样方实验

离线植物种群密度课堂演示工具，使用 Vue 3、TypeScript、Vite、Element Plus 和 Tauri 2 构建。

## 已实现

- 草原 `50m × 50m`：自由取样、中心样方、X 型对角线五点取样。
- 绿化带 `20m × 2m`：前两个样方确定间距，后续样方自动水平等距吸附，并支持标准铺满。
- `1m × 1m` 样方的越界、重叠和“计上不计下，计左不计右”边界规则。
- 目标植物数量、样方密度、平均密度、真实密度和误差对比。
- 可复现随机植物分布；点击“重新生成植物”会更换种子。
- Element Plus 用于外围 UI，SVG 仅用于专业场景画布。
- 扁平化应用图标已生成多尺寸 PNG、ICO 和 ICNS 资源。

## 运行

```bash
pnpm install
pnpm dev
```

## 验证

```bash
pnpm test
pnpm build
```

## Tauri 2 打包

Windows 构建需要 Rust、Microsoft C++ Build Tools 和 WebView2。依赖准备完成后执行：

```bash
pnpm tauri build
```

默认应用名为“样方实验”，标识为 `com.quadratlab.app`，安装包目标为 Windows NSIS。

## 设计稿

[打开 Figma 设计稿](https://www.figma.com/design/odaoPG7CBlMczeIAKrDGUk)

设计稿包含设计规范、草原自由取样和草原 X 型五点取样界面；绿化带界面依据同一套规范在代码中落地。
