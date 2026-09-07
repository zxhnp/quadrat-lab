import type { Point, Plant, Quadrat, SceneDefinition } from "../types";

export const QUADRAT_SIZE = 1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeQuadrat(point: Point, scene: SceneDefinition): Quadrat {
  return {
    id: "pending",
    index: 0,
    x: clamp(point.x - QUADRAT_SIZE / 2, 0, scene.widthMeters - QUADRAT_SIZE),
    y: clamp(point.y - QUADRAT_SIZE / 2, 0, scene.heightMeters - QUADRAT_SIZE),
    size: QUADRAT_SIZE,
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
  const half = 8;
  const centerPoint = { x: center.x + center.size / 2, y: center.y + center.size / 2 };
  const safeX = clamp(centerPoint.x, half + 0.5, scene.widthMeters - half - 0.5);
  const safeY = clamp(centerPoint.y, half + 0.5, scene.heightMeters - half - 0.5);
  const points: Point[] = [
    { x: safeX, y: safeY },
    { x: safeX - half, y: safeY - half },
    { x: safeX + half, y: safeY - half },
    { x: safeX - half, y: safeY + half },
    { x: safeX + half, y: safeY + half },
  ];
  return points.map((point, index) => ({
    id: `guide-${index + 1}`,
    index: index + 1,
    x: clamp(point.x - QUADRAT_SIZE / 2, 0, scene.widthMeters - QUADRAT_SIZE),
    y: clamp(point.y - QUADRAT_SIZE / 2, 0, scene.heightMeters - QUADRAT_SIZE),
    size: QUADRAT_SIZE,
  }));
}

export function nearestGuideQuadrat(point: Point, center: Quadrat, scene: SceneDefinition): Quadrat | null {
  const candidate = fivePointQuadrats(center, scene).slice(1).reduce<{ quadrat: Quadrat | null; distance: number }>((best, quadrat) => {
    const distance = Math.hypot(point.x - (quadrat.x + 0.5), point.y - (quadrat.y + 0.5));
    return distance < best.distance ? { quadrat, distance } : best;
  }, { quadrat: null, distance: Number.POSITIVE_INFINITY });
  return candidate.distance <= 2 ? candidate.quadrat : null;
}

export function snappedEquidistantQuadrat(point: Point, first: Quadrat, spacing: number, scene: SceneDefinition): Quadrat | null {
  const firstCenter = first.x + first.size / 2;
  const step = Math.max(1, Math.round((point.x - firstCenter) / spacing));
  const center = firstCenter + step * spacing;
  if (center < QUADRAT_SIZE / 2 || center > scene.widthMeters - QUADRAT_SIZE / 2) return null;
  const x = center - QUADRAT_SIZE / 2;
  return { id: "pending", index: 0, x, y: first.y, size: QUADRAT_SIZE };
}
