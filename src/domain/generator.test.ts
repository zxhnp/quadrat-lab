import { describe, expect, it } from "vitest";
import { generateScene, GRASSLAND_TARGET_DENSITY, GREENBELT_TARGET_DENSITY } from "./generator";

function signature(scene: ReturnType<typeof generateScene>, kind: "artemisia" | "foxtail" | "groundcover" | "dandelion" | "iris") {
  return scene.plants
    .filter((plant) => plant.kind === kind)
    .slice(0, 12)
    .map(({ x, y, size, angle }) => [x, y, size, angle]);
}

describe("植物分布生成器", () => {
  it("草地的茵陈蒿、狗尾巴草和小草都会随种子变化", () => {
    const first = generateScene("grassland", 101);
    const second = generateScene("grassland", 202);

    for (const kind of ["artemisia", "foxtail", "groundcover"] as const) {
      expect(signature(first, kind)).not.toEqual(signature(second, kind));
    }
  });

  it("草地按三十米见方和既定密度生成三类植物", () => {
    const grassland = generateScene("grassland", 303);

    expect(grassland.area).toBe(900);
    expect(grassland.widthMeters).toBe(30);
    expect(grassland.heightMeters).toBe(30);
    expect(grassland.plants.filter((plant) => plant.kind === "artemisia")).toHaveLength(4500);
    expect(grassland.plants.filter((plant) => plant.kind === "foxtail")).toHaveLength(540);
    expect(grassland.plants.filter((plant) => plant.kind === "groundcover")).toHaveLength(540);
  });

  it("绿化带的鸢尾花、蒲公英和狗尾巴草都会随种子变化", () => {
    const first = generateScene("greenbelt", 101);
    const second = generateScene("greenbelt", 202);

    for (const kind of ["iris", "dandelion", "foxtail"] as const) {
      expect(signature(first, kind)).not.toEqual(signature(second, kind));
    }
  });

  it("绿化带鸢尾花按五行横向铺满", () => {
    const irises = generateScene("greenbelt", 303).plants.filter((plant) => plant.kind === "iris");
    const rows = [0, 1, 2, 3, 4].map((row) => irises.filter((plant) => plant.id.startsWith(`iris-${row}-`)));

    expect(irises).toHaveLength(75);
    expect(rows.every((row) => row.length === 15)).toBe(true);
    expect(Math.min(...irises.map((plant) => plant.x))).toBeLessThan(.8);
    expect(Math.max(...irises.map((plant) => plant.x))).toBeGreaterThan(9.4);
    expect(Math.max(...rows[0]!.map((plant) => plant.y))).toBeLessThan(.3);
    expect(Math.min(...rows[2]!.map((plant) => plant.y))).toBeGreaterThan(.9);
    expect(Math.max(...rows[2]!.map((plant) => plant.y))).toBeLessThan(1.1);
    expect(Math.min(...rows[4]!.map((plant) => plant.y))).toBeGreaterThan(1.7);
  });

  it("绿化带三类植物数量与展示设置一致", () => {
    const greenbelt = generateScene("greenbelt", 606);
    expect(greenbelt.area).toBe(20);
    expect(greenbelt.widthMeters).toBe(10);
    expect(greenbelt.heightMeters).toBe(2);
    expect(greenbelt.plants.filter((plant) => plant.kind === "dandelion")).toHaveLength(100);
    expect(greenbelt.plants.filter((plant) => plant.kind === "foxtail")).toHaveLength(40);
    expect(greenbelt.plants.filter((plant) => plant.kind === "iris")).toHaveLength(75);
  });

  it("两个场景保持各自的总体密度，但局部样方自然波动", () => {
    const grassland = generateScene("grassland", 404);
    const greenbelt = generateScene("greenbelt", 505);

    for (const [scene, kind] of [[grassland, "artemisia"], [greenbelt, "dandelion"]] as const) {
      const counts = Array.from({ length: scene.widthMeters * scene.heightMeters }, () => 0);
      const targetPlants = scene.plants.filter((plant) => plant.kind === kind);
      for (const plant of targetPlants) {
        const cellIndex = Math.floor(plant.y) * scene.widthMeters + Math.floor(plant.x);
        counts[cellIndex] = (counts[cellIndex] ?? 0) + 1;
      }
      const expectedDensity = scene.kind === "grassland" ? GRASSLAND_TARGET_DENSITY : GREENBELT_TARGET_DENSITY;
      const expectedCount = scene.area * expectedDensity;
      expect(targetPlants).toHaveLength(expectedCount);
      expect(targetPlants.length / scene.area).toBe(expectedDensity);
      expect(new Set(counts).size).toBeGreaterThan(1);
      expect(counts.some((count) => count !== 5)).toBe(true);
    }
  });
});
