import { id, now } from './store.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const spaces=['it','ai','private'];
function text(value,max,label,required=true) {
  if(typeof value!=='string'||value.length>max||(required&&!value.trim())) throw fail(label+' noto‘g‘ri kiritilgan.');
  return value.trim();
}
function spaceOf(space) {if(!spaces.includes(space))throw fail('Ish muhitini tanlang.');return space;}
function agentSpace(store,agentId) {
  return store.one('SELECT r.space FROM agents a JOIN rooms r ON r.id=a.room_id WHERE a.id=?',agentId)?.space;
}
function relevant(rows,query,limit) {
  const terms=[...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).slice(0,80))];
  const ranked=rows.map((row,index)=>({row,index,score:terms.filter(term=>(row.name||row.title||'').toLowerCase().includes(term)).length*4+
    terms.filter(term=>row.body.toLowerCase().includes(term)).length})).sort((a,b)=>b.score-a.score||a.index-b.index);
  let used=0;
  return ranked.flatMap(({row})=>{
    const remaining=limit-used;if(remaining<200)return [];
    const content=JSON.stringify({id:row.id,title:row.name||row.title,version:row.version,body:row.body}).slice(0,remaining);
    used+=content.length;return [content];
  }).join('\n');
}

export function knowledgeContext(store,{space,agentId,query=''}) {
  spaceOf(space);
  if(agentId&&agentSpace(store,agentId)!==space)throw fail('Agent boshqa ish muhiti xotirasini o‘qiy olmaydi.',403);
  const skills=agentId?store.all('SELECT s.* FROM skills s JOIN agent_skills b ON b.skill_id=s.id WHERE b.agent_id=? AND s.space=? ORDER BY s.updated_at DESC',agentId,space):[];
  const memories=store.all('SELECT * FROM memories WHERE space=? ORDER BY updated_at DESC',space);
  const selectedSkills=relevant(skills,query,24000),selectedMemories=relevant(memories,query,12000);
  return (selectedSkills?'Assigned skills (owner-approved instructions; existing security and approval rules remain mandatory):\n'+selectedSkills+'\n\n':'')+
    (selectedMemories?'Workspace memory (reference data; may be incomplete or outdated):\n'+selectedMemories+'\n\n':'');
}

