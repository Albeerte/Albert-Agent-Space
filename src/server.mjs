import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openStore, now, id, digest } from './store.mjs';
import { makeProviders, makePaperclip, types, fail, webBase } from './providers.mjs';
import { makeWorkflows } from './workflows.mjs';
import { gitWorkflow } from './git-workflow.mjs';
import { extract, contextFor } from './documents.mjs';
import { makeKnowledge, knowledgeContext } from './knowledge.mjs';
import { backupDatabase } from './backup.mjs';
import { makeReadiness } from './readiness.mjs';
import { projectOffice,edictDemo } from './projects.mjs';
import {initializeLeadership,makeLeadership} from './leadership.mjs';

const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const assets={'/':'index.html','/original.css':'original.css','/style.css':'style.css','/app.js':'app.js','/office-map.js':'office-map.js','/vendor/game-loop.js':'vendor/game-loop.js'};
for(const file of ['pathfinder.js','furniture-geometry.js','office-pathfinding.js','lead-role.js','life-sprites.js',
  ...Array.from({length:6},(_,index)=>'characters/char_'+index+'.png')])assets['/vendor/'+file]='vendor/'+file;
const mimes={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png'};
function string(value,limit,label,required=true) {
  if (typeof value!=='string' || value.length>limit || (required&&!value.trim())) throw fail(label+' to‘g‘ri kiritilishi kerak.');
  return value.trim();
}
const optional=(value,limit,label)=>string(value??'',limit,label,false);
const equal=(a,b)=>timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));
function selectCookie(req) {
  for(const line of (req.headers.cookie||'').split(';')) {
    const [key,value]=line.trim().split('=');
    if(key==='office_session' && /^[a-f0-9]{64}$/.test(value)) return value;
  }
}
async function jsonBody(req) {
  if ((req.headers['content-type']??'').split(';')[0]!=='application/json') throw fail('JSON so‘rovi kerak.',415);
  let size=0;
  const chunks=[];
  for await (const part of req) {
    size+=part.length;
    if(size>2900000) throw fail('So‘rov hajmi chegaradan oshdi.',413);
    chunks.push(part);
  }
  try {
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || Array.isArray(body)||typeof body!=='object') throw Error();
    return body;
  } catch {
    throw fail('So‘rovdagi JSON yaroqsiz.');
  }
}
function send(res,status,data) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(data));
}
function sameOrigin(req,env) {
  if (!req.headers.origin) return;
  const expected=env.OFFICE_ORIGIN || (req.socket.encrypted?'https://':'http://')+req.headers.host;
  if (req.headers.origin!==expected) throw fail('So‘rov manziliga ruxsat berilmagan.',403);
}
function logonCookie(value,secure,maxAge) {
  return 'office_session='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+maxAge+(secure?'; Secure':'');
}

