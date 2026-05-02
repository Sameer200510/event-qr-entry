import { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, Settings, Loader2, Mail, CheckCircle2, User, Users, Send, MessageSquare, Clock, Check, AlertCircle } from 'lucide-react';
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
  const [customMessage, setCustomMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntry, setFilterEntry] = useState('all'); // all, entry_done, entry_pending
  const [filterFood, setFilterFood] = useState('all');   // all, food_done, food_pending

  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    try {
      console.log('Fetching attendees from API...');
      const { data } = await api.get('/attendees');
      console.log('Received attendees data:', data);
      setAttendees(data);
    } catch (err) {
      console.error('Failed to fetch attendees:', err);
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
      await api.post(`/attendees/send-email/${id}`, { message: customMessage });
      fetchAttendees(); // Refresh to show "Sent" status
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send email');
    } finally {
      setEmailLoading(null);
    }
  };

  const handleSendBulkEmails = async () => {
    if (!confirm(`Are you sure you want to send QR emails to ${attendees.filter(a => !a.emailSent).length} pending attendees?`)) return;
    setBulkLoading(true);
    try {
      const { data } = await api.post('/attendees/send-bulk', { message: customMessage });
      alert(data.message);
      fetchAttendees();
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
                <p className="text-slate-500 mt-2">QR codes have been generated. You can now send them manually from the list below.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <button onClick={resetState} className="secondary-button">Upload Another</button>
                <button onClick={() => {
                  const element = document.getElementById('attendee-list');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }} className="premium-button">View Attendee List</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Configuration Section */}
      <div className="glass-panel p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <MessageSquare className="text-brand-600" />
          <h3 className="text-xl font-bold text-slate-800">Email Configuration</h3>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Custom Message (Optional)</label>
          <textarea 
            placeholder="Write a message to be included in the QR email... (e.g. Please bring your ID card)"
            className="w-full h-32 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 resize-none transition-shadow"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
          <p className="text-xs text-slate-400">This message will appear above the QR code in the email.</p>
        </div>
      </div>

      {/* Attendee List Section */}
      <div id="attendee-list" className="glass-panel p-6 md:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
            <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Total Admitted</p>
            <p className="text-emerald-800 text-2xl font-black">{attendees.filter(a => a.entryStatus).length}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
            <p className="text-amber-600 text-xs font-bold uppercase tracking-wider">Food Distributed</p>
            <p className="text-amber-800 text-2xl font-black">{attendees.filter(a => a.foodStatus).length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">Pending Entry</p>
            <p className="text-blue-800 text-2xl font-black">{attendees.filter(a => !a.entryStatus).length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Total Attendees</p>
            <p className="text-slate-800 text-2xl font-black">{attendees.length}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Attendee List & Status</h3>
              <p className="text-sm text-slate-500">{attendees.length} total entries</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleSendBulkEmails} 
              disabled={bulkLoading || attendees.filter(a => !a.emailSent).length === 0}
              className="premium-button bg-brand-600 hover:bg-brand-700 text-sm py-2 px-4 flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              {bulkLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send size={16} />}
              Bulk Emails
            </button>
            <button onClick={fetchAttendees} className="secondary-button text-sm py-2 px-4">
              Refresh
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <input 
            type="text" 
            placeholder="Search by name or roll..."
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            value={filterEntry}
            onChange={(e) => setFilterEntry(e.target.value)}
          >
            <option value="all">Entry: All</option>
            <option value="entry_done">Entry: Done</option>
            <option value="entry_pending">Entry: Pending</option>
          </select>
          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            value={filterFood}
            onChange={(e) => setFilterFood(e.target.value)}
          >
            <option value="all">Food: All</option>
            <option value="food_done">Food: Done</option>
            <option value="food_pending">Food: Pending</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm font-semibold">
                <th className="p-4 border-b">Attendee</th>
                <th className="p-4 border-b">Roll No</th>
                <th className="p-4 border-b text-center">Entry Status</th>
                <th className="p-4 border-b text-center">Food Status</th>
                <th className="p-4 border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendees
                .filter(a => {
                  const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                       a.roll.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesEntry = filterEntry === 'all' || 
                                      (filterEntry === 'entry_done' && a.entryStatus) || 
                                      (filterEntry === 'entry_pending' && !a.entryStatus);
                  const matchesFood = filterFood === 'all' || 
                                     (filterFood === 'food_done' && a.foodStatus) || 
                                     (filterFood === 'food_pending' && !a.foodStatus);
                  return matchesSearch && matchesEntry && matchesFood;
                })
                .length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 italic">
                    No results found matching your filters.
                  </td>
                </tr>
              ) : (
                attendees
                  .filter(a => {
                    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                         a.roll.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesEntry = filterEntry === 'all' || 
                                        (filterEntry === 'entry_done' && a.entryStatus) || 
                                        (filterEntry === 'entry_pending' && !a.entryStatus);
                    const matchesFood = filterFood === 'all' || 
                                       (filterFood === 'food_done' && a.foodStatus) || 
                                       (filterFood === 'food_pending' && !a.foodStatus);
                    return matchesSearch && matchesEntry && matchesFood;
                  })
                  .map(a => (
                    <tr key={a._id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.emailSent ? '📧 QR Sent' : '⏳ QR Not Sent'}</p>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">{a.roll}</td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                            a.entryStatus 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}>
                            {a.entryStatus ? 'Checked In' : 'Pending'}
                          </span>
                          {a.entryScannedAt && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              {new Date(a.entryScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                            a.foodStatus 
                              ? 'bg-amber-50 text-amber-700 border-amber-100' 
                              : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}>
                            {a.foodStatus ? 'Collected' : 'Pending'}
                          </span>
                          {a.foodScannedAt && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              {new Date(a.foodScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleSendManualEmail(a._id)}
                          disabled={!a.email || emailLoading === a._id}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            !a.email 
                              ? 'text-slate-300 cursor-not-allowed bg-slate-50' 
                              : a.emailSent
                                ? 'text-brand-600 bg-white border border-brand-200 hover:bg-brand-50'
                                : 'text-white bg-brand-600 hover:bg-brand-700'
                          }`}
                        >
                          {emailLoading === a._id ? (
                            <Loader2 className="animate-spin w-3 h-3" />
                          ) : (
                            <Mail size={14} />
                          )}
                          <span>{a.emailSent ? 'Resend' : 'Send'}</span>
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
