import { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, Settings, Loader2, Mail, CheckCircle2, User, Users, Send } from 'lucide-react';
import api from '../utils/api';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ name: '', roll: '', email: '' });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [emailLoading, setEmailLoading] = useState(null); 
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    try {
      const { data } = await api.get('/attendees');
      setAttendees(data);
    } catch (err) {
      console.error('Failed to fetch attendees');
    }
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);
      const { data } = await api.post('/attendees/parse-excel', formData);
      setHeaders(data.headers);
      
      const newMapping = { name: '', roll: '', email: '' };
      data.headers.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('name')) newMapping.name = h;
        if (lower.includes('roll') || lower.includes('id')) newMapping.roll = h;
        if (lower.includes('mail')) newMapping.email = h;
      });
      setMapping(newMapping);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse Excel file.');
      setFile(null);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!mapping.name || !mapping.roll) {
      setError('Name and Roll mapping are required!');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      
      const response = await api.post('/attendees/upload-excel', formData, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Processed_Attendees_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setStep(3);
      fetchAttendees();
    } catch (err) {
      setError('Failed to upload and process Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendManualEmail = async (id) => {
    setEmailLoading(id);
    try {
      await api.post(`/attendees/send-email/${id}`);
      alert('Email sent successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send email');
    } finally {
      setEmailLoading(null);
    }
  };

  const handleSendBulkEmails = async () => {
    if (!confirm('Are you sure you want to send QR emails to ALL registered attendees? This may take a few minutes.')) return;
    setBulkLoading(true);
    try {
      const { data } = await api.post('/attendees/send-bulk');
      alert(data.message);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start bulk email process');
    } finally {
      setBulkLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setStep(1);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Admin Dashboard</h2>
          <p className="text-slate-500 mt-1">Manage attendees and distribute entry QR codes.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm text-red-700 animate-in slide-in-from-top">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Main Upload Section */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="glass-panel p-6 space-y-6 h-fit">
          <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
            <Upload size={18} className="text-brand-600" />
            Bulk Import
          </h3>
          <ul className="space-y-4">
            <li className={`flex gap-3 items-center ${step >= 1 ? 'text-brand-600 font-semibold' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-300'}`}>1</div>
              Upload Excel
            </li>
            <li className={`flex gap-3 items-center ${step >= 2 ? 'text-brand-600 font-semibold' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-300'}`}>2</div>
              Map Columns
            </li>
            <li className={`flex gap-3 items-center ${step >= 3 ? 'text-brand-600 font-semibold' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-300'}`}>3</div>
              Done
            </li>
          </ul>
        </div>

        <div className="glass-panel p-6 md:p-8 lg:col-span-2 min-h-[300px] flex flex-col justify-center">
          {step === 1 && (
            <div className="text-center space-y-6 py-6">
              <div className="mx-auto w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-4 transition-transform hover:rotate-3 hover:scale-110 duration-300 shadow-sm">
                {loading ? <Loader2 className="animate-spin w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Upload Dataset</h3>
                <p className="text-slate-500 text-sm mt-1">Select an Excel file (.xlsx) with attendee details.</p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition active:scale-95 shadow-lg">
                <FileSpreadsheet size={20} />
                <span>Browse File</span>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
              <div className="flex items-center gap-3 border-b pb-4">
                <Settings className="text-brand-600" />
                <h3 className="text-xl font-bold text-slate-800">Map Columns</h3>
              </div>
              
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                {Object.keys(mapping).map(key => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-semibold text-slate-700 min-w-24 capitalize">{key} {key!=='email' && <span className="text-red-500">*</span>}</label>
                    <select 
                      className="flex-1 max-w-sm px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer bg-white"
                      value={mapping[key]} 
                      onChange={(e) => setMapping({...mapping, [key]: e.target.value})}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-4">
                <button onClick={resetState} className="secondary-button">Cancel</button>
                <button 
                  onClick={handleUpload}
                  disabled={loading}
                  className="premium-button flex-1"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5"/> : 'Process & Generate QRs'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-6 py-6 animate-in zoom-in-95 fade-in duration-500">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-4 shadow-sm">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Success!</h3>
                <p className="text-slate-500 mt-2">QR codes have been generated. You can now send them manually from the attendee list below.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <button onClick={resetState} className="secondary-button">Upload Another</button>
                <button onClick={() => {
                  const element = document.getElementById('attendee-list');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }} className="premium-button">View Attendees</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendee List Section */}
      <div id="attendee-list" className="glass-panel p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Registered Attendees</h3>
              <p className="text-sm text-slate-500">{attendees.length} total entries</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSendBulkEmails} 
              disabled={bulkLoading || attendees.length === 0}
              className="premium-button bg-brand-600 hover:bg-brand-700 text-sm py-2 px-4 flex items-center gap-2"
            >
              {bulkLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send size={16} />}
              Send All QR Emails
            </button>
            <button onClick={fetchAttendees} className="secondary-button text-sm py-2 px-4">
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm font-semibold">
                <th className="p-4 border-b">Name</th>
                <th className="p-4 border-b">Roll Number</th>
                <th className="p-4 border-b">Email</th>
                <th className="p-4 border-b">Status</th>
                <th className="p-4 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 italic">
                    No attendees registered yet.
                  </td>
                </tr>
              ) : (
                attendees.map(a => (
                  <tr key={a._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 font-medium text-slate-800">{a.name}</td>
                    <td className="p-4 text-slate-600">{a.roll}</td>
                    <td className="p-4 text-slate-600">{a.email || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        a.status === 'USED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleSendManualEmail(a._id)}
                        disabled={!a.email || emailLoading === a._id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          !a.email 
                            ? 'text-slate-300 cursor-not-allowed' 
                            : 'text-brand-600 bg-brand-50 hover:bg-brand-600 hover:text-white'
                        }`}
                      >
                        {emailLoading === a._id ? (
                          <Loader2 className="animate-spin w-4 h-4" />
                        ) : (
                          <Mail size={16} />
                        )}
                        <span>Send QR</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
