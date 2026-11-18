<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { Palette, Scene, StageDocument } from "../../../shared/types";
import type { PaletteStore } from "../model/palette";
const props = defineProps<{
  scene: Scene;
  doc: StageDocument;
  palette: PaletteStore;
}>();
const editing = ref(false);
const draft = reactive<Palette>({
  background: "#000000",
  colors: ["#ffffff", "#ffffff", "#ffffff"],
});
const slots = ["主色", "辅色", "点缀"] as const;
const swatchStyle = (p: Palette) => ({
  background: `linear-gradient(130deg,${p.background},${p.colors[0]},${p.colors[1]})`,
});
const customStyle = () =>
  swatchStyle(
    editing.value
      ? collect()
      : (props.scene.custom ?? props.palette.target(props.scene)),
  );
const customLabel = () =>
  editing.value
    ? "退出试色"
    : props.scene.theme === "custom"
      ? "自定义配色"
      : props.scene.custom
        ? "回到自定义"
        : "改为自定义";
function collect(): Palette {
  return {
    background: draft.background,
    colors: [...draft.colors] as [string, string, string],
  };
}
function begin() {
  // Start from what this scene is currently showing, including a pending
  // audition, so tweaking one slot does not discard the other trial colours.
  const current = props.palette.target(props.scene);
  draft.background = current.background;
  draft.colors = [...current.colors] as [string, string, string];
  editing.value = true;
}
function cancel() {
  editing.value = false;
  // Discard the audition only; the scene keeps running and the palette
  // morphs back to its saved target.
  props.palette.cancel();
}
function save() {
  props.palette.save(props.scene, collect());
  editing.value = false;
}
function chooseCustom() {
  if (editing.value) {
    cancel();
  } else if (props.scene.custom && props.scene.theme !== "custom") {
    // A scene keeps its custom palette even after trying a preset; this
    // brings it back for this scene alone.
    props.palette.cancel();
    props.scene.theme = "custom";
  } else {
    begin();
  }
}
function choosePreset(id: string) {
  // Choosing a preset commits it to this scene only. A pending audition is
  // dropped so a third choice morphs from what is on stage right now.
  editing.value = false;
  props.palette.cancel();
  props.scene.theme = id;
}
watch(
  () => [draft.background, ...draft.colors],
  () => {
    if (editing.value) props.palette.audition(props.scene.id, collect());
  },
);
watch(
  () => props.scene.id,
  () => {
    editing.value = false;
    props.palette.cancel();
  },
);
</script>
<template>
  <section class="panel themes">
    <div class="panel-heading">
      <span>03 / VISUAL PALETTE</span
      ><span>{{ editing ? "AUDITIONING" : "4 THEMES + CUSTOM" }}</span>
    </div>
    <div class="theme-options">
      <button
        v-for="t in palette.presets"
        :key="t.id"
        :class="{ selected: !editing && scene.theme === t.id }"
        @click="choosePreset(t.id)"
      >
        <span class="swatch" :style="swatchStyle(t)"
          ><span v-if="!editing && scene.theme === t.id">✓</span></span
        >{{ t.name }}
      </button>
      <button
        class="custom-theme"
        :class="{ selected: editing || scene.theme === 'custom' }"
        @click="chooseCustom"
      >
        <span class="swatch" :style="customStyle()"
          ><span v-if="scene.theme === 'custom' && !editing">✓</span></span
        >{{ customLabel() }}
      </button>
    </div>
    <div v-if="editing" class="palette-editor">
      <label class="palette-input background-input"
        ><input type="color" v-model="draft.background" /><span>背景</span></label
      >
      <label v-for="(label, i) in slots" :key="label" class="palette-input"
        ><input type="color" v-model="draft.colors[i]" /><span>{{ label }}</span></label
      >
      <div class="palette-actions">
        <button class="save-palette" @click="save">保存到当前场景</button
        ><button class="cancel-palette" @click="cancel">取消试色</button>
      </div>
      <small class="palette-hint"
        >试色仅预览当前场景 · 保存后只写入本场景，不改动预设或其他场景</small
      >
    </div>
    <div class="two-controls">
      <label class="control"
        >视觉强度 <b>{{ Math.round(scene.intensity * 100) }}%</b
        ><input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          v-model.number="scene.intensity" /></label
      ><label class="control"
        >运动速度 <b>{{ scene.speed.toFixed(1) }}×</b
        ><input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          v-model.number="scene.speed"
      /></label>
    </div>
    <label class="control palette-duration"
      >配色过渡 <b>{{ (doc.paletteTransition ?? 0).toFixed(1) }}s</b
      ><input
        type="range"
        min="0"
        max="4"
        step="0.1"
        v-model.number="doc.paletteTransition"
    /></label>
  </section>
</template>
