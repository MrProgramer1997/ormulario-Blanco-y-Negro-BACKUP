import {CONFIG} from './config.js';import {api} from './api.js';import {money,escapeHTML as e,storage} from './domain.js';
const $=id=>document.getElementById(id);
let ticket=null;try{ticket=JSON.parse(storage.getItem('bn2026-last-payment')||'null');}catch{}
const id=new URLSearchParams(location.search).get('id');let running=false,attempts=0,timer=null;
const states={confirmed:['Pago de prueba confirmado','La simulaci\u00f3n fue validada. Esta reserva pertenece al inventario de pruebas, no al evento comercial.'],held:['Solicitud creada','Todav\u00eda no hay un pago aprobado.'],opening:['Pago en preparaci\u00f3n','Consulta nuevamente en unos segundos. No inicies otro pago.'],payment_pending:['Esperando confirmaci\u00f3n','El pago a\u00fan no est\u00e1 confirmado. Actualizaremos el estado cuando ePayco notifique el resultado.'],declined:['Pago rechazado','No se ha confirmado la reserva. Consulta con Eventos antes de repetir una operaci\u00f3n.'],expired:['Solicitud vencida','Esta solicitud no confirma una reserva.'],review:['Revisi\u00f3n necesaria','Eventos debe verificar esta operaci\u00f3n. No vuelvas a pagar ni asumas que la mesa est\u00e1 confirmada.']};
async function check(){
 if(running)return;
 if(CONFIG.preview && ticket?.lab!==true){$('result-title').textContent='Vista previa sin pagos';$('result-message').textContent='No hay una transacci\u00f3n real que consultar en la demostraci\u00f3n.';$('check-status').disabled=true;return;}
 if(!ticket||ticket.id!==id){$('result-title').textContent='Necesitamos verificar tu solicitud';$('result-message').textContent='Abre esta p\u00e1gina desde la misma pesta\u00f1a donde iniciaste el pago. Por seguridad no mostramos estados privados usando solo una referencia en la direcci\u00f3n.';$('check-status').disabled=true;return;}
 running=true;$('check-status').disabled=true;
 try{const r=await api('status',{id,token:ticket.token});const text=states[r.status]||states.review;$('result-title').textContent=text[0];$('result-message').textContent=text[1];$('result-details').innerHTML=`<div class="review-block" style="margin-top:20px"><p>Referencia: <strong>${e(r.invoice)}</strong></p><p>Mesa de ensayo: ${r.table_number}</p><p>Valor: ${money(r.amount)}</p></div>`;
 if(['confirmed','declined','expired','review'].includes(r.status))clearInterval(timer);
 }catch(err){$('result-title').textContent='La verificaci\u00f3n sigue pendiente';$('result-message').textContent=err.message;}
 finally{running=false;$('check-status').disabled=false;attempts++;if(attempts>=120)clearInterval(timer);}
}
$('check-status').addEventListener('click',check);check();if(!CONFIG.preview || ticket?.lab===true)timer=setInterval(()=>{if(!document.hidden)check();},5000);

if(ticket?.lab===true){document.querySelectorAll('a[href="index.html"]').forEach(a=>{a.href='pruebas-pago.html';if(a.classList.contains('text-button'))a.textContent='Volver al laboratorio';});}
