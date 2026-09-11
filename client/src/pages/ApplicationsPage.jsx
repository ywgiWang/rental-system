import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function ApplicationsPage() {
  const { user, show } = useAuth();
  const [items, setItems] = useState([]);

  const fetch = async () => {
    try { const data = await api.applications.list(); setItems(data); }
    catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  const handleAction = async (id, status) => {
    try { await api.applications.update(id, { status }); show('操作成功'); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  return (
    <div>
      <h1 className="page-title">申请管理</h1>
      <div className="table-container card">
        <table>
          <thead><tr><th>房源</th><th>申请人</th><th>留言</th><th>状态</th><th>时间</th>{user?.role !== 'tenant' && <th>操作</th>}</tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td>{a.listing_title}</td>
                <td>{a.tenant_name}</td>
                <td>{a.message || '-'}</td>
                <td><span className={`status status-${a.status}`}>{a.status === 'pending' ? '待审核' : a.status === 'approved' ? '已通过' : '已拒绝'}</span></td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                {user?.role !== 'tenant' && (
                  <td>
                    {a.status === 'pending' && (
                      <>
                        <button className="btn btn-sm btn-success" onClick={() => handleAction(a.id, 'approved')}>通过</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => handleAction(a.id, 'rejected')}>拒绝</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">暂无申请记录</div>}
      </div>
    </div>
  );
}
