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
  await expect(page.getByRole("button", { name: /选取样方.*1m × 1m/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /草地 30m × 30m/ })).toBeVisible();
  await page.getByRole("button", { name: /绿化带 10m × 2m/ }).click();
  await expect(page.getByAltText("绿化带场景底图")).toBeVisible();
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeDisabled();
  const toolbar = page.getByRole("complementary", { name: "取样工具栏" });
  await expect(toolbar.getByRole("button", { name: "拖动画布" })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "放大", exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "缩小", exact: true })).toHaveCount(0);
  await expect(page.locator(".greenbelt-overlay")).toHaveCount(0);
  await expect(page.locator(".canvas-caption")).not.toContainText("等距 3m 辅助线");
});

test("重叠样方只显示一次顶部消息", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  const viewport = page.locator(".scene-viewport");
  await dragSample(page, viewport, .5, .5, 16);
  await expect(page.locator(".sample-row")).toHaveCount(1);

  const firstQuadratBounds = await page.locator(".quadrats .quadrat rect").first().boundingBox();
  if (!firstQuadratBounds) throw new Error("未找到第一个样方");
  const overlapStart = {
    x: firstQuadratBounds.x + firstQuadratBounds.width / 2,
    y: firstQuadratBounds.y + firstQuadratBounds.height + 2,
  };
  await page.mouse.move(overlapStart.x, overlapStart.y);
  await page.mouse.down();
  await page.mouse.move(overlapStart.x, overlapStart.y - 16, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".sample-row")).toHaveCount(1);
  await expect(page.locator(".canvas-alert")).toHaveCount(0);
  await expect(page.locator(".el-message").filter({ hasText: "样方与已有样方重叠，请选择其他位置" })).toHaveCount(1);
});

