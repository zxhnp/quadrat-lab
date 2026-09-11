<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Aim,
  ArrowRight,
  CircleCheck,
  Connection,
  Grid,
  Histogram,
  InfoFilled,
  Location,
  Operation,
  View,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import headerTexture from "./assets/header-botanical-texture.png";
import AppLogo from "./components/AppLogo.vue";
import PlantSpecimen from "./components/PlantSpecimen.vue";
import SamplingToolbar from "./components/SamplingToolbar.vue";
import SceneCanvas from "./components/SceneCanvas.vue";
import { plantMeta, sceneMeta } from "./data";
import { actualCounts, compareWithActual, summarizeQuadrats } from "./domain/calculator";
import {
  clamp,
  DEFAULT_QUADRAT_SIZE,
  fivePointQuadrats,
  hasOverlap,
  nearestGuideQuadrat,
  normalizeQuadrat,
  snappedEquidistantQuadrat,
} from "./domain/geometry";
import { generateScene } from "./domain/generator";
import type { CanvasTool, ComparisonResult, PlantKind, Point, Quadrat, QuadratSize, SamplingMode, SceneDefinition, SceneKind, SamplingSummary } from "./types";

const sceneKind = ref<SceneKind>("grassland");
let sceneSeed = Date.now();
const scene = ref<SceneDefinition>(generateScene(sceneKind.value, sceneSeed));
const quadrats = ref<Quadrat[]>([]);
const selectedQuadratId = ref<string | null>(null);
const selectedQuadratIds = ref<string[]>([]);
const guideVisible = ref(false);
const guideAnchorQuadratId = ref<string | null>(null);
const averageReady = ref(false);
const revealed = ref(false);
const spacing = ref<number | null>(null);
const history = ref<Quadrat[][]>([]);
const activeMode = ref<SamplingMode>("free");
const activeCanvasTool = ref<CanvasTool>("select");
const quadratSize = ref<QuadratSize>(DEFAULT_QUADRAT_SIZE);
const sceneCanvasRef = ref<InstanceType<typeof SceneCanvas> | null>(null);

const meta = computed(() => sceneMeta[sceneKind.value]);
const summaries = computed<SamplingSummary[]>(() => summarizeQuadrats(scene.value, quadrats.value));
const comparison = computed<ComparisonResult>(() => compareWithActual(scene.value, summaries.value));
const selectedSummary = computed(() => summaries.value.find((item) => item.quadratId === selectedQuadratId.value) ?? null);
const selectedQuadratIdSet = computed(() => new Set(selectedQuadratIds.value));
const guideAnchorQuadrat = computed(() => quadrats.value.find((item) => item.id === guideAnchorQuadratId.value) ?? null);
const actualCountMap = computed(() => actualCounts(scene.value));
const specimenKinds = computed<PlantKind[]>(() => sceneKind.value === "grassland" ? ["artemisia", "foxtail", "groundcover"] : ["dandelion", "iris", "foxtail"]);
const canAverage = computed(() => summaries.value.length > 0);
const isStandardGrassland = computed(() => sceneKind.value === "grassland" && guideVisible.value && quadrats.value.length === 5);
const quadratSizeLabel = computed(() => `${quadratSize.value}m × ${quadratSize.value}m`);
const currentDensityText = computed(() => averageReady.value ? `${comparison.value.estimatedDensity.toFixed(2)} 株/m²` : "待计算");
const formulaText = computed(() => {
  if (!summaries.value.length) return "选择样方后生成计算公式";
  const values = summaries.value.map((item) => item.density.toFixed(1)).join(" + ");
  return `(${values}) ÷ ${summaries.value.length} =`;
});
const activeStep = computed(() => averageReady.value ? 4 : quadrats.value.length ? 3 : 2);
const stepLabel = computed(() => {
  if (averageReady.value) return "第 4 步 · 对比结果";
  if (quadrats.value.length) return "第 3 步 · 继续取样";
  return "第 2 步 · 选择样方";
});

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}

function nextSceneSeed(): number {
  sceneSeed = Math.max(Date.now(), sceneSeed + 1);
  return sceneSeed;
}

