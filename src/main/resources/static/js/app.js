/**
 * DeepSeek Chat - 主应用模块
 * 版本: 2.0 (非模块化版，兼容 CDN)
 */

// ============ SSE 流式通信 ============
const SSE_CONFIG = {
  ENDPOINT: '/api/chat/stream',
};

function streamMessage(text, callbacks) {
  const controller = new AbortController();
  window._currentAbortController = controller;

  console.log('═══════════════════════════════════════════');
  console.log('[streamMessage] 发送请求，消息:', text);
  console.log('[streamMessage] 消息长度:', text.length);
  console.log('═══════════════════════════════════════════');

  callbacks.onThinking();

  fetch(SSE_CONFIG.ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
    signal: controller.signal,
  })
    .then((response) => {
      console.log('[streamMessage] 收到响应，状态:', response.status, '状态文本:', response.statusText);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      callbacks.onRemoveThinking();
      callbacks.onStart();
      return response.body.getReader();
    })
    .then((reader) => {
      console.log('[streamMessage] 开始读取流...');
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let totalBytes = 0;

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            console.log('[streamMessage] 流读取完成，总 chunks:', chunkCount, '总字节:', totalBytes);
            console.log('[streamMessage] buffer 残留:', JSON.stringify(buffer));
            // 处理尾部残留
            const tailData = parseSSELine(buffer);
            if (tailData && tailData !== '[DONE]' && tailData !== '[ERROR]') {
              console.log('[streamMessage] 处理尾部 data:', tailData.substring(0, 100));
              callbacks.onChunk(tailData);
            }
            callbacks.onDone();
            console.log('[streamMessage] ═══════════════════════════════════════════ 完成 ═══════════════════════════════════════════');
            return;
          }

          const chunkStr = decoder.decode(value, { stream: true });
          totalBytes += value.length;

          // 直接处理文本，不解析 SSE 格式
          if (chunkStr === 'DONE') {
            console.log('[streamMessage] 收到 DONE 信号');
            callbacks.onDone();
            return;
          }
          if (chunkStr.startsWith('ERROR:')) {
            console.log('[streamMessage] 收到 ERROR 信号');
            callbacks.onChunk('⚠️ 生成过程中发生错误');
            callbacks.onDone();
            return;
          }
          if (chunkStr.startsWith('TEXT:')) {
            const text = chunkStr.slice(5);
            console.log('[streamMessage] 收到文本:', text.length, '字符');
            callbacks.onChunk(text);
          }

          read();
        });
      }

      read();
    })
    .catch((err) => {
      console.error('[streamMessage] 捕获异常:', err.name, err.message);
      if (err.name === 'AbortError') {
        callbacks.onChunk('\n\n*（已停止生成）*');
        callbacks.onDone();
      } else {
        callbacks.onError(err.message);
      }
    });
}

function parseSSELine(line) {
  if (!line || !line.startsWith('data:')) return null;
  return line.slice(5).trimStart();
}

function stopGeneration() {
  window._currentAbortController?.abort();
}

// ============ 本地存储 ============
const STORAGE_KEYS = {
  CONVERSATIONS: 'deepseek_conversations',
  CURRENT_CONV: 'deepseek_current_conv',
};

const storage = {
  saveConversations(conversations) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {}
  },
  loadConversations() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  saveCurrentConvId(id) {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_CONV, id);
    } catch (e) {}
  },
  loadCurrentConvId() {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_CONV);
    } catch (e) {
      return null;
    }
  },
};