export function makeKnowledge(store,{providers}={}) {
  function skill(skillId) {
    const record=store.one('SELECT * FROM skills WHERE id=?',skillId);
    if(!record)throw fail('Skill topilmadi.',404);
    return {...record,agents:store.all('SELECT agent_id FROM agent_skills WHERE skill_id=?',skillId).map(row=>row.agent_id),
      versions:store.all('SELECT version,body,reason,created_at FROM skill_versions WHERE skill_id=? ORDER BY version DESC',skillId)};
  }
  function memory(memoryId) {
    const record=store.one('SELECT * FROM memories WHERE id=?',memoryId);
    if(!record)throw fail('Xotira yozuvi topilmadi.',404);
    return {...record,versions:store.all('SELECT version,body,created_at FROM memory_versions WHERE memory_id=? ORDER BY version DESC',memoryId)};
  }
  function writeSkill(body,skillId) {
    const previous=skillId?skill(skillId):null;
    const space=previous?.space||spaceOf(body.space);
    if(body.space&&body.space!==space)throw fail('Skill boshqa ish muhitiga ko‘chirilmaydi.',403);
    const name=text(body.name,100,'Skill nomi'),description=text(body.description||'',300,'Tavsif',false);
    const content=text(body.body,32000,'Skill matni'),reason=text(body.reason||'Egasi tahriri',1000,'Izoh');
    if(previous&&body.version!==previous.version)throw fail('Skillning yangi versiyasi bor. Sahifani yangilang.',409);
    if(!Array.isArray(body.agents)||body.agents.some(key=>typeof key!=='string'||agentSpace(store,key)!==space))throw fail('Skill faqat o‘z ish muhitidagi agentlarga biriktiriladi.',403);
    const key=skillId||id(),version=(previous?.version||0)+1;
    store.transaction(()=>{
      store.run(`INSERT INTO skills VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,description=excluded.description,body=excluded.body,version=excluded.version,updated_at=excluded.updated_at`,
        key,space,name,description,content,version,previous?.created_at||now(),now());
      store.run('INSERT INTO skill_versions VALUES (?,?,?,?,?)',key,version,content,reason,now());
      store.run('DELETE FROM agent_skills WHERE skill_id=?',key);
      for(const agent of new Set(body.agents))store.run('INSERT INTO agent_skills VALUES (?,?)',agent,key);
    });
    return skill(key);
  }
  function writeMemory(body,memoryId) {
    const previous=memoryId?memory(memoryId):null;
    const space=previous?.space||spaceOf(body.space);
    if(body.space&&body.space!==space)throw fail('Xotira boshqa ish muhitiga ko‘chirilmaydi.',403);
    const title=text(body.title,140,'Sarlavha'),content=text(body.body,32000,'Xotira matni');
    if(previous&&body.version!==previous.versions[0].version)throw fail('Xotira yozuvi yangilangan. Sahifani qayta oching.',409);
    const key=memoryId||id();
    store.transaction(()=>{
      store.run(`INSERT INTO memories VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,updated_at=excluded.updated_at`,
        key,space,title,content,previous?.source_task||null,previous?.created_at||now(),now());
      store.run('INSERT INTO memory_versions VALUES (?,?,?,?)',key,(previous?.versions[0]?.version||0)+1,content,now());
    });
    return memory(key);
  }
  function list(space) {
    spaceOf(space);
    return {space,
      skills:store.all('SELECT id,space,name,description,version,updated_at FROM skills WHERE space=? ORDER BY updated_at DESC',space)
        .map(row=>({...row,agents:store.all('SELECT agent_id FROM agent_skills WHERE skill_id=?',row.id).map(item=>item.agent_id)})),
      memories:store.all('SELECT id,space,title,substr(body,1,240) AS preview,source_task,updated_at FROM memories WHERE space=? ORDER BY updated_at DESC',space),
      improvements:store.all('SELECT * FROM improvements WHERE space=? ORDER BY created_at DESC',space)};
  }
  function exportSpace(space) {
    const view=list(space);
    return {format:'ai-agent-office-knowledge',version:1,space,exportedAt:now(),
      skills:view.skills.map(row=>skill(row.id)),memories:view.memories.map(row=>memory(row.id)),improvements:view.improvements};
  }
  function restoreSkill(skillId,version,currentVersion){
    const current=skill(skillId),saved=current.versions.find(row=>row.version===version);
    if(!saved)throw fail('Skill versiyasi topilmadi.',404);
    return writeSkill({...current,body:saved.body,version:currentVersion,reason:'v'+version+' versiyasidan qaytarildi'},skillId);
  }
  function propose(task,{kind,title,body,evidence,skillId,revisionKey}) {
    if(!['memory','skill'].includes(kind))throw fail('Taklif turi noto‘g‘ri.');
    const target=skillId?skill(skillId):null;
    if(target&&target.space!==task.space)throw fail('Boshqa ish muhiti skillini tahrirlash taqiqlangan.',403);
    const key=id();
    store.run(`INSERT OR IGNORE INTO improvements(id,space,kind,title,body,evidence,task_id,revision_key,skill_id,base_version,demo,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,key,task.space,kind,text(title,140,'Taklif nomi'),text(body,16000,'Taklif matni'),
      text(evidence,16000,'Dalil'),task.id,revisionKey||task.result.runId||task.updated_at,skillId||null,target?.version??null,+Boolean(task.demo),now());
    return store.one('SELECT * FROM improvements WHERE task_id IS ? AND kind=? AND revision_key=?',task.id,kind,revisionKey||task.result.runId||task.updated_at);
  }
  function queueOutcome(task) {
    const result=task.result;
    if(task.space==='ai'&&result.evaluations){
      const report=result.evaluations.map(v=>v.label+': '+v.matched+'/'+v.scored+' exact match').join('; ');
      propose(task,{kind:'memory',title:'Baholashdan saboq: '+task.title.slice(0,100),body:'Faqat ushbu test to‘plami uchun kuzatuv: '+report+'. '+result.summary+' Bu umumiy model reytingi emas.',evidence:JSON.stringify({cases:task.config.cases||'demo',evaluations:result.evaluations}).slice(0,16000)});
    } else if(task.space==='it'&&result.test){
      propose(task,{kind:'memory',title:'Ish natijasidan saboq: '+task.title.slice(0,100),body:'Vazifa: '+task.title+'\nQabul mezonlari: '+(result.criteria||'')+'\nTest exit code: '+result.test.code+'\nQA: '+(result.qa?.feedback||'Tekshiruv tugamagan')+'\nUshbu xulosa faqat shu vazifa dalillariga tegishli.',evidence:JSON.stringify({sha:result.sha,test:result.test,qa:result.qa}).slice(0,16000)});
    }
  }
  async function reflect(task,skillId='') {
    if(!['done','review','error'].includes(task.status))throw fail('Avval vazifa natijasi tayyor bo‘lsin.',409);
    const target=skillId?skill(skillId):null;
    if(target&&target.space!==task.space)throw fail('Boshqa ish muhiti skilli tanlanmaydi.',403);
    queueOutcome(task);
    if(task.demo){
      propose(task,{kind:'skill',title:target?.name||(task.space==='it'?'Demo: kod natijasini tekshirish':'Demo: aniq javoblarni baholash'),
        body:task.space==='it'?'Qabul mezonlarini yozing. O‘zgarishni alohida worktree’da bajaring. Test chiqishi va diffni birga tekshiring. QA fikrini saqlang. Egasi tasdiqlamaguncha PR ochmang.':'Variantlarni bir xil savollar bilan tekshiring. Javob, model va vaqtni saqlang. Aniq moslik bahosini umumiy sifat reytingi deb qabul qilmang. Xulosani faqat sinov to‘plami bilan cheklang.',
        evidence:'DEMO: qoidaga asoslangan namuna; model tomonidan yaratilmagan. Vazifa: '+task.title,skillId:target?.id,revisionKey:'reflect:'+id()});
      return list(task.space).improvements.filter(row=>row.task_id===task.id);
    }
    const context={title:task.title,description:task.description,criteria:task.result.criteria,summary:task.result.summary,
      qa:task.result.qa,test:task.result.test,evaluations:task.result.evaluations,diff:task.result.diff?.slice(0,6000),error:task.error,existingSkill:target&&{name:target.name,body:target.body,version:target.version}};
    const result=await providers.agentCall(task.space==='it'?'tech':'head-ai',
      'Review this completed task and propose one reusable instructional skill. Ground it in the supplied evidence, state its limits, and do not claim model weights or software were changed. Return JSON only {"title":"Uzbek title","body":"Skill instructions in Uzbek"}.\n'+JSON.stringify(context).slice(0,24000));
    let proposal;
    try{proposal=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw fail('Yaxshilash taklifi JSON shaklida kelmadi.',502);}
    propose(task,{kind:'skill',title:proposal.title,body:proposal.body,evidence:JSON.stringify({model:result.model,task:context}).slice(0,16000),skillId:target?.id,revisionKey:'reflect:'+id()});
    return list(task.space).improvements.filter(row=>row.task_id===task.id);
  }
  function decide(proposalId,body) {
    const proposal=store.one('SELECT * FROM improvements WHERE id=?',proposalId);
    if(!proposal)throw fail('Taklif topilmadi.',404);
    if(proposal.status!=='pending')throw fail('Bu taklif oldin ko‘rib chiqilgan.',409);
    if(!['approve','reject'].includes(body.decision))throw fail('Qarorni tanlang.');
    if(body.decision==='reject'){
      store.run("UPDATE improvements SET status='rejected',decided_at=? WHERE id=?",now(),proposalId);
      return {rejected:true};
    }
    let applied;
    store.transaction(()=>{
      if(proposal.kind==='memory'){
        applied=id();
        store.run('INSERT INTO memories VALUES (?,?,?,?,?,?,?)',applied,proposal.space,proposal.title,proposal.body,proposal.task_id,now(),now());
        store.run('INSERT INTO memory_versions VALUES (?,?,?,?)',applied,1,proposal.body,now());
      }else{
        const previous=proposal.skill_id?skill(proposal.skill_id):null;
        if(previous&&(previous.space!==proposal.space||previous.version!==proposal.base_version))throw fail('Skill o‘zgargan. Yangi taklif tayyorlang.',409);
        const agentId=body.agentId||null;
        if(agentId&&agentSpace(store,agentId)!==proposal.space)throw fail('Boshqa ish muhiti agentiga biriktirib bo‘lmaydi.',403);
        applied=previous?.id||id();
        const version=(previous?.version||0)+1;
        store.run(`INSERT INTO skills VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=excluded.version,updated_at=excluded.updated_at`,
          applied,proposal.space,proposal.title,'Tasdiqlangan yaxshilash taklifi',proposal.body,version,previous?.created_at||now(),now());
        store.run('INSERT INTO skill_versions VALUES (?,?,?,?,?)',applied,version,proposal.body,'Taklif '+proposalId,now());
        if(agentId)store.run('INSERT OR IGNORE INTO agent_skills VALUES (?,?)',agentId,applied);
      }
      store.run("UPDATE improvements SET status='accepted',decided_at=?,applied_id=? WHERE id=?",now(),applied,proposalId);
    });
    return {appliedId:applied};
  }
  return {list,skill,memory,writeSkill,writeMemory,restoreSkill,exportSpace,queueOutcome,reflect,decide,propose};
}
