import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {PROJECT, COMMANDS, assertNode, validatePackage, runCli, deploySequence} from '../tools/deploy.mjs';
import {verifyDeployment} from '../tools/verify.mjs';

const catalog={mode:'test',tables:Array.from({length:45},(_,i)=>({number:i+1,zone:i<33?'Rialto':'Lobby',capacity:10,status:'available'}))};
const mockFetch=(override={})=>async(url,request)=>{
 const b=JSON.parse(request.body); let status=200, data=catalog;
 if(b.action==='admin'||b.action==='checkout') {status=401;data={error:'Unauthorized'};}
 if(url.endsWith('bn2026-webhook')) {status=b.x_signature?401:400;data={error:'Invalid signature'};}
 if(b.action==='catalog'&&override.catalog) data=override.catalog;
 if(override.status!==undefined) status=override.status;
 return {status,json:async()=>data};
};

test('Node anterior a 20 no puede iniciar',()=>assert.throws(()=>assertNode('18.20.0')));
test('Node 20, 22 y 24 admitidos',()=>{for(const v of ['20.0.0','22.16.0','24.0.0'])assert.doesNotThrow(()=>assertNode(v));});
test('Proyecto y comandos exclusivos: login y dos funciones',()=>{
 assert.equal(PROJECT,'cmrydhzpcuklfvigboka');assert.equal(COMMANDS.length,3);
 for(const args of COMMANDS.slice(1)){assert.equal(args[0],'functions');assert.equal(args[1],'deploy');assert.ok(args.includes('--use-api'));assert.ok(args.includes(PROJECT));}
 assert.deepEqual(COMMANDS.slice(1).map(a=>a[2]),['bn2026-api','bn2026-webhook']);
 assert.ok(!JSON.stringify(COMMANDS).match(/db push|secrets|token|delete|reset/));
});
test('Secuencia ejecuta cada comando una vez',()=>{const seen=[];deploySequence(args=>seen.push(args));assert.deepEqual(seen,COMMANDS);});
test('Fallo en login detiene ambos despliegues',()=>{const seen=[];assert.throws(()=>deploySequence(args=>{seen.push(args);throw Error('blocked');}));assert.equal(seen.length,1);});
test('Fallo de primera funcion no despliega la segunda',()=>{const seen=[];assert.throws(()=>deploySequence(args=>{seen.push(args);if(seen.length===2)throw Error('fail');}));assert.equal(seen.length,2);});
test('Windows usa shell solo con argumentos fijos',()=>{
 let got;runCli(COMMANDS[1],{platform:'win32',spawn:(cmd,args,opts)=>{got={cmd,args,opts};return {status:0};}});
 assert.equal(got.cmd,'npx');assert.deepEqual(got.args,['--yes','supabase@2',...COMMANDS[1]]);assert.equal(got.opts.shell,true);assert.equal(got.opts.stdio,'inherit');
});
test('Linux no utiliza shell',()=>{runCli(COMMANDS[0],{platform:'linux',spawn:(cmd,args,opts)=>{assert.equal(opts.shell,false);return {status:0};}});});
test('Falta de npx o error CLI producen fallo',()=>{
 assert.throws(()=>runCli(COMMANDS[0],{spawn:()=>({error:Error('not found')})}));
 assert.throws(()=>runCli(COMMANDS[0],{spawn:()=>({status:1})}));
 assert.throws(()=>runCli(COMMANDS[0],{spawn:()=>({status:null})}));
});
test('Verificacion pasa con endpoints esperados sin credenciales',async()=>{
 const seen=[];const provider=mockFetch();
 const rows=await verifyDeployment((url,req)=>{seen.push(req);return provider(url,req);});
 assert.equal(rows.length,5);assert.ok(rows.every(r=>r.ok));
 assert.ok(seen.every(r=>!r.headers.Authorization&&!r.headers.apikey));
 assert.ok(seen.every(r=>JSON.parse(r.body).action!=='login'));
});
test('Catalogo comercial no se acepta como ensayo',async()=>{
 const rows=await verifyDeployment(mockFetch({catalog:{...catalog,mode:'live'}}));assert.equal(rows[0].ok,false);
});
test('Catalogo incompleto o numeracion repetida no se acepta',async()=>{
 for(const tables of [catalog.tables.slice(0,44),catalog.tables.map(t=>({...t,number:1}))]){
 const rows=await verifyDeployment(mockFetch({catalog:{...catalog,tables}}));assert.equal(rows[0].ok,false);}
});
test('Datos personales en el catalogo generan alerta',async()=>{
 const data={...catalog,tables:catalog.tables.map(t=>({...t,email:'example@example.invalid'}))};
 const rows=await verifyDeployment(mockFetch({catalog:data}));assert.equal(rows[0].ok,false);
});
test('HTTP 404 no se presenta como exito de despliegue',async()=>{
 const rows=await verifyDeployment(mockFetch({status:404}));assert.ok(rows.every(r=>!r.ok));
});
test('Errores de red no se escriben en el informe',async()=>{
 const rows=await verifyDeployment(async()=>{throw Error('SECRET_SHOULD_NOT_APPEAR');});
 assert.equal(rows.length,5);assert.ok(rows.every(r=>!r.ok&&r.status===0));assert.ok(!JSON.stringify(rows).includes('SECRET'));
});
test('Integridad valida y detecta alteraciones del paquete',()=>{
 const p=mkdtempSync(join(tmpdir(),'bn-deploy-'));
 try{mkdirSync(join(p,'supabase'));const file='project_id = "'+PROJECT+'"';writeFileSync(join(p,'supabase/config.toml'),file);
 writeFileSync(join(p,'manifest.json'),JSON.stringify({'supabase/config.toml':createHash('sha256').update(file).digest('hex')}));
 assert.doesNotThrow(()=>validatePackage(p));writeFileSync(join(p,'supabase/config.toml'),file+'\n#changed');assert.throws(()=>validatePackage(p));
 }finally{rmSync(p,{recursive:true,force:true});}
});
test('Proyecto distinto bloquea el proceso antes del login',()=>{
 const p=mkdtempSync(join(tmpdir(),'bn-deploy-'));
 try{mkdirSync(join(p,'supabase'));writeFileSync(join(p,'supabase/config.toml'),'project_id = "wrong"');assert.throws(()=>validatePackage(p));}finally{rmSync(p,{recursive:true,force:true});}
});
test('Manifiesto no permite rutas fuera del paquete',()=>{
 const p=mkdtempSync(join(tmpdir(),'bn-deploy-'));
 try{mkdirSync(join(p,'supabase'));writeFileSync(join(p,'supabase/config.toml'),'project_id = "'+PROJECT+'"');writeFileSync(join(p,'manifest.json'),JSON.stringify({'supabase/../../secret.txt':'bad'}));assert.throws(()=>validatePackage(p));}finally{rmSync(p,{recursive:true,force:true});}
});
