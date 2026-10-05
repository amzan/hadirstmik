import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceStatus } from '../../types/attendance';
import { CloseSessionDialog } from './CloseSessionDialog';
import { X, Search, Save, CheckCheck, Lock } from 'lucide-react';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSessionId?: string | null;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  defaultSessionId,
}) => {
  const {
    currentUser,
    sessions,
    records,
    getStudentsForRombel,
    markStudentAttendanceDirectly,
    batchMarkAttendance,
    closeSession,
    createSession,
  } = useAttendance();

  const mySessions = sessions.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    defaultSessionId || mySessions[0]?.id || sessions[0]?.id || ''
  );

  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  useEffect(() => {
    if (defaultSessionId) {
      setSelectedSessionId(defaultSessionId);
    } else if (!selectedSessionId && mySessions.length > 0) {
      setSelectedSessionId(mySessions[0].id);
    }
  }, [defaultSessionId, mySessions]);

  const [searchQuery, setSearchQuery] = useState('');
  const [localStatuses, setLocalStatuses] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const activeSession = sessions.find(s => s.id === selectedSessionId) || mySessions[0] || sessions[0];
  const enrolledStudents = activeSession ? getStudentsForRombel(activeSession.rombel) : [];

  // Switch or create meeting session on demand
  const handleSwitchMeeting = (meetingNum: number) => {
    if (!activeSession) return;
    let target = sessions.find(
      s => s.courseCode === activeSession.courseCode && s.rombel === activeSession.rombel && s.meetingNumber === meetingNum
    );

    if (!target) {
      target = createSession({
        scheduleId: activeSession.scheduleId,
        courseCode: activeSession.courseCode,
        courseName: activeSession.courseName,
        rombel: activeSession.rombel,
        room: activeSession.room,
        meetingNumber: meetingNum,
        topic: `Perkuliahan Pertemuan ${meetingNum}: ${activeSession.courseName}`,
        isDynamicQr: false,
      });
    }

    setSelectedSessionId(target.id);
  };

  // Initialize local state whenever session changes or modal opens
  useEffect(() => {
    if (!activeSession) return;
    const initialMap: Record<string, { status: AttendanceStatus; notes: string }> = {};

    enrolledStudents.forEach(stu => {
      const rec = records.find(r => r.sessionId === activeSession.id && r.studentNim === stu.nim);
      if (rec) {
        initialMap[stu.nim] = {
          status: rec.status,
          notes: rec.notes || '',
        };
      } else {
        initialMap[stu.nim] = {
          status: 'ALPHA',
          notes: '',
        };
      }
    });

    setLocalStatuses(initialMap);
    setSaveSuccessMessage(null);
  }, [selectedSessionId, isOpen, records.length]);

  if (!isOpen) return null;

  const handleSetStudentStatus = (nim: string, status: AttendanceStatus) => {
    setLocalStatuses(prev => ({
      ...prev,
      [nim]: {
        ...prev[nim],
        status,
      },
    }));

    if (activeSession) {
      markStudentAttendanceDirectly(activeSession.id, nim, status);
    }
  };

  const handleNoteChange = (nim: string, notes: string) => {
    setLocalStatuses(prev => ({
      ...prev,
      [nim]: {
        ...prev[nim],
        notes,
      },
    }));
  };

  const handleMarkAllHadir = () => {
    if (!activeSession) return;
    const updates: { studentNim: string; status: AttendanceStatus; notes?: string }[] = [];
    const updatedLocal = { ...localStatuses };

    enrolledStudents.forEach(stu => {
      updatedLocal[stu.nim] = { status: 'HADIR', notes: updatedLocal[stu.nim]?.notes || '' };
      updates.push({
        studentNim: stu.nim,
        status: 'HADIR',
        notes: updatedLocal[stu.nim]?.notes,
      });
    });

    setLocalStatuses(updatedLocal);
    batchMarkAttendance(activeSession.id, updates);
    setSaveSuccessMessage('Seluruh mahasiswa ditandai Hadir.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleMarkUnscannedAsHadir = () => {
    if (!activeSession) return;
    const updates: { studentNim: string; status: AttendanceStatus; notes?: string }[] = [];
    const updatedLocal = { ...localStatuses };

    enrolledStudents.forEach(stu => {
      if (updatedLocal[stu.nim]?.status === 'ALPHA') {
        updatedLocal[stu.nim] = { status: 'HADIR', notes: 'Disahkan Dosen Manual' };
        updates.push({
          studentNim: stu.nim,
          status: 'HADIR',
          notes: 'Disahkan Dosen Manual',
        });
      }
    });

    setLocalStatuses(updatedLocal);
    batchMarkAttendance(activeSession.id, updates);
    setSaveSuccessMessage('Mahasiswa Alpha berhasil dialihkan ke Hadir.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleSaveAll = () => {
    if (!activeSession) return;
    const updates = Object.entries(localStatuses).map(([nim, data]) => ({
      studentNim: nim,
      status: data.status,
      notes: data.notes,
    }));

    batchMarkAttendance(activeSession.id, updates);
    setSaveSuccessMessage('Data presensi tersimpan.');
    setTimeout(() => {
      setSaveSuccessMessage(null);
      onClose();
    }, 800);
  };

  const filteredStudents = enrolledStudents.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nim.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const counts = {
    hadir: Object.values(localStatuses).filter(v => v.status === 'HADIR').length,
    izin: Object.values(localStatuses).filter(v => v.status === 'IZIN').length,
    sakit: Object.values(localStatuses).filter(v => v.status === 'SAKIT').length,
    alpha: Object.values(localStatuses).filter(v => v.status === 'ALPHA').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Lembar Presensi Manual (Roll-Call)
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Ubah atau tetapkan status kehadiran mahasiswa per sesi perkuliahan
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Session Pick, Meeting Number, Counts & Fast Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <label className="text-slate-600 font-medium">Kelas:</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:outline-none focus:border-slate-500 max-w-[240px] truncate text-sm"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.courseCode}] {s.courseName} ({s.rombel})
                  </option>
                ))}
              </select>
            </div>

            {activeSession && (
              <div className="flex items-center gap-2">
                <label className="text-slate-600 font-medium">Pertemuan:</label>
                <select
                  value={activeSession.meetingNumber}
                  onChange={(e) => handleSwitchMeeting(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer text-sm"
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map(num => {
                    const marker = num === 8 ? ' (UTS)' : num === 16 ? ' (UAS)' : '';
                    return (
                      <option key={num} value={num}>
                        P{num}{marker}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3.5 text-sm font-medium text-slate-600">
            <span>Hadir: <strong className="text-emerald-700">{counts.hadir}</strong></span>
            <span>Izin: <strong className="text-blue-700">{counts.izin}</strong></span>
            <span>Sakit: <strong className="text-amber-700">{counts.sakit}</strong></span>
            <span>Alpha: <strong className="text-rose-700">{counts.alpha}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllHadir}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-sm font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Semua Hadir</span>
            </button>

            <button
              onClick={handleMarkUnscannedAsHadir}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-sm font-medium transition cursor-pointer"
            >
              <span>Hadirkan Sisa Alpha</span>
            </button>
          </div>
        </div>

        {/* Search & Status message */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari NIM atau nama mahasiswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:border-slate-500"
            />
          </div>

          {saveSuccessMessage && (
            <span className="text-sm text-emerald-700 font-medium">
              ✓ {saveSuccessMessage}
            </span>
          )}
        </div>

        {/* Students Table */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 text-slate-600 font-semibold z-10">
              <tr>
                <th className="py-2.5 px-3 w-12">No</th>
                <th className="py-2.5 px-3 w-28">NIM</th>
                <th className="py-2.5 px-3">Nama Lengkap</th>
                <th className="py-2.5 px-3 text-center w-52">Status Kehadiran</th>
                <th className="py-2.5 px-3 w-48">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    Mahasiswa tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const current = localStatuses[student.nim] || { status: 'ALPHA', notes: '' };

                  return (
                    <tr key={student.nim} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-900 font-medium">{student.nim}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{student.name}</td>

                      {/* 4 Clean Action Buttons */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(student.nim, 'HADIR')}
                            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                              current.status === 'HADIR'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(student.nim, 'IZIN')}
                            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                              current.status === 'IZIN'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(student.nim, 'SAKIT')}
                            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                              current.status === 'SAKIT'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(student.nim, 'ALPHA')}
                            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                              current.status === 'ALPHA'
                                ? 'bg-rose-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Alpha
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="Catatan..."
                          value={current.notes}
                          onChange={(e) => handleNoteChange(student.nim, e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:border-slate-400"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
          <span className="text-slate-500 font-medium">
            Perubahan otomatis tersinkronisasi.
          </span>
          <div className="flex items-center gap-2.5">
            {activeSession?.isOpen && (
              <button
                type="button"
                onClick={() => setIsCloseDialogOpen(true)}
                className="px-4 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold cursor-pointer transition flex items-center gap-1.5"
                title="Tutup sesi jika tidak ada presensi yang ingin diubah lagi"
              >
                <Lock className="w-4 h-4" />
                <span>Akhiri Sesi Kuliah</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      </div>

      <CloseSessionDialog
        isOpen={isCloseDialogOpen}
        session={activeSession}
        onClose={() => setIsCloseDialogOpen(false)}
        onConfirm={() => {
          if (activeSession) {
            closeSession(activeSession.id);
            setIsCloseDialogOpen(false);
            onClose();
          }
        }}
      />
    </div>
  );
};
