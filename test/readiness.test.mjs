import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.mjs';
import { makeProviders } from '../src/providers.mjs';
import { makeReadiness } from '../src/readiness.mjs';

test('Setup bulk assignment stays in its workspace and protects the private assistant',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-setup-'));
  const store=openStore(directory,false);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  const env={OFFICE_MASTER_KEY:'private-test-master',OFFICE_OLLAMA_URL:'http://127.0.0.1:11434'};
  const providers=makeProviders(store,env);
  store.run('INSERT INTO profiles(id,name,provider,model,base,secret) VALUES (?,?,?,?,?,?)','external','External','openai','test','',providers.encrypt('DO_NOT_EXPOSE_THIS_KEY'));
  store.run('INSERT INTO profiles(id,name,provider,model,base) VALUES (?,?,?,?,?)','local','Local','ollama','test-local','http://127.0.0.1:11434');
  const readiness=makeReadiness({store,providers,env,paperclip:{enabled:false,agentMap:{}},git:{names:[]}});
  const before=readiness.state();
  assert.equal(before.pipelines.find(row=>row.space==='it').modelsConfigured,false);
  assert.equal(before.agents.find(row=>row.id==='cto').tested,undefined);
  const result=readiness.assign({space:'it',profileId:'external'});
  assert.equal(result.assigned,7);
  assert.equal(readiness.state().pipelines.find(row=>row.space==='it').modelsConfigured,true);
  assert.equal(store.one("SELECT profile_id FROM agents WHERE id='head-ai'").profile_id,null);
  assert.equal(store.one("SELECT profile_id FROM agents WHERE id='assistant'").profile_id,null);
  assert.throws(()=>readiness.assign({space:'private',profileId:'external'}),{status:403});
  assert.equal(store.one("SELECT profile_id FROM agents WHERE id='assistant'").profile_id,null);
  readiness.assign({space:'private',profileId:'local'});
  assert.equal(store.one("SELECT profile_id FROM agents WHERE id='assistant'").profile_id,'local');
  assert.doesNotMatch(JSON.stringify(readiness.state()),/DO_NOT_EXPOSE_THIS_KEY|private-test-master|"secret":/);
});

test('Setup does not describe missing keys, URLs or gateway agents as configured',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-setup-missing-'));
  const store=openStore(directory,false);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  const providers=makeProviders(store,{});
  for(const [key,provider,base] of [['keyless','openai',''],['url-less','compatible',''],['gateway','openclaw','http://127.0.0.1:18789/v1']])
    store.run('INSERT INTO profiles(id,name,provider,model,base) VALUES (?,?,?,?,?)',key,key,provider,'test',base);
  const readiness=makeReadiness({store,providers,env:{},paperclip:{enabled:false,agentMap:{}},git:{names:[]}});
  for(const profileId of ['keyless','url-less','gateway'])assert.throws(()=>readiness.assign({space:'it',profileId}),{status:400});
  assert.ok(readiness.state().paperclip.missingMappings.includes('test'));
  assert.equal(readiness.state().github.verified,false);
  assert.equal(readiness.state().safeguards.mergeEnabled,false);
});
