<script setup lang="ts">
defineProps<{
  toast: { icon: string; xp: string; msg: string } | null
}>()
</script>

<template>
  <Transition name="cd-toast">
    <div v-if="toast" class="cd-toast">
      <span style="font-size: 18px">{{ toast.icon }}</span>
      <span
        style="
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          color: #00ff87;
          letter-spacing: 1px;
        "
      >{{ toast.xp }}</span>
      <span style="font-size: 11px; color: #8898b0; font-weight: 600">{{ toast.msg }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.cd-toast {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-accent);
  border-radius: 99px;
  padding: 9px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 999;
  white-space: nowrap;
  box-shadow: 0 0 30px rgba(0, 255, 135, 0.2);
}
.cd-toast-enter-active {
  animation: cd-tin 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.cd-toast-leave-active {
  transition: opacity 0.2s;
}
.cd-toast-leave-to {
  opacity: 0;
}
@keyframes cd-tin {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