test("绿化带可通过两个样方建立等距并铺满", async ({ page }) => {
  await page.setViewportSize({ width: 1256, height: 912 });
  await page.goto("/");
  await page.getByRole("button", { name: /绿化带 10m × 2m/ }).click();

  const canvas = page.locator("svg.scene-canvas");
  await dragSample(page, canvas, 0.20, 0.60);
  const firstQuadrat = page.locator(".quadrats .quadrat rect").first();
  await expect(firstQuadrat).toBeVisible();
  await expect.poll(async () => {
    const bounds = await firstQuadrat.boundingBox();
    return bounds ? Math.abs(bounds.width - bounds.height) : Number.POSITIVE_INFINITY;
  }).toBeLessThan(.5);
  const firstQuadratBounds = await firstQuadrat.boundingBox();
  const canvasBounds = await canvas.boundingBox();
  if (!firstQuadratBounds || !canvasBounds) throw new Error("未找到绿化带样方或画布尺寸");
  const quadratGeometryHeight = Number(await firstQuadrat.getAttribute("height"));
  expect(firstQuadratBounds.width).toBeCloseTo(firstQuadratBounds.height, 0);
  expect(quadratGeometryHeight).toBeCloseTo(220 / 2, 5);
  const quadratCenterY = firstQuadratBounds.y + firstQuadratBounds.height / 2;
  const plantingBandCenterY = canvasBounds.y + canvasBounds.height * (355 / 700);
  expect(quadratCenterY).toBeCloseTo(plantingBandCenterY, 0);
  const firstDensityLabel = page.locator(".quadrat-count-label").first();
  await expect(firstDensityLabel).toHaveText(/^\d+(?:\.\d+)?株\/m²$/);
  const firstDensityLabelBounds = await firstDensityLabel.boundingBox();
  if (!firstDensityLabelBounds) throw new Error("未找到绿化带样方密度标识");
  expect(firstDensityLabelBounds.x + firstDensityLabelBounds.width / 2).toBeCloseTo(firstQuadratBounds.x + firstQuadratBounds.width / 2, 0);
  expect(firstDensityLabelBounds.y + firstDensityLabelBounds.height).toBeLessThan(firstQuadratBounds.y);
  const firstSampleCount = Number.parseInt((await page.locator(".sample-row strong").first().textContent()) ?? "", 10);
  await expect(page.getByTestId("selected-target-marker")).toHaveCount(firstSampleCount);
  const markerCenters = await page.locator(".selected-target-markers circle").evaluateAll((circles) => circles.map((circle) => {
    const bounds = circle.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }));
  for (const center of markerCenters) {
    expect(center.x).toBeGreaterThanOrEqual(firstQuadratBounds.x);
    expect(center.x).toBeLessThanOrEqual(firstQuadratBounds.x + firstQuadratBounds.width);
    expect(center.y).toBeGreaterThanOrEqual(firstQuadratBounds.y);
    expect(center.y).toBeLessThanOrEqual(firstQuadratBounds.y + firstQuadratBounds.height);
  }
  await dragSample(page, canvas, 0.35, 0.60);

  await expect(page.locator(".sample-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeEnabled();

  await page.getByRole("button", { name: "等距铺满" }).click();
  expect(await page.locator(".sample-row").count()).toBeGreaterThan(4);
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
  expect(listOverflow.scrollHeight).toBeGreaterThanOrEqual(listOverflow.clientHeight);
  await expect(page.getByRole("button", { name: "揭晓真实结果" })).toBeVisible();
});

test("草地辅助线以开启时选中的样方为中心，后续选取时不会跳动", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  const viewport = page.locator(".scene-viewport");
  await dragSample(page, viewport, .35, .35, 20);
  await dragSample(page, viewport, .65, .65, 20);
  await expect(page.locator(".sample-row")).toHaveCount(2);
  await page.locator(".sample-row").nth(1).click();
  await page.getByRole("button", { name: "辅助线" }).click();
  const guides = page.locator(".five-point-guide rect");
  const selectedBounds = await page.locator(".quadrats .quadrat.selected rect").boundingBox();
  const guideCenterBounds = await page.locator(".five-point-guide rect.guide-center").boundingBox();
  if (!selectedBounds || !guideCenterBounds) throw new Error("未找到当前样方或辅助线中心样方");
  expect(guideCenterBounds.x + guideCenterBounds.width / 2).toBeCloseTo(selectedBounds.x + selectedBounds.width / 2, 1);
  expect(guideCenterBounds.y + guideCenterBounds.height / 2).toBeCloseTo(selectedBounds.y + selectedBounds.height / 2, 1);
  const guideGeometryBefore = await guides.evaluateAll((elements) => elements.map((element) => ({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
  })));

  await dragSample(page, viewport, .5, .8, 20);
  await expect(page.locator(".sample-row")).toHaveCount(3);
  await expect(page.locator(".sample-row").nth(2)).toHaveClass(/active/);
  const guideGeometryAfterAdding = await guides.evaluateAll((elements) => elements.map((element) => ({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
  })));
  expect(guideGeometryAfterAdding).toEqual(guideGeometryBefore);

  await page.locator(".sample-row").first().click();
  const guideGeometryAfterSelecting = await guides.evaluateAll((elements) => elements.map((element) => ({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
  })));
  expect(guideGeometryAfterSelecting).toEqual(guideGeometryBefore);
});

test("草地在二点五倍缩放下可框选真实一米样方", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("250%");
  const distributionLayer = page.locator("canvas.distribution-layer");
  await expect(distributionLayer).toBeVisible();
  await expect(distributionLayer).toHaveAttribute("data-rendered-target-count", "4500");
  await expect(distributionLayer).toHaveAttribute("data-rendered-plant-count", "5580");
  await expect(distributionLayer).toHaveAttribute("data-plant-symbol-screen-scale", "2.1");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const distributionBeforeSelection = await distributionLayer.evaluate((element) => element.toDataURL());

  const viewport = page.locator(".scene-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("未找到草地交互画布尺寸");
  await page.mouse.click(box.x + 100, box.y + 100);
  await expect(page.locator(".sample-row")).toHaveCount(0);

  await dragSample(page, viewport, 0.25, 0.25, 20);
  await expect(page.locator(".sample-row")).toHaveCount(1);
  const quadrat = page.locator("svg .quadrats .quadrat rect").first();
  expect(Number(await quadrat.getAttribute("width"))).toBeCloseTo(760 / 30, 5);
  expect(Number(await quadrat.getAttribute("height"))).toBeCloseTo(760 / 30, 5);
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

  await page.getByRole("button", { name: "重置草地缩放" }).click();
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("100%");
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
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("250%");
  const markedCount = Number(await page.locator(".sample-focus strong").first().textContent());
  expect(markedCount).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId("selected-target-marker")).toHaveCount(markedCount);
  expect(await distributionLayer.evaluate((element) => element.toDataURL())).toBe(distributionBeforeSelection);

  const fontSizeAtSamplingZoom = await densityText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.getByRole("button", { name: "放大草地" }).click();
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("400%");
  const fontSizeAboveSamplingZoom = await densityText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSizeAtSamplingZoom * 2.5).toBeCloseTo(12.25, 5);
  expect(fontSizeAboveSamplingZoom * 4).toBeCloseTo(14, 2);

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

test("草地五点样方的左侧两个密度标签在各比例下保持左置", async ({ page }) => {
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
  await page.getByRole("button", { name: "重置草地缩放" }).click();
  await expectLeftLabelsAtCurrentZoom();
  await page.getByRole("button", { name: "放大草地" }).click();
  await expectLeftLabelsAtCurrentZoom();
});

test("独立工具栏保持同列且右侧操作按钮并排", async ({ page }) => {
  await page.goto("/");
  const toolButtons = page.locator(".sampling-toolbar .toolbar-button");
  const firstTool = await toolButtons.nth(0).boundingBox();
  const secondTool = await toolButtons.nth(1).boundingBox();
  const inspectorButtons = page.locator(".inspector-actions .el-button");
  const firstInspector = await inspectorButtons.nth(0).boundingBox();
  const secondInspector = await inspectorButtons.nth(1).boundingBox();
  expect(firstTool?.x).toBe(secondTool?.x);
  expect(firstInspector?.y).toBe(secondInspector?.y);
  expect(secondInspector?.x).toBeGreaterThan(firstInspector?.x ?? Number.POSITIVE_INFINITY);
  expect(firstInspector?.height).toBeGreaterThanOrEqual(44);
  expect(secondInspector?.height).toBeGreaterThanOrEqual(44);
});

test("右侧估算区使用紧凑公式并突出真实结果", async ({ page }) => {
  await page.setViewportSize({ width: 1569, height: 912 });
  await page.goto("/");
  await page.getByRole("button", { name: "进入取样模式" }).click();
  await dragSample(page, page.locator(".scene-viewport"), .5, .5, 18);

  const estimateCard = page.locator(".estimate-card");
  const estimateBounds = await estimateCard.boundingBox();
  expect(estimateBounds?.height).toBeLessThan(90);
  await expect(estimateCard.locator(".estimate-title")).toContainText("平均种群密度");
  await expect(estimateCard.locator(".estimate-formula")).toContainText("÷ 1 =");
  await expect(estimateCard.locator("p")).toHaveCount(0);

  const actionButtons = page.locator(".inspector-actions .el-button");
  const firstAction = await actionButtons.nth(0).boundingBox();
  const secondAction = await actionButtons.nth(1).boundingBox();
  expect(firstAction?.y).toBe(secondAction?.y);

  await page.getByRole("button", { name: "计算平均值" }).click();
  await page.getByRole("button", { name: "揭晓真实结果" }).click();
  const comparisonCard = page.locator(".comparison-card");
  await expect(comparisonCard.getByText("真实结果")).toBeVisible();
  await expect(comparisonCard.getByText("4,500 株")).toBeVisible();
  const densityMetrics = comparisonCard.locator(".comparison-metric");
  await expect(densityMetrics).toHaveCount(2);
  const densityMetricBoxes = await densityMetrics.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    const value = element.querySelector("strong");
    return { y: bounds.y, fontSize: value ? Number.parseFloat(getComputedStyle(value).fontSize) : 0 };
  }));
  expect(densityMetricBoxes[0]?.y).toBe(densityMetricBoxes[1]?.y);
  expect(densityMetricBoxes.every((metric) => metric.fontSize >= 22)).toBe(true);
});

