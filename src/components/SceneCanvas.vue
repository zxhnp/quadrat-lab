<script setup lang="ts">
import { computed, ref } from "vue";
import { plantMeta } from "../data";
import { fivePointQuadrats } from "../domain/geometry";
import type { Point, Quadrat, SceneDefinition, PlantKind } from "../types";

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
const viewBox = "0 0 760 610";
const grassField = { left: 24, top: 40, size: 532 };
const beltField = { left: 26, top: 242, width: 684, height: 68 };

const targetKind = computed<PlantKind>(() => props.scene.targetPlant);
const plantsByKind = computed(() => {
  const groups: Record<PlantKind, typeof props.scene.plants> = { artemisia: [], foxtail: [], groundcover: [], iris: [], dandelion: [] };
  for (const item of props.scene.plants) groups[item.kind].push(item);
  return groups;
});

function mapPoint(x: number, y: number): Point {
  if (props.scene.kind === "grassland") return { x: grassField.left + x / 50 * grassField.size, y: grassField.top + y / 50 * grassField.size };
  return { x: beltField.left + x / 20 * beltField.width, y: beltField.top + y / 2 * beltField.height };
}

function pathFor(kind: PlantKind, highlighted = false): string {
  const items = highlighted ? highlightedPlants.value : plantsByKind.value[kind];
  const color = highlighted ? "#D79A3D" : plantMeta[kind].color;
  return items.map((item) => {
    const point = mapPoint(item.x, item.y);
    const size = Math.max(3, item.size * (props.scene.kind === "grassland" ? 8 : 11));
    const lean = Math.sin(item.angle * Math.PI / 180) * size * 0.24;
    return `M ${point.x.toFixed(2)} ${(point.y + size).toFixed(2)} L ${(point.x + lean).toFixed(2)} ${(point.y - size * .25).toFixed(2)} M ${(point.x + lean).toFixed(2)} ${(point.y + size * .1).toFixed(2)} C ${(point.x - size * .55).toFixed(2)} ${(point.y - size * .45).toFixed(2)} ${(point.x - size * .7).toFixed(2)} ${(point.y - size * .9).toFixed(2)} ${(point.x - size * .18).toFixed(2)} ${(point.y - size * 1.08).toFixed(2)} M ${(point.x + lean).toFixed(2)} ${(point.y + size * .1).toFixed(2)} C ${(point.x + size * .55).toFixed(2)} ${(point.y - size * .45).toFixed(2)} ${(point.x + size * .7).toFixed(2)} ${(point.y - size * .9).toFixed(2)} ${(point.x + size * .18).toFixed(2)} ${(point.y - size * 1.08).toFixed(2)}`;
  }).join(" ");
}

const selectedQuadrat = computed(() => props.quadrats.find((item) => item.id === props.selectedQuadratId) ?? null);
const highlightedPlants = computed(() => {
  if (!props.counted || !selectedQuadrat.value) return [];
  const q = selectedQuadrat.value;
  return props.scene.plants.filter((plant) => plant.kind === targetKind.value && plant.x >= q.x && plant.x < q.x + q.size && plant.y >= q.y && plant.y < q.y + q.size);
});
const baseTargetPath = computed(() => pathFor(targetKind.value));
const baseFoxtailPath = computed(() => pathFor("foxtail"));
const baseGroundcoverPath = computed(() => pathFor("groundcover"));
const baseIrisPath = computed(() => pathFor("iris"));
const baseDandelionPath = computed(() => pathFor("dandelion"));
const highlightedPath = computed(() => pathFor(targetKind.value, true));

const guideQuadrats = computed(() => {
  if (props.scene.kind !== "grassland" || !props.guideVisible || props.quadrats.length === 0) return [];
  return fivePointQuadrats(props.quadrats[0]!, props.scene);
});

function mapQuadrat(quadrat: Quadrat) {
  const topLeft = mapPoint(quadrat.x, quadrat.y);
  const bottomRight = mapPoint(quadrat.x + quadrat.size, quadrat.y + quadrat.size);
  return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
}

