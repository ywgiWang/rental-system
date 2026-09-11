import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ status: 'available', type: '', minPrice: '', maxPrice: '', keyword: '' });
  const { show } = useAuth();
  const nav = useNavigate();

  const fetch = async () => {
    const q = new URLSearchParams(filters).toString();
    try {
      const data = await api.listings.list(q);
      setListings(data);
    } catch (e) { show(e.message, 'error'); }
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetch(); };

  return (
    <div>
      <h1 className="page-title">找房源</h1>
      <form onSubmit={handleSearch} className="filters card">
        <div className="form-group" style={{flex:2,minWidth:'48%'}}>
          <input placeholder="搜索标题或地址" value={filters.keyword} onChange={e => setFilters({...filters, keyword: e.target.value})} />
        </div>
        <div className="form-group" style={{flex:1,minWidth:'48%'}}>
          <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
            <option value="">全部类型</option>
            <option value="apartment">公寓</option>
            <option value="house">住宅</option>
            <option value="villa">别墅</option>
            <option value="studio">单间</option>
          </select>
        </div>
        <div className="form-group" style={{flex:1,minWidth:'48%'}}>
          <input type="number" placeholder="最低价格" value={filters.minPrice} onChange={e => setFilters({...filters, minPrice: e.target.value})} />
        </div>
        <div className="form-group" style={{flex:1,minWidth:'48%'}}>
          <input type="number" placeholder="最高价格" value={filters.maxPrice} onChange={e => setFilters({...filters, maxPrice: e.target.value})} />
        </div>
        <div className="form-group" style={{display:'flex',alignItems:'flex-end',minWidth:'100%'}}>
          <button type="submit" className="btn btn-primary" style={{width:'100%'}}>筛选房源</button>
        </div>
      </form>
      <div className="grid grid-3">
        {listings.map(l => {
          const images = JSON.parse(l.images || '[]');
          return (
            <div className="listing-card" key={l.id} onClick={() => nav(`/listings/${l.id}`)}>
              <div className="listing-img">
                {images.length > 0 ? <img src={images[0]} alt="房源图片" /> : '暂无图片'}
              </div>
              <div className="listing-body">
                <div className="listing-title">{l.title}</div>
                <div className="listing-price">¥{l.price}/月</div>
                <div className="listing-meta">{l.address} · {l.rooms}室 · {l.area}㎡</div>
                {l.available_from && (
                  <div className="listing-meta" style={{color:'#2563eb'}}>可租日期: {l.available_from}</div>
                )}
                <div style={{marginTop:8}}>
                  <span className={`status status-${l.status}`}>{l.status === 'available' ? '可租' : l.status === 'rented' ? '已租' : '已下架'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {listings.length === 0 && <div className="empty">暂无符合条件的房源</div>}
    </div>
  );
}
