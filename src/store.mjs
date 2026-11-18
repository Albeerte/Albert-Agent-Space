import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const digest = value => createHash('sha256').update(value).digest('hex');
export const statuses = ['todo','working','review','approval','done','error'];
const sqlDir = fileURLToPath(new URL('../migrations/', import.meta.url));
const rooms = [
  ['executive','it','Rahbariyat','Topshiriqlar va ish taqsimoti'],
  ['development','it','Development','Dasturlash va kod o‘zgarishlari'],
  ['quality','it','QA','Diff, test va qabul mezonlari'],
  ['devops','it','DevOps','Build va CI natijalari'],
  ['research','ai','AI Department','Model va promptlarni baholash'],
  ['private-room','private','Private Workspace','Shaxsiy hujjatlar, rejalar va assistent']
];
const agents = [
  ['cto','executive','CTO','Texnik direktor',null],
  ['tech','development','Tech Lead','Dasturlash rahbari','cto'],
  ['frontend','development','Frontend Developer','Interfeys dasturchisi','tech'],
  ['backend','development','Backend Developer','Server dasturchisi','tech'],
  ['qa','quality','QA Lead','Sifat nazorati rahbari','cto'],
  ['test','quality','Test Engineer','Test muhandisi','qa'],
  ['devops-agent','devops','DevOps','Build va CI kuzatuvi','cto'],
  ['head-ai','research','Head of AI','AI bo‘limi rahbari',null],
  ['ai-engineer','research','AI Engineer','Model integratsiyasi','head-ai'],
  ['prompt','research','Prompt Engineer','Promptlar bilan ishlash','head-ai'],
  ['evaluation','research','Evaluation Agent','Natijalarni baholash','head-ai'],
  ['assistant','private-room','Shaxsiy assistent','Mahalliy hujjat tahlili',null]
];

export function openStore(directory, demo) {
  mkdirSync(directory, { recursive:true });
  const db = new DatabaseSync(join(directory, 'office.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
  const run = (sql, ...parameters) => db.prepare(sql).run(...parameters);
  const all = (sql, ...parameters) => db.prepare(sql).all(...parameters);
  const one = (sql, ...parameters) => db.prepare(sql).get(...parameters);
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  for (const name of readdirSync(sqlDir).filter(name => name.endsWith('.sql')).sort()) {
    if (one('SELECT name FROM migrations WHERE name = ?', name)) continue;
    transaction(() => {
      db.exec(readFileSync(join(sqlDir, name), 'utf8'));
      run('INSERT INTO migrations VALUES (?)', name);
    });
  }
  function event(taskId, message) {
    run('INSERT INTO events(task_id,message,created_at) VALUES (?,?,?)', taskId, message, now());
  }
  function task(taskId) {
    const row = one('SELECT * FROM tasks WHERE id = ?', taskId);
    return row && { ...row, config:JSON.parse(row.config), result:JSON.parse(row.result) };
  }
  function addTask({space,title,description,demo:sample,config,agentId,externalId}) {
    const taskId = id();
    transaction(() => {
      run('INSERT INTO tasks(id,space,title,description,status,agent_id,demo,config,external_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        taskId,space,title,description,'todo',agentId,+sample,JSON.stringify(config),externalId??null,now(),now());
      event(taskId,'Vazifa yaratildi');
    });
    return task(taskId);
  }
  function update(taskId, patch, message, {remote=false}={}) {
    transaction(() => {
      const current = task(taskId);
      const next = {...current,...patch};
      run('UPDATE tasks SET status=?,agent_id=?,result=?,error=?,updated_at=? WHERE id=?',
        next.status,next.agent_id,JSON.stringify(next.result),next.error,now(),taskId);
      if (message) event(taskId,message);
      if (current.external_id && !remote) {
        run(`INSERT INTO task_sync(task_id,patch,message,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(task_id) DO UPDATE SET patch=excluded.patch,message=excluded.message,
          revision=task_sync.revision+1,attempts=0,error=NULL,updated_at=excluded.updated_at`,
          taskId,JSON.stringify({status:next.status,agent_id:next.agent_id}),message||'Office holati yangilandi.',now());
      }
    });
    return task(taskId);
  }
  if (!one("SELECT value FROM settings WHERE key='initialized'")) {
    transaction(() => {
      rooms.forEach(room=>run('INSERT INTO rooms VALUES (?,?,?,?)',...room));
      agents.forEach(agent=>run('INSERT INTO agents(id,room_id,name,role,lead_id) VALUES (?,?,?,?,?)',...agent));
      run("INSERT INTO settings VALUES ('initialized','1')");
    });
    if (demo) {
      addTask({space:'it',title:'Salomlashish matnini yangilash',description:'Demo loyihada salomlashish xabarini o‘zbek tiliga o‘zgartiring.',demo:true,config:{},agentId:'cto'});
      addTask({space:'ai',title:'Ikki promptni solishtirish',description:'Bitta test to‘plamida qisqa va batafsil javoblarni baholang.',demo:true,config:{},agentId:'head-ai'});
      run('INSERT INTO private_items VALUES (?,?,?,?,?)',id(),'document','Demo · Uchrashuv.txt','Loyiha uchrashuvi payshanba kuni soat 15:00 da boshlanadi. Uchrashuv joyi Toshkent, 2-qavat.',now());
    }
  }
  return {db,run,all,one,transaction,event,task,addTask,update};
}
