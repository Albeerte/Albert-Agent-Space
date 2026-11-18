import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.mjs';
import { makeWorkflows } from '../src/workflows.mjs';
import { createOffice } from '../src/server.mjs';
import { makeProviders } from '../src/providers.mjs';
import { normalFile } from '../src/git-workflow.mjs';

test('Git file scope allows explicit additions and blocks traversal, metadata and non-files',async t=>{
  const root=await mkdtemp(join(tmpdir(),'office-files-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const path=await normalFile(root,'src/new-file.mjs',{create:true});
  await writeFile(path,'export const value=1;',{flag:'wx'});
  assert.equal(await readFile(await normalFile(root,'src/new-file.mjs'),'utf8'),'export const value=1;');
  for(const path of ['../outside','.git/config','.github/workflows/test.yml','C:/outside','folder/NUL.txt','src/new-file.mjs/child'])
    await assert.rejects(normalFile(root,path,{create:true}));
  await mkdir(join(root,'directory'));
  await assert.rejects(normalFile(root,'directory',{create:true}));
});

test('Paperclip outbox survives restart and preserves a newer revision during an in-flight write',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-outbox-'));
  let store=openStore(directory,false);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  const task=store.addTask({space:'ai',title:'Comparison',description:'Test',demo:false,config:{},agentId:'head-ai',externalId:'remote-issue'});
  store.update(task.id,{status:'working',agent_id:'evaluation'},'Running');
  let workflow=makeWorkflows({store,paperclip:{enabled:true,change:async()=>{throw Error('offline');}}});
  await workflow.sync();
  assert.equal(store.one('SELECT attempts FROM task_sync WHERE task_id=?',task.id).attempts,1);
  assert.equal(store.task(task.id).status,'working');
  store.db.close();
  store=openStore(directory,false);
  assert.equal(store.one('SELECT attempts FROM task_sync WHERE task_id=?',task.id).attempts,1);
  let release,started;
  const began=new Promise(resolve=>{started=resolve;});
  const writes=[];
  const paperclip={enabled:true,reverse:{},change:async(_task,patch)=>{
    writes.push(patch);started();await new Promise(resolve=>{release=resolve;});
  },read:async()=>({status:'done'}),status:()=> 'done'};
  workflow=makeWorkflows({store,paperclip});
  const pending=workflow.sync();
  await began;
  store.update(task.id,{status:'done',result:{summary:'Saved report'}},'Completed');
  release();await pending;
  assert.equal(store.task(task.id).status,'done');
  assert.ok(store.one('SELECT 1 FROM task_sync WHERE task_id=?',task.id));
  paperclip.change=async(_task,patch)=>{writes.push(patch);};
  await workflow.sync();
  assert.equal(store.one('SELECT 1 FROM task_sync WHERE task_id=?',task.id),undefined);
  assert.deepEqual(writes.map(p=>p.status),['working','done']);
  assert.equal(store.task(task.id).result.summary,'Saved report');
});

test('Restart recovers interrupted remote tasks and retains review artifacts',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-recovery-'));
  let store=openStore(directory,false);
  const task=store.addTask({space:'it',title:'Work',description:'Test',demo:false,config:{},agentId:'cto',externalId:'remote'});
  store.update(task.id,{status:'review',result:{diff:'reviewed diff',sha:'commit'}},'Review started');
  store.db.close();
  const app=createOffice({OFFICE_DATA:directory,OFFICE_PASSWORD:'owner',OFFICE_DEMO:'0',OFFICE_QUIET:'1'});
  t.after(async()=>{app.server.emit('close');app.store.db.close();await rm(directory,{recursive:true,force:true});});
  assert.equal(app.store.task(task.id).status,'error');
  assert.equal(app.store.task(task.id).result.diff,'reviewed diff');
  assert.match(app.store.task(task.id).error,/Server/);
  assert.equal(JSON.parse(app.store.one('SELECT patch FROM task_sync WHERE task_id=?',task.id).patch).status,'error');
});

test('Paid fallback requires opt-in; local cloud models fail before any outbound request',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-provider-'));
  const store=openStore(directory,false);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  for(const key of ['main','backup']) store.run('INSERT INTO profiles(id,name,provider,model,base) VALUES (?,?,?,?,?)',key,key,'compatible',key,'https://models.invalid/v1');
  store.run("UPDATE agents SET profile_id='main',backup_id='backup' WHERE id='tech'");
  const providers=makeProviders(store,{OFFICE_OLLAMA_URL:'http://127.0.0.1:11434'});
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(_url,options)=>{
    const {model}=JSON.parse(options.body);calls.push(model);
    return model==='main'?new Response('{}',{status:429}):Response.json({choices:[{message:{content:'Fallback worked'}}]});
  };
  try {
    await assert.rejects(providers.agentCall('tech','Test'),/429/);
    assert.deepEqual(calls,['main']);
    store.run("UPDATE agents SET allow_paid=1 WHERE id='tech'");
    assert.equal((await providers.agentCall('tech','Test')).text,'Fallback worked');
    assert.deepEqual(calls,['main','main','backup']);
    await assert.rejects(providers.call({provider:'ollama',base:'http://127.0.0.1:11434',model:'example:cloud'},'private',{localOnly:true}),/bulut/);
    assert.equal(calls.length,3);
  } finally {globalThis.fetch=original;}
});
