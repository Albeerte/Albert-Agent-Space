import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { createOffice } from '../src/server.mjs';
import { randomUUID } from 'node:crypto';

function request(app,path,{body,cookie,token,origin}={}) {
  const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  Object.assign(request,{url:path,method:body===undefined?'GET':'POST',socket:{remoteAddress:'127.0.0.1'},headers:{
    host:'127.0.0.1:8787',cookie,authorization:token&&'Bearer '+token,origin,'content-type':'application/json'
  }});
  return new Promise(resolve=>{
    const headers={};
    const response={
      headersSent:false,
      setHeader:(key,value)=>{headers[key.toLowerCase()]=value;},
      writeHead(status,extra){this.status=status;this.headersSent=true;Object.assign(headers,extra);},
      end(raw){
        const isJSON=headers['Content-Type']?.includes('application/json');
        resolve({status:this.status,headers,body:isJSON?JSON.parse(raw):raw?.toString()});
      }
    };
    app.server.emit('request',request,response);
  });
}
test('Office worktree, approval, AI evaluation, private isolation and persistence',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'agent-office-test-'));
  const env={OFFICE_DATA:directory,OFFICE_DEMO:'1',OFFICE_PASSWORD:'test-owner-password',
    OFFICE_AGENT_TOKEN:'test-agent',OFFICE_MASTER_KEY:'test-key',OFFICE_OLLAMA_URL:'http://127.0.0.1:11434',
    OFFICE_PRIVATE_MODEL:'local-fixture',OFFICE_QUIET:'1'};
  let app=createOffice(env);
  t.after(async()=>{app.server.emit('close');app.store.db.close();await rm(directory,{recursive:true,force:true});});
  async function login(){
    const result=await request(app,'/api/login',{body:{password:env.OFFICE_PASSWORD}});
    assert.equal(result.status,200);
    return result.headers['set-cookie'].split(';')[0];
  }
  let cookie=await login();
  const api=async(path,body,status=200)=>{
    const result=await request(app,'/api'+path,{body,cookie});
    assert.equal(result.status,status,JSON.stringify(result.body));
    return result.body;
  };
  async function until(task,status){
    for(let i=0;i<360;i++){
      const item=await api('/tasks/'+task.id);
      if(item.task.status===status)return item;
      if(item.task.status==='error')assert.fail(item.task.error);
      await wait(40);
    }
    assert.fail('Task did not reach '+status);
  }
  const page=await request(app,'/');
  assert.equal(page.status,200);
  assert.match(page.body,/Albert Agent Space/);
  assert.equal((await request(app,'/api/state')).status,401);
  assert.equal((await request(app,'/api/tasks',{cookie,origin:'https://outside.invalid',body:{}})).status,403);
  const state=await api('/state');
  await api('/preferences',{company:'Test company'});
  assert.equal((await api('/state')).preferences.company,'Test company');
  assert.equal((await request(app,'/api/ceo/commands',{token:'test-agent',body:{mode:'report'}})).status,403);
  await api('/ceo/commands',{mode:'report',title:'All reports',instruction:'Everyone report'},409);
  assert.equal((await request(app,'/api/setup',{token:env.OFFICE_AGENT_TOKEN})).status,403);
  assert.equal((await request(app,'/api/setup/assign',{token:env.OFFICE_AGENT_TOKEN,body:{space:'it',profileId:'x'}})).status,403);
  assert.equal((await request(app,'/api/setup')).status,401);
  assert.ok((await api('/setup')).pipelines.length===3);
  const it=state.tasks.find(row=>row.space==='it');
  const ai=state.tasks.find(row=>row.space==='ai');
  assert.ok(it.demo&&ai.demo);
  assert.equal((await request(app,'/api/projects')).status,401);
  assert.equal((await request(app,'/api/projects',{token:'test-agent'})).status,403);
  await api('/specialist-tasks',{agentId:'assistant',title:'private',prompt:'deny'},403);
  const dispatch={roomId:'development',agentId:'tech',message:'Build status',requestId:randomUUID()};
  await api('/room-dispatch?room=private-room',undefined,404);
  await api('/room-dispatch',{...dispatch,agentId:'assistant'},403);
  await api('/room-dispatch',dispatch,409);
  assert.equal((await request(app,'/api/room-dispatch?room=development',{token:'test-agent'})).status,403);
  const seeded=app.store.addTask({space:'it',title:'Build status',description:dispatch.message,
    config:{kind:'specialist',roomChannel:dispatch.roomId,dispatchRequest:dispatch.requestId},
    agentId:dispatch.agentId,demo:false});
  assert.equal((await api('/room-dispatch',dispatch)).id,seeded.id);
  await api('/room-dispatch',{...dispatch,message:'Changed request'},409);
  assert.deepEqual((await api('/room-dispatch?room=development')).messages.map(row=>row.id),[seeded.id]);
  assert.deepEqual((await api('/room-dispatch?room=executive')).messages,[]);
  const edict=await api('/projects/edict/demo');
  assert.equal(edict.demo,true);
  assert.ok(edict.tasks.length&&edict.departments.length);
  await api('/tasks/'+it.id+'/run',{},202);
  let review=await until(it,'approval');
  assert.equal(review.task.agent_id,'qa');
  assert.equal(review.task.result.test.code,0);
  assert.match(review.task.result.diff,/Assalomu alaykum/);
  assert.equal(review.approval.status,'pending');
  const canonical=(await api('/state')).tasks.find(row=>row.id===it.id);
  assert.equal(canonical.status,'approval');
  assert.equal(canonical.agent_id,review.task.agent_id);
  await api('/tasks/'+it.id+'/approval',{decision:'approve',fingerprint:'invalid'},409);
  const previousFingerprint=review.approval.fingerprint;
  await api('/tasks/'+it.id+'/approval',{decision:'reject',fingerprint:previousFingerprint,feedback:'Qabul mezonini yana tekshiring.'});
  assert.equal((await api('/tasks/'+it.id)).task.result.qa.feedback,'Qabul mezonini yana tekshiring.');
  await api('/tasks/'+it.id+'/run',{},202);
  review=await until(it,'approval');
  assert.notEqual(review.approval.fingerprint,previousFingerprint);
  await api('/tasks/'+it.id+'/approval',{decision:'approve',fingerprint:previousFingerprint},409);
  const approval=await api('/tasks/'+it.id+'/approval',{decision:'approve',fingerprint:review.approval.fingerprint});
  assert.deepEqual(approval.draft,{demo:true,number:1});
  await until(it,'done');
  await api('/tasks/'+ai.id+'/run',{},202);
  const evaluated=await until(ai,'done');
  assert.deepEqual(evaluated.task.result.evaluations.map(row=>[row.matched,row.scored]),[[3,3],[0,3]]);
  const privateText='Demo tekshiruv hujjati. Uchrashuv soat 15:00 da boshlanadi.';
  const item=await api('/private/items',{kind:'document',name:'Test.txt',encoded:Buffer.from(privateText).toString('base64')},201);
  await api('/memories',{space:'private',title:'Owner preference',body:'PRIVATE_MEMORY_SHOULD_STAY_LOCAL'},201);
  for(const path of ['/api/knowledge?space=private','/api/knowledge/export?space=private','/api/memories','/api/skills'])
    assert.equal((await request(app,path,{token:env.OFFICE_AGENT_TOKEN})).status,403);
  assert.equal((await request(app,'/api/private/items/'+item.id,{token:env.OFFICE_AGENT_TOKEN})).status,403);
  assert.equal((await request(app,'/api/private/ask',{token:env.OFFICE_AGENT_TOKEN,body:{item:item.id,question:'Qachon?'}})).status,403);
  assert.equal((await request(app,'/api/private/items/'+item.id)).status,401);
  assert.doesNotMatch(JSON.stringify(await request(app,'/api/agent/tasks',{token:env.OFFICE_AGENT_TOKEN})),/Test\.txt|15:00/);
  const profile=await api('/profiles',{name:'External fixture',provider:'compatible',base:'https://provider.invalid/v1',model:'external-fixture',key:'synthetic-secret'});
  assert.notEqual(app.store.one('SELECT secret FROM profiles WHERE id=?',profile.id).secret,'synthetic-secret');
  const appearance={name:'Frontend Developer',role:'Interfeys dasturchisi',room:'development',lead:'tech'};
  assert.equal((await request(app,'/api/agents/frontend',{token:env.OFFICE_AGENT_TOKEN,body:{...appearance,sprite:4}})).status,403);
  await api('/agents/frontend',{...appearance,sprite:9},400);
  await api('/agents/frontend',{...appearance,sprite:1.5},400);
  await api('/agents/frontend',{...appearance,sprite:'4'});
  assert.equal((await api('/state')).agents.find(agent=>agent.id==='frontend').sprite_id,4);
  await api('/agents/frontend',appearance);
  assert.equal((await api('/state')).agents.find(agent=>agent.id==='frontend').sprite_id,4);
  await api('/agents/tech',{name:'Tech Lead',role:'Lead',room:'development',lead:'backend'},400);
  await api('/agents/backend',{name:'Backend',role:'Developer',room:'private-room'},400);
  await api('/agents/assistant',{name:'Assistant',role:'Private',room:'private-room',profile:profile.id},400);
  const diagnostics=await api('/diagnostics');
  assert.equal(diagnostics.capabilities.merge,false);
  assert.doesNotMatch(JSON.stringify(diagnostics),/synthetic-secret|test-owner-password|test-key/);
  assert.equal((await request(app,'/healthz')).status,200);
  assert.doesNotMatch(JSON.stringify(await api('/state')),/synthetic-secret|"secret":/);
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{
    const url=new URL(input);
    calls.push(url.origin+url.pathname);
    if(url.pathname==='/api/show')return Response.json({details:{}});
    if(url.pathname==='/api/chat'){
      assert.equal(url.hostname,'127.0.0.1');
      assert.match(JSON.parse(options.body).messages[1].content,/15:00/);
      assert.match(JSON.parse(options.body).messages[1].content,/PRIVATE_MEMORY_SHOULD_STAY_LOCAL/);
      return Response.json({message:{content:'Uchrashuv soat 15:00 da boshlanadi.'}});
    }
    if(url.pathname.endsWith('/chat/completions')){
      assert.doesNotMatch(options.body,/PRIVATE_MEMORY_SHOULD_STAY_LOCAL/);
      return Response.json({choices:[{message:{content:'External test response'}}]});
    }
    assert.fail('Unexpected upstream request: '+url);
  };
  try {
    const response=await api('/private/ask',{item:item.id,question:'Uchrashuv qachon?'});
    assert.equal(response.external,0);
    assert.match(response.answer,/15:00/);
    assert.deepEqual(calls,['http://127.0.0.1:11434/api/show','http://127.0.0.1:11434/api/chat']);
    await api('/private/ask',{item:item.id,question:'Qachon?',profile:profile.id},403);
    assert.equal(calls.length,2);
    await api('/private/ask',{item:item.id,question:'Qachon?',profile:profile.id,externalConsent:true});
    assert.equal(calls.length,3);
  } finally {
    globalThis.fetch=original;
  }
  app.server.emit('close');
  app.store.db.close();
  app=createOffice(env);
  assert.equal((await api('/state')).agents.find(agent=>agent.id==='frontend').sprite_id,4);
  assert.equal((await api('/tasks/'+it.id)).task.status,'done');
  assert.match((await api('/private/items/'+item.id)).body,/15:00/);
  assert.equal((await api('/private')).chats.length,2);
});

