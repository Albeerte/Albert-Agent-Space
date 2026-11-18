import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat, rm } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { fail, upstream } from './providers.mjs';

const repoName=/^[a-z\d_.-]+\/[a-z\d_.-]+$/i;
const safePath=/^[a-z\d_.-]+(?:\/[a-z\d_.-]+)*$/i;
const executableEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  /^(path|pathext|systemroot|windir|tmp|temp|home|userprofile|appdata|localappdata|programfiles|comspec)$/i.test(name)));
const commandLimit=75000;
function command(file,args,{cwd,env={},timeout=60000}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(file,args,{cwd,env:{...executableEnv(),...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let log='';
    let stdout='';
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
    for(const stream of [child.stdout,child.stderr]) stream.on('data',chunk=>{
      if (stream===child.stdout && stdout.length<commandLimit) stdout+=chunk.toString().slice(0,commandLimit-stdout.length);
      if (log.length<commandLimit) log+=chunk.toString().slice(0,commandLimit-log.length);
    });
    child.on('error',()=>{clearTimeout(timer);reject(fail(file+' buyrug‘ini boshlash imkoni bo‘lmadi.',502));});
    child.on('close',code=>{clearTimeout(timer);resolve({code,log:log.trim(),stdout:stdout.trim(),timedOut});});
  });
}
const noGitConfig={GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'};
async function git(cwd,args,env={}) {
  const result=await command('git',['-c','core.hooksPath=/dev/null','-c','core.autocrlf=false','-c','core.longpaths=true','-c','protocol.file.allow=never',...args],{cwd,env:{...noGitConfig,...env}});
  if(result.code!==0) throw fail('Git amali bajarilmadi ('+args[0]+'). Serverdagi Git sozlamalari va repo huquqini tekshiring.',502);
  return result.stdout;
}
export function parseModelJSON(text) {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  } catch {
    throw fail('Agent javobi kutilgan JSON maydonlarini bermadi.',502);
  }
}
function filePath(relative) {
  if(!safePath.test(relative)||isAbsolute(relative)||relative.split('/').some(part=>
    ['.','..','.git','.github'].includes(part.toLowerCase())||part.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw fail('Fayl yo‘liga ruxsat berilmagan.');
  }
  return relative;
}
export async function normalFile(root,relative,{create=false}={}) {
  let current=root;
  const parts=filePath(relative).split('/');
  for (const [index,part] of parts.entries()) {
    current=join(current,part);
    let info;
    try { info=await lstat(current); } catch(error) { if(error.code!=='ENOENT') throw error; }
    if(!info&&create) {
      if(index===parts.length-1) return current;
      await mkdir(current);
      info=await lstat(current);
    }
    if(!info || info.isSymbolicLink() || (index===parts.length-1 ? !info.isFile() || info.size>50000 : !info.isDirectory())) {
      throw fail('Git faylini xavfsiz o‘qib bo‘lmadi: '+relative);
    }
  }
  return current;
}

export function gitWorkflow({data,env,providers}) {
  const configured=JSON.parse(env.OFFICE_GITHUB_REPOS||'{}');
  const names=Object.keys(configured).filter(name=>repoName.test(name));
  const runs=resolve(data,'worktrees');
  const rootFor=task=>resolve(runs,task.id);
  const gitEnv=()=>{
    if (!env.OFFICE_GITHUB_TOKEN) throw fail('GitHub tokeni sozlanmagan.',503);
    return {GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0:'Authorization: Basic '+Buffer.from('x-access-token:'+env.OFFICE_GITHUB_TOKEN).toString('base64')};
  };
  function repo(task) {
    if (!names.includes(task.config.repo)) throw fail('Repo serverdagi ruxsat etilgan ro‘yxatda yo‘q.',403);
    return task.config.repo;
  }
  function github(name,path,{method='GET',body}={}) {
    if(!names.includes(name)) throw fail('Bu repoga ruxsat berilmagan.',403);
    if(!env.OFFICE_GITHUB_TOKEN) throw fail('GitHub tokeni sozlanmagan.',503);
    return upstream('https://api.github.com/repos/'+name+path,{
      method,headers:{Authorization:'Bearer '+env.OFFICE_GITHUB_TOKEN,Accept:'application/vnd.github+json',
        'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:body&&JSON.stringify(body),signal:AbortSignal.timeout(15000)
    });
  }
  async function issue(name,number) {
    const item=await github(name,'/issues/'+number);
    if (item.pull_request) throw fail('GitHub issue raqamini kiriting.');
    return {number:item.number,title:item.title,body:item.body??'',url:item.html_url};
  }
  async function worktree(task) {
    const root=rootFor(task);
    if (!root.startsWith(runs+(process.platform==='win32'?'\\':'/')) || !/^[0-9a-f-]{36}$/.test(task.id)) throw fail('Vazifa ID yaroqsiz.');
    await rm(root,{recursive:true,force:true});
    await mkdir(root,{recursive:true});
    const origin=join(root,'repo');
    const work=join(root,'work');
    let base='main';
    if (task.demo) {
      await mkdir(origin);
      await git(origin,['init','-b','main']);
      await writeFile(join(origin,'greeting.mjs'),"export const greeting = 'Hello';\n");
      await writeFile(join(origin,'greeting.test.mjs'),"import assert from 'node:assert/strict';\nimport {greeting} from './greeting.mjs';\nassert.equal(greeting, 'Assalomu alaykum');\nconsole.log('PASS: greeting is in Uzbek');\n");
      await git(origin,['add','--','greeting.mjs','greeting.test.mjs']);
      await commit(origin,'Demo base');
    } else {
      const name=repo(task);
      const record=await github(name,'');
      base=record.default_branch;
      if (!base||base.startsWith('-')||base.includes('\n')) throw fail('GitHub asosiy branch nomi yaroqsiz.');
      await git(root,['clone','--no-tags','--depth','1','--branch',base,'--','https://github.com/'+name+'.git',origin],gitEnv());
    }
    const branch='office/'+task.id;
    const parent=await git(origin,['rev-parse','HEAD']);
    await git(origin,['worktree','add','-b',branch,work,parent]);
    return {work,origin,base,parent,branch};
  }
  function commit(work,title) {
    return git(work,['-c','user.name=AI Agent Office','-c','user.email=agent-office@users.noreply.github.com','commit','--no-gpg-sign','-m',title]);
  }
  async function tests(task,work,config) {
    if (task.demo) return command(process.execPath,['--test','greeting.test.mjs'],{cwd:work});
    if (env.OFFICE_DOCKER_TESTS!=='1') throw fail('Haqiqiy repo testlari uchun hostda OFFICE_DOCKER_TESTS=1 va Docker kerak.',503);
    const {image,test}=config;
    if (typeof image!=='string'||!/^[a-z\d][a-z\d./_:@-]*$/i.test(image)||!Array.isArray(test)||!test.length||test.some(arg=>typeof arg!=='string')) {
      throw fail('Repo uchun Docker image va test argumentlari sozlanmagan.',503);
    }
    const name='office-test-'+task.id;
    const args=['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
      '--pids-limit=128','--memory=768m','--cpus=1','--user=1000:1000','--tmpfs=/tmp:rw,exec,size=320m',
      '--mount','type=bind,source='+work+',target=/input,readonly','--workdir=/tmp','--entrypoint=/bin/sh',image,
      '-c','mkdir /tmp/project && cp -R /input/. /tmp/project/ && rm -f /tmp/project/.git && cd /tmp/project && exec "$@"','office-test',...test];
    try {
      return await command('docker',args,{cwd:work,env:{HOME:'/tmp'},timeout:180000});
    } finally {
      await command('docker',['rm','-f',name],{cwd:work,timeout:7000}).catch(()=>{});
    }
  }
  async function implement(task,criteria,onTest=async()=>{}) {
    const checkout=await worktree(task);
    const {work,parent}=checkout;
    const config=task.demo?{}:configured[repo(task)];
    let changed;
    if (task.demo) {
      await writeFile(join(work,'greeting.mjs'),"export const greeting = 'Assalomu alaykum';\n");
      changed=['greeting.mjs'];
    } else {
      const existing=Array.isArray(config.paths)?config.paths:[];
      const additions=Array.isArray(config.create)?config.create:[];
      const paths=[...new Set([...existing,...additions])].slice(0,8);
      if (!paths.length) throw fail('Repo konfiguratsiyasida tahrirlashga ruxsat etilgan fayllar yo‘q.');
      const files={};
      for (const path of paths) {
        const target=await normalFile(work,path,{create:additions.includes(path)});
        try {files[path]=await readFile(target,'utf8');}
        catch(error){if(error.code==='ENOENT'&&additions.includes(path))files[path]=null;else throw error;}
      }
      const response=await providers.agentCall(task.agent_id,
        'Implement a normal software maintenance task. Return JSON only: {"files":[{"path":"allowed path","content":"complete new UTF-8 content"}]}. Use only these paths. A null source means an explicitly allowed new file.\n'+
        JSON.stringify({task:task.description,criteria,files,qaFeedback:task.result.qa?.feedback??''}));
      const result=parseModelJSON(response.text);
      if(!Array.isArray(result.files)||!result.files.length||result.files.length>paths.length) throw fail('Agent yaroqli fayl o‘zgarishini qaytarmadi.');
      changed=[];
      for(const {path,content} of result.files) {
        if(!paths.includes(path)||changed.includes(path)||typeof content!=='string'||Buffer.byteLength(content)>50000||content.includes('\0')) throw fail('Agent ruxsat etilgan fayl o‘zgarishi formatiga mos kelmadi.');
        const target=await normalFile(work,path,{create:additions.includes(path)});
        await writeFile(target,content,{flag:files[path]===null?'wx':'w'});
        changed.push(path);
      }
    }
    await git(work,['add','--',...changed]);
    const diff=await git(work,['diff','--cached','--no-color','--no-ext-diff','--no-textconv',parent,'--']);
    if(!diff||diff.length>=commandLimit) throw fail('O‘zgarish bo‘sh yoki diff ko‘rish chegarasidan katta.');
    await commit(work,'AI Agent Office: '+task.title.slice(0,90));
    const sha=await git(work,['rev-parse','HEAD']);
    await onTest();
    const test=await tests(task,work,config);
    return {diff,test,sha,parent,base:checkout.base,branch:checkout.branch,files:changed};
  }
  async function publish(task) {
    const name=repo(task);
    const {branch,sha,base,pr}=task.result;
    const predicate='?state=all&head='+encodeURIComponent(name.split('/')[0]+':'+branch)+'&base='+encodeURIComponent(base);
    async function existing() {
      const result=await github(name,'/pulls'+predicate);
      if (result[0] && result[0].head.sha!==sha) throw fail('Mavjud PR commit’i tasdiqlangan commit bilan bir xil emas.',409);
      return result[0];
    }
    const previous=await existing();
    if(previous) return {url:previous.html_url,number:previous.number};
    const work=join(rootFor(task),'work');
    const verified=await git(work,['rev-parse','HEAD']);
    if(verified!==sha) throw fail('Git commit tasdiqlangan versiyadan o‘zgargan.',409);
    await git(work,['push','--','origin',sha+':refs/heads/'+branch],gitEnv());
    let opened;
    try {
      opened=await github(name,'/pulls',{method:'POST',body:{head:branch,base,title:pr.title,body:pr.body,draft:true}});
    } catch(error) {
      if(error.upstreamStatus!==422) throw error;
      opened=await existing();
      if(!opened) throw error;
    }
    return {url:opened.html_url,number:opened.number};
  }
  async function checks(task) {
    const data=await github(repo(task),'/commits/'+encodeURIComponent(task.result.sha)+'/check-runs');
    return (data.check_runs??[]).map(run=>({name:run.name,status:run.status,conclusion:run.conclusion,url:run.html_url}));
  }
  return {names,issue,implement,publish,checks};
}