test("样方记录固定显示五条并为密度标注单位", async ({ page }) => {
  await page.setViewportSize({ width: 1569, height: 912 });
  await page.goto("/");
  const samplePanel = page.locator(".sample-list-section");
  const panelStyle = await samplePanel.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { height: bounds.height, borderStyle: style.borderStyle, backgroundImage: style.backgroundImage };
  });
  expect(panelStyle.height).toBeCloseTo(294, 0);
  expect(panelStyle.borderStyle).toBe("solid");
  expect(panelStyle.backgroundImage).not.toBe("none");
  await expect(samplePanel.getByText("完成取样后，样方数量与密度会显示在这里。")).toBeVisible();

  await page.getByRole("button", { name: "进入取样模式" }).click();
  const viewport = page.locator(".scene-viewport");
  for (const [xRatio, yRatio] of [[.12, .15], [.3, .15], [.5, .15], [.7, .15], [.88, .15], [.25, .55], [.72, .55]]) {
    await dragSample(page, viewport, xRatio, yRatio, 12);
  }
  await expect(page.locator(".sample-row")).toHaveCount(7);
  await expect(page.locator(".sample-row b")).toHaveText(Array.from({ length: 7 }, () => /\d+\.\d 株\/m²/));
  const listMetrics = await page.locator(".sample-list").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const rows = Array.from(element.querySelectorAll(".sample-row"));
    return {
      fullyVisibleRows: rows.filter((row) => {
        const rowBounds = row.getBoundingClientRect();
        return rowBounds.top >= bounds.top && rowBounds.bottom <= bounds.bottom;
      }).length,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(listMetrics.fullyVisibleRows).toBe(5);
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);
});

