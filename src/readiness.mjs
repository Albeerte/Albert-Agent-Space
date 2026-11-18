import { fail } from './providers.mjs';

const spaces=['it','ai','private'];
const roles={it:['cto','tech','backend','qa'],ai:['head-ai','evaluation'],private:['assistant']};
const names={it:'IT Company',ai:'AI Department',private:'Private Workspace'};

export function makeReadiness({store,providers,env,paperclip,git}) {
  function profileReady(profile){
    if(!profile)return {configured:false,reason:'Asosiy model profili biriktirilmagan.'};
    if(['openai','openrouter','nvidia','openclaw','codex'].includes(profile.provider)&&!profile.secret)
      return {configured:false,reason:'Profil kaliti yoki Gateway tokeni kiritilmagan.'};
    if(['openclaw','codex'].includes(profile.provider)&&!profile.remote_agent)
      return {configured:false,reason:'OpenClaw agent ID kiritilmagan.'};
    if(!['openai','openrouter','nvidia'].includes(profile.provider)&&!profile.base&&
      !(profile.provider==='ollama'&&env.OFFICE_OLLAMA_URL)&&!(profile.provider==='lmstudio'&&env.OFFICE_LM_STUDIO_URL))
      return {configured:false,reason:'Model serverining URL manzili kiritilmagan.'};
    return {configured:true,reason:profile.error||(!profile.tested?'Ulanish hali sinov qilinmagan.':'Oxirgi profil sinovi muvaffaqiyatli.'),tested:profile.tested,error:profile.error};
  }
  function state(){
    const agents=store.all('SELECT a.id,a.name,a.profile_id,r.space FROM agents a JOIN rooms r ON r.id=a.room_id');
    const assignments=agents.map(agent=>{
      const profile=agent.profile_id&&providers.get(agent.profile_id);
      const result=profileReady(profile);
      if(agent.space==='private'&&profile&&!providers.isLocal(profile))Object.assign(result,{configured:false,reason:'Shaxsiy assistent faqat tasdiqlangan lokal profilni ishlatadi.'});
      if(agent.id==='assistant'&&!profile&&env.OFFICE_PRIVATE_MODEL&&
        (env.OFFICE_PRIVATE_PROVIDER==='lmstudio'?env.OFFICE_LM_STUDIO_URL:env.OFFICE_OLLAMA_URL))
        Object.assign(result,{configured:true,reason:'Serverdagi standart lokal model. Jonli javob tekshirilmagan.'});
      return {...agent,profileName:profile?.name||'',model:profile?.model||(agent.id==='assistant'?env.OFFICE_PRIVATE_MODEL||'':''),...result};
    });
    const mapped=roles.it.concat('test','frontend','head-ai','evaluation').filter(id=>!paperclip.agentMap[id]);
    const github={configured:Boolean(env.OFFICE_GITHUB_TOKEN)&&git.names.length>0,repos:git.names,
      tokenConfigured:Boolean(env.OFFICE_GITHUB_TOKEN),testRunnerEnabled:env.OFFICE_DOCKER_TESTS==='1',
      runtime:env.OFFICE_RUNTIME||'native',verified:false};
    const pipeline=spaces.map(space=>{
      const required=roles[space].map(id=>assignments.find(agent=>agent.id===id));
      return {space,name:names[space],modelsConfigured:required.every(agent=>agent?.configured),
        requiredAgents:roles[space],steps:space==='it'?['CTO','Tech Lead','Dasturchi','Test','QA','Egasi tasdig‘i','Draft PR']:
          space==='ai'?['Ikki variant','Bir xil testlar','Baholash','Hisobot']:['Hujjat','Lokal model','Savol','Saqlangan javob']};
    });
    return {agents:assignments,pipelines:pipeline,profiles:providers.list(),github,
      paperclip:{configured:paperclip.enabled,missingMappings:mapped,verified:false},
      safeguards:{ownerApproval:true,paidFallbackOptIn:true,privateLocalDefault:true,mergeEnabled:false,productionDeployEnabled:false}};
  }
  function assign(body){
    if(!spaces.includes(body.space))throw fail('Ish muhitini tanlang.');
    const profile=typeof body.profileId==='string'&&providers.get(body.profileId);
    if(!profile)throw fail('Model profili topilmadi.',404);
    if(!profileReady(profile).configured)throw fail(profileReady(profile).reason);
    if(body.space==='private'&&!providers.isLocal(profile))throw fail('Shaxsiy bo‘limga faqat tasdiqlangan lokal profil biriktiriladi.',403);
    const ids=store.all('SELECT a.id FROM agents a JOIN rooms r ON r.id=a.room_id WHERE r.space=?',body.space);
    store.transaction(()=>{for(const agent of ids)store.run('UPDATE agents SET profile_id=? WHERE id=?',profile.id,agent.id);});
    return {assigned:ids.length,space:body.space};
  }
  return {state,assign};
}
