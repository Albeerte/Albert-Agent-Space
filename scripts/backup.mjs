import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { backupDatabase } from '../src/backup.mjs';

const data=resolve(process.env.OFFICE_DATA||'data');
const path=join(data,'office.sqlite');
if(!existsSync(path))throw Error('Database does not exist yet. Start the office first.');
const db=new DatabaseSync(path);
try {
  db.exec('PRAGMA busy_timeout=10000');
  const result=backupDatabase(db,process.env.OFFICE_BACKUP_DIR||join(data,'backups'));
  console.log('Backup created: '+result.path);
}finally{db.close();}
