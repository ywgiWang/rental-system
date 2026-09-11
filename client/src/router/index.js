import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', name: 'Login', component: () => import('../pages/LoginPage.vue'), meta: { public: true } },
  { path: '/dashboard', name: 'Dashboard', component: () => import('../pages/Dashboard.vue') },
  { path: '/listings', name: 'Listings', component: () => import('../pages/ListingsPage.vue') },
  { path: '/listings/:id', name: 'ListingDetail', component: () => import('../pages/ListingDetail.vue') },
  { path: '/my-listings', name: 'MyListings', component: () => import('../pages/MyListings.vue') },
  { path: '/applications', name: 'Applications', component: () => import('../pages/ApplicationsPage.vue') },
  { path: '/appointments', name: 'Appointments', component: () => import('../pages/AppointmentsPage.vue') },
  { path: '/messages', name: 'Messages', component: () => import('../pages/MessagesPage.vue') },
  { path: '/leases', name: 'Leases', component: () => import('../pages/LeasesPage.vue') },
  { path: '/', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.token) {
    next('/login');
  } else if (to.meta.public && auth.token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
