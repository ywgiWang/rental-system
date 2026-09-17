<template>
  <Layout>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h1 class="page-title">租期管理</h1>
        <button v-if="auth.user?.role !== 'tenant'" class="btn btn-primary" @click="openCreate()">+ 创建租约</button>
      </div>

      <div v-if="auth.user?.role !== 'tenant'" class="card" style="padding:12px;margin-bottom:12px">
        <div style="display:flex;gap:8px;align-items:center">
          <input type="month" v-model="genPeriod" style="flex:1" />
          <button class="btn btn-sm btn-primary" @click="generateBills">生成该月账单</button>
        </div>
      </div>

      <div v-for="l in items" :key="l.id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div class="list-title">{{ l.listing_title }}</div>
            <div class="list-sub">租客：{{ l.tenant_name }}</div>
            <div class="list-sub">租金：¥{{ l.rent }}/月<span v-if="l.deposit"> · 押金 ¥{{ l.deposit }}</span></div>
            <div v-if="l.unpaid_total > 0" class="list-sub" style="color:#dc2626;font-weight:600">待缴 ¥{{ l.unpaid_total }}</div>
            <div class="list-sub">{{ l.start_date }} 至 {{ l.end_date }}</div>
            <div v-if="l.contract_files?.length" style="margin-top:6px">
              <a v-for="(f, i) in l.contract_files" :key="i" :href="f" target="_blank" class="list-sub" style="color:#2563eb;margin-right:10px">合同附件{{ i + 1 }}</a>
            </div>
          </div>
          <span :class="['status', 'status-' + l.status]">{{ statusText(l.status) }}</span>
        </div>
        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
          <span class="list-sub" :style="daysStyle(l)">{{ daysLeft(l) }}</span>
          <div style="display:flex;gap:8px">
            <button v-if="auth.user?.role !== 'tenant'" class="btn btn-sm btn-secondary" @click="openBills(l)">记账</button>
            <button v-if="l.status === 'active' && auth.user?.role !== 'tenant'" class="btn btn-sm btn-danger" @click="handleTerminate(l.id)">终止</button>
          </div>
        </div>
      </div>
      <div v-if="items.length === 0" class="empty">暂无租约</div>

      <!-- 创建租约弹窗 -->
      <div v-if="showModal" class="modal-overlay" @click="showModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">创建租约</div><button class="modal-close" @click="showModal = false">×</button></div>
          <form @submit.prevent="handleCreate">
            <div class="modal-body">
              <div class="form-group">
                <label>房屋</label>
                <select v-model="form.property_id" required @change="onPropertyChange">
                  <option value="">请选择房屋</option>
                  <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.address }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>关联发布（可选）</label>
                <select v-model="form.listing_id">
                  <option value="">不关联</option>
                  <option v-for="l in propertyListings" :key="l.id" :value="l.id">{{ l.title }}</option>
                </select>
              </div>
              <div class="form-group" v-if="form.listing_id">
                <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#555">
                  <input type="checkbox" v-model="form.mark_listing_rented" /> 同时将该发布标记为已出租
                </label>
              </div>
              <div class="form-group">
                <label>租客</label>
                <input v-model="tenantSearch" type="text" placeholder="搜索姓名/用户名/手机号" />
                <div class="picker-list">
                  <button type="button" v-for="u in filteredUsers" :key="u.id" class="picker-item" :class="{ selected: form.tenant_id === u.id }" @click="selectTenant(u)">{{ u.name }}（{{ u.phone || u.username }}）</button>
                  <div v-if="filteredUsers.length === 0" class="empty" style="padding:12px">无匹配租客</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>月租金(元)</label><input type="number" v-model="form.rent" required /></div>
                <div class="form-group"><label>押金(元)</label><input type="number" v-model="form.deposit" /></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>开始日期</label><input type="date" v-model="form.start_date" required /></div>
                <div class="form-group"><label>结束日期</label><input type="date" v-model="form.end_date" required /></div>
              </div>
              <div class="form-group">
                <label>合同扫描件（图片）</label>
                <div class="image-upload">
                  <div v-for="(f, i) in form.contract_files" :key="i" class="image-upload-item">
                    <img :src="f" alt="" />
                    <button type="button" class="remove" @click="removeContract(i)">×</button>
                  </div>
                  <div v-if="form.contract_files.length < 5" class="image-upload-placeholder" @click="$refs.contractFile.click()">+</div>
                </div>
                <input ref="contractFile" type="file" accept="image/*" multiple style="display:none" @change="handleContractFile" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
              <button type="submit" class="btn btn-primary">创建</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 记账弹窗 -->
      <div v-if="billsModal" class="modal-overlay" @click="closeBills">
        <div class="modal" @click.stop>
          <div class="modal-header"><div class="modal-title">记账{{ billsLease ? ' - ' + billsLease.listing_title : '' }}</div><button class="modal-close" @click="closeBills">×</button></div>
          <div class="modal-body">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
              <input type="month" v-model="billPeriod" style="flex:1" @change="loadBills" />
            </div>
            <div v-for="b in bills" :key="b.id" class="card" style="padding:10px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:600;font-size:14px">{{ billTypeText(b.type) }}</span>
                <button v-if="auth.user?.role !== 'tenant'" class="btn btn-sm btn-danger" :disabled="b.status === 'paid'" @click="removeBill(b)">删除</button>
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                <input type="number" v-model.number="b.amount" placeholder="金额" style="flex:1" :disabled="b.status === 'paid' || auth.user?.role === 'tenant'" @change="saveBill(b)" />
                <button v-if="auth.user?.role !== 'tenant'" :class="['btn btn-sm', b.status === 'paid' ? 'btn-secondary' : 'btn-success']" @click="togglePaid(b)">{{ b.status === 'paid' ? '取消已缴' : '标记已缴' }}</button>
              </div>
              <input v-model="b.note" placeholder="备注" style="margin-top:6px" :disabled="b.status === 'paid' || auth.user?.role === 'tenant'" @change="saveBill(b)" />
            </div>
            <div v-if="bills.length === 0" class="empty">该月暂无账单</div>
            <div v-if="auth.user?.role !== 'tenant'" style="display:flex;gap:8px;margin-top:10px">
              <select v-model="newBill.type" style="flex:1">
                <option value="water">水费</option><option value="electric">电费</option><option value="gas">燃气</option><option value="property">物业</option><option value="internet">宽带</option><option value="other">杂费</option>
              </select>
              <input type="number" v-model="newBill.amount" placeholder="金额" style="width:90px" />
              <button class="btn btn-sm btn-primary" @click="addBillRow">添加</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';
