<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import artemisiaImage from "../assets/plants/artemisia.png";
import dandelionImage from "../assets/plants/dandelion.png";
import foxtailImage from "../assets/plants/foxtail.png";
import groundcoverImage from "../assets/plants/groundcover.png";
import irisImage from "../assets/plants/iris.png";
import type { Plant, PlantKind, Quadrat, SceneDefinition, SceneKind } from "../types";

interface PlantRenderStyle {
  scale: number;
  aspect: number;
  cropBottom: number;
  glow: string;
}

const plantAssets: Record<PlantKind, string> = {
  artemisia: artemisiaImage,
  foxtail: foxtailImage,
  groundcover: groundcoverImage,
  dandelion: dandelionImage,
  iris: irisImage,
};

const plantStyles: Record<PlantKind, PlantRenderStyle> = {
  artemisia: { scale: 106, aspect: .72, cropBottom: .17, glow: "rgba(224, 232, 211, .9)" },
  foxtail: { scale: 112, aspect: .8, cropBottom: .14, glow: "rgba(255, 210, 92, .92)" },
  groundcover: { scale: 78, aspect: 1.55, cropBottom: .04, glow: "rgba(155, 231, 94, .88)" },
  dandelion: { scale: 92, aspect: .96, cropBottom: .17, glow: "rgba(255, 244, 168, .94)" },
  iris: { scale: 110, aspect: .84, cropBottom: .16, glow: "rgba(177, 148, 255, .94)" },
};

const scenePlantKinds: Record<SceneKind, readonly PlantKind[]> = {
  grassland: ["groundcover", "artemisia", "foxtail"],
  greenbelt: ["dandelion", "foxtail", "iris"],
};

const visibleCaps: Record<SceneKind, Record<PlantKind, number>> = {
  grassland: { artemisia: 52, foxtail: 44, groundcover: 38, dandelion: 0, iris: 0 },
  greenbelt: { artemisia: 0, groundcover: 0, dandelion: 14, foxtail: 12, iris: 33 },
};

const props = defineProps<{
  scene: SceneDefinition;
  selectedQuadrat: Quadrat | null;
  counted: boolean;
}>();

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvas");
const refreshing = shallowRef(false);
const imageCache = new Map<PlantKind, HTMLImageElement>();
let resizeObserver: ResizeObserver | null = null;
let refreshTimer: number | null = null;
let mounted = false;

function mapPoint(plant: Pick<Plant, "kind" | "x" | "y">) {
  if (props.scene.kind === "grassland") return { x: plant.x / 50 * 760, y: plant.y / 50 * 760 };
  // 绿化带逻辑坐标完整映射到上下边界之间的裸土，避免动态层越界或悬空。
  return { x: 32 + plant.x / 20 * 1136, y: 300 + plant.y / 2 * 145 };
}

function isSelectedTarget(plant: { kind: PlantKind; x: number; y: number }): boolean {
  const quadrat = props.selectedQuadrat;
  return Boolean(props.counted && quadrat && plant.kind === props.scene.targetPlant && plant.x >= quadrat.x && plant.x < quadrat.x + quadrat.size && plant.y >= quadrat.y && plant.y < quadrat.y + quadrat.size);
}

function visiblePlants(): Plant[] {
  const result: Plant[] = [];
  for (const kind of scenePlantKinds[props.scene.kind]) {
    const plants = props.scene.plants.filter((plant) => plant.kind === kind);
    const cap = visibleCaps[props.scene.kind][kind];
    const stride = Math.max(1, Math.ceil(plants.length / cap));
    result.push(...plants.filter((plant, index) => index % stride === 0 || isSelectedTarget(plant)));
  }
  return result.sort((first, second) => mapPoint(first).y - mapPoint(second).y);
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas || !mounted) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const viewBoxWidth = props.scene.kind === "grassland" ? 760 : 1200;
  const viewBoxHeight = props.scene.kind === "grassland" ? 760 : 700;
  context.save();
  context.scale(bounds.width / viewBoxWidth, bounds.height / viewBoxHeight);
  if (props.scene.kind === "grassland") {
    context.beginPath();
    context.roundRect(0, 0, 760, 760, 14);
    context.clip();
  } else {
    context.beginPath();
    context.rect(32, 245, 1136, 220);
    context.clip();
  }

  // 压低底图中的固定植被细节，让本轮三种动态植物成为明确的视觉主体。
  if (props.scene.kind === "grassland") {
    context.fillStyle = "rgba(31, 49, 20, .55)";
    context.fillRect(0, 0, viewBoxWidth, viewBoxHeight);
  }

  for (const plant of visiblePlants()) {
    const image = imageCache.get(plant.kind);
    if (!image) continue;
    const point = mapPoint(plant);
    const style = plantStyles[plant.kind];
    const irisScale = props.scene.kind === "greenbelt" && plant.kind === "iris" ? .75 : 1;
    const height = plant.size * style.scale * irisScale;
    const width = height * style.aspect;
    const sourceHeight = image.naturalHeight * (1 - style.cropBottom);
    const selected = isSelectedTarget(plant);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(plant.angle * Math.PI / 180);
    context.globalAlpha = selected ? 1 : .96;
    context.filter = selected
      ? "drop-shadow(0 0 2px rgba(255, 192, 74, .95))"
      : `drop-shadow(0 2px 2px rgba(5, 24, 12, .9)) drop-shadow(0 0 2.2px ${style.glow})`;
    context.drawImage(image, 0, 0, image.naturalWidth, sourceHeight, -width / 2, -height, width, height);
    context.filter = "none";
    if (selected) {
      context.globalAlpha = .9;
      context.strokeStyle = "#f2aa38";
      context.lineWidth = 1.8;
      context.beginPath();
      context.arc(0, -height * .46, Math.max(3, height * .18), 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
  context.restore();
}

async function loadImages(): Promise<void> {
  await Promise.all(Object.entries(plantAssets).map(([kind, source]) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => { imageCache.set(kind as PlantKind, image); resolve(); };
    image.onerror = () => resolve();
    image.src = source;
  })));
  draw();
}

watch(() => props.scene, (nextScene, previousScene) => {
  if (nextScene !== previousScene) {
    refreshing.value = true;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshing.value = false;
      refreshTimer = null;
    }, 260);
  }
  draw();
});

watch(() => [props.selectedQuadrat, props.counted], draw);

onMounted(() => {
  mounted = true;
  resizeObserver = new ResizeObserver(draw);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  void loadImages();
});

onBeforeUnmount(() => {
  mounted = false;
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
});
</script>

<template>
  <canvas ref="canvas" class="distribution-layer" :class="{ refreshing }" aria-hidden="true" />
</template>

<style scoped>
.distribution-layer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; opacity: 1; filter: saturate(1.08) contrast(1.04); transition: opacity 130ms ease, filter 130ms ease; }
.distribution-layer.refreshing { opacity: .12; filter: saturate(.72) blur(1px); }
</style>
