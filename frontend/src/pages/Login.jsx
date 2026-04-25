import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, ShieldCheck, ScanLine, Users } from 'lucide-react';
import api from '../utils/api';

export default function Login({ setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      setRole(data.role);
      if (data.role === 'Admin') navigate('/admin');
      else navigate('/volunteer');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dynamic">

      {/* Top decorative gradient strip */}
      <div className="h-2 w-full bg-gradient-to-r from-brand-400 via-emerald-400 to-teal-500" />

      <div className="flex-1 flex flex-col items-center justify-center p-5">

        {/* Hero icon */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500 to-emerald-500 flex items-center justify-center shadow-2xl shadow-brand-500/40">
              <ScanLine size={44} className="text-white" />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-3xl border-4 border-brand-400/40 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Event QR Portal</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Secure Entry Management System</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-white/60 p-7 space-y-5">

            {/* Role Pill Tabs (visual only) */}
            <div className="flex gap-2 bg-slate-100 rounded-2xl p-1.5">
              <div className="flex-1 flex items-center justify-center gap-2 bg-white rounded-xl py-2.5 shadow-sm text-brand-600 font-semibold text-sm">
                <ShieldCheck size={15} /> Admin
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 bg-white rounded-xl py-2.5 shadow-sm text-emerald-600 font-semibold text-sm">
                <Users size={15} /> Volunteer
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 font-medium -mt-1">Login works for both roles</p>

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-sm font-medium flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-2 duration-300">
                <span className="text-base">⚠️</span> {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all duration-200 text-slate-800 font-medium text-base placeholder:text-slate-300"
                  placeholder="your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Password with show/hide */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3.5 pr-12 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-all duration-200 text-slate-800 font-medium text-base placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 flex items-center justify-center gap-2.5 bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-600 hover:to-emerald-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-brand-500/30 transition-all duration-300 transform active:scale-95 disabled:opacity-70 disabled:active:scale-100 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In Securely
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer badges */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-400">
            <span className="flex items-center gap-1">🔒 JWT Secured</span>
            <span>•</span>
            <span className="flex items-center gap-1">⚡ Real-time Scan</span>
            <span>•</span>
            <span className="flex items-center gap-1">🛡️ Rate Limited</span>
          </div>
        </div>
      </div>
    </div>
  );
}
