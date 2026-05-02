import { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Download, Loader2, Mail, CheckCircle2,
  Users, Send, RefreshCw, Search, Filter, Moon, Sun, LogOut,
  ChevronDown, ScanLine, Utensils, Clock, AlertCircle, X, MessageSquare
} from 'lucide-react';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

/* ── Small reusable Stat Card ────────────────────────────────────── */
function StatCard({ label, value, color, icon }) {
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          {label}
        </p>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

/* ── Status Badge ────────────────────────────────────────────────── */
function StatusBadge({ done, doneLabel = 'Done', pendingLabel = 'Pending', time }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span className={`badge ${done ? 'badge-green' : 'badge-muted'}`}>
        {done ? `✓ ${doneLabel}` : `○ ${pendingLabel}`}
      </span>
      {time && (
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

export default function AdminDashboard({ onLogout }) {
  const [file, setFile]               = useState(null);
  const [headers, setHeaders]         = useState([]);
  const [mapping, setMapping]         = useState({ name: '', roll: '', email: '' });
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [attendees, setAttendees]     = useState([]);
  const [emailLoading, setEmailLoading] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterEntry, setFilterEntry] = useState('all');
  const [filterFood, setFilterFood]   = useState('all');
  const [showEmailConfig, setShowEmailConfig] = useState(false);

  const { dark, setDark } = useTheme();
  const { toast } = useToast();

  useEffect(() => { fetchAttendees(); }, []);

  const fetchAttendees = async () => {
    try {
      const { data } = await api.get('/attendees');
      setAttendees(data);
    } catch (err) {
      console.error('Failed to fetch attendees:', err);
    }
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected); setError(null); setLoading(true);
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
      setMapping(newMapping); setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse Excel file.');
      setFile(null); setStep(1);
    } finally { setLoading(false); }
  };

  const handleUpload = async () => {
    if (!mapping.name || !mapping.roll) { setError('Name and Roll mapping are required!'); return; }
    setError(null); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      const response = await api.post('/attendees/upload-excel', formData, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `QR_Codes_${Date.now()}.zip`);
      document.body.appendChild(link); link.click(); link.parentNode.removeChild(link);
      setStep(3); fetchAttendees();
      toast({ type: 'success', message: 'QR codes generated and downloaded!' });
    } catch {
      setError('Failed to upload and process Excel file.');
      toast({ type: 'error', message: 'Upload failed. Please try again.' });
    } finally { setLoading(false); }
  };

  const handleSendManualEmail = async (id) => {
    setEmailLoading(id);
    try {
      await api.post(`/attendees/send-email/${id}`, { message: customMessage });
      fetchAttendees();
      toast({ type: 'success', message: 'QR email sent successfully!' });
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || 'Failed to send email' });
    } finally { setEmailLoading(null); }
  };

  const handleSendBulkEmails = async () => {
    const pending = attendees.filter(a => !a.emailSent).length;
    if (pending === 0) { toast({ type: 'warning', message: 'All emails already sent!' }); return; }
    if (!window.confirm(`Send QR emails to ${pending} pending attendees?`)) return;
    setBulkLoading(true);
    try {
      const { data } = await api.post('/attendees/send-bulk', { message: customMessage });
      toast({ type: 'success', message: data.message || 'Bulk emails sent!' });
      fetchAttendees();
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || 'Failed to send bulk emails' });
    } finally { setBulkLoading(false); }
  };

  const resetState = () => { setFile(null); setHeaders([]); setStep(1); setError(null); };

  // Filtered attendees
  const filtered = attendees.filter(a => {
    const s = searchTerm.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(s) || a.roll.toLowerCase().includes(s);
    const matchEntry = filterEntry === 'all' || (filterEntry === 'done' ? a.entryStatus : !a.entryStatus);
    const matchFood  = filterFood  === 'all' || (filterFood  === 'done' ? a.foodStatus  : !a.foodStatus);
    return matchSearch && matchEntry && matchFood;
  });

  const stats = {
    total: attendees.length,
    entry: attendees.filter(a => a.entryStatus).length,
    food:  attendees.filter(a => a.foodStatus).length,
    pending: attendees.filter(a => !a.entryStatus).length,
  };

  const S = {
    page:    { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' },
    header:  {
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
      boxShadow: 'var(--shadow-sm)'
    },
    content: { maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 6rem' },
  };

  return (
    <div style={S.page}>
      {/* ── Top Header ── */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ScanLine size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>Admin Dashboard</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setDark(!dark)} className="btn-icon" aria-label="Toggle theme">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={fetchAttendees} className="btn-icon" title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button onClick={onLogout} className="btn btn-sm btn-secondary" style={{ gap: '0.375rem' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main style={S.content}>
        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
          <StatCard label="Total Attendees" value={stats.total} color="var(--brand)" icon={<Users size={20} />} />
          <StatCard label="Admitted" value={stats.entry} color="var(--green)" icon={<ScanLine size={20} />} />
          <StatCard label="Food Served" value={stats.food} color="var(--amber)" icon={<Utensils size={20} />} />
          <StatCard label="Pending Entry" value={stats.pending} color="var(--red)" icon={<AlertCircle size={20} />} />
        </div>

        {/* ── Upload Section ── */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <Upload size={18} style={{ color: 'var(--brand)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Bulk Import</h2>
            {/* Step indicators */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
              {[1,2,3].map(s => (
                <div key={s} style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step >= s ? 'var(--brand)' : 'var(--surface-2)',
                  color: step >= s ? '#fff' : 'var(--text-muted)',
                  border: `2px solid ${step >= s ? 'var(--brand)' : 'var(--border)'}`
                }}>{s}</div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--red-light)', color: 'var(--red)', borderRadius: 10,
              padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
            }}>
              <AlertCircle size={16} />{error}
            </div>
          )}

          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, background: 'var(--brand-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
                color: 'var(--brand)'
              }}>
                {loading ? <Loader2 size={32} className="animate-spin" /> : <FileSpreadsheet size={32} />}
              </div>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>Upload Excel File</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                Select a .xlsx file with attendee details
              </p>
              <label style={{ cursor: 'pointer' }}>
                <span className="btn btn-primary" style={{ pointerEvents: 'none' }}>
                  <Upload size={16} /> Choose File
                </span>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={16} style={{ color: 'var(--brand)' }} /> Map Columns
              </h3>
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', border: '1px solid var(--border)' }}>
                {Object.keys(mapping).map(key => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label style={{ width: 60, fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'capitalize', flexShrink: 0 }}>
                      {key} {key !== 'email' && <span style={{ color: 'var(--red)' }}>*</span>}
                    </label>
                    <select
                      className="input select"
                      style={{ flex: 1, minWidth: 140 }}
                      value={mapping[key]}
                      onChange={e => setMapping({ ...mapping, [key]: e.target.value })}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={resetState} className="btn btn-secondary" style={{ flex: 1, minWidth: 120 }}>Cancel</button>
                <button onClick={handleUpload} disabled={loading} className="btn btn-primary" style={{ flex: 2, minWidth: 180 }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Download size={16} /> Generate QR Codes</>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-slide-up" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, background: 'var(--green-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--green)'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>Done!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                QR codes generated and downloaded. Send emails from the list below.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={resetState} className="btn btn-secondary">Upload Another</button>
                <button onClick={() => document.getElementById('attendee-list')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary">
                  View List ↓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Email Config (collapsible) ── */}
        <div className="card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
          <button
            onClick={() => setShowEmailConfig(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9375rem' }}>
              <MessageSquare size={16} style={{ color: 'var(--brand)' }} /> Email Configuration
            </span>
            <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: showEmailConfig ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showEmailConfig && (
            <div className="animate-fade-in" style={{ padding: '0 1.5rem 1.5rem' }}>
              <hr className="divider" style={{ marginBottom: '1.25rem' }} />
              <label className="input-label" htmlFor="custom-msg">Custom Message (Optional)</label>
              <textarea
                id="custom-msg"
                className="input"
                style={{ height: 100, resize: 'vertical' }}
                placeholder="Write a message to include in the QR email…"
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.375rem' }}>
                This message appears above the QR code in the email.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSendBulkEmails}
                  disabled={bulkLoading || attendees.filter(a => !a.emailSent).length === 0}
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: 160 }}
                >
                  {bulkLoading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={16} /> Bulk Send ({attendees.filter(a => !a.emailSent).length} pending)</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Attendee List ── */}
        <div id="attendee-list" className="card" style={{ overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Attendee List</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.125rem 0 0', fontWeight: 500 }}>
                {filtered.length} of {attendees.length} shown
              </p>
            </div>
            <button onClick={fetchAttendees} className="btn btn-sm btn-secondary">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                type="text"
                placeholder="Search name or roll…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="input select" style={{ flex: '1 1 140px' }} value={filterEntry} onChange={e => setFilterEntry(e.target.value)}>
              <option value="all">Entry: All</option>
              <option value="done">Entry: Done ✓</option>
              <option value="pending">Entry: Pending</option>
            </select>
            <select className="input select" style={{ flex: '1 1 140px' }} value={filterFood} onChange={e => setFilterFood(e.target.value)}>
              <option value="all">Food: All</option>
              <option value="done">Food: Served ✓</option>
              <option value="pending">Food: Pending</option>
            </select>
            {(searchTerm || filterEntry !== 'all' || filterFood !== 'all') && (
              <button className="btn-icon" onClick={() => { setSearchTerm(''); setFilterEntry('all'); setFilterFood('all'); }} title="Clear filters">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Attendee', 'Roll No', 'Entry Status', 'Food Status', 'Action'].map(h => (
                    <th key={h} style={{
                      padding: '0.75rem 1rem', textAlign: h === 'Action' ? 'right' : (h.includes('Status') ? 'center' : 'left'),
                      fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>
                      No attendees match your filters.
                    </td>
                  </tr>
                ) : filtered.map((a, idx) => (
                  <tr key={a._id} style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: idx % 2 === 0 ? 'transparent' : 'var(--surface-2)',
                    transition: 'background 0.15s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--surface-2)'}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{a.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: '0.125rem 0 0', fontWeight: 500 }}>
                        {a.emailSent ? '✉️ QR Sent' : '⏳ Email Pending'}
                      </p>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>
                      {a.roll}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      <StatusBadge done={a.entryStatus} doneLabel="Admitted" pendingLabel="Pending" time={a.entryScannedAt} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      <StatusBadge done={a.foodStatus} doneLabel="Served" pendingLabel="Pending" time={a.foodScannedAt} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleSendManualEmail(a._id)}
                        disabled={!a.email || emailLoading === a._id}
                        className={`btn btn-sm ${a.emailSent ? 'btn-secondary' : 'btn-primary'}`}
                        title={!a.email ? 'No email registered' : a.emailSent ? 'Resend QR' : 'Send QR'}
                      >
                        {emailLoading === a._id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Mail size={14} />}
                        {a.emailSent ? 'Resend' : 'Send'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Watermark */}
      <div className="watermark">Designed by SAMEER LOHANI &amp; VARUN DOBHAL</div>
    </div>
  );
}
