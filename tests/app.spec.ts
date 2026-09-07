import { test, expect } from "@playwright/test";

test("样方实验主流程可加载并切换场景", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "样方实验" })).toBeVisible();
  await expect(page.getByRole("button", { name: "草原" })).toBeVisible();
  await page.getByRole("button", { name: "绿化带" }).click();
  await expect(page.getByRole("heading", { name: "绿化带" })).toBeVisible();
  await expect(page.getByRole("button", { name: /绿化带 20m × 2m · 40m²/ })).toBeVisible();
});
