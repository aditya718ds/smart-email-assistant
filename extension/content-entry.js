import {createPanel} from './panel.js';

// Bundled as content.js: no dynamic imports or HTML-string injection in Gmail.
if (!globalThis.__smartmailV110) {
  globalThis.__smartmailV110 = true;
  const mounts = new Map();
  let timer;
  let openModal;
  function selectedEmail(editor) {
    const selection=window.getSelection();
    if(selection?.toString().trim() && !editor.contains(selection.anchorNode)) return selection.toString().trim().slice(0,20000);
    const thread=editor.closest('.nH.if') || document.querySelector('[role="main"]');
    const messages=thread?Array.from(thread.querySelectorAll('.a3s')).filter(node=>node.getClientRects().length&&!node.contains(editor)&&!editor.contains(node)):[];
    return messages.length?(messages[messages.length-1].innerText ?? messages[messages.length-1].textContent).trim().slice(0,20000):'';
  }
  function showPanel(editor) {
    if(openModal?.isConnected){openModal.remove();openModal=null;return;}
    if(!editor.isConnected)return;
    const context=selectedEmail(editor);
    const modal=document.createElement('div');
    modal.dataset.smartmailModal='true';modal.setAttribute('contenteditable','false');
    modal.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;background:#17112666!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;pointer-events:auto!important';
    const root=modal.attachShadow({mode:'open'});
    document.body.append(modal);openModal=modal;
    try {createPanel(root,editor,context);}catch(error){const failure=document.createElement('p');failure.textContent='Smartmail could not open. Reload Gmail and try again.';failure.style.cssText='background:white;color:#a33;padding:25px';root.append(failure);console.error('Smartmail panel initialization failed:',error);}
    const section=root.querySelector('section');
    if(section)section.style.width='min(640px,calc(100vw - 36px))';
    modal.addEventListener('click',event=>{if(event.composedPath()[0]===modal)modal.remove();});
  }
  function ownButton(event) {
    return event.composedPath().find(node=>node instanceof HTMLElement&&node.dataset.smartmailLauncher==='true');
  }
  // Handle clicks before Gmail's editor handlers can consume them.
  window.addEventListener('click',event=>{
    const host=ownButton(event);if(!host)return;
    const editor=Array.from(mounts).find(([,value])=>value===host)?.[0];if(!editor)return;
    event.preventDefault();event.stopImmediatePropagation();showPanel(editor);
  },true);
  window.addEventListener('pointerdown',event=>{if(ownButton(event))event.stopImmediatePropagation();},true);
  function scan() {
    for(const [editor,host] of mounts)if(!editor.isConnected){host.remove();mounts.delete(editor);}
    for(const editor of document.querySelectorAll('[contenteditable="true"][role="textbox"][g_editable="true"]')) {
      if(!editor.getClientRects().length || mounts.get(editor)?.isConnected)continue;
      const host=document.createElement('div');host.dataset.smartmailLauncher='true';host.setAttribute('contenteditable','false');
      host.style.cssText='display:block!important;position:relative!important;z-index:2!important;margin:8px 0!important;pointer-events:auto!important';
      const root=host.attachShadow({mode:'open'});
      const button=document.createElement('button');button.type='button';button.textContent='✦ AI Reply';button.title='Open Smartmail reply assistant';
      button.style.cssText='all:initial;display:inline-block;font:12px Segoe UI,Arial;padding:10px 16px;background:#8065aa;color:white;border:0;border-radius:6px;cursor:pointer;pointer-events:auto';
      root.append(button);
      const compose=editor.closest('[role="region"], [role="dialog"]');
      if(compose&&!compose.isContentEditable){
        if(getComputedStyle(compose).position==='static')compose.style.position='relative';
        host.style.setProperty('position','absolute','important');
        host.style.setProperty('right','44px','important');
        host.style.setProperty('top','8px','important');
        host.style.setProperty('margin','0','important');
        compose.append(host);
      }else{
        let anchor=editor;
        while(anchor.parentElement?.isContentEditable)anchor=anchor.parentElement;
        anchor.parentElement.insertBefore(host,anchor);
      }
      mounts.set(editor,host);
    }
  }
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,150);}).observe(document.body,{childList:true,subtree:true});
  scan();
}