test("顶部实验步骤相对整条顶栏居中", async ({ page }) => {
  await page.setViewportSize({ width: 1608, height: 912 });
  await page.goto("/");

  const headerBounds = await page.locator(".topbar").boundingBox();
  const stepBounds = await page.locator(".progress-step").evaluateAll((steps) => {
    const first = steps[0]?.getBoundingClientRect();
    const last = steps.at(-1)?.getBoundingClientRect();
    return first && last ? { left: first.left, right: last.right } : null;
  });
  if (!headerBounds || !stepBounds) throw new Error("未找到顶栏或实验步骤导航");

  const headerCenter = headerBounds.x + headerBounds.width / 2;
  const stepsCenter = (stepBounds.left + stepBounds.right) / 2;
  expect(stepsCenter).toBeCloseTo(headerCenter, 0);
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
  await page.getByRole("button", { name: /绿化带 10m × 2m/ }).click();
  await page.waitForTimeout(300);
  const after = await layer.evaluate((canvas) => canvas.toDataURL());

  expect(after).not.toBe(before);

  await expect(page.getByAltText("绿化带场景底图")).toBeVisible();
  await expect(layer).toHaveAttribute("data-rendered-plant-count", "215");
});

test("场景选择使用简洁文字卡片，工具栏重置会恢复视图并生成新分布", async ({ page }) => {
  await page.goto("/");

  const sceneSwitcher = page.locator(".scene-switcher");
  await expect(sceneSwitcher.locator(".plant-specimen")).toHaveCount(0);

  const layer = page.locator("canvas.distribution-layer");
  await page.waitForTimeout(300);
  const grasslandBefore = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("200%");
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(page.getByRole("button", { name: "重置草地缩放" })).toHaveText("100%");
  await expect(page.getByText("已重置并生成新的草地植物分布").last()).toBeVisible();
  await expect.poll(() => layer.evaluate((canvas) => canvas.toDataURL())).not.toBe(grasslandBefore);

  await page.getByRole("button", { name: /绿化带 10m × 2m/ }).click();
  await page.waitForTimeout(300);
  const greenbeltBefore = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(page.getByText("已重置并生成新的绿化带植物分布").last()).toBeVisible();
  await expect.poll(() => layer.evaluate((canvas) => canvas.toDataURL())).not.toBe(greenbeltBefore);
});

test("放大后可切换拖动画布工具进行平移", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "放大草地" }).click();
  await page.getByRole("button", { name: "放大草地" }).click();
  await page.getByRole("button", { name: "拖动画布" }).click();

  const viewport = page.locator(".scene-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("未找到草地交互画布尺寸");
  const before = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .42, box.y + box.height * .42, { steps: 5 });
  await page.mouse.up();
  const after = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  expect(after.left).toBeGreaterThan(before.left);
  expect(after.top).toBeGreaterThan(before.top);
});

test.describe("高 DPI 短屏适配", () => {
  test.use({ viewport: { width: 1280, height: 608 }, deviceScaleFactor: 1.5 });

  test("150% 缩放下可滚动查看完整工作区", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1.5);
    await expect(page.getByRole("heading", { name: "样方实验" })).toBeVisible();

    const initialLayout = await page.evaluate(() => ({
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      documentOverflowY: getComputedStyle(document.documentElement).overflowY,
      appBottom: document.querySelector(".app-shell")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(initialLayout.viewportHeight).toBe(608);
    expect(initialLayout.documentHeight).toBeGreaterThan(initialLayout.viewportHeight);
    expect(initialLayout.documentOverflowY).toBe("auto");
    expect(initialLayout.appBottom).toBe(720);

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.locator(".inspector-actions").scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "揭晓真实结果" })).toBeVisible();

    const inspectorOverflow = await page.locator(".inspector-rail").evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(inspectorOverflow.overflowY).toBe("auto");
    expect(inspectorOverflow.scrollHeight).toBeGreaterThanOrEqual(inspectorOverflow.clientHeight);
  });
});
