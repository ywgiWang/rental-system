import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function AppointmentsPage() {
  const { user, show } = useAuth();
  const [items, setItems] = useState([]);

  const fetch = async () => {
    try { const data = await api.appointments.list(); setItems(data); }
    catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  const handleAction = async (id, status) => {
    try { await api.appointments.update(id, { status }); show('操作成功'); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  return (
    <div>
      <h1 className="page-title">预约看房</h1>
      <div className="table-container card">
        <table>
          <thead><tr><th>房源</th><th>预约人</th><th>预约时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td>{a.listing_title}</td>
                <td>{a.tenant_name}</td>
                <td>{new Date(a.appointment_date).toLocaleString()}</td>
                <td><span className={`status status-${a.status}`}>{a.status === 'pending' ? '待确认' : a.status === 'confirmed' ? '已确认' : a.status === 'cancelled' ? '已取消' : '已完成'}</span></td>
                <td>
                  {user?.role !== 'tenant' && a.status === 'pending' && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => handleAction(a.id, 'confirmed')}>确认</button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => handleAction(a.id, 'cancelled')}>取消</button>
                    </>
                  )}
                  {user?.role !== 'tenant' && a.status === 'confirmed' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleAction(a.id, 'completed')}>完成</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">暂无预约记录</div>}
      </div>
    </div>
  );
}