function resetSession(kind: SceneKind = sceneKind.value, nextSeed = nextSceneSeed()): void {
  sceneSeed = nextSeed;
  sceneKind.value = kind;
  scene.value = generateScene(kind, nextSeed);
  quadrats.value = [];
  selectedQuadratId.value = null;
  selectedQuadratIds.value = [];
  guideVisible.value = false;
  guideAnchorQuadratId.value = null;
  averageReady.value = false;
  revealed.value = false;
  spacing.value = null;
  history.value = [];
  activeMode.value = kind === "grassland" ? "free" : "equidistant";
  activeCanvasTool.value = "select";
  quadratSize.value = DEFAULT_QUADRAT_SIZE;
}

function chooseScene(kind: SceneKind): void {
  resetSession(kind);
  ElMessage({ message: `已切换到${sceneMeta[kind].label}场景`, type: "success" });
}

function startSampling(): void {
  activeMode.value = sceneKind.value === "grassland" ? "free" : "equidistant";
  activeCanvasTool.value = "select";
  if (sceneKind.value === "grassland") sceneCanvasRef.value?.focusSamplingZoom();
  ElMessage({ message: sceneKind.value === "grassland" ? `已放大到 250%，请拖动框选真实 ${quadratSizeLabel.value} 中心样方` : "请在绿化带中拖动框选第一个 1m × 1m 样方", type: "success" });
}

function setCanvasTool(tool: CanvasTool): void {
  activeCanvasTool.value = tool;
}

function setQuadratSize(size: QuadratSize): void {
  if (sceneKind.value !== "grassland" || quadrats.value.length) return;
  quadratSize.value = size;
  activeCanvasTool.value = "select";
}

function zoomIn(): void {
  sceneCanvasRef.value?.zoomIn();
}

function zoomOut(): void {
  sceneCanvasRef.value?.zoomOut();
}

function handleGuideTool(): void {
  if (sceneKind.value === "greenbelt") fillGreenbelt();
  else toggleGuide();
}

function createQuadrat(point: Point, source?: Quadrat): Quadrat {
  const raw = source ?? normalizeQuadrat(point, scene.value, quadratSize.value);
  return {
    ...raw,
    id: `quadrat-${Date.now()}-${quadrats.value.length + 1}`,
    index: quadrats.value.length + 1,
    size: raw.size,
  };
}

function setError(message: string): void {
  ElMessage({ message, type: "warning" });
}

function pushHistory(): void {
  history.value.push(quadrats.value.map((item) => ({ ...item })));
  if (history.value.length > 12) history.value.shift();
}

function handleCanvasClick(point: Point): void {
  const outsideScene = point.x < 0
    || point.x > scene.value.widthMeters
    || point.y < 0
    || point.y > scene.value.heightMeters;
  if (scene.value.kind === "grassland" && outsideScene) {
    setError("请在草地样地范围内选择样方");
    return;
  }
  if (scene.value.kind === "greenbelt" && outsideScene) {
    setError("请选择绿化带内部，不要点击乔木带或道路");
    return;
  }

  const first = quadrats.value[0];
  let candidate: Quadrat;
  if (scene.value.kind === "grassland" && guideVisible.value && guideAnchorQuadrat.value) {
    candidate = nearestGuideQuadrat(point, guideAnchorQuadrat.value, scene.value) ?? normalizeQuadrat(point, scene.value, quadratSize.value);
  } else if (scene.value.kind === "greenbelt" && first && spacing.value) {
    const snapped = snappedEquidistantQuadrat(point, first, spacing.value, scene.value);
    if (!snapped) {
      setError("按当前间距继续布置会越过绿化带边界，请选择下一个等距位置");
      return;
    }
    candidate = snapped;
  } else {
    candidate = normalizeQuadrat(point, scene.value, quadratSize.value);
  }

  if (scene.value.kind === "greenbelt" && first && !spacing.value) {
    const firstCenter = first.x + first.size / 2;
    const requestedSpacing = Math.abs(candidate.x + candidate.size / 2 - firstCenter);
    if (requestedSpacing < 1.5) {
      setError("第二个样方需要与第一个样方保持至少 1.5m 的间距");
      return;
    }
    spacing.value = clamp(requestedSpacing, 1.5, scene.value.widthMeters - 1);
    const snapped = snappedEquidistantQuadrat(point, first, spacing.value, scene.value);
    if (!snapped) {
      setError("第二个样方无法在合法范围内形成等距位置，请重新选择");
      spacing.value = null;
      return;
    }
    candidate = snapped;
  }

  if (hasOverlap(candidate, quadrats.value)) {
    setError("样方与已有样方重叠，请选择其他位置");
    return;
  }
  pushHistory();
  const next = createQuadrat(point, candidate);
  quadrats.value.push(next);
  selectedQuadratId.value = next.id;
  selectedQuadratIds.value = [next.id];
  averageReady.value = false;
  revealed.value = false;
}

