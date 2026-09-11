import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref(null);
  const unreadCount = ref(0);

  const isLoggedIn = computed(() => !!token.value);
  const roleName = computed(() => {
    const r = user.value?.role;
    return r === 'landlord' ? '房东' : r === 'tenant' ? '租客' : r === 'agent' ? '中介' : '';
  });

  async function init() {
    if (!token.value) return;
    try {
      user.value = await api.auth.me();
    } catch {
      logout();
    }
  }

  async function login(username, password) {
    const data = await api.auth.login(username, password);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  async function fetchUnread() {
    if (!token.value) return;
    try {
      const data = await api.messages.unreadCount();
      unreadCount.value = data.count;
    } catch {}
  }

  return { token, user, unreadCount, isLoggedIn, roleName, init, login, logout, fetchUnread };
});
