import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureLecturerLoginAliases } from '../backend/lecturer-login.mjs';

test('demo alias allocation leaves regular accounts untouched and reserves their identifiers', async () => {
  const accounts = [
    {id:'regular',role:'dosen',name:'Alex',username:'alex',email:'regular@example.invalid',nidn:'real',login_alias:null,is_demo:0},
    {id:'demo',role:'dosen',name:'Alex',username:'010101',email:'demo@example.invalid',nidn:'010101',login_alias:null,is_demo:1},
  ];
  const changed=[];
  const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},async execute(sql,values){
    if(sql.startsWith('SELECT id FROM users WHERE role=')) {assert.deepEqual(values,[1]);return [[{id:'demo'}]];}
    if(sql.startsWith('SELECT id,role,name')) return [accounts];
    if(sql.startsWith('SELECT id FROM users WHERE id<>')) return [[]];
    if(sql.startsWith('UPDATE users')) {changed.push(values);return [{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO audit_logs')) return [{affectedRows:1}];
    assert.fail(sql);
  }};
  await ensureLecturerLoginAliases({...connection,getConnection:async()=>connection},{isDemo:true});
  assert.deepEqual(changed,[['alex2','demo']]);
});
