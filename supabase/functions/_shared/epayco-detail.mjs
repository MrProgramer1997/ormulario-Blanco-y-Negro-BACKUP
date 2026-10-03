import { Buffer } from 'node:buffer';
import { rpc } from './http.ts';
import { amountCOP, testFlag, paymentStatus } from './validation.mjs';
export class VerificationError extends Error {constructor(code,status=503){super(code);this.code=code;this.status=status;}}
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function scalar(v){return typeof v==='string'?v.trim():(typeof v==='number'&&Number.isFinite(v)?String(v):'');}
function required(v,code){const s=scalar(v);if(!s||s.length>256)throw new VerificationError(code);return s;}
function match(a,b,code){if(a!==b)throw new VerificationError(code,400);}
export function numericReference(v){const s=scalar(v);if(!/^[1-9][0-9]{0,13}$/.test(s))throw new VerificationError('INVALID_REFERENCE',400);return s;}
function statusOf(v){return paymentStatus(required(v,'PROVIDER_STATUS_MISSING'));}
export function normalizeDetail(payload,expectedReference,expectedMerchant){
 if(!record(payload)||payload.success!==true)throw new VerificationError('PROVIDER_QUERY_NOT_SUCCESSFUL');
 const d=payload.data;if(!record(d)||!record(d.log))throw new VerificationError('PROVIDER_DETAIL_INCOMPLETE');const log=d.log;
 const ref=required(d.referencePayco,'PROVIDER_REFERENCE_MISSING');match(ref,numericReference(expectedReference),'REFERENCE_MISMATCH');match(required(log.x_ref_payco,'PROVIDER_REFERENCE_MISSING'),ref,'REFERENCE_MISMATCH');
 const merchant=required(log.x_cust_id_cliente,'PROVIDER_MERCHANT_MISSING');match(merchant,String(expectedMerchant).trim(),'MERCHANT_MISMATCH');
 const transaction=required(log.x_transaction_id,'PROVIDER_TRANSACTION_MISSING');const invoice=required(d.bill,'PROVIDER_INVOICE_MISSING');const logInvoice=scalar(log.x_id_invoice)||scalar(log.x_id_factura);match(required(logInvoice,'PROVIDER_INVOICE_MISSING'),invoice,'INVOICE_MISMATCH');
 for(const name of ['x_id_invoice','x_id_factura']){if(scalar(log[name]))match(scalar(log[name]),invoice,'INVOICE_MISMATCH');}
 let amount,logAmount,isTest,logTest;try{amount=amountCOP(d.amount);logAmount=amountCOP(log.x_amount);}catch{throw new VerificationError('PROVIDER_AMOUNT_INVALID');}match(amount,logAmount,'AMOUNT_MISMATCH');
 const currency=required(d.currency,'PROVIDER_CURRENCY_MISSING').toUpperCase();match(required(log.x_currency_code,'PROVIDER_CURRENCY_MISSING').toUpperCase(),currency,'CURRENCY_MISMATCH');
 try{isTest=testFlag(d.test);logTest=testFlag(log.x_test_request);}catch{throw new VerificationError('PROVIDER_ENVIRONMENT_MISSING');}match(isTest,logTest,'ENVIRONMENT_MISMATCH');
 const status=statusOf(d.status);const logStatus=statusOf(log.x_response??log.x_respuesta);if(status!==logStatus)throw new VerificationError('PROVIDER_STATE_INCONSISTENT');
 return {reference:ref,merchant,transaction,invoice,amount,currency,isTest,status};
}
/** The documented detail endpoint requires GET with a JSON body, not a query string.
 * Use the fixed service-role-only RPC. Provider keys stay in the Edge runtime;
 * its short-lived bearer is passed server-to-server, never saved or returned.
 */
export async function apifyJson(path,method,body,authorization,dependencies={fetch,rpc}){
 if(path==='/transaction/detail'&&method==='GET'){const ref=numericReference(body?.filter?.referencePayco);const result=await dependencies.rpc('bn_epayco_detail_read',{p_reference:ref,p_bearer:authorization});if(result?.lookupError)throw new VerificationError(result.lookupError);return result;}
 if(path!=='/login'||method!=='POST')throw new VerificationError('PROVIDER_ROUTE_NOT_ALLOWED');
 try{const r=await dependencies.fetch('https://apify.epayco.co/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(9000),headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:authorization}});if(!r.ok){await r.body?.cancel();throw new VerificationError(r.status===401||r.status===403?'PROVIDER_AUTH_OR_PERMISSION':'PROVIDER_HTTP_ERROR');}const reader=r.body?.getReader();if(!reader)throw new VerificationError('PROVIDER_JSON_INVALID');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new VerificationError('PROVIDER_RESPONSE_TOO_LARGE');}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new VerificationError('PROVIDER_JSON_INVALID');}}catch(e){if(e instanceof VerificationError)throw e;throw new VerificationError('PROVIDER_LOGIN_UNAVAILABLE');}
}
export async function queryDetail(reference,secret,transport=apifyJson){
 const ref=numericReference(reference);const credentials=Buffer.from(secret('EPAYCO_PUBLIC_KEY')+':'+secret('EPAYCO_PRIVATE_KEY')).toString('base64');
 const auth=await transport('/login','POST',undefined,'Basic '+credentials);if(!record(auth)||typeof auth.token!=='string'||auth.token.length<20||/[\r\n]/.test(auth.token))throw new VerificationError('PROVIDER_LOGIN_INVALID');
 const detail=await transport('/transaction/detail','GET',{filter:{referencePayco:Number(ref)}},'Bearer '+auth.token);
 try{return normalizeDetail(detail,ref,secret('EPAYCO_P_CUST_ID_CLIENTE'));}catch(e){console.warn(JSON.stringify({component:'bn_epayco_detail',code:e?.code||'INVALID_DETAIL',success:detail?.success===true,shape:detail?._shape??null,title:detail?.success===true?undefined:detail?.titleResponse,text:detail?.success===true?undefined:detail?.textResponse}));throw e;}
}
