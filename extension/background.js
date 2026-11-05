const API = 'http://127.0.0.1:8080';
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !['status','generate'].includes(message?.action)) return false;
  (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch(API + (message.action === 'status' ? '/api/status' : '/api/email/generate'), {
        method: message.action === 'status' ? 'GET' : 'POST',
        ...(message.action === 'generate' ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(message.payload)} : {}),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not generate a reply.');
      sendResponse({ok:true,data});
    } catch(e) {
      sendResponse({ok:false,error:e.name==='AbortError'?'The request timed out. Try again.':e.message==='Failed to fetch'?'Start START.bat first. The local app must run on port 8080.':e.message});
    } finally {clearTimeout(timer);}
  })();
  return true;
});
