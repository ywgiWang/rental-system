import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function LeasesPage() {
  const { user, show } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ listing_id: '', tenant_id: '', start_date: '', end_date: '' });

  const fetch = async () => {
    try { const data = await api.leases.list(); setItems(data); }
    catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (user?.role !== 'tenant') {
      api.users.list('tenant').then(r => setUsers(r)).catch(() => {});
      api.listings.list('').then(r => setListings(r.filter(l => l.status === 'available'))).catch(() => {});
    }
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.leases.create(form); show('租约创建成功'); setShowModal(false); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  const handleTerminate = async (id) => {
    if (!confirm('确定终止此租约？房源将恢复为可租状态。')) return;
    try { await api.leases.update(id, { status: 'terminated' }); show('租约已终止'); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  const daysUntil = (end) => {
    const diff = Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 className="page-title">租期管理</h1>
        {user?.role !== 'tenant' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 创建租约</button>
        )}
      </div>
      <div className="table-container card">
        <table>
          <thead><tr><th>房源</th><th>租客</th><th>开始日期</th><th>结束日期</th><th>剩余天数</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {items.map(l => {
              const days = daysUntil(l.end_date);
              return (
                <tr key={l.id}>
                  <td>{l.listing_title}</td>
                  <td>{l.tenant_name}</td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td style={{color: days <= 7 && l.status === 'active' ? '#dc2626' : 'inherit', fontWeight: days <= 7 && l.status === 'active' ? 'bold' : 'normal'}}>
                    {l.status === 'active' ? `${days}天` : '-'}
                  </td>
                  <td><span className={`status status-${l.status}`}>{l.status === 'active' ? '生效中' : l.status === 'expired' ? '已到期' : '已终止'}</span></td>
                  <td>
                    {l.status === 'active' && user?.role !== 'tenant' && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleTerminate(l.id)}>终止</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">暂无租约</div>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">创建租约</div><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>房源</label>
                  <select value={form.listing_id} onChange={e => setForm({...form, listing_id: e.target.value})} required>
                    <option value="">请选择</option>
                    {listings.map(l => <option key={l.id} value={l.id}>{l.title} - {l.address}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>租客</label>
                  <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})} required>
                    <option value="">请选择</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>开始日期</label><input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
                  <div className="form-group"><label>结束日期</label><input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">创建</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