function handleCanvasClick(event: MouseEvent): void {
  const svg = svgRef.value;
  if (!svg) return;
  const bounds = svg.getBoundingClientRect();
  const ratioX = (event.clientX - bounds.left) / bounds.width;
  const ratioY = (event.clientY - bounds.top) / bounds.height;
  if (props.scene.kind === "grassland") emit("canvasClick", { x: ratioX * 760 / grassField.size * 50 - grassField.left / grassField.size * 50, y: ratioY * 610 / grassField.size * 50 - grassField.top / grassField.size * 50 });
  else emit("canvasClick", { x: (ratioX * 760 - beltField.left) / beltField.width * 20, y: (ratioY * 610 - beltField.top) / beltField.height * 2 });
}
</script>

<template>
  <div class="scene-canvas-shell">
    <svg ref="svgRef" class="scene-canvas" :viewBox="viewBox" role="img" :aria-label="`${scene.title}交互画布`" @click="handleCanvasClick">
      <defs>
        <pattern id="grass-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="#D1E1D0" stroke-width="1" opacity=".42" />
        </pattern>
        <pattern id="road-lines" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0 0V34" stroke="#A4A9A3" stroke-width="2" opacity=".33" />
        </pattern>
      </defs>

      <template v-if="scene.kind === 'grassland'">
        <rect x="0" y="0" width="760" height="610" rx="26" fill="#DCE9D9" />
        <rect :x="grassField.left" :y="grassField.top" :width="grassField.size" :height="grassField.size" rx="20" fill="url(#grass-grid)" opacity=".72" />
        <path d="M24 486C150 446 222 507 336 475S466 448 556 487V572H24Z" fill="#C7DDC5" opacity=".94" />
        <path :d="baseTargetPath" fill="none" stroke="#D79A3D" stroke-width="1.35" stroke-linecap="round" opacity=".62" />
        <path :d="baseFoxtailPath" fill="none" stroke="#5B8B70" stroke-width="1.25" stroke-linecap="round" opacity=".7" />
        <path :d="baseGroundcoverPath" fill="none" stroke="#89A99A" stroke-width="1.1" stroke-linecap="round" opacity=".7" />
        <path v-if="counted && selectedQuadratId" :d="highlightedPath" fill="none" stroke="#17372A" stroke-width="2.25" stroke-linecap="round" />
        <g class="canvas-label">
          <rect x="44" y="58" width="178" height="38" rx="12" fill="#FFFFFF" opacity=".9" />
          <text x="60" y="82">草原 50m × 50m · 2500m²</text>
        </g>
        <g v-if="guideQuadrats.length" class="five-point-guide">
          <rect x="0" y="0" width="0" height="0" />
          <path :d="`M ${mapPoint(guideQuadrats[1]!.x + .5, guideQuadrats[1]!.y + .5).x} ${mapPoint(guideQuadrats[1]!.x + .5, guideQuadrats[1]!.y + .5).y} L ${mapPoint(guideQuadrats[4]!.x + .5, guideQuadrats[4]!.y + .5).x} ${mapPoint(guideQuadrats[4]!.x + .5, guideQuadrats[4]!.y + .5).y} M ${mapPoint(guideQuadrats[2]!.x + .5, guideQuadrats[2]!.y + .5).x} ${mapPoint(guideQuadrats[2]!.x + .5, guideQuadrats[2]!.y + .5).y} L ${mapPoint(guideQuadrats[3]!.x + .5, guideQuadrats[3]!.y + .5).x} ${mapPoint(guideQuadrats[3]!.x + .5, guideQuadrats[3]!.y + .5).y}`" />
          <rect v-for="guide in guideQuadrats" :key="guide.id" v-bind="mapQuadrat(guide)" class="guide-quadrat" :class="{ 'guide-center': guide.index === 1 }" />
        </g>
      </template>

      <template v-else>
        <rect x="0" y="0" width="760" height="610" rx="26" fill="#E9EFE7" />
        <path d="M0 75H760V205H0Z" fill="#B5C7AF" />
        <path d="M0 0H760V76H0Z" fill="#C8D8C2" />
        <g class="trees" fill="#2F6B4F">
          <g v-for="tree in [70, 175, 280, 390, 500, 620, 710]" :key="tree" :transform="`translate(${tree} 42)`"><circle cx="0" cy="0" r="19" fill="#4F7C5A" /><circle cx="-16" cy="9" r="13" fill="#69916C" /><circle cx="18" cy="10" r="14" fill="#3E6C4C" /><rect x="-3" y="18" width="6" height="26" rx="3" fill="#765E4C" /></g>
        </g>
        <rect :x="beltField.left" :y="beltField.top - 12" :width="beltField.width" :height="beltField.height + 24" rx="16" fill="#D6E4D1" stroke="#B7CEB9" stroke-width="2" />
        <path :d="baseIrisPath" fill="none" stroke="#6D73A8" stroke-width="2.1" stroke-linecap="round" />
        <path :d="baseDandelionPath" fill="none" stroke="#D79A3D" stroke-width="1.65" stroke-linecap="round" />
        <path :d="baseFoxtailPath" fill="none" stroke="#5B8B70" stroke-width="1.45" stroke-linecap="round" />
        <path v-if="counted && selectedQuadratId" :d="highlightedPath" fill="none" stroke="#17372A" stroke-width="2.6" stroke-linecap="round" />
        <rect x="0" y="344" width="760" height="175" fill="#777D78" />
        <rect x="0" y="344" width="760" height="175" fill="url(#road-lines)" />
        <path d="M0 344H760" stroke="#ECE5C9" stroke-width="8" stroke-dasharray="22 14" />
        <path d="M0 432H760" stroke="#D5D9D4" stroke-width="3" stroke-dasharray="28 22" opacity=".7" />
        <g class="canvas-label">
          <rect x="44" y="222" width="180" height="38" rx="12" fill="#FFFFFF" opacity=".9" />
          <text x="60" y="246">绿化带 20m × 2m · 40m²</text>
          <text x="55" y="386" fill="#FFFFFF" opacity=".88">马路</text>
        </g>
      </template>

      <g class="quadrats">
        <g v-for="quadrat in quadrats" :key="quadrat.id" class="quadrat" :class="{ selected: quadrat.id === selectedQuadratId }" @click.stop="emit('selectQuadrat', quadrat.id)">
          <rect v-bind="mapQuadrat(quadrat)" />
          <text :x="mapQuadrat(quadrat).x + 5" :y="mapQuadrat(quadrat).y - 8">样方 {{ quadrat.index }}</text>
        </g>
      </g>
    </svg>
    <div class="canvas-caption">
      <span><i class="dot target" />{{ plantMeta[scene.targetPlant].label }}为目标植物</span>
      <span><i class="dot sample" />点击画布放置 1m × 1m 样方</span>
    </div>
  </div>
