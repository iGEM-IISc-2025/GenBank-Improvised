/* assets/js/file_viewer.js
   Client-side parser/renderer for FASTA and XML files.
   - Reads window.__FILE_VIEWER_CONFIG.data_file (URL path or relative path)
   - If file_type === 'auto', chooses by extension
   - Renders a clean interactive view
*/

(async function () {
  const cfg = window.__FILE_VIEWER_CONFIG || {};
  const filePath = cfg.data_file;
  const fileTypeHint = (cfg.file_type || 'auto').toLowerCase();

  const $ = sel => document.querySelector(sel);
  const renderArea = $('#render-area');
  const meta = $('#meta');
  const downloadLink = $('#download-link');
  const searchInput = $('#search-input');
  const btnSearch = $('#btn-search');
  const btnClear = $('#btn-clear');

  if (!filePath) {
    renderArea.innerHTML = `<div class="text-red-600">No data_file specified in page front matter.</div>`;
    return;
  }

  // Set download link
  downloadLink.href = filePath;
  downloadLink.setAttribute('download', filePath.split('/').pop());

  // fetch file
  async function fetchText(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) {
      renderArea.innerHTML = `<div class="text-red-600">Failed to fetch ${url}: ${e.message}</div>`;
      throw e;
    }
  }

  const raw = await fetchText(filePath);

  // detect type
  function detectType(path, content) {
    if (fileTypeHint === 'fasta') return 'fasta';
    if (fileTypeHint === 'xml') return 'xml';
    if (path.match(/\.f(ast)?a$/i)) return 'fasta';
    if (path.match(/\.xml$/i)) return 'xml';
    // quick content check
    if (content.trim().startsWith('<?xml') || content.trim().startsWith('<')) return 'xml';
    if (content.trim().startsWith('>')) return 'fasta';
    return 'fasta'; // default
  }

  const type = detectType(filePath, raw);
  meta.innerText = `Detected type: ${type.toUpperCase()} — Size: ${raw.length} bytes`;

  function parseFasta(text) {
    const entries = [];
    let current = null;
    const lines = text.replace(/\r/g,'').split('\n');
    for (let ln of lines) {
      if (!ln) continue;
      if (ln.startsWith('>')) {
        if (current) entries.push(current);
        const header = ln.substring(1).trim();
        current = { header, seqLines: [] };
      } else {
        if (!current) {
          current = { header: 'sequence', seqLines: [] };
        }
        current.seqLines.push(ln.trim());
      }
    }
    if (current) entries.push(current);
    return entries.map(e => ({ header: e.header, sequence: e.seqLines.join('') }));
  }

  function renderFasta(entries) {
    if (entries.length === 0) {
      renderArea.innerHTML = `<div class="text-gray-600">No FASTA entries found.</div>`;
      return;
    }

    const container = document.createElement('div');

    entries.forEach((e, idx) => {
      const card = document.createElement('div');
      card.className = 'mb-6';

      const header = document.createElement('div');
      header.className = 'flex items-center gap-3';
      header.innerHTML = `<div class="font-semibold">#${idx+1}</div><div class="text-sm text-gray-600 mono">${escapeHtml(e.header)}</div>`;
      card.appendChild(header);

      const info = document.createElement('div');
      info.className = 'text-xs text-gray-500 mt-1';
      info.innerText = `Length: ${e.sequence.length} aa/bp`;
      card.appendChild(info);

      const seqWrapper = document.createElement('div');
      seqWrapper.className = 'mt-3 border rounded p-3 bg-gray-50';

      const lineLen = 60;
      const chars = e.sequence;
      let seqText = '';
      for (let i = 0; i < chars.length; i += lineLen) {
        const slice = chars.slice(i, i + lineLen);
        const lineno = String(i + 1).padStart(6, ' ');
        seqText += lineno + '  ' + slice + '\n';
      }

      const pre = document.createElement('pre');
      pre.className = 'fasta-seq mono text-sm';
      pre.textContent = seqText;
      seqWrapper.appendChild(pre);
      card.appendChild(seqWrapper);

      const actions = document.createElement('div');
      actions.className = 'mt-2 flex gap-2';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'px-3 py-1 border rounded text-sm';
      copyBtn.textContent = 'Copy sequence';
      copyBtn.onclick = () => navigator.clipboard.writeText(e.sequence).then(()=>copyBtn.textContent='Copied!');
      actions.appendChild(copyBtn);

      const downloadBtn = document.createElement('a');
      downloadBtn.className = 'px-3 py-1 border rounded text-sm';
      downloadBtn.textContent = 'Download FASTA';
      const blob = new Blob([`>${e.header}\n${e.sequence.replace(/(.{60})/g,'$1\n')}\n`], {type: 'text/plain'});
      downloadBtn.href = URL.createObjectURL(blob);
      downloadBtn.download = `${sanitizeFilename(e.header || 'sequence')}.fasta`;
      actions.appendChild(downloadBtn);

      card.appendChild(actions);
      container.appendChild(card);
    });

    renderArea.innerHTML = '';
    renderArea.appendChild(container);
  }

  function renderXml(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) {
      renderArea.innerHTML = `<div class="text-red-600">XML parse error. Showing raw:</div><pre class="mt-2 p-2 bg-gray-50 border rounded mono">${escapeHtml(text)}</pre>`;
      return;
    }

    const tree = document.createElement('div');
    tree.className = 'xml-tree text-sm';

    function nodeToElement(node, depth = 0) {
      const el = document.createElement('div');
      el.style.marginLeft = (depth * 14) + 'px';
      el.className = 'mb-1';

      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent.trim();
        if (!txt) return document.createDocumentFragment();
        const span = document.createElement('div');
        span.className = 'xml-text';
        span.innerHTML = escapeHtml(txt);
        return span;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const head = document.createElement('div');
        head.className = 'flex items-center gap-2';

        const toggle = document.createElement('span');
        toggle.textContent = '▾';
        toggle.className = 'fold-toggle text-xs text-gray-500';
        head.appendChild(toggle);

        const tagName = document.createElement('span');
        tagName.className = 'xml-tag';
        tagName.textContent = `<${node.nodeName}>`;
        head.appendChild(tagName);

        if (node.attributes && node.attributes.length) {
          const attrs = document.createElement('span');
          attrs.className = 'text-xs text-gray-600 ml-2';
          const parts = [];
          for (let a of node.attributes) {
            parts.push(`<span class="xml-attr">${a.name}</span>="${escapeHtml(a.value)}"`);
          }
          attrs.innerHTML = parts.join(' ');
          head.appendChild(attrs);
        }

        el.appendChild(head);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'ml-3 mt-1';
        for (let c of Array.from(node.childNodes)) {
          const childEl = nodeToElement(c, depth + 1);
          if (childEl) childrenContainer.appendChild(childEl);
        }
        el.appendChild(childrenContainer);

        toggle.onclick = () => {
          if (childrenContainer.style.display === 'none') {
            childrenContainer.style.display = 'block';
            toggle.textContent = '▾';
          } else {
            childrenContainer.style.display = 'none';
            toggle.textContent = '▸';
          }
        };

        return el;
      }

      return document.createDocumentFragment();
    }

    const rootElements = [];
    for (let n of Array.from(doc.childNodes)) {
      const e = nodeToElement(n, 0);
      if (e) tree.appendChild(e);
    }

    renderArea.innerHTML = '';
    renderArea.appendChild(tree);

    const rawBox = document.createElement('details');
    rawBox.className = 'mt-4';
    rawBox.innerHTML = `<summary class="cursor-pointer text-sm text-gray-600">Show raw XML</summary><pre class="mt-2 p-2 bg-gray-50 border rounded mono">${escapeHtml(text)}</pre>`;
    renderArea.appendChild(rawBox);
  }

  function escapeHtml(s) {
    return (s+'').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function sanitizeFilename(s) {
    return (s || 'file').replace(/[^a-z0-9\-_\.]/ig, '_').slice(0, 200);
  }

  if (type === 'fasta') {
    const entries = parseFasta(raw);
    renderFasta(entries);
  } else if (type === 'xml') {
    renderXml(raw);
  } else {
    renderArea.innerHTML = `<pre class="mono p-2 bg-gray-50 border rounded">${escapeHtml(raw)}</pre>`;
  }

  btnSearch.onclick = () => {
    const q = (searchInput.value || '').trim();
    if (!q) return;
    const re = new RegExp(escapeRegExp(q), 'ig');
    function highlight(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (re.test(node.nodeValue)) {
          const span = document.createElement('span');
          span.innerHTML = escapeHtml(node.nodeValue).replace(re, (m) => `<span class="search-highlight">${escapeHtml(m)}</span>`);
          node.parentNode.replaceChild(span, node);
        }
      } else {
        for (let c of Array.from(node.childNodes)) highlight(c);
      }
    }
    highlight(renderArea);
  };

  btnClear.onclick = () => {
    location.reload();
  };

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

})();
