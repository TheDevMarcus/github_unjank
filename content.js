(function () {
  'use strict';

  let selectedFiles = new Set();
  let selectionMode = false;
  let hiddenElements = [];

  function isRepoRoot() {
    const parts = location.pathname.split('/').filter(Boolean);
    
    if (parts.length === 2) return true;
    const treeMatch = location.pathname.match(/\/[^/]+\/[^/]+\/tree\/[^/]+\/?$/);
    return !!treeMatch;
  }

  function isRepoFilePage() {
    const p = location.pathname;
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    if (['/settings','/issues','/pulls','/actions','/wiki','/security',
         '/pulse','/graphs','/compare','/releases','/tags','/commits',
         '/blame','/raw','/edit','/new'].some(x => p.includes(x))) return false;
    return parts.length === 2 || p.includes('/tree/');
  }

  function isFileEditPage() {
    return location.pathname.includes('/edit/') || location.pathname.includes('/new/');
  }

  function isFileBlobPage() {
    return location.pathname.includes('/blob/');
  }

  function getRepoInfo() {
    const parts = location.pathname.split('/').filter(Boolean);
    return { owner: parts[0], repo: parts[1] };
  }

  function getCurrentPath() {
    const m = location.pathname.match(/\/(blob|tree|edit)\/[^/]+\/(.*)/);
    return m ? decodeURIComponent(m[2]) : '';
  }

  function getBranch() {
    const m = location.pathname.match(/\/(blob|tree|edit)\/([^/]+)/);
    if (m) return m[2];
    const meta = document.querySelector('meta[name="octolytics-dimension-ref_name"]');
    return meta ? meta.content : 'main';
  }

  function encodePath(fp) {
    return fp.split('/').map(encodeURIComponent).join('/');
  }

  function findAddFileButton() {
    const t = document.querySelector('[data-testid="add-file-menu-trigger"]');
    if (t) return t;
    const a = document.querySelector('button[aria-label="Add file"],a[aria-label="Add file"]');
    if (a) return a;
    for (const b of document.querySelectorAll('button,a')) {
      const txt = b.textContent.trim();
      if (txt === 'Add file' || txt === 'Add files') return b;
    }
    return null;
  }

  function findGoToFileBar() {
    const selectors = [
      '[data-testid="navigate-file-button"]',
      'button[aria-label="Go to file"]',
      '[aria-label="Go to file"]',
      'input[placeholder*="Go to file"]',
      'input[placeholder*="Filter files"]',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent.trim() === 'Go to file') return btn;
    }
    return null;
  }

  const ICONS = {
    select:   '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 4.75C2 3.784 2.784 3 3.75 3h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25Z"/><path d="M10.97 7.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97Z"/></svg>',
    checkAll: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>',
    none:     '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>',
    trash:    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>',
    copy:     '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>',
    stats:    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.06 1.06Z"/></svg>',
    close:    '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>',
    edit:     '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>',
    file:     '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914Z"/></svg>',
    history:  '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>',
    raw:      '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25Zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25Z"/></svg>',
    blame:    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>',
  };

  function mkBtn(id, text, iconKey, cls) {
    const b = document.createElement('button');
    if (id) b.id = id;
    b.type = 'button';
    b.className = 'gpt-btn' + (cls ? ' ' + cls : '');
    b.innerHTML = ICONS[iconKey] + '<span class="gpt-btn-label">' + text + '</span>';
    return b;
  }

  function hideSelectModeOthers() {
    hiddenElements = [];
    const copyBtn = document.getElementById('gpt-btn-copy');
    const statsBtn = document.getElementById('gpt-btn-stats');
    [copyBtn, statsBtn].forEach(el => {
      if (el) {
        hiddenElements.push({ el, display: el.style.display });
        el.style.display = 'none';
      }
    });
  }

  function restoreSelectModeOthers() {
    hiddenElements.forEach(({ el, display }) => { el.style.display = display; });
    hiddenElements = [];
  }

  function findMoreFileActionsButton() {
    
    const kebab = document.querySelector('button .octicon-kebab-horizontal, button svg.octicon-kebab-horizontal');
    if (kebab) return kebab.closest('button');
    
    const selectors = [
      'button[aria-label="More file actions"]',
      '[data-testid="more-file-actions-button"]',
      '[aria-label="More file actions"]',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function injectButtons() {
    if (document.getElementById('gpt-btn-group')) return;
    const addFileBtn = findAddFileButton();
    if (!addFileBtn) return;

    const group = document.createElement('div');
    group.id = 'gpt-btn-group';

    const btnSelect = mkBtn('gpt-btn-select', 'Select', 'select');
    const btnAll    = mkBtn('gpt-btn-all', 'All', 'checkAll');
    const btnNone   = mkBtn('gpt-btn-none', 'None', 'none');
    const btnDelete = mkBtn('gpt-btn-delete', 'Delete', 'trash', 'gpt-btn-danger');
    const btnCopy   = mkBtn('gpt-btn-copy', 'Copy paths', 'copy');
    const btnStats  = mkBtn('gpt-btn-stats', 'Stats', 'stats');

    const countSpan = document.createElement('span');
    countSpan.id = 'gpt-sel-count';
    countSpan.className = 'gpt-sel-badge';
    countSpan.textContent = '0';
    countSpan.style.display = 'none';
    btnDelete.appendChild(countSpan);

    [btnSelect, btnAll, btnNone, btnDelete, btnCopy, btnStats].forEach(el => group.appendChild(el));
    btnSelect.style.marginRight = '4px';
    [btnAll, btnNone, btnDelete].forEach(b => b.classList.add('gpt-hidden'));
    if (!isRepoRoot()) btnStats.classList.add('gpt-hidden');

    const addFileParent = addFileBtn.closest('[class*="ButtonGroup"],[role="group"]') || addFileBtn.parentElement;
    if (addFileParent && addFileParent.parentElement) {
      addFileParent.parentElement.insertBefore(group, addFileParent);
    } else {
      addFileBtn.parentElement.insertBefore(group, addFileBtn);
    }

    btnSelect.addEventListener('click', toggleSelectMode);
    btnAll.addEventListener('click', selectAll);
    btnNone.addEventListener('click', deselectAll);
    btnDelete.addEventListener('click', deleteSelected);
    btnCopy.addEventListener('click', copyFilePaths);
    btnStats.addEventListener('click', toggleStatsPanel);
  }

  function getFileRows() {
    const seen = new Set();
    const rows = [];
    const candidates = [
      ...document.querySelectorAll('.js-navigation-item'),
      ...document.querySelectorAll('[data-testid="list-view-item"]'),
      ...document.querySelectorAll('tr.react-directory-row'),
      ...document.querySelectorAll('[data-component="listItem"]'),
      ...document.querySelectorAll('.Box-row[role="row"]'),
    ];
    for (const r of candidates) {
      if (seen.has(r)) continue;
      seen.add(r);
      if (r.querySelector('a[href*="/blob/"],a[href*="/tree/"]') &&
          !r.querySelector('[data-component="BranchName"]')) {
        rows.push(r);
      }
    }
    return rows;
  }

  function getFileLinkFromRow(row) {
    return row.querySelector('a[href*="/blob/"],a[href*="/tree/"]');
  }

  function getFileNameFromRow(row) {
    const link = getFileLinkFromRow(row);
    if (!link) return null;
    const parts = link.getAttribute('href').split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }

  function getFilePathFromRow(row) {
    const link = getFileLinkFromRow(row);
    if (!link) return null;
    const m = link.getAttribute('href').match(/\/(blob|tree)\/[^/]+\/(.*)/);
    return m ? decodeURIComponent(m[2]) : null;
  }

  function isDirectory(row) {
    const link = getFileLinkFromRow(row);
    if (link) return link.getAttribute('href').includes('/tree/');
    return !!(row.querySelector('[aria-label*="irectory"],[class*="directory"],.octicon-file-directory-fill,.octicon-file-directory'));
  }

  function toggleSelectMode() {
    selectionMode = !selectionMode;
    selectedFiles.clear();
    updateCount();

    const btnSelect  = document.getElementById('gpt-btn-select');
    const btnAll     = document.getElementById('gpt-btn-all');
    const btnNone    = document.getElementById('gpt-btn-none');
    const btnDelete  = document.getElementById('gpt-btn-delete');
    const countBadge = document.getElementById('gpt-sel-count');

    if (selectionMode) {
      hideSelectModeOthers();
      btnSelect.classList.add('gpt-btn-active');
      btnSelect.querySelector('.gpt-btn-label').textContent = 'Exit';
      [btnAll, btnNone, btnDelete].forEach(b => b.classList.remove('gpt-hidden'));
      if (countBadge) countBadge.style.display = '';
      injectCheckboxes();
    } else {
      restoreSelectModeOthers();
      btnSelect.classList.remove('gpt-btn-active');
      btnSelect.querySelector('.gpt-btn-label').textContent = 'Select';
      [btnAll, btnNone, btnDelete].forEach(b => b.classList.add('gpt-hidden'));
      if (countBadge) countBadge.style.display = 'none';
      removeCheckboxes();
    }
  }

  function injectCheckboxes() {
    getFileRows().forEach(row => {
      if (row.querySelector('.gpt-cb')) return;
      const name = getFileNameFromRow(row);
      if (!name) return;

      const wrap = document.createElement('div');
      wrap.className = 'gpt-cb';
      wrap.setAttribute('role', 'checkbox');
      wrap.setAttribute('aria-checked', 'false');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('title', 'Select ' + name);
      wrap.innerHTML = '<span class="gpt-cb-box"><svg class="gpt-cb-tick" viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 3.5,6.5 9,1"/></svg></span>';

      const toggle = e => {
        e.stopPropagation();
        e.preventDefault();
        const isChecked = wrap.getAttribute('aria-checked') === 'true';
        if (isChecked) {
          wrap.setAttribute('aria-checked', 'false');
          wrap.classList.remove('gpt-cb-on');
          row.classList.remove('gpt-row-sel');
          selectedFiles.delete(name);
        } else {
          wrap.setAttribute('aria-checked', 'true');
          wrap.classList.add('gpt-cb-on');
          row.classList.add('gpt-row-sel');
          selectedFiles.add(name);
        }
        updateCount();
      };

      wrap.addEventListener('click', toggle);
      wrap.addEventListener('keydown', e => (e.key === ' ' || e.key === 'Enter') && toggle(e));

      const lastCell = row.querySelector('td:last-child') || row;

      
      const cellWrapper = document.createElement('div');
      cellWrapper.className = 'gpt-cell-wrap';
      
      while (lastCell.firstChild) {
        cellWrapper.appendChild(lastCell.firstChild);
      }
      cellWrapper.appendChild(wrap);
      lastCell.appendChild(cellWrapper);

      row.classList.add('gpt-row-selectable');
    });
  }

  function removeCheckboxes() {
    document.querySelectorAll('.gpt-cb').forEach(el => el.remove());
    
    document.querySelectorAll('.gpt-cell-wrap').forEach(wrapper => {
      const parent = wrapper.parentNode;
      if (parent) {
        while (wrapper.firstChild) {
          parent.appendChild(wrapper.firstChild);
        }
        wrapper.remove();
      }
    });
    document.querySelectorAll('.gpt-row-sel').forEach(el => el.classList.remove('gpt-row-sel'));
    document.querySelectorAll('.gpt-row-selectable').forEach(el => el.classList.remove('gpt-row-selectable'));
    selectedFiles.clear();
    updateCount();
  }

  function selectAll() {
    getFileRows().forEach(row => {
      const cb = row.querySelector('.gpt-cb');
      const name = getFileNameFromRow(row);
      if (cb && name) {
        cb.setAttribute('aria-checked', 'true');
        cb.classList.add('gpt-cb-on');
        row.classList.add('gpt-row-sel');
        selectedFiles.add(name);
      }
    });
    updateCount();
    showToast(selectedFiles.size + ' files selected');
  }

  function deselectAll() {
    getFileRows().forEach(row => {
      const cb = row.querySelector('.gpt-cb');
      if (cb) { cb.setAttribute('aria-checked', 'false'); cb.classList.remove('gpt-cb-on'); }
      row.classList.remove('gpt-row-sel');
    });
    selectedFiles.clear();
    updateCount();
  }

  function updateCount() {
    const el = document.getElementById('gpt-sel-count');
    if (el) el.textContent = selectedFiles.size;
  }

  function deleteSelected() {
    if (!selectedFiles.size) { showToast('No files selected', 'warn'); return; }
    showDeleteModal([...selectedFiles]);
  }

  function showDeleteModal(files) {
    document.getElementById('gpt-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'gpt-modal';
    overlay.innerHTML =
      '<div class="gpt-modal-box" role="dialog" aria-modal="true" aria-labelledby="gpt-modal-title">' +
        '<div class="gpt-modal-hd">' +
          '<div class="gpt-modal-hd-left">' + ICONS.trash +
            '<h3 id="gpt-modal-title">Delete ' + files.length + ' file' + (files.length !== 1 ? 's' : '') + '?</h3>' +
          '</div>' +
          '<button class="gpt-icon-btn" id="gpt-modal-x" aria-label="Close">' + ICONS.close + '</button>' +
        '</div>' +
        '<p class="gpt-modal-sub">Each file opens a GitHub delete confirmation tab.</p>' +
        '<ul class="gpt-modal-list">' + files.map(f => '<li class="gpt-modal-file-item">' + ICONS.file + '<code>' + f + '</code></li>').join('') + '</ul>' +
        '<div class="gpt-modal-footer">' +
          '<button id="gpt-modal-cancel" class="gpt-btn" type="button">Cancel</button>' +
          '<button id="gpt-modal-go" class="gpt-btn gpt-btn-danger" type="button">' + ICONS.trash + ' Open ' + files.length + ' delete tab' + (files.length !== 1 ? 's' : '') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('gpt-modal-x').onclick = () => overlay.remove();
    document.getElementById('gpt-modal-cancel').onclick = () => overlay.remove();
    document.getElementById('gpt-modal-go').onclick = () => { overlay.remove(); openDeletePages(files); };
    overlay.addEventListener('click', e => e.target === overlay && overlay.remove());
    document.getElementById('gpt-modal-go').focus();
  }

  function openDeletePages(files) {
    const { owner, repo } = getRepoInfo();
    const branch = getBranch();
    const prefix = getCurrentPath() ? getCurrentPath() + '/' : '';
    files.forEach((name, i) => setTimeout(() =>
      window.open('https://github.com/' + owner + '/' + repo + '/delete/' + branch + '/' + prefix + name, '_blank'), i * 350));
    toggleSelectMode();
    showToast('Opening ' + files.length + ' delete tab' + (files.length !== 1 ? 's' : '') + '…');
  }

  function copyFilePaths() {
    const paths = getFileRows().map(r => getFilePathFromRow(r)).filter(Boolean);
    if (!paths.length) { showToast('No files found', 'warn'); return; }
    const text = paths.join('\n');
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied ' + paths.length + ' paths'))
      .catch(() => {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        showToast('Copied ' + paths.length + ' paths');
      });
  }

  // Returns the outermost wrapper of the file table that is a direct child
  // of the repo content area — so we can safely insert siblings next to it.
  // Walk up from `el` until its parent is `targetParent`, returning that child.
  function childOf(el, targetParent) {
    let node = el;
    while (node && node.parentElement) {
      if (node.parentElement === targetParent) return node;
      node = node.parentElement;
    }
    return null;
  }

  // Find the shared column container that holds both the file table and the README/prompt.
  // Returns { column, fileBlock, readmeBlock } or null.
  function findColumnLayout() {
    const rows = getFileRows();
    if (!rows.length) return null;

    let el = rows[0].closest('table,div[role="grid"],div[role="table"]') || rows[0].parentElement;
    let depth = 0;
    while (el && el.parentElement && depth < 8) {
      depth++;
      const parent = el.parentElement;
      // Stop if we've gone past the repo content wrapper — don't escape into <main> or <body>
      if (parent.matches('main,body,[role="main"],[id="repo-content-pjax-container"]')) break;
      const siblings = Array.from(parent.children);

      const readmeBlock = siblings.find(s => s !== el && (
        s.querySelector('#readme,[data-testid="readme"],.markdown-body') ||
        (s.textContent.includes('Add a README') && s.querySelector('a,button'))
      ));

      if (readmeBlock) {
        return { column: parent, fileBlock: el, readmeBlock };
      }

      el = parent;
    }
    return null;
  }

  async function fetchCommitActivity(owner, repo) {
    // GitHub's stats/commit_activity returns 52 weeks of data (Sun–Sat, commits per day)
    const url = 'https://api.github.com/repos/' + owner + '/' + repo + '/stats/commit_activity';
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.status === 202) {
        // GitHub is computing stats — wait and retry
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!res.ok) return null;
      return await res.json(); // array of 52 week objects: { week, days:[sun..sat], total }
    }
    return null;
  }

  function renderHeatmap(weeks) {
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Flatten all day values to find max for color scaling
    const allVals = weeks.flatMap(w => w.days);
    const max = Math.max(...allVals, 1);

    // Color levels (0–4) matching GitHub's palette
    function level(v) {
      if (v === 0) return 0;
      if (v <= max * 0.15) return 1;
      if (v <= max * 0.40) return 2;
      if (v <= max * 0.70) return 3;
      return 4;
    }

    // Build month labels: find where month changes across week starts
    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((w, wi) => {
      const d = new Date(w.week * 1000);
      const m = d.getMonth();
      if (m !== lastMonth) { monthLabels.push({ wi, label: MONTHS[m] }); lastMonth = m; }
    });

    const totalCommits = weeks.reduce((s, w) => s + w.total, 0);

    // Build the SVG grid (days as rows, weeks as columns)
    const cellSize = 11, gap = 2, step = cellSize + gap;
    const labelH = 18, labelW = 28;
    const cols = weeks.length, rows2 = 7;
    const svgW = labelW + cols * step;
    const svgH = labelH + rows2 * step;

    let cells = '';
    weeks.forEach((w, wi) => {
      w.days.forEach((count, di) => {
        const x = labelW + wi * step;
        const y = labelH + di * step;
        const lv = level(count);
        const dateStr = new Date((w.week + di * 86400) * 1000).toDateString();
        cells += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" rx="2"' +
          ' class="gpt-hm-cell gpt-hm-lv' + lv + '"' +
          ' data-count="' + count + '" data-date="' + dateStr + '"/>';
      });
    });

    let monthSvg = '';
    monthLabels.forEach(({ wi, label }) => {
      const x = labelW + wi * step;
      monthSvg += '<text x="' + x + '" y="12" class="gpt-hm-label">' + label + '</text>';
    });

    let daysSvg = '';
    [1, 3, 5].forEach(di => {
      const y = labelH + di * step + cellSize - 2;
      daysSvg += '<text x="0" y="' + y + '" class="gpt-hm-label gpt-hm-day">' + DAYS[di] + '</text>';
    });

    const tooltip = '<div id="gpt-hm-tip" class="gpt-hm-tip" style="display:none"></div>';

    return '<div class="gpt-heatmap-section">' +
      '<div class="gpt-heatmap-header">' +
        '<span class="gpt-stats-ext-title">Commit activity</span>' +
        '<span class="gpt-heatmap-total">' + totalCommits + ' commits in the last year</span>' +
      '</div>' +
      '<div class="gpt-heatmap-wrap">' +
        '<svg class="gpt-hm-svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" height="' + svgH + '">' +
          monthSvg + daysSvg + cells +
        '</svg>' +
        tooltip +
      '</div>' +
      '<div class="gpt-hm-legend">' +
        '<span class="gpt-hm-leg-lbl">Less</span>' +
        [0,1,2,3,4].map(l => '<span class="gpt-hm-leg-cell gpt-hm-lv' + l + '"></span>').join('') +
        '<span class="gpt-hm-leg-lbl">More</span>' +
      '</div>' +
    '</div>';
  }

  function attachHeatmapTooltip(panel) {
    const svg = panel.querySelector('.gpt-hm-svg');
    const tip = panel.querySelector('#gpt-hm-tip');
    if (!svg || !tip) return;
    svg.addEventListener('mousemove', e => {
      const cell = e.target.closest('.gpt-hm-cell');
      if (!cell) { tip.style.display = 'none'; return; }
      const count = cell.dataset.count;
      const date = cell.dataset.date;
      tip.textContent = count + ' commit' + (count === '1' ? '' : 's') + ' on ' + date;
      const rect = panel.querySelector('.gpt-heatmap-wrap').getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = (e.clientX - rect.left + 10) + 'px';
      tip.style.top = (e.clientY - rect.top - 28) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  }

  function toggleStatsPanel() {
    const existing = document.getElementById('gpt-stats-panel');
    const btn = document.getElementById('gpt-btn-stats');
    if (existing) { existing.remove(); btn?.classList.remove('gpt-btn-active'); return; }
    btn?.classList.add('gpt-btn-active');

    const rows = getFileRows();
    let files = 0, dirs = 0;
    const exts = {};
    rows.forEach(row => {
      const name = getFileNameFromRow(row);
      if (!name) return;
      if (isDirectory(row)) { dirs++; }
      else { files++; const e = name.includes('.') ? name.split('.').pop().toLowerCase() : '—'; exts[e] = (exts[e]||0)+1; }
    });
    const topExts = Object.entries(exts).sort((a,b) => b[1]-a[1]).slice(0,10);

    const panel = document.createElement('div');
    panel.id = 'gpt-stats-panel';
    panel.innerHTML =
      '<div class="gpt-stats-grid">' +
        '<div class="gpt-stat-card gpt-stat-total"><span class="gpt-stat-num">' + (files+dirs) + '</span><span class="gpt-stat-lbl">Total</span></div>' +
        '<div class="gpt-stat-card gpt-stat-files"><span class="gpt-stat-num">' + files + '</span><span class="gpt-stat-lbl">Files</span></div>' +
        '<div class="gpt-stat-card gpt-stat-dirs"><span class="gpt-stat-num">' + dirs + '</span><span class="gpt-stat-lbl">Folders</span></div>' +
        '<div class="gpt-stat-card gpt-stat-types"><span class="gpt-stat-num">' + topExts.length + '</span><span class="gpt-stat-lbl">Types</span></div>' +
      '</div>' +
      (topExts.length ?
        '<div class="gpt-stats-ext-section">' +
          '<div class="gpt-stats-ext-title">File types</div>' +
          '<div class="gpt-ext-list">' +
            topExts.map(([e,c]) => {
              const pct = Math.round((c/files)*100);
              return '<div class="gpt-ext-row"><span class="gpt-ext-name">.' + e + '</span><div class="gpt-ext-bar-wrap"><div class="gpt-ext-bar" style="width:' + pct + '%"></div></div><span class="gpt-ext-count">' + c + '</span></div>';
            }).join('') +
          '</div>' +
        '</div>' : '') +
      '<div class="gpt-heatmap-section gpt-heatmap-loading">' +
        '<div class="gpt-stats-ext-title" style="padding:12px 14px 6px">Commit activity</div>' +
        '<div class="gpt-hm-spinner-wrap"><div class="gpt-hm-spinner"></div><span>Loading commit history…</span></div>' +
      '</div>';

    // PRIMARY: use findColumnLayout() — walks up from a file row until it finds
    // a parent that has BOTH the file block AND a README/prompt sibling.
    // Then inserts the panel directly before the README block at that DOM level.
    const layout = findColumnLayout();
    if (layout) {
      layout.readmeBlock.insertAdjacentElement('beforebegin', panel);
    } else if (rows.length) {
      // FALLBACK: put it after the last file row's closest table/container, max 2 levels up
      const lastRow = rows[rows.length - 1];
      let tableEl = lastRow.parentElement;
      if (tableEl && tableEl.tagName === 'TBODY') tableEl = tableEl.parentElement;
      if (tableEl) tableEl.insertAdjacentElement('afterend', panel);
    } else {
      // LAST RESORT: after the button group's parent
      const group = document.getElementById('gpt-btn-group');
      if (group?.parentElement) group.parentElement.insertAdjacentElement('afterend', panel);
    }

    // Now fetch heatmap data asynchronously and replace the loading placeholder
    const { owner, repo } = getRepoInfo();
    fetchCommitActivity(owner, repo).then(weeks => {
      const heatmapSection = panel.querySelector('.gpt-heatmap-section');
      if (!heatmapSection) return;
      if (!weeks || !weeks.length) {
        heatmapSection.innerHTML = '<div class="gpt-hm-error">Could not load commit activity.</div>';
        return;
      }
      heatmapSection.outerHTML = renderHeatmap(weeks);
      attachHeatmapTooltip(panel);
    }).catch(() => {
      const heatmapSection = panel.querySelector('.gpt-heatmap-section');
      if (heatmapSection) heatmapSection.innerHTML = '<div class="gpt-hm-error">Could not load commit activity.</div>';
    });
  }

  function injectFileBlobButtons() {
    document.getElementById('gpt-blob-wrapper')?.remove();
    const { owner, repo } = getRepoInfo();
    const branch = getBranch();
    const filePath = getCurrentPath();
    if (!filePath) return;

    const fileName = filePath.split('/').pop();
    const ep = encodePath(filePath);
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const isImage = ['png','jpg','jpeg','gif','webp','svg','ico'].includes(ext);
    const isEdit = isFileEditPage();

    const anchorBtn = findMoreFileActionsButton();
    if (!anchorBtn) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'gpt-blob-wrapper';
    wrapper.className = 'gpt-blob-wrapper';

    const group = document.createElement('div');
    group.className = 'gpt-blob-btns';

    const mkLink = (text, iconKey, href) => {
      const a = document.createElement('a');
      a.href = href;
      a.className = 'gpt-btn';
      a.innerHTML = ICONS[iconKey] + '<span class="gpt-btn-label">' + text + '</span>';
      return a;
    };
    const mkBtnEl = (text, iconKey, extraCls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gpt-btn' + (extraCls ? ' ' + extraCls : '');
      b.innerHTML = ICONS[iconKey] + '<span class="gpt-btn-label">' + text + '</span>';
      return b;
    };

    if (!isEdit) {
      group.appendChild(mkLink('Edit', 'edit', 'https://github.com/' + owner + '/' + repo + '/edit/' + branch + '/' + ep));
    }

    group.appendChild(mkLink('Raw', 'raw', 'https://github.com/' + owner + '/' + repo + '/raw/' + branch + '/' + ep));

    if (!isImage) {
      group.appendChild(mkLink('Blame', 'blame', 'https://github.com/' + owner + '/' + repo + '/blame/' + branch + '/' + ep));
    }

    group.appendChild(mkLink('History', 'history', 'https://github.com/' + owner + '/' + repo + '/commits/' + branch + '/' + ep));

    const copyBtn = mkBtnEl('Copy path', 'copy');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(filePath)
        .then(() => showToast('Path copied!'))
        .catch(() => showToast('Copy failed', 'warn'));
    });
    group.appendChild(copyBtn);

    const deleteBtn = mkLink('Delete', 'trash', 'https://github.com/' + owner + '/' + repo + '/delete/' + branch + '/' + ep);
    deleteBtn.className = 'gpt-btn gpt-btn-danger';
    group.appendChild(deleteBtn);

    wrapper.appendChild(group);

    const anchorParent = anchorBtn.closest('[class*="ButtonGroup"],[role="group"]') || anchorBtn.parentElement;
    if (anchorParent && anchorParent.parentElement) {
      anchorParent.parentElement.insertBefore(wrapper, anchorParent);
    } else {
      anchorBtn.parentElement.insertBefore(wrapper, anchorBtn);
    }
  }

  let _toastTimer;
  function showToast(msg, type) {
    type = type || 'ok';
    document.getElementById('gpt-toast')?.remove();
    clearTimeout(_toastTimer);
    const t = document.createElement('div');
    t.id = 'gpt-toast';
    t.className = 'gpt-toast gpt-toast-' + type;
    t.textContent = (type === 'warn' ? '⚠ ' : '✓ ') + msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('gpt-toast-show')));
    _toastTimer = setTimeout(() => {
      t.classList.remove('gpt-toast-show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  function reset() {
    if (selectionMode) restoreSelectModeOthers();
    selectionMode = false;
    selectedFiles.clear();
    hiddenElements = [];
    ['gpt-btn-group','gpt-stats-panel','gpt-toast','gpt-modal','gpt-blob-wrapper'].forEach(id =>
      document.getElementById(id)?.remove());
    document.querySelectorAll('.gpt-cb').forEach(el => el.remove());
    document.querySelectorAll('.gpt-row-sel,.gpt-row-selectable').forEach(el =>
      el.classList.remove('gpt-row-sel','gpt-row-selectable'));
  }

  function tryInject() {
    if (isRepoFilePage()) {
      let t = 0;
      const iv = setInterval(() => {
        if (findAddFileButton()) {
          clearInterval(iv);
          injectButtons();
        }
        if (++t > 40) clearInterval(iv);
      }, 150);
    } else if (isFileBlobPage() || isFileEditPage()) {
      let t = 0;
      const iv = setInterval(() => {
        if (findMoreFileActionsButton()) { clearInterval(iv); injectFileBlobButtons(); }
        if (++t > 40) clearInterval(iv);
      }, 200);
    }
  }

  
  
  
  function findDeleteInput() {
    
    const byClass = document.querySelector('input.js-repo-delete-proceed-confirmation');
    if (byClass) return byClass;

    
    
    const explicit = [
      '#verification_field',
      'input[data-testid="repo-delete-proceed-button-text-input"]',
      'input[data-testid="text-input-component"]',
    ];
    for (const s of explicit) {
      const el = document.querySelector(s);
      if (el) return el;
    }

    
    const byName = document.querySelector('input[name="verification_field"]');
    if (byName) return byName;

    return null;
  }

  function injectDeleteRepoAutofill() {
    if (document.getElementById('gpt-autofill-wrap')) return;
    const input = findDeleteInput();
    if (!input) return;

    
    const dialog = input.closest('dialog,[role="dialog"],[class*="modal"],[class*="Modal"],[class*="Dialog"],[class*="Overlay"]') || document.body;
    const quoted = dialog.textContent.match(/[“"]([\w.\-]+\/[\w.\-]+)[”"]/);
    const expectedText = quoted
      ? quoted[1]
      : (() => { const p = location.pathname.split('/').filter(Boolean); return p[0] + '/' + p[1]; })();

    if (!expectedText || !expectedText.includes('/')) return;

    const wrap = document.createElement('div');
    wrap.id = 'gpt-autofill-wrap';
    wrap.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:6px;width:100%;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = [
      'display:flex','align-items:center','justify-content:center','gap:6px',
      'width:100%','padding:7px 16px',
      'font-size:14px','font-weight:600','cursor:pointer','border-radius:6px',
      'border:1px solid rgba(240,246,252,.15)','background:#21262d','color:#e6edf3',
      'line-height:20px','font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'transition:background .12s,border-color .12s','box-sizing:border-box',
    ].join(';');
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">' +
        '<path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474' +
        'l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25' +
        'c.081-.286.235-.547.445-.758l8.61-8.61Z"/>' +
      '</svg>Auto-fill';

    const hint = document.createElement('span');
    hint.textContent = '\u201c' + expectedText + '\u201d';
    hint.style.cssText = 'font-size:11px;color:#8b949e;font-family:ui-monospace,monospace;word-break:break-all;text-align:center;';

    const ICON_FILL = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>';
    const ICON_CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    const setFilled = () => {
      btn.innerHTML = ICON_CHECK + 'Unfill';
      btn.style.background = 'rgba(46,160,67,.15)';
      btn.style.borderColor = '#238636';
      btn.style.color = '#3fb950';
      btn._filled = true;
    };

    const setEmpty = () => {
      btn.innerHTML = ICON_FILL + 'Auto-fill';
      btn.style.background = '#21262d';
      btn.style.borderColor = 'rgba(240,246,252,.15)';
      btn.style.color = '#e6edf3';
      btn._filled = false;
    };

    input.addEventListener('input', () => {
      if (input.value === expectedText) setFilled();
      else setEmpty();
    });

    btn.addEventListener('mouseenter', () => {
      if (!btn._filled) { btn.style.background='#30363d'; btn.style.borderColor='#8b949e'; }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn._filled) { btn.style.background='#21262d'; btn.style.borderColor='rgba(240,246,252,.15)'; }
    });

    btn.addEventListener('click', () => {
      if (btn._filled) {
        setter.call(input, '');
        ['input','change','keyup','keydown'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
        input.focus();
        setEmpty();
      } else {
        setter.call(input, expectedText);
        ['input','change','keyup','keydown'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
        input.focus();
        setFilled();
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(hint);

    
    
    const submitBtn = input.closest('form,dialog,[role="dialog"],[class*="Box"],[class*="modal"],[class*="Modal"]')
      ?.querySelector('button[type="submit"],input[type="submit"],button.btn-danger,button[data-testid*="delete"],button[data-testid*="proceed"]');
    const anchor = submitBtn || input;
    anchor.insertAdjacentElement('afterend', wrap);
  }

  
  let _deleteCheckTimer = null;
  new MutationObserver(() => {
    clearTimeout(_deleteCheckTimer);
    _deleteCheckTimer = setTimeout(() => {
      const existing = document.getElementById('gpt-autofill-wrap');
      const input = findDeleteInput();
      if (input && !existing) {
        
        injectDeleteRepoAutofill();
      } else if (!input && existing) {
        
        existing.remove();
      }
    }, 50);
  }).observe(document.body, { childList: true, subtree: true });

  

  
  let _lastUrl = location.href;
  let _reinjectTimer = null;

  function tryInjectAll() {
    
    if (isRepoFilePage()) {
      if (!document.getElementById('gpt-btn-group')) {
        if (findAddFileButton()) {
          injectButtons();
        } else {
          
          let t = 0;
          const iv = setInterval(() => {
            if (findAddFileButton()) { clearInterval(iv); injectButtons(); }
            if (++t > 60) clearInterval(iv);
          }, 150);
        }
      }
    
    } else if (isFileBlobPage() || isFileEditPage()) {
      if (!document.getElementById('gpt-blob-wrapper')) {
        if (findMoreFileActionsButton()) {
          injectFileBlobButtons();
        } else {
          let t = 0;
          const iv = setInterval(() => {
            if (findMoreFileActionsButton()) { clearInterval(iv); injectFileBlobButtons(); }
            if (++t > 60) clearInterval(iv);
          }, 150);
        }
      }
    }
  }

  new MutationObserver(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      reset();
      clearTimeout(_reinjectTimer);
      _reinjectTimer = setTimeout(tryInjectAll, 400);
    } else {
      
      clearTimeout(_reinjectTimer);
      _reinjectTimer = setTimeout(() => {
        if (isRepoFilePage() && !document.getElementById('gpt-btn-group')) {
          if (findAddFileButton()) {
            injectButtons();
          } else {
            
            let t = 0;
            const iv = setInterval(() => {
              if (document.getElementById('gpt-btn-group')) { clearInterval(iv); return; }
              if (findAddFileButton()) { clearInterval(iv); injectButtons(); return; }
              if (++t > 40) clearInterval(iv);
            }, 150);
          }
        } else if ((isFileBlobPage() || isFileEditPage()) && !document.getElementById('gpt-blob-wrapper')) {
          if (findMoreFileActionsButton()) {
            injectFileBlobButtons();
          } else {
            let t = 0;
            const iv = setInterval(() => {
              if (document.getElementById('gpt-blob-wrapper')) { clearInterval(iv); return; }
              if (findMoreFileActionsButton()) { clearInterval(iv); injectFileBlobButtons(); return; }
              if (++t > 40) clearInterval(iv);
            }, 150);
          }
        }
      }, 300);
    }
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(tryInjectAll, 600);

})();
