<script setup lang="ts">
/**
 * CdButton — the three-tier button hierarchy for CardDesk.
 *
 *   tier="primary"   → solid accent CTA              (1 per surface, ideally)
 *   tier="secondary" → outline / tinted-fill action  (multiple OK)
 *   tier="utility"   → ghost icon/text button        (utility clusters)
 *
 * `accent` (green | blue | orange | purple) optionally re-colors the
 * variant — secondary buttons get a soft tint, primary buttons get a
 * different solid fill. Defaults to green (the CardDesk accent).
 *
 * Set `block` to stretch full-width and `iconOnly` to render a square chip.
 */
type Tier = 'primary' | 'secondary' | 'utility';
type Accent = 'green' | 'blue' | 'orange' | 'purple';

const props = withDefaults(
  defineProps<{
    tier?: Tier;
    accent?: Accent;
    size?: 'sm' | 'md';
    block?: boolean;
    iconOnly?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    tier: 'secondary',
    accent: 'green',
    size: 'md',
    block: false,
    iconOnly: false,
    disabled: false,
    type: 'button',
  },
);

const classes = computed(() => [
  'cd-btn',
  `cd-btn--${props.tier}`,
  `cd-btn--accent-${props.accent}`,
  { 'cd-btn--sm': props.size === 'sm' },
  { 'cd-btn--block': props.block },
  { 'cd-btn--icon': props.iconOnly },
]);
</script>

<template>
  <button :class="classes" :disabled="disabled" :type="type">
    <slot />
  </button>
</template>
