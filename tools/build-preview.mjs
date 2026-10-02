// Offline visual review only: bundles existing source without build dependencies.
// The deployable ES modules remain untouched in revision-2026/.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),web=path.join(root,'revision-2026');
const appearance=await readFile(path.join(web,'js/appearance.js'),'utf8');
const css=await readFile(path.join(web,'assets/app.css'),'utf8');
const image='data:image/webp;base64,'+(await readFile(path.join(web,'assets/plano-2026.webp'))).toString('base64');
const icon='data:image/svg+xml;base64,'+(await readFile(path.join(web,'assets/icon.svg'))).toString('base64');
async function build(source,entry,output){
 let html=await readFile(path.join(web,source),'utf8');
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
 html=html.replace('</head>',`<link rel="icon" href="${icon}"><style>${css}</style><script>${appearance.replaceAll('</script','<\\/script')}</script></head>`);
 const scripts=[];
 for(const file of ['config.js','domain.js','api.js','icons.js',entry]){
  let s=await readFile(path.join(web,'js',file),'utf8');
  s=s.replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?/g,'').replace(/\bexport\s+/g,'');
  if(file==='config.js')s=s.replace('preview: false','preview: true');
  s=s.replaceAll('assets/plano-2026.webp',image);
  scripts.push(s);if(file==='domain.js')scripts.push('const e=escapeHTML;');
 }
 let script=scripts.join('\n').replaceAll('</script','<\\/script');
 html=html.replace('</body>',`<script type="module">${script}</script></body>`);
 html=html.replaceAll('href="index.html','href="VISTA-PREVIA.html').replaceAll('href="admin.html','href="ADMIN-DEMO.html').replaceAll('href="assets/protocolo-original-2026.docx','href="revision-2026/assets/protocolo-original-2026.docx');
 await writeFile(path.join(root,output),html,'utf8');
}
await build('index.html','app.js','VISTA-PREVIA.html');await build('admin.html','admin.js','ADMIN-DEMO.html');
console.log('Vistas independientes generadas. No contienen llaves privadas.');