import { compressImage } from '../utils/image';

const auth = useAuthStore();
const route = useRoute();
const items = ref([]);
const users = ref([]);
const properties = ref([]);
const listings = ref([]);
const showModal = ref(false);
const tenantSearch = ref('');
const form = ref({ property_id: '', listing_id: '', tenant_id: '', rent: '', deposit: '', start_date: '', end_date: '', contract_files: [], mark_listing_rented: true });

const billsModal = ref(false);
const billsLease = ref(null);
const bills = ref([]);
const billPeriod = ref(currentMonth());
const genPeriod = ref(currentMonth());
const newBill = ref({ type: 'other', amount: '', note: '' });

const filteredUsers = computed(() => {
  const kw = tenantSearch.value.trim().toLowerCase();
  if (!kw) return users.value;
  return users.value.filter(u =>
    (u.name || '').toLowerCase().includes(kw) ||
    (u.username || '').toLowerCase().includes(kw) ||
    (u.phone || '').includes(kw)
  );
});
const propertyListings = computed(() => {
  if (!form.value.property_id) return [];
  return listings.value.filter(l => l.property_id === Number(form.value.property_id));
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function fetch() {
  try { items.value = await api.leases.list(); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(async () => {
  fetch();
  if (auth.user?.role !== 'tenant') {
    try {
      users.value = await api.users.list('tenant');
      properties.value = await api.properties.list();
      listings.value = await api.listings.list('');
    } catch {}
  }
  const pid = route.query.property_id;
  const lid = route.query.listing_id;
  const tid = route.query.tenant_id;
  if (pid && tid) {
    form.value.property_id = Number(pid);
    form.value.listing_id = lid ? Number(lid) : '';
    form.value.tenant_id = Number(tid);
    const tenant = users.value.find(u => u.id === Number(tid));
    if (tenant) tenantSearch.value = tenant.name;
    showModal.value = true;
  }
});

function openCreate() {
  form.value = { property_id: '', listing_id: '', tenant_id: '', rent: '', deposit: '', start_date: '', end_date: '', contract_files: [], mark_listing_rented: true };
  tenantSearch.value = '';
  showModal.value = true;
}
function onPropertyChange() { form.value.listing_id = ''; }
function selectTenant(u) { form.value.tenant_id = u.id; tenantSearch.value = u.name; }
async function handleContractFile(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (form.value.contract_files.length >= 5) { showToast('最多上传5张', 'error'); break; }
    try {
      const compressed = await compressImage(file);
      const { url } = await api.upload(compressed);
      form.value.contract_files.push(url);
    } catch (err) { showToast(err.message || '上传失败', 'error'); }
  }
  e.target.value = '';
}
function removeContract(i) { form.value.contract_files.splice(i, 1); }
async function handleCreate() {
  try {
    const body = {
      ...form.value,
      rent: parseFloat(form.value.rent),
      deposit: form.value.deposit ? parseFloat(form.value.deposit) : null,
      listing_id: form.value.listing_id || null,
    };
    await api.leases.create(body);
    showToast('租约创建成功'); showModal.value = false; fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
async function handleTerminate(id) {
  if (!confirm('确定终止此租约？')) return;
  try { await api.leases.update(id, { status: 'terminated' }); showToast('租约已终止'); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}

// 记账
function openBills(l) {
  billsLease.value = l;
  billPeriod.value = currentMonth();
  bills.value = [];
  billsModal.value = true;
  loadBills();
}
function closeBills() { billsModal.value = false; }
async function loadBills() {
  if (!billsLease.value) return;
  try { bills.value = await api.bills.list(billsLease.value.id, billPeriod.value); }
  catch (e) { showToast(e.message, 'error'); }
}
async function saveBill(b) {
  try {
    await api.bills.update(b.id, { amount: b.amount === '' || b.amount == null ? null : parseFloat(b.amount), note: b.note || null });
    showToast('已保存'); fetch();
  } catch (e) { showToast(e.message, 'error'); loadBills(); }
}
async function togglePaid(b) {
  const next = b.status === 'paid' ? 'unpaid' : 'paid';
  if (next === 'paid' && (b.amount === '' || b.amount == null)) { showToast('请先填写金额', 'error'); return; }
  try { await api.bills.update(b.id, { status: next }); showToast(next === 'paid' ? '已标记为已缴' : '已标记为未缴'); loadBills(); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function removeBill(b) {
  try { await api.bills.delete(b.id); showToast('已删除'); loadBills(); fetch(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function addBillRow() {
  if (newBill.value.amount === '' || newBill.value.amount == null) { showToast('请填写金额', 'error'); return; }
  try {
    await api.bills.create(billsLease.value.id, { period: billPeriod.value, type: newBill.value.type, amount: parseFloat(newBill.value.amount), note: newBill.value.note || null });
    newBill.value = { type: 'other', amount: '', note: '' };
    showToast('已添加'); loadBills(); fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
async function generateBills() {
  try {
    const r = await api.bills.generate(genPeriod.value);
    showToast(`已为 ${r.leases} 个租约生成 ${r.inserted} 条账单`); fetch();
  } catch (e) { showToast(e.message, 'error'); }
}
function billTypeText(t) { return { water: '水费', electric: '电费', gas: '燃气', property: '物业', internet: '宽带', other: '杂费' }[t] || t; }

function daysLeft(l) {
  if (l.status !== 'active') return '-';
  const diff = Math.ceil((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24));
  return '剩余 ' + diff + ' 天';
}
function daysStyle(l) {
  if (l.status !== 'active') return {};
  const diff = Math.ceil((new Date(l.end_date) - new Date()) / (1000 * 60 * 60 * 24));
  return diff <= 7 ? { color: '#dc2626', fontWeight: 'bold' } : {};
}
function statusText(s) { return s === 'active' ? '生效中' : s === 'expired' ? '已到期' : '已终止'; }
</script>
