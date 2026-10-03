import test from 'node:test';import assert from 'node:assert/strict';
import {withBrowserCors} from '../supabase/functions/_shared/browser-cors.mjs';
const base='https://example.invalid/hook';
for(const origin of ['https://mrprogramer1997.github.io','http://localhost:5500'])test('approved origin preflight '+origin,async()=>{
 let calls=0;const h=withBrowserCors(async()=>{calls++;return new Response('ok');});
 const r=await h(new Request(base,{method:'OPTIONS',headers:{origin}}));assert.equal(r.status,204);assert.equal(calls,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);assert.match(r.headers.get('Access-Control-Allow-Headers'),/authorization/);
});
test('unapproved preflight fails closed',async()=>{const h=withBrowserCors(async()=>{throw Error();});assert.equal((await h(new Request(base,{method:'OPTIONS',headers:{origin:'https://untrusted.invalid'}}))).status,403);});
for(const status of [200,400,401,403,503])test('CORS preserves handler status '+status,async()=>{const h=withBrowserCors(async()=>new Response('{"check":true}',{status,headers:{'content-type':'application/json','Cache-Control':'no-store'}}));const r=await h(new Request(base,{method:'POST',headers:{origin:'https://mrprogramer1997.github.io'},body:'{}'}));assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://mrprogramer1997.github.io');assert.deepEqual(await r.json(),{check:true});});
test('provider callback without origin remains unchanged',async()=>{let called=false;const h=withBrowserCors(async()=>{called=true;return new Response('received');});const r=await h(new Request(base,{method:'POST'}));assert.equal(called,true);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);assert.equal(await r.text(),'received');});
