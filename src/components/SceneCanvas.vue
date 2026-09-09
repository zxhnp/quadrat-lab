<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import grasslandArtwork from "../assets/scenes/grassland-soil-bg.webp";
import greenbeltArtwork from "../assets/scenes/greenbelt-soil-bg.webp";
import { plantMeta } from "../data";
import { countPlantsInQuadrat } from "../domain/calculator";
import { fivePointQuadrats } from "../domain/geometry";
import PlantDistributionLayer from "./PlantDistributionLayer.vue";
import type { CanvasTool, PlantKind, Point, Quadrat, SceneDefinition, SceneKind } from "../types";

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
  activeTool: CanvasTool;
}>();

const emit = defineEmits<{
  canvasClick: [point: Point];
  selectQuadrat: [id: string];
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const viewportRef = ref<HTMLDivElement | null>(null);
const grasslandZoom = ref(1);
const grasslandBaseSize = ref(0);
const dragSelection = ref<{
  pointerId: number;
  start: Point;
  startClient: Point;
  preview: Quadrat;
  distance: number;
} | null>(null);
const panDrag = ref<{
  pointerId: number;
  startClient: Point;
  startScroll: Point;
} | null>(null);
let viewportObserver: ResizeObserver | null = null;

const minZoom = 1;
const maxZoom = 2.5;
const zoomStep = .5;
const grasslandViewBox = { width: 760, height: 760 };
const greenbeltViewBox = { width: 1200, height: 700 };
const grassField = { left: 0, top: 0, size: 760 };
// 与底图中上下石质边界之间的裸土种植区严格对齐。
const beltField = { left: 32, top: 245, width: 1136, height: 220 };
const viewBox = computed(() => props.scene.kind === "grassland" ? grasslandViewBox : greenbeltViewBox);
function displayScaleForZoom(zoom: number): number {
  if (zoom <= 1) return 1;
  if (zoom <= 1.5) return 1 + (zoom - 1) / .5 * 7;
  if (zoom <= 2) return 8 + (zoom - 1.5) / .5 * 16;
  return 24 + (zoom - 2) / .5 * 8;
}

const displayScale = computed(() => displayScaleForZoom(grasslandZoom.value));
const stageFrameStyle = computed(() => {
  if (props.scene.kind !== "grassland" || !grasslandBaseSize.value) return undefined;
  const size = grasslandBaseSize.value * displayScale.value;
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${sceneArtworks.grassland})`,
    backgroundSize: `${grasslandBaseSize.value}px ${grasslandBaseSize.value}px`,
  };
});
const stageStyle = computed(() => {
  if (props.scene.kind !== "grassland" || !grasslandBaseSize.value) return undefined;
  return {
    width: `${grasslandBaseSize.value}px`,
    height: `${grasslandBaseSize.value}px`,
    transform: `scale(${displayScale.value})`,
    "--scene-display-scale": displayScale.value,
  };
});
const zoomLabel = computed(() => `${Math.round(grasslandZoom.value * 100)}%`);
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

function badgeScale(): number {
  return props.scene.kind === "grassland" ? displayScale.value : 1;
}

function densityBadgeMetrics(quadrat: Quadrat) {
  const mapped = mapQuadrat(quadrat);
  const scale = badgeScale();
  const width = scale === 1 ? 68 : 120 / scale;
  const height = scale === 1 ? 24 : 40 / scale;
  return {
    x: Math.min(viewBox.value.width - width - 1, Math.max(1, mapped.x + mapped.width - width)),
    y: Math.max(1, mapped.y - height - 1),
    width,
    height,
    radius: scale === 1 ? 8 : 12 / scale,
    fontSize: scale === 1 ? 14 : 22 / scale,
    padding: scale === 1 ? 8 : 10 / scale,
  };
}

function sizeBadgeMetrics(quadrat: Quadrat) {
  const mapped = mapQuadrat(quadrat);
  const scale = badgeScale();
  const width = scale === 1 ? 62 : 130 / scale;
  const height = scale === 1 ? 20 : 36 / scale;
  return {
    x: mapped.x + mapped.width - width,
    y: mapped.y + mapped.height - height,
    width,
    height,
    radius: scale === 1 ? 7 : 11 / scale,
    fontSize: scale === 1 ? 12 : 18 / scale,
    padding: scale === 1 ? 7 : 9 / scale,
  };
}

function quadratRectStyle(quadrat: Quadrat) {
  const scale = badgeScale();
  const selected = quadrat.id === props.selectedQuadratId;
  return {
    strokeWidth: `${(selected ? 3 : 2) / scale}`,
    strokeDasharray: selected ? `${8 / scale} ${5 / scale}` : "none",
  };
}

function eventToWorld(event: PointerEvent): Point | null {
  const svg = svgRef.value;
  if (!svg) return null;
  const bounds = svg.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width * viewBox.value.width;
  const y = (event.clientY - bounds.top) / bounds.height * viewBox.value.height;
  if (props.scene.kind === "grassland") return { x: (x - grassField.left) / grassField.size * 50, y: (y - grassField.top) / grassField.size * 50 };
  return { x: (x - beltField.left) / beltField.width * 20, y: (y - beltField.top) / beltField.height * 2 };
}

function fixedQuadratFromDrag(start: Point, current: Point): Quadrat {
  const size = 1;
  const maxX = props.scene.widthMeters - size;
  const maxY = props.scene.heightMeters - size;
  const x = current.x < start.x ? start.x - size : start.x;
  const y = current.y < start.y ? start.y - size : start.y;
  return {
    id: "drag-preview",
    index: 0,
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
    size,
  };
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  if (props.activeTool === "cursor") return;
  if (props.activeTool === "pan") {
    const viewport = viewportRef.value;
    if (!viewport) return;
    svgRef.value?.setPointerCapture(event.pointerId);
    panDrag.value = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startScroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
    };
    return;
  }
  const start = eventToWorld(event);
  if (!start || start.x < 0 || start.x > props.scene.widthMeters || start.y < 0 || start.y > props.scene.heightMeters) return;
  svgRef.value?.setPointerCapture(event.pointerId);
  dragSelection.value = {
    pointerId: event.pointerId,
    start,
    startClient: { x: event.clientX, y: event.clientY },
    preview: fixedQuadratFromDrag(start, start),
    distance: 0,
  };
}

function handlePointerMove(event: PointerEvent): void {
  const pan = panDrag.value;
  if (pan && pan.pointerId === event.pointerId) {
    const viewport = viewportRef.value;
    if (!viewport) return;
    viewport.scrollLeft = pan.startScroll.x - (event.clientX - pan.startClient.x);
    viewport.scrollTop = pan.startScroll.y - (event.clientY - pan.startClient.y);
    return;
  }
  const drag = dragSelection.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const current = eventToWorld(event);
  if (!current) return;
  drag.distance = Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y);
  drag.preview = fixedQuadratFromDrag(drag.start, current);
}

function finishDrag(event: PointerEvent, commit: boolean): void {
  const pan = panDrag.value;
  if (pan && pan.pointerId === event.pointerId) {
    if (svgRef.value?.hasPointerCapture(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId);
    panDrag.value = null;
    return;
  }
  const drag = dragSelection.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (svgRef.value?.hasPointerCapture(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId);
  dragSelection.value = null;
  if (commit && drag.distance >= 4) {
    emit("canvasClick", { x: drag.preview.x + .5, y: drag.preview.y + .5 });
  }
}

function handlePointerUp(event: PointerEvent): void {
  finishDrag(event, true);
}

function handlePointerCancel(event: PointerEvent): void {
  finishDrag(event, false);
}

function measureViewport(): void {
  const viewport = viewportRef.value;
  if (!viewport || props.scene.kind !== "grassland") return;
  grasslandBaseSize.value = Math.max(260, Math.max(viewport.clientWidth, viewport.clientHeight));
}

function applyZoom(nextZoom: number, focalPoint?: Point): void {
  const viewport = viewportRef.value;
  if (!viewport || props.scene.kind !== "grassland") return;
  const oldSize = grasslandBaseSize.value * displayScaleForZoom(grasslandZoom.value);
  let focus = focalPoint;
  if (!focus && selectedQuadrat.value) {
    const mappedCenter = mapPoint(selectedQuadrat.value.x + .5, selectedQuadrat.value.y + .5);
    const visibleCenter = {
      x: mappedCenter.x / grasslandViewBox.width * oldSize - viewport.scrollLeft,
      y: mappedCenter.y / grasslandViewBox.height * oldSize - viewport.scrollTop,
    };
    if (visibleCenter.x >= 0 && visibleCenter.x <= viewport.clientWidth && visibleCenter.y >= 0 && visibleCenter.y <= viewport.clientHeight) focus = visibleCenter;
  }
  focus ??= { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  const relativeX = oldSize ? (viewport.scrollLeft + focus.x) / oldSize : .5;
  const relativeY = oldSize ? (viewport.scrollTop + focus.y) / oldSize : .5;
  grasslandZoom.value = Math.min(maxZoom, Math.max(minZoom, nextZoom));
  void nextTick(() => {
    const newSize = grasslandBaseSize.value * displayScaleForZoom(grasslandZoom.value);
    viewport.scrollLeft = relativeX * newSize - focus.x;
    viewport.scrollTop = relativeY * newSize - focus.y;
  });
}

function handleWheel(event: WheelEvent): void {
  if (props.scene.kind !== "grassland") return;
  const viewport = viewportRef.value;
  if (!viewport) return;
  const bounds = viewport.getBoundingClientRect();
  applyZoom(grasslandZoom.value + (event.deltaY < 0 ? zoomStep : -zoomStep), {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  });
}

watch(() => props.scene.kind, () => {
  dragSelection.value = null;
  panDrag.value = null;
  grasslandZoom.value = 1;
  void nextTick(measureViewport);
});

onMounted(() => {
  viewportObserver = new ResizeObserver(measureViewport);
  if (viewportRef.value) viewportObserver.observe(viewportRef.value);
  measureViewport();
});

onBeforeUnmount(() => {
  viewportObserver?.disconnect();
  viewportObserver = null;
});

function zoomIn(): void {
  applyZoom(grasslandZoom.value + zoomStep);
}

function zoomOut(): void {
  applyZoom(grasslandZoom.value - zoomStep);
}

function resetZoom(): void {
  applyZoom(1);
}

defineExpose({ zoomIn, zoomOut, resetZoom });
</script>

<template>
  <div class="scene-canvas-shell">
    <div v-if="scene.kind === 'grassland'" class="zoom-controls" role="group" aria-label="草原缩放控制">
      <button type="button" aria-label="缩小草原" :disabled="grasslandZoom <= minZoom" @click="zoomOut">−</button>
      <button class="zoom-value" type="button" aria-label="重置草原缩放" @click="resetZoom">{{ zoomLabel }}</button>
      <button type="button" aria-label="放大草原" :disabled="grasslandZoom >= maxZoom" @click="zoomIn">+</button>
    </div>
    <div ref="viewportRef" class="scene-viewport" :class="`scene-viewport-${scene.kind}`" @wheel.prevent="handleWheel">
      <div class="scene-stage" :class="`scene-stage-${scene.kind}`" :style="stageFrameStyle">
      <div class="scene-artboard" :class="`scene-artboard-${scene.kind}`" :style="stageStyle">
        <img class="scene-artwork" :src="sceneArtworks[scene.kind]" :alt="`${scene.title}场景底图`" />
        <PlantDistributionLayer :scene="scene" :selected-quadrat="selectedQuadrat" :counted="counted" :display-scale="displayScale" />
        <svg ref="svgRef" class="scene-canvas" :class="[`tool-${activeTool}`, { selecting: dragSelection, panning: panDrag }]" :viewBox="`0 0 ${viewBox.width} ${viewBox.height}`" preserveAspectRatio="none" role="img" :aria-label="`${scene.title}交互画布`" @pointerdown="handlePointerDown" @pointermove="handlePointerMove" @pointerup="handlePointerUp" @pointercancel="handlePointerCancel">
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

          <g v-if="dragSelection" class="drag-selection" aria-hidden="true">
            <rect v-bind="mapQuadrat(dragSelection.preview)" :style="{ strokeDasharray: `${8 / badgeScale()} ${5 / badgeScale()}` }" />
          </g>

          <g class="quadrats">
          <g v-for="quadrat in quadrats" :key="quadrat.id" class="quadrat" :class="{ selected: quadrat.id === selectedQuadratId }" @pointerdown.stop @click.stop="emit('selectQuadrat', quadrat.id)">
            <rect v-bind="mapQuadrat(quadrat)" :style="quadratRectStyle(quadrat)" />
            <rect :x="densityBadgeMetrics(quadrat).x" :y="densityBadgeMetrics(quadrat).y" :width="densityBadgeMetrics(quadrat).width" :height="densityBadgeMetrics(quadrat).height" :rx="densityBadgeMetrics(quadrat).radius" class="quadrat-label-bg" />
            <text :x="densityBadgeMetrics(quadrat).x + densityBadgeMetrics(quadrat).padding" :y="densityBadgeMetrics(quadrat).y + densityBadgeMetrics(quadrat).height * .72" :style="{ fontSize: `${densityBadgeMetrics(quadrat).fontSize}px` }">{{ densityLabel(quadrat) }}</text>
            <template v-if="quadrat.id === selectedQuadratId">
              <rect :x="sizeBadgeMetrics(quadrat).x" :y="sizeBadgeMetrics(quadrat).y" :width="sizeBadgeMetrics(quadrat).width" :height="sizeBadgeMetrics(quadrat).height" :rx="sizeBadgeMetrics(quadrat).radius" class="quadrat-size-bg" />
              <text :x="sizeBadgeMetrics(quadrat).x + sizeBadgeMetrics(quadrat).padding" :y="sizeBadgeMetrics(quadrat).y + sizeBadgeMetrics(quadrat).height * .72" :style="{ fontSize: `${sizeBadgeMetrics(quadrat).fontSize}px` }">1m × 1m</text>
            </template>
          </g>
          </g>
        </svg>
      </div>
      </div>
    </div>
    <div v-if="scene.kind === 'grassland'" class="zoom-hint">滚轮或右上角按钮缩放 · 拖动框选固定 1m × 1m 样方</div>
    <div class="canvas-caption"><span><i class="dot target" />{{ plantMeta[scene.targetPlant].label }}为目标植物</span><span><i class="dot guide" />{{ scene.kind === 'grassland' ? '对角 X 辅助线' : '等距 3m 辅助线' }}</span><span>点击样方可查看统计</span></div>
  </div>
</template>

<style scoped>
.scene-canvas-shell { position: relative; min-width: 0; min-height: 0; height: 100%; flex: 1 1 auto; display: flex; flex-direction: column; gap: 7px; }
.scene-viewport { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; border-radius: 18px; background: #e6ece5; box-shadow: inset 0 0 0 1px rgba(23, 63, 45, .12); }
.scene-viewport-grassland { display: block; }
.scene-stage { position: relative; }
.scene-stage-grassland { margin: 0 auto; background-repeat: repeat; }
.scene-stage-greenbelt { width: 100%; height: 100%; }
.scene-artboard { position: relative; min-width: 0; min-height: 0; overflow: hidden; border-radius: 17px; background: #e6ece5; }
.scene-artboard-grassland { aspect-ratio: 1; flex: none; transform-origin: top left; background: transparent; }
.scene-artboard-greenbelt { width: 100%; height: 100%; }
.scene-artwork { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.scene-artboard-grassland .scene-artwork { display: none; }
.scene-artboard-greenbelt .scene-artwork { filter: brightness(.9) saturate(.88) contrast(1.03); }
.scene-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; touch-action: none; user-select: none; }
.scene-canvas.tool-cursor { cursor: default; }
.scene-canvas.tool-select { cursor: crosshair; }
.scene-canvas.tool-pan { cursor: grab; }
.scene-canvas.panning { cursor: grabbing; }
.scene-canvas.selecting { cursor: crosshair; }
.zoom-controls { position: absolute; z-index: 6; top: 10px; right: 10px; display: grid; grid-template-columns: 34px 58px 34px; height: 34px; overflow: hidden; border: 1px solid rgba(255,255,255,.7); border-radius: 11px; background: rgba(248,251,245,.94); box-shadow: 0 7px 18px rgba(18,55,38,.2); backdrop-filter: blur(8px); }
.zoom-controls button { border: 0; border-right: 1px solid #d9e5da; background: transparent; color: #174b34; font: inherit; font-size: 18px; font-weight: 800; cursor: pointer; }
.zoom-controls button:last-child { border-right: 0; }
.zoom-controls button:hover:not(:disabled) { background: #e8f3e9; }
.zoom-controls button:disabled { color: #aab8af; cursor: not-allowed; }
.zoom-controls .zoom-value { color: #587065; font-size: 11px; }
.zoom-hint { position: absolute; z-index: 5; left: 10px; bottom: 30px; padding: 6px 9px; border-radius: 8px; background: rgba(18,55,38,.78); color: #fff; font-size: 11px; pointer-events: none; }
.greenbelt-overlay text, .dimension-guide text, .road-label { fill: #f8fbf5; font-size: 15px; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; paint-order: stroke; stroke: rgba(23, 63, 45, .28); stroke-width: 3px; }
.road-label { font-size: 17px; font-weight: 800; opacity: .92; }
.quadrats rect { fill: rgba(255,255,255,.08); stroke: rgba(255,255,255,.92); stroke-width: 2; }
.quadrats .quadrat-label-bg { fill: #173f2d; stroke: none; }
.quadrats .quadrat-size-bg { fill: #173f2d; stroke: none; }
.quadrats text { fill: #fff; font-size: 14px; font-weight: 800; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; pointer-events: none; }
.quadrats .selected rect:first-child { fill: rgba(255, 178, 42, .38); stroke: #ffb22a; stroke-width: 3; }
.quadrats .selected .quadrat-label-bg { fill: #d88916; }
.drag-selection rect { fill: rgba(255, 184, 50, .32); stroke: #ffc34f; stroke-width: 3; stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; pointer-events: none; }
.drag-selection text { fill: #fff; font-size: 14px; font-weight: 800; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; paint-order: stroke; stroke: rgba(23, 63, 45, .78); stroke-width: 4px; pointer-events: none; }
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
