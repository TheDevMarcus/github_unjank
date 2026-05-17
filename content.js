(function () {
  'use strict';

  let selectedItems = new Map();
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
    folder:   '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>',
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
    selectedItems.clear();
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
      const path = getFilePathFromRow(row) || name;
      const dir = isDirectory(row);

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
          selectedItems.delete(name);
        } else {
          wrap.setAttribute('aria-checked', 'true');
          wrap.classList.add('gpt-cb-on');
          row.classList.add('gpt-row-sel');
          selectedItems.set(name, { path, isDir: dir });
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
    selectedItems.clear();
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
        selectedItems.set(name, { path: getFilePathFromRow(row) || name, isDir: isDirectory(row) });
      }
    });
    updateCount();
    showToast(selectedItems.size + ' items selected');
  }

  function deselectAll() {
    getFileRows().forEach(row => {
      const cb = row.querySelector('.gpt-cb');
      if (cb) { cb.setAttribute('aria-checked', 'false'); cb.classList.remove('gpt-cb-on'); }
      row.classList.remove('gpt-row-sel');
    });
    selectedItems.clear();
    updateCount();
  }

  function updateCount() {
    const el = document.getElementById('gpt-sel-count');
    if (el) el.textContent = selectedItems.size;
  }

  function deleteSelected() {
    if (!selectedItems.size) { showToast('No items selected', 'warn'); return; }
    showDeleteModal([...selectedItems.values()]);
  }

  function showDeleteModal(items) {
    getStorageSettings(settings => {
      const apiMode = !!(settings.unjank_api_mode && settings.unjank_api_key);
      _showDeleteModalUI(items, apiMode, settings.unjank_api_key || '');
    });
  }

  function _showDeleteModalUI(items, apiMode, token) {
    document.getElementById('gpt-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'gpt-modal';

    const count = items.length;
    const actionLabel = apiMode
      ? 'Delete ' + count + ' item' + (count !== 1 ? 's' : '') + ' via API'
      : 'Open ' + count + ' delete tab' + (count !== 1 ? 's' : '');
    const subText = apiMode
      ? 'Items will be permanently deleted using the GitHub API. Folders are deleted recursively. This cannot be undone.'
      : 'Each file opens a GitHub delete confirmation tab. Folders cannot be deleted this way — enable API key mode for folder deletion.';

    overlay.innerHTML =
      '<div class="gpt-modal-box" role="dialog" aria-modal="true" aria-labelledby="gpt-modal-title">' +
        '<div class="gpt-modal-hd">' +
          '<div class="gpt-modal-hd-left">' + ICONS.trash +
            '<h3 id="gpt-modal-title">Delete ' + count + ' item' + (count !== 1 ? 's' : '') + '?</h3>' +
          '</div>' +
          '<button class="gpt-icon-btn" id="gpt-modal-x" aria-label="Close">' + ICONS.close + '</button>' +
        '</div>' +
        '<p class="gpt-modal-sub">' + subText + '</p>' +
        '<ul class="gpt-modal-list">' + items.map(it => '<li class="gpt-modal-file-item">' + (it.isDir ? ICONS.folder : ICONS.file) + '<code>' + it.path + '</code></li>').join('') + '</ul>' +
        '<div class="gpt-modal-footer">' +
          '<button id="gpt-modal-cancel" class="gpt-btn" type="button">Cancel</button>' +
          '<button id="gpt-modal-go" class="gpt-btn gpt-btn-danger" type="button">' + ICONS.trash + ' ' + actionLabel + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('gpt-modal-x').onclick = () => overlay.remove();
    document.getElementById('gpt-modal-cancel').onclick = () => overlay.remove();
    document.getElementById('gpt-modal-go').onclick = () => {
      overlay.remove();
      if (apiMode) {
        deleteViaApi(items, token);
      } else {
        openDeletePages(items);
      }
    };
    overlay.addEventListener('click', e => e.target === overlay && overlay.remove());
    document.getElementById('gpt-modal-go').focus();
  }

  function openDeletePages(items) {
    const { owner, repo } = getRepoInfo();
    const branch = getBranch();
    const files = items.filter(it => !it.isDir);
    const dirs = items.filter(it => it.isDir);
    if (dirs.length) showToast(dirs.length + ' folder' + (dirs.length !== 1 ? 's' : '') + ' skipped — enable API key mode to delete folders', 'warn');
    files.forEach((it, i) => setTimeout(() =>
      window.open('https://github.com/' + owner + '/' + repo + '/delete/' + branch + '/' + encodePath(it.path), '_blank'), i * 350));
    toggleSelectMode();
    if (files.length) showToast('Opening ' + files.length + ' delete tab' + (files.length !== 1 ? 's' : '') + '…');
  }

  function getStorageSettings(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['unjank_api_mode', 'unjank_api_key'], cb);
    } else {
      cb({});
    }
  }

  async function apiListDir(owner, repo, dirPath, branch, token) {
    const res = await fetch(
      'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' +
      dirPath.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch),
      { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'HTTP ' + res.status); }
    return await res.json();
  }

  async function apiDeleteSingleFile(owner, repo, filePath, branch, token) {
    const metaRes = await fetch(
      'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' +
      filePath.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch),
      { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' } }
    );
    if (!metaRes.ok) { const e = await metaRes.json().catch(() => ({})); throw new Error(e.message || 'HTTP ' + metaRes.status); }
    const meta = await metaRes.json();
    if (Array.isArray(meta)) throw new Error('Expected file but got directory');
    const delRes = await fetch(
      'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' +
      filePath.split('/').map(encodeURIComponent).join('/'),
      {
        method: 'DELETE',
        headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Delete ' + filePath, sha: meta.sha, branch }),
      }
    );
    if (!delRes.ok) { const e = await delRes.json().catch(() => ({})); throw new Error(e.message || 'HTTP ' + delRes.status); }
  }

  async function apiDeleteRecursive(owner, repo, path, branch, token, onProgress) {
    const entries = await apiListDir(owner, repo, path, branch, token);
    for (const entry of entries) {
      if (entry.type === 'dir') {
        await apiDeleteRecursive(owner, repo, entry.path, branch, token, onProgress);
      } else {
        await apiDeleteSingleFile(owner, repo, entry.path, branch, token);
        if (onProgress) onProgress(entry.path);
      }
    }
  }

  async function deleteViaApi(items, token) {
    const { owner, repo } = getRepoInfo();
    const branch = getBranch();
    let done = 0, failed = [];

    showToast('Deleting ' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '…');

    for (const item of items) {
      try {
        if (item.isDir) {
          await apiDeleteRecursive(owner, repo, item.path, branch, token, () => { done++; });
        } else {
          await apiDeleteSingleFile(owner, repo, item.path, branch, token);
          done++;
        }
      } catch (e) {
        failed.push(item.path + ': ' + e.message);
      }
    }

    toggleSelectMode();

    if (failed.length === 0) {
      showToast('Deleted ' + done + ' file' + (done !== 1 ? 's' : ''));
    } else if (done === 0) {
      showToast('Delete failed: ' + failed[0], 'warn');
    } else {
      showToast(done + ' deleted, ' + failed.length + ' failed', 'warn');
    }

    if (done > 0) setTimeout(() => location.reload(), 800);
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

  function childOf(el, targetParent) {
    let node = el;
    while (node && node.parentElement) {
      if (node.parentElement === targetParent) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findColumnLayout() {
    const rows = getFileRows();
    if (!rows.length) return null;

    let el = rows[0].closest('table,div[role="grid"],div[role="table"]') || rows[0].parentElement;
    let depth = 0;
    while (el && el.parentElement && depth < 8) {
      depth++;
      const parent = el.parentElement;

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

    const url = 'https://api.github.com/repos/' + owner + '/' + repo + '/stats/commit_activity';
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.status === 202) {

        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!res.ok) return null;
      return await res.json(); 
    }
    return null;
  }

  function renderHeatmap(weeks) {
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const allVals = weeks.flatMap(w => w.days);
    const max = Math.max(...allVals, 1);

    function level(v) {
      if (v === 0) return 0;
      if (v <= max * 0.15) return 1;
      if (v <= max * 0.40) return 2;
      if (v <= max * 0.70) return 3;
      return 4;
    }

    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((w, wi) => {
      const d = new Date(w.week * 1000);
      const m = d.getMonth();
      if (m !== lastMonth) { monthLabels.push({ wi, label: MONTHS[m] }); lastMonth = m; }
    });

    const totalCommits = weeks.reduce((s, w) => s + w.total, 0);

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

    const layout = findColumnLayout();
    if (layout) {
      layout.readmeBlock.insertAdjacentElement('beforebegin', panel);
    } else if (rows.length) {

      const lastRow = rows[rows.length - 1];
      let tableEl = lastRow.parentElement;
      if (tableEl && tableEl.tagName === 'TBODY') tableEl = tableEl.parentElement;
      if (tableEl) tableEl.insertAdjacentElement('afterend', panel);
    } else {

      const group = document.getElementById('gpt-btn-group');
      if (group?.parentElement) group.parentElement.insertAdjacentElement('afterend', panel);
    }

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

    const deleteBtn = mkBtnEl('Delete', 'trash', 'gpt-btn-danger');
    deleteBtn.addEventListener('click', () => {
      const ep2 = encodePath(filePath);
      getStorageSettings(settings => {
        if (settings.unjank_api_mode && settings.unjank_api_key) {

          const fileName = filePath.split('/').pop();
          if (!confirm('Delete "' + fileName + '" via GitHub API?\n\nThis cannot be undone.')) return;
          const { owner: o2, repo: r2 } = getRepoInfo();
          const br2 = getBranch();
          showToast('Deleting…');
          apiDeleteSingleFile(o2, r2, filePath, br2, settings.unjank_api_key)
            .then(() => { showToast('Deleted ' + fileName); setTimeout(() => history.back(), 900); })
            .catch(e => showToast('Delete failed: ' + e.message, 'warn'));
        } else {
          window.location.href = 'https://github.com/' + owner + '/' + repo + '/delete/' + branch + '/' + ep2;
        }
      });
    });
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
    selectedItems.clear();
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
    const byTestId = document.querySelector('input[data-testid="repo-delete-proceed-button-text-input"]');
    if (byTestId) return byTestId;
    const dialogs = document.querySelectorAll('dialog,[role="dialog"],[class*="modal"],[class*="Modal"],[class*="Dialog"],[class*="Overlay"]');
    for (const dlg of dialogs) {
      if (/delete\s+(this\s+)?repositor/i.test(dlg.textContent)) {
        const inp = dlg.querySelector('input[type="text"],input:not([type])');
        if (inp) return inp;
      }
    }
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

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    function reactSetValue(el, val) {

      const tracker = el._valueTracker;
      if (tracker) tracker.setValue(el.value);
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

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

    const findSubmitBtn = () => input.closest('form,dialog,[role="dialog"],[class*="Box"],[class*="modal"],[class*="Modal"]')
      ?.querySelector('button[type="submit"],input[type="submit"],button.btn-danger,button[data-testid*="delete"],button[data-testid*="proceed"]');

    btn.addEventListener('click', () => {
      if (btn._filled) {
        reactSetValue(input, '');

        const sb = findSubmitBtn();
        if (sb) sb.disabled = true;
        input.focus();
        setEmpty();
      } else {
        reactSetValue(input, expectedText);

        const sb = findSubmitBtn();
        if (sb) {
          sb.disabled = false;
          sb.removeAttribute('disabled');
          sb.setAttribute('aria-disabled', 'false');
        }
        input.focus();
        setFilled();
      }
    });

    const ICON_BOLT = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.504.43a1.516 1.516 0 0 1 .396 1.544L8.57 6h4.43a1.516 1.516 0 0 1 1.06 2.59l-6 6a1.516 1.516 0 0 1-2.516-1.427L6.835 9H2a1.516 1.516 0 0 1-1.06-2.59l7-7a1.516 1.516 0 0 1 1.564-.98Z"/></svg>';

    const instantBtn = document.createElement('button');
    instantBtn.type = 'button';
    instantBtn.style.cssText = [
      'display:flex','align-items:center','justify-content:center','gap:6px',
      'width:100%','padding:7px 16px',
      'font-size:14px','font-weight:600','cursor:pointer','border-radius:6px',
      'border:1px solid #b91c1c','background:rgba(185,28,28,.15)','color:#f87171',
      'line-height:20px','font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'transition:background .12s,border-color .12s','box-sizing:border-box',
    ].join(';');
    instantBtn.innerHTML = ICON_BOLT + 'Delete — no pop-up';

    instantBtn.addEventListener('mouseenter', () => {
      instantBtn.style.background = 'rgba(185,28,28,.35)';
      instantBtn.style.borderColor = '#ef4444';
    });
    instantBtn.addEventListener('mouseleave', () => {
      instantBtn.style.background = 'rgba(185,28,28,.15)';
      instantBtn.style.borderColor = '#b91c1c';
    });

    instantBtn.addEventListener('click', () => {

      reactSetValue(input, expectedText);
      setFilled();

      const sb = findSubmitBtn();
      if (sb) {
        sb.disabled = false;
        sb.removeAttribute('disabled');
        sb.setAttribute('aria-disabled', 'false');

        setTimeout(() => sb.click(), 50);
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(instantBtn);
    wrap.appendChild(hint);

    const anchor = findSubmitBtn() || input;
    anchor.insertAdjacentElement('afterend', wrap);
  }

  function findArchiveInput() {
    const byClass = document.querySelector('input.js-repo-archive-proceed-confirmation');
    if (byClass) return byClass;
    const byTestId = document.querySelector('input[data-testid="repo-archive-proceed-button-text-input"]');
    if (byTestId) return byTestId;
    const dialogs = document.querySelectorAll('dialog,[role="dialog"],[class*="modal"],[class*="Modal"],[class*="Dialog"],[class*="Overlay"]');
    for (const dlg of dialogs) {
      if (/archive\s+(this\s+)?repositor/i.test(dlg.textContent)) {
        const inp = dlg.querySelector('input[type="text"],input:not([type])');
        if (inp) return inp;
      }
    }
    return null;
  }

  function injectArchiveAutofill() {
    if (document.getElementById('gpt-archive-wrap')) return;
    const input = findArchiveInput();
    if (!input) return;

    const dialog = input.closest('dialog,[role="dialog"],[class*="modal"],[class*="Modal"],[class*="Dialog"],[class*="Overlay"]') || document.body;
    const quoted = dialog.textContent.match(/["“‘]([\w.\-]+\/[\w.\-]+)["”’]/);
    const expectedText = quoted
      ? quoted[1]
      : (() => { const p = location.pathname.split('/').filter(Boolean); return p[0] + '/' + p[1]; })();

    if (!expectedText || !expectedText.includes('/')) return;

    const wrap = document.createElement('div');
    wrap.id = 'gpt-archive-wrap';
    wrap.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:6px;width:100%;';

    const btnStyle = [
      'display:flex','align-items:center','justify-content:center','gap:6px',
      'width:100%','padding:7px 16px',
      'font-size:14px','font-weight:600','cursor:pointer','border-radius:6px',
      'line-height:20px','font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'transition:background .12s,border-color .12s','box-sizing:border-box',
    ].join(';');

    const ICON_FILL = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>';
    const ICON_CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';
    const ICON_BOLT = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.504.43a1.516 1.516 0 0 1 .396 1.544L8.57 6h4.43a1.516 1.516 0 0 1 1.06 2.59l-6 6a1.516 1.516 0 0 1-2.516-1.427L6.835 9H2a1.516 1.516 0 0 1-1.06-2.59l7-7a1.516 1.516 0 0 1 1.564-.98Z"/></svg>';

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    function reactSetValue(el, val) {
      const tracker = el._valueTracker;
      if (tracker) tracker.setValue(el.value);
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const findSubmitBtn = () => input.closest('form,dialog,[role="dialog"],[class*="Box"],[class*="modal"],[class*="Modal"]')
      ?.querySelector('button[type="submit"],input[type="submit"],button.btn-danger,button[data-testid*="archive"],button[data-testid*="proceed"]');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = btnStyle + ';border:1px solid rgba(240,246,252,.15);background:#21262d;color:#e6edf3;';
    btn.innerHTML = ICON_FILL + 'Auto-fill';

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
      if (input.value === expectedText) setFilled(); else setEmpty();
    });

    btn.addEventListener('mouseenter', () => {
      if (!btn._filled) { btn.style.background='#30363d'; btn.style.borderColor='#8b949e'; }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn._filled) { btn.style.background='#21262d'; btn.style.borderColor='rgba(240,246,252,.15)'; }
    });

    btn.addEventListener('click', () => {
      if (btn._filled) {
        reactSetValue(input, '');
        const sb = findSubmitBtn();
        if (sb) sb.disabled = true;
        input.focus();
        setEmpty();
      } else {
        reactSetValue(input, expectedText);
        const sb = findSubmitBtn();
        if (sb) {
          sb.disabled = false;
          sb.removeAttribute('disabled');
          sb.setAttribute('aria-disabled', 'false');
        }
        input.focus();
        setFilled();
      }
    });

    const instantBtn = document.createElement('button');
    instantBtn.type = 'button';
    instantBtn.style.cssText = btnStyle + ';border:1px solid #92400e;background:rgba(146,64,14,.15);color:#fbbf24;';
    instantBtn.innerHTML = ICON_BOLT + 'Archive — no pop-up';

    instantBtn.addEventListener('mouseenter', () => {
      instantBtn.style.background = 'rgba(146,64,14,.35)';
      instantBtn.style.borderColor = '#f59e0b';
    });
    instantBtn.addEventListener('mouseleave', () => {
      instantBtn.style.background = 'rgba(146,64,14,.15)';
      instantBtn.style.borderColor = '#92400e';
    });

    instantBtn.addEventListener('click', () => {
      reactSetValue(input, expectedText);
      setFilled();
      const sb = findSubmitBtn();
      if (sb) {
        sb.disabled = false;
        sb.removeAttribute('disabled');
        sb.setAttribute('aria-disabled', 'false');
        setTimeout(() => sb.click(), 50);
      }
    });

    const hint = document.createElement('span');
    hint.textContent = '“' + expectedText + '”';
    hint.style.cssText = 'font-size:11px;color:#8b949e;font-family:ui-monospace,monospace;word-break:break-all;text-align:center;';

    wrap.appendChild(btn);
    wrap.appendChild(instantBtn);
    wrap.appendChild(hint);

    const anchor = findSubmitBtn() || input;
    anchor.insertAdjacentElement('afterend', wrap);
  }

  let _deleteCheckTimer = null;
  new MutationObserver(() => {
    clearTimeout(_deleteCheckTimer);
    _deleteCheckTimer = setTimeout(() => {
      const existingDel = document.getElementById('gpt-autofill-wrap');
      const delInput = findDeleteInput();
      if (delInput && !existingDel) injectDeleteRepoAutofill();
      else if (!delInput && existingDel) existingDel.remove();

      const existingArch = document.getElementById('gpt-archive-wrap');
      const archInput = findArchiveInput();
      if (archInput && !existingArch) injectArchiveAutofill();
      else if (!archInput && existingArch) existingArch.remove();
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

  function isTokenNewPage() {
    return /^\/settings\/tokens\/new/.test(location.pathname);
  }

  function injectTokenAutofill() {
    if (document.getElementById('gpt-token-banner')) return;

    const noteInput = document.querySelector('#oauth_access_description,input[name="oauth_access[description]"],#token_description,input[name="token[description]"]') ||
      (() => {
        for (const label of document.querySelectorAll('label')) {
          if (/note/i.test(label.textContent)) {
            const id = label.getAttribute('for');
            return (id && document.getElementById(id)) || label.closest('div,dd')?.querySelector('input[type="text"]');
          }
        }
        return null;
      })();

    if (!noteInput) return;

    const banner = document.createElement('div');
    banner.id = 'gpt-token-banner';
    banner.style.cssText = [
      'display:flex','align-items:center','justify-content:space-between','flex-wrap:wrap','gap:10px',
      'margin:0 0 18px','padding:12px 14px',
      'background:rgba(88,166,255,.07)','border:1px solid rgba(88,166,255,.25)','border-radius:8px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;';
    left.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="#58a6ff"><path d="M10.5 0a5.499 5.499 0 1 1-1.288 10.848l-.932.932a.749.749 0 0 1-.53.22H7v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22H5v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22h-2a.749.749 0 0 1-.53-.22l-.5-.5a.749.749 0 0 1-.22-.53V13.25a.749.749 0 0 1 .22-.53l4.801-4.8A5.502 5.502 0 0 1 10.5 0Zm0 1.5a4 4 0 0 0-3.88 4.98.75.75 0 0 1-.188.718L1.61 12.02v.73l.25.25h1.19l.5-.5V11.75a.75.75 0 0 1 .75-.75h.75V10.25a.75.75 0 0 1 .75-.75h.879l.801-.8A.75.75 0 0 1 8 8.532a4 4 0 1 0 2.5-7.032Zm.5 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>' +
      '<div><div style="font-size:13px;font-weight:600;color:#e6edf3">GitHub Unjank</div>' +
      '<div style="font-size:11px;color:#8b949e;margin-top:1px">Auto-fill this form with the correct settings for file deletion</div></div>';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'gpt-token-autofill-btn';
    btn.style.cssText = [
      'display:inline-flex','align-items:center','gap:6px','padding:6px 14px',
      'font-size:12px','font-weight:600','cursor:pointer','border-radius:6px','white-space:nowrap',
      'background:rgba(88,166,255,.15)','border:1px solid rgba(88,166,255,.35)','color:#58a6ff',
      'font-family:inherit','transition:background .12s,border-color .12s',
    ].join(';');
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>' +
      'Auto-fill for Unjank';
    btn.addEventListener('mouseenter', () => { btn.style.background='rgba(88,166,255,.25)'; btn.style.borderColor='rgba(88,166,255,.55)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background='rgba(88,166,255,.15)'; btn.style.borderColor='rgba(88,166,255,.35)'; });

    banner.appendChild(left);
    banner.appendChild(btn);

    const form = noteInput.closest('form') || document.querySelector('form#new_personal_access_token,form#oauth_access_form');
    const insertTarget = form ? form.firstElementChild : noteInput.closest('dl,div.form-group')?.parentElement;
    if (insertTarget && insertTarget.parentElement) {
      insertTarget.parentElement.insertBefore(banner, insertTarget);
    } else if (noteInput.parentElement) {
      noteInput.parentElement.insertBefore(banner, noteInput.parentElement.firstChild);
    }

    btn.addEventListener('click', () => {

      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(noteInput, 'GitHub Unjank — file deletion');
      ['input','change'].forEach(ev => noteInput.dispatchEvent(new Event(ev, { bubbles: true })));

      let repoChecked = false;
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      for (const cb of allCheckboxes) {
        const id = (cb.id || '').toLowerCase();
        const name = (cb.name || '').toLowerCase();
        const val = (cb.value || '').toLowerCase();
        const labelEl = cb.id ? document.querySelector('label[for="' + cb.id + '"]') : null;
        const labelText = labelEl ? labelEl.textContent.trim().toLowerCase() : '';

        if (val === 'repo' || id === 'repo' || name === 'repo' ||
            (labelText === 'repo' && !val.includes(':'))) {
          if (!cb.checked) {
            cb.click();
          }
          repoChecked = true;
          break;
        }
      }

      if (!repoChecked) {
        for (const label of document.querySelectorAll('label,strong,span')) {
          if (label.textContent.trim() === 'repo') {
            const cb = label.closest('div,li,dd')?.querySelector('input[type="checkbox"]') ||
              document.getElementById(label.getAttribute?.('for') || '');
            if (cb && !cb.checked) { cb.click(); repoChecked = true; break; }
          }
        }
      }

      btn.innerHTML =
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>' +
        (repoChecked ? 'Filled! Click "Generate token" to finish' : 'Note filled (scroll down to check \'repo\')');
      btn.style.background = 'rgba(63,185,80,.15)';
      btn.style.borderColor = 'rgba(63,185,80,.35)';
      btn.style.color = '#3fb950';
      btn.disabled = true;

      noteInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (isTokenNewPage()) {
    let _tokenTries = 0;
    const _tokenIv = setInterval(() => {
      if (document.getElementById('gpt-token-banner')) { clearInterval(_tokenIv); return; }
      injectTokenAutofill();
      if (++_tokenTries > 40) clearInterval(_tokenIv);
    }, 200);
  }

})();