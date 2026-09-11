<template>
  <Layout>
    <div>
      <h1 class="page-title">工作台</h1>
      <div class="grid grid-2">
        <div v-for="c in cards" :key="c.label" class="stat-card">
          <div class="stat-value">{{ c.value }}</div>
          <div class="stat-label">{{ c.label }}</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">欢迎使用悦居租房</div>
        <p>您当前以「{{ auth.roleName }}」身份登录。</p>
        <p style="margin-top:8px">通过底部导航可以访问各个功能模块。</p>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const auth = useAuthStore();
const stats = ref({});
const loading = ref(true);

const cards = computed(() => {
  if (auth.user?.role === 'tenant') {
    return [
      { label: '我的申请', value: stats.value.myApplications || 0 },
      { label: '我的预约', value: stats.value.myAppointments || 0 },
      { label: '当前租约', value: stats.value.myLeases || 0 },
      { label: '未读消息', value: stats.value.unreadMessages || 0 },
    ];
  }
  return [
    { label: '我的房源', value: stats.value.myListings || 0 },
    { label: '待处理申请', value: stats.value.pendingApplications || 0 },
    { label: '待确认预约', value: stats.value.pendingAppointments || 0 },
    { label: '在租租约', value: stats.value.activeLeases || 0 },
  ];
});

onMounted(async () => {
  try { stats.value = await api.dashboard(); }
  catch (e) { showToast(e.message, 'error'); }
  loading.value = false;
});
</script>
