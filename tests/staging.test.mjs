import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../backend/app.mjs';
import { digest } from '../backend/security.mjs';

test('production requires HTTPS and staging fails closed before serving assets or API', async()=>{
  const config={pool:{execute:async()=>[[{ready:1}]]},origin:'https://staging.example.test',secret:'synthetic-secret-longer-than-32-characters',production:true};
  assert.throws(()=>createApp({...config,origin:'http://staging.example.test'}));
  assert.throws(()=>createApp({...config,staging:true}));
  const app=createApp({...config,staging:true,stagingUsername:'synthetic-stage',stagingPasswordHash:digest('synthetic-stage-password')});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const url=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/','/assets/missing.js','/api/v1/health'])assert.equal((await fetch(url+path)).status,401);
    const response=await fetch(url+'/api/v1/health',{headers:{Authorization:'Basic '+Buffer.from('synthetic-stage:synthetic-stage-password').toString('base64')}});assert.equal(response.status,200);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