</template>

<style scoped>
.scene-canvas-shell { min-width: 0; }
.scene-canvas { display: block; width: 100%; height: auto; overflow: visible; cursor: crosshair; }
.canvas-label text { fill: #5B7165; font-size: 12px; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.quadrats rect { fill: rgba(255,255,255,.14); stroke: rgba(255,255,255,.92); stroke-width: 2; vector-effect: non-scaling-stroke; }
.quadrats text { fill: #17372A; font-size: 12px; font-weight: 700; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; pointer-events: none; }
.quadrats .selected rect { fill: rgba(215,154,61,.24); stroke: #D79A3D; stroke-width: 3; }
.guide-quadrat { fill: rgba(255,255,255,.08); stroke: #4E7DA8; stroke-width: 1.6; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
.guide-center { fill: rgba(215,154,61,.2); stroke: #D79A3D; stroke-width: 2.5; stroke-dasharray: none; }
.five-point-guide path { fill: none; stroke: #4E7DA8; stroke-width: 1.8; stroke-dasharray: 6 6; opacity: .78; vector-effect: non-scaling-stroke; }
.canvas-caption { display: flex; justify-content: space-between; gap: 12px; padding: 10px 4px 0; color: #718178; font-size: 12px; }
.canvas-caption span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.target { background: #D79A3D; }
.dot.sample { background: #4E7DA8; }
</style>
