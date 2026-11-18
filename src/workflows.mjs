import { digest, id } from './store.mjs';
import { fail } from './providers.mjs';
import { parseModelJSON } from './git-workflow.mjs';
import {makeLeadership} from './leadership.mjs';

export function approvalHash(task) {
  return digest(JSON.stringify({id:task.id,demo:task.demo,repo:task.config.repo,result:task.result}));
}
export const demoCases=[
  {input:'2 + 3 natijasi nima?',expected:'5'},
  {input:'O‘zbekiston poytaxti qaysi?',expected:'Toshkent'},
  {input:'Haftada necha kun bor?',expected:'7'}
];
const normalize = text=>String(text).normalize('NFKC').trim().toLocaleLowerCase();
function score(answer,expected) {
  if (!expected.trim()) return null;
  return normalize(answer)===normalize(expected);
}

export function makeWorkflows({store,providers,paperclip,git,knowledge}) {
  const leadership=makeLeadership({store,providers});
  const running=new Set();
  const flushing=new Set();
  function learn(task){
    try{knowledge?.queueOutcome(task);}
    catch{store.event(task.id,'Natija saqlandi, lekin yaxshilash taklifini tayyorlash bajarilmadi.');}
  }
  async function flush(taskId) {
    if (!paperclip.enabled || flushing.has(taskId)) return;
    const pending=store.one('SELECT * FROM task_sync WHERE task_id=?',taskId);
    if (!pending) return;
    flushing.add(taskId);
    try {
      await paperclip.change(store.task(taskId),JSON.parse(pending.patch),pending.message);
      store.run('DELETE FROM task_sync WHERE task_id=? AND revision=?',taskId,pending.revision);
    } catch(error) {
      store.run('UPDATE task_sync SET attempts=attempts+1,error=? WHERE task_id=? AND revision=?',
        error.status?error.message:'Paperclip bilan sinxronlash bajarilmadi.',taskId,pending.revision);
    } finally { flushing.delete(taskId); }
  }
  async function update(taskId,values,message) {
    const result=store.update(taskId,values,message);
    await flush(taskId);
    return result;
  }
  async function runIT(task) {
    const taskId=task.id;
    const config=task.config;
    const developer=config.developer||'backend';
    const runId=id();
    await update(taskId,{status:'working',agent_id:'cto',error:null},'CTO vazifani Tech Lead’ga yo‘naltirdi.');
    const intake=task.demo?'CTO: Development bo‘limiga yo‘naltirildi.':
      (await providers.agentCall('cto','Triage this software task for the selected development agent. Identify ambiguities, scope, risks and any clarifications that are required. Do not claim changes have been made. Answer briefly in Uzbek.\n'+task.description)).text;
    await update(taskId,{agent_id:'tech',result:{intake,runId,qa:task.result.qa}},'Tech Lead qabul mezonlarini tuzmoqda.');
    const criteria=task.demo ? 'Salomlashish o‘zbek tilida yozilgan va demo loyiha testi muvaffaqiyatli.' :
      (await providers.agentCall('tech','Write a short implementation plan and acceptance criteria for this software task in Uzbek. CTO intake:\n'+intake+'\nTask:\n'+task.description)).text;
    task=await update(taskId,{agent_id:developer,result:{criteria,intake,runId,qa:task.result.qa}},'Dasturchiga worktree ajratildi.');
    const result=await git.implement(task,criteria,async()=>{
      await update(taskId,{agent_id:'test'},'Test Engineer worktree testlarini bajarmoqda.');
    });
    result.criteria=criteria;
    result.intake=intake;
    result.runId=runId;
    result.pr={title:task.title,body:'## Qabul mezonlari\n'+criteria+'\n\n## Test\nExit code: '+result.test.code+
      '\n\nCommit: '+result.sha+(config.issue?'\n\nRefs #'+config.issue:'')};
    task=await update(taskId,{status:'review',agent_id:'qa',result},'Diff va test natijalari QA Lead’ga topshirildi.');
    if (result.test.code!==0 || result.test.timedOut) {
      result.qa={pass:false,feedback:'Test muvaffaqiyatsiz. Natijani ko‘rib, qayta ishlashga yuboring.'};
    } else if (task.demo) {
      result.qa={pass:true,feedback:'Salomlashish o‘zbek tiliga o‘zgardi va Git worktree testi muvaffaqiyatli o‘tdi.'};
    } else {
      const review=await providers.agentCall('qa','Review correctness and acceptance criteria from the diff and tests. Return JSON only {"pass":true,"feedback":"short Uzbek explanation"}. If any acceptance criterion fails, set pass false. Review data:\n'+JSON.stringify({criteria,diff:result.diff,test:result.test.log}));
      const assessment=parseModelJSON(review.text);
      if (typeof assessment.pass!=='boolean'||typeof assessment.feedback!=='string') throw fail('QA natijasi formati noto‘g‘ri.');
      result.qa=assessment;
    }
    const target=result.qa.pass?'approval':'review';
    task=await update(taskId,{status:target,result},result.qa.pass?'QA ma’qulladi. Egadan tasdiq kutilmoqda.':'QA vazifani qayta ishlashga qaytardi.');
    if (result.qa.pass) {
      store.run('INSERT INTO approvals(task_id,fingerprint,action,status) VALUES(?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET fingerprint=excluded.fingerprint, status=excluded.status, decided_at=NULL, error=NULL',
        taskId,approvalHash(task),'draft_pr','pending');
    }else learn(task);
  }
  async function runAI(task) {
    const taskId=task.id;
    await update(taskId,{status:'working',agent_id:'head-ai',error:null},'Head of AI topshiriqni baholashga yo‘naltirdi.');
    await update(taskId,{agent_id:'evaluation'},'Har ikki variant bir xil test to‘plamida tekshirilmoqda.');
    const cases=task.demo ? demoCases : task.config.cases;
    const candidates=task.demo ? [
      {label:'A · Qisqa',prompt:'Faqat javobni yozing.'},
      {label:'B · Batafsil',prompt:'Savolga to‘liq gap bilan javob bering.'}
    ] : task.config.candidates;
    const evaluations=[];
    for(const [candidateIndex,candidate] of candidates.entries()) {
      const rows=[];
      for(const [caseIndex,sample] of cases.entries()) {
        const started=Date.now();
        const r = task.demo ?
          {text:candidateIndex===0?sample.expected:['Natija 5.','Poytaxti Toshkent.','Jami 7 kun.'][caseIndex],model:'demo-fixture'} :
          candidate.profileId ?
            await providers.call(providers.get(candidate.profileId),candidate.prompt+'\n\nTest input:\n'+sample.input) :
            await providers.agentCall('evaluation',candidate.prompt+'\n\nTest input:\n'+sample.input);
        rows.push({input:sample.input,expected:sample.expected,answer:r.text,model:r.model,match:score(r.text,sample.expected),ms:Date.now()-started});
      }
      evaluations.push({label:candidate.label,rows,matched:rows.filter(row=>row.match===true).length,scored:rows.filter(row=>row.match!==null).length});
    }
    const [a,b]=evaluations;
    const summary=a.scored===0?'Etalon kiritilmagan. Berilgan javoblarni sifat bo‘yicha ko‘rib chiqing.':
      a.matched===b.matched?'Anig‘iga mos javoblar soni teng.':(a.matched>b.matched?a.label:b.label)+' etalon javobga ko‘proq aniq mos keldi.';
    await update(taskId,{status:'done',agent_id:'evaluation',result:{evaluations,summary}},'Ikki variantning javoblari va ballari saqlandi.');
    learn(store.task(taskId));
  }
  async function recordFailure(taskId,error) {
    const message=error.status?error.message:'Vazifani bajarishda server xatosi yuz berdi.';
    try {
      await update(taskId,{status:'error',error:message},message);
    } catch {
      store.update(taskId,{status:'error',error:message},message+' Paperclip sinxronlanmadi.');
    }
  }
  function start(taskId) {
    const task=store.task(taskId);
    if (!task) throw fail('Vazifa topilmadi.',404);
    if(task.config.kind==='hierarchy-child')throw fail('Ushbu vazifani bosh buyruq orqali qayta boshlang.',409);
    const approval=store.one('SELECT status FROM approvals WHERE task_id=?',taskId);
    if (running.has(taskId)||!['todo','review','error'].includes(task.status)||approval?.status==='accepted') throw fail('Bu holatda vazifani ishga tushirib bo‘lmaydi.',409);
    running.add(taskId);
    Promise.resolve().then(async()=>{
      store.run('DELETE FROM approvals WHERE task_id=?',taskId);
      if(task.config.kind==='hierarchy'){
        await leadership.run(task);
      }else if(task.config.kind==='specialist'){
        store.update(task.id,{status:'working',error:null},'Agent topshiriqni qabul qildi.');
        const answer=await providers.agentCall(task.agent_id,task.description);
        store.update(task.id,{status:'done',result:{summary:answer.text,model:answer.model,provider:answer.provider}},'Agent natijani saqladi.');
      }else if (task.space==='it') await runIT(task);
      else await runAI(task);
    }).catch(error=>recordFailure(taskId,error)).finally(()=>running.delete(taskId));
    return {started:true};
  }
  async function approve(taskId,fingerprint,decision,feedback='') {
    const task=store.task(taskId);
    const approval=store.one('SELECT * FROM approvals WHERE task_id=?',taskId);
    if(!task||!approval||!['pending','accepted'].includes(approval.status)||task.status!=='approval'||approval.fingerprint!==fingerprint||approvalHash(task)!==fingerprint||running.has(taskId)) {
      throw fail('Tasdiqlash uchun sahifadagi oxirgi diffni yangilang.',409);
    }
    if (decision==='reject') {
      if (approval.status==='accepted') throw fail('Bu amal oldin tasdiqlangan. Nashrni davom ettirish mumkin.',409);
      await update(taskId,{status:'review',result:{...task.result,qa:{pass:false,feedback:feedback||'Egasi tuzatish uchun qaytardi.'}}},'Egasi ishni qayta ishlashga yubordi.');
      store.run("UPDATE approvals SET status='rejected',decided_at=? WHERE task_id=?",new Date().toISOString(),taskId);
      return {rejected:true};
    }
    running.add(taskId);
    store.run("UPDATE approvals SET status='accepted',decided_at=?,error=NULL WHERE task_id=?",new Date().toISOString(),taskId);
    try {
      const draft=task.demo ? {demo:true,number:1} : await git.publish(task);
      await update(taskId,{status:'done',result:{...task.result,draft}},task.demo?'Demo draft PR yozuvi tayyorlandi.':'GitHub’da draft PR ochildi.');
      store.run("UPDATE approvals SET status='published' WHERE task_id=?",taskId);
      learn(store.task(taskId));
      return {draft};
    } catch(error) {
      const message=error.status?error.message:'Draft PR yaratishda server xatosi.';
      store.run('UPDATE approvals SET error=? WHERE task_id=?',message,taskId);
      throw fail(message,502);
    } finally {
      running.delete(taskId);
    }
  }
  async function sync() {
    if (!paperclip.enabled) return;
    for (const {task_id} of store.all('SELECT task_id FROM task_sync ORDER BY updated_at LIMIT 100')) await flush(task_id);
    for (const {id} of store.all('SELECT id FROM tasks WHERE external_id IS NOT NULL ORDER BY updated_at DESC LIMIT 100')) {
      if (running.has(id)||store.one('SELECT 1 FROM task_sync WHERE task_id=?',id)) continue;
      const task=store.task(id);
      const issue=await paperclip.read(task.external_id).catch(()=>null);
      if (!issue||running.has(id)) continue;
      const status=paperclip.status(issue,task);
      const agent=paperclip.reverse[issue.assigneeAgentId]||task.agent_id;
      if (agent!==task.agent_id||status!==task.status) store.update(id,{status,agent_id:agent},'Paperclip holati yangilandi.',{remote:true});
    }
  }
  return {start,approve,sync};
}
