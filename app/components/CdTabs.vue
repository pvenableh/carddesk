<script setup lang="ts" generic="K extends string">
/**
 * CdTabs — UTabs-style floating-pill segmented control.
 *
 * Pass `items: TabItem[]` and `v-model` the active key. Each item can
 * carry an optional emoji + lucide icon (rendered via CdIcon), a count
 * chip, or a colored leading dot.
 *
 * Visual contract: container is a single rounded-full track with a
 * subtle background; the active item floats above with the page-bg
 * fill + tiny shadow. Mirrors Earnest's UTabs floating-pill variant.
 *
 * Generic over the key type so consumers can preserve a union literal
 * for `v-model` (e.g. `'rating' | 'pipeline'`).
 */
export type CdTabItem<K extends string = string> = {
  key: K;
  label: string;
  emoji?: string;
  icon?: string;
  count?: number | null;
  dotColor?: string;
};

const props = defineProps<{
  modelValue: K;
  items: CdTabItem<K>[];
  size?: 'sm' | 'md';
  // When true, tapping the already-active tab clears the selection (emits
  // `clearValue`, default ''). Turns the control into toggle-able filter chips
  // where "nothing selected" is a valid state.
  toggle?: boolean;
  clearValue?: K;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', key: K): void;
}>();

function select(key: K) {
  if (key !== props.modelValue) {
    emit('update:modelValue', key);
  } else if (props.toggle) {
    emit('update:modelValue', (props.clearValue ?? '') as K);
  }
}
</script>

<template>
  <div class="cd-tabs" role="tablist">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      role="tab"
      :aria-selected="item.key === modelValue"
      class="cd-tab"
      :class="{ on: item.key === modelValue }"
      @click="select(item.key)"
    >
      <span
        v-if="item.dotColor"
        class="cd-tab-dot"
        :style="{ background: item.dotColor }"
      ></span>
      <CdIcon
        v-if="item.emoji || item.icon"
        :emoji="item.emoji ?? ''"
        :icon="item.icon"
        :size="size === 'sm' ? 11 : 12"
      />
      <span>{{ item.label }}</span>
      <span v-if="item.count != null" class="cd-tab-count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.cd-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}
</style>
