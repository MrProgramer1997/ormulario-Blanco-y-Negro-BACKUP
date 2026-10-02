import {writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const BASE = 'https://cmrydhzpcuklfvigboka.supabase.co/functions/v1/';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Public diagnostics only: no credentials, login, reservation or payment creation. */
export async function verifyDeployment(fetcher = fetch) {
  const cases = [
    {name:'Catalogo de ensayo: 45 mesas, entorno test, sin datos personales',endpoint:'bn2026-api',body:{action:'catalog'},status:200,
     check:data=>data?.mode==='test' && Array.isArray(data.tables) && data.tables.length===45 && new Set(data.tables.map(t=>t.number)).size===45 && data.tables.every(t=>Number.isInteger(t.number)&&t.number>=1&&t.number<=45&&Object.keys(t).every(k=>['number','zone','capacity','status'].includes(k)))},
    {name:'Administrador inaccesible sin iniciar sesion',endpoint:'bn2026-api',body:{action:'admin'},status:401},
    {name:'Checkout rechaza usuarios sin sesion',endpoint:'bn2026-api',body:{action:'checkout'},status:401},
    {name:'Webhook rechaza notificaciones sin firma',endpoint:'bn2026-webhook',body:{},status:400},
    {name:'Webhook rechaza firma de comprobacion invalida',endpoint:'bn2026-webhook',body:{x_ref_payco:'BN_DIAGNOSTIC_NO_PAYMENT',x_transaction_id:'NO_TRANSACTION',x_amount:'1000',x_currency_code:'COP',x_signature:'0'.repeat(64)},status:401},
  ];
  const results=[];
  for(const item of cases) {
    try {
      const r=await fetcher(BASE+item.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.body),signal:AbortSignal.timeout(20000),redirect:'error'});
      const data=await r.json().catch(()=>null);
      results.push({name:item.name,ok:r.status===item.status&&(!item.check||item.check(data)),status:r.status});
    } catch {
      // Do not include raw responses/errors, which might contain sensitive data.
      results.push({name:item.name,ok:false,status:0});
    }
  }
  return results;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  verifyDeployment().then(checks=>{
    const report={date:new Date().toISOString(),checks,paymentExecuted:false,epaycoCredentialsValidated:false};
    writeFileSync(resolve(ROOT,'RESULTADO-DESPLIEGUE.json'),JSON.stringify(report,null,2)+'\n');
    for(const result of checks) console.log((result.ok?'[OK] ':'[REVISAR] ')+result.name+' - HTTP '+result.status);
    console.log('Informe guardado: RESULTADO-DESPLIEGUE.json. No contiene credenciales.');
    console.log('No se ha probado una transaccion ePayco.');
    if(checks.some(r=>!r.ok))process.exitCode=2;
  }).catch(()=>{console.error('No se pudo completar la verificacion.');process.exitCode=1;});
}
