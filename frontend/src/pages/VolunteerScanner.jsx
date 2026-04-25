import { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { BadgeCheck, XCircle, Loader2, Lock, Send, KeyRound, Camera, CameraOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

export default function VolunteerScanner({ onLogout }) {
  // Core scan state
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Camera permission state: null = not asked, true = granted, false = denied
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  // OTP fallback state
  const [useOtp, setUseOtp] = useState(false);
  const [roll, setRoll] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Refs
  const html5QrRef = useRef(null);
  const isScanningRef = useRef(false); // Prevent double-processing a scan
  const cameraRunningRef = useRef(false);

  // ─── Camera Init (only once on mount) ───────────────────────────────────────
  useEffect(() => {
    if (useOtp) {
      stopCamera();
      return;
    }
    if (hasPermission === false) return; // Already denied, don't retry
    requestPermissionAndStart();

    return () => {
      stopCamera();
    };
    // NOTE: 'loading' is intentionally NOT in deps - we must not reinitialize camera on each scan
  }, [useOtp]);

  const requestPermissionAndStart = async () => {
    try {
      // Ask permission using native browser API - only fires once
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasPermission(true);
      startScanner();
    } catch (err) {
      console.error('Camera permission denied:', err);
      setHasPermission(false);
    }
  };

  const startScanner = () => {
    if (cameraRunningRef.current) return; // Already running

    const scanner = new Html5Qrcode('qr-reader');
    html5QrRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        if (isScanningRef.current || loading) return; // Prevent double scan
        isScanningRef.current = true;
        handleVerifyQR(decodedText);
      },
      () => {} // Scan failure - no-op
    ).then(() => {
      cameraRunningRef.current = true;
      setCameraStarted(true);
    }).catch(err => {
      console.error('Scanner start error:', err);
      setHasPermission(false);
    });
  };

  const stopCamera = async () => {
    if (html5QrRef.current && cameraRunningRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current = null;
        cameraRunningRef.current = false;
        setCameraStarted(false);
      } catch (e) {
        // ignore
      }
    }
  };

  // ─── QR Verify ──────────────────────────────────────────────────────────────
  const handleVerifyQR = async (rawToken) => {
    // Extract pure token from URL if full link scanned
    let token = rawToken;
    try {
      if (rawToken.includes('verify/')) {
        token = rawToken.split('verify/')[1];
      } else if (rawToken.includes('token=')) {
        token = new URL(rawToken).searchParams.get('token');
      }
    } catch (e) {}

    setLoading(true);
    setScanResult(null);
    setErrorMsg(null);

    try {
      const { data } = await api.post('/attendees/scan', { token });

      if (data.alreadyVerified) {
        // OTP-verified person scanned via QR - show yellow/info card
        setScanResult({ ...data.attendee, verifiedViaOtp: true });
      } else {
        setScanResult(data.attendee);
        playSuccessSound();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Scan failed. Invalid or expired code.');
      playErrorSound();
    } finally {
      setLoading(false);
      // Allow re-scanning after 3 seconds
      setTimeout(() => {
        isScanningRef.current = false;
        setScanResult(null);
        setErrorMsg(null);
      }, 3000);
    }
  };

  // ─── OTP Handlers ───────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!roll) return;
    setLoading(true);
    setScanResult(null);
    setErrorMsg(null);
    try {
      await api.post('/otp/send', { roll: roll.trim() });
      setOtpSent(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!roll || !otp) return;
    setLoading(true);
    setScanResult(null);
    setErrorMsg(null);
    try {
      const { data } = await api.post('/otp/verify', { roll: roll.trim(), otp: otp.trim() });
      setScanResult({ name: data.name, roll: roll.trim() });
      playSuccessSound();
      setRoll('');
      setOtp('');
      setOtpSent(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Audio Feedback ──────────────────────────────────────────────────────────
  const playTone = (freq1, freq2, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };
  const playSuccessSound = () => playTone(800, 1200, 0.2);
  const playErrorSound = () => playTone(400, 250, 0.3);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dynamic flex flex-col">

      {/* Compact header for mobile */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-base font-bold text-slate-800">📋 Entry Check</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setUseOtp(!useOtp); setScanResult(null); setErrorMsg(null); }}
            className="text-xs px-3 py-2 rounded-full bg-slate-100 text-slate-700 font-medium active:scale-95 transition"
          >
            {useOtp ? '📷 QR' : '🔑 OTP'}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs px-3 py-2 rounded-full bg-red-50 text-red-500 font-medium active:scale-95 transition border border-red-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">

        {/* ── QR SCANNER MODE ── */}
        {!useOtp && (
          <div className="flex-1 flex flex-col">

            {/* Permission denied state */}
            {hasPermission === false && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <CameraOff size={36} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Camera Access Required</h2>
                <p className="text-slate-500 text-sm max-w-xs">
                  Please allow camera access in your browser settings, then reload the page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="premium-button max-w-xs"
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            )}

            {/* Permission not yet asked or loading */}
            {hasPermission === null && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 size={40} className="animate-spin text-brand-500" />
                <p className="text-sm font-medium">Starting camera...</p>
              </div>
            )}

            {/* Camera viewfinder - always mounted (DOM), shown once permission granted */}
            <div className={`flex-1 flex flex-col ${hasPermission !== true ? 'hidden' : ''}`}>
              {/* The actual camera feed */}
              <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: '55vh' }}>
                <div id="qr-reader" className="w-full h-full" />

                {/* Scan overlay frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-4 border-white/60 rounded-2xl shadow-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-xl" />
                    {/* Scan line animation */}
                    <div className="absolute inset-x-2 top-2 h-0.5 bg-brand-400/70 animate-bounce" style={{ animationDuration: '1.5s' }} />
                  </div>
                </div>

                {/* Loading overlay during API call */}
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={48} className="animate-spin text-white" />
                    <p className="text-white font-semibold text-lg">Verifying...</p>
                  </div>
                )}
              </div>

              {/* Result card - below the camera */}
              <div className="p-4 space-y-3">
                {/* Already verified via OTP - yellow info card */}
                {scanResult?.verifiedViaOtp && (
                  <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-400 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
                    <CheckCircle2 size={28} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-800">Already Verified via OTP</p>
                      <p className="text-amber-700 font-semibold text-lg">{scanResult.name}</p>
                      {scanResult.roll && <p className="text-amber-600 text-sm">🆔 {scanResult.roll}</p>}
                    </div>
                  </div>
                )}

                {/* Normal success */}
                {scanResult && !scanResult.verifiedViaOtp && (
                  <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-400 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
                    <BadgeCheck size={28} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-green-700">✅ Entry Allowed!</p>
                      <p className="text-slate-800 font-semibold text-lg">{scanResult.name}</p>
                      {scanResult.roll && <p className="text-slate-600 text-sm">🆔 {scanResult.roll}</p>}
                    </div>
                  </div>
                )}

                {/* Error */}
                {errorMsg && (
                  <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-400 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
                    <XCircle size={28} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-700">Entry Denied</p>
                      <p className="text-slate-800 text-sm">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {!scanResult && !errorMsg && !loading && (
                  <p className="text-center text-slate-400 text-sm py-2">Point the camera at a QR code</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── OTP FALLBACK MODE ── */}
        {useOtp && (
          <div className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
            <div className="glass-panel p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-700 border-b border-slate-100 pb-3">
                <Lock size={20} />
                <h2 className="font-bold text-base">OTP Verification</h2>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Roll Number</label>
                    <input
                      type="text"
                      required
                      className="premium-input text-base"
                      placeholder="Enter attendee's roll number"
                      value={roll}
                      onChange={e => setRoll(e.target.value)}
                      disabled={loading}
                      autoComplete="off"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="premium-button h-14 text-base">
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send size={18} />}
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                    OTP was sent to the registered email for <strong>{roll}</strong>.
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Enter 6-Digit OTP</label>
                    <input
                      type="number"
                      required
                      maxLength={6}
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      className="premium-input text-center text-3xl tracking-widest font-mono font-bold h-16"
                      placeholder="000000"
                      value={otp}
                      onChange={e => setOtp(e.target.value.slice(0, 6))}
                      disabled={loading}
                    />
                  </div>
                  <button type="submit" disabled={loading} className="premium-button h-14 text-base">
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <KeyRound size={18} />}
                    {loading ? 'Verifying...' : 'Verify & Admit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="w-full text-slate-500 hover:text-slate-700 text-sm py-2 transition"
                  >
                    ← Change Roll Number / Resend
                  </button>
                </form>
              )}
            </div>

            {/* OTP Result cards */}
            {scanResult && (
              <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-400 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
                <BadgeCheck size={28} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-700">✅ Entry Allowed!</p>
                  <p className="text-slate-800 font-semibold text-lg">{scanResult.name}</p>
                  {scanResult.roll && <p className="text-slate-600 text-sm">🆔 {scanResult.roll}</p>}
                </div>
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-400 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
                <XCircle size={28} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700">Failed</p>
                  <p className="text-slate-700 text-sm">{errorMsg}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
