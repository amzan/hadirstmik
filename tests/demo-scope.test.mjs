import test from 'node:test';
import assert from 'node:assert/strict';
import { demoScope, assertDemoScope, scopedReference } from '../backend/demo-scope.mjs';
import { listEntity, writeRecord } from '../backend/domain.mjs';
import { prepareImport } from '../backend/importer.mjs';
import { fixture } from './fixtures.mjs';

test('demo scope defaults real and explicit admin demo selection wins', () => {
  assert.equal(demoScope({}),0);
  assert.equal(demoScope({isDemo:true}),1);
  assert.equal(demoScope({isDemo:false,demoScope:true}),1);
  assert.throws(()=>assertDemoScope({is_demo:1},{isDemo:false}));
  assert.throws(()=>assertDemoScope({is_demo:0},{isDemo:true}));
  assertDemoScope({is_demo:1},{isDemo:true});
});

test('scoped references require actual same-scope row', async () => {
  const db={execute:async(sql,values)=>{
    assert.equal(sql,'SELECT * FROM schedules WHERE id=?');
    assert.deepEqual(values,['demo-schedule']);
    return [[]];
  }};
  await assert.rejects(scopedReference(db,'schedules','id','demo-schedule',1));
});

test('all domain lists enforce scope including indirect leave scope', async () => {
  for(const entity of ['users','students','rombels','courses','schedules','attendance-sessions','attendance-records','leave-requests']){
    const queries=[];
    const db={execute:async(sql,values)=>{
      queries.push({sql,values});
      return [sql.includes('COUNT(*)')?[{total:0}]:[]];
    }};
    await listEntity(db,{id:'admin',role:'admin',demoScope:true},entity);
    assert.equal(queries.length,2);
    for(const {sql,values} of queries){
      assert.match(sql,entity==='leave-requests'?/scoped_student\.is_demo=\?/:/t\.is_demo=\?/);
      assert.equal(values[0],1);
    }
  }
});

test('cross-scope attendance writes stop before querying or mutation', async () => {
  const db={execute:async()=>assert.fail('must reject before database mutation')};
  await assert.rejects(writeRecord(db,'actor',{id:'session',is_demo:1},{nim:'real',is_demo:0},'HADIR','QR_SCAN',''));
});

test('real backup demo flags preserve legacy candidate hash and demo imports fail closed', () => {
  const source=fixture(), original=JSON.stringify(source), previous=prepareImport(source);
  for(const values of Object.values(source)) if(Array.isArray(values)) for(const row of values) row.isDemo=false;
  const tagged=prepareImport(source);
  assert.equal(tagged.valid,true);
  assert.equal(tagged.sourceHash,previous.sourceHash);
  assert.equal(JSON.stringify(tagged.data),JSON.stringify(previous.data));
  source.users[0].isDemo=true;
  assert(prepareImport(source).issues.some(issue=>issue.code==='DEMO_IMPORT_FORBIDDEN'));
  assert.equal(JSON.stringify(fixture()),original);
});