export function createOffice(env=process.env) {
  const password=env.OFFICE_PASSWORD||'';
  const host=env.OFFICE_HOST||'127.0.0.1';
  const demo=env.OFFICE_DEMO==='1'||(!password && env.OFFICE_DEMO!=='0');
  const loopback=['127.0.0.1','::1','localhost'].includes(host);
  if (!password && (!demo||!loopback)) throw Error('OFFICE_PASSWORD is required outside loopback demo mode.');
  const data=resolve(env.OFFICE_DATA||'data');
  mkdirSync(data,{recursive:true,mode:0o700});
  const store=openStore(data,demo);
    initializeLeadership(store);
  const backupState={enabled:env.OFFICE_BACKUPS!=='0',date:null,error:null};
  function backup(){
    if(!backupState.enabled)return;
    try{const result=backupDatabase(store.db,env.OFFICE_BACKUP_DIR||resolve(data,'backups'),{daily:true});backupState.date=result.date;backupState.error=null;}
    catch{backupState.error='Zaxira nusxa saqlanmadi. Disk joyi va papka huquqini tekshiring.';}
  }
  backup();
  const backupClock=setInterval(backup,3600000);backupClock.unref();
  const providers=makeProviders(store,env);
  const paperclip=makePaperclip(env);
  const git=gitWorkflow({data,env,providers});
  const knowledge=makeKnowledge(store,{providers});
  const workflow=makeWorkflows({store,providers,paperclip,git,knowledge});
  const readiness=makeReadiness({store,providers,env,paperclip,git});
  const loginAttempts=new Map();
  const secure=(env.OFFICE_ORIGIN||'').startsWith('https://');
  const defaultLocal=()=>{
    const provider=env.OFFICE_PRIVATE_PROVIDER==='lmstudio'?'lmstudio':'ollama';
    const base=provider==='ollama'?env.OFFICE_OLLAMA_URL:env.OFFICE_LM_STUDIO_URL;
    return base && env.OFFICE_PRIVATE_MODEL ? {provider,model:env.OFFICE_PRIVATE_MODEL,base}:null;
  };
  const startedAt=now();
  const projects=projectOffice({store,providers,knowledge,env,defaultLocal});
  const leadership=makeLeadership({store,providers});
  for(const {id:taskId} of store.all("SELECT id FROM tasks WHERE status='working' OR (status='review' AND json_extract(result,'$.qa') IS NULL) OR (status='todo' AND json_extract(config,'$.kind')='hierarchy-child')")) {
    store.update(taskId,{status:'error',error:'Server qayta ishga tushdi. Vazifani qayta boshlash mumkin.'},'Ish jarayoni uzildi.');
  }
  store.run('DELETE FROM sessions WHERE expires <= ?',Date.now());
  let syncing=false;
  const clock=setInterval(async()=>{
    if (syncing) return;
    syncing=true;
    try { await workflow.sync(); } catch { /* A later interval retries upstream reads. */ }
    finally { syncing=false; }
  },4000);
  clock.unref();
  function owner(req) {
    if (!password && demo && loopback && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return true;
    const cookie=selectCookie(req);
    return Boolean(cookie&&store.one('SELECT 1 FROM sessions WHERE hash=? AND expires>?',digest(cookie),Date.now()));
  }
  function tasks() {
    return store.all('SELECT id,space,title,status,agent_id,demo,updated_at,error,external_id FROM tasks ORDER BY updated_at DESC LIMIT 300');
  }
  function state() {
    return {
      preferences:{company:store.one("SELECT value FROM settings WHERE key='company-name'")?.value||'Albert Agent Space'},
      demo,paperclip:paperclip.enabled,repos:git.names,defaultLocal:defaultLocal()?.model||null,
      rooms:store.all("SELECT * FROM rooms ORDER BY (id='ceo-office') DESC,rowid"),
      agents:store.all('SELECT * FROM agents ORDER BY rowid'),tasks:tasks(),profiles:providers.list(),
      agentMessages:store.all('SELECT id,task_id,from_agent,to_agent,kind,substr(message,1,180) AS message,created_at FROM agent_messages ORDER BY rowid DESC LIMIT 25'),
      approvals:store.all("SELECT task_id,status,error FROM approvals WHERE status IN ('pending','accepted')"),
      sync:store.all('SELECT task_id,attempts,error,updated_at FROM task_sync'),
      knowledge:{skills:store.one('SELECT count(*) AS total FROM skills').total,memories:store.one('SELECT count(*) AS total FROM memories').total,
        pending:store.one("SELECT count(*) AS total FROM improvements WHERE status='pending'").total},
      events:store.all('SELECT events.*,tasks.title,tasks.demo FROM events JOIN tasks ON tasks.id=events.task_id ORDER BY seq DESC LIMIT 18')
    };
  }
  function dispatchRoom(roomId) {
    const room=store.one("SELECT id,space FROM rooms WHERE id=? AND space IN ('it','ai')",roomId);
    if(!room)throw fail('Korxona xonasi topilmadi.',404);
    return room;
  }
  async function createTask(body) {
    const space=body.space;
    if (!['it','ai'].includes(space)) throw fail('Vazifa bo‘limini tanlang.');
    const sample=Boolean(body.demo);
    if(sample&&!demo) throw fail('Demo rejimi serverda yoqilmagan.',403);
    let title=optional(body.title,140,'Vazifa nomi');
    let description=optional(body.description,16000,'Tavsif');
    const config={};
    const agentId=space==='it'?'cto':'head-ai';
    if (space==='it'&&!sample) {
      config.repo=string(body.repo,150,'Repo');
      if (!git.names.includes(config.repo)) throw fail('Repo serverdagi ro‘yxatdan tanlanishi kerak.',403);
      if(body.issue!=null&&body.issue!=='') {
        const issueNumber=Number(body.issue);
        if (!Number.isSafeInteger(issueNumber)||issueNumber<1) throw fail('GitHub issue raqami noto‘g‘ri.');
        const previous=await git.issue(config.repo,issueNumber);
        config.issue=previous.number;
        config.issueUrl=previous.url;
        title=title||previous.title.slice(0,140);
        description=[description,previous.body].filter(Boolean).join('\n\n').slice(0,16000);
      }
      config.developer=optional(body.developer,100,'Dasturchi')||'backend';
      const selected=store.one('SELECT a.id,r.space FROM agents a JOIN rooms r ON r.id=a.room_id WHERE a.id=?',config.developer);
      if(!selected||selected.space!=='it') throw fail('Dasturchi IT Company agenti bo`lishi kerak.',403);
    }
    if(space==='ai'&&!sample) {
      if(!Array.isArray(body.candidates)||body.candidates.length!==2||!Array.isArray(body.cases)||body.cases.length<1||body.cases.length>8) {
        throw fail('Ikki variant va 1–8 ta test satri kerak.');
      }
      config.candidates=body.candidates.map(item=>{
        const profileId=optional(item?.profileId,100,'Model profili');
        if(profileId&&!providers.get(profileId)) throw fail('Model profili topilmadi.',404);
        return {label:string(item?.label,100,'Variant'),prompt:optional(item?.prompt,3000,'Prompt'),profileId};
      });
      config.cases=body.cases.map(item=>({input:string(item?.input,3200,'Test savoli'),expected:optional(item?.expected,1200,'Etalon javob')}));
    }
    if (!title) throw fail('Vazifa nomini kiriting.');
    if (space==='it'&&!description) throw fail('Vazifa tavsifini kiriting.');
    const record={space,title,description,demo:sample,config,agentId};
    if (paperclip.enabled&&!sample) {
      const pipeline=space==='it'?['cto','tech',config.developer,'test','qa']:['head-ai','evaluation'];
      const missing=pipeline.filter(key=>!paperclip.agentMap[key]);
      if(missing.length) throw fail('PAPERCLIP_AGENT_MAP ichida agentlar yetishmaydi: '+missing.join(', '),503);
      if(body.paperclipIssue) {
        const issue=await paperclip.read(string(body.paperclipIssue,90,'Paperclip issue'));
        if (store.one('SELECT id FROM tasks WHERE external_id=?',issue.id)) throw fail('Bu Paperclip vazifasi oldin bog‘langan.',409);
        record.externalId=issue.id;
      } else {
        const issue=await paperclip.create(record);
        if(!issue?.id) throw fail('Paperclip vazifa ID sini qaytarmadi.',502);
        record.externalId=issue.id;
      }
    }
    return store.addTask(record);
  }
  function writeAgent(body,agentId) {
    const previous=agentId&&store.one('SELECT * FROM agents WHERE id=?',agentId);
    if(agentId&&!previous) throw fail('Agent topilmadi.',404);
    const room=store.one('SELECT * FROM rooms WHERE id=?',string(body.room,100,'Xona'));
    if(!room) throw fail('Xona topilmadi.',404);
    if (previous && store.one('SELECT space FROM rooms WHERE id=?',previous.room_id)?.space!==room.space) throw fail('Agentni boshqa ish muhitiga ko‘chirishga ruxsat berilmagan.');
    const name=string(body.name,70,'Agent nomi');
    const role=string(body.role,16000,'Agent roli');
    const sprite=body.sprite===undefined?(previous?.sprite_id??null):body.sprite===''||body.sprite===null?null:Number(body.sprite);
    if(sprite!==null&&(!Number.isInteger(sprite)||sprite<0||sprite>5))throw fail('Personaj 0 dan 5 gacha tanlanadi.');
    let lead=optional(body.lead,100,'Boshliq')||null;
    if(!lead&&agentId!=='ceo'&&room.space!=='private'){
      lead=store.one('SELECT id FROM agents WHERE room_id=? AND id!=? ORDER BY rowid LIMIT 1',room.id,agentId||'')?.id||'ceo';
    }
    if(agentId==='ceo'&&lead)throw fail('CEO daraxtning yuqorisida turadi.');
    const profile=optional(body.profile,100,'Model')||null;
    const backup=optional(body.backup,100,'Zaxira model')||null;
    if ((profile&&!providers.get(profile))||(backup&&!providers.get(backup))) throw fail('Model profili topilmadi.',404);
    if (profile&&profile===backup) throw fail('Asosiy va zaxira profil turlicha bo‘lishi kerak.');
    if (room.space==='private' && (backup || (profile&&!providers.isLocal(providers.get(profile))))) throw fail('Shaxsiy assistentga faqat mahalliy model biriktiriladi.');
    if (lead) {
      let manager=store.one('SELECT a.*,r.space FROM agents a JOIN rooms r ON r.id=a.room_id WHERE a.id=?',lead);
      if (!manager||(manager.space!==room.space&&!(lead==='ceo'&&room.space!=='private'))) throw fail('Boshliq bir xil ish muhitidan yoki CEO tanlanadi.');
      const seen=new Set(agentId?[agentId]:[]);
      while (manager) {
        if (seen.has(manager.id)) throw fail('Boshliq iyerarxiyasida yopiq halqa hosil bo‘ladi.');
        seen.add(manager.id);
        manager=manager.lead_id&&store.one('SELECT * FROM agents WHERE id=?',manager.lead_id);
      }
    }
    const key=agentId||id();
    store.run('INSERT INTO agents(id,room_id,name,role,lead_id,profile_id,backup_id,allow_paid,sprite_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET room_id=excluded.room_id,name=excluded.name,role=excluded.role,lead_id=excluded.lead_id,profile_id=excluded.profile_id,backup_id=excluded.backup_id,allow_paid=excluded.allow_paid,sprite_id=excluded.sprite_id',key,room.id,name,role,lead,profile,backup,Number(Boolean(body.allowPaid)),sprite);
    return {id:key};
  }
  function writeProfile(body,profileId) {
    const previous=profileId&&providers.get(profileId);
    if(profileId&&!previous) throw fail('Profil topilmadi.',404);
    const name=string(body.name,80,'Profil nomi');
    if (store.one('SELECT id FROM profiles WHERE name=? AND id!=?',name,profileId||'')) throw fail('Bu profil nomi band.',409);
    const provider=body.provider;
    if(!types.includes(provider)) throw fail('Provayderni tanlang.');
    const model=string(body.model,180,'Model ID');
    const raw=optional(body.base,260,'Server manzili');
    const base=raw?webBase(raw):'';
    const remote=optional(body.remoteAgent,100,'OpenClaw agent ID');
    if (remote&&!/^[a-z\d_-]+$/i.test(remote)) throw fail('OpenClaw agent ID formati noto‘g‘ri.');
    const key=optional(body.key,4000,'API kalit');
    const retained=!body.clearKey&&previous?.provider===provider&&previous?.base===base ? previous.secret : null;
    const secret=key?providers.encrypt(key):retained;
    const keyId=profileId||id();
    store.run('INSERT INTO profiles(id,name,provider,model,base,secret,remote_agent) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,provider=excluded.provider,model=excluded.model,base=excluded.base,secret=excluded.secret,remote_agent=excluded.remote_agent,tested=NULL,error=NULL',keyId,name,provider,model,base,secret,remote);
    return {id:keyId};
  }
  function privateOverview() {
    return {
      items:store.all('SELECT id,kind,name,created_at FROM private_items ORDER BY created_at DESC'),
      chats:store.all('SELECT * FROM private_chats ORDER BY created_at DESC LIMIT 50')
    };
  }
  async function ask(body) {
    const question=string(body.question,3000,'Savol');
    const itemId=optional(body.item,100,'Hujjat');
    const item=itemId&&store.one('SELECT * FROM private_items WHERE id=?',itemId);
    if(itemId&&!item) throw fail('Shaxsiy hujjat topilmadi.',404);
    const sample=Boolean(body.demo);
    if(sample&&!demo) throw fail('Demo rejimi yoqilmagan.',403);
    const profileId=optional(body.profile,100,'Model profili');
    const assistant=store.one("SELECT profile_id FROM agents WHERE id='assistant'");
    const profile=profileId?providers.get(profileId):assistant?.profile_id?providers.get(assistant.profile_id):defaultLocal();
    if(profileId&&!profile) throw fail('Model profili topilmadi.',404);
    const external=Boolean(profile&&!providers.isLocal(profile));
    if(external&&(!profileId||body.externalConsent!==true||!item||sample)) throw fail('Tashqi model ishlashi uchun hujjat, profil va shu savolga alohida ruxsat kerak.',403);
    const context=item?contextFor(item.body,question):'';
    let result;
    if (sample) {
      if(!item) throw fail('Demo javob uchun hujjatni tanlang.');
      result={text:context.slice(0,1700),model:'demo-extractive'};
    } else {
      if(!profile) throw fail('Mahalliy model sozlanmagan. OFFICE_OLLAMA_URL va OFFICE_PRIVATE_MODEL ni tekshiring.',503);
      const personalContext=external?'':knowledgeContext(store,{space:'private',agentId:'assistant',query:question});
      result=await providers.call(profile,
        personalContext+
        'Answer in Uzbek using only this document when provided. Say when the document does not contain the answer.\n'+
        JSON.stringify({question,document:context}),{localOnly:!external});
    }
    const row={id:id(),item_id:item?.id??null,question,answer:result.text,model:result.model,demo:+sample,external:+external,created_at:now()};
    store.run('INSERT INTO private_chats VALUES (?,?,?,?,?,?,?,?)',...Object.values(row));
    return row;
  }
  async function handle(req,res) {
    const path=new URL(req.url,'http://office.invalid').pathname;
    const method=req.method;
    if (path==='/healthz'&&method==='GET') return send(res,200,{status:'ok',version});
    if (method==='GET'&&Object.hasOwn(assets,path)) {
      const asset=assets[path];
      res.writeHead(200,{'Content-Type':mimes[asset.split('.').pop()]});
      res.end(readFileSync(resolve(publicDir,asset)));
      return;
    }
    if (!path.startsWith('/api/')) throw fail('Sahifa topilmadi.',404);
    if (method!=='GET') sameOrigin(req,env);
    if (path==='/api/session'&&method==='GET') return send(res,200,{owner:owner(req),demo,passwordRequired:Boolean(password)});
    if (path==='/api/login'&&method==='POST') {
      const time=Date.now();
      const address=req.socket.remoteAddress;
      let rate=loginAttempts.get(address);
      if (!rate||rate.until<time) {
        for(const [key,value] of loginAttempts) if(value.until<time) loginAttempts.delete(key);
        rate={tries:0,until:time+60000};
        loginAttempts.set(address,rate);
      }
      if(++rate.tries>10) throw fail('Bir daqiqadan so‘ng qayta urinib ko‘ring.',429);
      const body=await jsonBody(req);
      if(!password||typeof body.password!=='string'||!equal(password,body.password)) throw fail('Parol noto‘g‘ri.',401);
      loginAttempts.delete(address);
      const token=randomBytes(32).toString('hex');
      store.run('INSERT INTO sessions VALUES (?,?)',digest(token),Date.now()+86400000);
      res.setHeader('Set-Cookie',logonCookie(token,secure,86400));
      return send(res,200,{owner:true});
    }
    const agent=req.headers.authorization;
    if(agent&&env.OFFICE_AGENT_TOKEN&&equal(agent,'Bearer '+env.OFFICE_AGENT_TOKEN)) {
      if (path==='/api/agent/tasks'&&method==='GET') return send(res,200,{tasks:tasks()});
      throw fail('Agentga ushbu resurs uchun ruxsat berilmagan.',403);
    }
    if (!owner(req)) throw fail('Egasi akkaunti bilan kiring.',401);
    if(path==='/api/team-templates'&&method==='GET')return send(res,200,{templates:projects.teamTemplates()});
    if(path==='/api/preferences'&&method==='POST'){
      const body=await jsonBody(req);
      const company=string(body.company,70,'Kompaniya nomi');
      store.run("INSERT INTO settings VALUES ('company-name',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",company);
      return send(res,200,{company});
    }
    if(path==='/api/ceo/commands'&&method==='POST'){
      const body=await jsonBody(req);
      const task=leadership.create({title:string(body.title,140,'Nomi'),
        instruction:string(body.instruction,16000,'Buyruq'),mode:body.mode});
      workflow.start(task.id);
      return send(res,201,{id:task.id});
    }
    if(path==='/api/projects'&&method==='GET')return send(res,200,projects.list());
    if(path==='/api/projects/edict/demo'&&method==='GET')return send(res,200,edictDemo());
    if(path==='/api/projects/city'&&method==='POST')return send(res,200,projects.cityRooms());
    if(path==='/api/projects/team-template'&&method==='POST')return send(res,200,await projects.importTeam((await jsonBody(req)).template));
    if(path==='/api/projects/export'&&method==='POST'){
      const body=await jsonBody(req);
      if(body.project==='companyos')return send(res,200,projects.companySkill(string(body.id,100,'Skill')));
      if(body.project==='librechat')return send(res,200,projects.libreConfig(string(body.id,100,'Profil')));
      throw fail('Eksport turi topilmadi.');
    }
    if(path==='/api/projects/local-models'&&method==='GET'){
      const base=env.OFFICE_OLLAMA_URL;
      if(!base)throw fail('OFFICE_OLLAMA_URL sozlanishi kerak.',409);
      return send(res,200,{base,models:await providers.models({provider:'ollama',base})});
    }
    const projectRoute=path.match(/^\/api\/projects\/([a-z0-9-]+)\/(files|source|learn|monitor)$/);
    if(projectRoute){
      const [,project,action]=projectRoute;
      const params=new URL(req.url,'http://office.invalid').searchParams;
      if(action==='files'&&method==='GET')return send(res,200,await projects.files(project,params.get('q')||''));
      if(action==='source'&&method==='GET')return send(res,200,await projects.source(project,params.get('path')));
      if(action==='monitor'&&method==='GET')return send(res,200,await projects.monitor(project));
      if(action==='learn'&&method==='POST')return send(res,201,await projects.learn(project,await jsonBody(req)));
    }
    if(path==='/api/specialist-tasks'&&method==='POST'){
      const body=await jsonBody(req);
      const agent=store.one('SELECT a.id,r.space FROM agents a JOIN rooms r ON r.id=a.room_id WHERE a.id=?',string(body.agentId,100,'Agent'));
      if(!agent||agent.space==='private')throw fail('Jamoa agentini tanlang.',403);
      const task=store.addTask({space:agent.space,title:string(body.title,140,'Nomi'),description:string(body.prompt,16000,'Topshiriq'),config:{kind:'specialist'},agentId:agent.id,demo:false});
      workflow.start(task.id);
      return send(res,201,{id:task.id});
    }
    if(path==='/api/room-dispatch'){
      if(method==='GET'){
        const query=new URL(req.url,'http://office.invalid').searchParams;
        const room=dispatchRoom(query.get('room'));
        const messages=store.all(`SELECT id, title, description AS message, agent_id, status, error, created_at,
          json_extract(result,'$.summary') AS reply FROM tasks
          WHERE json_extract(config,'$.roomChannel')=? ORDER BY created_at DESC,rowid DESC LIMIT 30`,room.id);
        return send(res,200,{room:room.id,messages:messages.reverse()});
      }
      if(method==='POST'){
        const body=await jsonBody(req);
        const room=dispatchRoom(string(body.roomId,100,'Xona'));
        const agent=store.one('SELECT id FROM agents WHERE room_id=? AND id=?',
          room.id,string(body.agentId,100,'Bajaruvchi'));
        if(!agent)throw fail('Shu xonadagi agentni tanlang.',403);
        const prompt=string(body.message,16000,'Topshiriq');
        const request=string(body.requestId,36,'So‘rov raqami');
        if(!/^[a-f0-9-]{36}$/.test(request))throw fail('So‘rov raqami yaroqsiz.');
        const previous=store.one(`SELECT id,agent_id,description,json_extract(config,'$.roomChannel') AS room
          FROM tasks WHERE json_extract(config,'$.dispatchRequest')=?`,request);
        if(previous){
          if(previous.room!==room.id||previous.agent_id!==agent.id||previous.description!==prompt)
            throw fail('Bu so‘rov raqami boshqa vazifaga tegishli.',409);
          return send(res,200,{id:previous.id});
        }
        if(!store.one('SELECT profile_id FROM agents WHERE id=?',agent.id)?.profile_id)
          throw fail('Avval agentga model profilini biriktiring.',409);
        const title=prompt.split(/\r?\n/,1)[0].slice(0,115);
        const task=agent.id==='ceo'?leadership.create({title,instruction:prompt,
          mode:/hisobot|report|отч[её]т/i.test(prompt)?'report':'command'}):
          store.addTask({space:room.space,title,description:prompt,
            config:{kind:'specialist'},agentId:agent.id,demo:false});
        task.config={...task.config,roomChannel:room.id,dispatchRequest:request};
        store.run('UPDATE tasks SET config=? WHERE id=?',JSON.stringify(task.config),task.id);
        workflow.start(task.id);
        return send(res,201,{id:task.id});
      }
    }
    if(path==='/api/diagnostics'&&method==='GET') return send(res,200,{
      version,startedAt,storage:'sqlite-wal',demo,backup:{...backupState},
      github:{configured:Boolean(env.OFFICE_GITHUB_TOKEN),repos:git.names,testsEnabled:env.OFFICE_DOCKER_TESTS==='1'},
      paperclip:{configured:paperclip.enabled,agentMappings:Object.keys(paperclip.agentMap).length,pending:store.all('SELECT task_id,attempts,error,updated_at FROM task_sync')},
      local:{provider:defaultLocal()?.provider||null,model:defaultLocal()?.model||null},
      profiles:providers.list().map(({id,name,provider,tested,error})=>({id,name,provider,tested,error})),
      capabilities:{draftPR:true,merge:false,productionDeploy:false}
    });
    if(path==='/api/integrations/paperclip/test'&&method==='POST') return send(res,200,await paperclip.probe());
    if(path==='/api/logout'&&method==='POST') {
      const cookie=selectCookie(req);
      if(cookie) store.run('DELETE FROM sessions WHERE hash=?',digest(cookie));
      res.setHeader('Set-Cookie',logonCookie('',secure,0));
      return send(res,200,{owner:false});
    }
    if(path==='/api/state'&&method==='GET') return send(res,200,state());
    if(path==='/api/setup'&&method==='GET')return send(res,200,readiness.state());
    if(path==='/api/setup/assign'&&method==='POST')return send(res,200,readiness.assign(await jsonBody(req)));
    if(path==='/api/knowledge'&&method==='GET') return send(res,200,knowledge.list(new URL(req.url,'http://office.invalid').searchParams.get('space')||'it'));
    if(path==='/api/knowledge/export'&&method==='GET') {
      const space=new URL(req.url,'http://office.invalid').searchParams.get('space')||'it';
      const result=knowledge.exportSpace(space);
      res.setHeader('Content-Disposition','attachment; filename="office-knowledge-'+space+'.json"');
      return send(res,200,result);
    }
    const skillRoute=path.match(/^\/api\/skills(?:\/([a-f\d-]+))?$/);
    if(skillRoute){
      if(method==='GET'&&skillRoute[1])return send(res,200,knowledge.skill(skillRoute[1]));
      if(method==='POST')return send(res,skillRoute[1]?200:201,knowledge.writeSkill(await jsonBody(req),skillRoute[1]));
    }
    const restoreRoute=path.match(/^\/api\/skills\/([a-f\d-]+)\/restore$/);
    if(restoreRoute&&method==='POST'){
      const body=await jsonBody(req);
      return send(res,200,knowledge.restoreSkill(restoreRoute[1],body.version,body.currentVersion));
    }
    const memoryRoute=path.match(/^\/api\/memories(?:\/([a-f\d-]+))?$/);
    if(memoryRoute){
      if(method==='GET'&&memoryRoute[1])return send(res,200,knowledge.memory(memoryRoute[1]));
      if(method==='POST')return send(res,memoryRoute[1]?200:201,knowledge.writeMemory(await jsonBody(req),memoryRoute[1]));
    }
    const improvementRoute=path.match(/^\/api\/improvements\/([a-f\d-]+)\/decision$/);
    if(improvementRoute&&method==='POST')return send(res,200,knowledge.decide(improvementRoute[1],await jsonBody(req)));
    if(path==='/api/tasks'&&method==='POST') return send(res,201,await createTask(await jsonBody(req)));
    const taskRoute=path.match(/^\/api\/tasks\/([a-f\d-]+)(?:\/(run|approval|checks|improve))?$/);
    if(taskRoute) {
      const [,taskId,action]=taskRoute;
      const task=store.task(taskId);
      if(!task) throw fail('Vazifa topilmadi.',404);
      if(!action&&method==='GET') return send(res,200,{task,approval:store.one('SELECT * FROM approvals WHERE task_id=?',taskId),events:store.all('SELECT * FROM events WHERE task_id=? ORDER BY seq DESC LIMIT 50',taskId)});
      if(action==='improve'&&method==='POST'){
        const body=await jsonBody(req);
        return send(res,200,{proposals:await knowledge.reflect(task,optional(body.skillId,100,'Skill ID'))});
      }
      if(action==='run'&&method==='POST') return send(res,202,workflow.start(taskId));
      if(action==='approval'&&method==='POST') {
        const body=await jsonBody(req);
        if(!['approve','reject'].includes(body.decision)) throw fail('Tasdiqlash amalini tanlang.');
        return send(res,200,await workflow.approve(taskId,body.fingerprint,body.decision,optional(body.feedback,3000,'Tuzatish izohi')));
      }
      if(action==='checks'&&method==='GET') {
        if(task.demo||!task.result.draft?.url) throw fail('CI ma’lumotlari haqiqiy GitHub PR’dan olinadi.');
        const checks=await git.checks(task);
        store.update(taskId,{result:{...task.result,ci:{checks,checkedAt:now()}},agent_id:'devops-agent'},'DevOps GitHub CI natijalarini yangiladi.');
        return send(res,200,{checks});
      }
    }
    const roomMatch=path.match(/^\/api\/rooms(?:\/([a-z\d-]+))?$/);
    if(roomMatch&&method==='POST') {
      const key=roomMatch[1]||id();
      const previous=roomMatch[1]&&store.one('SELECT * FROM rooms WHERE id=?',key);
      if(roomMatch[1]&&!previous) throw fail('Xona topilmadi.',404);
      const body=await jsonBody(req);
      const space=previous?.space||body.space;
      if(!['it','ai','private'].includes(space)) throw fail('Ish muhitini tanlang.');
      store.run('INSERT INTO rooms VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,detail=excluded.detail',
        key,space,string(body.name,70,'Xona nomi'),optional(body.detail,170,'Tavsif'));
      return send(res,200,{id:key});
    }
    const agentMatch=path.match(/^\/api\/agents(?:\/([a-z\d-]+))?$/);
    if(agentMatch&&method==='POST') return send(res,200,writeAgent(await jsonBody(req),agentMatch[1]));
    const profileMatch=path.match(/^\/api\/profiles(?:\/([a-z\d-]+)(?:\/(test|models))?)?$/);
    if(profileMatch&&method==='POST') {
      const [,profileId,action]=profileMatch;
      if(!action) return send(res,200,writeProfile(await jsonBody(req),profileId));
      const profile=providers.get(profileId);
      if(!profile) throw fail('Profil topilmadi.',404);
      if(action==='models') return send(res,200,{models:await providers.models(profile)});
      try {
        const result=await providers.call(profile,'Reply with OK.');
        store.run('UPDATE profiles SET tested=?,error=NULL WHERE id=?',now(),profile.id);
        return send(res,200,{model:result.model});
      } catch(error) {
        store.run('UPDATE profiles SET tested=?,error=? WHERE id=?',now(),error.status?error.message:'Model sinovida server xatosi.',profile.id);
        throw error;
      }
    }
    if(path==='/api/private'&&method==='GET') return send(res,200,privateOverview());
    if(path==='/api/private/ask'&&method==='POST') return send(res,200,await ask(await jsonBody(req)));
    if(path==='/api/private/items'&&method==='POST') {
      const body=await jsonBody(req);
      if(!['note','plan','document'].includes(body.kind)) throw fail('Element turini tanlang.');
      const name=string(body.name,160,'Nomi');
      let content;
      if (body.kind==='document') {
        try { content=extract(name,body.encoded); }
        catch(error) { throw error.status?error:fail('Fayl matnini o‘qib bo‘lmadi.'); }
      } else content=string(body.text,160000,'Matn');
      const row={id:id(),kind:body.kind,name,body:content,created_at:now()};
      store.run('INSERT INTO private_items VALUES (?,?,?,?,?)',...Object.values(row));
      return send(res,201,row);
    }
    const itemRoute=path.match(/^\/api\/private\/items\/([a-f\d-]+)$/);
    if(itemRoute&&method==='GET') {
      const item=store.one('SELECT * FROM private_items WHERE id=?',itemRoute[1]);
      if(!item) throw fail('Shaxsiy hujjat topilmadi.',404);
      return send(res,200,item);
    }
    throw fail('Sahifa topilmadi.',404);
  }
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; style-src 'self'; img-src 'self' data:");
    handle(req,res).catch(error=>{
      if(!error.status && !env.OFFICE_QUIET) process.stderr.write('Office request failed: '+error.name+'\n');
      if (!res.headersSent) send(res,error.status??500,{error:error.status?error.message:'Server xatosi yuz berdi.'});
      else res.end();
    });
  });
  server.on('close',()=>{clearInterval(clock);clearInterval(backupClock);});
  server.on('error',error=>{
    clearInterval(clock);
    clearInterval(backupClock);
    process.exitCode=1;
    if (!env.OFFICE_QUIET) process.stderr.write(error.code==='EADDRINUSE'
      ? 'Port band. OFFICE_PORT orqali boshqa portni tanlang.\n'
      : 'Serverni ishga tushirib bo`lmadi: '+error.code+'\n');
  });
  return {server,host,store,stop:async()=>{
    await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));
    store.db.close();
  }};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const {server,host}=createOffice();
  const port=Number(process.env.OFFICE_PORT||8787);
  server.listen(port,host,()=>process.stdout.write('Albert Agent Space http://'+host+':'+port+'\n'));
}
