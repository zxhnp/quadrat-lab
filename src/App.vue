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
  WarningFilled,
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
  QUADRAT_SIZE,
  clamp,
  fivePointQuadrats,
  hasOverlap,
  nearestGuideQuadrat,
  normalizeQuadrat,
  snappedEquidistantQuadrat,
} from "./domain/geometry";
import { generateScene } from "./domain/generator";
import type { CanvasTool, ComparisonResult, PlantKind, Point, Quadrat, SamplingMode, SceneDefinition, SceneKind, SamplingSummary } from "./types";

const sceneKind = ref<SceneKind>("grassland");
const scene = ref<SceneDefinition>(generateScene(sceneKind.value));
const quadrats = ref<Quadrat[]>([]);
const selectedQuadratId = ref<string | null>(null);
const guideVisible = ref(false);
const counted = ref(false);
const averageReady = ref(false);
const revealed = ref(false);
const spacing = ref<number | null>(null);
const history = ref<Quadrat[][]>([]);
const activeMode = ref<SamplingMode>("free");
const activeCanvasTool = ref<CanvasTool>("select");
const sceneCanvasRef = ref<InstanceType<typeof SceneCanvas> | null>(null);
const errorMessage = ref("");

const meta = computed(() => sceneMeta[sceneKind.value]);
const summaries = computed<SamplingSummary[]>(() => summarizeQuadrats(scene.value, quadrats.value));
const comparison = computed<ComparisonResult>(() => compareWithActual(scene.value, summaries.value));
const selectedSummary = computed(() => summaries.value.find((item) => item.quadratId === selectedQuadratId.value) ?? null);
const actualCountMap = computed(() => actualCounts(scene.value));
const specimenKinds = computed<PlantKind[]>(() => sceneKind.value === "grassland" ? ["artemisia", "foxtail", "groundcover"] : ["dandelion", "iris", "foxtail"]);
const canCalculate = computed(() => quadrats.value.length > 0);
const canAverage = computed(() => counted.value && summaries.value.length > 0);
const isStandardGrassland = computed(() => sceneKind.value === "grassland" && guideVisible.value && quadrats.value.length === 5);
const currentDensityText = computed(() => averageReady.value ? `${comparison.value.estimatedDensity.toFixed(2)} 株/m²` : "待计算");
const formulaText = computed(() => {
  if (!summaries.value.length) return "选择样方后生成计算公式";
  const values = summaries.value.map((item) => item.density.toFixed(2)).join(" + ");
  return `(${values}) ÷ ${summaries.value.length} = ${comparison.value.estimatedDensity.toFixed(2)} 株/m²`;
});
const activeStep = computed(() => averageReady.value ? 4 : counted.value ? 4 : quadrats.value.length ? 3 : 2);
const stepLabel = computed(() => {
  if (averageReady.value) return "第 4 步 · 对比结果";
  if (counted.value) return "第 4 步 · 计算密度";
  if (quadrats.value.length) return "第 3 步 · 继续取样";
  return "第 2 步 · 选择样方";
});

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}

function resetSession(kind: SceneKind = sceneKind.value, nextSeed = Date.now()): void {
  sceneKind.value = kind;
  scene.value = generateScene(kind, nextSeed);
  quadrats.value = [];
  selectedQuadratId.value = null;
  guideVisible.value = false;
  counted.value = false;
  averageReady.value = false;
  revealed.value = false;
  spacing.value = null;
  history.value = [];
  activeMode.value = kind === "grassland" ? "free" : "equidistant";
  activeCanvasTool.value = "select";
  errorMessage.value = "";
}

function chooseScene(kind: SceneKind): void {
  resetSession(kind);
  ElMessage({ message: `已切换到${sceneMeta[kind].label}场景`, type: "success" });
}

function startSampling(): void {
  activeMode.value = sceneKind.value === "grassland" ? "free" : "equidistant";
  activeCanvasTool.value = "select";
  errorMessage.value = "";
  ElMessage({ message: sceneKind.value === "grassland" ? "请在草原中拖动框选 1m × 1m 中心样方" : "请在绿化带中拖动框选第一个 1m × 1m 样方", type: "success" });
}

function setCanvasTool(tool: CanvasTool): void {
  activeCanvasTool.value = tool;
  errorMessage.value = "";
}

function zoomIn(): void {
  sceneCanvasRef.value?.zoomIn();
}

function zoomOut(): void {
  sceneCanvasRef.value?.zoomOut();
}

function resetZoom(): void {
  sceneCanvasRef.value?.resetZoom();
}

