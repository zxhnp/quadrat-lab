<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Aim,
  ArrowRight,
  CircleCheck,
  Connection,
  Delete,
  Grid,
  Histogram,
  InfoFilled,
  Location,
  Operation,
  Plus,
  Refresh,
  View,
  WarningFilled,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import AppLogo from "./components/AppLogo.vue";
import SceneCanvas from "./components/SceneCanvas.vue";
import { allPlantKinds, plantMeta, sceneMeta } from "./data";
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
import type { ComparisonResult, Point, Quadrat, SamplingMode, SceneDefinition, SceneKind, SamplingSummary } from "./types";

const seed = ref(Date.now());
const sceneKind = ref<SceneKind>("grassland");
const scene = ref<SceneDefinition>(generateScene(sceneKind.value, seed.value));
const quadrats = ref<Quadrat[]>([]);
const selectedQuadratId = ref<string | null>(null);
const guideVisible = ref(false);
const counted = ref(false);
const averageReady = ref(false);
const revealed = ref(false);
const spacing = ref<number | null>(null);
const history = ref<Quadrat[][]>([]);
const activeMode = ref<SamplingMode>("free");
const errorMessage = ref("");

const meta = computed(() => sceneMeta[sceneKind.value]);
const selectedQuadrat = computed(() => quadrats.value.find((item) => item.id === selectedQuadratId.value) ?? null);
const summaries = computed<SamplingSummary[]>(() => summarizeQuadrats(scene.value, quadrats.value));
const comparison = computed<ComparisonResult>(() => compareWithActual(scene.value, summaries.value));
const selectedSummary = computed(() => summaries.value.find((item) => item.quadratId === selectedQuadratId.value) ?? null);
const actualCountMap = computed(() => actualCounts(scene.value));
const canCalculate = computed(() => quadrats.value.length > 0);
const canAverage = computed(() => counted.value && summaries.value.length > 0);
const isStandardGrassland = computed(() => sceneKind.value === "grassland" && guideVisible.value && quadrats.value.length === 5);
const currentDensityText = computed(() => averageReady.value ? `${comparison.value.estimatedDensity.toFixed(2)} 株/m²` : "待计算");
const formulaText = computed(() => {
  if (!summaries.value.length) return "选择样方后生成计算公式";
  const values = summaries.value.map((item) => item.density.toFixed(2)).join(" + ");
  return `(${values}) ÷ ${summaries.value.length} = ${comparison.value.estimatedDensity.toFixed(2)} 株/m²`;
});
const stepLabel = computed(() => {
  if (averageReady.value) return "第 5 步 · 对比结果";
  if (counted.value) return "第 4 步 · 计算密度";
  if (quadrats.value.length) return "第 3 步 · 继续取样";
  return "第 2 步 · 选择样方";
});

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}

function resetSession(kind: SceneKind = sceneKind.value, nextSeed = Date.now()): void {
  sceneKind.value = kind;
  seed.value = nextSeed;
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
  errorMessage.value = "";
}

