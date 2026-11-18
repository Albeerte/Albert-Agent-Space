import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('.env mavjud. Mavjud sozlamalar saqlandi.');
} else {
  let template=readFileSync('.env.example','utf8');
  const token=()=>randomBytes(32).toString('hex');
  for(const name of ['OFFICE_PASSWORD','OFFICE_MASTER_KEY','OFFICE_AGENT_TOKEN','OPENCLAW_GATEWAY_TOKEN']) {
    template=template.replace(new RegExp('^'+name+'=$','m'),name+'='+token());
  }
  writeFileSync('.env',template,{mode:0o600,flag:'wx'});
  console.log('.env tayyor. Kirish paroli .env ichidagi OFFICE_PASSWORD qiymatida.');
}
console.log('Ishga tushirish: npm start');
console.log('Docker Desktop: docker compose up --build -d');
