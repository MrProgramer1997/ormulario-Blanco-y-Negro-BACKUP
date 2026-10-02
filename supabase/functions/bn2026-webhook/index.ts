import {HttpError,secret,sha256,equalHex,limitedText,response,rpc,providerFetch} from '../_shared/http.ts';
import {InputError,amountCOP,paymentStatus,testFlag} from '../_shared/validation.mjs';
async function signature(data:Record<string,unknown>):Promise<string>{
 return sha256([secret('EPAYCO_P_CUST_ID_CLIENTE'),secret('EPAYCO_P_KEY'),data.x_ref_payco,data.x_transaction_id,data.x_amount,data.x_currency_code].join('^'));
}
Deno.serve(async(req:Request)=>{
 if(!['POST','GET'].includes(req.method))return response({error:'Method not allowed'},405);
 try{
  let incoming:Record<string,unknown>;
  if(req.method==='GET')incoming=Object.fromEntries(new URL(req.url).searchParams);
  else{const raw=await limitedText(req,65536);incoming=(req.headers.get('content-type')||'').includes('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));}
  if(typeof incoming.x_ref_payco!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(incoming.x_ref_payco)||typeof incoming.x_signature!=='string')return response({error:'Invalid notification'},400);
  if(!equalHex(await signature(incoming),incoming.x_signature))return response({error:'Invalid signature'},401);
  // ePayco's signature does not cover status, invoice or test flag. Fetch those
  // from the provider rather than trusting unsigned fields in the incoming body.
  const verified=await providerFetch('https://secure.epayco.co/validation/v1/reference/'+encodeURIComponent(incoming.x_ref_payco));
  const canonical=verified?.data;
  if(!canonical||typeof canonical!=='object')throw new HttpError(503,'Verification temporarily unavailable');
  if(String(canonical.x_ref_payco)!==incoming.x_ref_payco||String(canonical.x_cust_id_cliente)!==secret('EPAYCO_P_CUST_ID_CLIENTE'))return response({error:'Merchant or reference mismatch'},400);
  // Do not allow a signed old amount/ref to be mixed with another transaction.
  if(String(canonical.x_transaction_id)!==String(incoming.x_transaction_id)||String(canonical.x_currency_code)!==String(incoming.x_currency_code)||amountCOP(canonical.x_amount)!==amountCOP(incoming.x_amount))return response({error:'Transaction mismatch'},400);
  const invoice=canonical.x_id_invoice||canonical.x_extra1;
  if(typeof invoice!=='string'||!invoice.startsWith('BN26TEST-'))return response({ignored:true});
  const result=await rpc('bn_apply_payment',{p_invoice:invoice,p_ref:String(canonical.x_ref_payco),p_transaction:String(canonical.x_transaction_id),p_amount:amountCOP(canonical.x_amount),p_currency:String(canonical.x_currency_code),p_test:testFlag(canonical.x_test_request),p_status:paymentStatus(canonical.x_response)});
  return response({received:true,...result});
 }catch(err){
  if(err instanceof InputError)return response({error:'Invalid transaction data'},422);
  if(err instanceof HttpError)return response({error:'Verification not completed'},err.status>=500?503:err.status);
  // Non-200 on transient failure asks the gateway to retry. Never log keys,
  // card data, personal data or the raw webhook in console output.
  return response({error:'Verification not completed'},503);
 }
});
