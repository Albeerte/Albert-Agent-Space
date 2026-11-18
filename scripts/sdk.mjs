// Run a separately installed native SDK on this host, and register its Office profile.
import { spawn } from 'node:child_process';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { sdkEngines } from '../src/project-adapters.mjs';

const [engine,python,model]=process.argv.slice(2);
if(!sdkEngines.includes(engine)||!python||!model)throw Error('npm run sdk -- <engine> <python-exe> <ollama-model>');
const port=Number(process.env.OFFICE_WORKER_PORT||8910+sdkEngines.indexOf(engine));
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port yaroqsiz.');
const workerBase='http://127.0.0.1:'+port;
const office='http://127.0.0.1:'+Number(process.env.OFFICE_PORT||8787)+'/api';
const login=await fetch(office+'/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:process.env.OFFICE_PASSWORD})});
if(!login.ok)throw Error('Ofisni parol bilan ishga tushiring. HTTP '+login.status);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,body){
  const res=await fetch(office+path,{headers:{cookie,'content-type':'application/json'},method:body?'POST':'GET',body:body&&JSON.stringify(body)});
  const result=await res.json();
  if(!res.ok)throw Error(result.error||'Office API '+res.status);
  return result;
}
const modelList=await api('/projects/local-models');
if(!modelList.models.includes(model)||/(cloud|@|https?:)/i.test(model))throw Error('Ollama serverida yuklangan lokal modelni tanlang.');
const show=await fetch(modelList.base+'/api/show',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({model})});
if(!show.ok)throw Error('Model xususiyatlarini tekshirish imkoni bo‘lmadi.');
const meta=await show.json();
if(meta.remote_model||meta.remote_host||meta.details?.remote_host)throw Error('Lokal worker uchun mahalliy model talab qilinadi.');
const tokenDir=resolve(process.env.OFFICE_DATA||'data','worker-keys');
const workDir=resolve(process.env.OFFICE_DATA||'data','worker-runtime',engine+'-'+port);
mkdirSync(workDir,{recursive:true,mode:0o700});
mkdirSync(tokenDir,{recursive:true,mode:0o700});
const tokenFile=join(tokenDir,engine+'-'+port);
try{writeFileSync(tokenFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
const token=readFileSync(tokenFile,'utf8').trim();
const env={};
const instance=randomBytes(16).toString('hex');
for(const key of ['SystemRoot','PATH','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','LANG','APPDATA'])
  if(process.env[key])env[key]=process.env[key];
Object.assign(env,{OFFICE_WORKER_INSTANCE:instance,OFFICE_WORKER_PORT:String(port),OFFICE_WORKER_TOKEN:token,OFFICE_WORKER_ENGINE:engine,OFFICE_WORKER_MODEL:model,
  OFFICE_WORKER_MODEL_URL:modelList.base.replace(/\/$/,'')+'/v1',PYTHONUTF8:'1',PYTHON_DOTENV_DISABLED:'1',
  OPENAI_API_KEY:'local',OPENAI_BASE_URL:modelList.base.replace(/\/$/,'')+'/v1',WORKSPACE_DIR:workDir,
  DO_NOT_TRACK:'true',OTEL_SDK_DISABLED:'true',CREWAI_DISABLE_TELEMETRY:'true'});
const executable=/[\\/]/.test(python)?resolve(python):python;
const child=spawn(executable,['-u',resolve('workers/sdk.py')],{env,cwd:workDir,stdio:'inherit',windowsHide:true});
let startupError;
child.on('error',e=>{startupError=e;});
const stopped=new Promise(done=>child.once('close',code=>done(code)));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill());
try{
  let ready=false;
  for(let i=0;i<60;i++){
    if(startupError||child.exitCode!==null)throw startupError||Error('Worker ishga tushmadi.');
    try{
      const res=await fetch(workerBase+'/healthz',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(300)});
      const state=await res.json();
      if(res.ok&&state.instance===instance&&state.engine===engine){ready=true;break;}
    }catch{}
    await delay(150);
  }
  if(!ready)throw Error('Worker portini tekshiring.');
  const name='SDK · '+engine+' · '+port;
  const state=await api('/state'),previous=state.profiles.find(p=>p.name===name);
  if(previous&&(previous.provider!==engine||previous.base!==workerBase))throw Error('Profil nomi band.');
  await api('/profiles'+(previous?'/'+previous.id:''),{provider:engine,name,base:workerBase,model,key:token});
  console.log('Office profili tayyor: '+name+' ('+model+')');
  process.exitCode=await stopped||0;
}finally{child.kill();}
