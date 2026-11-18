// Exercise the live HTTP workflows with synthetic data in a disposable Office.
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { createOffice } from '../src/server.mjs';
const model=process.argv[2];
if(!model)throw Error('node scripts/verify-local.mjs <installed-ollama-model>');
const directory=await mkdtemp(join(tmpdir(),'office-verify-'));
const env={OFFICE_HOST:'127.0.0.1',OFFICE_DATA:directory,OFFICE_DEMO:'1',OFFICE_BACKUPS:'0',
  OFFICE_AGENT_TOKEN:randomUUID(),OFFICE_PASSWORD:randomUUID(),OFFICE_MASTER_KEY:randomUUID(),
  OFFICE_OLLAMA_URL:process.env.OFFICE_OLLAMA_URL||'http://127.0.0.1:11434',OFFICE_PRIVATE_MODEL:model};
const app=createOffice(env);
try{
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  env.OFFICE_PORT=String(app.server.address().port);
  const {stdout}=await promisify(execFile)(process.execPath,['scripts/smoke.mjs'],{env:{...process.env,...env,OFFICE_SMOKE_LOCAL:'1'},timeout:180000});
  console.log(stdout.trim());
  let cookie='';
  async function api(path,body){
    const res=await fetch('http://127.0.0.1:'+env.OFFICE_PORT+'/api'+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body&&JSON.stringify(body)});
    if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
    const data=await res.json();
    if(!res.ok)throw Error(data.error);return data;
  }
  await api('/login',{password:env.OFFICE_PASSWORD});
  const profile=await api('/profiles',{provider:'ollama',model,name:'Local verification',base:env.OFFICE_OLLAMA_URL});
  const task=await api('/tasks',{space:'ai',title:'Synthetic numeric evaluation',candidates:[
    {label:'A',profileId:profile.id,prompt:'Return just the number.'},
    {label:'B',profileId:profile.id,prompt:'Write the numeric answer without explanation.'}],cases:[{input:'2+2',expected:'4'}]});
  await api('/tasks/'+task.id+'/run',{});
  const end=Date.now()+260000;
  while(true){
    const {task:t}=await api('/tasks/'+task.id);
    if(t.status==='error')throw Error(t.error);
    if(t.status==='done'){
      assert.equal(t.demo,0);assert.equal(t.result.evaluations.length,2);
      for(const v of t.result.evaluations){assert.equal(v.rows.length,1);assert.ok(v.rows[0].answer);}
      console.log('Two prompts, same live local model and case:',t.result.evaluations.map(v=>v.label+' '+v.matched+'/'+v.scored).join(', '));
      break;
    }
    if(Date.now()>end)throw Error('Evaluation timed out');
    await pause(350);
  }
}finally{await app.stop();await rm(directory,{recursive:true,force:true});}
