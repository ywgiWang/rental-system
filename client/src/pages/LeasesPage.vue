<template>
  <Layout>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h1 class="page-title">租期管理</h1>
        <button v-if="auth.user?.role !== 'tenant'" class="btn btn-primary" @click="showModal = true">+ 创建租约</button>
      </div>
      <div class="card" style="padding:0">
        <div class="table-container">
          <table>
            <thead><tr><th>房源</th><th>租客</th><th>开始</th><th>结束</th><th>剩余</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="l in items" :key="l.id">
                <td>{{ l.listing_title }}</td>
                <td>{{ l.tenant_name }}</td>
                <td>{{ l.start_date }}</td>
                <td>{{ l.end_date }}</td>
                <td :style="daysStyle(l)">{{ daysLeft(l) }}</td>
                <td><span :class="['status', 'status-' + l.status]">{{ l.status === 'active' ? '生效中' : l.status === 'expired' ? '已到期' : '已终止' }}</span></td>
                <td>
                  <button v-if="l.status === 'active' && auth.user?.role !== 'tenant'" class="btn btn-sm btn-danger" @click="handleTerminate(l.id)">终止</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="items.length === 0" class="empty">暂无租约</div>
      </div>

      <div v-if="showModal" class="modal-overlay" @click="showModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">创建租约</div><button class="modal-close" @click="showModal = false">×</button></div>
          <form @submit.prevent="handleCreate">
            <div class="modal-body">
              <div class="form-group">
                <label>房源</label>
                <select v-model="form.listing_id" required>
                  <option value="">请选择</option>
                  <option v-for="l in availableListings" :key="l.id" :value="l.id">{{ l.title }} - {{ l.address }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>租客</label>
                <select v-model="form.tenant_id" required>
                  <option value="">请选择</option>
                  <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.username }})</option>
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>开始日期</label><input type="date" v-model="form.start_date" required /></div>
                <div class="form-group"><label>结束日期</label><input type="date" v-model="form.end_date" required /></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
              <button type="submit" class="btn btn-primary">创建</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const auth = useAuthStore();
const items = ref([]);
const users = ref([]);
const listings = ref([]);
const showModal = ref(false);
const form = ref({ listing_id: '', tenant_id: '', start_date: '', end_date: '' });

const availableListings = computed(() => listings.value.filter(l => l.status === 'available'));

async function fetch() {
  try { items.value = await api.leases.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(async () => {
  fetch();
  if (auth.user?.role !== 'tenant') {
    try {
      users.value = await api.users.list('tenant');
      listings.value = await api.listings.list('');
    } catch {}
  }
});

async function handleCreate() {
  try { await api.leases.create(form.value); showToast('租约创建成功'); showModal.value = false; fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function handleTerminate(id) {
  if (!confirm('确定终止此租约？房源将恢复为可租状态。')) return;
  try { await api.leases.update(id, { status: 'terminated' }); showToast('租约已终止'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

function daysLeft(l) {
  if (l.status !== 'active') return '-';
  const diff = Math.ceil((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24));
  return diff + '天';
}
function daysStyle(l) {
  if (l.status !== 'active') return {};
  const diff = Math.ceil((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24));
  return diff <= 7 ? { color: '#dc2626', fontWeight: 'bold' } : {};
}
</script>
