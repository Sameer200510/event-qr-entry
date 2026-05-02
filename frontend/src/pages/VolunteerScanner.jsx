import { useEffect, useState, useRef } from 'react';
import jsQR from 'jsqr';
import {
  BadgeCheck, XCircle, Lock, Send, KeyRound, CameraOff, LogOut,
  ScanLine, Utensils, ChevronRight, RefreshCw, Moon, Sun, AlertTriangle
} from 'lucide-react';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function VolunteerScanner({ role, onLogout }) {
  const [permState, setPermState]     = useState('asking');
  const [scanResult, setScanResult]   = useState(null);
  const [errorMsg, setErrorMsg]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [useOtp, setUseOtp]           = useState(false);
  const [roll, setRoll]               = useState('');
  const [otpSent, setOtpSent]         = useState(false);
  const [otp, setOtp]                 = useState('');
  const [scanCount, setScanCount]     = useState(0);
  const [showResult, setShowResult]   = useState(false);

  const isFood    = role === 'FoodVolunteer';
  const scanType  = isFood ? 'food' : 'entry';
  const scanLabel = isFood ? 'Food Distribution' : 'Event Entry';
  const ScanIcon  = isFood ? Utensils : ScanLine;
  const accentColor = isFood ? 'var(--amber)' : 'var(--brand)';

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const isScanRef  = useRef(false);
  const loadingRef = useRef(false);
  const timerRef   = useRef(null);

  const { dark, setDark } = useTheme();
  const { toast } = useToast();

  // keep loadingRef in sync
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Camera lifecycle
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
    } catch {
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

  const readyForNext = () => {
    clearTimeout(timerRef.current);
    setScanResult(null);
    setErrorMsg(null);
    setShowResult(false);
    setTimeout(() => { isScanRef.current = false; }, 1500);
  };

  // ── QR Verify ────────────────────────────────────────────────────
  const handleVerifyQR = async (rawToken) => {
    let token = rawToken;
    try {
      if (rawToken.includes('verify/')) token = rawToken.split('verify/').pop();
      else if (rawToken.includes('token=')) token = new URL(rawToken).searchParams.get('token');
    } catch {}

    setLoading(true); setScanResult(null); setErrorMsg(null);
    try {
      const { data } = await api.post('/attendees/scan', { token, type: scanType });
      if (data.alreadyVerified) {
        setScanResult({ ...data.attendee, alreadyOtp: true });
        toast({ type: 'warning', message: `${data.attendee.name} already verified via OTP` });
      } else {
        setScanResult(data.attendee);
        setScanCount(c => c + 1);
        playTone(880, 1320, 0.2);
        toast({ type: 'success', message: `${data.attendee.name} — ${scanLabel} ✓` });
      }
      setShowResult(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid or expired QR.';
      setErrorMsg(msg);
      setShowResult(true);
      playTone(440, 220, 0.3);
      toast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
      // Auto-dismiss after 4s
      timerRef.current = setTimeout(readyForNext, 4000);
    }
  };

  // ── OTP ──────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault(); setLoading(true); setScanResult(null); setErrorMsg(null);
    try {
      await api.post('/otp/send', { roll: roll.trim(), type: scanType });
      setOtpSent(true);
      toast({ type: 'info', message: `OTP sent to registered email` });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send OTP.';
      setErrorMsg(msg);
      toast({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setLoading(true); setScanResult(null); setErrorMsg(null);
    try {
      const { data } = await api.post('/otp/verify', { roll: roll.trim(), otp: otp.trim(), type: scanType });
      setScanResult({ name: data.name, roll: roll.trim() });
      setScanCount(c => c + 1); playTone(880, 1320, 0.2);
      setRoll(''); setOtp(''); setOtpSent(false);
      toast({ type: 'success', message: `${data.name} — ${scanLabel} via OTP ✓` });
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid OTP.';
      setErrorMsg(msg);
      toast({ type: 'error', message: msg });
    } finally { setLoading(false); }
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

  const headerBg = isFood
    ? 'linear-gradient(135deg, #92400e, #78350f)'
    : 'linear-gradient(135deg, #312e81, #1e1b4b)';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden', position: 'relative' }}>

      {/* Top Bar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1rem', height: 56,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: isFood ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isFood ? '0 4px 12px rgba(245,158,11,0.4)' : '0 4px 12px rgba(99,102,241,0.4)'
          }}>
            <ScanIcon size={18} color="#fff" />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1 }}>
              {scanLabel} Scanner
            </p>
            {scanCount > 0 && (
              <p style={{ color: accentColor, fontSize: '0.7rem', fontWeight: 600, marginTop: 2 }}>
                {scanCount} {isFood ? 'served' : 'admitted'} today
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* OTP toggle */}
          <button
            onClick={() => { setUseOtp(v => !v); readyForNext(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.75rem', borderRadius: 8,
              fontSize: '0.75rem', fontWeight: 700, border: '1.5px solid',
              cursor: 'pointer', transition: 'all 0.2s',
              background: useOtp ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
              borderColor: useOtp ? 'rgba(99,102,241,0.5)' : 'rgba(16,185,129,0.4)',
              color: useOtp ? '#818cf8' : '#34d399',
            }}
          >
            {useOtp ? <><ScanLine size={12} /> QR</> : <><Lock size={12} /> OTP</>}
          </button>

          {/* Dark mode */}
          <button onClick={() => setDark(!dark)} style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Logout */}
          {onLogout && (
            <button onClick={onLogout} style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* ── QR Camera ─────────────────────────────────────── */}
        {!useOtp && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <video
              ref={videoRef}
              onLoadedData={onVideoReady}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              playsInline muted autoPlay
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Dark overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

            {/* Asking permission */}
            {permState === 'asking' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#000'
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '3px solid #334155', borderTopColor: '#6366f1',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Requesting camera…</p>
              </div>
            )}

            {/* Denied */}
            {permState === 'denied' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1.25rem', background: '#0b0f1a', padding: '2rem'
              }}>
                <CameraOff size={48} color="#ef4444" />
                <p style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}>Camera Access Denied</p>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                  Please allow camera access in your browser settings, then tap Retry.
                </p>
                <button onClick={initCamera} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                  <RefreshCw size={16} /> Retry
                </button>
                <button onClick={() => setUseOtp(true)} className="btn btn-secondary" style={{ color: '#94a3b8', borderColor: '#334155' }}>
                  <Lock size={16} /> Use OTP Instead
                </button>
              </div>
            )}

            {/* Scan frame (only when granted and no result) */}
            {permState === 'granted' && !showResult && !loading && (
              <div className="scanner-overlay">
                <div className="scan-frame">
                  <span />
                  <div className="scan-line" />
                </div>
                <p style={{
                  position: 'absolute', bottom: 80, color: 'rgba(255,255,255,0.8)',
                  fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em',
                  textTransform: 'uppercase', textAlign: 'center', left: 0, right: 0
                }}>
                  Point camera at QR code
                </p>
              </div>
            )}

            {/* Loading spinner over camera */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)'
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: accentColor,
                  animation: 'spin 0.8s linear infinite'
                }} />
              </div>
            )}
          </div>
        )}

        {/* ── OTP Panel ─────────────────────────────────────── */}
        {useOtp && (
          <div style={{
            position: 'absolute', inset: 0, background: 'var(--bg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '2rem 1.25rem', overflowY: 'auto'
          }}>
            <div className="card animate-slide-up" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: isFood ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem',
                  color: accentColor
                }}>
                  <KeyRound size={28} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                  OTP Verification
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>
                  {scanLabel} — manual entry
                </p>
              </div>

              {errorMsg && (
                <div className="animate-fade-in" style={{
                  background: 'var(--red-light)', color: 'var(--red)', borderRadius: 10,
                  padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500,
                  display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center'
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />{errorMsg}
                </div>
              )}

              {scanResult && (
                <div className="animate-fade-in" style={{
                  background: 'var(--green-light)', color: 'var(--green)', borderRadius: 10,
                  padding: '0.875rem 1rem', fontWeight: 600, marginBottom: '1.25rem',
                  display: 'flex', gap: '0.5rem', alignItems: 'center'
                }}>
                  <BadgeCheck size={18} style={{ flexShrink: 0 }} />
                  {scanResult.name} verified!
                </div>
              )}

              {!otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="input-label" htmlFor="otp-roll">Roll Number</label>
                    <input
                      id="otp-roll"
                      className="input"
                      type="text"
                      placeholder="Enter roll number"
                      value={roll}
                      onChange={e => setRoll(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                    {loading
                      ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" /> Sending…</>
                      : <><Send size={16} /> Send OTP</>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    background: 'var(--surface-2)', borderRadius: 10, padding: '0.625rem 0.875rem',
                    fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    ✉️ OTP sent to email for roll: <strong style={{ color: 'var(--text-primary)' }}>{roll}</strong>
                  </div>
                  <div>
                    <label className="input-label" htmlFor="otp-code">OTP Code</label>
                    <input
                      id="otp-code"
                      className="input"
                      type="text"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      maxLength={6}
                      required
                      disabled={loading}
                      style={{ fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700 }}
                    />
                  </div>
                  <button type="submit" className="btn btn-success" disabled={loading} style={{ width: '100%' }}>
                    {loading
                      ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" /> Verifying…</>
                      : <><BadgeCheck size={16} /> Verify & Admit</>}
                  </button>
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }} className="btn btn-secondary" style={{ width: '100%' }}>
                    ← Change Roll Number
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Result Bottom Sheet ────────────────────────────── */}
        {showResult && !useOtp && (
          <>
            {/* Backdrop */}
            <div
              onClick={readyForNext}
              style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'pointer' }}
            />
            <div className="bottom-sheet" style={{ zIndex: 60, padding: '0.75rem 1.5rem 2rem' }}>
              {/* Handle bar */}
              <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--border)', margin: '0 auto 1.25rem' }} />

              {scanResult && !scanResult.alreadyOtp ? (
                /* ─── SUCCESS ─── */
                <div className="animate-slide-up" style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem',
                    background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <BadgeCheck size={36} color="var(--green)" />
                  </div>
                  <span className="badge badge-green" style={{ marginBottom: '0.75rem' }}>
                    {isFood ? '🍽 Food Distributed' : '✅ Entry Allowed'}
                  </span>
                  <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0.25rem' }}>
                    {scanResult.name}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, margin: '0 0 1.5rem' }}>
                    Roll: {scanResult.roll}
                    {(scanResult.entryScannedAt || scanResult.foodScannedAt) && (
                      <> &nbsp;·&nbsp; {new Date(scanResult.entryScannedAt || scanResult.foodScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </p>
                  <button onClick={readyForNext} className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
                    <ScanLine size={16} /> Scan Next Person
                  </button>
                </div>
              ) : scanResult?.alreadyOtp ? (
                /* ─── ALREADY VIA OTP ─── */
                <div className="animate-slide-up" style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem',
                    background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <AlertTriangle size={36} color="var(--amber)" />
                  </div>
                  <span className="badge badge-amber" style={{ marginBottom: '0.75rem' }}>Already verified via OTP</span>
                  <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 1.5rem' }}>
                    {scanResult.name}
                  </h2>
                  <button onClick={readyForNext} className="btn btn-amber" style={{ width: '100%', padding: '0.875rem' }}>
                    <ScanLine size={16} /> Scan Next Person
                  </button>
                </div>
              ) : errorMsg ? (
                /* ─── ERROR ─── */
                <div className="animate-slide-up" style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 1rem',
                    background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <XCircle size={36} color="var(--red)" />
                  </div>
                  <span className="badge badge-red" style={{ marginBottom: '0.75rem' }}>
                    {isFood ? 'Food Denied' : 'Entry Denied'}
                  </span>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.25rem 1rem 1.5rem', lineHeight: 1.4 }}>
                    {errorMsg}
                  </h2>
                  <button onClick={readyForNext} className="btn btn-secondary" style={{ width: '100%', padding: '0.875rem' }}>
                    <RefreshCw size={16} /> Try Again
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Watermark */}
      <div className="watermark">Designed by SAMEER LOHANI &amp; VARUN DOBHAL</div>
    </div>
  );
}
