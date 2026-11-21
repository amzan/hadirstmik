import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import * as XLSX from 'xlsx';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

await mkdir('.cache/pdf-history-test', { recursive: true });
const entry = resolve('.cache/pdf-history-test/generator.mjs');
await build({ entryPoints: ['src/utils/pdfGenerator.ts'], outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
const { generateSessionAttendancePDF, generateAttendancePDF, generateKartuPresensiPDF } = await import(pathToFileURL(entry).href);
const config = { courseCode: 'SYNTH', courseName: 'Synthetic Course', lecturerName: 'Synthetic Lecturer', rombel: 'TI 1A', sks: 2, prodi: 'Teknologi Informasi' };
const session = { id: 'session-a', academicPeriod: 'SYNTH-2026-A', scheduleId: 'schedule-a', lecturerId: 'lecturer-a', courseCode: 'SYNTH', courseName: 'Synthetic Course', lecturerName: 'Historical Lecturer', rombel: 'Historical Label', date: '2026-11-20', meetingNumber: 1, topic: 'Synthetic topic', studentNims: ['N1', 'N2', 'N3', 'N4', 'N5'], isOpen: false };
const students = session.studentNims.map((nim, i) => ({ nim, name: `Synthetic Student ${i + 1}`, prodi: 'Teknologi Informasi', rombel: 'Current unrelated class', email: '' }));
const records = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].map((status, i) => ({ id: `r${i}`, sessionId: session.id, studentNim: `N${i + 1}`, studentName: `Recorded Student ${i + 1}`, status }));
records.push({ id: 'outside', sessionId: 'session-other', studentNim: 'N5', studentName: 'Must Not Appear', status: 'HADIR' });

test('session PDF uses exact session records and frozen roster, preserves all statuses and missing entries', () => {
  const doc = generateSessionAttendancePDF(config, session, students, records, false);
  const text = doc.output();
  for (const expected of ['Synthetic Course', 'Historical Label', 'Historical Lecturer', '2026-11-20', 'N1', 'N5', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Belum tercatat']) assert(text.includes(expected), expected);
  assert(!text.includes('Must Not Appear'));
  assert(!text.includes('Current unrelated class'));
  const table = doc.lastAutoTable.body[0].cells;
  assert.deepEqual(Object.values(table).map(cell => cell.text.join(' ')), ['1', '1', '1', '1', '1', '5']);
});

test('session PDF with no records never fabricates attendance', () => {
  const doc = generateSessionAttendancePDF(config, { ...session, studentNims: [] }, students, [], false);
  assert(doc.output().includes('Tidak ada peserta/record terverifikasi'));
  assert.deepEqual(Object.values(doc.lastAutoTable.body[0].cells).map(cell => cell.text.join(' ')), ['0', '0', '0', '0', '0', '0']);
});

test('matrix keeps raw statuses and separates effective attendance and tolerance', () => {
  const doc = generateAttendancePDF(config, students, [session], records, false);
  const rows = doc.lastAutoTable.body.map(row => Object.values(row.cells).map(cell => cell.text.join(' ')));
  assert.deepEqual(rows[0].slice(-6), ['1', '0', '0', '0', '1 / 0', '100%']);
  assert.deepEqual(rows[1].slice(-6), ['0', '1', '0', '0', '1 / 1', '100%']);
  assert.deepEqual(rows[4].slice(-7), ['BT', '0', '0', '0', '0', '0 / 0', '0%']);
});

test('long names and session metadata wrap, repeated table headers and summary fit on multipage PDF', async () => {
  const people = Array.from({ length: 100 }, (_, i) => ({ ...students[0], nim: `LONG${i}`, name: `Student ${i} ${'Synthetic long name '.repeat(7)}` }));
  const longSession = { ...session, studentNims: people.map(person => person.nim), courseName: 'Long synthetic course '.repeat(8), lecturerName: 'Synthetic lecturer '.repeat(6), topic: 'Synthetic topic '.repeat(25) };
  const doc = generateSessionAttendancePDF(config, longSession, people, [], false);
  assert(doc.getNumberOfPages() > 3);
  assert(doc.output().includes('LONG99'));
  const table = doc.lastAutoTable;
  assert(table.finalY <= doc.internal.pageSize.getHeight() - 18);
  assert.equal(table.body[0].cells[4].text[0], '100');
  await writeFile('.cache/pdf-history-test/multipage.pdf', Buffer.from(doc.output('arraybuffer')));
});


test('new report reflects committed correction, Jakarta timestamp and archive label without mixing attempts', () => {
  const stamp = '2026-11-21T00:01:02.000Z';
  const initial = generateSessionAttendancePDF({ ...config, generatedAt: stamp }, session, students, records, false);
  const corrected = records.map(record => record.studentNim === 'N4' ? { ...record, status: 'HADIR' } : record);
  const fresh = generateSessionAttendancePDF({ ...config, generatedAt: stamp }, session, students, corrected, false);
  assert.equal(initial.lastAutoTable.body[0].cells[0].text[0], '1');
  assert.equal(fresh.lastAutoTable.body[0].cells[0].text[0], '2');
  assert.equal(fresh.lastAutoTable.body[0].cells[3].text[0], '0');
  assert(fresh.output().includes('07.01.02 WIB'));
  const archived = { ...session, archivedAt: stamp };
  assert.throws(() => generateSessionAttendancePDF(config, archived, students, corrected, false), /Arsip/);
  assert(generateSessionAttendancePDF({ ...config, isArchive: true }, archived, students, corrected, false).output().includes('ARSIP'));
  const regular = generateAttendancePDF(config, students, [archived], corrected, false);
  assert(!regular.output().includes('P1 ('));
});


test('PDF evaluates selected sessions against full period and recalculates after correction without mutating records', () => {
  const allSessions = Array.from({ length: 4 }, (_, index) => ({ ...session, id: `p${index + 1}`, meetingNumber: index + 1, studentNims: ['N1'] }));
  const source = allSessions.map((value, index) => ({ ...records[0], id: `policy-${index}`, sessionId: value.id, status: 'IZIN' }));
  const before = JSON.stringify(source);
  const configFull = { ...config, policySessions: allSessions, policyRecords: source };
  const doc = generateAttendancePDF(configFull, [students[0]], [allSessions[2]], source, false);
  assert.deepEqual(Object.values(doc.lastAutoTable.body[0].cells).map(cell => cell.text.join(' ')).slice(-6), ['0', '1', '0', '0', '0 / 0', '0%']);
  const detail = generateSessionAttendancePDF(configFull, allSessions[2], [students[0]], source, false);
  assert(detail.output().includes('Dihitung Alpa'));
  assert.equal(JSON.stringify(source), before);
  const changed = source.map((value, index) => index === 0 ? { ...value, status: 'HADIR' } : value);
  const fresh = generateAttendancePDF({ ...configFull, policyRecords: changed }, [students[0]], [allSessions[2]], changed, false);
  assert.deepEqual(Object.values(fresh.lastAutoTable.body[0].cells).map(cell => cell.text.join(' ')).slice(-2), ['1 / 1', '100%']);
});

test('effective report fails closed when academic period is unknown; archive raw report remains available', () => {
  const unresolved = { ...session, academicPeriod: undefined };
  assert.throws(() => generateAttendancePDF(config, students, [unresolved], records, false), /Periode akademik/);
  assert.throws(() => generateSessionAttendancePDF(config, unresolved, students, records, false), /Periode akademik/);
  assert(generateSessionAttendancePDF({ ...config, isArchive: true }, { ...unresolved, archivedAt: '2026-11-21' }, students, records, false).output().includes('ARSIP'));
});


test('Excel matrix and teaching log preserve raw counts and match effective PDF policy', async () => {
  const excelEntry = resolve('.cache/pdf-history-test/excel.mjs');
  await build({ entryPoints: ['src/utils/excelGenerator.ts'], outfile: excelEntry, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
  const { generateAttendanceExcel, generateTeachingLogExcel } = await import(pathToFileURL(excelEntry).href);
  const allSessions = Array.from({ length: 3 }, (_, index) => ({ ...session, id: `excel-${index}`, meetingNumber: index + 1, studentNims: ['N1'] }));
  const source = allSessions.map((value, index) => ({ ...records[0], id: `er${index}`, sessionId: value.id, status: 'IZIN' }));
  const before = JSON.stringify(source);
  const fullConfig = { ...config, policySessions: allSessions, policyRecords: source };
  const workbook = generateAttendanceExcel(fullConfig, [students[0]], [allSessions[2]], source, false);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Rekap Presensi'], { header: 1 });
  const header = rows.find(row => row.includes('Hadir Efektif'));
  const studentRow = rows.find(row => row[1] === 'N1');
  assert.equal(studentRow[header.indexOf('Izin (I)')], 1);
  assert.equal(studentRow[header.indexOf('Hadir Efektif')], 0);
  assert.equal(studentRow[header.indexOf('Persentase (%)')], '0%');
  const log = generateTeachingLogExcel(fullConfig, {}, allSessions, source, 1, false);
  const logRows = XLSX.utils.sheet_to_json(log.Sheets['Log Aktivitas Mengajar'], { header: 1 });
  const logHeader = logRows.find(row => row.includes('Hadir Efektif'));
  const third = logRows.find(row => row[1] === 'Pertemuan 3');
  assert.equal(third[logHeader.indexOf('Hadir Efektif')], 0);
  assert.equal(third[logHeader.indexOf('Izin Asli')], 1);
  assert.equal(JSON.stringify(source), before);
});


test('student card separates raw and effective totals and fits all summary columns on A4', () => {
  const rate = { totalSessions: 4, totalHeld: 4, rawHadir: 1, hadir: 3, izin: 3, sakit: 0, rawAlpha: 0, alpha: 1, unrecorded: 0, izinAsHadir: 2, sakitAsHadir: 0, percentage: 75, eligibleExam: true };
  const doc = generateKartuPresensiPDF({ nim: 'N1', name: 'Synthetic Student', prodi: 'TI', rombel: 'TI 1' }, [{ ...config, ...rate }], rate, false);
  const table = doc.lastAutoTable;
  assert.equal(table.body[0].cells[6].text.join(' '), '1 / 3 / 2');
  assert.equal(table.body[0].cells[7].text.join(' '), '3');
  assert.equal(table.body[0].cells[9].text.join(' '), '0');
  assert.equal(table.body[0].cells[11].text.join(' '), '75%');
  const right = table.columns.reduce((sum, column) => sum + column.width, 14);
  assert(right <= doc.internal.pageSize.getWidth() - 14 + 0.01);
});


test('demo session and attendance matrix PDFs are clearly labeled while regular reports stay unmarked', () => {
  const demoSession = { ...session, isDemo: true };
  assert(generateSessionAttendancePDF(config, demoSession, students, records, false).output().includes('DATA DEMO'));
  assert(generateAttendancePDF(config, students, [demoSession], records, false).output().includes('DATA DEMO'));
  assert(!generateSessionAttendancePDF(config, session, students, records, false).output().includes('DATA DEMO'));
});
