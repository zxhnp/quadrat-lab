import { describe, expect, it } from "vitest";
import { fivePointQuadrats, hasOverlap, isInsideQuadrat, snappedEquidistantQuadrat } from "./geometry";
import { generateScene } from "./generator";
import type { Plant, Quadrat } from "../types";

describe("样方几何规则", () => {
  const scene = generateScene("grassland", 1234);
  const center: Quadrat = { id: "center", index: 1, x: 24.5, y: 24.5, size: 1 };

  it("五点法会生成中心和四角五个样方", () => {
    const points = fivePointQuadrats(center, scene);
    expect(points).toHaveLength(5);
    expect(points[0]?.x).toBeCloseTo(center.x);
    expect(points[0]?.y).toBeCloseTo(center.y);
  });

  it("样方重叠时被拒绝", () => {
    expect(hasOverlap({ id: "candidate", index: 2, x: 24.8, y: 24.5, size: 1 }, [center])).toBe(true);
    expect(hasOverlap({ id: "candidate", index: 2, x: 30, y: 30, size: 1 }, [center])).toBe(false);
  });

  it("边界采用左上包含、右下不包含", () => {
    const plant: Plant = { id: "boundary", kind: "artemisia", x: 25.5, y: 25.5, size: 1, angle: 0 };
    expect(isInsideQuadrat(plant, center)).toBe(false);
    expect(isInsideQuadrat({ ...plant, x: 24.5, y: 24.5 }, center)).toBe(true);
  });

  it("绿化带样方保持同一水平线并按间距吸附", () => {
    const belt = generateScene("greenbelt", 5678);
    const first: Quadrat = { id: "first", index: 1, x: 3, y: 0.5, size: 1 };
    const snapped = snappedEquidistantQuadrat({ x: 9.1, y: 1.7 }, first, 3, belt);
    expect(snapped).not.toBeNull();
    if (!snapped) return;
    expect(snapped.y).toBe(first.y);
    expect(snapped.x).toBeCloseTo(9);
  });

  it("等距吸附不会把样方裁到边界而破坏间距", () => {
    const belt = generateScene("greenbelt", 5678);
    const first: Quadrat = { id: "first", index: 1, x: 3, y: 0.5, size: 1 };
    expect(snappedEquidistantQuadrat({ x: 19.5, y: 1 }, first, 8.9, belt)).toBeNull();
  });
});
