<script setup lang="ts">
import { computed, ref } from "vue";
import grasslandArtwork from "../assets/scenes/grassland-soil-bg.webp";
import greenbeltArtwork from "../assets/scenes/greenbelt-soil-bg.webp";
import { plantMeta } from "../data";
import { countPlantsInQuadrat } from "../domain/calculator";
import { fivePointQuadrats } from "../domain/geometry";
import PlantDistributionLayer from "./PlantDistributionLayer.vue";
import type { PlantKind, Point, Quadrat, SceneDefinition, SceneKind } from "../types";

const sceneArtworks: Record<SceneKind, string> = {
  grassland: grasslandArtwork,
  greenbelt: greenbeltArtwork,
};

const props = defineProps<{
  scene: SceneDefinition;
  quadrats: Quadrat[];
  selectedQuadratId: string | null;
  guideVisible: boolean;
  counted: boolean;
}>();

const emit = defineEmits<{
  canvasClick: [point: Point];
  selectQuadrat: [id: string];
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const grasslandViewBox = { width: 760, height: 760 };
const greenbeltViewBox = { width: 1200, height: 700 };
const grassField = { left: 0, top: 0, size: 760 };
// 与底图中上下石质边界之间的裸土种植区严格对齐。
const beltField = { left: 32, top: 245, width: 1136, height: 220 };
const viewBox = computed(() => props.scene.kind === "grassland" ? grasslandViewBox : greenbeltViewBox);
const selectedQuadrat = computed(() => props.quadrats.find((item) => item.id === props.selectedQuadratId) ?? null);
const quadratDensities = computed(() => new Map(props.quadrats.map((quadrat) => [
  quadrat.id,
  countPlantsInQuadrat(props.scene, quadrat) / (quadrat.size * quadrat.size),
])));

function mapPoint(x: number, y: number): Point {
  if (props.scene.kind === "grassland") return { x: grassField.left + x / 50 * grassField.size, y: grassField.top + y / 50 * grassField.size };
  return { x: beltField.left + x / 20 * beltField.width, y: beltField.top + y / 2 * beltField.height };
}

const guideQuadrats = computed(() => props.scene.kind === "grassland" && props.guideVisible && props.quadrats.length ? fivePointQuadrats(props.quadrats[0]!, props.scene) : []);
const guideLinePath = computed(() => {
  if (guideQuadrats.value.length !== 5) return "";
  const points = guideQuadrats.value.map((quadrat) => mapPoint(quadrat.x + .5, quadrat.y + .5));
  const tl = points[1]!;
  const tr = points[2]!;
  const bl = points[3]!;
  const br = points[4]!;
  return `M ${tl.x} ${tl.y} L ${br.x} ${br.y} M ${tr.x} ${tr.y} L ${bl.x} ${bl.y}`;
});

function mapQuadrat(quadrat: Quadrat) {
  if (props.scene.kind === "greenbelt") {
    const center = mapPoint(quadrat.x + quadrat.size / 2, quadrat.y + quadrat.size / 2);
    const side = quadrat.size / props.scene.widthMeters * beltField.width;
    return { x: center.x - side / 2, y: center.y - side / 2, width: side, height: side };
  }
  const topLeft = mapPoint(quadrat.x, quadrat.y);
  const bottomRight = mapPoint(quadrat.x + quadrat.size, quadrat.y + quadrat.size);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function densityLabel(quadrat: Quadrat): string {
  const density = quadratDensities.value.get(quadrat.id) ?? 0;
  const display = Number.isInteger(density) ? density.toFixed(0) : density.toFixed(1);
  return `${display}株/㎡`;
}

function densityBadgePosition(quadrat: Quadrat): Point {
  const mapped = mapQuadrat(quadrat);
  return {
    x: Math.min(viewBox.value.width - 72, Math.max(4, mapped.x + mapped.width - 68)),
    y: Math.max(4, mapped.y - 28),
  };
}

function handleCanvasClick(event: MouseEvent): void {
  const svg = svgRef.value;
  if (!svg) return;
  const bounds = svg.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width * viewBox.value.width;
  const y = (event.clientY - bounds.top) / bounds.height * viewBox.value.height;
  if (props.scene.kind === "grassland") emit("canvasClick", { x: (x - grassField.left) / grassField.size * 50, y: (y - grassField.top) / grassField.size * 50 });
  else emit("canvasClick", { x: (x - beltField.left) / beltField.width * 20, y: (y - beltField.top) / beltField.height * 2 });
}
</script>

<template>
  <div class="scene-canvas-shell">
    <div class="scene-artboard" :class="`scene-artboard-${scene.kind}`">
      <img class="scene-artwork" :src="sceneArtworks[scene.kind]" :alt="`${scene.title}场景底图`" />
      <PlantDistributionLayer :scene="scene" :selected-quadrat="selectedQuadrat" :counted="counted" />
      <svg ref="svgRef" class="scene-canvas" :viewBox="`0 0 ${viewBox.width} ${viewBox.height}`" preserveAspectRatio="none" role="img" :aria-label="`${scene.title}交互画布`" @click="handleCanvasClick">
        <template v-if="scene.kind === 'grassland'">
          <g class="five-point-guide">
            <path v-if="guideQuadrats.length" :d="guideLinePath" />
            <rect v-for="guide in guideQuadrats" :key="guide.id" v-bind="mapQuadrat(guide)" class="guide-quadrat" :class="{ 'guide-center': guide.index === 1 }" />
          </g>
        </template>

        <template v-else>
          <g class="greenbelt-overlay" aria-hidden="true">
            <text x="36" y="218" class="road-label">乔木带</text>
            <text x="36" y="585" class="road-label">道路</text>
            <g class="greenbelt-sample-guides">
              <line v-for="quadrat in quadrats" :key="`drop-${quadrat.id}`" :x1="mapQuadrat(quadrat).x + mapQuadrat(quadrat).width / 2" y1="465" :x2="mapQuadrat(quadrat).x + mapQuadrat(quadrat).width / 2" y2="590" />
            </g>
            <g class="dimension-guide"><path d="M85 660H1115" /><path d="M85 660l13-7M85 660l13 7M1115 660l-13-7M1115 660l-13 7" /><rect x="544" y="642" width="112" height="32" rx="9" fill="#3d7ea6" /><text x="563" y="664">等距 3m</text></g>
          </g>
        </template>

        <g class="quadrats">
          <g v-for="quadrat in quadrats" :key="quadrat.id" class="quadrat" :class="{ selected: quadrat.id === selectedQuadratId }" @click.stop="emit('selectQuadrat', quadrat.id)">
            <rect v-bind="mapQuadrat(quadrat)" />
            <rect :x="densityBadgePosition(quadrat).x" :y="densityBadgePosition(quadrat).y" width="68" height="24" rx="8" class="quadrat-label-bg" />
            <text :x="densityBadgePosition(quadrat).x + 8" :y="densityBadgePosition(quadrat).y + 17">{{ densityLabel(quadrat) }}</text>
          </g>
        </g>
      </svg>
    </div>
    <div class="canvas-caption"><span><i class="dot target" />{{ plantMeta[scene.targetPlant].label }}为目标植物</span><span><i class="dot guide" />{{ scene.kind === 'grassland' ? '对角 X 辅助线' : '等距 3m 辅助线' }}</span><span>点击样方可查看统计</span></div>
  </div>
</template>

<style scoped>
.scene-canvas-shell { min-width: 0; min-height: 0; height: 100%; flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; }
.scene-artboard { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; width: 100%; overflow: hidden; border-radius: 18px; background: #e6ece5; box-shadow: inset 0 0 0 1px rgba(23, 63, 45, .12); }
.scene-artboard-grassland { width: min(100%, 760px); aspect-ratio: 1; max-width: 100%; max-height: 100%; align-self: center; }
.scene-artwork { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.scene-artboard-grassland .scene-artwork { filter: brightness(.82) saturate(.76) contrast(1.04); }
.scene-artboard-greenbelt .scene-artwork { filter: brightness(.9) saturate(.88) contrast(1.03); }
.scene-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; cursor: crosshair; }
.greenbelt-overlay text, .dimension-guide text, .road-label { fill: #f8fbf5; font-size: 15px; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; paint-order: stroke; stroke: rgba(23, 63, 45, .28); stroke-width: 3px; }
.road-label { font-size: 17px; font-weight: 800; opacity: .92; }
.quadrats rect { fill: rgba(255,255,255,.08); stroke: rgba(255,255,255,.92); stroke-width: 2; vector-effect: non-scaling-stroke; }
.quadrats .quadrat-label-bg { fill: #173f2d; stroke: none; }
.quadrats text { fill: #fff; font-size: 14px; font-weight: 800; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; pointer-events: none; }
.quadrats .selected rect:first-child { fill: rgba(255, 178, 42, .38); stroke: #ffb22a; stroke-width: 3; }
.quadrats .selected .quadrat-label-bg { fill: #d88916; }
.guide-quadrat { fill: rgba(255,255,255,.08); stroke: #fff; stroke-width: 2; stroke-dasharray: 7 5; vector-effect: non-scaling-stroke; }
.guide-center { fill: rgba(215,154,61,.22); stroke: #f1a62d; stroke-width: 3; stroke-dasharray: none; }
.five-point-guide path { fill: none; stroke: #fff; stroke-width: 2.6; stroke-dasharray: 8 7; opacity: .95; vector-effect: non-scaling-stroke; }
.dimension-guide path:first-child { fill: none; stroke: #3d9ad0; stroke-width: 3; vector-effect: non-scaling-stroke; }
.greenbelt-sample-guides line { stroke: #3d9ad0; stroke-width: 2; stroke-dasharray: 7 5; opacity: .9; vector-effect: non-scaling-stroke; }
.canvas-caption { display: flex; justify-content: space-between; gap: 12px; padding: 4px 3px 0; color: #718178; font-size: 12px; flex: none; }
.canvas-caption span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.target { background: #d79a3d; }
.dot.guide { background: #3d7ea6; }
</style>
