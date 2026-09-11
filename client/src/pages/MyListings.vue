<template>
  <Layout>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h1 class="page-title">房源管理</h1>
        <button class="btn btn-primary" @click="openNew">+ 发布</button>
      </div>
      <div class="grid">
        <div v-for="l in listings" :key="l.id" class="listing-card">
          <div class="listing-img">
            <img v-if="l.images?.length" :src="l.images[0]" alt="房源图片" />
            <span v-else>暂无图片</span>
          </div>
          <div class="listing-body">
            <div class="listing-title">{{ l.title }}</div>
            <div class="listing-price">¥{{ l.price }}/月</div>
            <div class="listing-meta">{{ l.address }}</div>
            <div v-if="l.available_from" class="listing-meta" style="color:#2563eb">可租: {{ l.available_from }}</div>
            <div style="margin-top:8px">
              <span :class="['status', 'status-' + l.status]">{{ l.status === 'available' ? '可租' : l.status === 'rented' ? '已租' : '已下架' }}</span>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-sm btn-secondary" style="flex:1" @click="openEdit(l)">编辑</button>
              <button class="btn btn-sm btn-danger" style="flex:1" @click="handleDelete(l.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="listings.length === 0" class="empty">暂无房源</div>

      <div v-if="showModal" class="modal-overlay" @click="showModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">{{ editing ? '编辑房源' : '发布房源' }}</div><button class="modal-close" @click="showModal = false">×</button></div>
          <form @submit.prevent="handleSubmit">
            <div class="modal-body">
              <div class="form-group"><label>房源照片</label>
                <div class="image-upload">
                  <div v-for="(img, i) in form.images" :key="i" class="image-upload-item">
                    <img :src="img" alt="" />
                    <button type="button" class="remove" @click="removeImage(i)">×</button>
                  </div>
                  <div v-if="form.images.length < 6" class="image-upload-placeholder" @click="$refs.fileInput.click()">+</div>
                </div>
                <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="handleFileChange" />
              </div>
              <div class="form-group"><label>标题</label><input v-model="form.title" required placeholder="例如：阳光花园三居室" /></div>
              <div class="form-group"><label>地址</label><input v-model="form.address" required placeholder="详细地址" /></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>面积(㎡)</label><input type="number" v-model="form.area" required /></div>
                <div class="form-group"><label>月租(元)</label><input type="number" v-model="form.price" required /></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>房间数</label><input type="number" v-model="form.rooms" required /></div>
                <div class="form-group"><label>类型</label>
                  <select v-model="form.type">
                    <option value="apartment">公寓</option><option value="house">住宅</option><option value="villa">别墅</option><option value="studio">单间</option>
                  </select>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>可租日期</label><input type="date" v-model="form.available_from" /></div>
                <div class="form-group"><label>经度</label><input type="number" step="any" v-model="form.longitude" placeholder="如 116.4074" /></div>
              </div>
              <div class="form-group"><label>纬度</label><input type="number" step="any" v-model="form.latitude" placeholder="如 39.9042" /></div>
              <div v-if="editing" class="form-group"><label>状态</label>
                <select v-model="form.status">
                  <option value="available">可租</option><option value="rented">已租</option><option value="offline">已下架</option>
                </select>
              </div>
              <div class="form-group"><label>描述</label><textarea v-model="form.description" rows="3" placeholder="房源亮点、配套设施等..."></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
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
const listings = ref([]);
const showModal = ref(false);
const editing = ref(null);
const form = ref({ title: '', description: '', address: '', area: '', price: '', rooms: '', type: 'apartment', status: 'available', images: [], available_from: '', latitude: '', longitude: '' });

async function fetch() {
  try {
    const all = await api.listings.list('');
    listings.value = all.filter(l => l.landlord_id === auth.user?.id || auth.user?.role === 'agent');
  } catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

function openNew() {
  editing.value = null;
  form.value = { title: '', description: '', address: '', area: '', price: '', rooms: '', type: 'apartment', status: 'available', images: [], available_from: '', latitude: '', longitude: '' };
  showModal.value = true;
}
function openEdit(l) {
  editing.value = l;
  form.value = { ...l, images: l.images || [] };
  showModal.value = true;
}

function handleFileChange(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    if (form.value.images.length >= 6) { showToast('最多上传6张图片', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { form.value.images.push(ev.target.result); };
    reader.readAsDataURL(file);
  });
}
function removeImage(idx) { form.value.images.splice(idx, 1); }

async function handleSubmit() {
  try {
    const body = { ...form.value, area: parseFloat(form.value.area), price: parseFloat(form.value.price), rooms: parseInt(form.value.rooms) };
    if (editing.value) { await api.listings.update(editing.value.id, body); showToast('更新成功'); }
    else { await api.listings.create(body); showToast('发布成功'); }
    showModal.value = false; fetch();
  } catch (e) { showToast(e.message, 'error'); }
}

async function handleDelete(id) {
  if (!confirm('确定删除此房源？')) return;
  try { await api.listings.delete(id); showToast('删除成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}
</script>
