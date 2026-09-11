import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function MyListings() {
  const { user, show } = useAuth();
  const [listings, setListings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', address: '', area: '', price: '', rooms: '', type: 'apartment', status: 'available', images: [], available_from: '' });
  const fileInputRef = useRef(null);

  const fetch = async () => {
    try {
      const all = await api.listings.list('');
      setListings(all.filter(l => l.landlord_id === user?.id || user?.role === 'agent'));
    } catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setForm({ title: '', description: '', address: '', area: '', price: '', rooms: '', type: 'apartment', status: 'available', images: [], available_from: '' }); setShowModal(true); };
  const openEdit = (l) => {
    const imgs = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || []);
    setEditing(l);
    setForm({ title: l.title, description: l.description || '', address: l.address, area: l.area || '', price: l.price || '', rooms: l.rooms || '', type: l.type, status: l.status, images: imgs, available_from: l.available_from || '' });
    setShowModal(true);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    files.forEach(file => {
      if (form.images.length >= 6) { show('最多上传6张图片', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm(prev => ({ ...prev, images: [...prev.images, ev.target.result] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, area: parseFloat(form.area), price: parseFloat(form.price), rooms: parseInt(form.rooms) };
      if (editing) { await api.listings.update(editing.id, body); show('更新成功'); }
      else { await api.listings.create(body); show('发布成功'); }
      setShowModal(false); fetch();
    } catch (e) { show(e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此房源？')) return;
    try { await api.listings.delete(id); show('删除成功'); fetch(); }
    catch (e) { show(e.message, 'error'); }
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h1 className="page-title">房源管理</h1>
        <button className="btn btn-primary" onClick={openNew}>+ 发布</button>
      </div>
      <div className="grid grid-3">
        {listings.map(l => {
          const imgs = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || []);
          return (
            <div className="listing-card" key={l.id}>
              <div className="listing-img">
                {imgs.length > 0 ? <img src={imgs[0]} alt="房源图片" /> : '暂无图片'}
              </div>
              <div className="listing-body">
                <div className="listing-title">{l.title}</div>
                <div className="listing-price">¥{l.price}/月</div>
                <div className="listing-meta">{l.address}</div>
                {l.available_from && <div className="listing-meta" style={{color:'#2563eb'}}>可租: {l.available_from}</div>}
                <div style={{marginTop:8,display:'flex',gap:6}}>
                  <span className={`status status-${l.status}`}>{l.status === 'available' ? '可租' : l.status === 'rented' ? '已租' : '已下架'}</span>
                </div>
                <div style={{marginTop:10,display:'flex',gap:8}}>
                  <button className="btn btn-sm btn-secondary" style={{flex:1}} onClick={() => openEdit(l)}>编辑</button>
                  <button className="btn btn-sm btn-danger" style={{flex:1}} onClick={() => handleDelete(l.id)}>删除</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {listings.length === 0 && <div className="empty">暂无房源</div>}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">{editing ? '编辑房源' : '发布房源'}</div><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>房源照片</label>
                  <div className="image-upload">
                    {form.images.map((img, i) => (
                      <div className="image-upload-item" key={i}>
                        <img src={img} alt="" />
                        <button type="button" className="remove" onClick={() => removeImage(i)}>×</button>
                      </div>
                    ))}
                    {form.images.length < 6 && (
                      <div className="image-upload-placeholder" onClick={() => fileInputRef.current?.click()}>+</div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFileChange} />
                </div>
                <div className="form-group"><label>标题</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="例如：阳光花园三居室" /></div>
                <div className="form-group"><label>地址</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} required placeholder="详细地址" /></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div className="form-group"><label>面积(㎡)</label><input type="number" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required /></div>
                  <div className="form-group"><label>月租(元)</label><input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div className="form-group"><label>房间数</label><input type="number" value={form.rooms} onChange={e => setForm({...form, rooms: e.target.value})} required /></div>
                  <div className="form-group"><label>类型</label>
                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="apartment">公寓</option><option value="house">住宅</option><option value="villa">别墅</option><option value="studio">单间</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>可租日期</label><input type="date" value={form.available_from} onChange={e => setForm({...form, available_from: e.target.value})} /></div>
                {editing && (
                  <div className="form-group"><label>状态</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="available">可租</option><option value="rented">已租</option><option value="offline">已下架</option>
                    </select>
                  </div>
                )}
                <div className="form-group"><label>描述</label><textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="房源亮点、配套设施等..." /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
