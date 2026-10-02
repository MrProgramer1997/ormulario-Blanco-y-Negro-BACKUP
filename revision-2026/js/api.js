import {storage} from './domain.js';
import {CONFIG} from './config.js';
const KEY='bn2026-admin-session';
// Session tokens stay in this tab only, not localStorage.
export function session(){try{return JSON.parse(storage.getItem(KEY)||'null');}catch{return null;}}
export function saveSession(value){storage.setItem(KEY,JSON.stringify({...value,expires_at:Date.now()+value.expires_in*1000}));}
export function clearSession(){storage.removeItem(KEY);}
async function currentToken(){
 let s=session(); if(!s) return null;
 if(s.expires_at<Date.now()+60000){
  try{
   const r=await fetch(CONFIG.authUrl+'/token?grant_type=refresh_token',{method:'POST',headers:{'apikey':CONFIG.anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token}),signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error();s=await r.json();saveSession(s);
  }catch{clearSession();throw new Error('La sesi\u00f3n venci\u00f3. Ingresa nuevamente.');}
 }
 return s.access_token;
}
export async function api(action,body={},privateCall=false){
 const token=privateCall?await currentToken():null;
 if(privateCall&&!token)throw new Error('Debes iniciar sesi\u00f3n como administrador.');
 const r=await fetch(CONFIG.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':CONFIG.anonKey,...(token?{'Authorization':'Bearer '+token}:{})},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(25000)});
 const data=await r.json().catch(()=>({error:'Respuesta no v\u00e1lida del servidor.'}));
 if(!r.ok)throw new Error(data.error||'No fue posible completar la solicitud.');
 return data;
}
export async function login(username,password){
 const result=await api('login',{username,password});saveSession(result);return result;
}
export async function logout(){
 const token=session()?.access_token;clearSession();
 if(token)await fetch(CONFIG.authUrl+'/logout',{method:'POST',headers:{apikey:CONFIG.anonKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)}).catch(()=>{});
}
export async function openCheckout(sessionId,test,onChange){
 if(!window.ePayco){
  await new Promise((resolve,reject)=>{
   const s=document.createElement('script');s.src='https://checkout.epayco.co/checkout-v2.js';
   s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('No carg\u00f3 ePayco. Revisa tu conexi\u00f3n e intenta otra vez.'));};document.head.append(s);
  });
 }
 const checkout=window.ePayco.checkout.configure({sessionId,type:'onpage',test});
 checkout.setHooks({onResponse:onChange,onClosed:onChange,onErrors:()=>onChange({error:true})});
 checkout.open();
}