// ============ 欢迎页模板 ============
const welcomeHTML = `
  <div class="welcome-screen" id="welcomeScreen">
    <div>
      <div class="welcome-logo">✨</div>
    </div>
    <div>
      <div class="welcome-title">DeepSeek AI 智能助手</div>
      <div class="welcome-desc">
        支持代码、分析、写作、问答——<br>有任何问题，直接问我就好
      </div>
    </div>
    <div class="quick-prompts">
      <div class="quick-card" data-prompt="帮我写一个 Spring Boot 接口示例，包含增删改查">
        <div class="quick-card-icon">☕</div>
        <div class="quick-card-title">Spring Boot 代码示例</div>
        <div class="quick-card-desc">帮我写包含增删改查的接口</div>
      </div>
      <div class="quick-card" data-prompt="解释一下什么是 Spring AI，它和普通 API 调用有什么区别？">
        <div class="quick-card-icon">🤖</div>
        <div class="quick-card-title">Spring AI 是什么</div>
        <div class="quick-card-desc">和普通 API 调用有什么区别</div>
      </div>
      <div class="quick-card" data-prompt="帮我对比一下 MySQL 和 PostgreSQL 的优缺点，用表格展示">
        <div class="quick-card-icon">🗄️</div>
        <div class="quick-card-title">数据库对比分析</div>
        <div class="quick-card-desc">MySQL vs PostgreSQL 表格对比</div>
      </div>
      <div class="quick-card" data-prompt="帮我写一段 Java 代码，使用 Stream API 处理一个 List，过滤、映射、排序、收集">
        <div class="quick-card-icon">⚡</div>
        <div class="quick-card-title">Java Stream API</div>
        <div class="quick-card-desc">过滤、映射、排序完整示例</div>
      </div>
    </div>
  </div>
`;

// ============ DeepSeekApp 类 ============
class DeepSeekApp {
  constructor() {
    this.state = {
      messages: [],
      conversations: [],
      currentConvId: null,
      isGenerating: false,
      systemPrompt:
        '你是一名有帮助的 AI 助手，擅长回答技术问题。请用中文回答，表达清晰、专业。如果需要展示代码，请使用 Markdown 代码块格式。',
      theme: 'light',
      autoScroll: true,
    };

    this.stream = {
      msgId: null,
      bubble: null,
      raw: '',
      renderTimer: null,
    };

    this._toastTimer = null;
  }

  init() {
    this._bindEvents();
    this._restoreConversations();
    this._restoreTheme();
    document.getElementById('msgInput')?.focus();
    this._renderWelcome();
  }

