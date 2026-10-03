import { createHandler } from './confirmation-handler.mjs';
import { HttpError,secret,sha256,equalHex,limitedText,response,rpc,adminIdentity } from './http.ts';
import { amountCOP } from './validation.mjs';
import { queryDetail,VerificationError,numericReference } from './epayco-detail.mjs';
export const BUILD='bn-durable-confirmation-1';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function params(p){for(const k of new Set(p.keys()))if(p.getAll(k).length!==1)throw new VerificationError('DUPLICATE_PARAMETER',400);return Object.fromEntries(p);}
async function read(req){
 if(req.method==='GET')return params(new URL(req.url).searchParams);
 const text=await limitedText(req.clone(),65536);
 if(req.headers.get('content-type')?.includes('application/json')){
  try{const d=JSON.parse(text);if(!record(d))throw Error();return d;}catch{throw new VerificationError('INVALID_JSON',400);}
 }
 return params(new URLSearchParams(text));
}
export function safeCode(err){return typeof err?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(err.code)?err.code:'VERIFICATION_NOT_COMPLETED';}
export async function signedProof(data,deps){
 if(typeof data.x_ref_payco!=='string'||typeof data.x_transaction_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.x_transaction_id)||typeof data.x_amount!=='string'||data.x_currency_code!=='COP'||typeof data.x_signature!=='string'||!/^[a-f0-9]{64}$/i.test(data.x_signature))throw new VerificationError('INVALID_NOTIFICATION',400);
 const reference=numericReference(data.x_ref_payco);let amount;
 try{amount=amountCOP(data.x_amount);}catch{throw new VerificationError('INVALID_AMOUNT',400);}
 const merchant=deps.secret('EPAYCO_P_CUST_ID_CLIENTE');
 const expected=await deps.sha256([merchant,deps.secret('EPAYCO_P_KEY'),reference,data.x_transaction_id,data.x_amount,data.x_currency_code].join('^'));
 if(!deps.equalHex(expected,data.x_signature))throw new VerificationError('INVALID_SIGNATURE',401);
 // Invoice and status are not signed by this gateway: the invoice is a hint
 // only, never authority to confirm or release a reservation.
 const hint=data.x_id_invoice??data.x_id_factura;
 return {merchant,reference,transaction:data.x_transaction_id,amount,currency:'COP',invoiceHint:typeof hint==='string'&&/^BN26TEST-[a-f0-9]{32}$/.test(hint)?hint:null};
}
export async function runBatch(deps){
 const jobs=await deps.rpc('bn_confirmation_claim');
 if(!Array.isArray(jobs)||jobs.length>2)throw new VerificationError('INVALID_QUEUE_BATCH');
 const results=await Promise.all(jobs.map(async job=>{
  let detail=null,error=null;
  try{
   detail=await deps.queryDetail(job.reference,deps.secret);
   if(detail.merchant!==job.merchant||detail.reference!==job.reference||detail.transaction!==job.transaction_id||detail.amount!==job.amount||detail.currency!==job.currency)throw new VerificationError('PROOF_MISMATCH',400);
  }catch(err){detail=null;error=safeCode(err);}
  // Completion and payment transition share one DB transaction. A crash or
  // failed write leaves a lease which another scheduled invocation can recover.
  return deps.rpc('bn_confirmation_finish',{p_id:job.id,p_lease:job.lease_id,p_detail:detail,p_error:error});
 }));
 return {processed:results.length,states:results.map(r=>r.state??'stale')};
}
export function createAutomaticHandler(overrides={}){
 const deps={secret,sha256,equalHex,rpc,adminIdentity,queryDetail,legacy:createHandler(),...overrides};
 return async req=>{
  if(req.method==='GET'&&new URL(req.url).search==='?health=1')return response({service:'bn2026-webhook',build:BUILD,automatic:true});
  if(!['GET','POST'].includes(req.method))return response({error:'METHOD_NOT_ALLOWED'},405);
  try{
   const data=await read(req);
   if(data.action==='reconcile')return deps.legacy(req);
   if(data.action==='retry_batch'){
    if(req.method!=='POST')throw new VerificationError('METHOD_NOT_ALLOWED',405);
    const token=(req.headers.get('authorization')??'').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if(!token||await deps.rpc('bn_confirmation_worker_authorized',{p_token:token})!==true)throw new VerificationError('WORKER_UNAUTHORIZED',401);
    if(deps.secret('BN_PAYMENTS_MODE')!=='test')throw new VerificationError('TEST_MODE_REQUIRED',503);
    return response({build:BUILD,...await runBatch(deps)});
   }
   if(data.action==='queue_status'){
    if(req.method!=='POST')throw new VerificationError('METHOD_NOT_ALLOWED',405);
    await deps.adminIdentity(req);
    return response({automatic:true,build:BUILD,...await deps.rpc('bn_confirmation_stats')});
   }
   const proof=await signedProof(data,deps);
   if(deps.secret('BN_PAYMENTS_MODE')!=='test')throw new VerificationError('TEST_MODE_REQUIRED',503);
   const saved=await deps.rpc('bn_confirmation_enqueue',{p_proof:proof});
   if(saved?.queued!==true)throw new VerificationError('QUEUE_NOT_SAVED');
   // HTTP 200 acknowledges durable RECEIPT, never a payment approval.
   // Delayed reads avoid requiring ePayco's confirmation log to exist while
   // ePayco is still awaiting the HTTP response that creates that same log.
   return response({received:true,queued:true,verified:false,build:BUILD});
  }catch(err){
   const status=err instanceof VerificationError||err instanceof HttpError?err.status:503;
   return response({error:safeCode(err),build:BUILD},status);
  }
 };
}
