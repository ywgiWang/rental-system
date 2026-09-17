<template>
  <Layout>
    <div>
      <h1 class="page-title">房源管理</h1>

      <div class="seg">
        <button :class="['seg-item', { active: tab === 'properties' }]" @click="tab = 'properties'">房屋</button>
        <button :class="['seg-item', { active: tab === 'listings' }]" @click="tab = 'listings'">发布</button>
      </div>

      <!-- 房屋 Tab -->
      <div v-if="tab === 'properties'">
        <button class="btn btn-primary" style="width:100%" @click="openNewProperty">+ 新增房屋</button>
        <div class="grid" style="margin-top:12px">
          <div v-for="p in properties" :key="p.id" class="listing-card">
            <div class="listing-img">
              <img v-if="p.images?.length" :src="p.images[0]" alt="房屋图片" />
              <span v-else>暂无图片</span>
            </div>
            <div class="listing-body">
              <div class="listing-title">{{ p.address }}</div>
              <div class="listing-meta">{{ p.area }}㎡ · {{ typeText(p.type) }} · {{ p.rooms }}室</div>
              <div style="margin-top:10px;display:flex;gap:8px">
                <button class="btn btn-sm btn-primary" style="flex:1" @click="publishFromProperty(p)">发布出租</button>
                <button class="btn btn-sm btn-secondary" style="flex:1" @click="openEditProperty(p)">编辑</button>
                <button class="btn btn-sm btn-danger" style="flex:1" @click="handleDeleteProperty(p.id)">删除</button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="properties.length === 0" class="empty">暂无房屋，点击上方新增</div>
      </div>

      <!-- 发布 Tab -->
      <div v-else>
        <button class="btn btn-primary" style="width:100%" @click="openNewListing">+ 发布</button>
        <div class="grid" style="margin-top:12px">
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
                <span :class="['status', 'status-' + l.status]">{{ statusText(l.status) }}</span>
              </div>
              <div style="margin-top:10px;display:flex;gap:8px">
                <button class="btn btn-sm btn-secondary" style="flex:1" @click="openEditListing(l)">编辑</button>
                <button class="btn btn-sm btn-warning" style="flex:1" @click="toggleStatus(l)">{{ l.status === 'offline' ? '上架' : '下架' }}</button>
                <button class="btn btn-sm btn-danger" style="flex:1" @click="handleDeleteListing(l.id)">删除</button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="listings.length === 0" class="empty">暂无发布记录</div>
      </div>

      <!-- 房屋表单弹窗 -->
      <div v-if="showPropertyModal" class="modal-overlay" @click="showPropertyModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">{{ editingProperty ? '编辑房屋' : '新增房屋' }}</div><button class="modal-close" @click="showPropertyModal = false">×</button></div>
          <form @submit.prevent="saveProperty">
            <div class="modal-body">
              <div class="form-group"><label>房屋照片</label>
                <div class="image-upload">
                  <div v-for="(img, i) in propertyForm.images" :key="i" class="image-upload-item">
                    <img :src="img" alt="" />
                    <button type="button" class="remove" @click="removeImage(i)">×</button>
                  </div>
                  <div v-if="propertyForm.images.length < 6" class="image-upload-placeholder" @click="$refs.propFile.click()">+</div>
                </div>
                <input ref="propFile" type="file" accept="image/*" multiple style="display:none" @change="handlePropertyFile" />
              </div>
              <div class="form-group"><label>地址</label><input v-model="propertyForm.address" required placeholder="详细地址" /></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>面积(㎡)</label><input type="number" v-model="propertyForm.area" required /></div>
                <div class="form-group"><label>房间数</label><input type="number" v-model="propertyForm.rooms" required /></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>类型</label>
                  <select v-model="propertyForm.type">
                    <option value="apartment">公寓</option><option value="house">住宅</option><option value="villa">别墅</option><option value="studio">单间</option>
                  </select>
                </div>
                <div class="form-group"><label>经度</label><input type="number" step="any" v-model="propertyForm.longitude" placeholder="如 116.4074" /></div>
              </div>
              <div class="form-group"><label>纬度</label><input type="number" step="any" v-model="propertyForm.latitude" placeholder="如 39.9042" /></div>
              <div class="form-group"><label>描述</label><textarea v-model="propertyForm.description" rows="3" placeholder="房源亮点、配套设施等..."></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showPropertyModal = false">取消</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 发布表单弹窗 -->
      <div v-if="showListingModal" class="modal-overlay" @click="showListingModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">{{ editingListing ? '编辑发布' : '发布房源' }}</div><button class="modal-close" @click="showListingModal = false">×</button></div>
          <form @submit.prevent="saveListing">
            <div class="modal-body">
              <div class="form-group"><label>房屋</label>
                <select v-model="listingForm.property_id" required :disabled="propertyLocked">
                  <option value="">请选择房屋</option>
                  <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.address }}</option>
                </select>
              </div>
              <div class="form-group"><label>标题</label><input v-model="listingForm.title" required placeholder="例如：阳光花园三居室" /></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>月租(元)</label><input type="number" v-model="listingForm.price" required /></div>
                <div class="form-group"><label>可租日期</label><input type="date" v-model="listingForm.available_from" /></div>
              </div>
              <div v-if="editingListing" class="form-group"><label>状态</label>
                <select v-model="listingForm.status">
                  <option value="available">可租</option><option value="rented">已租</option><option value="offline">已下架</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showListingModal = false">取消</button>
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
import { compressImage } from '../utils/image';

