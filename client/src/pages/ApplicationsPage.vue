<template>
  <Layout>
    <div>
      <h1 class="page-title">申请管理</h1>
      <div v-for="a in items" :key="a.id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div class="list-title">{{ a.listing_title }}</div>
            <div class="list-sub">申请人：{{ a.tenant_name }}</div>
            <div class="list-sub">{{ formatDate(a.created_at) }}</div>
            <div v-if="a.message" class="list-sub" style="color:#888">留言：{{ a.message }}</div>
          </div>
          <span :class="['status', 'status-' + a.status]">{{ statusText(a.status) }}</span>
        </div>
        <div v-if="auth.user?.role !== 'tenant'" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <template v-if="a.status === 'pending'">
            <button class="btn btn-sm btn-success" @click="handleAction(a.id, 'approved')">通过</button>
            <button class="btn btn-sm btn-danger" @click="handleAction(a.id, 'rejected')">拒绝</button>
          </template>
          <button v-if="a.status === 'approved'" class="btn btn-sm btn-primary" @click="goCreateLease(a)">创建租约</button>
        </div>
      </div>
      <div v-if="items.length === 0" class="empty">暂无申请记录</div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const auth = useAuthStore();
const router = useRouter();
const items = ref([]);

async function fetch() {
  try { items.value = await api.applications.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

async function handleAction(id, status) {
  try { await api.applications.update(id, { status }); showToast('操作成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

function goCreateLease(a) {
  router.push(`/leases?property_id=${a.property_id}&listing_id=${a.listing_id}&tenant_id=${a.tenant_id}`);
}

function statusText(s) { return s === 'pending' ? '待审核' : s === 'approved' ? '已通过' : '已拒绝'; }
function formatDate(d) { return d ? new Date(d).toLocaleString() : '-'; }
</script>
