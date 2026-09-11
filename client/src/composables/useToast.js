import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function showToast(message, type = 'success') {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
}

export function useToasts() {
  return { toasts };
}
