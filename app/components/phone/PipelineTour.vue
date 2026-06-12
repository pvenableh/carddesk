<script setup lang="ts">
/** 3-step coachmark explaining the relationship ladder. Shown once (per device)
 *  the first time the pipeline view opens; re-openable via usePipelineTour. */
const { open, finish } = usePipelineTour()

const STEPS = [
  { emoji: '🆕', icon: 'lucide:plus-circle', title: 'Everyone starts as New', body: 'Every contact you add or scan lands here. The first time you log a call, text, or email, we move them to Warming for you — no busywork.' },
  { emoji: '🎯', icon: 'lucide:target', title: 'Spot real potential? Flag an Opportunity', body: 'Tap Opportunity and pick a goal: a Client (they hire you) or a Partner (you trade work and referrals). That\'s the only call you have to make.' },
  { emoji: '🎓', icon: 'lucide:graduation-cap', title: 'Graduate the win', body: 'Closed it? Graduate them to Client or Partner. We\'ll celebrate it and help you set up the project or contract in Earnest.' },
]

const step = ref(0)
watch(open, (v) => { if (v) step.value = 0 })

const cur = computed(() => STEPS[step.value])
const isLast = computed(() => step.value === STEPS.length - 1)

function next() {
  if (isLast.value) finish()
  else step.value++
}
</script>

<template>
  <Transition name="cd-pop">
    <div
      v-if="open"
      style="position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 20px"
      @click.self="finish"
    >
      <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 18px; padding: 22px 20px; width: 100%; max-width: 360px; text-align: center">
        <div style="font-size: 40px; margin-bottom: 8px"><CdIcon :emoji="cur.emoji" :icon="cur.icon" :size="40" /></div>
        <div style="font-size: 17px; font-weight: 800; margin-bottom: 8px">{{ cur.title }}</div>
        <div style="font-size: 13px; color: var(--cd-muted); line-height: 1.55; margin-bottom: 18px">{{ cur.body }}</div>

        <!-- progress dots -->
        <div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 16px">
          <span
            v-for="(s, i) in STEPS"
            :key="i"
            :style="`width: ${i === step ? 18 : 6}px; height: 6px; border-radius: 9999px; background: ${i === step ? 'var(--cd-accent)' : 'var(--cd-bdr)'}; transition: all 0.2s`"
          />
        </div>

        <button class="cd-abtn g" style="font-size: 14px; padding: 12px" @click="next">
          {{ isLast ? 'Got it' : 'Next' }}
        </button>
        <button v-if="!isLast" style="width: 100%; padding: 9px; margin-top: 6px; border: none; background: none; color: var(--cd-dim); font-size: 12px; cursor: pointer" @click="finish">
          Skip
        </button>
      </div>
    </div>
  </Transition>
</template>
