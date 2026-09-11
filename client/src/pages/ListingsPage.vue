<template>
  <Layout>
    <div>
      <h1 class="page-title">找房源</h1>
      <form @submit.prevent="fetch" class="filters card">
        <div class="form-group" style="flex:2;min-width:48%">
          <input v-model="filters.keyword" placeholder="搜索标题或地址" />
        </div>
        <div class="form-group" style="flex:1;min-width:48%">
          <select v-model="filters.type">
            <option value="">全部类型</option>
            <option value="apartment">公寓</option>
            <option value="house">住宅</option>
            <option value="villa">别墅</option>
            <option value="studio">单间</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:48%">
          <input type="number" v-model="filters.minPrice" placeholder="最低价格" />
        </div>
        <div class="form-group" style="flex:1;min-width:48%">
          <input type="number" v-model="filters.maxPrice" placeholder="最高价格" />
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;min-width:100%">
          <button type="submit" class="btn btn-primary" style="width:100%">筛选房源</button>
        </div>
      </form>
      <div class="grid">
        <div v-for="l in listings" :key="l.id" class="listing-card" @click="$router.push(`/listings/${l.id}`)">
          <div class="listing-img">
            <img v-if="l.images?.length" :src="l.images[0]" alt="房源图片" />
            <span v-else>暂无图片</span>
          </div>
          <div class="listing-body">
            <div class="listing-title">{{ l.title }}</div>
            <div class="listing-price">¥{{ l.price }}/月</div>
            <div class="listing-meta">{{ l.address }} · {{ l.rooms }}室 · {{ l.area }}㎡</div>
            <div v-if="l.available_from" class="listing-meta" style="color:#2563eb">可租日期: {{ l.available_from }}</div>
            <div style="margin-top:8px">
              <span :class="['status', 'status-' + l.status]">{{ l.status === 'available' ? '可租' : l.status === 'rented' ? '已租' : '已下架' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="listings.length === 0" class="empty">暂无符合条件的房源</div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import Layout from '../components/Layout.vue';
import { showToast } from '../composables/useToast';

const listings = ref([]);
const filters = ref({ status: 'available', type: '', minPrice: '', maxPrice: '', keyword: '' });

async function fetch() {
  const q = new URLSearchParams(filters.value).toString();
  try { listings.value = await api.listings.list(q); }
  catch (e) { showToast(e.message, 'error'); }
}

onMounted(fetch);
</script>
