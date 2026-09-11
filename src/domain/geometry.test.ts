import { describe, expect, it } from "vitest";
import { FIVE_POINT_CORNER_DISTANCE, fivePointQuadrats, hasOverlap, isInsideQuadrat, normalizeQuadrat, snappedEquidistantQuadrat } from "./geometry";
import { generateScene } from "./generator";
import type { Plant, Quadrat } from "../types";

describe("样方几何规则", () => {
  const scene = generateScene("grassland", 1234);
  const center: Quadrat = { id: "center", index: 1, x: 24.5, y: 24.5, size: 1 };

  it("一米和四米样方的五点角点净距均为两米且互不重叠", () => {
    const centers: Quadrat[] = [
      center,
      { id: "large-center", index: 1, x: 13, y: 13, size: 4 },
    ];

    for (const sourceCenter of centers) {
      const points = fivePointQuadrats(sourceCenter, scene);
      const centerGuide = points[0];
      expect(centerGuide).toBeDefined();
      if (!centerGuide) continue;
      expect(points).toHaveLength(5);

      for (const corner of points.slice(1)) {
        const outerFacingX = corner.x < centerGuide.x ? corner.x + corner.size : corner.x;
        const outerFacingY = corner.y < centerGuide.y ? corner.y + corner.size : corner.y;
        const centerFacingX = corner.x < centerGuide.x ? centerGuide.x : centerGuide.x + centerGuide.size;
        const centerFacingY = corner.y < centerGuide.y ? centerGuide.y : centerGuide.y + centerGuide.size;
        expect(Math.hypot(outerFacingX - centerFacingX, outerFacingY - centerFacingY)).toBeCloseTo(FIVE_POINT_CORNER_DISTANCE);
      }
      points.forEach((point, index) => {
        expect(hasOverlap(point, points.slice(0, index))).toBe(false);
      });
    }
  });

  it("中心样方靠近边界时拒绝生成五点辅助样方且不移动中心", () => {
    const boundaryCenters: Quadrat[] = [
      { id: "small-boundary", index: 1, x: 0, y: 10, size: 1 },
      { id: "large-boundary", index: 1, x: 10, y: 0, size: 4 },
    ];

    for (const boundaryCenter of boundaryCenters) {
      const originalCenter = { ...boundaryCenter };
      expect(fivePointQuadrats(boundaryCenter, scene)).toEqual([]);
      expect(boundaryCenter).toEqual(originalCenter);
    }
  });

  it("五点辅助样方恰好贴边时仍可完整生成", () => {
    const size = 4;
    const axisOffset = size + FIVE_POINT_CORNER_DISTANCE / Math.SQRT2;
    const boundaryCenter: Quadrat = { id: "exact-boundary", index: 1, x: axisOffset, y: axisOffset, size };
    const points = fivePointQuadrats(boundaryCenter, scene);

    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(expect.objectContaining({ x: boundaryCenter.x, y: boundaryCenter.y }));
    expect(Math.min(...points.map((point) => point.x))).toBeCloseTo(0);
    expect(Math.min(...points.map((point) => point.y))).toBeCloseTo(0);
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

  it("绿化带同样采用计上不计下、计左不计右", () => {
    const quadrat: Quadrat = { id: "greenbelt", index: 1, x: 3, y: .5, size: 1 };
    const plant: Plant = { id: "boundary", kind: "dandelion", x: 3, y: .5, size: 1, angle: 0 };

    expect(isInsideQuadrat(plant, quadrat)).toBe(true);
    expect(isInsideQuadrat({ ...plant, x: 4 }, quadrat)).toBe(false);
    expect(isInsideQuadrat({ ...plant, y: 1.5 }, quadrat)).toBe(false);
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

  it("草地支持一米和四米样方，绿化带始终使用一米样方", () => {
    const grasslandQuadrat = normalizeQuadrat({ x: 25, y: 25 }, scene);
    const largeGrasslandQuadrat = normalizeQuadrat({ x: 25, y: 25 }, scene, 4);
    const greenbeltQuadrat = normalizeQuadrat({ x: 10, y: .2 }, generateScene("greenbelt", 5678), 4);

    expect(grasslandQuadrat.size).toBe(1);
    expect(grasslandQuadrat.x).toBe(24.5);
    expect(grasslandQuadrat.y).toBe(24.5);
    expect(largeGrasslandQuadrat.size).toBe(4);
    expect(largeGrasslandQuadrat.x).toBe(23);
    expect(largeGrasslandQuadrat.y).toBe(23);
    expect(greenbeltQuadrat.size).toBe(1);
    expect(greenbeltQuadrat.y).toBe(.5);
  });
});