function handleGuideTool(): void {
  if (sceneKind.value === "greenbelt") fillGreenbelt();
  else toggleGuide();
}

function createQuadrat(point: Point, source?: Quadrat): Quadrat {
  const raw = source ?? normalizeQuadrat(point, scene.value);
  return {
    ...raw,
    id: `quadrat-${Date.now()}-${quadrats.value.length + 1}`,
    index: quadrats.value.length + 1,
    size: QUADRAT_SIZE,
  };
}

function setError(message: string): void {
  errorMessage.value = message;
  ElMessage({ message, type: "warning" });
}

function pushHistory(): void {
  history.value.push(quadrats.value.map((item) => ({ ...item })));
  if (history.value.length > 12) history.value.shift();
}

function handleCanvasClick(point: Point): void {
  errorMessage.value = "";
  if (scene.value.kind === "grassland" && (point.x < 0 || point.x > 50 || point.y < 0 || point.y > 50)) {
    setError("请在草原样地范围内选择样方");
    return;
  }
  if (scene.value.kind === "greenbelt" && (point.x < 0 || point.x > 20 || point.y < 0 || point.y > 2)) {
    setError("请选择绿化带内部，不要点击乔木带或道路");
    return;
  }

  const first = quadrats.value[0];
  let candidate: Quadrat;
  if (scene.value.kind === "grassland" && guideVisible.value && first) {
    candidate = nearestGuideQuadrat(point, first, scene.value) ?? normalizeQuadrat(point, scene.value);
  } else if (scene.value.kind === "greenbelt" && first && spacing.value) {
    const snapped = snappedEquidistantQuadrat(point, first, spacing.value, scene.value);
    if (!snapped) {
      setError("按当前间距继续布置会越过绿化带边界，请选择下一个等距位置");
      return;
    }
    candidate = snapped;
  } else {
    candidate = normalizeQuadrat(point, scene.value);
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
  counted.value = false;
  averageReady.value = false;
  revealed.value = false;
}

function selectQuadrat(id: string): void {
  selectedQuadratId.value = id;
}

function handleTableRowClick(row: SamplingSummary): void {
  selectQuadrat(row.quadratId);
}

function toggleGuide(): void {
  if (sceneKind.value !== "grassland") {
    setError("X 型五点辅助线只适用于草原场景");
    return;
  }
  if (!quadrats.value.length) {
    setError("请先选择一个中心样方，再显示 X 型辅助线");
    return;
  }
  guideVisible.value = !guideVisible.value;
  activeMode.value = guideVisible.value ? "fivePoint" : "free";
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
    if (center < 0.5 || center > scene.value.widthMeters - 0.5) continue;
    const candidate: Quadrat = { id: `fill-${step}`, index: 0, x: center - 0.5, y: first.y, size: QUADRAT_SIZE };
    if (!hasOverlap(candidate, quadrats.value) && !hasOverlap(candidate, added)) added.push(candidate);
  }
  quadrats.value = [...quadrats.value, ...added].sort((a, b) => a.x - b.x).map((item, index) => ({ ...item, index: index + 1 }));
  counted.value = false;
  averageReady.value = false;
  revealed.value = false;
  ElMessage({ message: `已按 ${spacing.value.toFixed(1)}m 间距铺满绿化带`, type: "success" });
}

function calculateDensity(): void {
  if (!canCalculate.value) {
    setError("至少选择一个样方后才能计算种群密度");
    return;
  }
  counted.value = true;
  averageReady.value = false;
  revealed.value = false;
  ElMessage({ message: "已高亮目标植物并完成样方统计", type: "success" });
}

