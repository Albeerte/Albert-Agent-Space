import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';

const base='http://127.0.0.1:'+(process.env.OFFICE_PORT||8787);
let cookie='';
async function api(path,body,token) {
  const response=await fetch(base+path,{
    method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(path==='/api/private/ask'?130000:10000),
    headers:{'Content-Type':'application/json',Cookie:cookie,...(token?{Authorization:'Bearer '+token}:{})},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const data=await response.json();
  return {status:response.status,data};
}
async function until(id,status) {
  for(let i=0;i<100;i++) {
    const {data}=await api('/api/tasks/'+id);
    if(data.task.status==='error')throw Error(data.task.error);
    if(data.task.status===status)return data;
    await pause(150);
  }
  throw Error('Demo did not reach '+status);
}
try {
  assert.equal((await api('/healthz')).status,200);
  const session=await api('/api/session');
  if(!session.data.owner)assert.equal((await api('/api/login',{password:process.env.OFFICE_PASSWORD})).status,200);
  const state=await api('/api/state');
  if(!state.data.demo)throw Error('This smoke check needs OFFICE_DEMO=1 and creates labeled synthetic demo records.');
  const it=await api('/api/tasks',{space:'it',demo:true,title:'Smoke / IT '+randomUUID().slice(0,8),description:'O‘zbekcha salomlashish'});
  assert.equal(it.status,201);
  await api('/api/tasks/'+it.data.id+'/run',{});
  const review=await until(it.data.id,'approval');
  assert.equal(review.task.result.test.code,0);
  assert.match(review.task.result.diff,/Assalomu alaykum/);
  assert.equal((await api('/api/tasks/'+it.data.id+'/approval',{decision:'approve',fingerprint:review.approval.fingerprint})).status,200);
  const ai=await api('/api/tasks',{space:'ai',demo:true,title:'Smoke / AI',description:'Compare prompts'});
  await api('/api/tasks/'+ai.data.id+'/run',{});
  assert.equal((await until(ai.data.id,'done')).task.result.evaluations.length,2);
  const item=await api('/api/private/items',{kind:'document',name:'Smoke-test.txt',encoded:Buffer.from('Uchrashuv soat 15:00 da boshlanadi.').toString('base64')});
  assert.equal(item.status,201);
  const reply=await api('/api/private/ask',{item:item.data.id,question:'Uchrashuv soat nechada?',demo:process.env.OFFICE_SMOKE_LOCAL!=='1'});
  assert.equal(reply.status,200);
  assert.equal(reply.data.external,0);
  assert.ok(reply.data.answer.length>0);
  if(process.env.OFFICE_AGENT_TOKEN)assert.equal((await api('/api/private',undefined,process.env.OFFICE_AGENT_TOKEN)).status,403);
  console.log('PASS: HTTP session, IT worktree/test/diff/approval, AI comparison, private document Q&A, agent isolation.');
  console.log(process.env.OFFICE_SMOKE_LOCAL==='1'?'Private Q&A used the configured local model.':'Private Q&A used a labeled demo answer. Use OFFICE_SMOKE_LOCAL=1 to test actual local inference.');
} catch(error) {
  console.error('Smoke check failed: '+(error.cause?.code||error.message));process.exitCode=1;
}
