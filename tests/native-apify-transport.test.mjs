import test from 'node:test';
import assert from 'node:assert/strict';
import {apifyJson} from '../supabase/functions/_shared/epayco-detail.mjs';
const ref={filter:{referencePayco:388322651}};
test('GET encodes a numeric filter, sends no body, uses HTTPS and rejects redirects',async()=>{
 let args;
 const r=await apifyJson('/transaction/detail','GET',ref,'Bearer fixture',async(...a)=>{args=a;return new Response('{"success":true}');});
 assert.equal(r.success,true);const u=new URL(args[0]);assert.equal(u.origin,'https://apify.epayco.co');assert.equal(u.pathname,'/transaction/detail');assert.equal(u.searchParams.get('filter[referencePayco]'),'388322651');assert.equal(args[1].method,'GET');assert.equal(args[1].body,undefined);assert.equal(args[1].redirect,'error');assert.equal(args[1].headers.Authorization,'Bearer fixture');
});
test('login stays POST and does not place credentials in URL',async()=>{await apifyJson('/login','POST',undefined,'Basic fixture',async(u,o)=>{assert.equal(u,'https://apify.epayco.co/login');assert.equal(o.method,'POST');return new Response('{}');});});
for(const [code,expected] of [[401,'PROVIDER_AUTH_OR_PERMISSION'],[403,'PROVIDER_AUTH_OR_PERMISSION'],[302,'PROVIDER_HTTP_ERROR'],[503,'PROVIDER_HTTP_ERROR']])test('HTTP '+code+' fails closed',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',async()=>new Response('{}',{status:code})),e=>e.code===expected);});
test('invalid JSON remains an error',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',async()=>new Response('not-json')),e=>e.code==='PROVIDER_JSON_INVALID');});
test('response limit enforced',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',async()=>new Response('x'.repeat(1048577))),e=>e.code==='PROVIDER_RESPONSE_TOO_LARGE');});
test('network exception does not expose request or secret',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',async()=>{throw Error('secret fixture');}),e=>e.message==='PROVIDER_NETWORK_ERROR');});
test('only read detail and login routes allowed',async()=>{await assert.rejects(apifyJson('/transaction/reversion','POST',{},'fixture'),e=>e.code==='PROVIDER_ROUTE_NOT_ALLOWED');await assert.rejects(apifyJson('/transaction/detail','POST',ref,'fixture'),e=>e.code==='PROVIDER_METHOD_NOT_ALLOWED');await assert.rejects(apifyJson('/transaction/detail','GET',{filter:{referencePayco:'1&other=2'}},'fixture'),e=>e.code==='INVALID_REFERENCE');});
