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

function createGrassland(seed: number): SceneDefinition {
  const random = mulberry32(seed);
  const plants: Plant[] = [];
  const targetCenters = [
    { x: 10, y: 12, spread: 14 }, { x: 24, y: 25, spread: 16 }, { x: 40, y: 16, spread: 12 },
    { x: 16, y: 40, spread: 18 }, { x: 38, y: 38, spread: 16 }, { x: 29, y: 10, spread: 10 },
  ];
  const otherCenters = [{ x: 8, y: 8, spread: 20 }, { x: 30, y: 20, spread: 24 }, { x: 44, y: 42, spread: 18 }];
  for (let i = 0; i < 1650; i++) {
    const point = clusteredPoint(random, 50, 50, targetCenters);
    plants.push(plant(`artemisia-${i}`, "artemisia", point.x, point.y, random, 0.55));
  }
  for (let i = 0; i < 1150; i++) {
    const point = clusteredPoint(random, 50, 50, otherCenters);
    plants.push(plant(`foxtail-${i}`, "foxtail", point.x, point.y, random, 0.66));
  }
  for (let i = 0; i < 800; i++) {
    const point = clusteredPoint(random, 50, 50, otherCenters);
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
  for (let i = 0; i < 11; i++) {
    plants.push(plant(`iris-${i}`, "iris", 1.5 + i * 1.65 + (random() - 0.5) * 0.2, 0.45 + (random() - 0.5) * 0.14, random, 0.9));
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