const auth = useAuthStore();
const tab = ref('properties');
const properties = ref([]);
const listings = ref([]);

const showPropertyModal = ref(false);
const showListingModal = ref(false);
const editingProperty = ref(null);
const editingListing = ref(null);
const propertyLocked = ref(false);

const propertyForm = ref({ address: '', area: '', rooms: '', type: 'apartment', description: '', images: [], latitude: '', longitude: '' });
const listingForm = ref({ property_id: '', title: '', price: '', available_from: '', status: 'available' });

async function fetch() {
  try {
    properties.value = await api.properties.list();
    const all = await api.listings.list('');
    listings.value = all.filter(l => l.landlord_id === auth.user?.id || auth.user?.role === 'agent');
  } catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);

// 房屋
function openNewProperty() {
  editingProperty.value = null;
  propertyForm.value = { address: '', area: '', rooms: '', type: 'apartment', description: '', images: [], latitude: '', longitude: '' };
  showPropertyModal.value = true;
}
function openEditProperty(p) {
  editingProperty.value = p;
  propertyForm.value = { ...p, images: p.images || [] };
  showPropertyModal.value = true;
}
async function handlePropertyFile(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (propertyForm.value.images.length >= 6) { showToast('最多上传6张图片', 'error'); break; }
    try {
      const compressed = await compressImage(file);
      const { url } = await api.upload(compressed);
      propertyForm.value.images.push(url);
    } catch (err) { showToast(err.message || '上传失败', 'error'); }
  }
  e.target.value = '';
}
function removeImage(idx) { propertyForm.value.images.splice(idx, 1); }
async function saveProperty() {
  try {
    const body = { ...propertyForm.value, area: parseFloat(propertyForm.value.area), rooms: parseInt(propertyForm.value.rooms) };
    if (editingProperty.value) { await api.properties.update(editingProperty.value.id, body); showToast('更新成功'); }
    else { await api.properties.create(body); showToast('新增成功'); }
    showPropertyModal.value = false; fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
async function handleDeleteProperty(id) {
  if (!confirm('删除房屋会同时删除其所有发布记录，确定删除？')) return;
  try { await api.properties.delete(id); showToast('删除成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

// 发布
function openNewListing() {
  editingListing.value = null;
  propertyLocked.value = false;
  listingForm.value = { property_id: '', title: '', price: '', available_from: '', status: 'available' };
  showListingModal.value = true;
}
function publishFromProperty(p) {
  editingListing.value = null;
  propertyLocked.value = true;
  listingForm.value = { property_id: p.id, title: p.address, price: '', available_from: '', status: 'available' };
  showListingModal.value = true;
}
function openEditListing(l) {
  editingListing.value = l;
  propertyLocked.value = true;
  listingForm.value = { property_id: l.property_id, title: l.title, price: l.price, available_from: l.available_from || '', status: l.status };
  showListingModal.value = true;
}
async function saveListing() {
  try {
    const body = { ...listingForm.value, price: parseFloat(listingForm.value.price) };
    if (editingListing.value) { await api.listings.update(editingListing.value.id, body); showToast('更新成功'); }
    else { await api.listings.create(body); showToast('发布成功'); }
    showListingModal.value = false; fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
async function toggleStatus(l) {
  const next = l.status === 'offline' ? 'available' : 'offline';
  try {
    await api.listings.update(l.id, { title: l.title, price: l.price, status: next, available_from: l.available_from });
    showToast(next === 'offline' ? '已下架' : '已上架'); fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
async function handleDeleteListing(id) {
  if (!confirm('确定删除此发布记录？')) return;
  try { await api.listings.delete(id); showToast('删除成功'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

function typeText(t) { return { apartment: '公寓', house: '住宅', villa: '别墅', studio: '单间' }[t] || t; }
function statusText(s) { return s === 'available' ? '可租' : s === 'rented' ? '已租' : '已下架'; }
</script>
