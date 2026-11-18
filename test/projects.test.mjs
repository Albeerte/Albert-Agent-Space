import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.mjs';
import { makeProviders } from '../src/providers.mjs';
import { makeKnowledge } from '../src/knowledge.mjs';
import { projectOffice,catalog } from '../src/projects.mjs';
import { runProjectProfile,sdkEngines } from '../src/project-adapters.mjs';

test('26 unique pinned repositories, idempotent City rooms, private skill isolation and secret-free export',async t=>{
  assert.equal(new Set(catalog.map(x=>x.id)).size,26);
  for(const p of catalog)assert.match(p.commit,/^[0-9a-f]{40}$/);
  const dir=mkdtempSync(join(tmpdir(),'office-projects-'));
  const store=openStore(dir,false),env={OFFICE_MASTER_KEY:'fixture',OFFICE_OLLAMA_URL:'http://127.0.0.1:11434'};
  t.after(()=>{store.db.close();rmSync(dir,{recursive:true,force:true});});
  const providers=makeProviders(store,env),knowledge=makeKnowledge(store);
  const projects=projectOffice({store,providers,knowledge,env,defaultLocal:()=>null,root:dir});
  projects.cityRooms();projects.cityRooms();
  const templates=projects.teamTemplates();
  assert.equal(templates.length,3);
  for(const template of templates){
    const first=await projects.importTeam(template.id);
    await projects.importTeam(template.id);
    assert.equal(store.one('SELECT count(*) AS n FROM agents WHERE room_id=?',first.room).n,template.roles.length);
  }
  assert.equal(store.one("SELECT count(*) AS n FROM agents WHERE room_id LIKE 'city-%'").n,6);
  const privateSkill=knowledge.writeSkill({space:'private',name:'test',body:'private',agents:[]});
  assert.throws(()=>projects.companySkill(privateSkill.id),e=>e.status===403);
  const draft=knowledge.propose({id:null,space:'it',demo:false},{kind:'skill',title:'Demo source',body:'Test',evidence:'blob hash',revisionKey:'source-1'});
  assert.equal(draft.status,'pending');
  const {appliedId}=knowledge.decide(draft.id,{decision:'approve'});
  assert.match(projects.companySkill(appliedId).body,/^---\nname: office-/);
  store.run("INSERT INTO profiles(id,name,provider,model,base,secret) VALUES ('p','Local','ollama','sample','',?)",providers.encrypt('never-expose'));
  const config=JSON.parse(projects.libreConfig('p').body);
  assert.deepEqual(config.endpoints.custom[0].models.default,['sample']);
  assert.equal(config.endpoints.custom[0].apiKey,'${OFFICE_MODEL_API_KEY}');
  assert.equal(config.endpoints.custom[0].baseURL,env.OFFICE_OLLAMA_URL+'/v1');
  await assert.rejects(projects.source('../.env','.env'),e=>e.status===404);
  await assert.rejects(projects.source('edict','.env'),e=>e.status===404);
  for(const p of projects.list()){
    if(p.reference){assert.equal((await projects.files(p.id)).total,0);continue;}
    const sample=await projects.source(p.id,p.example);
    assert.equal(Buffer.byteLength(sample.code),sample.bytes);
    assert.equal(createHash('sha1').update('blob '+sample.bytes+'\0').update(sample.code).digest('hex'),sample.blob);
  }
});

const contracts=[
  ['langflow','/api/v1/run/w',{input_value:'hello',input_type:'chat',output_type:'chat'},{outputs:[{outputs:[{results:{message:{text:'answer'}}}]}]}],
  ['sim','/api/workflows/w/execute',{input:'hello'},{success:true,output:'answer'}],
  ['chatdev','/api/workflow/run',{yaml_file:'w',task_prompt:'hello'},{status:'completed',final_message:'answer'}],
  ['mastra','/api/agents/w/generate',{messages:[{role:'user',content:'hello'}]},{text:'answer'}],
  ...sdkEngines.map(engine=>[engine,'/run',{engine,model:'w',input:'hello'},{text:'answer'}])
];
for(const [provider,path,expected,reply] of contracts)test(provider+' protocol sends the expected request and extracts output',async()=>{
  const result=await runProjectProfile({provider,model:'w'},'hello','fixture','http://runtime',async(url,options)=>{
    assert.equal(url,'http://runtime'+path);
    assert.deepEqual(JSON.parse(options.body),expected);
    assert.equal(options.headers[['sim','langflow'].includes(provider)?'x-api-key':'Authorization'],['sim','langflow'].includes(provider)?'fixture':'Bearer fixture');
    return reply;
  });
  assert.equal(result.text,'answer');
});
test('upstream error and empty output are not accepted as completed work',async()=>{
  await assert.rejects(runProjectProfile({provider:'sim',model:'x'},'hello','','http://runtime',async()=>({success:false})));
  await assert.rejects(runProjectProfile({provider:'mastra',model:'x'},'hello','','http://runtime',async()=>({})));
});
