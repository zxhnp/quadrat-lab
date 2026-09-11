<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import artemisiaImage from "../assets/plants/render/artemisia.webp";
import dandelionImage from "../assets/plants/render/dandelion.webp";
import foxtailImage from "../assets/plants/render/foxtail.webp";
import groundcoverImage from "../assets/plants/render/groundcover.webp";
import irisImage from "../assets/plants/render/iris.webp";
import type { Plant, PlantKind, SceneDefinition, SceneKind } from "../types";

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
  grassland: { artemisia: 4500, foxtail: 540, groundcover: 540, dandelion: 0, iris: 0 },
  greenbelt: { artemisia: 0, groundcover: 0, dandelion: 100, foxtail: 40, iris: 75 },
};

const props = defineProps<{
  scene: SceneDefinition;
  displayScale: number;
}>();

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvas");
const refreshing = shallowRef(false);
const targetPlantCount = computed(() => props.scene.plants.filter((plant) => plant.kind === props.scene.targetPlant).length);
// 缩放超过 200% 后仅缓和增大植物符号，坐标仍按真实场景比例缩放。
const symbolScreenScale = computed(() => props.scene.kind === "grassland" && props.displayScale > 2
  ? 2 + (props.displayScale - 2) * .2
  : props.displayScale);
const symbolWorldScale = computed(() => symbolScreenScale.value / props.displayScale);
const imageCache = new Map<PlantKind, HTMLImageElement>();
let resizeObserver: ResizeObserver | null = null;
let mounted = false;
let imageLoadVersion = 0;
let drawFrame: number | null = null;
let contentVersion = 0;
let lastDrawnCanvas: HTMLCanvasElement | null = null;
let lastDrawnContentVersion = -1;
let lastDrawnScale = -1;
let lastDrawnWidth = -1;
let lastDrawnHeight = -1;
let lastDrawnRatio = -1;
let overviewPlants: Plant[] = [];
const renderedPlants = shallowRef<Plant[]>([]);

function mapPoint(plant: Pick<Plant, "x" | "y">, sceneKind = props.scene.kind) {
  if (sceneKind === "grassland") {
    return { x: plant.x / props.scene.widthMeters * 760, y: plant.y / props.scene.heightMeters * 760 };
  }
  // 绿化带逻辑坐标完整映射到上下边界之间的裸土。
  return {
    x: 32 + plant.x / props.scene.widthMeters * 1136,
    y: 245 + plant.y / props.scene.heightMeters * 220,
  };
}

function refreshOverviewPlants(): void {
  const sceneKind = props.scene.kind;
  const buckets = new Map<PlantKind, Plant[]>();
  for (const kind of scenePlantKinds[sceneKind]) buckets.set(kind, []);
  for (const plant of props.scene.plants) buckets.get(plant.kind)?.push(plant);

  overviewPlants = [];
  for (const kind of scenePlantKinds[sceneKind]) {
    const plants = buckets.get(kind) ?? [];
    // 目标植物必须完整绘制，确保框选前后的视觉数量与统计数据来自同一份分布。
    const cap = kind === props.scene.targetPlant
      ? plants.length
      : Math.min(plants.length, visibleCaps[sceneKind][kind]);
    if (cap === plants.length) overviewPlants.push(...plants);
    else {
      const step = plants.length / cap;
      for (let index = 0; index < cap; index += 1) overviewPlants.push(plants[Math.floor(index * step)]!);
    }
  }
  overviewPlants.sort((first, second) => mapPoint(first, sceneKind).y - mapPoint(second, sceneKind).y);
  renderedPlants.value = overviewPlants;
  contentVersion += 1;
}

function plantMetrics(plant: Plant): { height: number; width: number } {
  const style = plantStyles[plant.kind];
  const sceneScale = props.scene.kind === "grassland" ? .38 : .58;
  const irisScale = props.scene.kind === "greenbelt" && plant.kind === "iris" ? .82 : 1;
  const height = plant.size * style.scale * sceneScale * irisScale * symbolWorldScale.value;
  return { height, width: height * style.aspect };
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas || !mounted) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min((window.devicePixelRatio || 1) * Math.min(props.displayScale, 4), 4);
  if (
    canvas === lastDrawnCanvas
    && contentVersion === lastDrawnContentVersion
    && props.displayScale === lastDrawnScale
    && width === lastDrawnWidth
    && height === lastDrawnHeight
    && ratio === lastDrawnRatio
  ) return;
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
  const scaleX = width / viewBoxWidth;
  const scaleY = height / viewBoxHeight;
  context.save();
  context.scale(scaleX, scaleY);
  if (props.scene.kind === "grassland") {
    context.beginPath();
    context.roundRect(0, 0, 760, 760, 14);
    context.clip();
  } else {
    context.beginPath();
    context.rect(32, 245, 1136, 220);
    context.clip();
  }

  context.globalAlpha = .98;
  context.fillStyle = "rgba(17, 49, 24, .28)";
  for (const plant of renderedPlants.value) {
    const image = imageCache.get(plant.kind);
    if (!image) continue;
    const point = mapPoint(plant);
    const style = plantStyles[plant.kind];
    const { height, width } = plantMetrics(plant);
    const sourceHeight = image.naturalHeight * (1 - style.cropBottom);
    const radians = plant.angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    context.setTransform(
      ratio * scaleX * cosine,
      ratio * scaleY * sine,
      -ratio * scaleX * sine,
      ratio * scaleY * cosine,
      ratio * scaleX * point.x,
      ratio * scaleY * point.y,
    );
    context.beginPath();
    context.ellipse(0, 0, Math.max(2, width * .3), Math.max(1, height * .055), 0, 0, Math.PI * 2);
    context.fill();
    context.drawImage(image, 0, 0, image.naturalWidth, sourceHeight, -width / 2, -height, width, height);
  }
  context.restore();
  lastDrawnCanvas = canvas;
  lastDrawnContentVersion = contentVersion;
  lastDrawnScale = props.displayScale;
  lastDrawnWidth = width;
  lastDrawnHeight = height;
  lastDrawnRatio = ratio;
}

function scheduleDraw(): void {
  if (!mounted || drawFrame !== null) return;
  drawFrame = requestAnimationFrame(() => {
    drawFrame = null;
    draw();
  });
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
    contentVersion += 1;
    refreshing.value = false;
    scheduleDraw();
  }
}

watch(() => props.scene, (nextScene) => {
  refreshing.value = true;
  refreshOverviewPlants();
  scheduleDraw();
  void loadSceneImages(nextScene.kind);
});

watch(() => props.displayScale, scheduleDraw);

onMounted(() => {
  mounted = true;
  refreshOverviewPlants();
  resizeObserver = new ResizeObserver(scheduleDraw);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  refreshing.value = true;
  void loadSceneImages(props.scene.kind);
});

onBeforeUnmount(() => {
  mounted = false;
  if (drawFrame !== null) cancelAnimationFrame(drawFrame);
  drawFrame = null;
  lastDrawnCanvas = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  imageLoadVersion += 1;
});
</script>

<template>
  <canvas
    ref="canvas"
    class="distribution-layer"
    :class="{ refreshing }"
    :data-rendered-plant-count="renderedPlants.length"
    :data-rendered-target-count="targetPlantCount"
    :data-plant-symbol-screen-scale="symbolScreenScale"
    aria-hidden="true"
  />
</template>

<style scoped>
.distribution-layer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; opacity: 1; filter: saturate(1.08) contrast(1.04); transition: opacity 130ms ease, filter 130ms ease; }
.distribution-layer.refreshing { opacity: .2; filter: saturate(.82); }
</style>