function selectQuadrat(id: string): void {
  selectedQuadratId.value = id;
  selectedQuadratIds.value = [id];
}

function selectAllQuadrats(): void {
  if (!quadrats.value.length) return;
  const ids = quadrats.value.map((quadrat) => quadrat.id);
  selectedQuadratIds.value = ids;
  if (!selectedQuadratId.value || !ids.includes(selectedQuadratId.value)) selectedQuadratId.value = ids[0] ?? null;
  activeCanvasTool.value = "cursor";
}

function clearQuadratSelection(): void {
  selectedQuadratId.value = null;
  selectedQuadratIds.value = [];
  activeCanvasTool.value = "cursor";
}

function handleTableRowClick(row: SamplingSummary): void {
  selectQuadrat(row.quadratId);
}

function toggleGuide(): void {
  if (sceneKind.value !== "grassland") {
    setError("X 型五点辅助线只适用于草地场景");
    return;
  }
  if (!quadrats.value.length) {
    setError("请先选择一个中心样方，再显示 X 型辅助线");
    return;
  }
  if (guideVisible.value) {
    guideVisible.value = false;
    guideAnchorQuadratId.value = null;
    activeMode.value = "free";
    return;
  }
  const anchor = quadrats.value.find((item) => item.id === selectedQuadratId.value) ?? quadrats.value[0];
  if (!anchor || fivePointQuadrats(anchor, scene.value).length !== 5) {
    setError("当前中心样方距离边界过近，无法完整布置 X 型五点样方，请重新选择靠内的位置");
    return;
  }
  guideAnchorQuadratId.value = anchor.id;
  guideVisible.value = true;
  activeMode.value = "fivePoint";
}

function fillGreenbelt(): void {
  if (sceneKind.value !== "greenbelt") return;
  const first = quadrats.value[0];
  if (!first || !spacing.value) {
    setError("请先选择两个样方，让程序确定等距间隔");
    return;
  }
  pushHistory();
  const firstCenter = first.x + first.size / 2;
  const added: Quadrat[] = [];
  for (let step = -20; step <= 20; step += 1) {
    const center = firstCenter + step * spacing.value;
    if (center < first.size / 2 || center > scene.value.widthMeters - first.size / 2) continue;
    const candidate: Quadrat = { id: `fill-${step}`, index: 0, x: center - first.size / 2, y: first.y, size: first.size };
    if (!hasOverlap(candidate, quadrats.value) && !hasOverlap(candidate, added)) added.push(candidate);
  }
  quadrats.value = [...quadrats.value, ...added].sort((a, b) => a.x - b.x).map((item, index) => ({ ...item, index: index + 1 }));
  averageReady.value = false;
  revealed.value = false;
  ElMessage({ message: `已按 ${spacing.value.toFixed(1)}m 间距铺满绿化带`, type: "success" });
}

function calculateAverage(): void {
  if (!canAverage.value) {
    setError("请先选取至少一个样方");
    return;
  }
  averageReady.value = true;
  ElMessage({ message: "已完成平均种群密度估算", type: "success" });
}

function revealActual(): void {
  if (!averageReady.value) {
    setError("请先完成平均种群密度计算");
    return;
  }
  revealed.value = true;
}

function undo(): void {
  const previous = history.value.pop();
  if (!previous) {
    setError("没有可以撤销的操作");
    return;
  }
  quadrats.value = previous.map((item) => ({ ...item }));
  if (guideVisible.value && !guideAnchorQuadrat.value) {
    guideVisible.value = false;
    guideAnchorQuadratId.value = null;
    activeMode.value = "free";
  }
  selectedQuadratId.value = quadrats.value[quadrats.value.length - 1]?.id ?? null;
  selectedQuadratIds.value = selectedQuadratId.value ? [selectedQuadratId.value] : [];
  averageReady.value = false;
  revealed.value = false;
}

