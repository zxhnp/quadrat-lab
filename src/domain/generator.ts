import type { Plant, PlantKind, SceneDefinition, SceneKind } from "../types";
import { sceneMeta } from "../data";

export const GRASSLAND_TARGET_DENSITY = 5;
export const GREENBELT_TARGET_DENSITY = 5;

const GRASSLAND_SIDE_METERS = 30;
const GRASSLAND_COMPANION_DENSITY = .6;
const GREENBELT_WIDTH_METERS = 10;
const GREENBELT_HEIGHT_METERS = 2;
const GREENBELT_IRIS_COLUMNS = 15;
const GREENBELT_FOXTAIL_DENSITY = 2;

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plant(id: string, kind: PlantKind, x: number, y: number, random: () => number, size = 0.8): Plant {
  return { id, kind, x, y, size: size * (0.8 + random() * 0.35), angle: -12 + random() * 24 };
}

function clusteredPoint(random: () => number, width: number, height: number, centers: Array<{ x: number; y: number; spread: number }>): { x: number; y: number } {
  const center = centers[Math.floor(random() * centers.length)] ?? centers[0] ?? { x: width / 2, y: height / 2, spread: 1 };
  return {
    x: Math.min(width - 0.2, Math.max(0.2, center.x + (random() - 0.5) * center.spread)),
    y: Math.min(height - 0.2, Math.max(0.2, center.y + (random() - 0.5) * center.spread)),
  };
}

function coveredPoint(
  random: () => number,
  width: number,
  height: number,
  centers: Array<{ x: number; y: number; spread: number }>,
  index: number,
  total: number,
): { x: number; y: number } {
  // 先用网格覆盖保证每个区域都有植物，再用斑块采样保留草地的聚集感。
  const coverageCount = Math.floor(total * .42);
  if (index < coverageCount) {
    const columns = 5;
    const rows = 5;
    const cell = index % (columns * rows);
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    return {
      x: (column + .1 + random() * .8) / columns * width,
      y: (row + .1 + random() * .8) / rows * height,
    };
  }
  return clusteredPoint(random, width, height, centers);
}

function scatteredPoint(random: () => number, width: number, height: number): { x: number; y: number } {
  return {
    x: .18 + random() * (width - .36),
    y: .18 + random() * (height - .36),
  };
}

function spreadGreenbeltPoint(random: () => number, existing: Array<{ x: number; y: number }>, minDistance: number): { x: number; y: number } {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = scatteredPoint(random, GREENBELT_WIDTH_METERS, GREENBELT_HEIGHT_METERS);
    if (existing.every((point) => Math.hypot(candidate.x - point.x, candidate.y - point.y) >= minDistance)) return candidate;
  }
  return scatteredPoint(random, GREENBELT_WIDTH_METERS, GREENBELT_HEIGHT_METERS);
}

function createGrassland(seed: number): SceneDefinition {
  const random = mulberry32(seed);
  const plants: Plant[] = [];
  const layoutScale = GRASSLAND_SIDE_METERS / 50;
  const otherCenters = [
    { x: 8, y: 8, spread: 18 }, { x: 25, y: 18, spread: 22 }, { x: 44, y: 10, spread: 18 },
    { x: 12, y: 38, spread: 20 }, { x: 33, y: 34, spread: 22 }, { x: 45, y: 44, spread: 16 },
  ].map((center) => ({
    x: center.x * layoutScale,
    y: center.y * layoutScale,
    spread: center.spread * layoutScale,
  }));
  // 位置在生成场景时一次确定，框选只统计、不补植株。
  const area = GRASSLAND_SIDE_METERS * GRASSLAND_SIDE_METERS;
  const targetCount = area * GRASSLAND_TARGET_DENSITY;
  const companionCount = area * GRASSLAND_COMPANION_DENSITY;
  for (let i = 0; i < targetCount; i++) {
    const point = scatteredPoint(random, GRASSLAND_SIDE_METERS, GRASSLAND_SIDE_METERS);
    plants.push(plant(`artemisia-${i}`, "artemisia", point.x, point.y, random, 0.42));
  }
  for (let i = 0; i < companionCount; i++) {
    const point = coveredPoint(random, GRASSLAND_SIDE_METERS, GRASSLAND_SIDE_METERS, otherCenters, i, companionCount);
    plants.push(plant(`foxtail-${i}`, "foxtail", point.x, point.y, random, 0.46));
  }
  for (let i = 0; i < companionCount; i++) {
    const point = coveredPoint(random, GRASSLAND_SIDE_METERS, GRASSLAND_SIDE_METERS, otherCenters, i, companionCount);
    plants.push(plant(`groundcover-${i}`, "groundcover", point.x, point.y, random, 0.4));
  }
  return {
    kind: "grassland",
    title: sceneMeta.grassland.label,
    subtitle: sceneMeta.grassland.subtitle,
    area,
    widthMeters: GRASSLAND_SIDE_METERS,
    heightMeters: GRASSLAND_SIDE_METERS,
    targetPlant: sceneMeta.grassland.targetPlant,
    plants,
  };
}

function createGreenbelt(seed: number): SceneDefinition {
  const random = mulberry32(seed);
  const plants: Plant[] = [];
  const irisRowPositions = [.22, .61, 1, 1.39, 1.78] as const;
  const dandelionPoints: Array<{ x: number; y: number }> = [];
  const foxtailPoints: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < irisRowPositions.length; row++) {
    for (let column = 0; column < GREENBELT_IRIS_COLUMNS; column++) {
      const stagger = row % 2 === 0 ? 0 : .22;
      const x = Math.min(
        GREENBELT_WIDTH_METERS - .35,
        Math.max(.35, (column + .45 + stagger) / GREENBELT_IRIS_COLUMNS * GREENBELT_WIDTH_METERS + (random() - .5) * .18),
      );
      const y = irisRowPositions[row]! + (random() - .5) * .06;
      plants.push(plant(`iris-${row}-${column}`, "iris", x, y, random, 0.58));
    }
  }
  const area = GREENBELT_WIDTH_METERS * GREENBELT_HEIGHT_METERS;
  const dandelionCount = area * GREENBELT_TARGET_DENSITY;
  for (let i = 0; i < dandelionCount; i++) {
    const point = spreadGreenbeltPoint(random, dandelionPoints, .22);
    dandelionPoints.push(point);
    plants.push(plant(`dandelion-${i}`, "dandelion", point.x, point.y, random, 0.4));
  }
  const foxtailCount = area * GREENBELT_FOXTAIL_DENSITY;
  for (let i = 0; i < foxtailCount; i++) {
    const point = spreadGreenbeltPoint(random, foxtailPoints, .34);
    foxtailPoints.push(point);
    plants.push(plant(`foxtail-${i}`, "foxtail", point.x, point.y, random, 0.44));
  }
  return {
    kind: "greenbelt",
    title: sceneMeta.greenbelt.label,
    subtitle: sceneMeta.greenbelt.subtitle,
    area,
    widthMeters: GREENBELT_WIDTH_METERS,
    heightMeters: GREENBELT_HEIGHT_METERS,
    targetPlant: sceneMeta.greenbelt.targetPlant,
    plants,
  };
}

export function generateScene(kind: SceneKind, seed = Date.now()): SceneDefinition {
  return kind === "grassland" ? createGrassland(seed) : createGreenbelt(seed);
}
