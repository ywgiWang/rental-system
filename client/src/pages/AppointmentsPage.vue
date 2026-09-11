<template>
  <Layout>
    <div>
      <h1 class="page-title">预约看房</h1>
      <div class="card" style="padding:0">
        <div class="table-container">
          <table>
            <thead><tr><th>房源</th><th>预约人</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="a in items" :key="a.id">
                <td>{{ a.listing_title }}</td>
                <td>{{ a.tenant_name }}</td>
                <td>{{ formatDate(a.appointment_date) }}</td>
                <td><span :class="['status', 'status-' + a.status]">{{ statusText(a.status) }}</span></td>
                <td>
                  <template v-if="auth.user?.role !== 'tenant' && a.status === 'pending'">
                    <button class="btn btn-sm btn-success" @click="handleAction(a.id, 'confirmed')">确认</button>
                    <button class="btn btn-sm btn-danger" @click="handleAction(a.id, 'cancelled')">取消</button>
                  </template>
                  <button v-if="auth.user?.role !== 'tenant' && a.status === 'confirmed'" class="btn btn-sm btn-primary" @click="handleAction(a.id, 'completed')">完成</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="items.length === 0" class="empty">暂无预约记录</div>
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
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}
</script>
