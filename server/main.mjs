import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual, scryptSync, createHash } from 'node:crypto';
import { mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = {
  port: Number(process.env.CENTINELA_WEB_PORT ?? 8080),
  host: process.env.CENTINELA_WEB_BIND ?? '127.0.0.1',
  secure: process.env.CENTINELA_WEB_REQUIRE_HTTPS === '1',
  admin: process.env.CENTINELA_WEB_ADMIN_USER ?? '',
  password: process.env.CENTINELA_WEB_ADMIN_PASSWORD ?? '',
  origins: new Set((process.env.CENTINELA_WEB_PUBLIC_ORIGINS ??
    'http://localhost:8080,http://localhost:5174,http://127.0.0.1:8080,http://127.0.0.1:5174').split(',').map(value => value.trim())),
  data: resolve(process.env.CENTINELA_WEB_DATA ?? resolve(root, 'data')),
};
if (!config.admin || config.password.length < 14 || config.password.startsWith('replace-with-')) {
  throw new Error('Define CENTINELA_WEB_ADMIN_USER y una contraseña privada de al menos 14 caracteres.');
}
const adminSalt = randomBytes(32);
const adminDigest = scryptSync(config.password, adminSalt, 64);
config.password = undefined;
mkdirSync(config.data, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(config.data, 'leads.sqlite'), { timeout: 3000 });
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE, company TEXT NOT NULL, contact TEXT NOT NULL, whatsapp TEXT NOT NULL,
    email TEXT NOT NULL, company_type TEXT NOT NULL, employees INTEGER NOT NULL,
    origin TEXT NOT NULL DEFAULT 'web', plan TEXT NOT NULL DEFAULT '', billing TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'sent',
    payment TEXT NOT NULL DEFAULT 'pending', domain TEXT NOT NULL DEFAULT '', installation_date TEXT NOT NULL DEFAULT '',
    renewal_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
`);
if (!db.prepare('PRAGMA table_info(leads)').all().some(column => column.name === 'billing')) {
  db.exec("ALTER TABLE leads ADD COLUMN billing TEXT NOT NULL DEFAULT ''");
}
const dist = resolve(root, 'dist');
const limits = new Map();
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webm':'video/webm','.mp4':'video/mp4' };

class HttpError extends Error {
  constructor(status, es, en) {
    super(es);
    this.status = status;
    this.english = en;
  }
}

function responseSecurity(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (config.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function originCheck(req) {
  if (!config.origins.has(req.headers.origin ?? '')) throw new HttpError(403, 'El origen de la solicitud no está autorizado.', 'Request origin is not authorized.');
}

function rate(req, namespace, maximum) {
  const now = Date.now();
  const key = namespace + ':' + (req.socket.remoteAddress ?? 'unknown');
  for (const [id,data] of limits) if (data.until <= now) limits.delete(id);
  const entry = limits.get(key) ?? { count:0, until:now+60_000 };
  entry.count += 1;
  limits.set(key, entry);
  if (entry.count>maximum) throw new HttpError(429,'Demasiados intentos. Espera y vuelve a probar.','Too many attempts. Wait before retrying.');
}

async function body(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) throw new HttpError(415,'Formato de solicitud no admitido.','Unsupported request format.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16_384) throw new HttpError(413,'La solicitud es demasiado grande.','The request is too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {}
  throw new HttpError(400,'Revisa los datos de la solicitud.','Check the request fields.');
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function cookie(req) {
  return String(req.headers.cookie ?? '').split(';').map(value=>value.trim()).find(value=>value.startsWith('centinela_web='))?.split('=')[1] ?? '';
}
function session(req) {
  const key = cookie(req);
  return /^[A-Za-z0-9_-]{40,90}$/.test(key) && db.prepare('SELECT digest FROM sessions WHERE digest=? AND expires_at>?').get(digest(key),Date.now());
}
function setCookie(res, token, age) {
  res.setHeader('Set-Cookie', `centinela_web=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${age}${config.secure?'; Secure':''}`);
}

function clean(value, max) { return typeof value==='string'?value.trim().slice(0,max):''; }
function validateLead(data) {
  const lead = {
    company:clean(data.company,150), contact:clean(data.contact,120), whatsapp:clean(data.whatsapp,48),
    email:clean(data.email,254), company_type:clean(data.company_type,100), employees:Number(data.employees),
    plan:clean(data.plan,24), billing:clean(data.billing,24),
  };
  if (!lead.company||!lead.contact||!lead.company_type||!Number.isInteger(lead.employees)||lead.employees<1||lead.employees>1_000_000||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)||
      !['','team','100','500','1000'].includes(lead.plan)||!['','monthly','annual'].includes(lead.billing)) {
    throw new HttpError(400,'Revisa los datos de contacto, la cantidad de personas y el plan de interés.',
      'Check the contact details, headcount and plan of interest.');
  }
  if (!/^\+?[\d()\s.-]{7,48}$/.test(lead.whatsapp)||lead.whatsapp.replace(/\D/g,'').length<7) {
    throw new HttpError(400,'Ingresa un número de WhatsApp válido. Puedes incluir el código de país.',
      'Enter a valid WhatsApp number. You can include the country code.');
  }
  return lead;
}

function createLead(data) {
  const lead = validateLead(data);
  const date = new Date().toISOString();
  const reference = 'CE-' + randomBytes(6).toString('hex').toUpperCase();
  db.prepare(`INSERT INTO leads(reference,company,contact,whatsapp,email,company_type,employees,plan,billing,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(reference,lead.company,lead.contact,lead.whatsapp,lead.email,lead.company_type,lead.employees,lead.plan,lead.billing,date,date);
  return { reference, status:'sent', payment:'pending' };
}

function dateOnly(value) {
  if (!value) return '';
  const parsed = new Date(value + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)
    throw new HttpError(400,'Revisa las fechas de instalación y renovación.','Check the installation and renewal dates.');
  return value;
}

function saveClient(id, data) {
  const original = db.prepare('SELECT billing FROM leads WHERE id=?').get(id);
  if (!original) throw new HttpError(404,'La ficha ya no está disponible.','The record is no longer available.');
  const lead = validateLead({ ...data, billing: data.billing ?? original.billing });
  const origin = clean(data.origin,32);
  const status = clean(data.status,24);
  if (!['web','dojo','direct'].includes(origin)||!['sent','contacted','customer','archived'].includes(status)) {
    throw new HttpError(400,'Elige un origen y un estado válidos.','Select a valid source and status.');
  }
  db.prepare(`UPDATE leads SET company=?,contact=?,whatsapp=?,email=?,company_type=?,employees=?,plan=?,billing=?,
    origin=?,status=?,domain=?,installation_date=?,renewal_date=?,notes=?,updated_at=? WHERE id=?`)
    .run(lead.company,lead.contact,lead.whatsapp,lead.email,lead.company_type,lead.employees,lead.plan,lead.billing,origin,status,
      clean(data.domain,180),dateOnly(clean(data.installation_date,10)),dateOnly(clean(data.renewal_date,10)),
      clean(data.notes,4000),new Date().toISOString(),id);
  return db.prepare('SELECT * FROM leads WHERE id=?').get(id);
}

async function handleApi(req,res,url) {
  const method=req.method;
  if (method==='POST'||method==='PATCH'||method==='DELETE') originCheck(req);
  if (url.pathname==='/api/health'&&method==='GET') return json(res,200,{ status:'ok' });
  if (url.pathname==='/api/leads'&&method==='POST') {
    rate(req,'lead',8);
    return json(res,201,createLead(await body(req)));
  }
  if (url.pathname==='/api/admin/login'&&method==='POST') {
    rate(req,'login',8);
    const input=await body(req);
    const supplied=scryptSync(clean(input.password,512),adminSalt,64);
    if (!timingSafeEqual(adminDigest,supplied)||input.username!==config.admin)
      throw new HttpError(401,'Usuario o contraseña inválidos.','Invalid username or password.');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    const raw=randomBytes(36).toString('base64url');
    db.prepare('INSERT INTO sessions(digest,expires_at) VALUES(?,?)').run(digest(raw),Date.now()+28_800_000);
    setCookie(res,raw,28_800);
    return json(res,200,{ username:config.admin });
  }
  const auth=session(req);
  if (!auth) throw new HttpError(401,'Inicia sesión para consultar tu panel.','Sign in to view your dashboard.');
  if (url.pathname==='/api/admin/session'&&method==='GET') return json(res,200,{ username:config.admin });
  if (url.pathname==='/api/admin/session'&&method==='DELETE') {
    db.prepare('DELETE FROM sessions WHERE digest=?').run(auth.digest);
    setCookie(res,'',0);
    return json(res,200,{ status:'signed_out' });
  }
  if (url.pathname==='/api/admin/leads'&&method==='GET') return json(res,200,db.prepare(
    'SELECT * FROM leads ORDER BY created_at DESC LIMIT 2000').all());
  const client=url.pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (client&&method==='PATCH') return json(res,200,saveClient(Number(client[1]),await body(req)));
  throw new HttpError(404,'Esta página no existe.','This page does not exist.');
}

function serve(req,res,url) {
  if (!['GET','HEAD'].includes(req.method)) throw new HttpError(405,'Acción no permitida.','Action not allowed.');
  const path=decodeURIComponent(url.pathname);
  let file=resolve(dist,'.'+path);
  if (!file.startsWith(dist+sep)&&file!==dist) throw new HttpError(404,'Archivo no encontrado.','File not found.');
  if (!existsSync(file)||!statSync(file).isFile()) {
    if (extname(path)) throw new HttpError(404,'Archivo no encontrado.','File not found.');
    file=resolve(dist,'index.html');
  }
  if (!existsSync(file)) throw new HttpError(503,'Primero compila la web con npm run build.','Build the site with npm run build first.');
  const info=statSync(file);
  res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
  if (extname(file)==='.html') res.setHeader('Cache-Control','no-cache');
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range&&['.mp4','.webm'].includes(extname(file))) {
    const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):info.size-1,info.size-1);
    if (start>end||start>=info.size) { res.writeHead(416,{ 'Content-Range':`bytes */${info.size}` }); return res.end(); }
    res.writeHead(206,{ 'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1 });
    return req.method==='HEAD'?res.end():createReadStream(file,{start,end}).pipe(res);
  }
  res.setHeader('Content-Length',info.size);
  return req.method==='HEAD'?res.end():createReadStream(file).pipe(res);
}

const server = createServer(async(req,res)=>{
  responseSecurity(res);
  try {
    const url=new URL(req.url,'http://localhost');
    if (url.pathname.startsWith('/api/')) await handleApi(req,res,url); else serve(req,res,url);
  } catch(error) {
    if (res.headersSent) { res.destroy(); return; }
    if (error instanceof HttpError) json(res,error.status,{ message:error.message,message_en:error.english });
    else { console.error('Commercial operation failed:',error.name); json(res,500,{message:'No se pudo completar la operación.',message_en:'The operation could not be completed.'}); }
  }
});
server.requestTimeout=15_000;
server.headersTimeout=12_000;
server.listen(config.port,config.host,()=>console.log(`Centinela web local: http://${config.host}:${config.port}`));
