<script setup lang="ts">
const { state, loadCredits, openBuyModal, isOrg, lowBalance } = useCredits()

onMounted(() => {
  if (!state.value.loaded) loadCredits()
})

function onGetMore() {
  openBuyModal()
}
</script>

<template>
  <div class="cd-credit-meter">
    <!-- Earnest-org users: billed through Earnest, no purchase here -->
    <template v-if="isOrg">
      <div class="cd-cm-row">
        <span class="cd-cm-label"><CdIcon emoji="⚡" icon="lucide:zap" /> Earnest AI usage</span>
        <span class="cd-cm-value">Team plan</span>
      </div>
      <p class="cd-cm-note">Billed through Earnest</p>
    </template>

    <!-- Standalone users: flat credit balance + buy CTA -->
    <template v-else>
      <div class="cd-cm-row">
        <span class="cd-cm-label"><CdIcon emoji="⚡" icon="lucide:zap" /> Earnest AI credits</span>
        <span class="cd-cm-value" :class="{ 'is-low': lowBalance }">{{ state.credits }}</span>
      </div>
      <button class="cd-cm-buy" :class="{ 'is-low': lowBalance }" type="button" @click="onGetMore">
        {{ lowBalance ? 'Top up credits' : 'Get more credits' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.cd-credit-meter {
  padding: 4px 6px 2px;
}
.cd-cm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cd-cm-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-muted);
}
.cd-cm-value {
  font-size: 15px;
  font-weight: 800;
  color: var(--cd-text);
  font-variant-numeric: tabular-nums;
}
.cd-cm-value.is-low {
  color: #f59e0b;
}
.cd-cm-note {
  margin: 0;
  font-size: 11px;
  color: var(--cd-muted);
}
.cd-cm-buy {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg);
  color: var(--cd-text);
  font-size: 12px;
  font-weight: 700;
  font-family: sans-serif;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.cd-cm-buy:hover {
  border-color: var(--cd-accent);
}
.cd-cm-buy.is-low {
  border-color: #f59e0b;
  color: #f59e0b;
}
</style>
