import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function MessagesPage() {
  const { show } = useAuth();
  const [items, setItems] = useState([]);

  const fetch = async () => {
    try { const data = await api.messages.list(); setItems(data); }
    catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  const handleRead = async (id) => {
    try { await api.messages.read(id); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  const handleReadAll = async () => {
    try { await api.messages.readAll(); fetch(); show('已全部标记已读'); }
    catch (e) { show(e.message, 'error'); }
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 className="page-title">消息中心</h1>
        <button className="btn btn-secondary" onClick={handleReadAll}>全部已读</button>
      </div>
      <div className="card" style={{padding:0}}>
        {items.map(m => (
          <div key={m.id} className={`message-item ${m.is_read ? '' : 'unread'}`} onClick={() => !m.is_read && handleRead(m.id)}>
            <div className="message-content">
              <strong>{m.sender_name || '系统'}</strong>：{m.content}
            </div>
            <div className="message-time">{new Date(m.created_at).toLocaleString()}</div>
          </div>
        ))}
        {items.length === 0 && <div className="empty">暂无消息</div>}
      </div>
    </div>
  );
}
