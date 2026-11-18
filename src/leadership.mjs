import {randomUUID} from 'node:crypto';
import {fail} from './providers.mjs';
import {parseModelJSON} from './git-workflow.mjs';

export function initializeLeadership(store){
  if(store.one("SELECT value FROM settings WHERE key='ceo-initialized'"))return;
  store.transaction(()=>{
    store.run("INSERT OR IGNORE INTO rooms VALUES ('ceo-office','it','CEO ofisi','Kompaniya boshqaruvi va hisobotlar')");
    const profile=store.one("SELECT profile_id FROM agents WHERE id='cto'")?.profile_id||null;
    store.run("INSERT OR IGNORE INTO agents(id,room_id,name,role,profile_id) VALUES ('ceo','ceo-office','CEO','Kompaniya rahbari',?)",profile);
    store.run(`UPDATE agents SET lead_id='ceo' WHERE lead_id IS NULL AND id!='ceo'
      AND room_id IN (SELECT id FROM rooms WHERE space!='private')`);
    store.run("INSERT INTO settings VALUES ('ceo-initialized','1')");
  });
}

export function makeLeadership({store,providers}){
  const publicAgents=()=>store.all("SELECT a.*,r.space FROM agents a JOIN rooms r ON r.id=a.room_id WHERE r.space!='private'");
  function message(task,from,to,kind,body){
    store.run('INSERT INTO agent_messages VALUES (?,?,?,?,?,?,?)',randomUUID(),task,from,to,kind,body,new Date().toISOString());
    store.event(task,(kind==='command'?'Buyruq: ':'Hisobot: ')+from+' → '+to);
  }
  function create({title,instruction,mode='command'}){
    if(!['command','report'].includes(mode))throw fail('Buyruq turini tanlang.');
    const agents=publicAgents();
    const ceo=agents.find(agent=>agent.id==='ceo');
    if(!ceo?.profile_id)throw fail('CEO agentga model profilini biriktiring.',409);
    // Validate before starting, so an omitted team cannot disappear from a report.
    for(const agent of agents){
      const seen=new Set();
      let cursor=agent;
      while(cursor.id!=='ceo'){
        if(seen.has(cursor.id))throw fail('Boshqaruv daraxtida halqa bor.',409);
        seen.add(cursor.id);
        cursor=agents.find(item=>item.id===cursor.lead_id);
        if(!cursor)throw fail(agent.name+' uchun CEOgacha rahbar belgilang.',409);
      }
      if(mode==='report'&&!agent.profile_id)throw fail(agent.name+' uchun model profili kerak.',409);
    }
    return store.addTask({space:'it',title,description:instruction,agentId:'ceo',demo:false,
      config:{kind:'hierarchy',mode}});
  }
  async function run(root){
    // Snapshot the approved hierarchy. In-flight changes apply to the next command.
    const agents=publicAgents();
    const visited=new Set();
    async function execute(agentId,task,depth){
      if(depth>20||visited.has(agentId))throw fail('Boshqaruv daraxti yaroqsiz.',409);
      visited.add(agentId);
      const agent=agents.find(item=>item.id===agentId);
      if(!agent)throw fail('Jamoa agenti topilmadi.',409);
      store.update(task.id,{status:'working',error:null},agent.name+' topshiriqni oldi.');
      const children=agents.filter(item=>item.lead_id===agentId);
      let assignments=[];
      const context=store.all(`SELECT title,status,error FROM tasks WHERE agent_id=? AND id!=?
        AND json_extract(config,'$.rootTask') IS NULL ORDER BY updated_at DESC LIMIT 8`,agentId,root.id);
      if(children.length){
        const instruction=task.description.toLocaleLowerCase();
        const targetRooms=store.all("SELECT id,name FROM rooms WHERE space!='private'")
          .filter(room=>room.name.length>3&&instruction.includes(room.name.toLocaleLowerCase()));
        const ownsTarget=child=>{
          const pending=[child.id],seen=new Set();
          while(pending.length){
            const currentId=pending.pop();
            const current=agents.find(item=>item.id===currentId);
            if(!current||seen.has(current.id))continue;
            seen.add(current.id);
            if(targetRooms.some(room=>room.id===current.room_id))return true;
            pending.push(...agents.filter(item=>item.lead_id===current.id).map(item=>item.id));
          }
          return false;
        };
        const routed=targetRooms.length?children.filter(ownsTarget):[];
        if(root.config.mode==='report'){
          assignments=children.map(child=>({agentId:child.id,instruction:task.description}));
        }else if(routed.length){
          assignments=routed.map(child=>({agentId:child.id,instruction:task.description}));
        }else{
          const planningPrompt=
            'Siz rahbarsiz. Topshiriqni bevosita xodimlaringiz orasida taqsimlang. Faqat JSON qaytaring: '+
            '{"assignments":[{"agentId":"listed-id","instruction":"aniq topshiriq"}]}. '+
            'Faqat mos xodimlarni tanlang. Barchaga hisobot buyurilgan bo‘lsa barchani tanlang. '+
            'Hech kim kerak bo‘lmasa bo‘sh massiv qaytaring. Maksimal '+children.length+' topshiriq.\n'+
            JSON.stringify({task:task.description,staff:children.map(child=>({agentId:child.id,name:child.name,role:child.role}))});
          let planning=await providers.agentCall(agentId,planningPrompt);
          let parsed;
          try{parsed=parseModelJSON(planning.text);}
          catch{
            planning=await providers.agentCall(agentId,planningPrompt+
              '\nOldingi javob JSON bo‘lmadi. Faqat assignments massivli JSON obyektini qaytaring.\n'+planning.text.slice(0,3000));
            parsed=parseModelJSON(planning.text);
          }
          if(!Array.isArray(parsed.assignments)||parsed.assignments.length>children.length)throw fail('Rahbar rejasi yaroqsiz.');
          const selected=new Set();
          assignments=parsed.assignments.map(item=>{
            if(!children.some(child=>child.id===item.agentId)||selected.has(item.agentId)||
              typeof item.instruction!=='string'||!item.instruction.trim()||item.instruction.length>10000)
              throw fail('Rejada faqat bevosita xodimga topshiriq berish mumkin.');
            selected.add(item.agentId);
            return item;
          });
        }
      }
      const reports=[];
      for(const assignment of assignments){
        const child=agents.find(item=>item.id===assignment.agentId);
        const sub=store.addTask({space:child.space,title:root.title.slice(0,100)+' · '+child.name.slice(0,35),
          description:assignment.instruction,agentId:child.id,demo:false,
          config:{kind:'hierarchy-child',parentTask:task.id,rootTask:root.id}});
        message(sub.id,agent.id,child.id,'command',assignment.instruction);
        try{
          const summary=await execute(child.id,sub,depth+1);
          const status=store.task(sub.id).status==='done'?'done':'error';
          reports.push({agent:child.name,agentId:child.id,taskId:sub.id,summary,status});
        }catch(error){
          const reason=error.status?error.message:'Agent modelidan javob olinmadi.';
          store.update(sub.id,{status:'error',error:reason},reason);
          reports.push({agent:child.name,agentId:child.id,taskId:sub.id,summary:reason,status:'error'});
        }
        message(sub.id,child.id,agent.id,'report',reports.at(-1).summary);
      }
      const reply=await providers.agentCall(agent.id,
        'Topshiriq va xodim hisobotlariga tayangan holda o‘zbekcha hisobot yozing. '+
        'Bajarilgan ish dalili, qolgan ish va muammolarni aniq ayting. '+
        'Faqat matn tahlili bajarilgan bo‘lsa shuni ayting. Hisobotdagi xatolarni yashirmang.\n'+
        JSON.stringify({instruction:task.description,recentTasks:context,teamReports:reports}));
      const partial=reports.some(report=>report.status==='error');
      store.update(task.id,{status:partial?'review':'done',
        result:{summary:reply.text,model:reply.model,reports,partial}},agent.name+' hisobotini saqladi.');
      return reply.text;
    }
    await execute('ceo',root,0);
  }
  return {create,run};
}
