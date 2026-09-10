import type { Point, Plant, Quadrat, SceneDefinition } from "../types";

export const GRASSLAND_QUADRAT_SIZE = 1;
export const GREENBELT_QUADRAT_SIZE = 1;
export const FIVE_POINT_CENTER_DISTANCE = 2;

const FIVE_POINT_SNAP_DISTANCE = 0.75;

export function quadratSizeForScene(scene: SceneDefinition): number {
  return scene.kind === "grassland" ? GRASSLAND_QUADRAT_SIZE : GREENBELT_QUADRAT_SIZE;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeQuadrat(point: Point, scene: SceneDefinition): Quadrat {
  const size = quadratSizeForScene(scene);
  const y = scene.kind === "greenbelt"
    ? (scene.heightMeters - size) / 2
    : clamp(point.y - size / 2, 0, scene.heightMeters - size);
  return {
    id: "pending",
    index: 0,
    x: clamp(point.x - size / 2, 0, scene.widthMeters - size),
    y,
    size,
  };
}

export function isInsideQuadrat(plant: Plant, quadrat: Quadrat): boolean {
  return plant.x >= quadrat.x && plant.x < quadrat.x + quadrat.size && plant.y >= quadrat.y && plant.y < quadrat.y + quadrat.size;
}

export function quadratsOverlap(a: Quadrat, b: Quadrat): boolean {
  return a.x < b.x + b.size && a.x + a.size > b.x && a.y < b.y + b.size && a.y + a.size > b.y;
}

export function hasOverlap(candidate: Quadrat, existing: Quadrat[]): boolean {
  return existing.some((quadrat) => quadratsOverlap(candidate, quadrat));
}

export function fivePointQuadrats(center: Quadrat, scene: SceneDefinition): Quadrat[] {
  const axisOffset = FIVE_POINT_CENTER_DISTANCE / Math.SQRT2;
  const size = center.size;
  const centerPoint = { x: center.x + center.size / 2, y: center.y + center.size / 2 };
  const safeX = clamp(centerPoint.x, axisOffset + size / 2, scene.widthMeters - axisOffset - size / 2);
  const safeY = clamp(centerPoint.y, axisOffset + size / 2, scene.heightMeters - axisOffset - size / 2);
  const points: Point[] = [
    { x: safeX, y: safeY },
    { x: safeX - axisOffset, y: safeY - axisOffset },
    { x: safeX + axisOffset, y: safeY - axisOffset },
    { x: safeX - axisOffset, y: safeY + axisOffset },
    { x: safeX + axisOffset, y: safeY + axisOffset },
  ];
  return points.map((point, index) => ({
    id: `guide-${index + 1}`,
    index: index + 1,
    x: clamp(point.x - size / 2, 0, scene.widthMeters - size),
    y: clamp(point.y - size / 2, 0, scene.heightMeters - size),
    size,
  }));
}

export function nearestGuideQuadrat(point: Point, center: Quadrat, scene: SceneDefinition): Quadrat | null {
  const candidate = fivePointQuadrats(center, scene).slice(1).reduce<{ quadrat: Quadrat | null; distance: number }>((best, quadrat) => {
    const distance = Math.hypot(point.x - (quadrat.x + quadrat.size / 2), point.y - (quadrat.y + quadrat.size / 2));
    return distance < best.distance ? { quadrat, distance } : best;
  }, { quadrat: null, distance: Number.POSITIVE_INFINITY });
  return candidate.distance <= FIVE_POINT_SNAP_DISTANCE ? candidate.quadrat : null;
}

export function snappedEquidistantQuadrat(point: Point, first: Quadrat, spacing: number, scene: SceneDefinition): Quadrat | null {
  const size = first.size;
  const firstCenter = first.x + first.size / 2;
  const step = Math.max(1, Math.round((point.x - firstCenter) / spacing));
  const center = firstCenter + step * spacing;
  if (center < size / 2 || center > scene.widthMeters - size / 2) return null;
  const x = center - size / 2;
  return { id: "pending", index: 0, x, y: first.y, size };
}
