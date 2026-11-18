import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Only configuration presence and tool versions are reported; never print env values.
const checks=[];
const add=(name,ok,detail)=>checks.push({name,status:ok?'OK':'SETUP',detail});
add('Node.js',Number(process.versions.node.split('.')[0])>=24,process.version);
for(const tool of ['git','docker']){
  const result=spawnSync(tool,['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});
  add(tool,result.status===0,result.status===0?result.stdout.trim().slice(0,120):'Buyruq mavjud emas yoki ishga tushmadi.');
}
add('Owner authentication',Boolean(process.env.OFFICE_PASSWORD),'OFFICE_PASSWORD');
add('Secret encryption',Boolean(process.env.OFFICE_MASTER_KEY),'OFFICE_MASTER_KEY');
add('Database',existsSync(join(resolve(process.env.OFFICE_DATA||'data'),'office.sqlite')),'SQLite fayli mavjudligi');
add('GitHub',Boolean(process.env.OFFICE_GITHUB_TOKEN)&&process.env.OFFICE_GITHUB_REPOS!=='{}'&&Boolean(process.env.OFFICE_GITHUB_REPOS),'Token va ruxsatli repolar sozlamasi');
add('Paperclip',Boolean(process.env.PAPERCLIP_URL&&process.env.PAPERCLIP_COMPANY_ID&&process.env.PAPERCLIP_TOKEN),'URL, kompaniya va token sozlamasi');
add('Local model',Boolean(process.env.OFFICE_PRIVATE_MODEL&&(process.env.OFFICE_OLLAMA_URL||process.env.OFFICE_LM_STUDIO_URL)),'Lokal server va model sozlamasi; jonli inferensiya alohida sinov qilinadi.');
const port=Number(process.env.OFFICE_PORT||8787);
if(Number.isInteger(port)&&port>=1&&port<=65535){
  try{
    const response=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(2500),redirect:'error'});
    add('Office HTTP',response.ok,'Health endpoint HTTP '+response.status);
  }catch(error){add('Office HTTP',false,error.cause?.code||error.name);}
}else add('Office HTTP',false,'OFFICE_PORT yaroqsiz.');
for(const check of checks)console.log('['+check.status+'] '+check.name+' — '+check.detail);
console.log('Natija konfiguratsiya va runtime tekshiruvi; haqiqiy GitHub/model oqimining tasdig‘i emas.');
