import type { ComparisonResult, Plant, PlantKind, Quadrat, SamplingSummary, SceneDefinition } from "../types";
import { isInsideQuadrat } from "./geometry";

export function countPlantsInQuadrat(scene: SceneDefinition, quadrat: Quadrat): number {
  return scene.plants.filter((plant) => plant.kind === scene.targetPlant && isInsideQuadrat(plant, quadrat)).length;
}

export function summarizeQuadrats(scene: SceneDefinition, quadrats: Quadrat[]): SamplingSummary[] {
  return quadrats.map((quadrat) => {
    const area = quadrat.size * quadrat.size;
    const targetCount = countPlantsInQuadrat(scene, quadrat);
    return {
      quadratId: quadrat.id,
      index: quadrat.index,
      targetCount,
      area,
      density: targetCount / area,
    };
  });
}

export function averageDensity(summaries: SamplingSummary[]): number {
  if (summaries.length === 0) return 0;
  return summaries.reduce((sum, item) => sum + item.density, 0) / summaries.length;
}

export function actualCounts(scene: SceneDefinition): Record<PlantKind, number> {
  const counts: Record<PlantKind, number> = {
    artemisia: 0,
    foxtail: 0,
    groundcover: 0,
    iris: 0,
    dandelion: 0,
  };
  for (const plant of scene.plants) counts[plant.kind] += 1;
  return counts;
}

export function compareWithActual(scene: SceneDefinition, summaries: SamplingSummary[]): ComparisonResult {
  const estimatedDensity = averageDensity(summaries);
  const counts = actualCounts(scene);
  const actualDensity = counts[scene.targetPlant] / scene.area;
  const errorPercent = actualDensity === 0 ? 0 : Math.abs(estimatedDensity - actualDensity) / actualDensity * 100;
  return { estimatedDensity, actualDensity, errorPercent, actualCounts: counts };
}

export function plantsInQuadrat(scene: SceneDefinition, quadrat: Quadrat): Plant[] {
  return scene.plants.filter((plant) => plant.kind === scene.targetPlant && isInsideQuadrat(plant, quadrat));
}
