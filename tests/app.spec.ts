import { test, expect, type Locator, type Page } from "@playwright/test";

async function dragSample(page: Page, canvas: Locator, xRatio: number, yRatio: number, distance = 14): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("未找到交互画布尺寸");
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y + distance, { steps: 4 });
  await page.mouse.up();
}

test("样方实验主流程可加载并切换场景", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "样方实验" })).toBeVisible();
  await expect(page.getByRole("button", { name: /选取样方.*1m² × 1m²/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /草原 50m × 50m/ })).toBeVisible();
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await expect(page.getByAltText("绿化带场景底图")).toBeVisible();
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeDisabled();
});

test("绿化带可通过两个样方建立等距并铺满", async ({ page }) => {
  await page.setViewportSize({ width: 1256, height: 912 });
  await page.goto("/");
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();

  const canvas = page.locator("svg.scene-canvas");
  await dragSample(page, canvas, 0.20, 0.60);
  await dragSample(page, canvas, 0.275, 0.60);

  await expect(page.locator(".sample-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeEnabled();

  await page.getByRole("button", { name: "等距铺满" }).click();
  expect(await page.locator(".sample-row").count()).toBeGreaterThan(10);
  const inspectorOverflow = await page.locator(".inspector-rail").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(inspectorOverflow.overflowY).toBe("hidden");
  expect(inspectorOverflow.scrollHeight).toBe(inspectorOverflow.clientHeight);
  const listOverflow = await page.locator(".sample-list").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(listOverflow.overflowY).toBe("auto");
  expect(listOverflow.scrollHeight).toBeGreaterThan(listOverflow.clientHeight);
  await expect(page.getByRole("button", { name: "揭晓真实结果" })).toBeVisible();
});

test("草原在四倍缩放下可框选真实一米样方", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("400%");
  const distributionLayer = page.locator("canvas.distribution-layer");
  await expect(distributionLayer).toBeVisible();
  await expect(distributionLayer).toHaveAttribute("data-rendered-target-count", "11250");
  await expect(distributionLayer).toHaveAttribute("data-plant-symbol-screen-scale", "2.4");
  const distributionBeforeSelection = await distributionLayer.evaluate((element) => element.toDataURL());

  const viewport = page.locator(".scene-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("未找到草原交互画布尺寸");
  await page.mouse.click(box.x + 100, box.y + 100);
  await expect(page.locator(".sample-row")).toHaveCount(0);

  await dragSample(page, viewport, 0.25, 0.25, 20);
  await expect(page.locator(".sample-row")).toHaveCount(1);
  const quadrat = page.locator("svg .quadrats .quadrat rect").first();
  expect(Number(await quadrat.getAttribute("width"))).toBeCloseTo(15.2, 5);
  expect(Number(await quadrat.getAttribute("height"))).toBeCloseTo(15.2, 5);
  const quadratBounds = await quadrat.boundingBox();
  expect(quadratBounds?.width).toBeGreaterThan(80);
  expect(quadratBounds?.width).toBeLessThan(110);
  await expect(page.locator(".sample-meta")).toContainText("1m²");
  await expect(page.getByRole("button", { name: "标记并计数" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "计算平均值" })).toBeEnabled();
  const quadratGroup = page.locator("svg .quadrats .quadrat").first();
  await expect(quadratGroup).not.toContainText("1m × 1m");
  await expect(quadratGroup.locator(".quadrat-label-bg")).toHaveCount(0);
  const densityText = quadratGroup.locator(".quadrat-density-label");
  const densityTextBounds = await densityText.boundingBox();
  if (!quadratBounds || !densityTextBounds) throw new Error("未找到样方密度标注尺寸");
  const quadratGeometry = await quadrat.evaluate((element) => ({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
    width: Number(element.getAttribute("width")),
  }));
  const labelGeometry = await densityText.evaluate((element) => ({
    x: Number(element.getAttribute("x")),
  }));
  expect(labelGeometry.x).toBeGreaterThan(quadratGeometry.x + quadratGeometry.width);
  expect(densityTextBounds.y).toBeLessThan(quadratBounds.y + 4);
  expect(densityTextBounds.height).toBeGreaterThan(18);
  await expect(densityText).toHaveText(/^\d+(?:\.\d+)?株\/㎡$/);

  await page.getByRole("button", { name: "重置草原缩放" }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("100%");
  const quadratAtOverview = await quadrat.boundingBox();
  const textAtOverview = await densityText.boundingBox();
  if (!quadratAtOverview || !textAtOverview) throw new Error("未找到 100% 下的密度标注尺寸");
  const labelGeometryAtOverview = await densityText.evaluate((element) => ({
    x: Number(element.getAttribute("x")),
  }));
  expect(labelGeometryAtOverview.x).toBeGreaterThan(quadratGeometry.x + quadratGeometry.width);
  expect(textAtOverview.y).toBeLessThan(quadratAtOverview.y + 4);
  expect(textAtOverview.height).toBeGreaterThan(13);

  await page.getByRole("button", { name: "进入取样模式" }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("400%");
  const markedCount = Number(await page.locator(".sample-focus strong").first().textContent());
  expect(markedCount).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId("selected-target-marker")).toHaveCount(markedCount);
  expect(await distributionLayer.evaluate((element) => element.toDataURL())).toBe(distributionBeforeSelection);

  const fontSizeAtSamplingZoom = await densityText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.getByRole("button", { name: "放大草原" }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("600%");
  const fontSizeAboveSamplingZoom = await densityText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSizeAtSamplingZoom * 4).toBeCloseTo(14, 5);
  expect(fontSizeAboveSamplingZoom * 6).toBeCloseTo(14, 2);

  await page.getByRole("button", { name: "辅助线" }).click();
  const guides = page.locator(".five-point-guide rect");
  await expect(guides).toHaveCount(5);
  const guideGeometry = await guides.evaluateAll((elements) => elements.map((element) => ({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
    width: Number(element.getAttribute("width")),
  })));
  const centerGuide = guideGeometry[0];
  const cornerGuide = guideGeometry[1];
  if (!centerGuide || !cornerGuide) throw new Error("未找到五点取样辅助样方坐标");
  const centerToCorner = Math.hypot(
    cornerGuide.x - centerGuide.x,
    cornerGuide.y - centerGuide.y,
  );
  expect(centerToCorner / centerGuide.width).toBeCloseTo(2, 5);
  await expect(page.locator(".canvas-caption")).toContainText("中心距 2m 的 X 辅助线");
});

test("草原五点样方的左侧两个密度标签在各比例下保持左置", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  const viewport = page.locator(".scene-viewport");
  for (const [xRatio, yRatio] of [[.5, .5], [.4, .4], [.6, .4], [.4, .6], [.6, .6]]) {
    await dragSample(page, viewport, xRatio, yRatio, 16);
  }
  await expect(page.locator(".sample-row")).toHaveCount(5);

  async function expectLeftLabelsAtCurrentZoom(): Promise<void> {
    const geometries = await page.locator(".quadrats .quadrat").evaluateAll((groups) => groups.map((group) => {
      const rect = group.querySelector("rect")?.getBoundingClientRect();
      const label = group.querySelector(".quadrat-density-label")?.getBoundingClientRect();
      if (!rect || !label) throw new Error("未找到样方或密度标签");
      return {
        rect: { left: rect.left, right: rect.right },
        label: { left: label.left, right: label.right },
      };
    }));
    const ordered = geometries.sort((first, second) => first.rect.left - second.rect.left);
    for (const item of ordered.slice(0, 2)) expect(item.label.right).toBeLessThan(item.rect.left);
    for (const item of ordered.slice(2)) expect(item.label.left).toBeGreaterThan(item.rect.right);
  }

  await expectLeftLabelsAtCurrentZoom();
  await page.getByRole("button", { name: "重置草原缩放" }).click();
  await expectLeftLabelsAtCurrentZoom();
  await page.getByRole("button", { name: "放大草原" }).click();
  await expectLeftLabelsAtCurrentZoom();
});

test("独立工具栏与右侧操作按钮保持同列对齐", async ({ page }) => {
  await page.goto("/");
  const toolButtons = page.locator(".sampling-toolbar .toolbar-button");
  const firstTool = await toolButtons.nth(0).boundingBox();
  const secondTool = await toolButtons.nth(1).boundingBox();
  const inspectorButtons = page.locator(".inspector-actions .el-button");
  const firstInspector = await inspectorButtons.nth(0).boundingBox();
  const secondInspector = await inspectorButtons.nth(1).boundingBox();
  expect(firstTool?.x).toBe(secondTool?.x);
  expect(firstInspector?.x).toBe(secondInspector?.x);
});

test("光标下拉菜单可全选样方并取消选择", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  const viewport = page.locator(".scene-viewport");
  for (const [xRatio, yRatio] of [[.35, .4], [.5, .5], [.65, .6]]) {
    await dragSample(page, viewport, xRatio, yRatio, 16);
  }
  await expect(page.locator(".sample-row")).toHaveCount(3);

  const selectionMenuButton = page.getByRole("button", { name: "样方选择菜单" });
  await selectionMenuButton.click();
  const visibleMenuItems = page.locator(".quadrat-selection-dropdown:visible .el-dropdown-menu__item");
  await expect(visibleMenuItems).toHaveCount(2);
  await expect(visibleMenuItems.nth(0)).toHaveText("全选样方");
  await expect(visibleMenuItems.nth(1)).toHaveText("取消选择");
  await page.getByRole("menuitem", { name: "全选样方" }).click();

  await expect(page.locator(".quadrats .quadrat.selected")).toHaveCount(3);
  await expect(page.locator(".sample-row.active")).toHaveCount(3);
  await expect(page.locator(".selected-sample .el-tag")).toHaveText("已选 3 个");
  await expect(page.getByRole("button", { name: "光标" })).toHaveAttribute("aria-pressed", "true");
  const markerCounts = await page.getByTestId("selected-quadrat-marker-group").evaluateAll((groups) => Object.fromEntries(groups.map((group) => [
    group.getAttribute("data-quadrat-id"),
    group.querySelectorAll('[data-testid="selected-target-marker"]').length,
  ])));
  const summaryCounts = await page.locator(".sample-row").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [
    row.getAttribute("data-quadrat-id"),
    Number.parseInt(row.querySelector("strong")?.textContent ?? "", 10),
  ])));
  expect(markerCounts).toEqual(summaryCounts);

  await selectionMenuButton.click();
  await page.getByRole("menuitem", { name: "取消选择" }).click();
  await expect(page.locator(".quadrats .quadrat.selected")).toHaveCount(0);
  await expect(page.locator(".sample-row.active")).toHaveCount(0);
  await expect(page.getByTestId("selected-target-marker")).toHaveCount(0);
  await expect(page.locator(".selected-sample")).toHaveCount(0);
  await expect(page.locator(".sample-row")).toHaveCount(3);
  await expect(page.getByText("当前未选择样方")).toBeVisible();
});

