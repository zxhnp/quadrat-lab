import { describe, expect, it } from "vitest";
import { generateScene } from "./generator";

function signature(scene: ReturnType<typeof generateScene>, kind: "artemisia" | "foxtail" | "groundcover" | "dandelion" | "iris") {
  return scene.plants
    .filter((plant) => plant.kind === kind)
    .slice(0, 12)
    .map(({ x, y, size, angle }) => [x, y, size, angle]);
}

describe("植物分布生成器", () => {
  it("草原的茵陈蒿、狗尾巴草和小草都会随种子变化", () => {
    const first = generateScene("grassland", 101);
    const second = generateScene("grassland", 202);

    for (const kind of ["artemisia", "foxtail", "groundcover"] as const) {
      expect(signature(first, kind)).not.toEqual(signature(second, kind));
    }
  });

  it("绿化带的鸢尾花、蒲公英和狗尾巴草都会随种子变化", () => {
    const first = generateScene("greenbelt", 101);
    const second = generateScene("greenbelt", 202);

    for (const kind of ["iris", "dandelion", "foxtail"] as const) {
      expect(signature(first, kind)).not.toEqual(signature(second, kind));
    }
  });

  it("绿化带鸢尾花按上下两行横向铺满", () => {
    const irises = generateScene("greenbelt", 303).plants.filter((plant) => plant.kind === "iris");
    const rows = [0, 1].map((row) => irises.filter((plant) => plant.id.startsWith(`iris-${row}-`)));

    expect(irises).toHaveLength(32);
    expect(rows.every((row) => row.length === 16)).toBe(true);
    expect(Math.min(...irises.map((plant) => plant.x))).toBeLessThan(1.2);
    expect(Math.max(...irises.map((plant) => plant.x))).toBeGreaterThan(18.8);
    expect(Math.max(...rows[0]!.map((plant) => plant.y))).toBeLessThan(.6);
    expect(Math.min(...rows[1]!.map((plant) => plant.y))).toBeGreaterThan(1.6);
  });

  it("两个场景的每个整米样方都有五株目标植物", () => {
    const grassland = generateScene("grassland", 404);
    const greenbelt = generateScene("greenbelt", 505);

    for (const [scene, kind] of [[grassland, "artemisia"], [greenbelt, "dandelion"]] as const) {
      for (let y = 0; y < scene.heightMeters; y++) {
        for (let x = 0; x < scene.widthMeters; x++) {
          const count = scene.plants.filter((item) => item.kind === kind && item.x >= x && item.x < x + 1 && item.y >= y && item.y < y + 1).length;
          expect(count).toBe(5);
        }
      }
    }
  });
});
