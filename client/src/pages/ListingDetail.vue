<template>
  <Layout>
    <div v-if="listing">
      <button class="btn btn-secondary btn-sm" @click="$router.back()" style="margin-bottom:12px">← 返回</button>
      <div class="detail-gallery">
        <img v-if="images.length" :src="images[0]" alt="房源图片" />
        <span v-else>暂无图片</span>
      </div>
      <div v-if="images.length > 1" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto">
        <img v-for="(img, i) in images" :key="i" :src="img" style="width:80px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0" />
      </div>

      <h2 style="margin-bottom:8px;font-size:18px">{{ listing.title }}</h2>
      <div class="detail-price">¥{{ listing.price }}/月</div>

      <div class="card" style="margin-bottom:16px">
        <div class="detail-info-row"><span class="label">地址</span><span class="value">{{ listing.address }}</span></div>
        <div class="detail-info-row"><span class="label">面积</span><span class="value">{{ listing.area }}㎡</span></div>
        <div class="detail-info-row"><span class="label">户型</span><span class="value">{{ listing.rooms }}室</span></div>
        <div class="detail-info-row"><span class="label">类型</span><span class="value">{{ typeName }}</span></div>
        <div class="detail-info-row"><span class="label">状态</span><span class="value"><span :class="['status', 'status-' + listing.status]">{{ statusName }}</span></span></div>
        <div v-if="listing.available_from" class="detail-info-row"><span class="label">可租日期</span><span class="value" style="color:#2563eb">{{ listing.available_from }}</span></div>
        <div class="detail-info-row"><span class="label">房东</span><span class="value">{{ listing.landlord_name }}</span></div>
      </div>

      <div class="map-container">
        <div>📍 地图位置<br><small style="color:#888"> lat: {{ listing.latitude }}, lng: {{ listing.longitude }}</small></div>
      </div>

      <div class="card" style="margin-bottom:80px">
        <div class="card-title">房源描述</div>
        <p style="color:#555;font-size:14px;line-height:1.7">{{ listing.description || '暂无描述' }}</p>
      </div>

      <div v-if="auth.user?.role === 'tenant' && listing.status === 'available'" class="detail-actions">
        <button class="btn btn-primary" @click="showApply = true">申请租房</button>
        <button class="btn btn-success" @click="showBook = true">预约看房</button>
      </div>

      <div v-if="showApply" class="modal-overlay" @click="showApply = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">申请租房</div><button class="modal-close" @click="showApply = false">×</button></div>
          <div class="modal-body">
            <div class="form-group"><label>申请留言</label><textarea v-model="applyMsg" rows="3" placeholder="请简单介绍您的情况..."></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showApply = false">取消</button>
            <button class="btn btn-primary" @click="handleApply">提交申请</button>
          </div>
        </div>
      </div>

      <div v-if="showBook" class="modal-overlay" @click="showBook = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">预约看房</div><button class="modal-close" @click="showBook = false">×</button></div>
          <div class="modal-body">
            <div class="form-group"><label>预约时间</label><input type="datetime-local" v-model="bookDate" /></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showBook = false">取消</button>
            <button class="btn btn-primary" @click="handleBook">提交预约</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else>加载中...</div>
  </Layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const route = useRoute();
const auth = useAuthStore();
const listing = ref(null);
const showApply = ref(false);
const showBook = ref(false);
const applyMsg = ref('');
const bookDate = ref('');

const images = computed(() => listing.value?.images || []);
const typeName = computed(() => {
  const t = listing.value?.type;
  return t === 'apartment' ? '公寓' : t === 'house' ? '住宅' : t === 'villa' ? '别墅' : '单间';
});
const statusName = computed(() => {
  const s = listing.value?.status;
  return s === 'available' ? '可租' : s === 'rented' ? '已租' : '已下架';
});

onMounted(async () => {
  try { listing.value = await api.listings.get(route.params.id); }
  catch (e) { showToast(e.message, 'error'); }
});

async function handleApply() {
  try { await api.applications.create({ listing_id: route.params.id, message: applyMsg.value }); showToast('申请已提交'); showApply.value = false; }
  catch (e) { showToast(e.message, 'error'); }
}
async function handleBook() {
  try { await api.appointments.create({ listing_id: route.params.id, appointment_date: bookDate.value }); showToast('预约已提交'); showBook.value = false; }
  catch (e) { showToast(e.message, 'error'); }
}
</script>
