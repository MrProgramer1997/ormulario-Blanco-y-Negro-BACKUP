export {sha256,equalHex} from './crypto.mjs';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function secret(name:string):string { const v=Deno.env.get(name)?.trim();if(!v)throw new HttpError(503,'Configuracion del servidor pendiente.');return v; }
export async function limitedText(req:Request,limit=32768):Promise<string>{
 if(Number(req.headers.get('content-length')||0)>limit)throw new HttpError(413,'Solicitud demasiado grande.');
 const reader=req.body?.getReader();if(!reader)return '';const parts:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError(413,'Solicitud demasiado grande.');}parts.push(value);}
 const all=new Uint8Array(size);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}return new TextDecoder().decode(all);
}
export function response(body:unknown,status=200,extra:Record<string,string>={}):Response{return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
export async function db(path:string,method='GET',body?:unknown):Promise<any>{
 const r=await fetch(secret('SUPABASE_URL')+'/rest/v1/'+path,{method,headers:{apikey:secret('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+secret('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 if(!r.ok){const error=await r.json().catch(()=>({}));if(String(error.message).includes('TABLE_UNAVAILABLE'))throw new HttpError(409,'La mesa ya no esta disponible. Elige otra.');if(String(error.message).includes('IDEMPOTENCY_CONFLICT'))throw new HttpError(409,'La solicitud anterior tiene otros datos. Consulta su estado antes de repetir un pago.');throw new HttpError(503,'No fue posible completar la operacion en la base de datos.');}
 return r.status===204?null:r.json();
}
export const rpc=(name:string,args:Record<string,unknown>={})=>db('rpc/'+name,'POST',args);
export const q=(s:string)=>encodeURIComponent(s);
export async function providerFetch(url:string,init:RequestInit={}):Promise<any>{
 const r=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok){await r.body?.cancel();throw new HttpError(502,'ePayco no acepto la solicitud. Revisa la configuracion antes de intentar de nuevo.');}
 return r.json();
}
export async function adminIdentity(req:Request):Promise<{id:string,email:string}>{
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))throw new HttpError(401,'Debes iniciar sesion.');
 const r=await fetch(secret('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:secret('SUPABASE_ANON_KEY'),Authorization:auth},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new HttpError(401,'Sesion no valida. Ingresa nuevamente.');
 const user=await r.json();if(typeof user.id!=='string')throw new HttpError(401,'Sesion no valida.');
 const roles=await db('bn_admin_users?select=user_id,email&enabled=eq.true&user_id=eq.'+q(user.id));
 if(!roles.length)throw new HttpError(403,'No tienes acceso administrativo a este evento.');return {id:user.id,email:roles[0].email};
}
export async function rateLimit(bucket:string,limit:number,seconds:number){if(!(await rpc('bn_rate_limit',{p_bucket:bucket,p_limit:limit,p_seconds:seconds})))throw new HttpError(429,'Demasiados intentos. Espera un momento y vuelve a intentar.');}
