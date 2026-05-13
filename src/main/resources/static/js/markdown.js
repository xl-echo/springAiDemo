/**
 * DeepSeek Chat - Markdown 渲染模块
 * 版本: 3.0 - 极简可靠版
 */

(function () {
  'use strict';

  // 转义 HTML 特殊字符
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 纯文本渲染（备用方案）
  function renderPlain(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    // 用 \n\n+ 分割段落，单个 \n 替换为空格（避免流式传输时每字换行）
    var paragraphs = escaped.split(/\n\n+/);
    if (paragraphs.length === 1) {
      return '<p>' + escaped.replace(/\n/g, ' ') + '</p>';
    }
    return paragraphs.map(function(p) {
      return '<p>' + p.replace(/\n/g, ' ') + '</p>';
    }).join('');
  }

  // 简单的 Markdown 解析（不依赖 marked）
  function simpleMarkdown(text) {
    if (!text) return '';

    var html = escapeHtml(text);

    // 代码块 ```lang\ncode\n```
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(match, lang, code) {
      var language = lang || 'plaintext';
      var codeId = 'code_' + Math.random().toString(36).substr(2, 8);
      var highlighted = escapeHtml(code.trim());

      // 如果有 hljs，尝试高亮
      if (typeof hljs !== 'undefined') {
        try {
          if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(code.trim(), { language: lang }).value;
          } else {
            highlighted = hljs.highlightAuto(code.trim()).value;
          }
        } catch(e) {}
      }

      return '<div class="code-block-wrapper">' +
        '<div class="code-block-header">' +
        '<span class="code-lang">' + language + '</span>' +
        '<button class="copy-code-btn" onclick="app.copyCode(\'' + codeId + '\', this)">' +
        '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
        '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
        '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>' +
        '</svg> 复制' +
        '</button>' +
        '</div>' +
        '<pre><code id="' + codeId + '" class="hljs language-' + language + '">' + highlighted + '</code></pre>' +
        '</div>';
    });

    // 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.08);color:#7c3aed;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;">$1</code>');

    // 粗体 **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 斜体 *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 标题 ### text
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 无序列表
    html = html.replace(/^\s*[-*] (.*$)/gim, '<li>$1</li>');

    // 有序列表
    html = html.replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>');

    // 将连续的 <li> 包裹在 <ul> 中
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function(match) {
      return '<ul>' + match + '</ul>';
    });

    // 链接 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);text-decoration:none;">$1</a>');

    // 分隔线
    html = html.replace(/^---+$/gim, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">');

    // 段落处理 - 用 \n\n+ 分割，而不是单个 \n
    var paragraphs = html.split(/\n\n+/);
    if (paragraphs.length === 1) {
      // 没有双换行，检查是否有单换行但内容较短（流式传输中的换行）
      // 对于单换行，直接替换为空格，避免每字换行
      return '<p>' + html.replace(/\n/g, ' ') + '</p>';
    }
    return paragraphs.map(function(p) {
      var trimmed = p.trim();
      if (!trimmed) return '';
      // 如果已经是块级元素，不包裹
      if (trimmed.match(/^<(h[1-6]|ul|ol|div|pre|hr)/i)) {
        return trimmed;
      }
      return '<p>' + trimmed.replace(/\n/g, ' ') + '</p>';
    }).join('');
  }

  // 尝试使用 marked，失败则回退到简单解析
  function renderMarkdown(text) {
    console.log('[Markdown] render 被调用, text 类型:', typeof text, '长度:', text ? text.length : 'null/undefined');
    if (!text || typeof text !== 'string') {
      console.warn('[Markdown] text 无效，返回空');
      return '';
    }

    console.log('[Markdown] text 前50字符:', text.substring(0, 50));

    // 优先尝试 marked（如果可用且是 v4 版本）
    if (typeof marked !== 'undefined') {
      try {
        var result = marked.parse(text, { async: false });
        console.log('[Markdown] marked.parse 返回类型:', typeof result, '长度:', result ? result.length : 'null');
        if (typeof result === 'string' && result.length > 0) {
          return result;
        }
      } catch (e) {
        console.warn('[Markdown] marked 解析失败，使用备用方案:', e);
      }
    }

    // 回退到简单 Markdown 解析
    var simpleResult = simpleMarkdown(text);
    console.log('[Markdown] simpleMarkdown 返回长度:', simpleResult.length);
    return simpleResult;
  }

  // 导出 API
  window.markdown = {
    render: renderMarkdown,
    renderPlain: renderPlain,
    escapeHtml: escapeHtml,
    isReady: function() { return true; } // 总是就绪
  };

  console.log('[Markdown] 模块加载完成（内置解析器）');

})();
