import { useParams } from 'react-router-dom';
import { ShieldAlert, User, Hash, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function ExternalVerify() {
  const { token } = useParams();
  const [attendee, setAttendee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        // We use the same public endpoint as before, but now it just returns data
        // Note: We might need to create a specific public API endpoint for this if the legacy one is just HTML
        // But for now, let's assume we want to show the 'Official Scanner' message anyway.
        setLoading(false);
      } catch (err) {
        setError("Invalid QR Code");
        setLoading(false);
      }
    };
    fetchDetails();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="bg-amber-50 p-8 flex flex-col items-center text-center border-b border-amber-100">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border-2 border-amber-200 mb-6 animate-bounce">
            <ShieldAlert size={40} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Official Scanner Required</h1>
          <p className="text-slate-600 font-medium">
            This QR code must be scanned through our <span className="text-amber-600 font-bold">Authorized Platform</span>.
          </p>
        </div>

        {/* Content Section */}
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Verification Info</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                  <User size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">Attendee Status</p>
                  <p className="text-slate-900 font-bold">Manual Scan Detected</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">Scan Count</p>
                  <p className="text-emerald-600 font-bold">Not Incremented</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-blue-700 text-sm font-medium leading-relaxed">
                To prevent unauthorized scans, only scanners used by event volunteers can process this ticket.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <button 
            disabled
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm opacity-50 cursor-not-allowed"
          >
            Entry Not Authorized Here
          </button>
          <p className="text-center mt-4 text-slate-400 text-[11px] font-medium">
            Contact an event volunteer for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
