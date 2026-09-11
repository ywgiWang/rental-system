<template>
  <Layout>
    <div>
      <h1 class="page-title">申请管理</h1>
      <div class="card" style="padding:0">
        <div class="table-container">
          <table>
            <thead><tr><th>房源</th><th>申请人</th><th>状态</th><th>时间</th><th v-if="auth.user?.role !== 'tenant'">操作</th></tr></thead>
            <tbody>
              <tr v-for="a in items" :key="a.id">
                <td>{{ a.listing_title }}</td>
                <td>{{ a.tenant_name }}</td>
                <td><span :class="['status', 'status-' + a.status]">{{ a.status === 'pending' ? '待审核' : a.status === 'approved' ? '已通过' : '已拒绝' }}</span></td>
                <td>{{ formatDate(a.created_at) }}</td>
                <td v-if="auth.user?.role !== 'tenant'">
                  <template v-if="a.status === 'pending'">
                    <button class="btn btn-sm btn-success" @click="handleAction(a.id, 'approved')">通过</button>
                    <button class="btn btn-sm btn-danger" @click="handleAction(a.id, 'rejected')">拒绝</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="items.length === 0" class="empty">暂无申请记录</div>
      </div>
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
  try { items.value = await api.applications.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

async function handleAction(id, status) {
  try { await api.applications.update(id, { status }); showToast('操作成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}
</script>
