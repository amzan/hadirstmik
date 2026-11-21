import { api } from '../../utils/api';
import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { X, Send, FileText } from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, submitLeaveRequest } = useAttendance();

  const [recipients,setRecipients]=useState<Array<{id:string;name:string}>>([]),[recipientIds,setRecipientIds]=useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const recipientInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingRecipients(true);
    api<Array<{id:string;name:string}>>('/leave-recipients')
      .then(value => { if (!cancelled) setRecipients(value); })
      .catch(error => { if (!cancelled) setErrorMessage(error.message); })
      .finally(() => { if (!cancelled) setLoadingRecipients(false); });
    return () => { cancelled = true; };
  }, [isOpen, currentUser.id]);
  const [type, setType] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  useEffect(() => {
    if (suggestionsOpen) document.getElementById(`leave-recipient-option-${activeSuggestion}`)?.scrollIntoView({ block: 'nearest' });
  }, [suggestionsOpen, activeSuggestion, query]);

  if (!isOpen) return null;

  const suggestions = recipients.filter(recipient => !recipientIds.includes(recipient.id) && recipient.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
  const chooseRecipient = (id: string) => {
    setRecipientIds(previous => previous.includes(id) ? previous : [...previous, id]);
    setQuery('');
    setActiveSuggestion(0);
    setSuggestionsOpen(false);
    recipientInput.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!recipientIds.length) {
      setErrorMessage('Pilih minimal satu dosen penerima dari saran pencarian.');
      recipientInput.current?.focus();
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Mohon cantumkan alasan atau keterangan izin/sakit.');
      return;
    }
    setErrorMessage('');
    submitting.current = true;
    setIsSubmitting(true);
    try {
    await submitLeaveRequest({
      studentNim: currentUser.username,
      studentName: currentUser.name,
      recipientIds,
      rombel: currentUser.rombel || 'TI 3',
      date,
      type,
      reason,
    });

    setIsSubmitted(true);
    setTimeout(async () => {
      setIsSubmitted(false);
      onClose();
    }, 1500);
    } catch(error) { setErrorMessage(error instanceof Error ? error.message : 'Permintaan gagal.'); }
    finally { submitting.current = false; setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-label="Form Pengajuan Izin / Sakit" className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg max-h-[90dvh] w-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-slate-800" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Form Pengajuan Izin / Sakit</h3>
              <p className="text-sm text-slate-500">Pengajuan akan diverifikasi oleh dosen pengampu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Pengajuan Terkirim!</h4>
            <p className="text-sm text-slate-600 mt-1">
              Surat permohonan izin/sakit Anda telah masuk ke sistem dosen untuk ditinjau.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
            {errorMessage && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg font-medium">
                {errorMessage}
              </div>
            )}

            {/* Student Info */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-1">
              <div className="font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-slate-500">NIM: <strong className="font-mono text-slate-800">{currentUser.username}</strong> · Rombel: {currentUser.rombel || 'Reguler'}</div>
            </div>

            {/* Type */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Jenis Keterangan</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('IZIN')}
                  className={`py-2 px-3 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    type === 'IZIN'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Izin (Dispensasi)
                </button>
                <button
                  type="button"
                  onClick={() => setType('SAKIT')}
                  className={`py-2 px-3 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    type === 'SAKIT'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Sakit
                </button>
              </div>
            </div>

            <div onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setSuggestionsOpen(false); }}>
              <label htmlFor="leave-recipient-search" className="block font-semibold text-slate-700 mb-1.5">Dosen Penerima</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {recipientIds.map(id => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-800">
                  <span className="break-words">{recipients.find(recipient => recipient.id === id)?.name}</span>
                  <button type="button" aria-label={`Hapus penerima ${recipients.find(recipient => recipient.id === id)?.name}`} onClick={() => setRecipientIds(previous => previous.filter(value => value !== id))} className="rounded p-1 hover:bg-slate-200"><X className="h-4 w-4" /></button>
                </span>)}
              </div>
              <input ref={recipientInput} id="leave-recipient-search" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="leave-recipient-options" aria-activedescendant={suggestionsOpen && suggestions[activeSuggestion] ? `leave-recipient-option-${activeSuggestion}` : undefined} autoComplete="off" placeholder="Ketik nama dosen..." value={query}
                onFocus={() => setSuggestionsOpen(true)}
                onChange={event => { setQuery(event.target.value); setActiveSuggestion(0); setSuggestionsOpen(true); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); setSuggestionsOpen(true);
                    setActiveSuggestion(previous => suggestions.length ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length : 0);
                  } else if (event.key === 'Enter' && suggestionsOpen) {
                    event.preventDefault(); if (suggestions[activeSuggestion]) chooseRecipient(suggestions[activeSuggestion].id);
                  } else if (event.key === 'Escape') { event.preventDefault(); setSuggestionsOpen(false); }
                  else if (event.key === 'Backspace' && !query && recipientIds.length) setRecipientIds(previous => previous.slice(0, -1));
                }} className="w-full px-3.5 py-2 border border-slate-300 rounded-lg" />
              {suggestionsOpen && <ul id="leave-recipient-options" role="listbox" aria-label="Saran dosen penerima" className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {loadingRecipients ? <li className="px-3 py-2 text-slate-500">Memuat dosen...</li> : suggestions.length ? suggestions.map((recipient, index) => <li key={recipient.id} id={`leave-recipient-option-${index}`} role="option" aria-selected={index === activeSuggestion} onMouseDown={event => event.preventDefault()} onClick={() => chooseRecipient(recipient.id)} className={`cursor-pointer px-3 py-2 break-words ${index === activeSuggestion ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>{recipient.name}</li>) : <li className="px-3 py-2 text-slate-500">Tidak ada dosen yang cocok.</li>}
              </ul>}
              <p className="mt-1 text-xs text-slate-500">Pilih minimal satu dosen dari saran. Anda dapat memilih beberapa dosen.</p>
            </div>

            {/* Date */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Tanggal Tidak Hadir</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Alasan / Penjelasan
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Tuliskan keterangan lengkap izin atau sakit..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || loadingRecipients}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengirim...' : 'Kirim Permohonan'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