  _bindEvents() {
    const input = document.getElementById('msgInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.send();
        }
      });
      input.addEventListener('input', () => this.handleInputChange(input));
    }

    const area = document.getElementById('messagesArea');
    if (area) {
      area.addEventListener('scroll', () => this._handleScroll());
    }

    // 快捷卡片点击
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.quick-card[data-prompt]');
      if (card) {
        const prompt = card.dataset.prompt;
        const input = document.getElementById('msgInput');
        input.value = prompt;
        this.handleInputChange(input);
        this.send();
      }
    });
  }

  _renderWelcome() {
    const inner = document.getElementById('messagesInner');
    if (inner) {
      inner.innerHTML = welcomeHTML;
    }
  }

  // ============ 发送消息 ============
  async send() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || this.state.isGenerating) return;

    // 添加用户消息
    const userMsg = {
      id: 'u_' + Date.now(),
      role: 'user',
      content: text,
      time: new Date(),
    };
    this.state.messages.push(userMsg);
    this._appendMessage(userMsg);

    input.value = '';
    this.handleInputChange(input);

    this._setGenerating(true);

    await new Promise((resolve) => {
      streamMessage(text, {
        onStart: () => this._startStream(),
        onChunk: (chunk) => this._appendChunk(chunk),
        onDone: () => {
          this._finalizeStream();
          this._saveCurrentConversation();
          resolve();
        },
        onError: (msg) => {
          this._showError(msg);
          resolve();
        },
        onThinking: () => this._showThinking(),
        onRemoveThinking: () => this._removeThinking(),
      });
    });

    this._setGenerating(false);
  }

  // ============ 流式渲染 ============
  _startStream() {
    console.log('[_startStream] 开始初始化');
    this.stream.msgId = 'stream_' + Date.now();
    this.stream.raw = '';

    const container = document.getElementById('messagesInner');
    document.getElementById('welcomeScreen')?.remove();

    const el = document.createElement('div');
    el.className = 'message assistant';
    el.id = 'msg_' + this.stream.msgId;
    el.innerHTML = `
      <div class="avatar">AI</div>
      <div class="message-body">
        <div class="message-meta">
          <span class="sender-name">DeepSeek</span>
          <span class="msg-time">${this._formatTime(new Date())}</span>
        </div>
        <div class="bubble" id="bubble_${this.stream.msgId}">
          <span class="cursor-blink"></span>
        </div>
        <div class="message-actions">
          <button class="action-btn" onclick="app.copyMessage('${this.stream.msgId}', this)">复制</button>
          <button class="action-btn" onclick="app.regenerate()">重新生成</button>
        </div>
      </div>
    `;
    container.appendChild(el);
    this.stream.bubble = document.getElementById('bubble_' + this.stream.msgId);
    console.log('[_startStream] 完成, msgId=', this.stream.msgId, 'bubble=', !!this.stream.bubble);
    this.scrollToBottom();
  }

  _appendChunk(chunk) {
    console.log('═══════════════════════════════════════════');
    console.log('[_appendChunk] 收到 chunk:');
    console.log('  类型:', typeof chunk);
    console.log('  长度:', chunk ? chunk.length : 'null/undefined');
    console.log('  内容前100字符:', chunk ? JSON.stringify(chunk.substring(0, 100)) : 'N/A');
    console.log('  bubble 存在:', !!this.stream.bubble);
    console.log('  当前 raw 累积长度:', this.stream.raw ? this.stream.raw.length : 0);

    if (!chunk || !this.stream.bubble) {
      console.log('[_appendChunk] ⚠️ 跳过: chunk=', !!chunk, 'bubble=', !!this.stream.bubble);
      return;
    }

    // 保险：去掉可能的 data: 前缀
    if (typeof chunk === 'string' && chunk.startsWith('data:')) {
      chunk = chunk.slice(5).trimStart();
      console.log('[_appendChunk] 去掉 data: 前缀后:', JSON.stringify(chunk));
    }

    this.stream.raw += chunk;
    console.log('[_appendChunk] raw 累积后长度:', this.stream.raw.length);
    console.log('[_appendChunk] raw 前100字符:', JSON.stringify(this.stream.raw.substring(0, 100)));

    if (!this.stream.renderTimer) {
      this.stream.renderTimer = requestAnimationFrame(() => {
        console.log('[_appendChunk] 执行渲染 RAF');
        this.stream.renderTimer = null;
        this._renderStreamBubble();
      });
    }
  }

  _renderStreamBubble() {
    if (!this.stream.bubble) return;

    const html = window.markdown?.render(this.stream.raw);
    if (html && html.length > 0) {
      this.stream.bubble.innerHTML = html + '<span class="cursor-blink"></span>';
    } else {
      const esc = window.markdown?.escapeHtml(this.stream.raw) || this.stream.raw;
      // 单个 \n 替换为空格，避免流式传输时每字换行
      this.stream.bubble.innerHTML = esc.replace(/\n/g, ' ') + '<span class="cursor-blink"></span>';
    }

    if (this.state.autoScroll) this.scrollToBottom();
  }

  _finalizeStream() {
    console.log('[_finalizeStream] 开始, this.stream.raw 类型:', typeof this.stream.raw, '长度:', this.stream.raw ? this.stream.raw.length : 'null/undefined');

    if (this.stream.renderTimer) {
      cancelAnimationFrame(this.stream.renderTimer);
      this.stream.renderTimer = null;
    }

    if (this.stream.bubble) {
      console.log('[_finalizeStream] 渲染到 bubble, raw 前50字符:', (this.stream.raw || '').substring(0, 50));
      const html = window.markdown?.render(this.stream.raw);
      if (html && html.length > 0) {
        this.stream.bubble.innerHTML = html;
      } else {
        const esc = window.markdown?.escapeHtml(this.stream.raw) || (this.stream.raw || '');
        // 单个 \n 替换为空格，避免流式传输时每字换行
        this.stream.bubble.innerHTML = esc.replace(/\n/g, ' ');
      }
      // 显示操作栏
      const actionsEl = document.querySelector('#msg_' + this.stream.msgId + ' .message-actions');
      if (actionsEl) actionsEl.style.opacity = '';
    } else {
      console.log('[_finalizeStream] bubble 不存在!');
    }

    const msg = {
      id: this.stream.msgId,
      role: 'assistant',
      content: this.stream.raw,
      time: new Date(),
    };
    this.state.messages.push(msg);
    this.stream = { msgId: null, bubble: null, raw: '', renderTimer: null };
    console.log('[_finalizeStream] 完成');
  }

  _showThinking() {
    document.getElementById('welcomeScreen')?.remove();
    const container = document.getElementById('messagesInner');
    const el = document.createElement('div');
    el.id = 'thinking';
    el.className = 'message assistant';
    el.innerHTML = `
      <div class="avatar">AI</div>
      <div class="message-body">
        <div class="message-meta"><span class="sender-name">DeepSeek</span></div>
        <div class="bubble">
          <div class="thinking">
            <div class="thinking-dots"><span></span><span></span><span></span></div>
            正在思考…
          </div>
        </div>
      </div>
    `;
    container.appendChild(el);
    this.scrollToBottom();
  }

  _removeThinking() {
    document.getElementById('thinking')?.remove();
  }

  _showError(errorMsg) {
    this._removeThinking();
    if (this.stream.bubble) {
      const esc = window.markdown?.escapeHtml(this.stream.raw) || '';
      this.stream.bubble.innerHTML = esc.replace(/\n/g, '<br>') || `<p style="color:#ef4444">⚠️ ${errorMsg}</p>`;
    }
  }

  // ============ 重新生成 ============
  async regenerate() {
    if (this.state.isGenerating) return;
    let lastUser = null;
    for (let i = this.state.messages.length - 1; i >= 0; i--) {
      if (this.state.messages[i].role === 'user') {
        lastUser = this.state.messages[i];
        break;
      }
    }
    if (!lastUser) return;

    // 删除最后 AI 消息
    if (this.state.messages[this.state.messages.length - 1]?.role === 'assistant') {
      const last = this.state.messages.pop();
      document.getElementById('msg_' + last.id)?.remove();
    }
    // 删除用户消息
    this.state.messages.pop();
    document.getElementById('msg_' + lastUser.id)?.remove();

    await this.send();
  }

  // ============ 停止生成 ============
  stop() {
    stopGeneration();
  }

  // ============ 复制 ============
  copyMessage(id, btn) {
    const msg = this.state.messages.find((m) => m.id === id);
    if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      btn.classList.add('copied');
      btn.textContent = '已复制';
      this.showToast('📋 已复制');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '复制';
      }, 2000);
    });
  }

  copyCode(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      btn.classList.add('copied');
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '复制';
      }, 2000);
    });
  }

  // ============ 对话管理 ============
  newConversation() {
    this._saveCurrentConversation();
    this.state.messages = [];
    this.state.currentConvId = null;
    const inner = document.getElementById('messagesInner');
    inner.innerHTML = welcomeHTML;
    fetch('/api/chat/clear', { method: 'DELETE' }).catch(() => {});
    this._updateSidebar();
  }

  _saveCurrentConversation() {
    if (this.state.messages.length === 0) return;
    const firstUser = this.state.messages.find((m) => m.role === 'user');
    const title = firstUser ? firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '…' : '') : '新对话';
    const id = this.state.currentConvId || 'conv_' + Date.now();
    this.state.currentConvId = id;

    const idx = this.state.conversations.findIndex((c) => c.id === id);
    const conv = { id, title, time: new Date(), messages: this.state.messages.map((m) => ({ ...m })) };

    if (idx >= 0) {
      this.state.conversations[idx] = conv;
    } else {
      this.state.conversations.unshift(conv);
    }

    storage.saveConversations(this.state.conversations);
    storage.saveCurrentConvId(id);
    this._updateSidebar();
  }

  loadConversation(id) {
    const conv = this.state.conversations.find((c) => c.id === id);
    if (!conv) return;
    this._saveCurrentConversation();
    this.state.messages = conv.messages.map((m) => ({ ...m }));
    this.state.currentConvId = id;

    const inner = document.getElementById('messagesInner');
    inner.innerHTML = '';
    this.state.messages.forEach((m) => inner.appendChild(this.createMessageElement(m)));
    this.scrollToBottom(true);
    this._updateSidebar();
  }

  clearConversation() {
    if (!confirm('确定清空当前对话？')) return;
    this.newConversation();
    this.showToast('🗑️ 对话已清空');
  }

  exportConversation() {
    if (this.state.messages.length === 0) {
      this.showToast('⚠️ 暂无对话');
      return;
    }
    const lines = this.state.messages.map((m) => {
      const role = m.role === 'user' ? '**你**' : '**DeepSeek AI**';
      return `${role}\n\n${m.content}\n\n---\n`;
    });
    const md =
      `# DeepSeek AI 对话记录\n\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n` + lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.showToast('📥 已导出');
  }

  filterConversations(query) {
    const items = document.querySelectorAll('.conv-item');
    const q = query.toLowerCase();
    items.forEach((el) => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  _restoreConversations() {
    this.state.conversations = storage.loadConversations();
    this.state.currentConvId = storage.loadCurrentConvId();
    this._updateSidebar();
  }

  _updateSidebar() {
    const list = document.getElementById('convList');
    if (!list) return;

    if (this.state.conversations.length === 0) {
      list.innerHTML = '<div style="padding:16px;color:#666;font-size:13px;text-align:center">暂无对话历史</div>';
      return;
    }

    list.innerHTML = this.state.conversations
      .map(
        (c) => `
      <div class="conv-item ${c.id === this.state.currentConvId ? 'active' : ''}" onclick="app.loadConversation('${c.id}')">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        ${window.markdown?.escapeHtml(c.title) || c.title}
      </div>
    `
      )
      .join('');
  }

  // ============ UI 工具 ============
  handleInputChange(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = el.value.length;
      counter.className = 'char-counter' + (el.value.length > 2000 ? ' warn' : '');
    }
  }

  clearInput() {
    const el = document.getElementById('msgInput');
    if (el) {
      el.value = '';
      el.style.height = 'auto';
      this.handleInputChange(el);
      el.focus();
    }
  }

  insertCodeBlock() {
    const el = document.getElementById('msgInput');
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    el.value = before + '```java\n\n```' + after;
    el.setSelectionRange(pos + 8, pos + 8);
    this.handleInputChange(el);
    el.focus();
  }

  _appendMessage(msg) {
    document.getElementById('welcomeScreen')?.remove();
    const container = document.getElementById('messagesInner');
    container.appendChild(this.createMessageElement(msg));
    if (this.state.autoScroll) this.scrollToBottom();
  }

  createMessageElement(msg) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;
    el.id = 'msg_' + msg.id;

    const avatarText = msg.role === 'user' ? 'U' : 'AI';
    const senderName = msg.role === 'user' ? '你' : 'DeepSeek';
    const bubbleContent =
      msg.role === 'assistant'
        ? (window.markdown?.render(msg.content) || msg.content)
        : (window.markdown?.renderPlain(msg.content) || msg.content);

    el.innerHTML = `
      <div class="avatar">${avatarText}</div>
      <div class="message-body">
        <div class="message-meta">
          <span class="sender-name">${senderName}</span>
          <span class="msg-time">${this._formatTime(msg.time)}</span>
        </div>
        <div class="bubble">${bubbleContent}</div>
        <div class="message-actions">
          <button class="action-btn" onclick="app.copyMessage('${msg.id}', this)">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            复制
          </button>
          ${msg.role === 'assistant' ? '<button class="action-btn" onclick="app.regenerate()">重新生成</button>' : ''}
        </div>
      </div>
    `;
    return el;
  }

  scrollToBottom(force = false) {
    const area = document.getElementById('messagesArea');
    if (area) area.scrollTop = area.scrollHeight;
    document.getElementById('scrollBtn')?.classList.remove('visible');
  }

  _handleScroll() {
    const area = document.getElementById('messagesArea');
    if (!area) return;
    const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
    this.state.autoScroll = atBottom;
    const btn = document.getElementById('scrollBtn');
    if (btn) btn.classList.toggle('visible', !atBottom);
  }

  _setGenerating(on) {
    this.state.isGenerating = on;
    document.getElementById('sendBtn').disabled = on;
    document.getElementById('stopBtn').classList.toggle('hidden', !on);
  }

  // ============ 主题 ============
  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.state.theme === 'dark' ? 'dark' : '');
    localStorage.setItem('theme', this.state.theme);
    this.showToast(this.state.theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式');
  }

  _restoreTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      this.state.theme = 'dark';
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  // ============ 系统面板 ============
  toggleSystemPanel() {
    document.getElementById('systemPanel').classList.toggle('open');
  }

  applySettings() {
    this.state.systemPrompt = document.getElementById('systemPromptInput').value.trim();
    this.toggleSystemPanel();
    fetch('/api/chat/clear', { method: 'DELETE' }).catch(() => {});
    this.showToast('✅ 设置已应用');
  }

  // ============ Toast ============
  showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  _formatTime(date) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
}

// ============ 初始化 ============
window.app = new DeepSeekApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
