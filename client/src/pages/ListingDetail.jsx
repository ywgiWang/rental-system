import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [bookDate, setBookDate] = useState('');
  const { user, show } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api.listings.get(id).then(r => setListing(r)).catch(e => show(e.message, 'error'));
  }, [id]);

  const handleApply = async () => {
    try { await api.applications.create({ listing_id: id, message: applyMsg }); show('申请已提交'); setShowApply(false); }
    catch (e) { show(e.message, 'error'); }
  };

  const handleBook = async () => {
    try { await api.appointments.create({ listing_id: id, appointment_date: bookDate }); show('预约已提交'); setShowBook(false); }
    catch (e) { show(e.message, 'error'); }
  };

  if (!listing) return <div>加载中...</div>;
  const images = listing.images || [];

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={() => nav('/listings')} style={{marginBottom:12}}>← 返回</button>

      <div className="detail-gallery">
        {images.length > 0 ? <img src={images[0]} alt="房源图片" /> : '暂无图片'}
      </div>
      {images.length > 1 && (
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto'}}>
          {images.map((img, i) => (
            <img key={i} src={img} style={{width:80,height:80,objectFit:'cover',borderRadius:8,flexShrink:0}} alt="" />
          ))}
        </div>
      )}

      <h2 style={{marginBottom:8,fontSize:18}}>{listing.title}</h2>
      <div className="detail-price">¥{listing.price}/月</div>

      <div className="card" style={{marginBottom:16}}>
        <div className="detail-info-row"><span className="label">地址</span><span className="value">{listing.address}</span></div>
        <div className="detail-info-row"><span className="label">面积</span><span className="value">{listing.area}㎡</span></div>
        <div className="detail-info-row"><span className="label">户型</span><span className="value">{listing.rooms}室</span></div>
        <div className="detail-info-row"><span className="label">类型</span><span className="value">{listing.type === 'apartment' ? '公寓' : listing.type === 'house' ? '住宅' : listing.type === 'villa' ? '别墅' : '单间'}</span></div>
        <div className="detail-info-row"><span className="label">状态</span><span className="value"><span className={`status status-${listing.status}`}>{listing.status === 'available' ? '可租' : listing.status === 'rented' ? '已租' : '已下架'}</span></span></div>
        {listing.available_from && (
          <div className="detail-info-row"><span className="label">可租日期</span><span className="value" style={{color:'#2563eb'}}>{listing.available_from}</span></div>
        )}
        <div className="detail-info-row"><span className="label">房东</span><span className="value">{listing.landlord_name}</span></div>
      </div>

      <div className="card" style={{marginBottom:80}}>
        <div className="card-title">房源描述</div>
        <p style={{color:'#555',fontSize:14,lineHeight:1.7}}>{listing.description || '暂无描述'}</p>
      </div>

      {user?.role === 'tenant' && listing.status === 'available' && (
        <div className="detail-actions">
          <button className="btn btn-primary" onClick={() => setShowApply(true)}>申请租房</button>
          <button className="btn btn-success" onClick={() => setShowBook(true)}>预约看房</button>
        </div>
      )}

      {showApply && (
        <div className="modal-overlay" onClick={() => setShowApply(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">申请租房</div><button className="modal-close" onClick={() => setShowApply(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label>申请留言</label><textarea rows={3} value={applyMsg} onChange={e => setApplyMsg(e.target.value)} placeholder="请简单介绍您的情况..." /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApply(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleApply}>提交申请</button>
            </div>
          </div>
        </div>
      )}

      {showBook && (
        <div className="modal-overlay" onClick={() => setShowBook(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">预约看房</div><button className="modal-close" onClick={() => setShowBook(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label>预约时间</label><input type="datetime-local" value={bookDate} onChange={e => setBookDate(e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBook(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBook}>提交预约</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
