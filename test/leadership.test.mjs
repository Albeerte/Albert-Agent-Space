import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../src/store.mjs';
import {initializeLeadership,makeLeadership} from '../src/leadership.mjs';

function fixture(t){
  const path=mkdtempSync(join(tmpdir(),'ceo-test-'));
  const store=openStore(path,false);
  t.after(()=>{store.db.close();rmSync(path,{recursive:true,force:true});});
  initializeLeadership(store);initializeLeadership(store);
  store.run("INSERT INTO profiles(id,name,provider,model) VALUES ('p','Fixture','ollama','fixture')");
  store.run("UPDATE agents SET profile_id='p' WHERE room_id IN (SELECT id FROM rooms WHERE space!='private')");
  return store;
}
test('Every public agent reports up the tree, private resources stay outside and failures propagate',async t=>{
  const store=fixture(t);
  assert.equal(store.one("SELECT count(*) AS n FROM agents WHERE id='ceo'").n,1);
  const calls=[];
  const providers={agentCall:async(agent,prompt)=>{
    calls.push(agent);
    assert.ok(!prompt.includes('PRIVATE_MARKER'));
    if(agent==='test')throw Object.assign(Error('Fixture failure'),{status:503});
    return {text:'Report '+agent,model:'fixture'};
  }};
  store.run("INSERT INTO private_items VALUES ('private','document','Private','PRIVATE_MARKER','2026-01-01')");
  const leadership=makeLeadership({store,providers});
  const root=leadership.create({title:'Company report',instruction:'Everyone report',mode:'report'});
  await leadership.run(root);
  const publicIds=store.all("SELECT a.id FROM agents a JOIN rooms r ON r.id=a.room_id WHERE r.space!='private'").map(a=>a.id);
  assert.deepEqual(new Set(calls),new Set(publicIds));
  assert.ok(!calls.includes('assistant'));
  assert.equal(calls.at(-1),'ceo');
  assert.equal(store.task(root.id).status,'review');
  const messages=store.all('SELECT * FROM agent_messages');
  assert.equal(messages.length,(publicIds.length-1)*2);
  for(const child of store.all("SELECT id,config FROM tasks WHERE id!=?",root.id)){
    const config=JSON.parse(child.config);
    assert.equal(config.rootTask,root.id);
    assert.ok(config.parentTask);
  }
});
test('Plans can only delegate to direct reports and invalid plans fail visibly',async t=>{
  const store=fixture(t);
  const providers={agentCall:async()=>({text:JSON.stringify({assignments:[{agentId:'assistant',instruction:'Read private data'}]})})};
  const leadership=makeLeadership({store,providers});
  const root=leadership.create({title:'Invalid plan',instruction:'Plan',mode:'command'});
  await assert.rejects(leadership.run(root),e=>e.status===400);
  assert.equal(store.one('SELECT count(*) AS n FROM agent_messages').n,0);
});
test('A command reaches the selected leaf through each manager and reports return through the same edges',async t=>{
  const store=fixture(t);
  const next={ceo:'cto',cto:'tech',tech:'backend'};
  const leadership=makeLeadership({store,providers:{agentCall:async(agent,prompt)=>({
    text:prompt.includes('Faqat JSON qaytaring')?JSON.stringify({assignments:next[agent]?
      [{agentId:next[agent],instruction:'Write a short implementation report'}]:[]}):'Evidence from '+agent,
    model:'fixture'
  })}});
  const root=leadership.create({title:'Backend command',instruction:'Send through the tree'});
  await leadership.run(root);
  assert.equal(store.task(root.id).status,'done');
  const edges=store.all('SELECT from_agent,to_agent,kind FROM agent_messages ORDER BY rowid');
  assert.deepEqual(edges.map(edge=>[edge.from_agent,edge.to_agent,edge.kind]),[
    ['ceo','cto','command'],['cto','tech','command'],['tech','backend','command'],
    ['backend','tech','report'],['tech','cto','report'],['cto','ceo','report']
  ]);
});
test('An explicitly named team routes through its managers without unrelated departments',async t=>{
  const store=fixture(t);
  store.run("INSERT INTO rooms VALUES ('translations','ai','Tarjima','Translations')");
  store.run("INSERT INTO agents(id,room_id,name,role,lead_id,profile_id) VALUES ('translator','translations','Tarjimon','Translate','head-ai','p')");
  const calls=[];
  const leadership=makeLeadership({store,providers:{agentCall:async(agent)=>{
    calls.push(agent);return {text:'Report '+agent,model:'fixture'};
  }}});
  const root=leadership.create({title:'Translate',instruction:'Tarjima jamoasiga topshiriq'});
  await leadership.run(root);
  assert.deepEqual(calls,['translator','head-ai','ceo']);
  assert.equal(store.task(root.id).status,'done');
});
