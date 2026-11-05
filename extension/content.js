(() => {
  // outputs/SmartEmailAssistant/extension/panel.js
  function createPanel(root, editor = null, original = "") {
    const doc = root.ownerDocument;
    const make = (tag, attrs = {}, children = []) => {
      const node = doc.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "text") node.textContent = value;
        else if (key === "class") node.className = value;
        else node.setAttribute(key, value);
      }
      for (const child of children) node.append(child);
      return node;
    };
    const style = make("style", { text: `
    :host{all:initial;color-scheme:light}*{box-sizing:border-box}section{font:13px/1.55 'Segoe UI',Arial,sans-serif;color:#35313f;background:#faf8ff;border:1px solid #dcd3ef;border-radius:12px;padding:20px;width:100%;max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 12px 40px #27203030}h2{font-size:17px;margin:0}p{margin:6px 0 10px;font-size:11px}label{display:block;font-size:11px;font-weight:600;margin-top:10px}textarea,input,select,button{font:12px 'Segoe UI',Arial,sans-serif}textarea,input,select{display:block;width:100%;padding:9px;border:1px solid #dcd6e7;border-radius:6px;background:white;color:#383140;margin:5px 0}textarea{height:95px;resize:vertical}.notes{height:58px}.draft{height:155px}button{border:1px solid #d5cbe6;border-radius:6px;padding:9px 13px;background:#fff;color:#6e568e;cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #9a78d0;outline-offset:2px}button.primary{background:#8065aa;color:#fff;border-color:#8065aa}button:disabled{opacity:.55;cursor:wait}.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.error{color:#a43b3b;white-space:pre-wrap}.row{display:flex;gap:10px}.row>label{flex:1}.status{color:#806a99}small{font-size:10px;color:#887c96}[hidden]{display:none!important}
  ` });
    const email = make("textarea", { class: "email", maxlength: "20000", placeholder: "Paste the email you want to answer" });
    email.value = original;
    const tone = make("select", { class: "tone" }, ["professional", "friendly", "casual"].map((value) => make("option", { value, text: value[0].toUpperCase() + value.slice(1) })));
    const name = make("input", { class: "name", maxlength: "80", placeholder: "Your name (optional)" });
    const notes = make("textarea", { class: "notes", maxlength: "2000", placeholder: "Optional points to include" });
    const status = make("p", { class: "status", role: "status", text: "Checking local app\u2026" });
    const error = make("p", { class: "error", role: "alert" });
    const generate = make("button", { type: "button", class: "primary generate", text: "Generate reply" });
    generate.disabled = true;
    const close = make("button", { type: "button", class: "close", text: editor ? "Close" : "Clear" });
    const draft = make("textarea", { class: "draft" });
    const insert = make("button", { type: "button", class: "primary insert", text: "Insert into empty draft" });
    insert.hidden = !editor;
    const copy = make("button", { type: "button", class: "copy", text: "Copy reply" });
    const result = make("div", { class: "result" }, [
      make("label", { text: "Draft reply \u2014 edit before using" }, [draft]),
      make("div", { class: "actions" }, [insert, copy]),
      make("small", { text: "Review the draft before sending it yourself." })
    ]);
    result.hidden = true;
    const section = make("section", editor ? { role: "dialog", "aria-modal": "true", "aria-label": "Smartmail reply assistant" } : {}, [
      make("h2", { text: "\u2726 Smartmail reply assistant" }),
      status,
      make("label", { text: "Original email \u2014 review the selected context" }, [email]),
      make("div", { class: "row" }, [make("label", { text: "Tone" }, [tone]), make("label", { text: "Sign off as" }, [name])]),
      make("label", { text: "Reply instructions" }, [notes]),
      make("small", { text: "In Gemini mode, Generate sends the email and instructions to Google Gemini." }),
      make("div", { class: "actions" }, [generate, close]),
      error,
      result
    ]);
    root.replaceChildren(style, section);
    let busy = false;
    const message = (payload, timeout) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("The local app did not respond. Check START.bat and retry.")), timeout);
      try {
        Promise.resolve(chrome.runtime.sendMessage(payload)).then((value) => {
          clearTimeout(timer);
          resolve(value);
        }, (err) => {
          clearTimeout(timer);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
    close.onclick = () => {
      if (editor) root.host.remove();
      else {
        email.value = "";
        draft.value = "";
        notes.value = "";
        name.value = "";
        result.hidden = true;
        error.textContent = "";
      }
    };
    message({ action: "status" }, 12e3).then((response) => {
      if (!response?.ok) throw Error(response?.error || "Start START.bat first.");
      status.textContent = response.data.mode === "demo" ? "Offline demo \xB7 templates, not AI. Replace bracketed placeholders." : `Connected to Gemini \xB7 ${response.data.model}`;
      generate.disabled = !response.data.configured;
      if (!response.data.configured) error.textContent = "Add your Gemini key to config.properties and restart START.bat.";
    }).catch((err) => {
      status.textContent = "Connection needs attention";
      error.textContent = err.message;
    });
    generate.onclick = async () => {
      if (busy) return;
      if (!email.value.trim()) {
        error.textContent = "Paste or select the original email first.";
        return;
      }
      busy = true;
      generate.disabled = true;
      generate.textContent = "Generating\u2026";
      error.textContent = "";
      result.hidden = true;
      try {
        const response = await message({ action: "generate", payload: { emailContent: email.value, tone: tone.value, senderName: name.value, instructions: notes.value } }, 55e3);
        if (!response?.ok) throw Error(response?.error || "The extension was disconnected. Reload Gmail.");
        draft.value = response.data.reply;
        result.hidden = false;
        status.textContent = response.data.mode === "demo" ? "Offline template ready" : "Gemini reply ready \u2014 review before inserting";
        draft.focus();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        busy = false;
        generate.disabled = false;
        generate.textContent = "Generate reply";
      }
    };
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(draft.value);
        status.textContent = "Reply copied.";
      } catch {
        error.textContent = "Select and copy the draft manually.";
      }
    };
    insert.onclick = () => {
      if (!editor?.isConnected) {
        error.textContent = "This draft was closed. Open a reply and try again.";
        return;
      }
      if ((editor.innerText ?? editor.textContent).trim()) {
        error.textContent = "Your draft already contains text or a signature. Copy the reply and paste it where you want; existing text was preserved.";
        return;
      }
      if (!draft.value.trim()) return;
      editor.focus();
      const range = doc.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = doc.defaultView.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!doc.execCommand || !doc.execCommand("insertText", false, draft.value)) {
        editor.textContent = draft.value;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: draft.value }));
      }
      root.host.remove();
    };
    return section;
  }

  // outputs/SmartEmailAssistant/extension/content-entry.js
  if (!globalThis.__smartmailV110) {
    let selectedEmail = function(editor) {
      const selection = window.getSelection();
      if (selection?.toString().trim() && !editor.contains(selection.anchorNode)) return selection.toString().trim().slice(0, 2e4);
      const thread = editor.closest(".nH.if") || document.querySelector('[role="main"]');
      const messages = thread ? Array.from(thread.querySelectorAll(".a3s")).filter((node) => node.getClientRects().length && !node.contains(editor) && !editor.contains(node)) : [];
      return messages.length ? (messages[messages.length - 1].innerText ?? messages[messages.length - 1].textContent).trim().slice(0, 2e4) : "";
    }, showPanel = function(editor) {
      if (openModal?.isConnected) {
        openModal.remove();
        openModal = null;
        return;
      }
      if (!editor.isConnected) return;
      const context = selectedEmail(editor);
      const modal = document.createElement("div");
      modal.dataset.smartmailModal = "true";
      modal.setAttribute("contenteditable", "false");
      modal.style.cssText = "position:fixed!important;inset:0!important;z-index:2147483647!important;background:#17112666!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;pointer-events:auto!important";
      const root = modal.attachShadow({ mode: "open" });
      document.body.append(modal);
      openModal = modal;
      try {
        createPanel(root, editor, context);
      } catch (error) {
        const failure = document.createElement("p");
        failure.textContent = "Smartmail could not open. Reload Gmail and try again.";
        failure.style.cssText = "background:white;color:#a33;padding:25px";
        root.append(failure);
        console.error("Smartmail panel initialization failed:", error);
      }
      const section = root.querySelector("section");
      if (section) section.style.width = "min(640px,calc(100vw - 36px))";
      modal.addEventListener("click", (event) => {
        if (event.composedPath()[0] === modal) modal.remove();
      });
    }, ownButton = function(event) {
      return event.composedPath().find((node) => node instanceof HTMLElement && node.dataset.smartmailLauncher === "true");
    }, scan = function() {
      for (const [editor, host] of mounts) if (!editor.isConnected) {
        host.remove();
        mounts.delete(editor);
      }
      for (const editor of document.querySelectorAll('[contenteditable="true"][role="textbox"][g_editable="true"]')) {
        if (!editor.getClientRects().length || mounts.get(editor)?.isConnected) continue;
        const host = document.createElement("div");
        host.dataset.smartmailLauncher = "true";
        host.setAttribute("contenteditable", "false");
        host.style.cssText = "display:block!important;position:relative!important;z-index:2!important;margin:8px 0!important;pointer-events:auto!important";
        const root = host.attachShadow({ mode: "open" });
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "\u2726 AI Reply";
        button.title = "Open Smartmail reply assistant";
        button.style.cssText = "all:initial;display:inline-block;font:12px Segoe UI,Arial;padding:10px 16px;background:#8065aa;color:white;border:0;border-radius:6px;cursor:pointer;pointer-events:auto";
        root.append(button);
        const compose = editor.closest('[role="region"], [role="dialog"]');
        if (compose && !compose.isContentEditable) {
          if (getComputedStyle(compose).position === "static") compose.style.position = "relative";
          host.style.setProperty("position", "absolute", "important");
          host.style.setProperty("right", "44px", "important");
          host.style.setProperty("top", "8px", "important");
          host.style.setProperty("margin", "0", "important");
          compose.append(host);
        } else {
          let anchor = editor;
          while (anchor.parentElement?.isContentEditable) anchor = anchor.parentElement;
          anchor.parentElement.insertBefore(host, anchor);
        }
        mounts.set(editor, host);
      }
    };
    globalThis.__smartmailV110 = true;
    const mounts = /* @__PURE__ */ new Map();
    let timer;
    let openModal;
    window.addEventListener("click", (event) => {
      const host = ownButton(event);
      if (!host) return;
      const editor = Array.from(mounts).find(([, value]) => value === host)?.[0];
      if (!editor) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showPanel(editor);
    }, true);
    window.addEventListener("pointerdown", (event) => {
      if (ownButton(event)) event.stopImmediatePropagation();
    }, true);
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 150);
    }).observe(document.body, { childList: true, subtree: true });
    scan();
  }
})();
