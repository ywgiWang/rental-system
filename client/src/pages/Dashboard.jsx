import { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { api } from '../api';

export default function Dashboard() {
  const { user, show } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard().then(r => { setStats(r); setLoading(false); })
      .catch(e => { show(e.message, 'error'); setLoading(false); });
  }, []);

  if (loading) return <div>加载中...</div>;

  const cards = user?.role === 'tenant' ? [
    { label: '我的申请', value: stats.myApplications || 0 },
    { label: '我的预约', value: stats.myAppointments || 0 },
    { label: '当前租约', value: stats.myLeases || 0 },
    { label: '未读消息', value: stats.unreadMessages || 0 },
  ] : [
    { label: '我的房源', value: stats.myListings || 0 },
    { label: '待处理申请', value: stats.pendingApplications || 0 },
    { label: '待确认预约', value: stats.pendingAppointments || 0 },
    { label: '在租租约', value: stats.activeLeases || 0 },
  ];

  return (
    <div>
      <h1 className="page-title">工作台</h1>
      <div className="grid grid-4">
        {cards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{marginTop:24}}>
        <div className="card-title">欢迎使用悦居租房</div>
        <p>您当前以「{user?.role === 'landlord' ? '房东' : user?.role === 'tenant' ? '租客' : '中介'}」身份登录。</p>
        <p style={{marginTop:8}}>通过顶部导航可以访问各个功能模块。</p>
      </div>
    </div>
  );
}
