import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const manifest=JSON.parse(readFileSync('third-party/UPSTREAM.json','utf8'));
const sources={paperclip:manifest.paperclip,openclaw:manifest.openclaw};
const requested=process.argv.slice(2);
const names=requested.length?requested:Object.keys(sources);
mkdirSync('upstream',{recursive:true});
function git(args) {
  const result=spawnSync('git',args,{stdio:'inherit',windowsHide:true});
  if(result.status!==0)process.exit(result.status||1);
}
for(const name of names) {
  const source=sources[name];
  if(!source)throw Error('Unknown upstream: '+name);
  const location=resolve('upstream',name);
  if(existsSync(location)) {
    console.log(location+' mavjud. Commitni git rev-parse HEAD orqali tekshiring.');
    continue;
  }
  mkdirSync(location);
  git(['-C',location,'init']);
  git(['-C',location,'remote','add','origin',source.repository+'.git']);
  git(['-C',location,'fetch','--depth','1','origin',source.commit]);
  git(['-C',location,'checkout','--detach','FETCH_HEAD']);
}
