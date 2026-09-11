<template>
  <div>
    <ToastContainer />
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useAuthStore } from './stores/auth';
import ToastContainer from './components/ToastContainer.vue';

const auth = useAuthStore();
let unreadTimer = null;

onMounted(async () => {
  await auth.init();
  if (auth.token) {
    auth.fetchUnread();
    unreadTimer = setInterval(() => auth.fetchUnread(), 10000);
  }
});

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer);
});
</script>
