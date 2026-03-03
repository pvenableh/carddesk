<script setup lang="ts">
const { theme } = useTheme()

defineProps<{
  emoji: string
  icon?: string
  size?: string | number
}>()
</script>

<template>
  <Icon v-if="theme === 'modern' && icon" :name="icon" :size="size" />
  <span v-else>{{ emoji }}</span>
</template>
