<script setup lang="ts">
import artemisiaImage from "../assets/plants/render/artemisia.webp";
import dandelionImage from "../assets/plants/render/dandelion.webp";
import foxtailImage from "../assets/plants/render/foxtail.webp";
import groundcoverImage from "../assets/plants/render/groundcover.webp";
import irisImage from "../assets/plants/render/iris.webp";
import { plantMeta } from "../data";
import type { PlantKind } from "../types";

const props = defineProps<{
  kind: PlantKind;
  compact?: boolean;
}>();

const plantImages: Record<PlantKind, string> = {
  artemisia: artemisiaImage,
  foxtail: foxtailImage,
  groundcover: groundcoverImage,
  dandelion: dandelionImage,
  iris: irisImage,
};
</script>

<template>
  <img class="plant-specimen" :class="{ compact: props.compact }" :src="plantImages[props.kind]" :alt="`${plantMeta[props.kind].label} 植物标本`" />
</template>

<style scoped>
.plant-specimen { display: block; width: 100%; height: 124px; object-fit: contain; object-position: center bottom; }
.compact { height: 96px; }
</style>
