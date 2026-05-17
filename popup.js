(function () {
  /* Logo fallback */
  var img = document.getElementById('logo-img');
  var svg = document.getElementById('logo-svg');
  if (img && svg) {
    img.addEventListener('error', function () {
      img.style.display = 'none';
      svg.style.display = 'block';
    });
  }

  /* API key settings */
  var toggle   = document.getElementById('api-mode-toggle');
  var keyWrap  = document.getElementById('api-key-wrap');
  var keyInput = document.getElementById('api-key-input');
  var saveBtn  = document.getElementById('api-key-save');
  var status   = document.getElementById('api-key-status');

  function setStatus(msg, type) {
    status.textContent = msg;
    status.className = 'api-key-status' + (type ? ' ' + type : '');
  }

  /* Load saved state */
  chrome.storage.local.get(['unjank_api_mode', 'unjank_api_key'], function (res) {
    var mode = !!res.unjank_api_mode;
    toggle.checked = mode;
    if (mode) keyWrap.classList.add('visible');
    if (res.unjank_api_key) {
      keyInput.value = res.unjank_api_key;
      setStatus('✓ Token saved', 'ok');
    }
  });

  toggle.addEventListener('change', function () {
    var on = toggle.checked;
    chrome.storage.local.set({ unjank_api_mode: on });
    if (on) {
      keyWrap.classList.add('visible');
    } else {
      keyWrap.classList.remove('visible');
    }
  });

  saveBtn.addEventListener('click', function () {
    var val = keyInput.value.trim();
    if (!val) {
      chrome.storage.local.remove('unjank_api_key');
      setStatus('Token cleared', 'warn');
      return;
    }
    if (!val.startsWith('ghp_') && !val.startsWith('github_pat_') && !val.startsWith('gho_')) {
      setStatus('⚠ Doesn\'t look like a GitHub token', 'warn');
    }
    chrome.storage.local.set({ unjank_api_key: val }, function () {
      setStatus('✓ Token saved', 'ok');
    });
  });

  /* Allow Enter to save */
  keyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveBtn.click();
  });
})();
