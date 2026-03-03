<script setup lang="ts">
const { isDark, toggleDarkMode } = useTheme()
</script>

<template>
  <button
    type="button"
    class="cd-dm-toggle"
    :class="isDark ? 'cd-dm-on' : 'cd-dm-off'"
    role="switch"
    :aria-checked="isDark"
    aria-label="Toggle dark mode"
    @click="toggleDarkMode()"
  >
    <span
      class="cd-dm-thumb"
      :class="isDark ? 'cd-dm-thumb-on' : 'cd-dm-thumb-off'"
    >
      <span class="cd-dm-indicator">{{ isDark ? '🌙' : '☀️' }}</span>
    </span>
  </button>
</template>

<style scoped>
.cd-dm-toggle {
  position: relative;
  display: inline-flex;
  height: 24px;
  width: 44px;
  flex-shrink: 0;
  cursor: pointer;
  align-items: center;
  border-radius: 9999px;
  border: none;
  transition: background-color 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  padding: 2px;
}
.cd-dm-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--cd-bg), 0 0 0 4px var(--cd-accent);
}
.cd-dm-on {
  background: var(--cd-accent);
}
.cd-dm-off {
  background: var(--cd-bdr);
}
.cd-dm-thumb {
  pointer-events: none;
  display: flex;
  height: 20px;
  width: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}
.cd-dm-thumb-on {
  transform: translateX(20px);
}
.cd-dm-thumb-off {
  transform: translateX(0);
}
.cd-dm-indicator {
  font-size: 11px;
  line-height: 1;
}
</style>
