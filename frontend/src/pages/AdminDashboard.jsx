import { useState } from 'react';
import { Upload, FileSpreadsheet, Download, Settings, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ name: '', roll: '', email: '' });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      
      // Auto-guess mapping if possible
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
      setError(err.response?.data?.error || 'Failed to parse Excel file. Is it valid?');
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

      // trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Processed_Attendees_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setStep(3);
    } catch (err) {
      setError('Failed to upload and process Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setStep(1);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:py-12 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Admin Dashboard</h2>
          <p className="text-slate-500 mt-1">Upload and map Excel datasets to generate QR codes.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Progress Sidebar */}
        <div className="glass-panel p-6 space-y-6 h-fit hidden md:block">
          <h3 className="font-bold text-slate-700 border-b pb-2">Steps</h3>
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
              Download
            </li>
          </ul>
        </div>

        {/* Content Area */}
        <div className="glass-panel p-6 md:p-8 md:col-span-2 space-y-8">
          
          {step === 1 && (
            <div className="text-center space-y-6 py-6">
              <div className="mx-auto w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mb-4 transition-transform hover:scale-105">
                {loading ? <Loader2 className="animate-spin w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Upload Dataset</h3>
                <p className="text-slate-500 text-sm mt-1">Supports exactly .xlsx or .xls</p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition active:scale-95 shadow-lg">
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
              <p className="text-slate-600 text-sm">Select which column in your Excel file corresponds to our database fields.</p>
              
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {Object.keys(mapping).map(key => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-semibold text-slate-700 min-w-24 capitalize">{key} {key!=='email' && <span className="text-red-500">*</span>}</label>
                    <select 
                      className="flex-1 max-w-sm px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
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
                <button 
                  onClick={resetState}
                  className="secondary-button"
                >Cancel</button>
                <button 
                  onClick={handleUpload}
                  disabled={loading}
                  className="premium-button flex-[2]"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5"/> : 'Process & Generate QR'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-6 py-6 animate-in zoom-in-95 fade-in duration-500">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 shadow-inner">
                <Download className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Download Complete!</h3>
                <p className="text-slate-500 mt-2">A ZIP file containing your Processed Excel and a 'qrs' folder full of generated Images has been safely downloaded.</p>
              </div>
              <button 
                onClick={resetState}
                className="inline-flex mt-6 items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition border"
              >
                Upload Another
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
