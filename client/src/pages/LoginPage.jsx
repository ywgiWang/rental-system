import { useState } from 'react';
import { useAuth } from '../App';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', role: 'tenant', name: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (isLogin) {
        await login(form.username, form.password);
      } else {
        const { api } = await import('../api');
        await api.auth.register(form);
        await login(form.username, form.password);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="auth-title">{isLogin ? '登录' : '注册'}</h1>
        {err && <div className="toast error" style={{marginBottom:12}}>{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          {!isLogin && (
            <>
              <div className="form-group">
                <label>角色</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="tenant">租客</option>
                  <option value="landlord">房东</option>
                  <option value="agent">中介</option>
                </select>
              </div>
              <div className="form-group">
                <label>姓名</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>手机号</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>邮箱</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" style={{width:'100%'}}>
            {isLogin ? '登录' : '注册'}
          </button>
        </form>
        <div className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <span onClick={() => setIsLogin(!isLogin)}>{isLogin ? '立即注册' : '去登录'}</span>
        </div>
        {isLogin && (
          <div style={{marginTop:16,fontSize:12,color:'#888',textAlign:'center'}}>
            演示账号：<br/>
            房东：landlord1 / 123456<br/>
            租客：tenant1 / 123456<br/>
            中介：agent1 / 123456
          </div>
        )}
      </div>
    </div>
  );
}