test("切换场景后动态植物层会更新分布", async ({ page }) => {
  await page.goto("/");
  const layer = page.locator("canvas.distribution-layer");
  await expect(layer).toBeVisible();
  await page.waitForTimeout(300);

  const before = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await page.waitForTimeout(300);
  const after = await layer.evaluate((canvas) => canvas.toDataURL());

  expect(after).not.toBe(before);

  await expect(page.getByAltText("绿化带场景底图")).toBeVisible();
  await expect(layer).toHaveAttribute("data-rendered-plant-count", "298");
});

test("场景选择使用简洁文字卡片，工具栏重置会恢复视图并生成新分布", async ({ page }) => {
  await page.goto("/");

  const sceneSwitcher = page.locator(".scene-switcher");
  await expect(sceneSwitcher.locator(".plant-specimen")).toHaveCount(0);

  const layer = page.locator("canvas.distribution-layer");
  await page.waitForTimeout(300);
  const grasslandBefore = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("200%");
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("100%");
  await expect(page.getByText("已重置并生成新的草原植物分布").last()).toBeVisible();
  await expect.poll(() => layer.evaluate((canvas) => canvas.toDataURL())).not.toBe(grasslandBefore);

  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await page.waitForTimeout(300);
  const greenbeltBefore = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(page.getByText("已重置并生成新的绿化带植物分布").last()).toBeVisible();
  await expect.poll(() => layer.evaluate((canvas) => canvas.toDataURL())).not.toBe(greenbeltBefore);
});

test("放大后可切换拖动画布工具进行平移", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "放大草原" }).click();
  await page.getByRole("button", { name: "放大草原" }).click();
  await page.getByRole("button", { name: "拖动画布" }).click();

  const viewport = page.locator(".scene-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("未找到草原交互画布尺寸");
  const before = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .42, box.y + box.height * .42, { steps: 5 });
  await page.mouse.up();
  const after = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  expect(after.left).toBeGreaterThan(before.left);
  expect(after.top).toBeGreaterThan(before.top);
});
