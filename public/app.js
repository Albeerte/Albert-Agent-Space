import { mountOfficeMap } from './office-map.js';
let mapSpace='';

const $=selector=>document.querySelector(selector);
const shell=$('#shell'), main=$('#main'), dialog=$('#dialog');
const labels={todo:'Navbatda',working:'Ishlayapti',review:'Tekshiruvda',approval:'Tasdiq kutyapti',done:'Bajarildi',error:'Xatolik',idle:'Bo‘sh'};
const spaces={it:'IT Company',ai:'AI Department',private:'Private Workspace'};
const symbols={executive:'CT',development:'DV',quality:'QA',devops:'DO',research:'AI','private-room':'PW'};
const pages={
  projects:['⬡','Jamoa va vositalar'],
  office:['⌂','Ofis'],kanban:['▤','Kanban'],org:['♧','Tashkiliy sxema'],
  approvals:['✓','Tasdiqlar'],knowledge:['✦','Skill va xotira'],private:['◇','Private Workspace'],setup:['↗','Ishga tushirish'],settings:['⚙','Sozlamalar']
};
const providerNames={openai:'OpenAI API',openrouter:'OpenRouter',nvidia:'NVIDIA NIM',ollama:'Ollama',lmstudio:'LM Studio',compatible:'OpenAI-compatible',litellm:'LiteLLM',openclaw:'OpenClaw',codex:'ChatGPT Pro / Codex'};
Object.assign(providerNames,{localai:'LocalAI',portkey:'Portkey Gateway',chatdev:'ChatDev',sim:'Sim',langflow:'Langflow',mastra:'Mastra',autogen:'AutoGen',crewai:'CrewAI',metagpt:'MetaGPT',ag2:'AG2',swarms:'Swarms','google-adk':'Google ADK'});
let data, privateData, knowledgeData, setupData, session, scheduled, polling=false, toastTimer;
let knowledgeSpace='it';
let route='office';
const e=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const chip=(status,text=labels[status])=>`<span class="tag ${e(status)}">${e(text)}</span>`;
const sample=value=>value?chip('demo','DEMO'):'';
const button=(text,action,key='',cls='')=>`<button type="button" class="button ${cls}" data-action="${action}" data-key="${e(key)}">${e(text)}</button>`;
const option=(value,text,current)=>`<option value="${e(value)}"${value===current?' selected':''}>${e(text)}</option>`;
const hint=text=>`<p class="muted">${e(text)}</p>`;
const pre=text=>`<pre class="pre">${e(text)}</pre>`;
const agentBy=id=>data.agents.find(agent=>agent.id===id);
const profileBy=id=>data.profiles.find(profile=>profile.id===id);
const date=value=>value?new Date(value).toLocaleString('uz-UZ',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tashkent'}):'';
const safeUrl=(value,host)=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname===host?e(url.href):'';}catch{return '';}};
const link=(value,text)=>{const url=safeUrl(value,'github.com');return url?`<a target="_blank" rel="noreferrer" href="${url}">${e(text)} ↗</a>`:'';};
const heading=(title,detail,buttons='')=>`<div class="heading"><div><h1>${e(title)}</h1>${detail?`<p>${e(detail)}</p>`:''}</div><div class="controls">${buttons}</div></div>`;
const profileOptions=(selected,blank='Tanlanmagan')=>option('',blank,selected)+data.profiles.map(profile=>option(profile.id,profile.name+' · '+profile.model,selected)).join('');
const taskButton=task=>`<button type="button" class="card" data-action="task" data-key="${e(task.id)}"><strong>${e(task.title)}</strong><small>${e(agentBy(task.agent_id)?.name||spaces[task.space])}</small><span>${sample(task.demo)}</span></button>`;

