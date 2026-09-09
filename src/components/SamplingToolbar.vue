<script setup lang="ts">
import {
  Back,
  Connection,
  Crop,
  Delete,
  Pointer,
  Rank,
  Refresh,
  ZoomIn,
  ZoomOut,
} from "@element-plus/icons-vue";
import type { CanvasTool } from "../types";

const props = defineProps<{
  activeTool: CanvasTool;
  guideVisible: boolean;
  guideLabel: string;
  canGuide: boolean;
  canUndo: boolean;
  canClear: boolean;
}>();

const emit = defineEmits<{
  toolChange: [tool: CanvasTool];
  toggleGuide: [];
  zoomIn: [];
  zoomOut: [];
  resetZoom: [];
  undo: [];
  clear: [];
}>();

const primaryTools: Array<{ id: CanvasTool; label: string; icon: typeof Pointer }> = [
  { id: "cursor", label: "光标", icon: Pointer },
  { id: "select", label: "框选", icon: Crop },
  { id: "pan", label: "拖动画布", icon: Rank },
];
</script>

<template>
  <aside class="sampling-toolbar" aria-label="取样工具栏">
    <button
      v-for="tool in primaryTools"
      :key="tool.id"
      class="toolbar-button"
      :class="{ active: props.activeTool === tool.id }"
      type="button"
      :aria-pressed="props.activeTool === tool.id"
      @click="emit('toolChange', tool.id)"
    >
      <el-icon><component :is="tool.icon" /></el-icon>
      <span>{{ tool.label }}</span>
    </button>

    <button
      class="toolbar-button"
      :class="{ active: props.guideVisible }"
      type="button"
      :disabled="!props.canGuide"
      :aria-pressed="props.guideVisible"
      @click="emit('toggleGuide')"
    >
      <el-icon><Connection /></el-icon>
      <span>{{ props.guideLabel }}</span>
    </button>

    <div class="toolbar-divider" />

    <button class="toolbar-button" type="button" @click="emit('zoomIn')">
      <el-icon><ZoomIn /></el-icon><span>放大</span>
    </button>
    <button class="toolbar-button" type="button" @click="emit('zoomOut')">
      <el-icon><ZoomOut /></el-icon><span>缩小</span>
    </button>
    <button class="toolbar-button" type="button" @click="emit('resetZoom')">
      <el-icon><Refresh /></el-icon><span>重置</span>
    </button>

    <div class="toolbar-divider" />

    <button class="toolbar-button" type="button" :disabled="!props.canUndo" @click="emit('undo')">
      <el-icon><Back /></el-icon><span>撤销</span>
    </button>
    <button class="toolbar-button" type="button" :disabled="!props.canClear" @click="emit('clear')">
      <el-icon><Delete /></el-icon><span>清空</span>
    </button>
  </aside>
</template>