test('Paperclip and OpenClaw payloads use documented endpoints',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'agent-office-upstream-'));
  const app=createOffice({OFFICE_DATA:directory,OFFICE_DEMO:'0',OFFICE_PASSWORD:'owner',OFFICE_MASTER_KEY:'key',
    PAPERCLIP_URL:'https://paperclip.invalid',PAPERCLIP_COMPANY_ID:'company-id',PAPERCLIP_TOKEN:'token',
    PAPERCLIP_AGENT_MAP:'{"head-ai":"head-remote","evaluation":"evaluation-remote"}'});
  t.after(async()=>{app.server.emit('close');app.store.db.close();await rm(directory,{recursive:true,force:true});});
  const log=await request(app,'/api/login',{body:{password:'owner'}});
  const cookie=log.headers['set-cookie'].split(';')[0];
  const seen=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const address=new URL(url);
    const body=options.body&&JSON.parse(options.body);
    seen.push({path:address.pathname,method:options.method??'GET',body,headers:options.headers});
    if(address.pathname==='/api/companies/company-id/issues')return Response.json({id:'issue-id',companyId:'company-id',status:'todo'});
    if(address.pathname==='/api/issues/issue-id')return Response.json({id:'issue-id',companyId:'company-id',status:body?.status||'todo'});
    if(address.pathname==='/v1/chat/completions')return Response.json({choices:[{message:{content:'5'}}]});
    assert.fail('Unexpected upstream '+address);
  };
  try {
    const profile=await request(app,'/api/profiles',{cookie,body:{name:'Codex Pro test',provider:'codex',base:'https://claw.invalid/v1',model:'openai/gpt-pro',remoteAgent:'office',key:'gateway-token'}});
    assert.equal(profile.status,200);
    const evaluation=await request(app,'/api/tasks',{cookie,body:{space:'ai',title:'API comparison',demo:false,candidates:[
      {label:'A',prompt:'Short',profileId:profile.body.id},{label:'B',prompt:'Exact',profileId:profile.body.id}
    ],cases:[{input:'2 + 3?',expected:'5'}]}});
    assert.equal(evaluation.status,201);
    assert.equal(evaluation.body.external_id,'issue-id');
    await request(app,'/api/tasks/'+evaluation.body.id+'/run',{cookie,body:{}});
    for(let i=0;i<90&&app.store.task(evaluation.body.id).status!=='done';i++) await wait(25);
    assert.equal(app.store.task(evaluation.body.id).status,'done');
    assert.equal(seen[0].body.assigneeAgentId,'head-remote');
    assert.equal(seen.filter(row=>row.path==='/v1/chat/completions').length,2);
    assert.equal(seen.find(row=>row.path==='/v1/chat/completions').headers['x-openclaw-agent-id'],'office');
    assert.equal(seen.find(row=>row.path==='/v1/chat/completions').body.model,'openclaw/office');
    assert.equal(seen.find(row=>row.path==='/v1/chat/completions').headers['x-openclaw-model'],'openai/gpt-pro');
    assert.equal(seen.at(-1).body.status,'done');
  } finally {
    globalThis.fetch=original;
  }
});
