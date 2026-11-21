import { rows, transaction, audit } from './database.mjs';
import { hashPassword, password, requireValue } from './security.mjs';

export const demoIds = Object.freeze({ lecturer: 'demo-lecturer-alex', student: 'demo-student-udin', course: 'demo-course-matematika-semesta', schedule: 'demo-schedule-matematika-semesta', rombel: 'demo-rombel-ti', nim: '26TI2026', nidn: '010101', courseCode: 'DEMO-MAT-001', rombelCode: 'DEMO-TI' });

export async function provisionDemo(pool, initialPassword) {
  password(initialPassword);
  const d = demoIds;
  return transaction(pool, async db => {
    await rows(db, 'SELECT id FROM users ORDER BY id FOR UPDATE');
    const accounts = await rows(db, 'SELECT id,username,nidn,is_demo,role FROM users WHERE id IN (?,?)', [d.lecturer,d.student]);
    for (const [id, identifier, role] of [[d.lecturer,d.nidn,'dosen'],[d.student,d.nim,'mahasiswa']]) {
      const account = accounts.find(row => row.id === id);
      requireValue(!account || (account.is_demo && account.role === role && account.username === identifier), 'DEMO_IDENTITY_CONFLICT', 409);
      requireValue(!(await rows(db, 'SELECT id FROM users WHERE id<>? AND (username=? OR nidn=? OR login_alias=?) LIMIT 1 FOR UPDATE', [id,identifier,identifier,identifier])).length, 'DEMO_IDENTITY_CONFLICT', 409);
    }
    const targets = [['students','nim',d.nim],['courses','id',d.course],['schedules','id',d.schedule],['rombels','id',d.rombel]];
    for (const [table,key,value] of targets) {
      const [old] = await rows(db, `SELECT is_demo FROM ${table} WHERE ${key}=? FOR UPDATE`, [value]);
      requireValue(!old || old.is_demo, 'DEMO_IDENTITY_CONFLICT', 409);
    }
    requireValue(!(await rows(db,'SELECT id FROM courses WHERE code=? AND id<>? FOR UPDATE',[d.courseCode,d.course])).length,'DEMO_IDENTITY_CONFLICT',409);
    requireValue(!(await rows(db,'SELECT id FROM rombels WHERE code=? AND id<>? FOR UPDATE',[d.rombelCode,d.rombel])).length,'DEMO_IDENTITY_CONFLICT',409);
    const [student] = await rows(db,'SELECT user_id FROM students WHERE nim=?',[d.nim]);
    requireValue(!student || student.user_id === d.student,'DEMO_IDENTITY_CONFLICT',409);
    if (accounts.length) {
      requireValue(accounts.length===2 && student && (await rows(db,'SELECT id FROM courses WHERE id=? AND is_demo=1',[d.course])).length && (await rows(db,'SELECT id FROM schedules WHERE id=? AND is_demo=1',[d.schedule])).length && (await rows(db,'SELECT id FROM rombels WHERE id=? AND is_demo=1',[d.rombel])).length,'DEMO_PROVISION_PARTIAL',409);
      return { created:false, accounts:2, students:1, courses:1, schedules:1 };
    }
    for (const [id,username,name,role,email,nidn] of [[d.lecturer,d.nidn,'Alex','dosen','alex.demo@example.invalid',d.nidn],[d.student,d.nim,'Udin','mahasiswa','udin.demo@example.invalid',null]]) {
      await rows(db,'INSERT INTO users (id,username,name,role,email,nidn,prodi,is_active,is_demo) VALUES (?,?,?,?,?,?,?,1,1)',[id,username,name,role,email,nidn,'Teknologi Informasi']);
      await rows(db,'INSERT INTO user_credentials (user_id,password_hash,must_change_password) VALUES (?,?,FALSE)',[id,await hashPassword(initialPassword)]);
    }
    await rows(db,'INSERT INTO students (nim,name,email,prodi,user_id,is_active,is_demo) VALUES (?,?,?,?,?,1,1)',[d.nim,'Udin','udin.demo@example.invalid','Teknologi Informasi',d.student]);
    await rows(db,'INSERT INTO rombels (id,code,name,prodi,semester,academic_year,is_demo) VALUES (?,?,?,?,1,?,1)',[d.rombel,d.rombelCode,'Rombel DEMO','Teknologi Informasi','2026/2027']);
    await rows(db,'INSERT INTO courses (id,code,name,sks,prodi,semester,default_lecturer_id,default_lecturer_name,is_demo) VALUES (?,?,?,2,?,1,?,?,1)',[d.course,d.courseCode,'Matematika Semesta','Teknologi Informasi',d.lecturer,'Alex']);
    await rows(db,'INSERT INTO schedules (id,day,start_time,end_time,course_code,course_name,sks,lecturer_id,lecturer_name,room,rombel,prodi,is_demo) VALUES (?,\'Senin\',\'08:00\',\'09:30\',?,?,2,?,?,?,?,?,1)',[d.schedule,d.courseCode,'Matematika Semesta',d.lecturer,'Alex','RUANG DEMO',d.rombelCode,'Teknologi Informasi']);
    await rows(db,'INSERT INTO student_rombels (student_nim,rombel_id) VALUES (?,?)',[d.nim,d.rombel]);
    await rows(db,'INSERT INTO rombel_schedules (rombel_id,schedule_id) VALUES (?,?)',[d.rombel,d.schedule]);
    await audit(db,null,'DEMO_PROVISIONED','course',d.course);
    return { created:true, accounts:2, students:1, courses:1, schedules:1 };
  });
}
