import {HttpError,secret,sha256,equalHex,limitedText,response,db,rpc,q,providerFetch,adminIdentity,rateLimit} from '../_shared/http.ts';
import {InputError,validateBooking,uuid} from '../_shared/validation.mjs';
const KEYS=['EPAYCO_P_CUST_ID_CLIENTE','EPAYCO_P_KEY','EPAYCO_PUBLIC_KEY','EPAYCO_PRIVATE_KEY'];
const DEFAULT_BASE='https://mrprogramer1997.github.io/Formulario-Blanco-y-Negro/revision-2026/';
const allowedOrigins=new Set(['https://mrprogramer1997.github.io','http://localhost:4173','http://127.0.0.1:4173','http://127.0.0.1:5500','http://localhost:5500']);
const frontendBase=()=>{
 const url=new URL(Deno.env.get('BN_FRONTEND_BASE_URL')||DEFAULT_BASE);
 if(url.protocol!=='https:'||url.hostname!=='mrprogramer1997.github.io')throw new HttpError(503,'Configura la direccion HTTPS del formulario.');
 return url.href.endsWith('/')?url.href:url.href+'/';
};
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin'),cors:Record<string,string>={Vary:'Origin'};
 if(origin&&allowedOrigins.has(origin)){cors['Access-Control-Allow-Origin']=origin;cors['Access-Control-Allow-Headers']='authorization,apikey,content-type';cors['Access-Control-Allow-Methods']='POST,OPTIONS';}
 if(origin&&!allowedOrigins.has(origin))return response({error:'Origen no permitido.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({error:'Metodo no permitido.'},405,cors);
 try{
  // Fail closed: this initial release does not implement production checkout.
  if((Deno.env.get('BN_PAYMENTS_MODE')||'test')!=='test')throw new HttpError(503,'Los cobros reales no estan habilitados en esta version.');
  let body:any;try{body=JSON.parse(await limitedText(req));}catch(err){if(err instanceof HttpError)throw err;throw new HttpError(400,'JSON no valido.');}
  if(!body||typeof body!=='object')throw new HttpError(400,'Solicitud no valida.');
  if(body.action==='catalog')return response(await rpc('bn_catalog'),200,cors);
  if(body.action==='login'){
   const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
   if(!/^[a-z0-9_]{3,40}$/.test(username)||typeof body.password!=='string'||body.password.length>256)throw new HttpError(401,'Usuario o contrasena incorrectos.');
   // Account throttling cannot be bypassed by spoofing a client IP header.
   await rateLimit('login:'+await sha256(username),8,300);
   const users=await db('bn_admin_users?select=email&enabled=eq.true&username=eq.'+q(username));
   if(!users.length)throw new HttpError(401,'Usuario o contrasena incorrectos.');
   const r=await fetch(secret('SUPABASE_URL')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:secret('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify({email:users[0].email,password:body.password}),signal:AbortSignal.timeout(10000)});
   if(!r.ok){await r.body?.cancel();throw new HttpError(401,'Usuario o contrasena incorrectos.');}
   const s=await r.json();return response({access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in},200,cors);
  }
  if(body.action==='status'){
   if(!uuid(body.id)||typeof body.token!=='string'||body.token.length<64||body.token.length>160)throw new HttpError(401,'Solicitud no valida.');
   await rateLimit('status:'+body.id,40,60);
   const rows=await db('bn_reservations?select=id,invoice,status,table_number,amount,status_token_hash&id=eq.'+q(body.id));
   if(!rows.length||!equalHex(await sha256(body.token),rows[0].status_token_hash))throw new HttpError(401,'No se pudo verificar la solicitud.');
   const pay=await db('bn_payments?select=provider_status&reservation_id=eq.'+q(body.id));
   const {status_token_hash,...safe}=rows[0];if(pay[0]?.provider_status==='late_payment_conflict')safe.status='review';
   return response(safe,200,cors);
  }
  // All remaining actions need a verified Supabase Auth session AND server role.
  const admin=await adminIdentity(req);
  if(body.action==='admin'){
   const catalog=await rpc('bn_catalog');
   const ev=(await db('bn_events?select=id&slug=eq.blanco-negro-2026-test'))[0];
   const rows=await db('bn_reservations?select=id,invoice,table_number,status,responsible_name,quantity,member_count,guest_count,amount,created_at&event_id=eq.'+q(ev.id)+'&order=created_at.desc&limit=500');
   const old=await db('reservas?select=id&limit=1000');
   const issues=await db('bn_payments?select=reservation_id&provider_status=eq.late_payment_conflict');
   const problematic=new Set(issues.map((i:any)=>i.reservation_id));
   return response({reservations:rows.map((r:any)=>problematic.has(r.id)?{...r,status:'review'}:r),tables:catalog.tables,legacyCount:old.length,settings:{mode:'test',keysConfigured:KEYS.every(k=>Boolean(Deno.env.get(k)?.trim()))}},200,cors);
  }
  if(body.action==='history')return response({rows:await db('reservas?select=id,responsable,mesa_id,cantidad,estado,created_at&order=created_at.desc&limit=500')},200,cors);
  if(body.action==='detail'){
   if(!uuid(body.id))throw new HttpError(400,'Referencia no valida.');
   return response({attendees:await db('bn_attendees?select=kind,first_name,last_name,member_action,doc_type,document,email,phone&reservation_id=eq.'+q(body.id))},200,cors);
  }
  if(body.action!=='checkout')throw new HttpError(400,'Operacion no valida.');
  await rateLimit('checkout:'+admin.id,12,300);
  KEYS.forEach(secret);frontendBase(); // Check configuration before occupying inventory.
  const clean=validateBooking(body);
  if(!uuid(body.requestId)||typeof body.statusToken!=='string'||body.statusToken.length<64||body.statusToken.length>160)throw new HttpError(400,'Identificador de solicitud no valido.');
  const testCase=body.testCase??null;if(testCase!==null&&!['T1000','T1500','T3000','T5500'].includes(testCase))throw new HttpError(400,'Caso de prueba no valido.');
  const reservation=await rpc('bn_create_test_reservation',{p_data:clean,p_request_id:body.requestId,p_request_hash:await sha256(JSON.stringify({clean,testCase})),p_token_hash:await sha256(body.statusToken),p_actor:admin.id,p_case:testCase});
  const payment=(await db('bn_payments?select=session_id&reservation_id=eq.'+q(reservation.id)))[0];
  if(payment?.session_id&&reservation.status==='payment_pending')return response({reservationId:reservation.id,sessionId:payment.session_id,test:true,amount:reservation.amount},200,cors);
  if(!(await rpc('bn_claim_checkout',{p_id:reservation.id})))throw new HttpError(409,'Ya hay una operacion para esta solicitud. Consulta su estado antes de repetir el pago.');
  try{
   const auth=await providerFetch('https://apify.epayco.co/login',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+btoa(secret('EPAYCO_PUBLIC_KEY')+':'+secret('EPAYCO_PRIVATE_KEY'))}});
   if(typeof auth.token!=='string')throw new HttpError(502,'ePayco no devolvio una sesion de autenticacion valida.');
   const result=await providerFetch('https://apify.epayco.co/payment/session/create',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.token},body:JSON.stringify({checkout_version:'2',name:'Club Campestre de Pereira',description:'PRUEBA - Fiesta Blanco y Negro 2026',currency:'COP',amount:reservation.amount,lang:'ES',country:'CO',invoice:reservation.invoice,uniqueTransactionPerBill:true,response:frontendBase()+'resultado.html?id='+reservation.id,confirmation:secret('SUPABASE_URL')+'/functions/v1/bn2026-webhook',method:'GET',extras:{extra1:reservation.invoice},billing:{name:reservation.responsible_name,email:reservation.email,mobilePhone:reservation.phone}})});
   const sessionId=result?.data?.sessionId;if(result?.success!==true||typeof sessionId!=='string'||!sessionId)throw new HttpError(502,'ePayco no devolvio una sesion de pago valida.');
   await db('bn_payments?reservation_id=eq.'+q(reservation.id),'PATCH',{session_id:sessionId,status:'session_created',updated_at:new Date().toISOString()});
   // Do not downgrade a webhook that might already have confirmed a payment.
   await db('bn_reservations?id=eq.'+q(reservation.id)+'&status=eq.opening','PATCH',{status:'payment_pending',updated_at:new Date().toISOString()});
   return response({reservationId:reservation.id,sessionId,test:true,amount:reservation.amount},200,cors);
  }catch(err){
   // A timeout does not prove no session exists at the gateway. Never blindly
   // retry creation or release the table after an ambiguous external request.
   await db('bn_reservations?id=eq.'+q(reservation.id)+'&status=eq.opening','PATCH',{status:'review',updated_at:new Date().toISOString()}).catch(()=>{});
   await db('bn_audit','POST',{reservation_id:reservation.id,actor:admin.id,action:'checkout_requires_review',detail:{reason:'provider_request_not_completed'}}).catch(()=>{});
   throw err;
  }
 }catch(err){
  if(err instanceof HttpError)return response({error:err.message},err.status,cors);
  if(err instanceof InputError)return response({error:err.message},400,cors);
  return response({error:'No fue posible completar la solicitud. No repitas un pago sin verificar su estado.'},500,cors);
 }
});
