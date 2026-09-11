import type { PlantKind, SceneKind } from "./types";

export const plantMeta: Record<PlantKind, { label: string; typeLabel: string; color: string; icon: string }> = {
  artemisia: { label: "茵陈蒿", typeLabel: "目标植物 · 双子叶", color: "#D79A3D", icon: "目标" },
  foxtail: { label: "狗尾巴草", typeLabel: "单子叶杂草", color: "#5B8B70", icon: "单子叶" },
  groundcover: { label: "小草", typeLabel: "其他杂草", color: "#89A99A", icon: "其他" },
  iris: { label: "鸢尾花", typeLabel: "绿化植物", color: "#6D73A8", icon: "绿化" },
  dandelion: { label: "蒲公英", typeLabel: "目标植物 · 双子叶", color: "#D79A3D", icon: "目标" },
};

export const sceneMeta: Record<SceneKind, {
  label: string;
  subtitle: string;
  dimensions: string;
  samplingLabel: string;
  targetPlant: PlantKind;
  intro: string;
}> = {
  grassland: {
    label: "草地",
    subtitle: "天然草地 · 斑块式分布",
    dimensions: "30m × 30m",
    samplingLabel: "五点取样法",
    targetPlant: "artemisia",
    intro: "在正方形样地中随机选择样方，用五点法观察取样代表性。",
  },
  greenbelt: {
    label: "绿化带",
    subtitle: "道路绿化 · 横向等距分布",
    dimensions: "10m × 2m",
    samplingLabel: "等距取样法",
    targetPlant: "dandelion",
    intro: "沿绿化带长度方向等距布置样方，观察样方数量对估算的影响。",
  },
};

export const allPlantKinds: PlantKind[] = ["artemisia", "foxtail", "groundcover", "iris", "dandelion"];
