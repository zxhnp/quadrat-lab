<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import artemisiaImage from "../assets/plants/render/artemisia.webp";
import dandelionImage from "../assets/plants/render/dandelion.webp";
import foxtailImage from "../assets/plants/render/foxtail.webp";
import groundcoverImage from "../assets/plants/render/groundcover.webp";
import irisImage from "../assets/plants/render/iris.webp";
import type { Plant, PlantKind, Quadrat, SceneDefinition, SceneKind } from "../types";

interface PlantRenderStyle {
  scale: number;
  aspect: number;
  cropBottom: number;
}

const plantAssets: Record<PlantKind, string> = {
  artemisia: artemisiaImage,
  foxtail: foxtailImage,
  groundcover: groundcoverImage,
  dandelion: dandelionImage,
  iris: irisImage,
};

const plantStyles: Record<PlantKind, PlantRenderStyle> = {
  artemisia: { scale: 106, aspect: .72, cropBottom: .17 },
  foxtail: { scale: 112, aspect: .8, cropBottom: .14 },
  groundcover: { scale: 84, aspect: 1.28, cropBottom: 0 },
  dandelion: { scale: 92, aspect: .96, cropBottom: .17 },
  iris: { scale: 110, aspect: .84, cropBottom: .16 },
};

const scenePlantKinds: Record<SceneKind, readonly PlantKind[]> = {
  grassland: ["groundcover", "artemisia", "foxtail"],
  greenbelt: ["dandelion", "foxtail", "iris"],
};

const visibleCaps: Record<SceneKind, Record<PlantKind, number>> = {
  grassland: { artemisia: 240, foxtail: 110, groundcover: 90, dandelion: 0, iris: 0 },
  greenbelt: { artemisia: 0, groundcover: 0, dandelion: 80, foxtail: 50, iris: 32 },
};

const props = defineProps<{
  scene: SceneDefinition;
  selectedQuadrat: Quadrat | null;
  counted: boolean;
  displayScale: number;
}>();

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvas");
const refreshing = shallowRef(false);
const imageCache = new Map<PlantKind, HTMLImageElement>();
let resizeObserver: ResizeObserver | null = null;
let mounted = false;
let imageLoadVersion = 0;
let overviewPlants: Plant[] = [];
let visiblePlantSet = new Set<Plant>();
const renderedPlants = shallowRef<Plant[]>([]);
const zoomPlants = shallowRef<Plant[]>([]);

function mapPoint(plant: Pick<Plant, "x" | "y">, sceneKind = props.scene.kind) {
  if (sceneKind === "grassland") return { x: plant.x / 50 * 760, y: plant.y / 50 * 760 };
  // 绿化带逻辑坐标完整映射到上下边界之间的裸土。
  return { x: 32 + plant.x / 20 * 1136, y: 245 + plant.y / 2 * 220 };
}

function isSelectedTarget(plant: { kind: PlantKind; x: number; y: number }): boolean {
  return isInsideSelectedTarget(plant);
}

function isInsideSelectedTarget(plant: { kind: PlantKind; x: number; y: number }): boolean {
  const quadrat = props.selectedQuadrat;
  return Boolean(quadrat && plant.kind === props.scene.targetPlant && plant.x >= quadrat.x && plant.x < quadrat.x + quadrat.size && plant.y >= quadrat.y && plant.y < quadrat.y + quadrat.size);
}

function refreshOverviewPlants(): void {
  const sceneKind = props.scene.kind;
  const buckets = new Map<PlantKind, Plant[]>();
  for (const kind of scenePlantKinds[sceneKind]) buckets.set(kind, []);
  for (const plant of props.scene.plants) buckets.get(plant.kind)?.push(plant);

  overviewPlants = [];
  for (const kind of scenePlantKinds[sceneKind]) {
    const plants = buckets.get(kind) ?? [];
    const cap = Math.min(plants.length, visibleCaps[sceneKind][kind]);
    if (cap === plants.length) overviewPlants.push(...plants);
    else {
      const step = plants.length / cap;
      for (let index = 0; index < cap; index += 1) overviewPlants.push(plants[Math.floor(index * step)]!);
    }
  }
  overviewPlants.sort((first, second) => mapPoint(first, sceneKind).y - mapPoint(second, sceneKind).y);
  visiblePlantSet = new Set(overviewPlants);
  refreshRenderedPlants();
}

function refreshRenderedPlants(): void {
  const focus = props.selectedQuadrat
    ? { x: props.selectedQuadrat.x + .5, y: props.selectedQuadrat.y + .5 }
    : { x: props.scene.widthMeters / 2, y: props.scene.heightMeters / 2 };
  const margin = props.scene.kind === "grassland" && props.displayScale > 1 ? 2.7 : 0;
  const nearbyPlants = margin
    ? props.scene.plants.filter((plant) => Math.abs(plant.x - focus.x) <= margin && Math.abs(plant.y - focus.y) <= margin)
    : [];
  zoomPlants.value = nearbyPlants.sort((first, second) => mapPoint(first).y - mapPoint(second).y);
  const selectedPlants = nearbyPlants.filter((plant) => !visiblePlantSet.has(plant));
  renderedPlants.value = [...overviewPlants, ...selectedPlants]
    .sort((first, second) => mapPoint(first).y - mapPoint(second).y);
}

