<template>
  <Layout>
    <div>
      <h1 class="page-title">预约看房</h1>
      <div v-for="a in items" :key="a.id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div class="list-title">{{ a.listing_title }}</div>
            <div class="list-sub">预约人：{{ a.tenant_name }}</div>
            <div class="list-sub">{{ formatDate(a.appointment_date) }}</div>
          </div>
          <span :class="['status', 'status-' + a.status]">{{ statusText(a.status) }}</span>
        </div>
        <div v-if="auth.user?.role !== 'tenant'" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <template v-if="a.status === 'pending'">
            <button class="btn btn-sm btn-success" @click="handleAction(a.id, 'confirmed')">确认</button>
            <button class="btn btn-sm btn-danger" @click="handleAction(a.id, 'cancelled')">取消</button>
          </template>
          <button v-if="a.status === 'confirmed'" class="btn btn-sm btn-primary" @click="handleAction(a.id, 'completed')">完成</button>
        </div>
      </div>
      <div v-if="items.length === 0" class="empty">暂无预约记录</div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const auth = useAuthStore();
const items = ref([]);

async function fetch() {
  try { items.value = await api.appointments.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

async function handleAction(id, status) {
  try { await api.appointments.update(id, { status }); showToast('操作成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

function statusText(s) {
  return s === 'pending' ? '待确认' : s === 'confirmed' ? '已确认' : s === 'cancelled' ? '已取消' : '已完成';
}
function formatDate(d) { return d ? new Date(d).toLocaleString() : '-'; }
</script>