function clearQuadrats(): void {
  if (!quadrats.value.length) return;
  pushHistory();
  quadrats.value = [];
  selectedQuadratId.value = null;
  selectedQuadratIds.value = [];
  guideVisible.value = false;
  guideAnchorQuadratId.value = null;
  spacing.value = null;
  averageReady.value = false;
  revealed.value = false;
}

function regenerate(): void {
  sceneCanvasRef.value?.resetZoom();
  resetSession(sceneKind.value);
  ElMessage({ message: `已重置并生成新的${sceneMeta[sceneKind.value].label}植物分布`, type: "success" });
}

</script>

<template>
  <el-config-provider size="default">
    <div class="app-shell">
      <header class="topbar" :style="{ backgroundImage: `url(${headerTexture})` }">
        <div class="brand-lockup">
          <AppLogo />
          <div><h1>样方实验</h1><p>调查植物种群密度</p></div>
        </div>

        <nav class="progress-nav" aria-label="实验步骤">
          <div v-for="(step, index) in [{ label: '场景', icon: Location }, { label: '识别', icon: Connection }, { label: '取样', icon: Grid }, { label: '估算', icon: Histogram }]" :key="step.label" class="progress-step" :class="{ active: activeStep === index + 1, complete: activeStep > index + 1 }">
            <el-icon><component :is="step.icon" /></el-icon><span>{{ step.label }}</span><b>{{ index + 1 }}</b><ArrowRight v-if="index < 3" class="progress-arrow" />
          </div>
        </nav>

        <el-button class="header-action" type="warning" :icon="Aim" @click="startSampling">进入取样模式</el-button>
      </header>

      <main class="workspace">
        <aside class="specimen-rail" aria-label="实验设置与植物图例">
          <h2 class="panel-title">场景选择</h2>

          <section class="scene-switcher" aria-label="实验场景">
            <button class="scene-tab" :class="{ active: sceneKind === 'grassland' }" type="button" @click="chooseScene('grassland')"><span>草地</span><small>{{ sceneMeta.grassland.dimensions }}</small></button>
            <button class="scene-tab" :class="{ active: sceneKind === 'greenbelt' }" type="button" @click="chooseScene('greenbelt')"><span>绿化带</span><small>{{ sceneMeta.greenbelt.dimensions }}</small></button>
          </section>

          <section class="specimen-section">
            <div class="section-label-row"><span>植物标本</span></div>
            <div class="specimen-list">
              <article v-for="kind in specimenKinds" :key="kind" class="specimen-card" :class="{ target: kind === meta.targetPlant }">
                <PlantSpecimen :kind="kind" compact />
                <div class="specimen-copy"><div class="specimen-card-header"><strong>{{ plantMeta[kind].label }}</strong><el-tag v-if="kind === meta.targetPlant" size="small" type="warning" effect="plain">目标</el-tag></div><p>{{ plantMeta[kind].typeLabel }}</p></div>
              </article>
            </div>
          </section>
        </aside>

        <SamplingToolbar
          :active-tool="activeCanvasTool"
          :guide-visible="guideVisible"
          :guide-label="sceneKind === 'grassland' ? '辅助线' : '等距铺满'"
          :can-guide="sceneKind === 'grassland' ? quadrats.length > 0 : quadrats.length >= 2"
          :can-undo="history.length > 0"
          :can-clear="quadrats.length > 0"
          :can-select-all="quadrats.length > 0 && selectedQuadratIds.length < quadrats.length"
          :can-clear-selection="selectedQuadratIds.length > 0"
          :show-viewport-tools="sceneKind === 'grassland'"
          :quadrat-size="quadratSize"
          :show-quadrat-size-menu="sceneKind === 'grassland'"
          :can-change-quadrat-size="quadrats.length === 0"
          @tool-change="setCanvasTool"
          @quadrat-size-change="setQuadratSize"
          @toggle-guide="handleGuideTool"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-scene="regenerate"
          @undo="undo"
          @clear="clearQuadrats"
          @select-all="selectAllQuadrats"
          @clear-selection="clearQuadratSelection"
        />

        <section class="map-panel" aria-label="交互画布">
          <SceneCanvas ref="sceneCanvasRef" :scene="scene" :quadrats="quadrats" :selected-quadrat-id="selectedQuadratId" :selected-quadrat-ids="selectedQuadratIds" :guide-visible="guideVisible" :guide-anchor-quadrat-id="guideAnchorQuadratId" :active-tool="activeCanvasTool" :quadrat-size="quadratSize" @canvas-click="handleCanvasClick" @select-quadrat="selectQuadrat" />
        </section>

        <aside class="inspector-rail" aria-label="样方统计与估算">
          <div class="inspector-heading"><div><span class="eyebrow">{{ sceneKind === 'grassland' ? '当前样方' : '等距取样' }}</span><h2>统计与估算</h2></div><el-icon class="rail-icon"><Histogram /></el-icon></div>

          <div v-if="selectedSummary" class="selected-sample"><div class="sample-heading"><span>样方 {{ selectedSummary.index }}</span><el-tag size="small" type="warning" effect="light">{{ selectedQuadratIds.length > 1 ? `已选 ${selectedQuadratIds.length} 个` : '已选中' }}</el-tag></div><div class="sample-focus"><div><strong>{{ selectedSummary.targetCount }}</strong><span>{{ plantMeta[meta.targetPlant].label }}个体</span></div><div><strong>{{ selectedSummary.density.toFixed(1) }}</strong><span>株/m²</span></div></div><div class="sample-meta"><span>面积 <b>{{ selectedSummary.area }}m²</b></span><span>边界 <b>计上不计下，计左不计右</b></span></div></div>
          <div v-else class="inspector-empty"><el-icon><Operation /></el-icon><strong>{{ quadrats.length ? '当前未选择样方' : '还没有选择样方' }}</strong><span>{{ quadrats.length ? '点击画布中的样方查看统计。' : '在中央场景中点击位置开始取样。' }}</span></div>

          <section class="sample-list-section" :class="{ 'results-visible': revealed }"><div class="section-label-row"><span>样方记录</span><span class="section-note">{{ summaries.length }} / {{ sceneKind === 'grassland' ? 5 : '∞' }}</span></div><div v-if="summaries.length" class="sample-list"><button v-for="row in summaries" :key="row.quadratId" class="sample-row" :class="{ active: selectedQuadratIdSet.has(row.quadratId) }" :data-quadrat-id="row.quadratId" type="button" @click="handleTableRowClick(row)"><span class="sample-number">{{ row.index }}</span><span class="sample-label">样方 {{ row.index }}</span><strong>{{ row.targetCount }} 株</strong><b>{{ row.density.toFixed(1) }} 株/m²</b></button></div><div v-else class="sample-list-empty">完成取样后，样方数量与密度会显示在这里。</div></section>

          <section class="estimate-card" :class="{ ready: averageReady }">
            <div class="estimate-title"><span>平均种群密度</span><el-tag v-if="isStandardGrassland" size="small" type="success" effect="light">规范取样</el-tag></div>
            <div class="estimate-calculation"><span class="estimate-formula" :title="formulaText">{{ formulaText }}</span><strong>{{ currentDensityText }}</strong></div>
          </section>
          <div class="inspector-actions"><el-button class="wide-button" :disabled="!canAverage" :icon="CircleCheck" @click="calculateAverage">计算平均值</el-button><el-button class="wide-button reveal-button" type="warning" :disabled="!averageReady" :icon="View" @click="revealActual">揭晓真实结果</el-button></div>

          <div v-if="revealed" class="comparison-card">
            <div class="comparison-title"><span>真实结果</span><el-tag size="small" type="warning">误差 {{ comparison.errorPercent.toFixed(1) }}%</el-tag></div>
            <div class="comparison-density-grid">
              <div class="comparison-metric comparison-actual"><span>实际种群密度</span><strong>{{ comparison.actualDensity.toFixed(2) }} <small>株/m²</small></strong></div>
              <div class="comparison-metric comparison-estimate"><span>样方法估算</span><strong>{{ comparison.estimatedDensity.toFixed(2) }} <small>株/m²</small></strong></div>
            </div>
            <div class="actual-counts"><div v-for="kind in specimenKinds" :key="kind" :class="{ target: kind === meta.targetPlant }"><span>{{ plantMeta[kind].label }}</span><b>{{ formatNumber(actualCountMap[kind]) }} 株</b></div></div>
          </div>
        </aside>
      </main>
    </div>
  </el-config-provider>
</template>