function chooseScene(kind: SceneKind): void {
  resetSession(kind);
  ElMessage({ message: `已切换到${sceneMeta[kind].label}场景`, type: "success" });
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
    setError("请在草原范围内选择样方");
    return;
  }
  if (scene.value.kind === "greenbelt" && (point.x < 0 || point.x > 20 || point.y < 0 || point.y > 2)) {
    setError("请在绿化带范围内选择样方，不要点击道路或树木区域");
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
      setError("第二个样方无法在绿化带范围内形成合法间距，请选择其他位置");
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
    const candidate: Quadrat = {
      id: `fill-${step}`,
      index: 0,
      x: center - 0.5,
      y: first.y,
      size: QUADRAT_SIZE,
    };
    if (!hasOverlap(candidate, quadrats.value) && !hasOverlap(candidate, added)) added.push(candidate);
  }
  const merged = [...quadrats.value, ...added].sort((a, b) => a.x - b.x).map((item, index) => ({ ...item, index: index + 1 }));
  quadrats.value = merged;
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
    setError("请先点击“计算种群密度”");
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
      <header class="topbar">
        <div class="brand-lockup">
          <AppLogo />
          <div>
            <h1>样方实验</h1>
            <p>调查植物种群密度</p>
          </div>
        </div>
        <div class="topbar-meta">
          <el-tag class="step-tag" effect="light" round>{{ stepLabel }}</el-tag>
          <el-tag effect="plain" round>课堂演示模式</el-tag>
          <span class="brand-note">自然科普仪表盘</span>
        </div>
      </header>

      <main class="workspace">
        <aside class="left-rail">
          <div class="section-heading">
            <div>
              <span class="eyebrow">实验场景</span>
              <h2>选择一块样地</h2>
            </div>
            <el-icon class="section-icon"><Location /></el-icon>
          </div>
          <p class="section-hint">切换场景会重新生成对应的植物分布。</p>

          <div class="scene-options">
            <button class="scene-option" :class="{ active: sceneKind === 'grassland' }" type="button" @click="chooseScene('grassland')">
              <span class="scene-option-title">草原</span>
              <span class="scene-option-subtitle">50m × 50m · 2500m²</span>
              <span class="scene-option-detail">天然草地 · 斑块式分布</span>
            </button>
            <button class="scene-option" :class="{ active: sceneKind === 'greenbelt' }" type="button" @click="chooseScene('greenbelt')">
              <span class="scene-option-title">绿化带</span>
              <span class="scene-option-subtitle">20m × 2m · 40m²</span>
              <span class="scene-option-detail">道路绿化 · 横向等距分布</span>
            </button>
          </div>

          <section class="target-card">
            <span class="target-card-label">目标植物</span>
            <strong>{{ plantMeta[meta.targetPlant].label }}</strong>
            <span>{{ plantMeta[meta.targetPlant].typeLabel }}</span>
          </section>

          <section class="tool-section">
            <div class="section-label-row"><span>操作工具</span><el-tag size="small" effect="plain">{{ quadrats.length }} 个样方</el-tag></div>
            <div class="tool-stack">
              <el-button type="primary" class="tool-button" :icon="Plus" @click="activeMode = sceneKind === 'grassland' ? 'free' : 'equidistant'">选取样方</el-button>
              <el-button class="tool-button" :type="guideVisible ? 'success' : 'default'" :icon="Connection" @click="toggleGuide">{{ guideVisible ? '关闭 X 型辅助线' : '显示 X 型辅助线' }}</el-button>
              <el-button v-if="sceneKind === 'greenbelt'" class="tool-button" :disabled="quadrats.length < 2" :icon="Grid" @click="fillGreenbelt">标准铺满绿化带</el-button>
              <div class="tool-row">
                <el-button class="mini-tool" :icon="Refresh" :disabled="!history.length" @click="undo">撤销</el-button>
                <el-button class="mini-tool" :icon="Delete" :disabled="!quadrats.length" @click="clearQuadrats">清空</el-button>
              </div>
              <el-button class="tool-button" :icon="Refresh" @click="regenerate">重新生成植物</el-button>
            </div>
          </section>

          <section class="legend-section">
            <div class="section-label-row"><span>植物图例</span><el-icon><InfoFilled /></el-icon></div>
            <div class="legend-list">
              <div v-for="kind in (sceneKind === 'grassland' ? (['artemisia', 'foxtail', 'groundcover'] as const) : (['dandelion', 'iris', 'foxtail'] as const))" :key="kind" class="legend-item">
                <span class="legend-dot" :style="{ backgroundColor: plantMeta[kind].color }" />
                <span>{{ plantMeta[kind].label }}</span>
                <el-tag v-if="kind === meta.targetPlant" size="small" type="warning" effect="plain">目标</el-tag>
              </div>
            </div>
          </section>
        </aside>

        <section class="canvas-panel">
          <div class="canvas-header">
            <div>
              <div class="canvas-title-row"><h2>{{ meta.label }}</h2><el-tag type="success" effect="light" round>{{ meta.samplingLabel }}</el-tag></div>
              <p>{{ meta.intro }}</p>
            </div>
            <div class="canvas-status"><span class="status-dot" />种群分布已生成</div>
          </div>
          <SceneCanvas :scene="scene" :quadrats="quadrats" :selected-quadrat-id="selectedQuadratId" :guide-visible="guideVisible" :counted="counted" @canvas-click="handleCanvasClick" @select-quadrat="selectQuadrat" />
          <el-alert v-if="errorMessage" class="canvas-alert" :title="errorMessage" type="warning" :closable="false" show-icon>
            <template #icon><el-icon><WarningFilled /></el-icon></template>
          </el-alert>
          <div v-else class="canvas-instruction"><el-icon><Aim /></el-icon><span>{{ sceneKind === 'grassland' ? '先点击草原中的任意位置选择中心样方，再开启 X 型辅助线。' : '先选两个样方确定间距，后续点击会自动保持水平等距。' }}</span></div>
        </section>

        <aside class="right-rail">
          <div class="result-heading">
            <div><span class="eyebrow">取样结果</span><h2>统计与估算</h2></div>
            <el-icon class="section-icon"><Histogram /></el-icon>
          </div>
          <p class="section-hint">点击样方查看统计，至少选择 1 个样方。</p>

          <div class="metric-strip">
            <div><span>当前已选</span><strong>{{ quadrats.length }}<small>个</small></strong></div>
            <div><span>样方面积</span><strong>{{ quadrats.length ? '1' : '—' }}<small>m²</small></strong></div>
          </div>

          <div class="result-block">
            <div class="result-block-title"><span>样方明细</span><el-tag size="small" effect="plain">{{ meta.targetPlant === 'artemisia' ? '茵陈蒿' : '蒲公英' }}</el-tag></div>
            <el-table v-if="summaries.length" :data="summaries" class="quadrat-table" size="small" :show-header="true" @row-click="handleTableRowClick">
              <el-table-column prop="index" label="#" width="34" />
              <el-table-column label="数量" min-width="64"><template #default="scope">{{ scope.row.targetCount }} 株</template></el-table-column>
              <el-table-column label="密度" min-width="82"><template #default="scope"><span class="density-value">{{ scope.row.density.toFixed(2) }}</span> 株/m²</template></el-table-column>
            </el-table>
            <div v-else class="empty-result"><el-icon><Operation /></el-icon><span>还没有选择样方</span></div>
          </div>

          <div class="average-card" :class="{ ready: averageReady }">
            <div class="average-card-top"><span>平均种群密度</span><el-tag v-if="isStandardGrassland" size="small" type="success" effect="light">规范取样</el-tag></div>
            <strong>{{ currentDensityText }}</strong>
            <p>{{ counted ? formulaText : '完成样方统计后生成计算过程' }}</p>
          </div>

          <div class="result-actions">
            <el-button type="primary" class="wide-button" :disabled="!canCalculate" :icon="Histogram" @click="calculateDensity">计算种群密度</el-button>
            <el-button class="wide-button" :disabled="!canAverage" :icon="CircleCheck" @click="calculateAverage">计算平均值</el-button>
            <el-button class="wide-button outline-button" :disabled="!averageReady" :icon="View" @click="revealActual">揭晓真实结果</el-button>
          </div>

          <el-card v-if="revealed" class="comparison-card" shadow="never">
            <template #header><div class="comparison-title"><span>真实值对比</span><el-tag size="small" type="warning">误差 {{ comparison.errorPercent.toFixed(1) }}%</el-tag></div></template>
            <div class="comparison-main"><span>实际密度</span><strong>{{ comparison.actualDensity.toFixed(2) }} 株/m²</strong></div>
            <div class="comparison-main"><span>样方法估算</span><strong>{{ comparison.estimatedDensity.toFixed(2) }} 株/m²</strong></div>
            <div class="actual-counts">
              <div v-for="kind in (sceneKind === 'grassland' ? (['artemisia', 'foxtail', 'groundcover'] as const) : (['dandelion', 'iris', 'foxtail'] as const))" :key="kind"><span>{{ plantMeta[kind].label }}</span><b>{{ formatNumber(actualCountMap[kind]) }} 株</b></div>
            </div>
          </el-card>

          <div class="rule-note"><el-icon><InfoFilled /></el-icon><span>边界规则：计上不计下，计左不计右</span></div>
        </aside>
      </main>
    </div>
  </el-config-provider>
</template>
