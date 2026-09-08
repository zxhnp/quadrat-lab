import type { Plant, PlantKind, SceneDefinition, SceneKind } from "../types";
import { sceneMeta } from "../data";

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
  // 先用网格覆盖保证每个区域都有植物，再用斑块采样保留草原的聚集感。
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

function createGrassland(seed: number): SceneDefinition {
  const random = mulberry32(seed);
  const plants: Plant[] = [];
  const targetCenters = [
    { x: 9, y: 9, spread: 13 }, { x: 25, y: 10, spread: 14 }, { x: 42, y: 9, spread: 13 },
    { x: 10, y: 25, spread: 15 }, { x: 27, y: 25, spread: 16 }, { x: 44, y: 25, spread: 14 },
    { x: 9, y: 42, spread: 14 }, { x: 25, y: 41, spread: 16 }, { x: 42, y: 42, spread: 14 },
  ];
  const otherCenters = [
    { x: 8, y: 8, spread: 18 }, { x: 25, y: 18, spread: 22 }, { x: 44, y: 10, spread: 18 },
    { x: 12, y: 38, spread: 20 }, { x: 33, y: 34, spread: 22 }, { x: 45, y: 44, spread: 16 },
  ];
  for (let i = 0; i < 1650; i++) {
    const point = coveredPoint(random, 50, 50, targetCenters, i, 1650);
    plants.push(plant(`artemisia-${i}`, "artemisia", point.x, point.y, random, 0.55));
  }
  for (let i = 0; i < 1150; i++) {
    const point = coveredPoint(random, 50, 50, otherCenters, i, 1150);
    plants.push(plant(`foxtail-${i}`, "foxtail", point.x, point.y, random, 0.66));
  }
  for (let i = 0; i < 800; i++) {
    const point = coveredPoint(random, 50, 50, otherCenters, i, 800);
    plants.push(plant(`groundcover-${i}`, "groundcover", point.x, point.y, random, 0.48));
  }
  return {
    kind: "grassland",
    title: sceneMeta.grassland.label,
    subtitle: sceneMeta.grassland.subtitle,
    area: 2500,
    widthMeters: 50,
    heightMeters: 50,
    targetPlant: sceneMeta.grassland.targetPlant,
    plants,
  };
}

function createGreenbelt(seed: number): SceneDefinition {
  const random = mulberry32(seed);
  const plants: Plant[] = [];
  const irisRows = 3;
  const irisColumns = 11;
  for (let row = 0; row < irisRows; row++) {
    for (let column = 0; column < irisColumns; column++) {
      const stagger = row % 2 === 0 ? 0 : .28;
      const x = Math.min(19.65, Math.max(.35, (column + .5 + stagger) / irisColumns * 20 + (random() - .5) * .24));
      const y = (row + .5) / irisRows * 2 + (random() - .5) * .1;
      plants.push(plant(`iris-${row}-${column}`, "iris", x, y, random, 0.9));
    }
  }
  for (let i = 0; i < 50; i++) {
    plants.push(plant(`dandelion-${i}`, "dandelion", 0.25 + random() * 19.5, 0.3 + random() * 1.35, random, 0.6));
  }
  for (let i = 0; i < 44; i++) {
    plants.push(plant(`foxtail-${i}`, "foxtail", 0.25 + random() * 19.5, 0.28 + random() * 1.4, random, 0.62));
  }
  return {
    kind: "greenbelt",
    title: sceneMeta.greenbelt.label,
    subtitle: sceneMeta.greenbelt.subtitle,
    area: 40,
    widthMeters: 20,
    heightMeters: 2,
    targetPlant: sceneMeta.greenbelt.targetPlant,
    plants,
  };
}

export function generateScene(kind: SceneKind, seed = Date.now()): SceneDefinition {
  return kind === "grassland" ? createGrassland(seed) : createGreenbelt(seed);
}
