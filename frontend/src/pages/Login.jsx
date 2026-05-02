import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Eye, EyeOff, Moon, Sun, ShieldCheck, Utensils, User, QrCode, Zap } from 'lucide-react';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';

const FloatingOrb = ({ style }) => (
  <div aria-hidden style={{
    position: 'absolute', borderRadius: '50%',
    filter: 'blur(70px)', pointerEvents: 'none', ...style
  }} />
);

export default function Login({ setRole }) {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  const { dark, setDark } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      setRole(data.role);
      navigate(data.role === 'Admin' ? '/admin' : '/volunteer');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { icon: <ShieldCheck size={15} />, label: 'Admin',     color: '#818cf8', bg: 'rgba(99,102,241,0.12)'  },
    { icon: <User       size={15} />, label: 'Entry',     color: '#34d399', bg: 'rgba(16,185,129,0.12)'  },
    { icon: <Utensils   size={15} />, label: 'Food',      color: '#fbbf24', bg: 'rgba(245,158,11,0.12)'  },
  ];

  const pageBg = dark
    ? '#000000'
    : 'radial-gradient(ellipse 90% 70% at 20% 10%, #dde4ff 0%, #f8fafc 65%)';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden', background: pageBg }}>

      {/* Floating orbs */}
      <FloatingOrb style={{ top: '-8%', right: '-8%', width: 440, height: 440, background: dark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)' }} />
      <FloatingOrb style={{ bottom: '-12%', left: '-10%', width: 380, height: 380, background: dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.12)' }} />
      <FloatingOrb style={{ top: '40%', right: '5%', width: 200, height: 200, background: dark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.1)' }} />

      {/* Theme Toggle */}
      <button onClick={() => setDark(!dark)} className="btn-icon" style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }} aria-label="Toggle theme">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* ── Hero ── */}
      <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {/* Logo */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.25rem' }}>
          <div className="animate-float" style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.2)',
            position: 'relative', zIndex: 1
          }}>
            <ScanLine size={38} color="#fff" strokeWidth={1.8} />
          </div>
          {/* Pulse rings */}
          <div style={{ position: 'absolute', inset: -6, borderRadius: 30, border: '2px solid rgba(99,102,241,0.3)', animation: 'pulse-ring 2.4s ease-out infinite' }} />
          <div style={{ position: 'absolute', inset: -6, borderRadius: 30, border: '2px solid rgba(99,102,241,0.15)', animation: 'pulse-ring 2.4s ease-out 0.8s infinite' }} />
          {/* Zap badge */}
          <div style={{
            position: 'absolute', bottom: -6, right: -6,
            width: 24, height: 24, borderRadius: 8,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(245,158,11,0.5)', zIndex: 2
          }}>
            <Zap size={13} color="#fff" fill="#fff" />
          </div>
        </div>

        <h1 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.375rem', letterSpacing: '-0.02em' }}>
          Event QR Portal
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
          Dual-Stage Entry &amp; Food Management
        </p>
      </div>

      {/* ── Login Card ── */}
      <div className="card-glass animate-slide-up" style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--surface-2)', borderRadius: 14, padding: '0.375rem', border: '1px solid var(--border)' }}>
          {roles.map(r => (
            <div key={r.label} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', padding: '0.5rem 0.25rem', borderRadius: 10,
              fontSize: '0.75rem', fontWeight: 700, color: r.color,
              background: r.bg, border: `1px solid ${r.color}22`,
            }}>
              {r.icon} {r.label}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="animate-pop-in" style={{
            background: 'var(--red-light)', color: 'var(--red)',
            border: '1px solid', borderColor: 'var(--red)', borderRadius: 10,
            padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {/* Username */}
          <div>
            <label className="input-label" htmlFor="login-user">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-user"
                className="input"
                type="text"
                placeholder="your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onFocus={() => setFocusedField('user')}
                onBlur={() => setFocusedField(null)}
                required autoComplete="username" disabled={loading}
                style={{ paddingLeft: '2.75rem' }}
              />
              <User size={16} style={{
                position: 'absolute', left: '0.875rem', top: '50%',
                transform: 'translateY(-50%)',
                color: focusedField === 'user' ? 'var(--brand)' : 'var(--text-muted)',
                transition: 'color 0.2s'
              }} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="input-label" htmlFor="login-pass">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-pass"
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('pass')}
                onBlur={() => setFocusedField(null)}
                required autoComplete="current-password" disabled={loading}
                style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }}
              />
              <ShieldCheck size={16} style={{
                position: 'absolute', left: '0.875rem', top: '50%',
                transform: 'translateY(-50%)',
                color: focusedField === 'pass' ? 'var(--brand)' : 'var(--text-muted)',
                transition: 'color 0.2s'
              }} />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{
                position: 'absolute', right: '0.875rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0
              }}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.25rem', padding: '0.9rem', fontSize: '1rem', borderRadius: '0.875rem' }}
          >
            {loading ? (
              <>
                <span style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" />
                Signing in…
              </>
            ) : <>Sign In &nbsp;→</>}
          </button>
        </form>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.25rem', fontWeight: 500 }}>
          🔒 Secure role-based authentication
        </p>
      </div>

      {/* Watermark */}
      <div className="watermark">Designed by SAMEER LOHANI &amp; VARUN DOBHAL</div>
    </div>
  );
}