function calculateAverage(): void {
  if (!canAverage.value) {
    setError("请先点击“标记并计数”完成样方统计");
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
  selectedQuadratId.value = quadrats.value[quadrats.value.length - 1]?.id ?? null;
  counted.value = false;
  averageReady.value = false;
  revealed.value = false;
}

function clearQuadrats(): void {
  if (!quadrats.value.length) return;
  pushHistory();
  quadrats.value = [];
  selectedQuadratId.value = null;
  guideVisible.value = false;
  spacing.value = null;
  counted.value = false;
  averageReady.value = false;
  revealed.value = false;
}

function regenerate(): void {
  resetSession(sceneKind.value, Date.now());
  ElMessage({ message: "已生成新的植物分布", type: "success" });
}

function showFivePointReference(): Quadrat[] {
  const first = quadrats.value[0];
  return first ? fivePointQuadrats(first, scene.value) : [];
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
            <button class="scene-tab" :class="{ active: sceneKind === 'grassland' }" type="button" @click="chooseScene('grassland')"><PlantSpecimen kind="groundcover" compact /><span>草原</span><small>50m × 50m</small></button>
            <button class="scene-tab" :class="{ active: sceneKind === 'greenbelt' }" type="button" @click="chooseScene('greenbelt')"><PlantSpecimen kind="iris" compact /><span>绿化带</span><small>20m × 2m</small></button>
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
          @tool-change="setCanvasTool"
          @toggle-guide="handleGuideTool"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-zoom="resetZoom"
          @undo="undo"
          @clear="clearQuadrats"
        />

        <section class="map-panel" aria-label="交互画布">
          <SceneCanvas ref="sceneCanvasRef" :scene="scene" :quadrats="quadrats" :selected-quadrat-id="selectedQuadratId" :guide-visible="guideVisible" :counted="counted" :active-tool="activeCanvasTool" @canvas-click="handleCanvasClick" @select-quadrat="selectQuadrat" />
          <el-alert v-if="errorMessage" class="canvas-alert" :title="errorMessage" type="warning" :closable="false" show-icon><template #icon><el-icon><WarningFilled /></el-icon></template></el-alert>
        </section>

        <aside class="inspector-rail" aria-label="样方统计与估算">
          <div class="inspector-heading"><div><span class="eyebrow">{{ sceneKind === 'grassland' ? '当前样方' : '等距取样' }}</span><h2>统计与估算</h2></div><el-icon class="rail-icon"><Histogram /></el-icon></div>

          <div v-if="selectedSummary" class="selected-sample"><div class="sample-heading"><span>样方 {{ selectedSummary.index }}</span><el-tag size="small" type="warning" effect="light">已选中</el-tag></div><div class="sample-focus"><div><strong>{{ selectedSummary.targetCount }}</strong><span>{{ plantMeta[meta.targetPlant].label }}个体</span></div><div><strong>{{ selectedSummary.density.toFixed(1) }}</strong><span>株/m²</span></div></div><div class="sample-meta"><span>样方面积</span><b>{{ selectedSummary.area }}m²</b><span>边界规则</span><b>计上不计下，计左不计右</b></div></div>
          <div v-else class="inspector-empty"><el-icon><Operation /></el-icon><strong>还没有选择样方</strong><span>在中央场景中点击位置开始取样。</span></div>
          <el-button class="inspector-primary" type="warning" :icon="Aim" :disabled="!selectedSummary" @click="calculateDensity">标记并计数</el-button>

          <section class="sample-list-section"><div class="section-label-row"><span>样方记录</span><span class="section-note">{{ summaries.length }} / {{ sceneKind === 'grassland' ? 5 : '∞' }}</span></div><div v-if="summaries.length" class="sample-list"><button v-for="row in summaries" :key="row.quadratId" class="sample-row" :class="{ active: row.quadratId === selectedQuadratId }" type="button" @click="handleTableRowClick(row)"><span class="sample-number">{{ row.index }}</span><span class="sample-label">样方 {{ row.index }}</span><strong>{{ row.targetCount }} 株</strong><b>{{ row.density.toFixed(1) }}</b></button></div><div v-else class="sample-list-empty">完成取样后，样方数量与密度会显示在这里。</div></section>

          <section class="estimate-card" :class="{ ready: averageReady }"><div class="estimate-title"><span>平均种群密度</span><el-tag v-if="isStandardGrassland" size="small" type="success" effect="light">规范取样</el-tag></div><strong>{{ currentDensityText }}</strong><p>{{ counted ? formulaText : '完成样方统计后生成计算过程' }}</p></section>
          <div class="inspector-actions"><el-button class="wide-button" :disabled="!canAverage" :icon="CircleCheck" @click="calculateAverage">计算平均值</el-button><el-button class="wide-button outline-button" :disabled="!averageReady" :icon="View" @click="revealActual">揭晓真实结果</el-button></div>

          <div v-if="revealed" class="comparison-card"><div class="comparison-title"><span>真实值对比</span><el-tag size="small" type="warning">误差 {{ comparison.errorPercent.toFixed(1) }}%</el-tag></div><div class="comparison-line"><span>实际密度</span><strong>{{ comparison.actualDensity.toFixed(2) }} 株/m²</strong></div><div class="comparison-line"><span>样方法估算</span><strong>{{ comparison.estimatedDensity.toFixed(2) }} 株/m²</strong></div><div class="actual-counts"><div v-for="kind in specimenKinds" :key="kind"><span>{{ plantMeta[kind].label }}</span><b>{{ formatNumber(actualCountMap[kind]) }} 株</b></div></div></div>
        </aside>
      </main>
    </div>
  </el-config-provider>
</template>
