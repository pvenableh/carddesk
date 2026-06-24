<script setup lang="ts">
/**
 * Editor for a contact's *additional* phone numbers — the ones beyond the
 * primary `phone` field. v-models an array of `{ label, value }`; each row is an
 * optional label (Work, Home, …) plus the number. Shared by the Add Contact and
 * Detail edit forms so the add/remove logic lives in one place. Empty rows are
 * harmless — callers strip blanks on save (see `cleanPhones`).
 */
import type { ContactPhone } from '~/types/contact'

const props = defineProps<{ modelValue: ContactPhone[] | null | undefined }>()
const emit = defineEmits<{ 'update:modelValue': [ContactPhone[]] }>()

const list = computed<ContactPhone[]>({
  get: () => props.modelValue ?? [],
  set: (v) => emit('update:modelValue', v),
})

function add() {
  list.value = [...list.value, { label: '', value: '' }]
}
function removeAt(i: number) {
  list.value = list.value.filter((_, idx) => idx !== i)
}
function patch(i: number, field: 'label' | 'value', val: string) {
  list.value = list.value.map((p, idx) => (idx === i ? { ...p, [field]: val } : p))
}
</script>

<template>
  <div class="phf">
    <div v-for="(p, i) in list" :key="i" class="phf-row">
      <input
        class="cd-inp phf-label"
        :value="p.label"
        placeholder="Work"
        aria-label="Phone label"
        @input="patch(i, 'label', ($event.target as HTMLInputElement).value)"
      />
      <input
        class="cd-inp phf-num"
        :value="p.value"
        type="tel"
        placeholder="+1 555 000 0000"
        aria-label="Phone number"
        @input="patch(i, 'value', ($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="phf-rm" aria-label="Remove number" @click="removeAt(i)">
        <CdIcon icon="lucide:x" :size="14" />
      </button>
    </div>
    <button type="button" class="phf-add" @click="add">
      <CdIcon icon="lucide:plus" :size="13" /> Add {{ list.length ? 'another' : 'a' }} number
    </button>
  </div>
</template>

<style scoped>
.phf { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.phf-row { display: flex; gap: 6px; align-items: center; }
/* Label stays narrow; the number takes the rest of the row. */
.phf-label { flex: 0 0 84px; min-width: 0; }
.phf-num { flex: 1; min-width: 0; }
.phf-rm {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-dim);
  cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.phf-rm:hover { color: #f87171; border-color: color-mix(in srgb, #f87171 45%, transparent); }
.phf-add {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 5px;
  background: transparent; border: 1px dashed var(--cd-bdr); border-radius: 999px;
  padding: 6px 12px; font-family: inherit; font-size: 11.5px; font-weight: 700;
  color: var(--cd-muted); cursor: pointer; transition: border-color 0.15s, color 0.15s;
}
.phf-add:hover { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.phf-add :deep(svg) { color: var(--cd-accent); }
</style>
