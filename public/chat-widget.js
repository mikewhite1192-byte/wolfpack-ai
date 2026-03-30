(function() {
  var API_URL = 'https://thewolfpack.ai/api/chat-widget/agency';
  var messages = [];
  var isOpen = false;
  var isSending = false;

  // Colors
  var orange = '#E86A2A';
  var bg = '#0a0a0a';
  var border = 'rgba(255,255,255,0.08)';
  var text = '#e8eaf0';
  var muted = 'rgba(232,230,227,0.4)';

  // Create floating button
  var btn = document.createElement('div');
  btn.innerHTML = '💬';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:' + orange + ';display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(232,106,42,0.4);z-index:99998;font-size:24px;transition:transform 0.2s;user-select:none;';
  btn.onclick = function() {
    isOpen = !isOpen;
    win.style.display = isOpen ? 'flex' : 'none';
    btn.innerHTML = isOpen ? '✕' : '💬';
    btn.style.fontSize = isOpen ? '20px' : '24px';
    if (isOpen && messages.length === 0) addBotMessage("Hey! I'm Maya. Got questions about The Wolf Pack Co? Ask me anything.");
  };
  document.body.appendChild(btn);

  // Create chat window
  var win = document.createElement('div');
  win.style.cssText = 'position:fixed;bottom:90px;right:24px;width:360px;max-width:calc(100vw - 48px);height:460px;max-height:calc(100vh - 120px);background:' + bg + ';border:1px solid ' + border + ';border-radius:16px;display:none;flex-direction:column;overflow:hidden;z-index:99998;box-shadow:0 8px 40px rgba(0,0,0,0.5);font-family:Inter,system-ui,-apple-system,sans-serif;';

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;';
  header.innerHTML = '<div style="width:32px;height:32px;border-radius:50%;background:rgba(232,106,42,0.2);color:' + orange + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">M</div><div><div style="font-size:14px;font-weight:700;color:' + text + ';">Maya</div><div style="font-size:11px;color:' + muted + ';">Wolf Pack Co Assistant</div></div>';
  win.appendChild(header);

  // Messages area
  var msgsDiv = document.createElement('div');
  msgsDiv.style.cssText = 'flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:8px;';
  win.appendChild(msgsDiv);

  // Input area
  var inputWrap = document.createElement('div');
  inputWrap.style.cssText = 'padding:12px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;';
  var input = document.createElement('input');
  input.placeholder = 'Ask Maya anything...';
  input.style.cssText = 'flex:1;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid ' + border + ';border-radius:10px;font-size:13px;color:' + text + ';outline:none;font-family:inherit;';
  input.onkeydown = function(e) { if (e.key === 'Enter') send(); };
  var sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText = 'padding:10px 16px;background:' + orange + ';color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;';
  sendBtn.onclick = send;
  inputWrap.appendChild(input);
  inputWrap.appendChild(sendBtn);
  win.appendChild(inputWrap);

  document.body.appendChild(win);

  function addBotMessage(txt) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:flex-start;';
    div.innerHTML = '<div style="max-width:85%;padding:10px 14px;font-size:13px;line-height:1.5;border-radius:14px;background:rgba(255,255,255,0.06);color:' + text + ';">' + escapeHtml(txt) + '</div>';
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }

  function addUserMessage(txt) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:flex-end;';
    div.innerHTML = '<div style="max-width:85%;padding:10px 14px;font-size:13px;line-height:1.5;border-radius:14px;background:' + orange + ';color:#fff;">' + escapeHtml(txt) + '</div>';
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }

  function addTyping() {
    var div = document.createElement('div');
    div.id = 'wp-typing';
    div.style.cssText = 'font-size:12px;color:rgba(232,230,227,0.3);padding:4px 8px;';
    div.textContent = 'Maya is typing...';
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }

  function removeTyping() {
    var t = document.getElementById('wp-typing');
    if (t) t.remove();
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function send() {
    var txt = input.value.trim();
    if (!txt || isSending) return;
    input.value = '';
    addUserMessage(txt);
    messages.push({ role: 'user', content: txt });
    isSending = true;
    addTyping();

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: txt, history: messages.slice(0, -1) }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      removeTyping();
      isSending = false;
      var reply = data.reply || 'Sorry, something went wrong.';
      messages.push({ role: 'assistant', content: reply });
      addBotMessage(reply);
    })
    .catch(function() {
      removeTyping();
      isSending = false;
      addBotMessage('Sorry, something went wrong. Try again!');
    });
  }
})();
