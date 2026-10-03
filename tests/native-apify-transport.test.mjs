import test from 'node:test';
import assert from 'node:assert/strict';
import {apifyJson} from '../supabase/functions/_shared/epayco-detail.mjs';
const ref={filter:{referencePayco:9001001}};
test('detail uses fixed server RPC; preserves reference; no GET query substitute',async()=>{
 let call;
 const r=await apifyJson('/transaction/detail','GET',ref,'Bearer fixture',{fetch:()=>{throw Error('Not a GET fetch');},rpc:async(...args)=>{call=args;return {success:true};}});
 assert.equal(r.success,true);assert.deepEqual(call,['bn_epayco_detail_read',{p_reference:'9001001',p_bearer:'Bearer fixture'}]);
});
test('login is HTTPS POST, no credentials in URL',async()=>{await apifyJson('/login','POST',undefined,'Basic fixture',{fetch:async(u,o)=>{assert.equal(u,'https://apify.epayco.co/login');assert.equal(o.method,'POST');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Basic fixture');return new Response('{}');}});});
for(const [code,expected] of [[401,'PROVIDER_AUTH_OR_PERMISSION'],[403,'PROVIDER_AUTH_OR_PERMISSION'],[302,'PROVIDER_HTTP_ERROR'],[503,'PROVIDER_HTTP_ERROR']])test('HTTP '+code+' fails closed',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',{fetch:async()=>new Response('{}',{status:code})}),e=>e.code===expected);});
test('invalid JSON is rejected',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',{fetch:async()=>new Response('not-json')}),e=>e.code==='PROVIDER_JSON_INVALID');});
test('response limit enforced',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',{fetch:async()=>new Response('x'.repeat(65537))}),e=>e.code==='PROVIDER_RESPONSE_TOO_LARGE');});
test('exception cannot expose credential',async()=>{await assert.rejects(apifyJson('/login','POST',undefined,'Basic fixture',{fetch:async()=>{throw Error('secret fixture');}}),e=>e.message==='PROVIDER_LOGIN_UNAVAILABLE');});
test('only login and read-detail routes allowed',async()=>{await assert.rejects(apifyJson('/transaction/reversion','POST',{},'fixture'),e=>e.code==='PROVIDER_ROUTE_NOT_ALLOWED');await assert.rejects(apifyJson('/transaction/detail','POST',ref,'fixture'),e=>e.code==='PROVIDER_ROUTE_NOT_ALLOWED');await assert.rejects(apifyJson('/transaction/detail','GET',{filter:{referencePayco:'1&other=2'}},'fixture'),e=>e.code==='INVALID_REFERENCE');});
test('server lookup error never becomes successful transaction',async()=>{await assert.rejects(apifyJson('/transaction/detail','GET',ref,'Bearer fixture',{rpc:async()=>({lookupError:'PROVIDER_HTTP_ERROR',success:false})}),e=>e.code==='PROVIDER_HTTP_ERROR');});
