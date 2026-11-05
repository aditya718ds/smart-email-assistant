import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = (await readFile(new URL('../../extension/panel.js', import.meta.url), 'utf8')).replace('export function createPanel','function createPanel');
function fixture(existing='') {
  const dom=new JSDOM('<div id="host"></div><div id="editor" contenteditable="true"></div>',{runScripts:'outside-only',url:'https://mail.google.com/'});
  const {window}=dom;
  const editor=window.document.getElementById('editor');editor.innerText=existing;
  const calls=[];
  window.chrome={runtime:{sendMessage:async message=>{calls.push(message);return message.action==='status'?{ok:true,data:{mode:'demo',configured:true}}:{ok:true,data:{reply:'Hello,\n\nTest draft',mode:'demo'}};}}};
  window.eval(source+';window.createPanel=createPanel;');
  const root=window.document.getElementById('host').attachShadow({mode:'open'});
  window.createPanel(root,editor,'Can we schedule a meeting?');
  return {dom,window,editor,root,calls};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('generating requires user action and uses reviewed context and chosen tone',async()=>{
  const f=fixture();await flush();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'status');
  f.root.querySelector('.email').value='Reviewed email context';f.root.querySelector('.tone').value='friendly';
  await f.root.querySelector('.generate').onclick();
  assert.equal(f.calls[1].payload.emailContent,'Reviewed email context');assert.equal(f.calls[1].payload.tone,'friendly');
  assert.equal(f.root.querySelector('.draft').value,'Hello,\n\nTest draft');assert.equal(f.editor.innerText,'');f.dom.window.close();
});
test('does not overwrite an existing Gmail draft or signature',async()=>{
  const f=fixture('My existing signature');await flush();await f.root.querySelector('.generate').onclick();
  f.root.querySelector('.insert').onclick();assert.equal(f.editor.innerText,'My existing signature');
  assert.match(f.root.querySelector('.error').textContent,/already contains/);assert.equal(f.root.host.isConnected,true);f.dom.window.close();
});
test('blank input never calls generation API',async()=>{
  const f=fixture();await flush();f.root.querySelector('.email').value='  ';await f.root.querySelector('.generate').onclick();
  assert.equal(f.calls.length,1);assert.match(f.root.querySelector('.error').textContent,/original email/);f.dom.window.close();
});
test('provider text is handled as plain text rather than injected HTML',async()=>{
  const f=fixture();await flush();f.window.chrome.runtime.sendMessage=async()=>({ok:true,data:{reply:'<img src=x onerror=alert(1)>',mode:'demo'}});
  await f.root.querySelector('.generate').onclick();assert.equal(f.root.querySelector('.draft').value,'<img src=x onerror=alert(1)>');assert.equal(f.root.querySelectorAll('img').length,0);f.dom.window.close();
});
test('closed compose window prevents insertion',async()=>{
  const f=fixture();await flush();await f.root.querySelector('.generate').onclick();f.editor.remove();f.root.querySelector('.insert').onclick();
  assert.match(f.root.querySelector('.error').textContent,/was closed/);f.dom.window.close();
});
test('manifest limits permissions to Gmail and the local backend',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../extension/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:8080/*']);
  assert.deepEqual(manifest.content_scripts[0].matches,['https://mail.google.com/*']);assert.equal(manifest.permissions,undefined);
});

async function contentFixture() {
  const dom=new JSDOM('<main role="main"><div class="a3s">Please send the meeting agenda.</div><div id="compose" role="region"><div role="textbox" contenteditable="true" g_editable="true"></div></div></main>',{runScripts:'outside-only',url:'https://mail.google.com/'});
  const {window}=dom;
  window.HTMLElement.prototype.getClientRects=function(){return [{width:100,height:30}];};
  window.chrome={runtime:{sendMessage:async message=>message.action==='status'?{ok:true,data:{mode:'gemini',configured:true,model:'test-model'}}:{ok:true,data:{reply:'A real draft preview',mode:'gemini'}}}};
  // Simulate Gmail's restrictive HTML sink and editor event handling.
  const descriptor=Object.getOwnPropertyDescriptor(window.Element.prototype,'innerHTML');
  Object.defineProperty(window.Element.prototype,'innerHTML',{...descriptor,set(){throw Error('TrustedHTML is required');}});
  window.document.addEventListener('click',event=>event.stopImmediatePropagation(),true);
  window.eval(await readFile(new URL('../../extension/content.js',import.meta.url),'utf8'));
  return {dom,window};
}
test('AI Reply opens despite Gmail capture handlers and Trusted Types restrictions',async()=>{
  const f=await contentFixture();
  const host=f.window.document.querySelector('[data-smartmail-launcher]');assert.ok(host);
  assert.equal(host.getAttribute('contenteditable'),'false');assert.equal(host.shadowRoot.querySelector('button').type,'button');
  host.shadowRoot.querySelector('button').click();await flush();
  const modal=f.window.document.querySelector('[data-smartmail-modal]');assert.ok(modal);
  assert.equal(modal.parentElement,f.window.document.body);
  assert.equal(modal.shadowRoot.querySelector('.email').value,'Please send the meeting agenda.');
  assert.equal(modal.shadowRoot.querySelector('.generate').disabled,false);
  f.dom.window.close();
});
test('Gmail preview generates and inserts only after the explicit Insert action',async()=>{
  const f=await contentFixture();const editor=f.window.document.querySelector('[g_editable]');
  f.window.document.querySelector('[data-smartmail-launcher]').shadowRoot.querySelector('button').click();await flush();
  const root=f.window.document.querySelector('[data-smartmail-modal]').shadowRoot;
  await root.querySelector('.generate').onclick();assert.equal(editor.textContent,'');
  assert.equal(root.querySelector('.draft').value,'A real draft preview');
  root.querySelector('.insert').onclick();assert.equal(editor.textContent,'A real draft preview');
  assert.equal(f.window.document.querySelector('[data-smartmail-modal]'),null);f.dom.window.close();
});
test('removed Gmail launch controls are reattached after a compose rerender',async()=>{
  const f=await contentFixture();f.window.document.querySelector('[data-smartmail-launcher]').remove();
  await new Promise(resolve=>setTimeout(resolve,220));
  assert.equal(f.window.document.querySelectorAll('[data-smartmail-launcher]').length,1);f.dom.window.close();
});
test('launcher is placed in the compose header without covering editable text',async()=>{
  const f=await contentFixture();const host=f.window.document.querySelector('[data-smartmail-launcher]');
  const editor=f.window.document.querySelector('[g_editable]');
  assert.equal(host.parentElement.id,'compose');assert.equal(host.style.position,'absolute');
  assert.equal(host.style.top,'8px');assert.equal(editor.contains(host),false);assert.equal(editor.textContent,'');f.dom.window.close();
});
