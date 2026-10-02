/** Pure validation shared with automated server tests. Never trust a client total. */
export class InputError extends Error {}
export function text(v,name,max=100){if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new InputError('Revisa '+name+'.');return v.trim().normalize('NFC');}
export function email(v){const s=text(v,'el correo',254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new InputError('Correo no valido.');return s.toLowerCase();}
export function phone(v){const s=text(v,'el celular',25);if(!/^\+?[0-9 ()-]{7,25}$/.test(s)||s.replace(/\D/g,'').length<7)throw new InputError('Celular no valido.');return s;}
export function validateBooking(body){
 if(!body||typeof body!=='object')throw new InputError('Solicitud no valida.');
 if(!Number.isInteger(body.table)||body.table<1||body.table>45)throw new InputError('Mesa no valida.');
 if(![8,9,10].includes(body.quantity)||!Array.isArray(body.attendees)||body.attendees.length!==body.quantity)throw new InputError('Deben registrarse de 8 a 10 asistentes.');
 if(body.acceptedTerms!==true)throw new InputError('Debes aceptar las condiciones.');
 const r=body.responsible||{},seen=new Set();
 const attendees=body.attendees.map(p=>{
  if(!p||!['member','guest'].includes(p.type))throw new InputError('Tipo de asistente no valido.');
  const base={type:p.type,firstName:text(p.firstName,'los nombres',80),lastName:text(p.lastName,'los apellidos',80)};
  if(p.type==='member')return {...base,action:text(p.action,'el numero de accion',40)};
  if(!['CC','CE','PAS','OTRO'].includes(p.docType))throw new InputError('Tipo de documento no valido.');
  const doc=text(p.document,'el documento',30).replace(/[ .-]/g,'').toUpperCase();
  if(!/^[A-Z0-9]{4,30}$/.test(doc))throw new InputError('Documento no valido.');
  const key=p.docType+':'+doc;if(seen.has(key))throw new InputError('Documento de invitado repetido.');seen.add(key);
  return {...base,docType:p.docType,document:doc,email:email(p.email),phone:phone(p.phone)};
 });
 return {table:body.table,quantity:body.quantity,responsible:{firstName:text(r.firstName,'los nombres del responsable',80),lastName:text(r.lastName,'los apellidos del responsable',80),email:email(r.email),phone:phone(r.phone)},attendees,acceptedTerms:true};
}
export function uuid(v){return typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);}
export function amountCOP(value){
 const s=String(value);if(!/^(0|[1-9]\d{0,9})(\.00?)?$/.test(s))throw new InputError('Invalid amount');
 const n=Number(s);if(!Number.isSafeInteger(n)||n<=0)throw new InputError('Invalid amount');return n;
}
export function testFlag(v){if(v===true||v==='true'||v==='TRUE'||v===1||v==='1')return true;if(v===false||v==='false'||v==='FALSE'||v===0||v==='0')return false;throw new InputError('Missing test flag');}
export function paymentStatus(v){
 const s=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(['aceptada','aprobada','accepted','approved'].includes(s))return 'approved';
 if(['pendiente','pending'].includes(s))return 'pending';
 if(['rechazada','fallida','rejected','failed'].includes(s))return 'declined';
 return 'review';
}
