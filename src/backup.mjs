import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

export function backupDatabase(db,directory,{daily=false}={}) {
  const root=resolve(directory);
  mkdirSync(root,{recursive:true,mode:0o700});
  const time=new Date().toISOString();
  const name='office-'+(daily?time.slice(0,10):time.replace(/[:.]/g,'-'))+'.sqlite';
  const path=join(root,name);
  if(!existsSync(path))db.prepare('VACUUM INTO ?').run(path);
  return {path,date:time.slice(0,10)};
}
