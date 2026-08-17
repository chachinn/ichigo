(() => {
  'use strict';
  function refreshCloudCopy() {
    const note = document.querySelector('#ichigoAccountSection .ichigo-cloud-note');
    if (!note) return;
    note.innerHTML = 'Cloud Backup is available below for signed-in accounts. Your inventory remains <strong>local-first</strong>; live cross-device sync is not enabled, and cloud data never silently replaces this device.';
  }
  function schedule() {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(refreshCloudCopy, 0)));
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-nav="settings"]')) schedule();
  });
  window.addEventListener('ichigo-auth-ready', schedule);
  schedule();
})();
