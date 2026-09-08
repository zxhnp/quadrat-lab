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

  it("绿化带鸢尾花按三行横向铺满", () => {
    const irises = generateScene("greenbelt", 303).plants.filter((plant) => plant.kind === "iris");
    const rows = [0, 1, 2].map((row) => irises.filter((plant) => plant.id.startsWith(`iris-${row}-`)));

    expect(irises).toHaveLength(33);
    expect(rows.every((row) => row.length === 11)).toBe(true);
    expect(Math.min(...irises.map((plant) => plant.x))).toBeLessThan(1.2);
    expect(Math.max(...irises.map((plant) => plant.x))).toBeGreaterThan(18.8);
  });
});
