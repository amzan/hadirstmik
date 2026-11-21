import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcelWorkbook } from '../src/utils/excelBulkService.ts';
import { fixture } from './fixtures.mjs';

test('official SheetJS release round-trips synthetic multi-sheet workbook through application parser', async()=>{
  assert.equal(XLSX.version,'0.20.3');
  const book=XLSX.utils.book_new();
  const sheets={Users:[{Username:'synthetic-lecturer',Nama:'Synthetic Lecturer',Role:'dosen',Email:'lecturer@example.test',Password:'ignored-plaintext'}],Students:[{NIM:'0001',Nama:'Synthetic Student',Prodi:'TI',Rombel:'TI 1',Email:'student@example.test'}],Courses:[{'Kode MK':'TEST001','Nama Mata Kuliah':'Synthetic Course',SKS:2,Semester:1,Prodi:'TI','ID Dosen':'lecturer-test'}]};
  for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),name);
  const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const result=await parseExcelWorkbook(new File([bytes],'synthetic.xlsx'),fixture().users,'all');
  assert.equal(result.users.valid.length,1);assert.equal(result.students.valid[0].nim,'0001');assert.equal(result.courses.valid[0].defaultLecturerId,'lecturer-test');assert.equal(result.courses.valid[0].sks,2);
  assert(!JSON.stringify(result.users.valid).includes('ignored-plaintext'));
});

test('spreadsheet validation reports invalid required fields rather than importing partial rows', async()=>{
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{NIM:'0001',Nama:''}]),'Students');
  const result=await parseExcelWorkbook(new File([XLSX.write(book,{type:'buffer',bookType:'xlsx'})],'invalid.xlsx'),[],'students');
  assert.equal(result.students.valid.length,0);assert.equal(result.students.errors.length,1);
});
