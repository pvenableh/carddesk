<script setup lang="ts">
// Full theme + appearance controls, sized for the avatar dropdown panel.
// Mirrors the (now-removed) account-page section: theme, dark mode, palette,
// tint, glass intensity, glass chrome. State lives in useTheme / useCdPalette,
// so changes persist and apply instantly the same way they did on /account.
const { theme, isDark, setTheme, THEMES } = useTheme()
const {
  palette,
  setPalette,
  paletteIds,
  palettes,
  paletteTint,
  setPaletteTint,
  glassIntensity,
  setGlassIntensity,
  glassChrome,
  setGlassChrome,
} = useCdPalette()

// Sleeper is kept in code but hidden from the picker for the beta. Only show
// the theme picker when there's an actual choice to make.
const visibleThemes = computed(() => THEMES.filter((t) => t.id !== 'sleeper'))
</script>

<template>
  <div class="ap">
    <!-- Theme -->
    <div v-if="visibleThemes.length > 1" class="ap-block">
      <div class="ap-label">Theme</div>
      <div class="ap-list">
        <button
          v-for="t in visibleThemes"
          :key="t.id"
          class="ap-card"
          :class="{ active: theme === t.id }"
          @click="setTheme(t.id)"
        >
          <div class="ap-theme-preview" :class="t.id" />
          <div class="ap-info">
            <span class="ap-name">{{ t.label }}</span>
            <span class="ap-desc">{{ t.description }}</span>
          </div>
          <span class="ap-check">{{ theme === t.id ? '✓' : '' }}</span>
        </button>
      </div>
    </div>

    <!-- Dark Mode -->
    <div class="ap-row">
      <div>
        <div class="ap-row-label">Dark Mode</div>
        <div class="ap-desc">{{ isDark ? 'On' : 'Off' }}</div>
      </div>
      <PhoneDarkModeToggle />
    </div>

    <!-- Palette + glass — glass theme only -->
    <template v-if="theme === 'glass'">
      <div class="ap-block">
        <div class="ap-label">Palette</div>
        <div class="ap-list">
          <button
            v-for="id in paletteIds"
            :key="id"
            class="ap-card"
            :class="{ active: palette === id }"
            @click="setPalette(id)"
          >
            <div class="ap-swatches">
              <span
                v-for="(c, i) in palettes[id].sourceColors.slice(0, 5)"
                :key="i"
                class="ap-dot"
                :style="`background: hsl(${c.h} ${c.s}% ${c.l}%)`"
              />
            </div>
            <div class="ap-info">
              <span class="ap-name">{{ palettes[id].meta.label }}</span>
              <span class="ap-desc">{{ palettes[id].meta.hint }}</span>
            </div>
            <span class="ap-check">{{ palette === id ? '✓' : '' }}</span>
          </button>
        </div>
      </div>

      <div class="ap-row">
        <div>
          <div class="ap-row-label">Palette Tint</div>
          <div class="ap-desc">
            {{ paletteTint ? 'Nav + status bar wear the gradient' : 'Surfaces stay frosted grey' }}
          </div>
        </div>
        <button
          type="button"
          class="ap-toggle"
          :class="{ on: paletteTint }"
          :aria-pressed="paletteTint"
          @click="setPaletteTint(!paletteTint)"
        >
          <span class="ap-toggle-knob" />
        </button>
      </div>

      <div class="ap-block">
        <div class="ap-label">Glass Intensity</div>
        <div class="ap-seg" role="tablist">
          <button
            type="button"
            class="ap-seg-tab"
            :class="{ on: glassIntensity === 'full' }"
            :aria-selected="glassIntensity === 'full'"
            @click="setGlassIntensity('full')"
          >Full</button>
          <button
            type="button"
            class="ap-seg-tab"
            :class="{ on: glassIntensity === 'restrained' }"
            :aria-selected="glassIntensity === 'restrained'"
            @click="setGlassIntensity('restrained')"
          >Restrained</button>
        </div>
        <div class="ap-desc ap-seg-desc">
          {{ glassIntensity === 'full'
            ? 'Ambient tint + translucent liquid-glass cards'
            : 'Clean flat cards, glass only on nav & bars' }}
        </div>
      </div>

      <div class="ap-row">
        <div>
          <div class="ap-row-label">Glass Chrome</div>
          <div class="ap-desc">
            {{ glassChrome ? 'Frosted buttons + chips' : 'Solid accent buttons & chips' }}
          </div>
        </div>
        <button
          type="button"
          class="ap-toggle"
          :class="{ on: glassChrome }"
          :aria-pressed="glassChrome"
          @click="setGlassChrome(!glassChrome)"
        >
          <span class="ap-toggle-knob" />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: sans-serif;
}
.ap-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ap-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--cd-dim);
  padding: 0 2px;
}
.ap-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ap-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: var(--cd-bg);
  border: 1.5px solid var(--cd-bdr);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: left;
  color: var(--cd-text);
  font-family: inherit;
}
.ap-card:hover {
  border-color: var(--cd-dim);
}
.ap-card.active {
  border-color: var(--cd-accent);
}
.ap-theme-preview {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  flex-shrink: 0;
}
.ap-theme-preview.glass {
  background: linear-gradient(135deg, #ffffff, #fcfcfc);
  border: 1px solid #ebebeb;
}
.ap-theme-preview.sleeper {
  background: linear-gradient(135deg, #060810, #0d1018);
  border: 1px solid #1c2330;
}
.ap-swatches {
  display: flex;
  align-items: center;
  width: 48px;
  height: 24px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.ap-dot {
  flex: 1;
  height: 100%;
}
.ap-info {
  flex: 1;
  min-width: 0;
}
.ap-name {
  display: block;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}
.ap-desc {
  display: block;
  font-size: 10px;
  color: var(--cd-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-check {
  font-size: 12px;
  color: var(--cd-accent);
  font-weight: 700;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
.ap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  background: var(--cd-bg);
  border: 1.5px solid var(--cd-bdr);
  border-radius: 10px;
}
.ap-row-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--cd-text);
}
.ap-row .ap-desc {
  white-space: normal;
}
/* Segmented control — self-contained so it doesn't lean on global .cd-tabs. */
.ap-seg {
  display: flex;
  width: 100%;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
}
.ap-seg-tab {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: none;
  border-radius: 7px;
  color: var(--cd-muted);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ap-seg-tab.on {
  background: var(--cd-bg2);
  color: var(--cd-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.ap-seg-desc {
  white-space: normal;
  padding: 0 2px;
}
/* Toggle switch — full-pill track + sliding knob, matching account.vue. */
.ap-toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 9999px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg);
  cursor: pointer;
  padding: 0;
  transition: background 0.18s, border-color 0.18s;
  flex-shrink: 0;
}
.ap-toggle.on {
  background: var(--cd-accent);
  border-color: var(--cd-accent);
}
/* Dark mode: --cd-accent is near-white, hiding the white knob — use brand green
 * for the on-state, matching the dark-mode toggle. */
html[data-mode="dark"] .ap-toggle.on {
  background: var(--cd-green);
  border-color: var(--cd-green);
}
.ap-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.ap-toggle.on .ap-toggle-knob {
  transform: translateX(18px);
}
</style>
