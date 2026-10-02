import { EVENT } from './config.js';
export const money = value => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const blankPerson = () => ({firstName:'',lastName:'',action:'',docType:'CC',document:'',email:'',phone:''});
export function createDraft() {
 return {version:1,step:0,table:null,quantity:8,guests:0,responsibleAttends:true,responsibleType:'member',
  responsible:{firstName:'',lastName:'',email:'',phone:''},members:Array.from({length:10},blankPerson),
  visitors:Array.from({length:10},blankPerson),terms:false,remember:false};
}
export function setQuantity(draft, n) {
 if (![8,9,10].includes(n)) throw new RangeError('Cantidad no permitida');
 draft.quantity=n; draft.guests=Math.min(draft.guests,n);
 ensureResponsibleCount(draft); draft.terms=false;
 // Do not truncate the arrays: changing counts must never erase already entered data.
}
export function setGuests(draft,n) {
 if (!Number.isInteger(n) || n<0 || n>draft.quantity) return false;
 draft.guests=n; ensureResponsibleCount(draft); draft.terms=false; return true;
}
function ensureResponsibleCount(d) {
 if(!d.responsibleAttends) return;
 if(d.responsibleType==='member') d.guests=Math.min(d.guests,d.quantity-1);
 else d.guests=Math.max(d.guests,1);
}
export function syncResponsible(d) {
 ensureResponsibleCount(d);
 if(!d.responsibleAttends) return;
 const target=d.responsibleType==='member'?d.members[0]:d.visitors[0];
 target.firstName=d.responsible.firstName; target.lastName=d.responsible.lastName;
 if(d.responsibleType==='guest'){target.email=d.responsible.email;target.phone=d.responsible.phone;}
}
export function totals(d,prices=EVENT) {
 const members=d.quantity-d.guests, guests=d.guests;
 return {members,guests,memberTotal:members*prices.memberPrice,guestTotal:guests*prices.guestPrice,total:members*prices.memberPrice+guests*prices.guestPrice};
}
export const isEmail = s=>typeof s==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length<=254;
export const isPhone = s=>typeof s==='string' && /^\+?[0-9 ()-]{7,25}$/.test(s) && s.replace(/\D/g,'').length>=7;
export function personErrors(p,type) {
 const errors=[];
 if(!p.firstName?.trim()) errors.push('firstName');
 if(!p.lastName?.trim()) errors.push('lastName');
 if(type==='member'){if(!p.action?.trim()) errors.push('action');}
 else {
  if(!['CC','CE','PAS','OTRO'].includes(p.docType)) errors.push('docType');
  if(!/^[A-Za-z0-9. -]{4,30}$/.test(p.document||'')) errors.push('document');
  if(!isEmail(p.email)) errors.push('email');
  if(!isPhone(p.phone)) errors.push('phone');
 }
 return errors;
}
export function attendees(d) {
 return [...d.members.slice(0,d.quantity-d.guests).map((p,i)=>({...p,type:'member',index:i})),
 ...d.visitors.slice(0,d.guests).map((p,i)=>({...p,type:'guest',index:i}))];
}
export function duplicates(d){
 const seen=new Set();
 // Members can legitimately share an action number. Guest document numbers cannot repeat.
 return attendees(d).filter(p=>p.type==='guest').some(p=>{const key=p.docType+':'+p.document.replace(/[ .-]/g,'').toUpperCase();if(!p.document)return false;if(seen.has(key))return true;seen.add(key);return false;});
}
export function toPayload(d){
 return {table:d.table,quantity:d.quantity,responsible:{...d.responsible},
 attendees:attendees(d).map(({index,...p})=>p),acceptedTerms:d.terms};
}
export function csvCell(v){
 let text=String(v??'');
 if(/^[\s]*[=+@-]/.test(text)) text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
const volatileStore=new Map();
export const storage={
 getItem(k){try{return sessionStorage.getItem(k);}catch{return volatileStore.get(k)||null;}},
 setItem(k,v){try{sessionStorage.setItem(k,v);return true;}catch{volatileStore.set(k,String(v));return false;}},
 removeItem(k){try{sessionStorage.removeItem(k);}catch{}volatileStore.delete(k);}
};
export function requestUUID(){
 if(crypto.randomUUID)return crypto.randomUUID();
 return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
}
