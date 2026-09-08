import { test, expect } from "@playwright/test";

test("样方实验主流程可加载并切换场景", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "样方实验" })).toBeVisible();
  await expect(page.getByRole("button", { name: /草原 50m × 50m/ })).toBeVisible();
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await expect(page.getByRole("heading", { name: "绿化带" })).toBeVisible();
  await expect(page.getByText("20m × 2m · 40m²")).toBeVisible();
});

test("绿化带可通过两个样方建立等距并铺满", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();

  const canvas = page.locator("svg.scene-canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("未找到交互画布尺寸");
  }

  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.60);
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.60);

  await expect(page.getByText("2 个样方")).toBeVisible();
  await expect(page.getByRole("button", { name: "标准铺满绿化带" })).toBeEnabled();

  await page.getByRole("button", { name: "标准铺满绿化带" }).click();
  await expect(page.getByText("6 个样方")).toBeVisible();
  await expect(page.getByText("6 / ∞")).toBeVisible();
});

test("草原和绿化带的动态植物层会随重新生成改变分布", async ({ page }) => {
  await page.goto("/");
  const layer = page.locator("canvas.distribution-layer");
  await expect(layer).toBeVisible();
  await page.waitForTimeout(300);

  const before = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "重新生成植物" }).click();
  await expect(page.getByText("已生成新的植物分布").last()).toBeVisible();
  await page.waitForTimeout(300);
  const after = await layer.evaluate((canvas) => canvas.toDataURL());

  expect(after).not.toBe(before);

  await page.getByRole("button", { name: /绿化带 20m × 2m/ }).click();
  await page.waitForTimeout(300);
  const beltBefore = await layer.evaluate((canvas) => canvas.toDataURL());
  await page.getByRole("button", { name: "重新生成植物" }).click();
  await expect(page.getByText("已生成新的植物分布").last()).toBeVisible();
  await page.waitForTimeout(300);
  const beltAfter = await layer.evaluate((canvas) => canvas.toDataURL());

  expect(beltAfter).not.toBe(beltBefore);
  await expect(page.getByRole("heading", { name: "绿化带" })).toBeVisible();
});