async function api(path,body) {
  const response=await fetch('/api'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json();
  if(!response.ok) throw Object.assign(Error(payload.error||'So‘rov bajarilmadi.'),{status:response.status});
  return payload;
}
function toast(message) {
  const node=$('#toast');
  node.hidden=false;
  node.textContent=message;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{node.hidden=true;},5500);
}
function modal(title,body){
  delete dialog.dataset.task;
  delete dialog.dataset.version;
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${e(title)}</h2>${button('Yopish','close')}</div><div class="dialog-body">${body}</div>`;
  if(!dialog.open) dialog.showModal();
}
function editForm(content,submit='Saqlash'){
  return `<form class="form">${content}<div class="controls"><button class="button primary" type="submit">${e(submit)}</button></div><p class="error-text" data-error hidden></p></form>`;
}
function field(label,name,value='',type='text',attrs=''){
  return `<label>${e(label)}<input name="${name}" type="${type}" value="${e(value)}" ${attrs}></label>`;
}
function area(label,name,value='',attrs=''){
  return `<label>${e(label)}<textarea name="${name}" ${attrs}>${e(value)}</textarea></label>`;
}
function select(label,name,options,attrs=''){
  return `<label>${e(label)}<select name="${name}" ${attrs}>${options}</select></label>`;
}
function checkbox(label,name,checked=false){
  return `<label class="inline"><input type="checkbox" name="${name}"${checked?' checked':''}>${e(label)}</label>`;
}
function onForm(container,handler) {
  const form=container.querySelector('form');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('button[type=submit]');
    const error=form.querySelector('[data-error]');
    submit.disabled=true;
    error.hidden=true;
    try{await handler(new FormData(form),form);}
    catch(problem){error.hidden=false;error.textContent=problem.message;}
    finally{submit.disabled=false;}
  });
}
async function afterSave(message){
  dialog.close();
  await refresh(true);
  toast(message);
}
function renderChrome(){
  const brand=$('.logo>span:last-child');
  if(brand)brand.textContent=data.preferences?.company||'Albert Agent Space';
  $('#stats').innerHTML=`<div class="tb-stat"><span class="tb-dot"></span><span>${data.agents.length} agent</span></div><div class="tb-stat"><span class="tb-num">${data.tasks.filter(task=>task.status==='working').length}</span> ishlayapti</div><div class="tb-stat">${data.demo?sample(true):chip('done','SERVER')}</div>`;
  renderNavigation();
  renderProviders();
  $('#events').innerHTML=data.events.length?data.events.map(event=>
      `<button type="button" class="tentry" data-action="task" data-key="${e(event.task_id)}"><strong>${e(event.title)}</strong><small>${e(event.message)}</small><small>${e(date(event.created_at))} ${sample(event.demo)}</small></button>`
    ).join(''):hint('Hodisalar vazifa yaratilganda ko‘rinadi.');
}
let profileQuery='';
let expandedProviders=new Set();
try{
  const saved=JSON.parse(localStorage.getItem('office-provider-groups'));
  if(Array.isArray(saved))expandedProviders=new Set(saved.filter(value=>typeof value==='string'));
}catch{}
function renderNavigation(){
  const groups=[
    ['Ish joyi',['office','kanban','org','approvals']],
    ['Resurslar',['knowledge','private','projects']],
    ['Boshqaruv',['setup','settings']]
  ];
  const icons={office:'\u2302',kanban:'\u25a4',org:'\u2442',approvals:'\u2713',knowledge:'\u2726',private:'\u25c7',projects:'\u25a6',setup:'\u2197',settings:'\u2699'};
  const counts={approvals:data.approvals.length,kanban:data.tasks.filter(task=>task.status==='working').length};
  $('#navigation').innerHTML=groups.map(([title,items])=>
    '<section class="nav-group" aria-label="'+e(title)+'"><h2>'+e(title)+'</h2>'+
    items.map(key=>'<a class="navitem" href="#'+key+'"'+(key===route?' aria-current="page"':'')+
      '><span class="nav-icon" aria-hidden="true">'+icons[key]+'</span><span class="nav-label">'+e(pages[key][1])+'</span>'+
      (counts[key]?'<b aria-label="'+e(counts[key]+' ta')+'">'+counts[key]+'</b>':'')+'</a>').join('')+'</section>').join('');
}
function renderProviders(){
  const active=document.activeElement;
  const editing=active?.id==='profile-query';
  const selection=editing?[active.selectionStart,active.selectionEnd]:null;
  $('#providers').innerHTML='<div class="provider-heading"><h2>Model profillari</h2><a href="#settings" title="Model sozlamalari" aria-label="Model sozlamalarini ochish">\u2699</a></div>'+
    '<label class="profile-search"><span aria-hidden="true">\u2315</span><input id="profile-query" type="search" aria-label="Profil yoki modelni qidirish" placeholder="Profil yoki model..." value="'+e(profileQuery)+'"></label>'+
    '<div id="provider-list" class="provider-list"></div>'+
    '<div class="provider-footer">'+button('+ Profil qo‘shish','profile-edit','','primary')+'</div>';
  $('#profile-query').oninput=event=>{profileQuery=event.target.value;renderProviderList();};
  renderProviderList();
  if(editing){$('#profile-query').focus({preventScroll:true});$('#profile-query').setSelectionRange(...selection);}
}
function renderProviderList(){
  const query=profileQuery.trim().toLocaleLowerCase();
  const filtered=data.profiles.filter(profile=>[profile.name,profile.model,providerNames[profile.provider]||profile.provider].join(' ').toLocaleLowerCase().includes(query));
  const groups=Object.groupBy(filtered,profile=>profile.provider);
  $('#provider-list').innerHTML=Object.entries(groups).map(([type,profiles])=>{
    const name=providerNames[type]||type;
    const failed=profiles.filter(profile=>profile.error).length;
    const tested=profiles.filter(profile=>profile.tested&&!profile.error).length;
    const status=failed?'Xato bor':tested===profiles.length?'Sinovdan o‘tgan':tested?'Qisman tekshirilgan':'Sinov kutilmoqda';
    const indicator=failed?'failed':tested===profiles.length?'tested':'untested';
    return '<details class="provider-group" data-provider="'+e(type)+'"'+(expandedProviders.has(type)||query?' open':'')+'>'+
      '<summary><span class="provider-avatar" aria-hidden="true">'+e(name.slice(0,2).toUpperCase())+'</span>'+
      '<span class="provider-summary"><strong>'+e(name)+'</strong><small>'+profiles.length+' profil · '+e(status)+'</small></span>'+
      '<span class="provider-dot '+indicator+'" aria-label="'+e(status)+'"></span><span class="provider-chevron" aria-hidden="true">\u203a</span></summary>'+
      '<div class="provider-profiles">'+profiles.map(profile=>'<div class="provider-profile">'+
        '<button type="button" class="profile-open" data-action="profile-edit" data-key="'+e(profile.id)+'" title="'+e(profile.name+' · '+profile.model)+'">'+
        '<strong>'+e(profile.name)+'</strong><span>'+e(profile.model)+'</span></button>'+
        '<button type="button" class="profile-probe" data-action="profile-test" data-key="'+e(profile.id)+'" aria-label="'+e(profile.name+' ulanishini tekshirish')+'" title="Ulanishni tekshirish">\u21bb</button>'+
        (profile.error?'<small class="profile-error">'+e(profile.error)+'</small>':'')+'</div>').join('')+'</div></details>';
  }).join('')||(query?hint('Mos profil topilmadi.'):hint('Agentga model ulash uchun profil qo‘shing.'));
  $('#provider-list').querySelectorAll('details').forEach(details=>details.addEventListener('toggle',()=>{
    if(query)return;
    if(details.open)expandedProviders.add(details.dataset.provider);
    else expandedProviders.delete(details.dataset.provider);
    localStorage.setItem('office-provider-groups',JSON.stringify([...expandedProviders]));
  }));
}

function currentFor(agent){
  const assigned=data.tasks.filter(task=>task.agent_id===agent.id);
  return assigned.find(task=>['working','review','approval','todo'].includes(task.status))||assigned[0];
}
function agentNode(agent,size='sm'){
  const task=currentFor(agent);
  const status=task?.status||'idle';
  const ring={working:'thinking',review:'busy',approval:'busy',done:'active',error:'failed',todo:'idle',idle:'idle'}[status];
  const initial=agent.name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  const lead=(!agent.lead_id||data.agents.some(item=>item.lead_id===agent.id))?'is-lead':'';
  return `<button type="button" class="anode ${lead}" data-action="agent" data-key="${e(agent.id)}" aria-label="${e(agent.name+' · '+labels[status])}"><span class="aav ${size}"><span class="aring ${ring}"></span>${e(initial)}<span class="abadge ${ring}"></span></span><span class="desk"></span><span class="albl">${e(agent.name)}</span></button>`;
}
function roomCard(room){
  const agents=data.agents.filter(agent=>agent.room_id===room.id);
  const task=data.tasks.find(task=>agents.some(agent=>agent.id===task.agent_id)&&['working','review','approval','todo'].includes(task.status));
  const footer=task?`<button type="button" class="ctask" data-action="task" data-key="${e(task.id)}"><i class="dot"></i><span>${e(task.title)}</span></button>`:
    room.space==='private'?'<a class="ctask" href="#private"><span>Shaxsiy xonaga kirish →</span></a>':`<div class="ctask"><span>${e(room.detail||'Vazifa biriktirilmagan')}</span></div>`;
  return `<article class="droom ${room.space}"><div class="droom-bg"></div><header class="drh"><div class="dicon">${e(symbols[room.id]||room.name.slice(0,2).toUpperCase())}</div><div class="dtitle"><div class="dname">${e(room.name)}</div><div class="dcnt">${agents.length} agent</div></div>${button('⋯','room-edit',room.id,'icon-button')}</header><div class="dagents">${agents.map(agent=>agentNode(agent)).join('')}</div>${footer}</article>`;
}
let floorController;
const floorCamera={zoom:1,x:0,y:0};
let officeMotion=localStorage.getItem('office-motion')!=='false';
let officeMeetings=localStorage.getItem('office-meetings')!=='false';
document.documentElement.dataset.accent=localStorage.getItem('office-accent')||'sage';
let selectedRoom = '';
let selectedAgent = '';
let officeFocus = localStorage.getItem('office-focus')==='true';
let officePanel = 'dispatch';
let dispatchInFlight = false;
let dispatchMessage = '';
const dispatchDrafts = new Map();
const dispatchRequests = new Map();
const inProgress = new Set(['working','review','approval']);

function renderOffice(){
  $('#floor-wrap')?.floorResize?.disconnect();
  const companyRooms=data.rooms.filter(room=>room.space!=='private');
  const room=companyRooms.find(item=>item.id===selectedRoom)||companyRooms[0];
  selectedRoom=room?.id||'';
  const staff=data.agents.filter(agent=>agent.room_id===selectedRoom);
  const staffIds=new Set(staff.map(agent=>agent.id));
  const leader=staff.find(agent=>!staffIds.has(agent.lead_id));
  const lead=staff.find(agent=>agent.id===selectedAgent)||leader||staff[0];
  const active=data.tasks.filter(task=>inProgress.has(task.status)).length;
  const waiting=data.approvals.length;
  const optionGroups=Object.entries(spaces).filter(([key])=>key!=='private').map(([key,name])=>
    `<optgroup label="${e(name)}">${companyRooms.filter(item=>item.space===key).map(item=>option(item.id,item.name,selectedRoom)).join('')}</optgroup>`).join('');
  const current=document.activeElement;
  const editing=current?.matches('#dispatch-message');
  const selection=editing?[current.selectionStart,current.selectionEnd]:null;
  const tabs=[['dispatch','Jamoa chati'],['activity','Ish jurnali'],['reports','Hisobotlar']];
  main.innerHTML=`
    <div class="command-head">
      <div><h1>Ofis</h1><p>${data.agents.length} agent <span></span> ${active} jarayonda</p></div>
      <div class="controls">
        <a class="button" href="#approvals">Tasdiqlar${waiting?' · '+waiting:''}</a>
        ${button('Jamoa andozalari','team-library')}
        ${button('CEOga buyruq','ceo-command','','primary')}
        ${button('Barchadan hisobot','ceo-command','report')}
        ${button('Yangi vazifa','task-new','','primary')}
      </div>
    </div>
    <nav class="office-teams" aria-label="Ofis jamoalari">
      <button type="button" data-action="office-team" data-key="" aria-pressed="${mapSpace===''}">Barcha xonalar <small>${data.rooms.length}</small></button>
      ${companyRooms.map(item=>{
        const ids=new Set(data.agents.filter(agent=>agent.room_id===item.id).map(agent=>agent.id));
        const busy=data.tasks.filter(task=>ids.has(task.agent_id)&&inProgress.has(task.status)).length;
        return `<button type="button" data-action="office-team" data-key="${e(item.id)}" aria-pressed="${mapSpace==='team'&&selectedRoom===item.id}"><i class="team-dot${busy?' is-busy':''}"></i>${e(item.name)}<small>${ids.size}</small></button>`;
      }).join('')}
      ${button('+ Jamoa','team-library')}
    </nav>
    <nav class="work-surface-tabs" aria-label="Ish oynalari">
      <a href="#office" aria-current="page">Ofis</a>
      <a href="#kanban">Vazifalar</a><a href="#approvals">Qarorlar</a>
      <a href="#knowledge">Xotira va skill</a>
      ${button('Natijalar','office-panel','reports')}
      ${button('Ish jurnali','office-panel','activity')}
    </nav>
    <div class="command-workspace${officeFocus?' office-focus':''}">
      <section class="map-frame command-map">
        <div class="map-heading"><span><span class="tb-dot"></span> ${mapSpace==='team'?e(room?.name||'Ofis'):'Albert / Jonli ofis'}</span>
          <select id="map-space" aria-label="Xarita filtri">
            ${option('','Barcha xonalar',mapSpace)}${Object.entries(spaces).map(([key,name])=>option(key,name,mapSpace)).join('')}
            ${room?option('team','Tanlangan xona',mapSpace):''}
          </select>
        </div>
        <div class="floor-controls" aria-label="Xarita boshqaruvi">
          <button type="button" id="floor-out" aria-label="Kichraytirish">−</button>
          <output id="floor-zoom" aria-live="polite">100%</output>
          <button type="button" id="floor-in" aria-label="Kattalashtirish">+</button>
          <button type="button" id="floor-fit">Markazga</button>
          <button type="button" id="floor-motion" aria-pressed="${officeMotion}">Harakat</button>
          <button type="button" data-action="office-focus" aria-pressed="${officeFocus}">${officeFocus?'Chatni ko`rsatish':'Ofisni kengaytirish'}</button>
          ${button('Agent qo`shish','agent-edit')}
          <small>Surish uchun xaritani torting</small>
        </div>
        <div id="floor-wrap" class="floor-wrap" tabindex="0" aria-label="Ofis xaritasi. Yo‘nalish tugmalari bilan suring, + va − bilan o‘lchamni almashtiring."></div>
        <div class="map-legend">${['idle','working','review','approval','done','error'].map(status=>chip(status)).join('')}</div>
      </section>
      <section class="command-dock" aria-label="Jamoa boshqaruvi">
        <div class="command-tabs">${tabs.map(([key,label])=>`<button type="button" data-action="office-panel" data-key="${key}" aria-pressed="${key===officePanel}">${label}</button>`).join('')}</div>
        ${officePanel==='dispatch'?renderDispatch(room,staff,lead,optionGroups):renderOperations(officePanel)}
      </section>
    </div>
    <details class="command-roster">
      <summary>Xonalar va agentlar</summary>
      <div class="controls">${button('+ Xona','room-edit')}${button('+ Agent','agent-edit')}</div>
      <div class="dept-grid">${data.rooms.map(roomCard).join('')}</div>
    </details>
    ${data.demo?`<div class="demo-banner"><div><strong>Demo sinovlari</strong></div>${button('IT jarayoni','quick-demo','it')}${button('AI taqqoslash','quick-demo','ai')}</div>`:''}`;
  const drawMap=()=>{
    const rooms=mapSpace==='team'?data.rooms.filter(item=>item.id===selectedRoom):
      mapSpace?data.rooms.filter(item=>item.space===mapSpace):data.rooms;
    const canvas=document.createElement('canvas');
    canvas.id='office-map';
    canvas.setAttribute('aria-label','Interaktiv 2D ofis. Agentlar ro‘yxati xarita ostida.');
    $('#floor-wrap').replaceChildren(canvas);
    floorController?.stop();
    floorController=mountOfficeMap(canvas,{...data,rooms,roomOrder:data.rooms.map(item=>item.id),officeMotion,officeMeetings},key=>{
      const agent=agentBy(key);
      const room=data.rooms.find(row=>row.id===agent?.room_id);
      if(room?.space!=='private'){
        selectedRoom=agent.room_id;selectedAgent=key;
      }
      agentDetail(key).catch(error=>toast(error.message));
    });
    bindFloorCamera(canvas);
  };
  $('#map-space').onchange=event=>{mapSpace=event.target.value;renderOffice();};
  drawMap();
  $('#floor-motion').onclick=()=>{officeMotion=!officeMotion;$('#floor-motion').setAttribute('aria-pressed',String(officeMotion));drawMap();};
  const selector=$('#dispatch-room');
  if(!selector)return;
  selector.onchange=event=>{selectedRoom=event.target.value;selectedAgent='';dispatchMessage='';renderOffice();$('#dispatch-room').focus();};
  const recipient=$('#dispatch-agent');
  if(recipient)recipient.onchange=event=>{selectedAgent=event.target.value;dispatchRequests.delete(selectedRoom);};
  const textarea=$('#dispatch-message');
  if(textarea){
    textarea.oninput=event=>{dispatchDrafts.set(selectedRoom,event.target.value);dispatchRequests.delete(selectedRoom);};
    if(selection){textarea.focus({preventScroll:true});textarea.setSelectionRange(...selection);}
    $('#dispatch-form').onsubmit=sendDispatch;
  }
  void loadDispatch(selectedRoom);
}

function bindFloorCamera(canvas){
  const wrap=$('#floor-wrap');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const update=()=>{
    const maxX=Math.max(0,(canvas.offsetWidth*floorCamera.zoom-wrap.clientWidth)/2);
    const maxY=Math.max(0,(canvas.offsetHeight*floorCamera.zoom-wrap.clientHeight)/2);
    floorCamera.x=clamp(floorCamera.x,-maxX,maxX);
    floorCamera.y=clamp(floorCamera.y,-maxY,maxY);
    canvas.style.transform='translate('+floorCamera.x+'px,'+floorCamera.y+'px) scale('+floorCamera.zoom+')';
    $('#floor-zoom').textContent=Math.round(floorCamera.zoom*100)+'%';
  };
  const zoom=step=>{floorCamera.zoom=clamp(floorCamera.zoom+step,.6,2.6);update();};
  const fit=()=>{
    const scale=Math.min(wrap.clientWidth/canvas.width,wrap.clientHeight/canvas.height);
    canvas.style.width=Math.floor(canvas.width*scale)+'px';
    canvas.style.height=Math.floor(canvas.height*scale)+'px';
    update();
  };
  wrap.floorResize?.disconnect();
  wrap.floorResize=new ResizeObserver(fit);
  wrap.floorResize.observe(wrap);
  $('#floor-in').onclick=()=>zoom(.2);
  $('#floor-out').onclick=()=>zoom(-.2);
  $('#floor-fit').onclick=()=>{Object.assign(floorCamera,{zoom:1,x:0,y:0});update();};
  let drag;
  wrap.onpointerdown=event=>{
    if(event.button!==0||event.target.closest('button'))return;
    drag={x:event.clientX,y:event.clientY,startX:floorCamera.x,startY:floorCamera.y,moved:false};
  };
  wrap.onpointermove=event=>{
    if(!drag||event.buttons!==1)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>5){
      drag.moved=true;
      wrap.setPointerCapture(event.pointerId);
    }
    floorCamera.x=drag.startX+dx;floorCamera.y=drag.startY+dy;update();
  };
  if(wrap.cancelDragClick)wrap.removeEventListener('click',wrap.cancelDragClick,true);
  wrap.cancelDragClick=event=>{
    if(drag?.moved){event.preventDefault();event.stopPropagation();}
  };
  wrap.addEventListener('click',wrap.cancelDragClick,true);
  wrap.onpointerup=event=>{if(wrap.hasPointerCapture(event.pointerId))wrap.releasePointerCapture(event.pointerId);};
  wrap.onpointercancel=()=>{drag=null;};
  wrap.onwheel=event=>{if(event.ctrlKey){event.preventDefault();zoom(event.deltaY<0?.1:-.1);}};
  wrap.onkeydown=event=>{
    const directions={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};
    if(directions[event.key]){event.preventDefault();floorCamera.x+=directions[event.key][0];floorCamera.y+=directions[event.key][1];update();}
    if(['+','=','-'].includes(event.key)){event.preventDefault();zoom(event.key==='-'?-.2:.2);}
  };
  fit();
}

function renderDispatch(room,staff,lead,optionGroups) {
  if(!room)return hint('Jamoa chatini ochish uchun xona yarating.');
  const composer=staff.length?`<form id="dispatch-form" class="command-compose">
    <label for="dispatch-agent">Bajaruvchi</label><select id="dispatch-agent" name="agentId">
      ${staff.map(agent=>option(agent.id,agent.name,lead.id)).join('')}
    </select>
    <label for="dispatch-message">Topshiriq</label>
    <textarea id="dispatch-message" name="message" maxlength="16000" required rows="3" placeholder="Natijada nimani olishni xohlaysiz?">${e(dispatchDrafts.get(room.id)||'')}</textarea>
    <p class="error-text" id="dispatch-feedback" role="status"${dispatchMessage?'':' hidden'}>${e(dispatchMessage)}</p>
    <button type="submit" class="button primary"${dispatchInFlight?' disabled':''}>Topshiriqni yuborish</button>
  </form>`:hint('Xonaga agent qo‘shing.');
  return `<div class="command-team">
    <label for="dispatch-room">Jamoa</label><select id="dispatch-room">${optionGroups}</select>
    ${button('Xonani tahrirlash','room-edit',room.id,'room-edit-control')}
  </div>
  <div class="command-thread" id="dispatch-thread" role="log" aria-label="Jamoa topshiriqlari"></div>
  ${composer}`;
}

async function loadDispatch(room) {
  const thread=$('#dispatch-thread');
  if(!thread||!room)return;
  try {
    const result=await api('/room-dispatch?room='+encodeURIComponent(room));
    if(!thread.isConnected||room!==selectedRoom)return;
    thread.innerHTML=result.messages.length?result.messages.map(row=>{
      const agent=agentBy(row.agent_id);
      return `<article class="command-turn">
        <div class="owner-post"><small>Siz → ${e(agent?.name||'Agent')} · ${e(date(row.created_at))}</small><p>${e(row.message)}</p></div>
        <div class="agent-post">${chip(row.status)}${row.reply?'<p>'+e(row.reply)+'</p>':''}
          ${row.error?'<p class="error-text">'+e(row.error)+'</p>':''}
          ${button('Vazifani ochish','task',row.id)}
        </div>
      </article>`;
    }).join(''):hint('Bu xonada hali topshiriq yuborilmagan.');
    thread.scrollTop=thread.scrollHeight;
  } catch(error) {
    if(thread.isConnected)thread.textContent=error.message;
  }
}

async function sendDispatch(event) {
  event.preventDefault();
  if(dispatchInFlight)return;
  const room=selectedRoom;
  const form=event.currentTarget;
  const fields=new FormData(form);
  const requestId=dispatchRequests.get(room)||crypto.randomUUID();
  dispatchRequests.set(room,requestId);
  dispatchInFlight=true;
  form.querySelector('button[type=submit]').disabled=true;
  dispatchMessage='';
  try {
    await api('/room-dispatch',{roomId:room,agentId:fields.get('agentId'),message:fields.get('message'),requestId});
    dispatchDrafts.delete(room);
    dispatchRequests.delete(room);
  } catch(error) {
    if(selectedRoom===room)dispatchMessage=error.message;
  } finally {
    dispatchInFlight=false;
  }
  if(route==='office'){
    renderOffice();
    void refresh().catch(error=>toast(error.message));
  }
}

function renderOperations(panel){
  if(panel==='reports'){
    const reports=data.tasks.filter(task=>['done','approval','error'].includes(task.status));
    return `<div class="command-thread"><h2>Vazifa natijalari</h2>${
      reports.length?reports.map(task=>`<article class="command-record">${chip(task.status)}${sample(task.demo)}${taskButton(task)}</article>`).join(''):
        hint('Yakunlangan yoki tasdiqqa tayyor vazifa hali yo‘q.')}</div>`;
  }
  return `<div class="command-thread"><h2>Agentlar faoliyati</h2>${
    data.events.length?data.events.map(entry=>`<article class="command-record"><small>${e(date(entry.created_at))} ${sample(entry.demo)}</small>
      ${button(entry.title,'task',entry.task_id)}<p>${e(entry.message)}</p></article>`).join(''):hint('Vazifa boshlanganda jurnal yangilanadi.')}</div>`;
}
function renderKanban(){
  const sections=Object.entries(labels).filter(([key])=>key!=='idle');
  main.innerHTML=heading('Kanban','Vazifani ochib, uni ishga tushiring yoki natijasini ko‘ring.',button('+ Vazifa','task-new','','primary'))+
  `<div class="kanban">${sections.map(([key,label])=>`<section class="column"><h3>${e(label)}</h3>${data.tasks.filter(task=>task.status===key).map(taskButton).join('')}</section>`).join('')}</div>`;
}
let settingsTab='models';
function renderOrg(){
  function branch(agents,lead=null){
    const list=agents.filter(agent=>agent.lead_id===lead);
    return list.length?'<ul class="tree">'+list.map(agent=>'<li>'+button(agent.name,'agent',agent.id)+branch(agents,agent.id)+'</li>').join('')+'</ul>':'';
  }
  const team=data.agents.filter(agent=>data.rooms.some(room=>room.id===agent.room_id&&room.space!=='private'));
  main.innerHTML=heading('Boshqaruv daraxti','Buyruqlar pastga, hisobotlar yuqoriga qaytadi.',button('CEOga buyruq','ceo-command','','primary')+button('+ Agent','agent-edit'))+
    '<section class="panel">'+branch(team)+'</section><section class="panel"><h2>Private Workspace</h2>'+branch(data.agents.filter(agent=>!team.includes(agent)))+'</section>';
}
function ceoCommand(mode='command'){
  modal(mode==='report'?'Barcha jamoalar hisoboti':'CEOga buyruq',editForm(
    field('Nomi','title',mode==='report'?'Kompaniya hisoboti':'','text','required maxlength="140"')+
    select('Jarayon','mode',option('command','CEO vazifani taqsimlasin',mode)+option('report','Barcha xodimlardan hisobot',mode))+
    area('Buyruq','instruction',mode==='report'?'Har bir xodim oxirgi ishlari, muammolari va rejalari haqida rahbariga hisobot bersin. CEO umumiy hisobotni yig‘sin.':'','required maxlength="16000"')+
    hint('Har bir xodim o‘z modelidan foydalanadi. Buyruq va hisobotlar serverda saqlanadi.'),'CEOga yuborish'));
  onForm(dialog,async fields=>{const task=await api('/ceo/commands',Object.fromEntries(fields));await refresh(true);await taskDetail(task.id);});
}
function renderSettings(){
  const tabs={general:'Kompaniya',appearance:'Ko‘rinish',models:'AI modellari',leaders:'Rahbarlar',memory:'Xotira va skill',services:'Integratsiyalar'};
  let body='';
  if(settingsTab==='models'){renderModelSettings();main.querySelector('.heading')?.remove();body=main.innerHTML;}
  if(settingsTab==='general')body='<section class="panel"><h2>Kompaniya</h2>'+
    editForm(field('Kompaniya nomi','company',data.preferences?.company||'Albert Agent Space','text','required maxlength="70"'))+
    button('CEO modeli va rahbarligi','agent-edit','ceo')+button('Barchadan hisobot','ceo-command','report')+'</section>';
  if(settingsTab==='appearance')body='<section class="panel"><h2>Ko‘rinish</h2>'+editForm(
    select('Mavzu','theme',option('dark','Qorong‘i',document.documentElement.dataset.theme)+option('light','Yorug‘',document.documentElement.dataset.theme))+
    select('Rang','accent',['sage','blue','violet','amber'].map(key=>option(key,{sage:'Yashil',blue:'Ko‘k',violet:'Binafsha',amber:'Oltin'}[key],localStorage.getItem('office-accent')||'sage')).join(''))+
    checkbox('Bo‘sh agentlar yursin','motion',officeMotion)+checkbox('Buyruq va hisobot uchrashuvlari','meetings',officeMeetings),'Qo‘llash')+'</section>';
  if(settingsTab==='leaders')body='<section class="panel"><h2>Rahbar va team lead</h2>'+button('Daraxtni ochish','org-open')+
    data.agents.map(agent=>'<article class="row-card"><strong>'+e(agent.name)+'</strong><small> '+e(agentBy(agent.lead_id)?.name||'Egasi')+' · '+e(profileBy(agent.profile_id)?.name||'Model tanlanmagan')+'</small>'+button('Tahrirlash','agent-edit',agent.id)+'</article>').join('')+'</section>';
  if(settingsTab==='memory')body='<section class="panel"><h2>Doimiy xotira</h2>'+hint(data.knowledge.skills+' ta skill, '+data.knowledge.memories+' ta xotira yozuvi.')+
    hint('Skill biriktiring, versiyalarni tiklang va yaxshilash takliflarini tasdiqlang.')+button('Skill va xotira','knowledge-open')+'</section>';
  if(settingsTab==='services')body='<section class="panel"><h2>Xizmatlar va adapterlar</h2>'+hint('Paperclip, OpenClaw, GitHub va boshqa loyihalar ulanishlari.')+
    button('Ulanishlarni tayyorlash','setup-open')+button('Jamoa va vositalar','projects-open')+'</section>';
  main.innerHTML=heading('Sozlamalar','Ish muhiti, agentlar va ulanishlarni boshqaring.',settingsTab==='models'?button('+ Model profili','profile-edit','','primary'):'')+
    '<div class="settings-layout"><nav class="settings-tabs" aria-label="Sozlamalar"><small>ISH MUHITI</small>'+
    Object.entries(tabs).map(([key,label])=>button(label,'settings-tab',key,settingsTab===key?'primary':'')).join('')+
    '</nav><div class="settings-content">'+body+'</div></div>';
  if(settingsTab==='general')onForm(main,async fields=>{await api('/preferences',Object.fromEntries(fields));await refresh(true);toast('Kompaniya sozlamalari saqlandi.');});
  if(settingsTab==='appearance')onForm(main,async fields=>{
    document.documentElement.dataset.theme=fields.get('theme');localStorage.setItem('office-theme',fields.get('theme'));
    document.documentElement.dataset.accent=fields.get('accent');localStorage.setItem('office-accent',fields.get('accent'));
    officeMotion=fields.has('motion');officeMeetings=fields.has('meetings');
    localStorage.setItem('office-motion',String(officeMotion));localStorage.setItem('office-meetings',String(officeMeetings));toast('Ko‘rinish saqlandi.');
  });
}

function renderApprovals(){
  const waiting=data.tasks.filter(task=>task.status==='approval');
  main.innerHTML=heading('Tasdiqlar','Diff, test natijasi va PR matnini ko‘rib chiqing.')+
    `<section class="panel">${waiting.length?waiting.map(task=>`<button type="button" class="row-card" data-action="task" data-key="${e(task.id)}"><span class="task-row"><strong>${e(task.title)}</strong>${sample(task.demo)}${chip('approval')}</span><small>${e(agentBy(task.agent_id)?.name||'QA')}</small></button>`).join(''):hint('Tasdiqlash uchun vazifa yo‘q.')}</section>`;
}
function renderModelSettings(){
  const rows=data.profiles.map(profile=>`<section class="panel"><div class="task-row"><h3>${e(profile.name)}</h3>${profile.tested?chip(profile.error?'error':'done',profile.error?'Ulanmadi':'Ulandi'):chip('idle','Sinov kutilmoqda')}</div><p>${e(providerNames[profile.provider])} · ${e(profile.model)}</p>${profile.error?`<p class="error-text">${e(profile.error)}</p>`:''}<div class="controls">${button('Tahrirlash','profile-edit',profile.id)}${button('Ulanishni sinash','profile-test',profile.id)}${button('Modellar','profile-models',profile.id)}</div></section>`).join('');
  main.innerHTML=heading('Sozlamalar','Nomlangan akkaunt profillari, modellarning ulanish holati va repolar.',button('Ulanishlarni tayyorlash','setup-open')+button('+ Model profili','profile-edit','','primary'))+
    `<div class="split"><section class="panel"><h3>Paperclip</h3>${hint(data.paperclip?'Issue integratsiyasi yoqilgan.':'Issue integratsiyasi server sozlamalaridan yoqiladi.')}</section><section class="panel"><h3>GitHub repolari</h3>${hint(data.repos.join(', ')||'Server ro‘yxatiga repo qo‘shilmagan.')}</section></div>`+
    `<section class="panel"><div class="task-row"><h3>Integratsiyalar holati</h3><div class="controls">${button('Diagnostika','diagnostics')}${button('Paperclip sinovi','paperclip-test')}</div></div><div id="diagnostics-output">${hint(data.sync?.length?'Paperclip bilan sinxronlash navbatida '+data.sync.length+' vazifa bor.':'Sinxronlash navbati bo‘sh.')}</div>${hint('Merge va production deploy ushbu versiyada yopiq. Draft PR faqat diff tasdiqlangandan keyin ochiladi.')}</section>`+
    (rows?`<div class="split">${rows}</div>`:`<section class="panel">${hint('Hozircha model profili mavjud emas.')}</section>`);
}
function renderPrivate(){
  if(!privateData){main.innerHTML=heading('Private Workspace','Yuklanmoqda…');return;}
  const kind={note:'Eslatma',plan:'Reja',document:'Hujjat'};
  const items=privateData.items.map(item=>`<button type="button" class="row-card" data-action="private-item" data-key="${e(item.id)}"><strong>${e(item.name)}</strong><small>${kind[item.kind]} · ${e(date(item.created_at))}</small></button>`).join('');
  const options=privateData.items.map(item=>option(item.id,item.name)).join('');
  const form=editForm(select('Manba','item',option('','Hujjat yoki eslatmani tanlang')+options)+
    area('Savol','question','','required maxlength="3000" placeholder="Masalan, uchrashuv qachon boshlanadi?"')+
    `<details><summary>Model va ruxsat</summary><div class="stack">${select('Model','profile',profileOptions('','Mahalliy standart'+(data.defaultLocal?' · '+data.defaultLocal:'')))}${checkbox('Shu savol va tanlangan manbani tashqi modelga yuborishga ruxsat beraman','externalConsent')}${data.demo?checkbox('Demo javobdan foydalanish','demo'):''}</div></details>`,'Savol yuborish');
  main.innerHTML=heading('Private Workspace','Shaxsiy assistent, hujjatlar, eslatmalar va rejalar.',
    button('+ Fayl','private-new','document','primary')+button('+ Eslatma','private-new','note')+button('+ Reja','private-new','plan'))+
    `<div class="split"><section class="panel"><h2>Manbalar</h2>${items||hint('Hujjat yuklang yoki eslatma yarating.')}</section><section class="panel" id="ask-panel"><h2>Assistentga savol</h2>${form}</section></div>
    <section class="panel"><h2>Suhbat tarixi</h2>${privateData.chats.map(chat=>`<article class="row-card"><span class="controls"><strong>${e(chat.question)}</strong>${sample(chat.demo)}${chip(chat.external?'approval':'idle',chat.external?'Tashqi model':chat.demo?'Demo javob':'Mahalliy model')}</span>${pre(chat.answer)}<small>${e(chat.model)} · ${e(date(chat.created_at))}</small></article>`).join('')||hint('Saqlangan javoblar shu yerda ko‘rinadi.')}</section>`;
  onForm($('#ask-panel'),async fields=>{
    await api('/private/ask',{item:fields.get('item'),question:fields.get('question'),profile:fields.get('profile'),externalConsent:fields.has('externalConsent'),demo:fields.has('demo')});
    privateData=await api('/private');
    renderPrivate();
    toast('Javob saqlandi.');
  });
}
function renderKnowledge(){
  const tabs=`<div class="controls">${Object.entries(spaces).map(([key,label])=>button(label,'knowledge-space',key,knowledgeSpace===key?'primary':'')).join('')}</div>`;
  if(!knowledgeData){main.innerHTML=heading('Skill va doimiy xotira','Yuklanmoqda…')+tabs;return;}
  const skills=knowledgeData.skills.map(skill=>`<button type="button" class="row-card" data-action="skill-edit" data-key="${e(skill.id)}"><span class="task-row"><strong>${e(skill.name)}</strong>${chip('idle','v'+skill.version)}</span><small>${e(skill.description||'Yo‘riqnoma')}</small><small>${e(skill.agents.map(key=>agentBy(key)?.name||key).join(', ')||'Agentga biriktirilmagan')}</small></button>`).join('');
  const memories=knowledgeData.memories.map(memory=>`<button type="button" class="row-card" data-action="memory-edit" data-key="${e(memory.id)}"><strong>${e(memory.title)}</strong><small>${e(memory.preview)}</small><small>${e(date(memory.updated_at))}</small></button>`).join('');
  const pending=knowledgeData.improvements.filter(row=>row.status==='pending');
  main.innerHTML=heading('Skill va doimiy xotira','Skill qo‘shing, agentga biriktiring va ish natijalaridan olingan takliflarni tasdiqlang.',button('+ Skill','skill-edit','','primary')+button('+ Xotira','memory-edit'))+tabs+
    `<div class="knowledge-summary"><span>${knowledgeData.skills.length} skill</span><span>${knowledgeData.memories.length} xotira yozuvi</span><span>${pending.length} yaxshilash taklifi</span><a href="/api/knowledge/export?space=${knowledgeSpace}" download>JSON nusxasini yuklash ↓</a></div>`+
    `<section class="panel"><div class="task-row"><h2>Self-improvement</h2>${chip('approval',pending.length+' taklif')}</div>${hint('Vazifa natijasidan saboq taklifi avtomatik tayyorlanadi. Model tahlili uchun tugallangan vazifada “Yaxshilash taklifi”ni bosing. Tasdiqlangan xotira va agentga biriktirilgan skill keyingi topshiriqlarda ishlatiladi.')}${pending.map(row=>`<button type="button" class="row-card" data-action="improvement" data-key="${e(row.id)}"><span class="task-row"><strong>${e(row.title)}</strong>${sample(row.demo)}</span><small>${row.kind==='skill'?'Yangi skill':'Xotiraga saboq'} · ${e(date(row.created_at))}</small></button>`).join('')||hint('Hozircha taklif yo‘q. IT yoki AI vazifasini bajaring.')}</section>`+
    `<div class="split"><section class="panel"><h2>Skill kutubxonasi</h2>${skills||hint('Markdown yo‘riqnoma yozing yoki .md fayl import qiling.')}</section><section class="panel"><h2>Doimiy xotira</h2>${memories||hint('Qoidalar, afzalliklar va muhim ma’lumotlarni saqlang.')}</section></div>`+
    hint('Yozuvlar va ularning eski versiyalari server bazasida muddat cheklovisiz saqlanadi. Ko‘p yozuvdan vazifaga tegishli qismlar tanlanadi. Shaxsiy xotira faqat shaxsiy lokal assistentga uzatiladi.');
}
async function loadKnowledge(){const space=knowledgeSpace,loaded=await api('/knowledge?space='+space);if(space!==knowledgeSpace)return;knowledgeData=loaded;if(route==='knowledge')renderKnowledge();}
function renderSetup(){
  if(!setupData){main.innerHTML=heading('Ishga tushirish','Ulanishlar holati yuklanmoqda…');return;}
  const setup=setupData;
  const pipelines=setup.pipelines.map(pipeline=>{
    const team=setup.agents.filter(agent=>agent.space===pipeline.space);
    return `<section class="panel"><div class="task-row"><h2>${e(pipeline.name)}</h2>${chip(pipeline.modelsConfigured?'review':'error',pipeline.modelsConfigured?'Model sozlangan':'Sozlash kerak')}</div><p>${e(pipeline.steps.join(' → '))}</p><div class="controls">${button('Asosiy profilni bo‘limga biriktirish','setup-assign',pipeline.space)}</div>${team.map(agent=>`<div class="row-card"><div class="task-row"><strong>${e(agent.name)}</strong>${button('Tahrirlash','agent-edit',agent.id)}</div><small>${e(agent.model||'Model tanlanmagan')}</small><small class="${agent.configured?'muted':'error-text'}">${e(agent.reason)}</small>${agent.profile_id?button('Profil ulanishini sinash','profile-test',agent.profile_id):''}</div>`).join('')}</section>`;
  }).join('');
  main.innerHTML=heading('Ishga tushirish','Avval model profillari, so‘ng Paperclip va tanlangan GitHub repolarini tayyorlang.',button('+ Model profili','profile-edit','','primary')+button('Yangilash','setup-refresh'))+
    `<section class="panel">${hint('“Sozlangan” konfiguratsiya borligini bildiradi. Haqiqiy ishlashini profil sinovi va vazifa bajarish orqali tekshiring. Tokenlar bu sahifada ko‘rsatilmaydi.')}</section>`+
    `<div class="split">${pipelines}</div><div class="split"><section class="panel"><h2>Paperclip</h2>${chip(setup.paperclip.configured?'review':'error',setup.paperclip.configured?'Konfiguratsiya bor':'Sozlanmagan')}${hint('Map’da yo‘q rollar: '+(setup.paperclip.missingMappings.join(', ')||'yo‘q'))}${button('Paperclip ulanishini sinash','paperclip-test')}<details><summary>Serverdagi .env sozlamalari</summary>${pre('PAPERCLIP_URL=http://127.0.0.1:3100\nPAPERCLIP_COMPANY_ID=kompaniya-id\nPAPERCLIP_TOKEN=serverda-saqlanadigan-token\nPAPERCLIP_AGENT_MAP={"cto":"remote-cto","tech":"remote-tech","backend":"remote-dev","test":"remote-test","qa":"remote-qa","head-ai":"remote-head","evaluation":"remote-eval"}')}</details>${hint('Server sozlamalari o‘zgarsa Office’ni qayta ishga tushiring. Bir ish uchun bitta executor ishlasin.')}</section>`+
    `<section class="panel"><h2>GitHub va test runner</h2>${chip(setup.github.configured?'review':'error',setup.github.configured?'Repo va token sozlangan':'Repo yoki token kerak')}${hint('Ruxsatli repolar: '+(setup.github.repos.join(', ')||'yo‘q'))}${hint('Test runner: '+(setup.github.testRunnerEnabled?'Yoqilgan':'O‘chirilgan'))}${hint(setup.github.runtime==='docker'?'Standart Compose konteynerida tashqi repo testlari uchun Docker runner ulanmagan. Haqiqiy oqim uchun native host rejimini ishlating.':'Haqiqiy repo testlari uchun native hostda Docker CLI va oldindan yuklangan test image kerak.')}<details><summary>Serverdagi .env sozlamalari</summary>${pre('OFFICE_GITHUB_TOKEN=tanlangan-repolar-tokeni\nOFFICE_DOCKER_TESTS=1\nOFFICE_GITHUB_REPOS={"owner/repo":{"paths":["src/example.js"],"image":"node:24-bookworm-slim","test":["node","--test"]}}')}</details></section></div>`+
    `<section class="panel"><h2>OpenClaw / ChatGPT Pro</h2>${hint('OpenClaw ichida rasmiy Codex login bajaring. Office’da OpenClaw yoki ChatGPT Pro / Codex profilini yarating: Gateway /v1 URL, token, remote agent ID va backend model ID kiriting. Profilni sinab, kerakli bo‘limga biriktiring.')}${hint('Private Workspace uchun tasdiqlangan Ollama yoki LM Studio profili talab qilinadi. Merge va production deploy ushbu versiyada yopiq.')}</section>`;
}
async function loadSetup(){const loaded=await api('/setup');setupData=loaded;if(route==='setup')renderSetup();}
const view={office:renderOffice,projects:renderProjects,kanban:renderKanban,org:renderOrg,approvals:renderApprovals,knowledge:renderKnowledge,setup:renderSetup,private:renderPrivate,settings:renderSettings};
function renderProjects(){
  const card=(title,description,actions)=>'<section class="panel capability-card"><h2>'+title+'</h2><p>'+description+'</p><div class="controls">'+actions+'</div></section>';
  main.innerHTML=heading('Jamoa va vositalar','Jamoa tuzing, agentlarni sozlang va ishni boshlang.')+
    '<div class="split capability-grid">'+
    card('Jamoa tuzish','Mahsulot, tadqiqot yoki kontent jamoasini tayyor rollar bilan qo‘shing.',
      button('Jamoa tanlash','team-library','','primary')+button('City Accountants jamoalari','city-rooms'))+
    card('CEO boshqaruvi','Buyruqni rahbarlar orqali yetkazing va xodimlarning hisobotini yig‘ing.',
      button('CEOga buyruq','ceo-command','','primary')+button('Barchadan hisobot','ceo-command','report'))+
    card('Vazifa va natija','Dasturlash vazifasi yoki ikki modelni solishtirish jarayonini boshlang.',
      button('Yangi vazifa','task-new','','primary')+button('Agentga topshiriq','specialist'))+
    card('Ofisni tashkil qilish','Xona, agent va rahbarlarni o‘zingizning ish tartibingizga moslang.',
      button('Xona qo‘shish','room-edit')+button('Agent qo‘shish','agent-edit')+'<a class="button" href="#org">Boshqaruv daraxti</a>')+
    card('AI modellari','Akkaunt profili qo‘shing, lokal modelni tanlang va agentga biriktiring.',
      button('Model profili','profile-edit','','primary')+button('Lokal modellar','local-models')+button('Ulanishlar','setup-open'))+
    card('Jamoani ulash','Jamoa ko‘nikmasini yoki chat konfiguratsiyasini fayl sifatida oling.',
      button('Skill eksporti','project-export','companyos')+button('Chat sozlamasi','project-export','librechat'))+
    card('Doimiy bilim','Agentga ko‘nikma biriktiring, xotirani saqlang va yaxshilash takliflarini ko‘rib chiqing.',
      '<a class="button primary" href="#knowledge">Skill va xotira</a>')+
    '</div>';
}
async function teamLibrary(){
  const {templates}=await api('/team-templates');
  const descriptions={product:'Dastur yaratish va natijani tekshirish.',research:'Savolni o‘rganish va manbali xulosa tayyorlash.',content:'Matn yaratish, tahrirlash va dalillarni tekshirish.'};
  modal('Jamoa tanlang','<div class="template-grid">'+templates.map(team=>
    '<section class="panel team-template"><div class="task-row"><h3>'+e(team.name)+'</h3><span class="tag">'+team.roles.length+' rol</span></div>'+
    '<p>'+e(descriptions[team.id])+'</p><ul>'+team.roles.map(role=>'<li>'+e(role)+'</li>').join('')+'</ul>'+
    button('Jamoani qo‘shish','team-template',team.id,'primary')+'</section>').join('')+'</div>'+
    hint('Mavjud jamoaga qo‘shilganda bir xil agentlar takror yaratilmaydi.'));
}
async function localModels(){
  const r=await api('/projects/local-models');
  modal('Ollama modellari',r.models.length?editForm(select('Kompyuterdagi model','model',r.models.map(m=>option(m,m)).join('')),'Profil yaratish'):hint('Ollama hali model saqlamagan.'));
  if(r.models.length)onForm(dialog,fields=>profileEdit('',r.models,{provider:'ollama',base:r.base,model:fields.get('model'),name:'Ollama · '+fields.get('model')}));
}
function specialist(selected=''){
  const team=data.agents.filter(a=>data.rooms.some(r=>r.id===a.room_id&&r.space!=='private'));
  modal('Agentga topshiriq',editForm(select('Bajaruvchi','agentId',team.map(a=>option(a.id,a.name,selected)).join(''))+
    field('Nomi','title','','text','required maxlength="140"')+area('Topshiriq','prompt','','required maxlength="16000"')+
    hint('Matn agentga biriktirilgan profilga yuboriladi. Natija Kanban va vazifa tarixida saqlanadi.'),'Bajarish'));
  onForm(dialog,async fields=>{const task=await api('/specialist-tasks',Object.fromEntries(fields));await refresh(true);await taskDetail(task.id);});
}
async function exportProject(project){
  let items;
  if(project==='companyos'){
    const teams=await Promise.all(['it','ai'].map(s=>api('/knowledge?space='+s)));
    items=teams.flatMap(t=>t.skills);
  }else items=data.profiles.filter(p=>['ollama','localai','lmstudio','openai','openrouter','nvidia','compatible','litellm'].includes(p.provider));
  if(!items.length){modal('Eksport',hint(project==='companyos'?'Avval jamoa uchun skill saqlang.':'Avval model API profilini yarating.'));return;}
  modal('Faylni yuklab olish',editForm(select(project==='companyos'?'Jamoa skilli':'Model profili','id',items.map(x=>option(x.id,x.name)).join('')),'Yuklab olish'));
  onForm(dialog,async fields=>{
    const file=await api('/projects/export',{project,id:fields.get('id')});
    const url=URL.createObjectURL(new Blob([file.body],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    modal(file.name,hint(file.path||'LibreChat serveridagi librechat.yaml sifatida ishlating. API kalitini LibreChat muhitiga kiriting.')+pre(file.body));
  });
}
async function refresh(force=false) {
  const entry=await api('/state');
  const changed=JSON.stringify(data)!==JSON.stringify(entry);
  data=entry;
  $('#connection').hidden=true;
  if(changed||force){
    const active=document.activeElement;
    const navigationFocus=active?.closest('#navigation')?active.getAttribute('href'):null;
    renderChrome();
    if(navigationFocus) $('#navigation').querySelector(`[href="${navigationFocus}"]`)?.focus();
    if(route==='knowledge')await loadKnowledge();
    else if(route==='setup')await loadSetup();
    else if(route!=='private'||force) view[route]();
    const shown=data.tasks.find(task=>task.id===dialog.dataset.task);
    if(dialog.open&&shown&&shown.updated_at!==dialog.dataset.version) await taskDetail(shown.id);
  }
}
async function changePage(){
  $('#floor-wrap')?.floorResize?.disconnect();
  floorController?.stop();
  const hash=location.hash.slice(1);
  route=Object.hasOwn(view,hash)?hash:'office';
  if(!data)return;
  if(dialog.open)dialog.close();
  if(route==='private') {
    renderPrivate();
    const loaded=await api('/private');
    if(route==='private'){privateData=loaded;renderPrivate();}
  } else if(route==='projects'){renderProjects();}
  else if(route==='knowledge'){renderKnowledge();await loadKnowledge();}
  else if(route==='setup'){renderSetup();await loadSetup();}
  else view[route]();
  renderChrome();
  main.scrollTop=0;
}
function renderLogin(){
  const pane=$('#session');
  pane.hidden=false;
  main.innerHTML='';
  shell.hidden=true;
  $('#logout').hidden=true;
  pane.innerHTML=`<div class="panel"><h1>Albert Agent Space</h1>${hint('Egasi paroli bilan kiring.')}${editForm(field('Parol','password','','password','required autocomplete="current-password"'),'Kirish')}</div>`;
  onForm(pane,async fields=>{await api('/login',{password:fields.get('password')});await initialize();});
}
async function initialize(){
  clearInterval(scheduled);
  session=await api('/session');
  if(!session.owner){renderLogin();return;}
  $('#session').hidden=true;
  $('#logout').hidden=!session.passwordRequired;
  shell.hidden=false;
  await refresh(true);
  await changePage();
  scheduled=setInterval(async()=>{
    if(polling||document.hidden)return;
    polling=true;
    try{await refresh();}catch(error){
      if(error.status===401){data=null;privateData=null;knowledgeData=null;setupData=null;dialog.close();clearInterval(scheduled);renderLogin();}
      else {$('#connection').hidden=false;$('#connection').textContent='Server bilan aloqa uzildi. Oxirgi olingan holat ko‘rsatilmoqda. Qayta ulanish tekshirilmoqda.';}
    }
    finally{polling=false;}
  },2400);
}
$('#theme').addEventListener('click',()=>{
  const chosen=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=chosen;
  localStorage.setItem('office-theme',chosen);
});
document.documentElement.dataset.theme=localStorage.getItem('office-theme')==='light'?'light':'dark';
$('#logout').addEventListener('click',async()=>{
  await api('/logout',{});
  data=null;privateData=null;knowledgeData=null;setupData=null;
  dispatchDrafts.clear();dispatchRequests.clear();dispatchMessage='';
  await initialize();
});
window.addEventListener('hashchange',()=>changePage().catch(error=>toast(error.message)));

async function taskDetail(key){
  const {task,approval,events}=await api('/tasks/'+key);
  const result=task.result;
  const teamReports=result.reports?.length?'<section class="panel"><h3>Xodimlar hisoboti</h3>'+result.reports.map(row=>
    '<article class="command-record">'+chip(row.status)+button(row.agent,'task',row.taskId)+'<p>'+e(row.summary)+'</p></article>').join('')+'</section>':'';

  const tests=result.test?`<h3>Test natijasi · ${result.test.code??'To‘xtatildi'}</h3>${pre(result.test.log||'Natija yozuvi bo‘sh.')}`:'';
  const qa=result.qa?`<h3>QA xulosasi</h3><p>${e(result.qa.feedback)}</p>`:'';
  const evaluations=result.evaluations?.map(variant=>`<section class="panel"><div class="task-row"><h3>${e(variant.label)}</h3>${chip('done',variant.matched+'/'+variant.scored)}</div><div class="table-scroll"><table><thead><tr><th>Test</th><th>Etalon</th><th>Javob</th><th>Model</th><th>Vaqt</th></tr></thead><tbody>${variant.rows.map(row=>`<tr><td>${e(row.input)}</td><td>${e(row.expected)}</td><td>${e(row.answer)}</td><td>${e(row.model)}</td><td>${row.ms} ms</td></tr>`).join('')}</tbody></table></div></section>`).join('')||'';
  let actions=button('Natijani yangilash','task',task.id);
  if(['todo','review','error'].includes(task.status)&&approval?.status!=='accepted') actions+=button(task.status==='todo'?'Ishga tushirish':'Qayta ishlash','task-run',task.id,'primary');
  if(task.status==='approval'&&approval?.status==='pending') actions+=button(task.demo?'Demo natijasini tasdiqlash':'Tasdiqlash va draft PR ochish','approve',task.id+'|'+approval.fingerprint,'primary')+button('Tuzatishga qaytarish','reject',task.id+'|'+approval.fingerprint);
  if(task.status==='approval'&&approval?.status==='accepted') actions+=button('Draft PR ochishni davom ettirish','approve',task.id+'|'+approval.fingerprint,'primary');
  if(result.draft?.url) actions+=button('CI natijalari','checks',task.id);
  if(['done','review','error'].includes(task.status))actions+=button('Yaxshilash taklifi','task-improve',task.id);
  modal(task.title,`<div class="controls">${chip(task.status)}${sample(task.demo)}${e(agentBy(task.agent_id)?.name||'')}${task.external_id?chip('idle','Paperclip'):''}</div>
    ${task.description?`<p>${e(task.description)}</p>`:''}${task.config.issueUrl?link(task.config.issueUrl,'GitHub issue #'+task.config.issue):''}
    ${task.error||approval?.error?`<p class="error-text">${e(task.error||approval.error)}</p>`:''}
    <div class="controls">${actions}</div>
    ${result.intake?`<h3>CTO xulosasi</h3>${pre(result.intake)}`:''}
    ${result.criteria?`<h3>Qabul mezonlari</h3>${pre(result.criteria)}`:''}
    ${result.diff?`<h3>Git diff</h3>${pre(result.diff)}`:''}${tests}${qa}
    ${result.pr?`<h3>Draft PR matni</h3>${pre(result.pr.title+'\n\n'+result.pr.body)}`:''}
    ${result.draft?.demo?hint('Demo draft PR yozuvi saqlandi.'):result.draft?.url?link(result.draft.url,'Draft PR #'+result.draft.number):''}
    ${result.summary?`<p>${e(result.summary)}</p>`:''}${teamReports}${evaluations}
    <div id="checks-output"></div>
    <details><summary>Vazifa tarixi</summary><div class="stack">${events.map(event=>hint(date(event.created_at)+' · '+event.message)).join('')}</div></details>`);
  dialog.dataset.task=task.id;
  dialog.dataset.version=task.updated_at;
}
function taskNew(){
  const team=select('Ish muhiti','space',option('it','IT Company')+option('ai','AI Department'));
  const repo=select('GitHub repo','repo',option('','Tanlang')+data.repos.map(name=>option(name,name)).join(''));
  const caseForm=[1,2,3].map(index=>`<div class="split">${field('Test '+index,'input'+index,'','text','maxlength="3200"')}${field('Etalon javob '+index,'expected'+index,'','text','maxlength="1200"')}</div>`).join('');
  const variants=['A','B'].map(variant=>`<fieldset><legend>Variant ${variant}</legend>${field('Nomi','label'+variant,variant)}${select('Profil','profile'+variant,profileOptions('','Evaluation Agent modeli'))}${area('Prompt','prompt'+variant,'','maxlength="3000"')}</fieldset>`).join('');
  modal('Yangi vazifa',editForm(team+(data.demo?checkbox('Demo vazifa','demo',!data.repos.length&&!data.profiles.length):'')+
    field('Vazifa nomi','title','','text','maxlength="140"')+area('Tavsif','description','','maxlength="16000"')+
    `<div data-github class="stack">${repo}${field('Mavjud GitHub issue raqami','issue','','number','min="1"')}${select('Dasturchi','developer',data.agents.filter(agent=>data.rooms.some(room=>room.id===agent.room_id&&room.space==='it')).map(agent=>option(agent.id,agent.name,'backend')).join(''))}</div><div data-evaluation class="stack">${variants}${caseForm}</div>`+
    (data.paperclip?field('Mavjud Paperclip issue ID','paperclipIssue'):'') ,'Vazifa yaratish'));
  const form=dialog.querySelector('form');
  function toggle(){
    const demo=form.elements.demo?.checked;
    form.querySelector('[data-github]').hidden=form.elements.space.value!=='it'||demo;
    form.querySelector('[data-evaluation]').hidden=form.elements.space.value!=='ai'||demo;
  }
  form.addEventListener('change',toggle);
  toggle();
  onForm(dialog,async fields=>{
    const body=Object.fromEntries(fields);
    body.demo=fields.has('demo');
    if(body.space==='ai'){
      body.candidates=['A','B'].map(variant=>({label:fields.get('label'+variant),prompt:fields.get('prompt'+variant),profileId:fields.get('profile'+variant)}));
      body.cases=[1,2,3].map(index=>({input:fields.get('input'+index),expected:fields.get('expected'+index)})).filter(row=>row.input.trim());
    }
    const task=await api('/tasks',body);
    await afterSave('Vazifa yaratildi.');
    await taskDetail(task.id);
  });
}
function roomEdit(key){
  const room=data.rooms.find(room=>room.id===key);
  modal(room?'Xonani tahrirlash':'Yangi xona',editForm(
    field('Xona nomi','name',room?.name,'text','required maxlength="70"')+field('Tavsif','detail',room?.detail)+
    select('Ish muhiti','space',Object.entries(spaces).map(([key,label])=>option(key,label,room?.space)).join(''),room?'disabled':'')));
  onForm(dialog,async fields=>{await api('/rooms'+(room?'/'+key:''),Object.fromEntries(fields));await afterSave('Xona saqlandi.');});
}
async function agentDetail(key){
  const agent=agentBy(key);
  const task=currentFor(agent);
  const latest=task&&await api('/tasks/'+task.id);
  const result=latest?.task.result;
  const assign=data.rooms.find(room=>room.id===agent.room_id)?.space==='private'?'':button('Topshiriq berish','specialist',key,'primary');
  modal(agent.name,`<p>${e(agent.role)}</p><div class="controls">${chip(task?.status||'idle')}${assign}${button('Agentni tahrirlash','agent-edit',key)}</div><dl class="stack">
    <div><dt>Boshliq</dt><dd>${e(agentBy(agent.lead_id)?.name||'—')}</dd></div>
    <div><dt>Asosiy model</dt><dd>${e(profileBy(agent.profile_id)?.model||(agent.id==='assistant'&&data.defaultLocal)||'Biriktirilmagan')}</dd></div>
    <div><dt>Zaxira model</dt><dd>${e(profileBy(agent.backup_id)?.model||'—')}</dd></div>
    <div><dt>Oxirgi vazifa</dt><dd>${task?button(task.title,'task',task.id):'—'}</dd></div>
    <div><dt>Natija</dt><dd>${e(result?.summary||result?.qa?.feedback||task?.error||latest?.events[0]?.message||'—')}</dd></div></dl>`);
}
function agentEdit(key){
  const agent=agentBy(key);
  const characterImages=Array.from({length:6},(_,index)=>'/vendor/characters/char_'+index+'.png');
  const characters='<fieldset class="character-picker"><legend>Personaj</legend>'+characterImages.map((url,index)=>
    `<label class="character-choice"><input type="radio" name="sprite" value="${index}"${agent?.sprite_id===index?' checked':''}><span><img src="${e(url)}" alt="" width="224" height="192"></span><small>${index+1}</small></label>`).join('')+
    `<label class="character-auto"><input type="radio" name="sprite" value=""${agent?.sprite_id==null?' checked':''}> Avtomatik</label></fieldset>`;
  const roomOptions=data.rooms.filter(room=>!agent||room.space===data.rooms.find(entry=>entry.id===agent.room_id).space).map(room=>option(room.id,spaces[room.space]+' · '+room.name,agent?.room_id));
  modal(agent?'Agentni tahrirlash':'Yangi agent',editForm(field('Agent nomi','name',agent?.name,'text','required maxlength="70"')+area('Rol va qabul mezonlari','role',agent?.role,'required maxlength="16000"')+
    select('Xona','room',roomOptions.join(''))+select('Boshliq','lead','')+
    select('Asosiy model','profile',profileOptions(agent?.profile_id||''))+select('Zaxira model','backup',profileOptions(agent?.backup_id||''))+
    checkbox('Pulli zaxira modelga ruxsat','allowPaid',Boolean(agent?.allow_paid))+characters));
  const form=dialog.querySelector('form');
  function showLeads(){
    const space=data.rooms.find(room=>room.id===form.elements.room.value).space;
    const previous=form.elements.lead.value||agent?.lead_id||'';
    form.elements.lead.innerHTML=option('','Boshliqsiz',previous)+data.agents.filter(item=>item.id!==key&&data.rooms.some(room=>room.id===item.room_id&&(room.space===space||(item.id==='ceo'&&space!=='private')))).map(item=>option(item.id,item.name,previous)).join('');
  }
  form.elements.room.addEventListener('change',showLeads);
  showLeads();
  onForm(dialog,async fields=>{await api('/agents'+(agent?'/'+key:''),{...Object.fromEntries(fields),allowPaid:fields.has('allowPaid')});await afterSave('Agent saqlandi.');});
}
function profileEdit(key,choices=[],preset=null){
  const profile=profileBy(key)||preset;
  modal(key?'Model profilini tahrirlash':'Yangi model profili',editForm(
    field('Profil nomi','name',profile?.name,'text','required maxlength="80"')+
    select('Provayder','provider',Object.entries(providerNames).map(([id,name])=>option(id,name,profile?.provider||'ollama')).join(''))+
    field('Model ID','model',profile?.model,'text','required list="profile-model-list"')+
    `<datalist id="profile-model-list">${choices.map(model=>option(model,model)).join('')}</datalist>`+
    field('Server manzili','base',profile?.base,'url','placeholder="http://127.0.0.1:11434"')+
    field('OpenClaw agent ID yoki Portkey provider','remoteAgent',profile?.remote_agent)+
    field(profile?.has_key?'Yangi API kalit yoki Gateway token':'API kalit yoki Gateway token','key','','password','autocomplete="new-password"')+
    (profile?.has_key?checkbox('Saqlangan kalitni o‘chirish','clearKey'):'')+
    hint('OpenAI API, OpenRouter va NVIDIA standart manzillardan foydalanadi. LM Studio va OpenClaw uchun odatda /v1 bilan tugaydigan manzilni kiriting.')));
  onForm(dialog,async fields=>{await api('/profiles'+(key?'/'+key:''),{...Object.fromEntries(fields),clearKey:fields.has('clearKey')});await afterSave('Model profili saqlandi.');});
}
async function skillEdit(key){
  const skill=key?await api('/skills/'+key):null;
  const space=skill?.space||knowledgeSpace;
  const agents=data.agents.filter(agent=>data.rooms.some(room=>room.id===agent.room_id&&room.space===space));
  modal(skill?'Skill · '+skill.name:'Yangi skill',editForm(
    field('Nomi','name',skill?.name,'text','required maxlength="100"')+field('Tavsif','description',skill?.description,'text','maxlength="300"')+
    field('Markdown fayldan olish (ixtiyoriy)','importFile','','file','accept=".md,.txt"')+
    area('Skill yo‘riqnomasi','body',skill?.body,'required maxlength="32000"')+
    `<fieldset><legend>Biriktirilgan agentlar</legend>${agents.map(agent=>`<label class="inline"><input name="agents" type="checkbox" value="${e(agent.id)}"${skill?.agents.includes(agent.id)?' checked':''}>${e(agent.name)}</label>`).join('')}</fieldset>`+
    (skill?field('O‘zgarish sababi','reason','Egasi tahriri','text','required maxlength="1000"'):'')+
    hint('Skill matnli yo‘riqnoma sifatida ishlatiladi. Fayldagi buyruqlar serverda avtomatik bajarilmaydi.'))+
    (skill?`<details><summary>Versiyalar tarixi (${skill.versions.length})</summary>${skill.versions.map(row=>`<h3>v${row.version} · ${e(date(row.created_at))}</h3>${hint(row.reason)}${pre(row.body)}${row.version!==skill.version?button('Shu versiyani qaytarish','skill-restore',skill.id+'|'+row.version+'|'+skill.version):''}`).join('')}</details>`:''));
  const form=dialog.querySelector('form');
  form.elements.importFile.addEventListener('change',async()=>{
    const file=form.elements.importFile.files[0];if(!file)return;
    if(file.size>128000){toast('Skill fayli 128 KB dan oshmasligi kerak.');return;}
    const content=await file.text();if(content.length>32000){toast('Skill 32 000 belgidan oshmasligi kerak.');return;}
    form.elements.body.value=content;if(!form.elements.name.value)form.elements.name.value=file.name.replace(/\.(md|txt)$/i,'');
  });
  onForm(dialog,async fields=>{
    await api('/skills'+(skill?'/'+key:''),{space,name:fields.get('name'),description:fields.get('description'),body:fields.get('body'),reason:fields.get('reason')||'Yangi skill',agents:fields.getAll('agents'),version:skill?.version});
    await afterSave('Skill va uning versiyasi saqlandi.');
  });
}
async function memoryEdit(key){
  const memory=key?await api('/memories/'+key):null;
  modal(memory?'Xotira · '+memory.title:'Yangi xotira yozuvi',editForm(field('Sarlavha','title',memory?.title,'text','required maxlength="140"')+area('Saqlanadigan ma’lumot','body',memory?.body,'required maxlength="32000"'))+
    (memory?`<details><summary>Eski versiyalar (${memory.versions.length})</summary>${memory.versions.map(row=>`<h3>v${row.version}</h3>${pre(row.body)}`).join('')}</details>`:''));
  onForm(dialog,async fields=>{
    await api('/memories'+(memory?'/'+key:''),{space:memory?.space||knowledgeSpace,title:fields.get('title'),body:fields.get('body'),version:memory?.versions[0]?.version});
    await afterSave('Doimiy xotira saqlandi.');
  });
}
function improvementDetail(key){
  const proposal=knowledgeData.improvements.find(row=>row.id===key);
  const agents=data.agents.filter(agent=>data.rooms.some(room=>room.id===agent.room_id&&room.space===proposal.space));
  modal(proposal.title,`${sample(proposal.demo)}${pre(proposal.body)}<details><summary>Asos va dalillar</summary>${pre(proposal.evidence)}</details>`+
    editForm(proposal.kind==='skill'?select('Skillni biriktirish','agentId',option('','Faqat kutubxonaga saqlash')+agents.map(agent=>option(agent.id,agent.name)).join('')):hint('Tasdiqlangandan so‘ng ushbu yozuv keyingi topshiriqlarda xotira sifatida ishlatiladi.'),'Tasdiqlash va qo‘llash')+button('Rad etish','improvement-reject',key));
  onForm(dialog,async fields=>{await api('/improvements/'+key+'/decision',{decision:'approve',agentId:fields.get('agentId')});await afterSave('Yaxshilash taklifi qo‘llandi.');});
}
function readFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error('Faylni o‘qib bo‘lmadi.'));
    reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}
function privateNew(kind){
  const labels={note:'Yangi eslatma',plan:'Yangi reja',document:'Hujjat yuklash'};
  modal(labels[kind],editForm(kind==='document'?field('Hujjat · 2 MB gacha','file','','file','required accept=".docx,.txt,.md,.csv,.json,.log"'):
    field('Nomi','name','','text','required maxlength="160"')+area('Matn','text','','required')));
  onForm(dialog,async fields=>{
    const body={kind,name:fields.get('name'),text:fields.get('text')};
    if(kind==='document'){
      const file=fields.get('file');
      if(file.size>2000000)throw Error('Fayl 2 MB dan oshmasligi kerak.');
      body.name=file.name;
      body.encoded=await readFile(file);
    }
    await api('/private/items',body);
    privateData=await api('/private');
    dialog.close();
    renderPrivate();
    toast('Shaxsiy manba saqlandi.');
  });
}
const actions={
  'office-team':key=>{
    if(key&&!data.rooms.some(room=>room.id===key&&room.space!=='private'))return;
    if(key){selectedRoom=key;selectedAgent='';}
    mapSpace=key?'team':'';
    floorCamera.zoom=1;floorCamera.x=0;floorCamera.y=0;
    renderOffice();
  },
  'office-focus':()=>{officeFocus=!officeFocus;localStorage.setItem('office-focus',String(officeFocus));renderOffice();},
  'ceo-command':ceoCommand,
  'settings-tab':key=>{settingsTab=key;renderSettings();},
  'org-open':()=>{location.hash='org';},
  'knowledge-open':()=>{location.hash='knowledge';},
  'projects-open':()=>{location.hash='projects';},
  'office-panel':key=>{officePanel=key;renderOffice();$('[data-action="office-panel"][data-key="'+key+'"]')?.focus();},
  'team-library':teamLibrary,
  'edict-demo':async()=>{
    const r=await api('/projects/edict/demo');
    modal('Edict · demo doskasi',sample(true)+hint(r.departments.length+' rol · '+r.tasks.length+' ta namunaviy vazifa. Edict loyihasida saqlangan asl namuna.')+
      '<div class="stack">'+r.tasks.map(t=>'<section class="panel"><small>'+e(t.id)+' · '+e(t.org)+'</small><h3>'+e(t.title)+'</h3>'+chip('idle',t.state)+'</section>').join('')+'</div>');
  },
  specialist,'local-models':localModels,'project-export':exportProject,
  'team-template':async key=>{const result=await api('/projects/team-template',{template:key});$('#dialog').close();await refresh(true);location.hash='office';toast(result.roles+' ta jamoa roli tayyor.');},
  'city-rooms':async()=>{await api('/projects/city',{});await refresh(true);location.hash='office';toast('City Accountants jamoalari tayyor.');},
  'setup-open':()=>{location.hash='setup';},'setup-refresh':loadSetup,
  'setup-assign':space=>{
    modal('Bo‘lim agentlariga model biriktirish',editForm(select('Asosiy profil','profileId',profileOptions(''))+
      hint(spaces[space]+' bo‘limidagi barcha agentlarning asosiy profili almashtiriladi. Har bir agentni keyin alohida tahrirlashingiz mumkin.'),'Biriktirish'));
    onForm(dialog,async fields=>{const result=await api('/setup/assign',{space,profileId:fields.get('profileId')});await afterSave(result.assigned+' agentga asosiy profil biriktirildi.');});
  },
  'knowledge-space':async space=>{knowledgeSpace=space;knowledgeData=null;await loadKnowledge();},
  'skill-edit':skillEdit,'memory-edit':memoryEdit,improvement:improvementDetail,
  'skill-restore':async key=>{const [id,version,currentVersion]=key.split('|');await api('/skills/'+id+'/restore',{version:Number(version),currentVersion:Number(currentVersion)});await afterSave('Eski yo‘riqnoma yangi versiya sifatida tiklandi.');await skillEdit(id);},
  'improvement-reject':async key=>{await api('/improvements/'+key+'/decision',{decision:'reject'});await afterSave('Taklif rad etildi.');},
  'task-improve':async key=>{
    const task=data.tasks.find(row=>row.id===key);
    const knowledge=await api('/knowledge?space='+task.space);
    modal('Yaxshilash taklifi',editForm(select('Yaxshilanadigan skill','skillId',option('','Yangi skill yaratish')+knowledge.skills.map(skill=>option(skill.id,skill.name+' · v'+skill.version)).join(''))+
      hint(task.demo?'Demo uchun tayyor qoidaga asoslangan namuna yaratiladi.':'Agent natijani model yordamida tahlil qiladi va siz tasdiqlashingiz uchun taklif tayyorlaydi.'),'Tahlil qilish'));
    onForm(dialog,async fields=>{
      await api('/tasks/'+key+'/improve',{skillId:fields.get('skillId')});knowledgeSpace=task.space;dialog.close();
      if(route==='knowledge')await loadKnowledge();else location.hash='knowledge';toast('Yaxshilash takliflari tayyorlandi.');
    });
  },
  'quick-demo':async space=>{
    const task=await api('/tasks',{space,demo:true,title:space==='it'?'Salomlashish matnini yangilash':'Ikki promptni solishtirish',description:space==='it'?'Demo loyihada salomlashishni o‘zbek tiliga o‘zgartiring.':'Bitta test to‘plamida ikki promptni baholang.'});
    await api('/tasks/'+task.id+'/run',{});await refresh(true);await taskDetail(task.id);
  },
  diagnostics:async()=>{
    const info=await api('/diagnostics');
    $('#diagnostics-output').innerHTML=`<div class="split"><div><strong>Server ${e(info.version)}</strong>${hint('SQLite WAL · '+date(info.startedAt))}${hint('GitHub: '+(info.github.configured?'Token sozlangan':'Token kiritilmagan'))}${hint('Test konteyneri: '+(info.github.testsEnabled?'Yoqilgan':'O‘chirilgan'))}</div><div>${hint('Paperclip: '+(info.paperclip.configured?'Sozlangan':'Sozlanmagan'))}${hint('Navbat: '+info.paperclip.pending.length)}${hint('Lokal model: '+(info.local.model||'Tanlanmagan'))}</div></div>`;
  },
  'paperclip-test':async()=>{const result=await api('/integrations/paperclip/test',{});toast('Paperclip: '+result.name+' — ulanish muvaffaqiyatli.');},
  close:()=>dialog.close(),
  task:taskDetail,'task-new':taskNew,
  'task-run':async key=>{await api('/tasks/'+key+'/run',{});await refresh(true);await taskDetail(key);toast('Ishga tushirish so‘rovi qabul qilindi.');},
  approve:key=>decide(key,'approve'),reject:key=>{
    modal('Tuzatishga qaytarish',editForm(area('Qanday tuzatish kerak?','feedback','','required maxlength="3000"'),'Qaytarish'));
    onForm(dialog,async fields=>decide(key,'reject',fields.get('feedback')));
  },
  checks:async key=>{
    const {checks}=await api('/tasks/'+key+'/checks');
    const target=$('#checks-output');
    if(target)target.innerHTML=checks.length?checks.map(row=>`<p>${link(row.url,row.name)||e(row.name)} · ${e(row.conclusion||row.status)}</p>`).join(''):hint('GitHub tekshiruv natijalarini hali qaytarmadi.');
  },
  'room-edit':roomEdit,agent:agentDetail,'agent-edit':agentEdit,
  'profile-edit':profileEdit,
  'profile-test':async key=>{try{const result=await api('/profiles/'+key+'/test',{});toast(result.model+' modeliga ulanish muvaffaqiyatli.');}finally{await refresh(true);}},
  'profile-models':async key=>{const {models}=await api('/profiles/'+key+'/models',{});profileEdit(key,models);toast(models.length?'Model ID maydonidan tanlang.':'Provayder modellar ro‘yxatini qaytarmadi.');},
  'private-new':privateNew,
  'private-item':async key=>{const item=await api('/private/items/'+key);modal(item.name,pre(item.body)+button('Shu manba bo‘yicha savol','private-select',key,'primary'));},
  'private-select':key=>{dialog.close();const input=$('#ask-panel [name=item]');if(input){input.value=key;$('#ask-panel [name=question]').focus();}}
};
async function decide(key,decision,feedback=''){
  const [task,fingerprint]=key.split('|');
  await api('/tasks/'+task+'/approval',{decision,fingerprint,feedback});
  await refresh(true);
  await taskDetail(task);
  toast(decision==='approve'?'Tasdiq bajarildi.':'Vazifa qaytarildi.');
}
document.addEventListener('click',async event=>{
  const trigger=event.target.closest('[data-action]');
  if(!trigger)return;
  const action=actions[trigger.dataset.action];
  if(!action)return;
  trigger.disabled=true;
  try{await action(trigger.dataset.key);}
  catch(error){toast(error.message);}
  finally{trigger.disabled=false;}
});
initialize().catch(error=>toast(error.message));
