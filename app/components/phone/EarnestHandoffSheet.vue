<script setup lang="ts">
/**
 * Shown right after a contact graduates to Client/Partner. Branches on whether
 * the user is Earnest-linked (token source === 'org'):
 *  - Earnest user → promote the contact into the Earnest CRM and deep-link to it.
 *  - CardDesk-only → a sign-up nudge, since the contract/project lives in Earnest.
 */
const props = defineProps<{ open: boolean; contact: any | null; goal: 'client' | 'partner' }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { isOrg } = useCredits()
const { error: showError } = useToast()
const earnestBase = (useRuntimeConfig().public.earnestAppUrl as string).replace(/\/$/, '')

const status = ref<'idle' | 'loading' | 'done'>('idle')
const deepLink = ref('')

const name = computed(() => props.contact?.name ?? 'this contact')
const goalLabel = computed(() => (props.goal === 'client' ? 'client' : 'partner'))

function close() {
  emit('update:open', false)
  // Reset for next time after the sheet animates away.
  setTimeout(() => { status.value = 'idle'; deepLink.value = '' }, 250)
}

async function openInEarnest() {
  if (!props.contact?.id) return
  status.value = 'loading'
  try {
    const res = await $fetch<{ deepLink: string }>(`/api/contacts/${props.contact.id}/promote`, {
      method: 'POST',
      body: { goal: props.goal, reason: props.contact.conversion_reason, note: props.contact.conversion_note },
    })
    deepLink.value = res.deepLink
    status.value = 'done'
    window.open(res.deepLink, '_blank', 'noopener')
  } catch (err: any) {
    status.value = 'idle'
    showError(err?.data?.message || "Couldn't reach Earnest — try again.")
  }
}

function signUp() {
  const redirect = encodeURIComponent('/apps/clients?view=contacts')
  window.open(`${earnestBase}/register?redirect=${redirect}&utm_source=carddesk&utm_medium=graduate`, '_blank', 'noopener')
  close()
}
</script>

<template>
  <PhoneSheet :open="open" padding="18px 16px" @update:open="close">
        <div style="font-size: 30px; text-align: center; margin-bottom: 6px">
          <CdIcon :emoji="goal === 'client' ? '💰' : '🤝'" :icon="goal === 'client' ? 'lucide:badge-check' : 'lucide:handshake'" :size="30" />
        </div>

        <!-- Earnest-linked: promote + deep-link -->
        <template v-if="isOrg">
          <div style="font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 4px">
            {{ goal === 'client' ? `Set up ${name} in Earnest` : `Add ${name} to your CRM` }}
          </div>
          <div style="font-size: 12px; color: var(--cd-muted); text-align: center; margin-bottom: 16px; line-height: 1.5">
            {{ goal === 'client'
              ? 'Open the new lead to manage the contract, project, and payments.'
              : 'We\'ll add them as a partner contact you can collaborate with.' }}
          </div>
          <button v-if="status !== 'done'" class="cd-abtn g" style="font-size: 15px; padding: 13px" :disabled="status === 'loading'" @click="openInEarnest">
            <CdIcon emoji="🚀" icon="lucide:external-link" :size="14" />
            {{ status === 'loading' ? 'Opening…' : 'Open in Earnest' }}
          </button>
          <a v-else :href="deepLink" target="_blank" rel="noopener" class="cd-abtn g" style="font-size: 15px; padding: 13px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px">
            <CdIcon emoji="✅" icon="lucide:check" :size="14" /> Opened — view again
          </a>
        </template>

        <!-- CardDesk-only: sign-up nudge -->
        <template v-else>
          <div style="font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 4px">
            You landed a {{ goalLabel }}! 🎉
          </div>
          <div style="font-size: 12px; color: var(--cd-muted); text-align: center; margin-bottom: 16px; line-height: 1.5">
            Manage the contract, project, and payments in Earnest — free to start, and your CardDesk contacts come with you.
          </div>
          <button class="cd-abtn g" style="font-size: 15px; padding: 13px" @click="signUp">
            <CdIcon emoji="✨" icon="lucide:sparkles" :size="14" /> Create your Earnest account
          </button>
        </template>

        <button
          style="width: 100%; padding: 10px; margin-top: 8px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer"
          @click="close"
        >{{ status === 'done' ? 'Done' : 'Maybe later' }}</button>
  </PhoneSheet>
</template>
