import { useEffect, useState, useRef } from 'react';
import jsQR from 'jsqr';
import {
  BadgeCheck, XCircle, Lock, Send, KeyRound,
  CameraOff, RefreshCw, CheckCircle2, ChevronRight, LogOut, ScanLine, UserCheck
} from 'lucide-react';
import api from '../utils/api';

export default function VolunteerScanner({ onLogout }) {
  const [permState, setPermState]   = useState('asking'); // 'asking'|'granted'|'denied'
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [useOtp, setUseOtp]         = useState(false);
  const [roll, setRoll]             = useState('');
  const [otpSent, setOtpSent]       = useState(false);
  const [otp, setOtp]               = useState('');
  const [scanCount, setScanCount]   = useState(0);

  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const isScanRef    = useRef(false);
  const loadingRef   = useRef(false);
  const timerRef     = useRef(null);

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (useOtp) { stopCamera(); return; }
    initCamera();
    return () => stopCamera();
  }, [useOtp]);

  const initCamera = async () => {
    setPermState('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setPermState('granted');
    } catch (err) {
      console.error('Camera:', err);
      setPermState('denied');
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    isScanRef.current = false;
  };

  const onVideoReady = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const scanFrame = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data && !isScanRef.current && !loadingRef.current) {
      isScanRef.current = true;
      handleVerifyQR(code.data);
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  // Manually reset to scanning state
  const readyForNext = () => {
    clearTimeout(timerRef.current);
    setScanResult(null);
    setErrorMsg(null);
    isScanRef.current = false;
  };


  // ── QR Verify ─────────────────────────────────────────────────────────────
  const handleVerifyQR = async (rawToken) => {
    let token = rawToken;
    try {
      if (rawToken.includes('verify/')) token = rawToken.split('verify/').pop();
      else if (rawToken.includes('token=')) token = new URL(rawToken).searchParams.get('token');
    } catch {}

    setLoading(true); setScanResult(null); setErrorMsg(null);
    try {
      const { data } = await api.post('/attendees/scan', { token });
      if (data.alreadyVerified) {
        setScanResult({ ...data.attendee, alreadyOtp: true });
      } else {
        setScanResult(data.attendee);
        setScanCount(c => c + 1);
        playTone(880, 1320, 0.2);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid or expired QR.');
      playTone(440, 220, 0.3);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP ───────────────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault(); setLoading(true); setScanResult(null); setErrorMsg(null);
    try { await api.post('/otp/send', { roll: roll.trim() }); setOtpSent(true); }
    catch (err) { setErrorMsg(err.response?.data?.error || 'Failed to send OTP.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setLoading(true); setScanResult(null); setErrorMsg(null);
    try {
      const { data } = await api.post('/otp/verify', { roll: roll.trim(), otp: otp.trim() });
      setScanResult({ name: data.name, roll: roll.trim() });
      setScanCount(c => c + 1); playTone(880, 1320, 0.2);
      setRoll(''); setOtp(''); setOtpSent(false);
    } catch (err) { setErrorMsg(err.response?.data?.error || 'Invalid OTP.'); }
    finally { setLoading(false); }
  };

  const playTone = (f1, f2, dur) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.6, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // ── Whether to show the full-screen result card ────────────────────────────
  const showResult = !loading && (scanResult || errorMsg);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 overflow-hidden">

      {/* Top Bar */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-slate-700/50 z-30 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <ScanLine size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Entry Scanner</p>
            {scanCount > 0 && <p className="text-emerald-400 text-xs mt-0.5">{scanCount} admitted</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setUseOtp(v => !v); setScanResult(null); setErrorMsg(null); readyForNext(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              useOtp ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                     : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {useOtp ? <><ScanLine size={13}/> QR</> : <><Lock size={13}/> OTP</>}
          </button>
          {onLogout && (
            <button onClick={onLogout} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 transition active:scale-95 border border-slate-700">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col" style={{ height: 'calc(100svh - 56px)' }}>

        {/* ── QR SCANNER ── */}
        <div className={`flex-1 relative overflow-hidden bg-black ${useOtp ? 'hidden' : 'flex'} flex-col`}>

          {/* Video always mounted */}
          <video ref={videoRef} onLoadedData={onVideoReady}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" aria-hidden />

          {/* Permission asking */}
          {permState === 'asking' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-900">
              <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-brand-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Requesting camera…</p>
            </div>
          )}

          {/* Permission denied */}
          {permState === 'denied' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 p-8 bg-slate-900 text-center">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                <CameraOff size={40} className="text-red-400" />
              </div>
              <p className="text-white font-bold text-lg">Camera Blocked</p>
              <p className="text-slate-400 text-sm max-w-xs">Allow camera in browser settings, then reload.</p>
              <button onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-brand-500 text-white px-6 py-3 rounded-2xl font-bold active:scale-95 transition shadow-lg">
                <RefreshCw size={16} /> Reload
              </button>
            </div>
          )}

          {permState === 'granted' && !showResult && !loading && (
            <>
              {/* Vignette */}
              <div className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 32%, rgba(0,0,0,0.72) 100%)' }} />
              {/* Corner frame */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                <div className="relative w-60 h-60">
                  <div className="absolute top-0 left-0  w-9 h-9 border-t-4 border-l-4 border-brand-400 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 border-brand-400 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0  w-9 h-9 border-b-4 border-l-4 border-brand-400 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 border-brand-400 rounded-br-2xl" />
                  <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-bounce"
                    style={{ top: '50%', animationDuration: '1.6s' }} />
                </div>
                <p className="text-white/40 text-xs font-semibold mt-5 tracking-widest uppercase">Point at QR code</p>
              </div>
            </>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <p className="text-white font-bold text-lg">Verifying…</p>
            </div>
          )}

          {/* ── FULL-SCREEN RESULT OVERLAY ── */}
          {showResult && (
            <div className="absolute inset-0 z-30 flex flex-col animate-in fade-in duration-300"
              style={{
                background: scanResult?.alreadyOtp
                  ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
                  : scanResult
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)'
              }}
            >
              {/* Big Result Content */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
                {/* Icon Circle */}
                <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center shadow-2xl animate-in zoom-in-50 duration-300">
                  {scanResult?.alreadyOtp && <CheckCircle2 size={56} className="text-white" />}
                  {scanResult && !scanResult.alreadyOtp && <BadgeCheck size={56} className="text-white" />}
                  {errorMsg && <XCircle size={56} className="text-white" />}
                </div>

                {/* Status Text */}
                <div className="space-y-2">
                  <p className="text-white/70 text-sm font-bold uppercase tracking-widest">
                    {scanResult?.alreadyOtp ? 'Already Verified via OTP'
                      : scanResult ? '✅ Entry Allowed'
                      : '❌ Entry Denied'}
                  </p>
                  <p className="text-white font-extrabold text-4xl leading-tight">
                    {scanResult ? scanResult.name : 'Access Denied'}
                  </p>
                  {scanResult?.roll && (
                    <p className="text-white/70 text-lg font-semibold">#{scanResult.roll}</p>
                  )}
                  {errorMsg && (
                    <p className="text-white/80 text-base font-medium mt-2 max-w-xs mx-auto leading-snug">{errorMsg}</p>
                  )}
                </div>

                {/* Scan count badge */}
                {scanResult && !scanResult.alreadyOtp && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-2">
                    <UserCheck size={16} className="text-white" />
                    <span className="text-white font-bold text-sm">{scanCount} admitted total</span>
                  </div>
                )}
              </div>

              <div className="flex-none p-6">
                <button
                  onClick={readyForNext}
                  className="w-full h-16 flex items-center justify-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-3xl text-white font-extrabold text-lg active:scale-95 transition-all border-2 border-white/30 shadow-lg"
                >
                  <ScanLine size={24} />
                  Scan Next Person
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── OTP MODE ── */}
        {useOtp && (
          <div className="flex-1 overflow-y-auto bg-slate-900">
            <div className="flex flex-col justify-center p-5 max-w-md mx-auto w-full gap-4 min-h-full">
              <div className="bg-slate-800 rounded-3xl border border-slate-700/60 overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4 flex items-center gap-3 border-b border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center">
                    <Lock size={18} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">OTP Verification</p>
                    <p className="text-slate-400 text-xs">Manual entry fallback</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Roll Number</label>
                        <input type="text" required autoComplete="off"
                          className="w-full px-4 py-4 rounded-2xl bg-slate-900 border border-slate-600 text-white placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all text-base font-medium"
                          placeholder="Enter attendee's roll no."
                          value={roll} onChange={e => setRoll(e.target.value)} disabled={loading} />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full h-14 flex items-center justify-center gap-2.5 bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold text-base rounded-2xl active:scale-95 transition-all disabled:opacity-60 shadow-lg">
                        {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                          : <><Send size={18} /> Send OTP to Email</>}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                        <p className="text-emerald-300 text-sm font-medium">OTP sent for <strong className="text-white">{roll}</strong></p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">6-Digit OTP</label>
                        <input type="number" required autoFocus inputMode="numeric"
                          className="w-full px-4 py-4 rounded-2xl bg-slate-900 border border-slate-600 text-white text-center text-3xl tracking-[0.4em] font-mono font-black placeholder:text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all"
                          placeholder="000000"
                          value={otp} onChange={e => setOtp(e.target.value.slice(0, 6))} disabled={loading} />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full h-14 flex items-center justify-center gap-2.5 bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold text-base rounded-2xl active:scale-95 transition-all disabled:opacity-60 shadow-lg">
                        {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
                          : <><KeyRound size={18} /> Verify & Admit</>}
                      </button>
                      <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }}
                        className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition flex items-center justify-center gap-1">
                        <ChevronRight size={14} className="rotate-180" /> Back / Change Roll
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* OTP success result */}
              {scanResult && (
                <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <BadgeCheck size={30} className="text-white" />
                    </div>
                    <div>
                      <p className="text-green-100 text-xs font-extrabold uppercase tracking-wider">✅ Entry Allowed</p>
                      <p className="text-white font-extrabold text-2xl">{scanResult.name}</p>
                      {scanResult.roll && <p className="text-green-100">#{scanResult.roll}</p>}
                    </div>
                  </div>
                </div>
              )}
              {errorMsg && (
                <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <XCircle size={30} className="text-white" />
                    </div>
                    <div>
                      <p className="text-red-100 text-xs font-extrabold uppercase">❌ Failed</p>
                      <p className="text-white font-bold">{errorMsg}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
