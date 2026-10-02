import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../revision-2026/js/appearance.js',import.meta.url),'utf8');
function setup(saved=null, unavailable=false){
  const handlers={},writes=[],attrs={};
  const button={innerHTML:'',title:'',setAttribute(k,v){attrs[k]=v;}};
  const root={dataset:{}};
  const document={documentElement:root,addEventListener(k,f){handlers[k]=f;},querySelectorAll(){return [button];}};
  const localStorage={getItem(){if(unavailable)throw new Error('Unavailable');return saved;},setItem(k,v){if(unavailable)throw new Error('Unavailable');writes.push([k,v]);}};
  vm.runInNewContext(script,{document,localStorage});
  handlers.DOMContentLoaded();
  return {root,button,writes,attrs,click(target=true){handlers.click({target:{closest(){return target?button:null;}}});}};
}
test('Appearance starts in light mode when no preference is stored',()=>{assert.equal(setup().root.dataset.theme,'light');});
test('Appearance restores an explicitly saved dark preference',()=>{assert.equal(setup('dark').root.dataset.theme,'dark');});
test('Theme toggle updates both presentation and accessible label',()=>{const s=setup();s.click();assert.equal(s.root.dataset.theme,'dark');assert.equal(s.attrs['aria-label'],'Activar modo claro');s.click();assert.equal(s.root.dataset.theme,'light');assert.equal(s.attrs['aria-label'],'Activar modo oscuro');});
test('Only the appearance preference is written to storage',()=>{const s=setup();s.click();assert.deepEqual(s.writes,[['bn2026-ui-theme','dark']]);});
test('Blocked browser storage does not break the appearance toggle',()=>{const s=setup(null,true);s.click();assert.equal(s.root.dataset.theme,'dark');});
test('Unexpected preferences and unrelated clicks do not change theme',()=>{const s=setup('untrusted');s.click(false);assert.equal(s.root.dataset.theme,'light');assert.equal(s.writes.length,0);});
