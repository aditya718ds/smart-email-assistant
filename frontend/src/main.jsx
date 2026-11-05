import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const samples = {
  Meeting: 'Hi,\n\nCould we schedule a meeting next week to discuss the project timeline and upcoming milestones? Please share your availability and any topics you would like to cover.\n\nBest,\nPriya',
  Interview: 'Hello,\n\nThank you for your application for the software developer position. We would like to invite you to an interview. Could you share your availability this week?\n\nRegards,\nThe recruitment team',
  Support: 'Hello,\n\nI am having a problem with my recent order. The item I received is different from the one I ordered. Could you help me resolve this issue?\n\nThanks,\nAlex'
};
function Icon({kind, ...props}) {
  const paths = {spark:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z', mail:'M3 5h18v14H3V5Zm0 1 9 7 9-7', copy:'M8 8h12v13H8V8ZM4 16H2V2h13v3', arrow:'M4 12h16m-6-6 6 6-6 6', check:'m5 12 4 4L19 6', down:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4'};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[kind] || paths.spark}/></svg>;
}
function App() {
  const [status, setStatus] = useState(null), [email, setEmail] = useState(''), [tone, setTone] = useState('professional');
  const [instructions, setInstructions] = useState(''), [name, setName] = useState(''), [reply, setReply] = useState('');
  const [resultMode, setResultMode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  useEffect(() => { fetch('/api/status').then(r => {if (!r.ok) throw Error(); return r.json();}).then(setStatus).catch(() => setError('Cannot reach the backend. Start START.bat and refresh this page.')); }, []);
  async function generate(e) {
    e.preventDefault(); if (busy) return;
    setError(''); setBusy(true); setCopied(false); setReply('');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch('/api/email/generate', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({emailContent:email, tone, instructions, senderName:name}), signal:controller.signal});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Generation failed. Please retry.');
      setReply(result.reply); setResultMode(result.mode);
    } catch(e) {setError(e.name === 'AbortError' ? 'The request timed out. Please try again.' : e.message || 'Cannot connect to the app.');}
    finally {clearTimeout(timer); setBusy(false);}
  }
  async function copy() {try {await navigator.clipboard.writeText(reply); setCopied(true); setTimeout(()=>setCopied(false),2200);} catch {setError('Clipboard access failed. Select and copy the reply manually.');}}
  function download() {const url=URL.createObjectURL(new Blob([reply],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='email-reply.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function clear() {setEmail('');setInstructions('');setName('');setTone('professional');setReply('');setError('');setCopied(false);}
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/"><span className="brand-mark"><Icon kind="spark"/></span><span>Smart<span className="brand-light">mail</span><small>EMAIL ASSISTANT</small></span></a>
      <div className="workspace-label">YOUR WORKSPACE</div><div className="nav-active"><Icon kind="mail"/> Reply studio <span>01</span></div>
      <div className="side-note"><span className="tiny-star">✦</span><h3>A little help.<br/>A better reply.</h3><p>Turn the email in front of you into a thoughtful response.</p></div>
      <div className="sidebar-bottom"><span className="local-dot"/> Runs on your computer<small>Spring Boot · React · Gemini</small></div>
    </aside>
    <main><header className="topbar"><span>Workspace <span className="slash">/</span> <strong>Reply studio</strong></span><span className="status-pill"><i className={status ? 'online' : ''}/>{status ? status.mode === 'demo' ? 'Offline demo' : status.configured ? 'Gemini configured' : 'API key needed' : 'Connecting…'}</span></header>
      <div className="page"><div className="intro"><div><div className="eyebrow">LESS WRITING. MORE CONNECTING.</div><h1>Your next reply,<br/><em>beautifully written.</em></h1><p>Give your words a head start. Add an email, pick a tone,<br className="desktop-break"/> and make the reply your own.</p></div><div className="intro-stamp"><Icon kind="mail"/><span>Thoughtful replies.<br/>In a few clicks.</span></div></div>
        {status?.mode === 'demo' && <div className="notice"><span className="notice-icon">i</span><p><strong>You’re in demo mode.</strong> Replies use offline templates, not AI. Add your Gemini key in <code>config.properties</code> and switch to <code>gemini</code> for intelligent replies.</p></div>}
        {status?.mode === 'gemini' && <div className="notice live-notice"><span className="notice-icon">i</span><p>Generating a reply sends the email and your instructions to Google Gemini. Model: <strong>{status.model}</strong>.</p></div>}
        <form onSubmit={generate}><div className="studio-grid"><section className="card input-card"><div className="card-title"><div><span className="step">01</span><h2>The original email</h2></div><button type="button" className="text-button" disabled={busy} onClick={clear}>Clear all</button></div>
          <label htmlFor="email" className="sr-only">Original email</label><textarea id="email" className="email-input" required maxLength={20000} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} placeholder={'Paste the email you want to reply to…\n\nThe more context you share, the better the reply.'}/>
          <div className="input-footer"><span>Try an example</span><div className="samples">{Object.keys(samples).map(x=><button key={x} type="button" disabled={busy} onClick={()=>{setEmail(samples[x]);setReply('');setError('');}}>{x}</button>)}</div><small>{email.length.toLocaleString()} / 20,000</small></div>
          <div className="preferences"><div className="field-heading"><label>Choose your tone</label><span>How should it sound?</span></div><div className="tone-group">{[['professional','Professional','Clear & polished'],['friendly','Friendly','Warm & welcoming'],['casual','Casual','Easy & relaxed']].map(([value,title,sub])=><button key={value} type="button" disabled={busy} className={'tone '+(tone===value?'selected':'')} aria-pressed={tone===value} onClick={()=>setTone(value)}><span>{title}{tone===value&&<Icon kind="check"/>}</span><small>{sub}</small></button>)}</div>
            <label htmlFor="instructions">Anything to include? <span className="optional">Optional</span></label><textarea id="instructions" className="instructions" maxLength={2000} value={instructions} onChange={e=>setInstructions(e.target.value)} disabled={busy} placeholder="e.g. Thank them and ask for the meeting agenda"/>
            <label htmlFor="name">Sign off as <span className="optional">Optional</span></label><input id="name" maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy} placeholder="Your name"/>
            <button className="generate" disabled={busy||!email.trim()||!status||!status.configured} type="submit">{busy?<span className="spinner"/>:<Icon kind="spark"/>}{busy?'Writing your reply…':status?.mode === 'demo'?'Generate demo reply':'Generate AI reply'}{!busy&&<Icon kind="arrow"/>}</button>
          </div></section>
          <section className="card result-card"><div className="card-title"><div><span className="step">02</span><h2>Your reply</h2></div><span className="draft-tag">DRAFT</span></div>
            {reply ? <div className="reply-result"><div className="result-meta"><span className="result-dot"/>{resultMode==='demo'?'Offline template · edit placeholders':'Generated with Gemini'}<span>Editable</span></div><label htmlFor="reply" className="sr-only">Generated reply</label><textarea id="reply" className="reply-editor" value={reply} onChange={e=>setReply(e.target.value)}/><div className="result-actions"><button type="button" className="copy-button" onClick={copy}><Icon kind={copied?'check':'copy'}/>{copied?'Copied!':'Copy reply'}</button><button type="button" className="download-button" onClick={download} title="Download reply"><Icon kind="down"/> Save .txt</button></div></div> : <div className={'empty-result '+(busy?'writing':'')}><div className="empty-icon"><Icon kind="spark"/></div><h3>{busy?'Finding the right words…':'Good replies start here.'}</h3><p>{busy?'Your draft will appear in a moment.':'Your generated reply will appear here,\nready for your finishing touches.'}</p><div className="placeholder-lines"><i/><i/><i/></div></div>}
            <div className="review-note"><Icon kind="check"/><p>Always review before sending. Your reply stays a draft until you use it.</p></div>
          </section></div>
        {error&&<div className="error" role="alert">{error}</div>}</form>
        <footer className="page-footer"><span>Made for a more human inbox.</span><span>No email history is saved by this app.</span></footer>
      </div></main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
