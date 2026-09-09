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
  await expect(page.getByRole("button", { name: /草原 50m × 50m/ })).toBeVisible();
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await expect(page.getByAltText("绿化带场景底图")).toBeVisible();
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeDisabled();
});

test("绿化带可通过两个样方建立等距并铺满", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();

  const canvas = page.locator("svg.scene-canvas");
  await dragSample(page, canvas, 0.25, 0.60);
  await dragSample(page, canvas, 0.42, 0.60);

  await expect(page.locator(".sample-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "等距铺满" })).toBeEnabled();

  await page.getByRole("button", { name: "等距铺满" }).click();
  expect(await page.locator(".sample-row").count()).toBeGreaterThan(2);
});

test("草原支持缩放后拖动框选固定一平方米样方", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "放大草原" }).click();
  await page.getByRole("button", { name: "放大草原" }).click();
  await expect(page.getByRole("button", { name: "重置草原缩放" })).toHaveText("200%");

  const canvas = page.locator("svg.scene-canvas");
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
});

test("独立工具栏与右侧操作按钮保持同列对齐", async ({ page }) => {
  await page.goto("/");
  const toolButtons = page.locator(".sampling-toolbar > .toolbar-button");
  const firstTool = await toolButtons.nth(0).boundingBox();
  const secondTool = await toolButtons.nth(1).boundingBox();
  const inspectorButtons = page.locator(".inspector-actions .el-button");
  const firstInspector = await inspectorButtons.nth(0).boundingBox();
  const secondInspector = await inspectorButtons.nth(1).boundingBox();
  expect(firstTool?.x).toBe(secondTool?.x);
  expect(firstInspector?.x).toBe(secondInspector?.x);
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
