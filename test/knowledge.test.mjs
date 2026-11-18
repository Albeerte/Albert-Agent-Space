import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.mjs';
import { makeKnowledge, knowledgeContext } from '../src/knowledge.mjs';
import { makeProviders } from '../src/providers.mjs';
import { backupDatabase } from '../src/backup.mjs';
import { DatabaseSync } from 'node:sqlite';

test('Skills and memory retain versions across restart and cannot cross workspace boundaries',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-knowledge-'));
  let store=openStore(directory,false),knowledge=makeKnowledge(store);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  let skill=knowledge.writeSkill({space:'it',name:'Code review',description:'Review rules',body:'Check acceptance criteria and test results.',agents:['tech']});
  assert.equal(skill.version,1);
  const original=skill.body;
  skill=knowledge.writeSkill({...skill,body:'Inspect the diff and check test results.',reason:'More precise',version:1},skill.id);
  assert.equal(skill.version,2);
  assert.equal(skill.versions[1].body,original);
  assert.throws(()=>knowledge.writeSkill({...skill,version:1},skill.id),{status:409});
  assert.throws(()=>knowledge.writeSkill({space:'it',name:'Leak',body:'Private',agents:['assistant']}),{status:403});
  let memory=knowledge.writeMemory({space:'it',title:'Repository preference',body:'Use existing project test commands.'});
  memory=knowledge.writeMemory({...memory,body:'Use the repository test command, then inspect the diff.',version:1},memory.id);
  knowledge.writeMemory({space:'private',title:'Personal data',body:'PRIVATE_ONLY_MARKER_734'});
  assert.equal(memory.versions.length,2);
  assert.equal(knowledge.list('ai').memories.length,0);
  const it=knowledgeContext(store,{space:'it',agentId:'tech',query:'Review tests'});
  assert.match(it,/Inspect the diff/);
  assert.match(it,/repository test command/);
  assert.doesNotMatch(it,/PRIVATE_ONLY_MARKER/);
  assert.throws(()=>knowledgeContext(store,{space:'private',agentId:'backend',query:'anything'}),{status:403});
  assert.match(knowledgeContext(store,{space:'private',agentId:'assistant'}),/PRIVATE_ONLY_MARKER/);
  store.db.close();store=openStore(directory,false);knowledge=makeKnowledge(store);
  assert.equal(knowledge.skill(skill.id).version,2);
  assert.equal(knowledge.memory(memory.id).versions.length,2);
  assert.equal(knowledge.exportSpace('it').skills[0].versions.length,2);
  assert.doesNotMatch(JSON.stringify(knowledge.exportSpace('it')),/PRIVATE_ONLY_MARKER/);
  const snapshot=backupDatabase(store.db,join(directory,'backups'));
  const backup=new DatabaseSync(snapshot.path,{readOnly:true});
  try{assert.equal(backup.prepare('SELECT version FROM skills WHERE id=?').get(skill.id).version,2);}
  finally{backup.close();}
  const restored=knowledge.restoreSkill(skill.id,1,2);
  assert.equal(restored.version,3);assert.equal(restored.body,original);
  assert.equal(restored.versions.length,3);
});

test('Self-improvement is proposed before activation, version-checked, and applied only once',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-improvement-'));
  const store=openStore(directory,true),knowledge=makeKnowledge(store);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  const task=store.addTask({space:'it',title:'Evidence task',description:'Test',demo:true,config:{},agentId:'tech'});
  const completed=store.update(task.id,{status:'done',result:{runId:'run-1',criteria:'Tests pass',test:{code:0,log:'PASS'},qa:{pass:true,feedback:'Good'}}},'Done');
  knowledge.queueOutcome(completed);knowledge.queueOutcome(completed);
  assert.equal(knowledge.list('it').improvements.length,1);
  assert.equal(knowledge.list('it').memories.length,0);
  const proposal=knowledge.list('it').improvements[0];
  knowledge.decide(proposal.id,{decision:'approve'});
  assert.equal(knowledge.list('it').memories.length,1);
  assert.throws(()=>knowledge.decide(proposal.id,{decision:'approve'}),{status:409});
  let skill=knowledge.writeSkill({space:'it',name:'Workflow',body:'Original instructions',agents:['tech']});
  const proposals=await knowledge.reflect(completed,skill.id);
  const update=proposals.find(row=>row.kind==='skill');
  assert.equal(knowledge.skill(skill.id).version,1);
  assert.equal(update.base_version,1);
  assert.throws(()=>knowledge.decide(update.id,{decision:'approve',agentId:'assistant'}),{status:403});
  assert.equal(knowledge.list('it').improvements.find(row=>row.id===update.id).status,'pending');
  skill=knowledge.writeSkill({...skill,body:'Owner changed the skill',version:1},skill.id);
  assert.throws(()=>knowledge.decide(update.id,{decision:'approve',agentId:'tech'}),{status:409});
  const refreshed=await knowledge.reflect(completed,skill.id);
  const fresh=refreshed.find(row=>row.kind==='skill'&&row.base_version===2);
  knowledge.decide(fresh.id,{decision:'approve',agentId:'tech'});
  assert.equal(knowledge.skill(skill.id).version,3);
  assert.equal(knowledge.skill(skill.id).versions[1].body,'Owner changed the skill');
});

test('Agent model calls receive only assigned skills and memory from their own workspace',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'office-context-'));
  const store=openStore(directory,false),knowledge=makeKnowledge(store);
  t.after(async()=>{store.db.close();await rm(directory,{recursive:true,force:true});});
  knowledge.writeSkill({space:'it',name:'Review',body:'REVIEW_SKILL_MARKER',agents:['tech']});
  knowledge.writeMemory({space:'it',title:'Test rule',body:'IT_MEMORY_MARKER'});
  knowledge.writeMemory({space:'ai',title:'AI rule',body:'AI_ONLY_MARKER'});
  knowledge.writeMemory({space:'private',title:'Private rule',body:'PRIVATE_ONLY_MARKER'});
  store.run("INSERT INTO profiles(id,name,provider,model,base) VALUES ('model','Test','compatible','test','https://models.invalid/v1')");
  store.run("UPDATE agents SET profile_id='model' WHERE id IN ('tech','evaluation')");
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body).messages[1].content);return Response.json({choices:[{message:{content:'OK'}}]});};
  try{
    const providers=makeProviders(store,{});
    await providers.agentCall('tech','Review tests');await providers.agentCall('evaluation','Evaluate');
    assert.match(calls[0],/REVIEW_SKILL_MARKER/);assert.match(calls[0],/IT_MEMORY_MARKER/);
    assert.doesNotMatch(calls[0],/AI_ONLY_MARKER|PRIVATE_ONLY_MARKER/);
    assert.match(calls[1],/AI_ONLY_MARKER/);assert.doesNotMatch(calls[1],/IT_MEMORY_MARKER|PRIVATE_ONLY_MARKER|REVIEW_SKILL_MARKER/);
  }finally{globalThis.fetch=original;}
});
