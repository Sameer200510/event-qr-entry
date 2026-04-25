import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { BadgeCheck, XCircle, Focus, Lock, Send, KeyRound } from 'lucide-react';
import api from '../utils/api';

export default function VolunteerScanner() {
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // OTP Fallback state
  const [useOtp, setUseOtp] = useState(false);
  const [roll, setRoll] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const scannerRef = useRef(null);

  useEffect(() => {
    if (useOtp) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
        scannerRef.current = null;
      }
      return;
    }

    function onScanSuccess(decodedText) {
      if(loading) return; 
      handleVerifyQR(decodedText);
    }

    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        aspectRatio: 1.0
      },
      false
    );

    scanner.render(onScanSuccess, () => {});
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scanner.clear().catch(e => console.error(e));
      }
    };
  }, [loading, useOtp]);

  const handleVerifyQR = async (token) => {
    let pureToken = token;
    try {
      if (token.includes('verify/')) {
        pureToken = token.split('verify/')[1];
      }
    } catch(e) {}

    setLoading(true);
    resetMessages();

    try {
      const { data } = await api.post('/attendees/scan', { token: pureToken });
      setScanResult(data.attendee || data); // ensure we capture name 
      playSuccessSound();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Validation failed. Invalid code.');
    } finally {
      setTimeout(() => setLoading(false), 2000); 
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!roll) return;
    setLoading(true);
    resetMessages();

    try {
      await api.post('/otp/send', { roll: roll.trim() });
      setOtpSent(true);
      // Optional enhancement: could show a toast "OTP Sent!"
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
    resetMessages();

    try {
      const { data } = await api.post('/otp/verify', { roll: roll.trim(), otp: otp.trim() });
      // data: { status: "ALLOWED", name: "John Doe" }
      setScanResult({ name: data.name, roll: roll.trim() });
      playSuccessSound();
      // reset OTP state
      setRoll('');
      setOtp('');
      setOtpSent(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const resetMessages = () => {
    setScanResult(null);
    setErrorMsg(null);
  };

  const playSuccessSound = () => {
    // Attempting to play a generic success beep natively
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // high pitch
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-8 space-y-6">
      <div className="text-center mt-4 mb-4">
        <h2 className="text-2xl font-extrabold text-slate-800">Entry Verification</h2>
        <p className="text-slate-500 text-sm">Scan QR or use OTP Fallback</p>
      </div>

      <div className="flex justify-center mb-4">
        <button 
          onClick={() => { setUseOtp(!useOtp); resetMessages(); }}
          className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium px-4 py-2 rounded-full text-sm transition"
        >
          {useOtp ? 'Switch to QR Scanner' : 'QR Failed? Use OTP Fallback'}
        </button>
      </div>

      {!useOtp ? (
        <div className="glass-panel overflow-hidden border-2 border-slate-200 shadow-xl">
          <div id="reader" className="w-full bg-black min-h-[300px]"></div>
        </div>
      ) : (
        <div className="glass-panel p-6 space-y-4 border-2 border-slate-200 shadow-xl">
          <div className="flex items-center gap-2 border-b pb-2 mb-4 text-slate-700">
            <Lock size={20} />
            <h3 className="font-bold text-lg">OTP Fallback System</h3>
          </div>
          
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Attendee Roll Number</label>
                <input
                  type="text"
                  required
                  className="premium-input"
                  placeholder="Enter exact roll number"
                  value={roll}
                  onChange={e => setRoll(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="premium-button"
              >
                {loading ? <Focus className="animate-spin w-5 h-5"/> : <Send size={18} />} Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  className="premium-input text-center text-xl tracking-widest font-mono font-bold"
                  placeholder="------"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-3 text-center">OTP was sent to their registered email.</p>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="premium-button"
              >
                {loading ? <Focus className="animate-spin w-5 h-5"/> : <KeyRound size={18} />} Verify & Admit
              </button>
              <button 
                type="button" 
                onClick={() => setOtpSent(false)}
                className="w-full text-slate-500 hover:text-slate-700 text-sm mt-2 transition"
              >
                Cancel / Resend
              </button>
            </form>
          )}
        </div>
      )}

      {loading && !useOtp && (
        <div className="bg-brand-50 p-4 rounded-xl flex items-center justify-center gap-3 text-brand-700 animate-pulse font-medium">
          <Focus className="animate-spin" /> Processing QR token...
        </div>
      )}

      {scanResult && !loading && (
        <div className="bg-green-100 p-6 rounded-2xl shadow-lg border-2 border-green-400 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-2 text-green-700">
            <BadgeCheck size={28} />
            <h3 className="text-2xl font-bold">Entry Allowed!</h3>
          </div>
          <div className="text-slate-800 font-medium mt-3 bg-white/50 p-3 rounded-lg inline-block w-full">
            <p className="text-xl">👤 {scanResult.name}</p>
            {scanResult.roll && <p className="text-slate-600 text-sm mt-1">🆔 {scanResult.roll}</p>}
          </div>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="bg-red-100 p-6 rounded-2xl shadow-lg border-2 border-red-500 animate-in headShake duration-300">
           <div className="flex items-center gap-3 mb-2 text-red-700">
            <XCircle size={28} />
            <h3 className="text-xl font-bold">Entry Denied</h3>
          </div>
          <p className="text-slate-900 font-medium bg-white/50 p-3 rounded-lg">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
