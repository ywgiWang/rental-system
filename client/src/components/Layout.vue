<template>
  <div>
    <div class="top-bar">
      <div class="top-bar-brand">悦居租房</div>
      <div class="top-bar-user">{{ auth.user?.name }}</div>
    </div>
    <div class="container page">
      <slot />
    </div>
    <nav class="navbar">
      <div class="navbar-inner">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" :class="['nav-item', { active: route.path === item.path }]">
          <span class="icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.badge > 0" class="nav-badge">{{ item.badge }}</span>
        </router-link>
        <a class="nav-item" @click="logout"><span class="icon">🚪</span><span>退出</span></a>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navItems = computed(() => {
  const items = [
    { path: '/dashboard', label: '首页', icon: '🏠' },
    { path: '/listings', label: '找房', icon: '🔍' },
    ...(auth.user?.role === 'landlord' || auth.user?.role === 'agent' ? [{ path: '/my-listings', label: '管理', icon: '📋' }] : []),
    { path: '/messages', label: '消息', icon: '💬', badge: auth.unreadCount },
    { path: '/leases', label: '租约', icon: '📑' },
  ];
  return items;
});

function logout() {
  auth.logout();
  router.push('/login');
}
</script>
