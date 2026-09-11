import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from './api';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ListingsPage from './pages/ListingsPage';
import ListingDetail from './pages/ListingDetail';
import MyListings from './pages/MyListings';
import ApplicationsPage from './pages/ApplicationsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import MessagesPage from './pages/MessagesPage';
import LeasesPage from './pages/LeasesPage';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

let toastId = 0;
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (message, type = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  return { toasts, show };
}

function Navbar({ user, logout, unreadCount }) {
  const location = useLocation();
  const role = user?.role;
  const isActive = (p) => location.pathname === p ? 'active' : '';

  const navItems = [
    { path: '/dashboard', label: '首页', icon: '\u{1F3E0}' },
    { path: '/listings', label: '找房', icon: '\u{1F50D}' },
    ...(role === 'landlord' || role === 'agent' ? [{ path: '/my-listings', label: '管理', icon: '\u{1F4CB}' }] : []),
    { path: '/messages', label: '消息', icon: '\u{1F4AC}', badge: unreadCount },
    { path: '/leases', label: '租约', icon: '\u{1F4D1}' },
  ];

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-brand">悦居租房</div>
        <div className="top-bar-user">{user?.name}</div>
      </div>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">悦居租房</div>
          <div className="navbar-nav">
            {navItems.map(item => (
              <Link key={item.path} to={item.path} className={isActive(item.path)} style={{position:'relative'}}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge > 0 && <span className="badge">{item.badge}</span>}
              </Link>
            ))}
            <button onClick={logout}><span>🚪</span><span>退出</span></button>
          </div>
        </div>
      </nav>
    </>
  );
}

function Layout({ children, user, logout, unreadCount }) {
  return (
    <>
      <Navbar user={user} logout={logout} unreadCount={unreadCount} />
      <div className="container page">{children}</div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toasts, show } = useToast();
  const nav = useNavigate();

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch { localStorage.removeItem('token'); }
    setLoading(false);
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => api.messages.unreadCount().then(r => setUnreadCount(r.count)).catch(() => {});
    fetchUnread();
    const iv = setInterval(fetchUnread, 10000);
    return () => clearInterval(iv);
  }, [user]);

  const login = async (username, password) => {
    const data = await api.auth.login(username, password);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    show('登录成功');
    nav('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    nav('/login');
  };

  if (loading) return <div className="auth-page"><div className="auth-box" style={{textAlign:'center'}}>加载中...</div></div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, show }}>
      <ToastContainer toasts={toasts} />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/*" element={
          user ? (
            <Layout user={user} logout={logout} unreadCount={unreadCount}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/listings/:id" element={<ListingDetail />} />
                <Route path="/my-listings" element={<MyListings />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/leases" element={<LeasesPage />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Layout>
          ) : <Navigate to="/login" />
        } />
      </Routes>
    </AuthContext.Provider>
  );
}
