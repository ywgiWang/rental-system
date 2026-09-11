<template>
  <div class="auth-page">
    <div class="auth-box">
      <h1 class="auth-title">{{ isLogin ? '登录' : '注册' }}</h1>
      <div v-if="err" class="toast error" style="margin-bottom:12px">{{ err }}</div>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="form.username" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" v-model="form.password" required />
        </div>
        <template v-if="!isLogin">
          <div class="form-group">
            <label>角色</label>
            <select v-model="form.role">
              <option value="tenant">租客</option>
              <option value="landlord">房东</option>
              <option value="agent">中介</option>
            </select>
          </div>
          <div class="form-group">
            <label>姓名</label>
            <input v-model="form.name" required />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input v-model="form.phone" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="form.email" />
          </div>
        </template>
        <button type="submit" class="btn btn-primary" style="width:100%">{{ isLogin ? '登录' : '注册' }}</button>
      </form>
      <div class="auth-switch">
        {{ isLogin ? '还没有账号？' : '已有账号？' }}
        <span @click="isLogin = !isLogin">{{ isLogin ? '立即注册' : '去登录' }}</span>
      </div>
      <div v-if="isLogin" style="margin-top:16px;font-size:12px;color:#888;text-align:center">
        演示账号：<br>
        房东：landlord1 / 123456<br>
        租客：tenant1 / 123456<br>
        中介：agent1 / 123456
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';
import { showToast } from '../composables/useToast';

const router = useRouter();
const auth = useAuthStore();
const isLogin = ref(true);
const err = ref('');
const form = ref({ username: '', password: '', role: 'tenant', name: '', phone: '', email: '' });

async function handleSubmit() {
  err.value = '';
  try {
    if (isLogin.value) {
      await auth.login(form.value.username, form.value.password);
      showToast('登录成功');
    } else {
      await api.auth.register(form.value);
      await auth.login(form.value.username, form.value.password);
      showToast('注册成功');
    }
    router.push('/dashboard');
  } catch (e) {
    err.value = e.message;
  }
}
</script>
