<template>
  <div v-if="names.length" class="recent">
    <div class="recent-label">Recent</div>
    <div class="recent-chips">
      <button
        v-for="n in names"
        :key="n"
        class="recent-chip"
        :title="n"
        @mousedown.prevent="$emit('select', n)"
      >{{ n }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Shows recently-used pet names as tappable chips. Selection is context-specific
// (add vs. fill the name field), so the parent decides via @select.
defineProps<{ names: string[] }>()
defineEmits<{ select: [string] }>()
</script>

<style scoped>
.recent {
  padding: 4px 2px 2px;
}
.recent-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 8px;
}
.recent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.recent-chip {
  max-width: 160px;
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 99px;
  border: 1px solid var(--border-hi);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-chip:hover {
  border-color: var(--primary);
  color: var(--text-1);
}
</style>
