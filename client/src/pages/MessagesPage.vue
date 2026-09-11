<template>
  <Layout>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h1 class="page-title">消息中心</h1>
        <button class="btn btn-secondary" @click="handleReadAll">全部已读</button>
      </div>
      <div class="card" style="padding:0">
        <div v-for="m in items" :key="m.id" :class="['message-item', { unread: !m.is_read }]" @click="!m.is_read && handleRead(m.id)">
          <div class="message-content"><strong>{{ m.sender_name || '系统' }}</strong>：{{ m.content }}</div>
          <div class="message-time">{{ formatDate(m.created_at) }}</div>
        </div>
        <div v-if="items.length === 0" class="empty">暂无消息</div>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const items = ref([]);

async function fetch() {
  try { items.value = await api.messages.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

async function handleRead(id) {
  try { await api.messages.read(id); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function handleReadAll() {
  try { await api.messages.readAll(); fetch(); showToast('已全部标记已读'); }
  catch (e) { showToast(e.message, 'error'); }
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}
</script>
