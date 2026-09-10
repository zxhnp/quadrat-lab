<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowDownBold,
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
  canSelectAll: boolean;
  canClearSelection: boolean;
  showViewportTools: boolean;
}>();

const emit = defineEmits<{
  toolChange: [tool: CanvasTool];
  toggleGuide: [];
  zoomIn: [];
  zoomOut: [];
  resetScene: [];
  undo: [];
  clear: [];
  selectAll: [];
  clearSelection: [];
}>();

const allPrimaryTools: Array<{ id: CanvasTool; label: string; detail?: string; icon: typeof Pointer }> = [
  { id: "cursor", label: "光标", icon: Pointer },
  { id: "select", label: "选取样方", detail: "1m × 1m", icon: Crop },
  { id: "pan", label: "拖动画布", icon: Rank },
];

const primaryTools = computed(() => props.showViewportTools
  ? allPrimaryTools
  : allPrimaryTools.filter((tool) => tool.id !== "pan"));

function handleSelectionCommand(command: string): void {
  if (command === "select-all") emit("selectAll");
  if (command === "clear-selection") emit("clearSelection");
}
</script>

<template>
  <aside class="sampling-toolbar" aria-label="取样工具栏">
    <div
      v-for="tool in primaryTools"
      :key="tool.id"
      class="toolbar-item"
    >
      <button
        class="toolbar-button"
        :class="{ active: props.activeTool === tool.id }"
        type="button"
        :aria-pressed="props.activeTool === tool.id"
        @click="emit('toolChange', tool.id)"
      >
        <el-icon><component :is="tool.icon" /></el-icon>
        <span class="toolbar-copy">
          <span>{{ tool.label }}</span>
          <small v-if="tool.detail">{{ tool.detail }}</small>
        </span>
      </button>

      <el-dropdown
        v-if="tool.id === 'cursor'"
        class="toolbar-selection-menu"
        trigger="click"
        placement="right-start"
        popper-class="quadrat-selection-dropdown"
        @command="handleSelectionCommand"
      >
        <button class="toolbar-menu-trigger" type="button" aria-label="样方选择菜单">
          <el-icon><ArrowDownBold /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="select-all" :disabled="!props.canSelectAll">全选样方</el-dropdown-item>
            <el-dropdown-item command="clear-selection" :disabled="!props.canClearSelection">取消选择</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

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

    <template v-if="props.showViewportTools">
      <div class="toolbar-divider" />

      <button class="toolbar-button" type="button" @click="emit('zoomIn')">
        <el-icon><ZoomIn /></el-icon><span>放大</span>
      </button>
      <button class="toolbar-button" type="button" @click="emit('zoomOut')">
        <el-icon><ZoomOut /></el-icon><span>缩小</span>
      </button>
    </template>
    <button class="toolbar-button" type="button" @click="emit('resetScene')">
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
