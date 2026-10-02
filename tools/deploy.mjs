import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {verifyDeployment} from './verify.mjs';

export const PROJECT = 'cmrydhzpcuklfvigboka';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMMANDS = Object.freeze([
  ['login'],
  ['functions', 'deploy', 'bn2026-api', '--project-ref', PROJECT, '--use-api'],
  ['functions', 'deploy', 'bn2026-webhook', '--project-ref', PROJECT, '--use-api'],
]);

export function assertNode(version = process.versions.node) {
  if (Number(version.split('.')[0]) < 20) {
    throw new Error('Se necesita Node.js 20 o superior. Instala una version LTS y vuelve a abrir este archivo.');
  }
}

export function validatePackage(root = ROOT) {
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  if (!config.includes(`project_id = "${PROJECT}"`)) throw new Error('El proyecto configurado no coincide. No se desplego nada.');
  const hashes = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  for (const [path, expected] of Object.entries(hashes)) {
    if (!/^(supabase|tools)\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) throw new Error('Ruta de manifiesto no valida.');
    const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
    if (actual !== expected) throw new Error('Archivo alterado o incompleto: ' + path + '. Extrae nuevamente el ZIP.');
  }
}

export function runCli(args, options = {}) {
  const spawn = options.spawn ?? spawnSync;
  const platform = options.platform ?? process.platform;
  // Arguments are internal constants, not user input. Windows needs cmd for npx.cmd.
  const result = spawn('npx', ['--yes', 'supabase@2', ...args], {
    cwd: ROOT, stdio: 'inherit', shell: platform === 'win32',
  });
  if (result.error) throw new Error('No se pudo ejecutar npx. Comprueba Node.js, npm y la conexion a Internet.');
  if (result.status !== 0) throw new Error('Supabase detuvo el paso: ' + args.slice(0, 3).join(' ') + '. No se ejecutaron los pasos siguientes.');
}

export function deploySequence(run = runCli) {
  for (const args of COMMANDS) run([...args]);
}

async function main() {
  assertNode(); validatePackage();
  console.log('\nFiesta Blanco y Negro - DESPLIEGUE DE PRUEBAS');
  console.log('Proyecto: Formulario Fiesta Blanco y Negro (' + PROJECT + ')');
  console.log('Publicara solamente bn2026-api y bn2026-webhook.');
  console.log('No cambia GitHub, la interfaz, las tablas, los secretos ni las URL generales de ePayco.');
  console.log('No inicia pagos. No necesitas ejecutar como administrador de Windows.');
  console.log('npx descargara la CLI oficial de Supabase 2.x si no esta disponible.');
  console.log('Autoriza el login en el navegador. No pegues llaves de ePayco en esta ventana.\n');
  const rl = createInterface({input:process.stdin, output:process.stdout});
  const answer = (await rl.question('Continuar con el despliegue? [S/N]: ')).trim().toLowerCase();
  rl.close();
  if (!['s','si','y','yes'].includes(answer)) { console.log('Cancelado. No se desplego nada.'); return; }
  writeFileSync(resolve(ROOT,'RESULTADO-DESPLIEGUE.json'),JSON.stringify({date:new Date().toISOString(),project:PROJECT,deploymentCommandsCompleted:false,paymentExecuted:false,epaycoCredentialsValidated:false},null,2)+'\n');
  deploySequence();
  console.log('\nLos dos comandos finalizaron. Comprobando endpoints sin crear reservas ni pagos...');
  const results = await verifyDeployment();
  const report = {date:new Date().toISOString(),project:PROJECT,deploymentCommandsCompleted:true,checks:results,paymentExecuted:false,epaycoCredentialsValidated:false};
  writeFileSync(resolve(ROOT,'RESULTADO-DESPLIEGUE.json'),JSON.stringify(report,null,2)+'\n');
  for(const result of results) console.log((result.ok ? '[OK] ' : '[REVISAR] ') + result.name + ' - HTTP ' + result.status);
  console.log('\nComparte RESULTADO-DESPLIEGUE.json: no contiene llaves, tokens ni datos personales.');
  console.log('Esto NO certifica un pago ePayco. Falta habilitar el administrador y probar el Checkout.');
  if(results.some(r=>!r.ok)) {console.log('No actives el formulario conectado todavia.');process.exitCode=2;}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error('\nNO COMPLETADO: ' + error.message);process.exitCode=1;});
}
