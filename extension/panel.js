// Build the UI with DOM methods so Gmail's Trusted Types policy cannot block it.
export function createPanel(root, editor = null, original = '') {
  const doc = root.ownerDocument;
  const make = (tag, attrs = {}, children = []) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  };
  const style = make('style', {text: `
    :host{all:initial;color-scheme:light}*{box-sizing:border-box}section{font:13px/1.55 'Segoe UI',Arial,sans-serif;color:#35313f;background:#faf8ff;border:1px solid #dcd3ef;border-radius:12px;padding:20px;width:100%;max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 12px 40px #27203030}h2{font-size:17px;margin:0}p{margin:6px 0 10px;font-size:11px}label{display:block;font-size:11px;font-weight:600;margin-top:10px}textarea,input,select,button{font:12px 'Segoe UI',Arial,sans-serif}textarea,input,select{display:block;width:100%;padding:9px;border:1px solid #dcd6e7;border-radius:6px;background:white;color:#383140;margin:5px 0}textarea{height:95px;resize:vertical}.notes{height:58px}.draft{height:155px}button{border:1px solid #d5cbe6;border-radius:6px;padding:9px 13px;background:#fff;color:#6e568e;cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #9a78d0;outline-offset:2px}button.primary{background:#8065aa;color:#fff;border-color:#8065aa}button:disabled{opacity:.55;cursor:wait}.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.error{color:#a43b3b;white-space:pre-wrap}.row{display:flex;gap:10px}.row>label{flex:1}.status{color:#806a99}small{font-size:10px;color:#887c96}[hidden]{display:none!important}
  `});
  const email = make('textarea', {class:'email', maxlength:'20000', placeholder:'Paste the email you want to answer'});
  email.value = original;
  const tone = make('select', {class:'tone'}, ['professional','friendly','casual'].map(value => make('option', {value, text:value[0].toUpperCase()+value.slice(1)})));
  const name = make('input', {class:'name', maxlength:'80', placeholder:'Your name (optional)'});
  const notes = make('textarea', {class:'notes', maxlength:'2000', placeholder:'Optional points to include'});
  const status = make('p', {class:'status',role:'status',text:'Checking local app…'});
  const error = make('p', {class:'error',role:'alert'});
  const generate = make('button', {type:'button',class:'primary generate',text:'Generate reply'});
  generate.disabled = true;
  const close = make('button', {type:'button',class:'close',text:editor?'Close':'Clear'});
  const draft = make('textarea', {class:'draft'});
  const insert = make('button', {type:'button',class:'primary insert',text:'Insert into empty draft'});
  insert.hidden = !editor;
  const copy = make('button', {type:'button',class:'copy',text:'Copy reply'});
  const result = make('div', {class:'result'}, [
    make('label', {text:'Draft reply — edit before using'}, [draft]),
    make('div', {class:'actions'}, [insert,copy]),
    make('small', {text:'Review the draft before sending it yourself.'})
  ]);
  result.hidden = true;
  const section = make('section', editor?{role:'dialog','aria-modal':'true','aria-label':'Smartmail reply assistant'}:{}, [
    make('h2',{text:'✦ Smartmail reply assistant'}), status,
    make('label',{text:'Original email — review the selected context'},[email]),
    make('div',{class:'row'},[make('label',{text:'Tone'},[tone]),make('label',{text:'Sign off as'},[name])]),
    make('label',{text:'Reply instructions'},[notes]),
    make('small',{text:'In Gemini mode, Generate sends the email and instructions to Google Gemini.'}),
    make('div',{class:'actions'},[generate,close]), error, result
  ]);
  root.replaceChildren(style,section);
  let busy = false;
  const message = (payload, timeout) => new Promise((resolve,reject) => {
    const timer = setTimeout(()=>reject(Error('The local app did not respond. Check START.bat and retry.')),timeout);
    try {
      Promise.resolve(chrome.runtime.sendMessage(payload)).then(value=>{clearTimeout(timer);resolve(value);},err=>{clearTimeout(timer);reject(err);});
    } catch(err) {clearTimeout(timer);reject(err);}
  });
  close.onclick = () => {
    if(editor) root.host.remove();
    else {email.value='';draft.value='';notes.value='';name.value='';result.hidden=true;error.textContent='';}
  };
  message({action:'status'},12000).then(response=>{
    if(!response?.ok) throw Error(response?.error || 'Start START.bat first.');
    status.textContent=response.data.mode==='demo'?'Offline demo · templates, not AI. Replace bracketed placeholders.':`Connected to Gemini · ${response.data.model}`;
    generate.disabled=!response.data.configured;
    if(!response.data.configured) error.textContent='Add your Gemini key to config.properties and restart START.bat.';
  }).catch(err=>{status.textContent='Connection needs attention';error.textContent=err.message;});
  generate.onclick = async () => {
    if(busy) return;
    if(!email.value.trim()){error.textContent='Paste or select the original email first.';return;}
    busy=true;generate.disabled=true;generate.textContent='Generating…';error.textContent='';result.hidden=true;
    try {
      const response=await message({action:'generate',payload:{emailContent:email.value,tone:tone.value,senderName:name.value,instructions:notes.value}},55000);
      if(!response?.ok) throw Error(response?.error || 'The extension was disconnected. Reload Gmail.');
      draft.value=response.data.reply;result.hidden=false;status.textContent=response.data.mode==='demo'?'Offline template ready':'Gemini reply ready — review before inserting';
      draft.focus();
    } catch(err){error.textContent=err.message;}
    finally {busy=false;generate.disabled=false;generate.textContent='Generate reply';}
  };
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(draft.value);status.textContent='Reply copied.';}catch{error.textContent='Select and copy the draft manually.';}};
  insert.onclick=()=>{
    if(!editor?.isConnected){error.textContent='This draft was closed. Open a reply and try again.';return;}
    if((editor.innerText ?? editor.textContent).trim()){error.textContent='Your draft already contains text or a signature. Copy the reply and paste it where you want; existing text was preserved.';return;}
    if(!draft.value.trim())return;
    editor.focus();
    const range=doc.createRange();range.selectNodeContents(editor);range.collapse(false);
    const selection=doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);
    if(!doc.execCommand || !doc.execCommand('insertText',false,draft.value)) {
      editor.textContent=draft.value;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:draft.value}));
    }
    root.host.remove();
  };
  return section;
}