function domPlantStyle(plant: Plant) {
  const point = mapPoint(plant);
  const style = plantStyles[plant.kind];
  const sceneScale = props.scene.kind === "grassland" ? .68 : .7;
  const irisScale = props.scene.kind === "greenbelt" && plant.kind === "iris" ? .82 : 1;
  const height = plant.size * style.scale * sceneScale * irisScale * 4.2;
  const width = height * style.aspect;
  const viewBoxWidth = props.scene.kind === "grassland" ? 760 : 1200;
  const viewBoxHeight = props.scene.kind === "grassland" ? 760 : 700;
  return {
    left: `${point.x / viewBoxWidth * 100}%`,
    top: `${point.y / viewBoxHeight * 100}%`,
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(-50%, -100%) scale(${1 / Math.max(1, props.displayScale)}) rotate(${plant.angle}deg)`,
  };
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas || !mounted) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const sceneScale = Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--scene-display-scale")) || 1;
  const ratio = Math.min((window.devicePixelRatio || 1) * Math.min(sceneScale, 3), 4);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const viewBoxWidth = props.scene.kind === "grassland" ? 760 : 1200;
  const viewBoxHeight = props.scene.kind === "grassland" ? 760 : 700;
  context.save();
  context.scale(width / viewBoxWidth, height / viewBoxHeight);
  if (props.scene.kind === "grassland") {
    context.beginPath();
    context.roundRect(0, 0, 760, 760, 14);
    context.clip();
  } else {
    context.beginPath();
    context.rect(32, 245, 1136, 220);
    context.clip();
  }

  for (const plant of renderedPlants.value) {
    const image = imageCache.get(plant.kind);
    if (!image) continue;
    const point = mapPoint(plant);
    const style = plantStyles[plant.kind];
    const sceneScale = props.scene.kind === "grassland" ? .68 : .7;
    const irisScale = props.scene.kind === "greenbelt" && plant.kind === "iris" ? .82 : 1;
    const zoomSizeCompensation = props.scene.kind === "grassland" ? Math.pow(Math.max(1, props.displayScale), .75) : 1;
    const height = plant.size * style.scale * sceneScale * irisScale / zoomSizeCompensation;
    const width = height * style.aspect;
    const sourceHeight = image.naturalHeight * (1 - style.cropBottom);
    const selected = isSelectedTarget(plant);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(plant.angle * Math.PI / 180);
    context.globalAlpha = selected ? 1 : .98;
    context.fillStyle = "rgba(17, 49, 24, .28)";
    context.beginPath();
    context.ellipse(0, 0, Math.max(2, width * .3), Math.max(1, height * .055), 0, 0, Math.PI * 2);
    context.fill();
    context.drawImage(image, 0, 0, image.naturalWidth, sourceHeight, -width / 2, -height, width, height);
    context.restore();
  }
  context.restore();
}

async function loadSceneImages(sceneKind: SceneKind): Promise<void> {
  const version = ++imageLoadVersion;
  await Promise.all(scenePlantKinds[sceneKind].map((kind) => {
    if (imageCache.has(kind)) return Promise.resolve();
    return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => { imageCache.set(kind, image); resolve(); };
    image.onerror = () => resolve();
    image.src = plantAssets[kind];
    });
  }));
  if (version === imageLoadVersion && props.scene.kind === sceneKind) {
    refreshing.value = false;
    draw();
  }
}

watch(() => props.scene, (nextScene) => {
  refreshing.value = true;
  refreshOverviewPlants();
  draw();
  void loadSceneImages(nextScene.kind);
});

watch(() => [props.selectedQuadrat, props.counted, props.displayScale], () => {
  refreshRenderedPlants();
  draw();
});

onMounted(() => {
  mounted = true;
  refreshOverviewPlants();
  resizeObserver = new ResizeObserver(draw);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  refreshing.value = true;
  void loadSceneImages(props.scene.kind);
});

onBeforeUnmount(() => {
  mounted = false;
  resizeObserver?.disconnect();
  resizeObserver = null;
  imageLoadVersion += 1;
});
</script>

<template>
  <canvas ref="canvas" v-show="displayScale === 1" class="distribution-layer" :class="{ refreshing }" aria-hidden="true" />
  <div v-if="displayScale > 1" class="zoom-plant-layer" aria-hidden="true">
    <img v-for="plant in zoomPlants" :key="plant.id" :src="plantAssets[plant.kind]" alt="" :style="domPlantStyle(plant)" />
  </div>
</template>

<style scoped>
.distribution-layer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; opacity: 1; filter: saturate(1.08) contrast(1.04); transition: opacity 130ms ease, filter 130ms ease; }
.distribution-layer.refreshing { opacity: .2; filter: saturate(.82); }
.zoom-plant-layer { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.zoom-plant-layer img { position: absolute; display: block; max-width: none; object-fit: contain; object-position: center bottom; transform-origin: 50% 100%; filter: saturate(1.08) contrast(1.04) drop-shadow(0 2px 2px rgba(18, 48, 28, .28)); }
</style>
