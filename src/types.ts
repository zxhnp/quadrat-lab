export type SceneKind = "grassland" | "greenbelt";

export type PlantKind =
  | "artemisia"
  | "foxtail"
  | "groundcover"
  | "iris"
  | "dandelion";

export type SamplingMode = "free" | "fivePoint" | "equidistant";

export interface Plant {
  id: string;
  kind: PlantKind;
  x: number;
  y: number;
  size: number;
  angle: number;
}

export interface SceneDefinition {
  kind: SceneKind;
  title: string;
  subtitle: string;
  widthMeters: number;
  heightMeters: number;
  area: number;
  targetPlant: PlantKind;
  plants: Plant[];
}

export interface Quadrat {
  id: string;
  index: number;
  x: number;
  y: number;
  size: number;
}

export interface SamplingSummary {
  quadratId: string;
  index: number;
  targetCount: number;
  area: number;
  density: number;
}

export interface ComparisonResult {
  estimatedDensity: number;
  actualDensity: number;
  errorPercent: number;
  actualCounts: Record<PlantKind, number>;
}

export interface Point {
  x: number;
  y: number;
}
