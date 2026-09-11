<template>
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">{{ t.message }}</div>
  </div>
</template>

<script setup>
import { useToasts } from '../composables/useToast';
const { toasts } = useToasts();
</script>
