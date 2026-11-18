// Builds a read-only visual preview from fresh, synthetic demo data.
// This file does not read .env, user databases, or provider credentials.
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { openStore } from '../src/store.mjs';
import { gitWorkflow } from '../src/git-workflow.mjs';
import { makeWorkflows } from '../src/workflows.mjs';
import { makeKnowledge } from '../src/knowledge.mjs';
import { makeReadiness } from '../src/readiness.mjs';
import { catalog,edictDemo,projectOffice } from '../src/projects.mjs';
import {initializeLeadership} from '../src/leadership.mjs';

const temporary=await mkdtemp(join(tmpdir(),'office-visual-'));
const store=openStore(temporary,true);
initializeLeadership(store);
try {
  const knowledge=makeKnowledge(store);
  knowledge.writeSkill({space:'it',name:'Kod va test tekshiruvi',description:'Qabul mezonlari, diff va test nazorati',body:'Qabul mezonlarini tekshiring. Test natijasi va diffni saqlang. Egasi tasdig‘ini kuting.',agents:['tech','qa']});
  knowledge.writeMemory({space:'it',title:'Ishlash tartibi',body:'Har bir dasturlash vazifasi uchun alohida branch va tekshiriladigan natija tayyorlang.'});
  const workflows=makeWorkflows({store,providers:{},paperclip:{enabled:false},knowledge,git:gitWorkflow({data:temporary,env:{},providers:{}})});
  for (const task of store.all('SELECT id,space FROM tasks')) {
    workflows.start(task.id);
    for(let i=0;i<300;i++) {
      const record=store.task(task.id);
      if(record.status==='error') throw Error(record.error);
      if(['approval','done'].includes(record.status)) break;
      if(i===299) throw Error('Preview demo timeout');
      await pause(40);
    }
  }
  const state={demo:true,paperclip:false,repos:[],defaultLocal:null,
    rooms:store.all("SELECT * FROM rooms ORDER BY (id='ceo-office') DESC,rowid"),agents:store.all('SELECT * FROM agents'),
    tasks:store.all('SELECT id,space,title,status,agent_id,demo,updated_at,error,external_id FROM tasks ORDER BY updated_at DESC'),
    profiles:[],sync:[],knowledge:{skills:1,memories:1,pending:store.one("SELECT count(*) AS count FROM improvements WHERE status='pending'").count},approvals:store.all('SELECT * FROM approvals'),
    events:store.all('SELECT events.*,tasks.title,tasks.demo FROM events JOIN tasks ON tasks.id=events.task_id ORDER BY seq DESC LIMIT 18')};
  const responses={
    '/team-templates':{templates:projectOffice({store,providers:{},env:{}}).teamTemplates()},
    '/projects':catalog.map(p=>({...p,source:false,service:'',monitor:false,profile:false})),
    '/projects/edict/demo':edictDemo(),
    '/session':{owner:true,demo:true,passwordRequired:false},'/state':state,
    '/setup':makeReadiness({store,providers:{list:()=>[],get:()=>null},env:{},paperclip:{enabled:false,agentMap:{}},git:{names:[]}}).state(),
    '/private':{items:store.all('SELECT id,kind,name,created_at FROM private_items'),chats:[]}
  };
  for(const room of state.rooms.filter(item=>item.space!=='private')){
    const messages=state.tasks.filter(task=>state.agents.some(agent=>agent.id===task.agent_id&&agent.room_id===room.id))
      .map(row=>{const task=store.task(row.id);return {...row,message:task.description,created_at:task.created_at,
        reply:task.status==='approval'?'Git diff va testlar tayyor. Egasi tasdig‘i kutilmoqda.':null};});
    responses['/room-dispatch?room='+encodeURIComponent(room.id)]={room:room.id,messages};
  }
  for(const {id} of state.tasks) responses['/tasks/'+id]={task:store.task(id),approval:store.one('SELECT * FROM approvals WHERE task_id=?',id),events:store.all('SELECT * FROM events WHERE task_id=? ORDER BY seq DESC',id)};
  for(const item of store.all('SELECT * FROM private_items')) responses['/private/items/'+item.id]=item;
  for(const space of ['it','ai','private'])responses['/knowledge?space='+space]=knowledge.list(space);
  for(const item of store.all('SELECT id FROM skills'))responses['/skills/'+item.id]=knowledge.skill(item.id);
  for(const item of store.all('SELECT id FROM memories'))responses['/memories/'+item.id]=knowledge.memory(item.id);
  const source=async path=>readFile(resolve(path),'utf8');
  const loop=(await source('public/vendor/game-loop.js')).replace('export function','function');
  let map=(await source('public/office-map.js')).replace(/^import[^\n]+\n/gm,'').replace('export function','function');
  const vendorFiles=['furniture-geometry.js','pathfinder.js','office-pathfinding.js','lead-role.js','life-sprites.js'];
  const vendor=(await Promise.all(vendorFiles.map(file=>source('public/vendor/'+file))))
    .map(code=>code.replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'')).join('\n');
  const previewSprites=await Promise.all(Array.from({length:6},async(_,index)=>
    'data:image/png;base64,'+(await readFile(resolve('public/vendor/characters/char_'+index+'.png'))).toString('base64')));
  map=map.replace("'/vendor/characters/char_'+index+'.png'",'PREVIEW_SPRITES[index]');
  let app=(await source('public/app.js')).replace(/^import[^\n]+\n/,'');
    app=app.replace("'/vendor/characters/char_'+index+'.png'",'PREVIEW_SPRITES[index]');
  const start=app.indexOf('async function api('),end=app.indexOf('function toast(',start);
  if(start<0||end<0) throw Error('Preview source shape changed');
  app=app.slice(0,start)+`async function api(path,body) {
    if(body!==undefined) throw Error('Bu faqat dizayn ko‘rinishi. Amallarni ishlatish uchun serverni npm start orqali ishga tushiring.');
    if(!Object.hasOwn(PREVIEW_RESPONSES,path)) throw Error('Server talab qilinadi.');
    return structuredClone(PREVIEW_RESPONSES[path]);
  }\n`+app.slice(end);
  const css=await source('public/original.css')+'\n'+await source('public/style.css');
  let html=await source('public/index.html');
  html=html.replace(/  <link[^\n]+\n/g,'').replace(/  <script[^\n]+\n/g,'');
  html=html.replace('</head>','<style>'+css+'</style></head>');
  html=html.replace('<body>','<body><div class="connection">STATIC PREVIEW — Demo ma’lumotlar. Serverga ulanmagan, faqat ko‘rish uchun.</div>');
  const script=`const PREVIEW_RESPONSES=${JSON.stringify(responses).replace(/</g,'\\u003c')};\nconst PREVIEW_SPRITES=${JSON.stringify(previewSprites)};\nconst mountOfficeMap=(()=>{${vendor}\n${loop}\n${map}\nreturn mountOfficeMap;})();\n${app}`;
  html=html.replace('</body>','<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script></body>');
  const output=resolve('artifacts/Albert-Agent-Space-Preview.html');
  await mkdir(resolve('artifacts'),{recursive:true});await writeFile(output,html);
  console.log('Read-only visual preview: '+output);
} finally {
  store.db.close();
  const parent=resolve(tmpdir())+sep;
  if(temporary.startsWith(parent)&&temporary.slice(parent.length).startsWith('office-visual-')) await rm(temporary,{recursive:true,force:true});
}
