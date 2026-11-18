// Keep full upstream snapshots separate from the Office runtime and its secrets.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, mkdtempSync, renameSync, rmSync,writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projects=JSON.parse(readFileSync(new URL('../third-party/projects.json',import.meta.url)));
const root=fileURLToPath(new URL('../upstream/projects/',import.meta.url));
const [command='list', ...wanted]=process.argv.slice(2);
if (!['list','fetch','checkout','status'].includes(command)) throw Error('list | fetch | checkout | status');
const selected=!wanted.length || wanted.includes('all') ? projects : wanted.map(id=>{
  const project=projects.find(p=>p.id===id);
  if(!project) throw Error('Noma’lum loyiha: '+id);
  return project;
});
function git(args,capture=false,input){
  const result=spawnSync('git',['-c','core.longpaths=true','-c','filter.lfs.process=','-c','filter.lfs.smudge=','-c','filter.lfs.required=false','-c','core.hooksPath='+ (process.platform==='win32'?'NUL':'/dev/null'),...args],{
    windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024,input,stdio:capture?'pipe':['ignore','inherit','inherit'],
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}
  });
  if(result.status!==0) throw Error(result.error?.message || (result.stderr||'Git bajarilmadi').trim());
  return result.stdout?.trim();
}
for(const p of selected){
  try{
    if(command==='list'){console.log(p.id+'  '+p.license+'  '+p.commit.slice(0,12));continue;}
    const target=join(root,p.id);
    if(command==='status'&&!existsSync(target)){console.log(p.id+'  olinmagan');continue;}
    if(!existsSync(target)){
      mkdirSync(root,{recursive:true});
      const stage=mkdtempSync(join(root,'.fetch-'+p.id+'-'));
      try{
        git(['init','--quiet',stage]);
        git(['-C',stage,'remote','add','origin','https://github.com/'+p.repo+'.git']);
        git(['-C',stage,'fetch','--quiet','--depth=1','--no-tags','origin',p.commit]);
        if(git(['-C',stage,'rev-parse','FETCH_HEAD'],true)!==p.commit)throw Error('Commit mos emas');
        git(['-C',stage,'update-ref','HEAD',p.commit]);
        try{renameSync(stage,target);}
        catch(error){
          if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(error.code)||existsSync(target))throw error;
          cpSync(stage,target,{recursive:true,force:false,errorOnExist:true});
          if(git(['-C',target,'rev-parse','HEAD'],true)!==p.commit)throw Error('Nusxa commit raqami mos emas.');
        }
      }finally{if(existsSync(stage))rmSync(stage,{recursive:true,force:true,maxRetries:2});}
    }
    if(git(['-C',target,'rev-parse','HEAD'],true)!==p.commit)throw Error('Mavjud checkout commit raqami mos emas: '+target);
    const marker=join(target,'.git','office-checkout');
    if(command==='checkout'&&!existsSync(marker)){
      // Only populate previously absent files. Never overwrite an edited working tree.
      if(!existsSync(join(target,'.git','index')))git(['-C',target,'read-tree',p.commit]);
      const missing=git(['-C',target,'ls-files','--deleted','-z'],true);
      if(missing){
        try{git(['-C',target,'checkout-index','--stdin','-z'],true,missing);}
        catch(error){
          if(git(['-C',target,'ls-files','--deleted','-z'],true))throw error;
          console.warn(p.id+': ayrim nomlar ushbu fayl tizimida bir xil ko‘rinadi. Asl fayllar Git obyektlarida mavjud.');
        }
      }
      writeFileSync(marker,p.commit);
    }
    console.log(p.id+'  '+p.commit+'  '+target);
  }catch(e){console.error(p.id+': '+e.message);process.exitCode=1;}
}
