import { describe, expect, it } from "vitest";
import { actualCounts, averageDensity, compareWithActual, summarizeQuadrats } from "./calculator";
import { generateScene } from "./generator";
import type { SamplingSummary } from "../types";

describe("密度计算", () => {
  it("计算样方平均密度", () => {
    const values: SamplingSummary[] = [
      { quadratId: "1", index: 1, targetCount: 2, area: 1, density: 2 },
      { quadratId: "2", index: 2, targetCount: 4, area: 1, density: 4 },
    ];
    expect(averageDensity(values)).toBe(3);
  });

  it("用真实总量计算对比结果", () => {
    const scene = generateScene("greenbelt", 42);
    const quadrats = [{ id: "q1", index: 1, x: 0, y: 0, size: 1 }];
    const summaries = summarizeQuadrats(scene, quadrats);
    const result = compareWithActual(scene, summaries);
    expect(actualCounts(scene).dandelion).toBeGreaterThan(0);
    expect(result.actualDensity).toBeGreaterThan(0);
    expect(result.errorPercent).toBeGreaterThanOrEqual(0);
  });
});
