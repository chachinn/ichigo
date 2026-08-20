import { app, auth } from './firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = getFirestore(app);
const DATA_KEY = 'ichigo-v1-data';
const CLOUD_META_KEY = 'ichigo-cloud-backup-meta-v1';
const LOCAL_SAFETY_KEY = 'ichigo-cloud-local-safety-v1';
const RESTORE_GUARD_KEY = 'ichigo-cloud-restore-first-guard-v1';
const SESSION_DISMISS_KEY = 'ichigo-cloud-restore-first-dismissed-v1';
const READ_LIMIT = 8;
const READ_TIMEOUT_MS = 12000;

let guardedUser = null;
let guardedBackup = null;
let inspectionPromise = null;
let restoreRunning = false;
let heldAuthDetail = null;

const qs = (selector, root = document) => root.querySelector(selector);

function withTimeout(promise, ms = READ_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('ichigo-restore-first-timeout');
        error.code = 'ichigo/restore-first-timeout';
        reject(error);
      }, ms);
    })
  ]);
}

function readLocalSummary() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    const data = raw ? JSON.parse(raw) : null;
    const products = Array.isArray(data?.products) ? data.products : [];
    return { productCount: products.length, hasInventory: products.length > 0, hasStoredData: Boolean(raw) };
  } catch (_) {
    return { productCount: 0, hasInventory: false, hasStoredData: false };
  }
}

function isManagedKey(key) {
  if (!key || !key.startsWith('ichigo-')) return false;
  if (key === 'ichigo-auth-local-mode-v1') return false;
  if (key === CLOUD_META_KEY || key === LOCAL_SAFETY_KEY || key === RESTORE_GUARD_KEY) return false;
  if (key.startsWith('ichigo-cloud-')) return false;
  return true;
}

function collectManagedKeys() {
  const keys = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (isManagedKey(key)) keys[key] = localStorage.getItem(key);
  }
  return keys;
}

function backupCollection(uid) {
  return collection(db, 'users', uid, 'ichigoBackups');
}

function backupRef(uid, backupId) {
  return doc(db, 'users', uid, 'ichigoBackups', backupId);
}

function chunkRef(uid, backupId, index) {
  return doc(db, 'users', uid, 'ichigoBackups', backupId, 'chunks', String(index).padStart(4, '0'));
}

async function listRecentBackups(uid) {
  const snapshot = await withTimeout(
    getDocs(query(backupCollection(uid), orderBy('createdAtMs', 'desc'), limit(READ_LIMIT)))
  );
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function fetchBackupSnapshot(uid, backup) {
  const chunkCount = Math.max(0, Number(backup?.chunkCount || 0));
  if (!chunkCount) throw new Error('ichigo-restore-first-no-chunks');

  const parts = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const snapshot = await withTimeout(getDoc(chunkRef(uid, backup.id, index)));
    if (!snapshot.exists()) throw new Error(`ichigo-restore-first-missing-chunk-${index}`);
    parts.push(String(snapshot.data()?.data || ''));
  }

  const parsed = JSON.parse(parts.join(''));
  if (!parsed || parsed.version !== 1 || !parsed.keys || typeof parsed.keys !== 'object') {
    throw new Error('ichigo-restore-first-invalid-format');
  }

  const dataRaw = parsed.keys[DATA_KEY];
  if (!dataRaw) return { snapshot: parsed, productCount: 0 };

  const data = JSON.parse(dataRaw);
  if (!data || !Array.isArray(data.products)) {
    throw new Error('ichigo-restore-first-invalid-inventory');
  }

  return { snapshot: parsed, productCount: data.products.length };
}

async function findUsefulBackup(uid) {
  const backups = await listRecentBackups(uid);
  if (!backups.length) return null;

  const ordered = [
    ...backups.filter(item => Number(item.productCount || 0) > 0),
    ...backups.filter(item => Number(item.productCount || 0) <= 0).slice(0, 3)
  ];

  const seen = new Set();
  for (const item of ordered) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    try {
      const loaded = await fetchBackupSnapshot(uid, item);
      if (loaded.productCount > 0) {
        return { ...item, actualProductCount: loaded.productCount, loadedSnapshot: loaded.snapshot };
      }
    } catch (error) {
      console.warn('Ichigo skipped an unreadable cloud backup while looking for a restore copy.', item.id, error);
    }
  }
  return null;
}

function guardKey(uid, backupId) {
  return `${uid || ''}:${backupId || ''}`;
}

function writeGuard(user, backup) {
  if (!user?.uid || !backup?.id) return;
  const guard = {
    uid: user.uid,
    backupId: backup.id,
    productCount: Number(backup.actualProductCount || backup.productCount || 0),
    createdAtMs: Number(backup.createdAtMs || 0),
    savedAt: Date.now(),
    reason: 'empty-device-restore-first'
  };
  try { localStorage.setItem(RESTORE_GUARD_KEY, JSON.stringify(guard)); } catch (_) {}
}

function readGuard() {
  try {
    const value = JSON.parse(localStorage.getItem(RESTORE_GUARD_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch (_) {
    return null;
  }
}

function clearGuard() {
  try { localStorage.removeItem(RESTORE_GUARD_KEY); } catch (_) {}
  guardedUser = null;
  guardedBackup = null;
  updateSettingsNotice();
}

function dismissedThisSession(uid, backupId) {
  try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === guardKey(uid, backupId); }
  catch (_) { return false; }
}

function dismissThisSession(uid, backupId) {
  try { sessionStorage.setItem(SESSION_DISMISS_KEY, guardKey(uid, backupId)); } catch (_) {}
}

function formatDateTime(ms) {
  if (!ms) return 'your latest backup';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila'
    }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toLocaleString();
  }
}

function ensureStyles() {
  if (qs('#ichigoRestoreFirstStyles')) return;
  const style = document.createElement('style');
  style.id = 'ichigoRestoreFirstStyles';
  style.textContent = `
    #ichigoRestoreFirstGate{position:fixed;inset:0;z-index:2147483000;background:rgba(67,38,47,.38);backdrop-filter:blur(8px);display:grid;place-items:center;padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px));overflow:auto}
    #ichigoRestoreFirstGate.hidden{display:none!important}
    .ichigo-restore-first-card{width:min(100%,430px);background:#fff;border:1px solid #f0d9df;border-radius:28px;box-shadow:0 24px 70px rgba(80,40,52,.22);padding:24px;text-align:center}
    .ichigo-restore-first-icon{font-size:46px;margin-bottom:7px}
    .ichigo-restore-first-card h2{font-family:Georgia,serif;color:#b53c60;font-size:25px;margin:6px 0 8px}
    .ichigo-restore-first-card p{color:#786a6e;font-size:13px;line-height:1.55;margin:0 0 14px}
    .ichigo-restore-first-summary{background:#fff7f9;border:1px solid #f1d6df;border-radius:17px;padding:12px;margin:14px 0;text-align:left;font-size:12px;line-height:1.55;color:#67595e}
    .ichigo-restore-first-actions{display:grid;gap:9px;margin-top:14px}
    .ichigo-restore-first-actions button{width:100%;min-height:48px;border-radius:16px;font-weight:850}
    #ichigoRestoreFirstNow{border:0;background:#d94c72;color:#fff}
    #ichigoRestoreFirstLater{border:1px solid #e7c5cf;background:#fff;color:#9a3855}
    #ichigoRestoreFirstStatus{margin-top:11px;font-size:11px;line-height:1.45;color:#7b6870}
    #ichigoRestoreFirstNotice{margin:0 0 16px}
  `;
  document.head.appendChild(style);
}

function ensureGate() {
  ensureStyles();
  let gate = qs('#ichigoRestoreFirstGate');
  if (gate) return gate;
  gate = document.createElement('div');
  gate.id = 'ichigoRestoreFirstGate';
  gate.className = 'hidden';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'ichigoRestoreFirstTitle');
  gate.innerHTML = `
    <div class="ichigo-restore-first-card">
      <div class="ichigo-restore-first-icon" aria-hidden="true">☁️🍓</div>
      <span class="eyebrow">ICHIGO CLOUD</span>
      <h2 id="ichigoRestoreFirstTitle">Your collection was found</h2>
      <p>This phone has an empty Ichigo collection, but your signed-in account has a protected cloud backup.</p>
      <div class="ichigo-restore-first-summary" id="ichigoRestoreFirstSummary"></div>
      <div class="ichigo-restore-first-actions">
        <button id="ichigoRestoreFirstNow" type="button">Restore my collection</button>
        <button id="ichigoRestoreFirstLater" type="button">Not now — keep cloud copy protected</button>
      </div>
      <div id="ichigoRestoreFirstStatus">Ichigo will verify the backup before changing anything on this phone.</div>
    </div>`;
  document.body.appendChild(gate);

  qs('#ichigoRestoreFirstNow')?.addEventListener('click', () => void restoreGuardedBackup());
  qs('#ichigoRestoreFirstLater')?.addEventListener('click', () => {
    if (guardedUser?.uid && guardedBackup?.id) dismissThisSession(guardedUser.uid, guardedBackup.id);
    hideGate();
    updateSettingsNotice();
  });
  return gate;
}

function showGate(user, backup) {
  const gate = ensureGate();
  const count = Number(backup.actualProductCount || backup.productCount || 0);
  const summary = qs('#ichigoRestoreFirstSummary');
  if (summary) {
    summary.innerHTML = `<strong>${count} product${count === 1 ? '' : 's'} ready to restore</strong><br>${formatDateTime(backup.createdAtMs)}<br><span style="font-size:10px">The empty phone is paused from scheduled cloud backup until this is resolved.</span>`;
  }
  const status = qs('#ichigoRestoreFirstStatus');
  if (status) status.textContent = 'Ichigo will verify the backup before changing anything on this phone.';
  gate.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideGate() {
  qs('#ichigoRestoreFirstGate')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function setRestoreBusy(value, message = '') {
  restoreRunning = value;
  const primary = qs('#ichigoRestoreFirstNow');
  const later = qs('#ichigoRestoreFirstLater');
  if (primary) {
    primary.disabled = value;
    primary.textContent = value ? 'Restoring safely…' : 'Restore my collection';
  }
  if (later) later.disabled = value;
  const status = qs('#ichigoRestoreFirstStatus');
  if (status && message) status.textContent = message;
}

function applySnapshot(snapshot) {
  const before = collectManagedKeys();
  try {
    localStorage.setItem(LOCAL_SAFETY_KEY, JSON.stringify({
      createdAtMs: Date.now(),
      reason: 'restore-first',
      keys: before
    }));
  } catch (_) {}

  const currentManaged = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (isManagedKey(key)) currentManaged.push(key);
  }

  try {
    currentManaged.forEach(key => localStorage.removeItem(key));
    Object.entries(snapshot.keys).forEach(([key, value]) => {
      if (isManagedKey(key) && typeof value === 'string') localStorage.setItem(key, value);
    });
  } catch (error) {
    try {
      const rollbackKeys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (isManagedKey(key)) rollbackKeys.push(key);
      }
      rollbackKeys.forEach(key => localStorage.removeItem(key));
      Object.entries(before).forEach(([key, value]) => {
        if (isManagedKey(key) && typeof value === 'string') localStorage.setItem(key, value);
      });
    } catch (rollbackError) {
      console.error('Ichigo restore-first rollback also failed.', rollbackError);
    }
    throw error;
  }
}

function writeRestoreMeta(backup, count) {
  try {
    const previous = JSON.parse(localStorage.getItem(CLOUD_META_KEY) || '{}');
    localStorage.setItem(CLOUD_META_KEY, JSON.stringify({
      ...(previous && typeof previous === 'object' ? previous : {}),
      lastSuccessfulBackupAt: Number(backup.createdAtMs || 0),
      lastBackupId: backup.id,
      lastBackupProductCount: count,
      lastRestoreAt: Date.now(),
      lastRestoreFromId: backup.id,
      restoreFirstCompleted: true,
      lastError: ''
    }));
  } catch (_) {}
}

async function restoreGuardedBackup() {
  const user = auth.currentUser;
  const backup = guardedBackup;
  if (!user || !backup?.id || restoreRunning) return;

  setRestoreBusy(true, 'Re-checking your protected cloud backup…');
  try {
    const freshManifestSnap = await withTimeout(getDoc(backupRef(user.uid, backup.id)));
    if (!freshManifestSnap.exists()) throw new Error('ichigo-restore-first-backup-missing');
    const freshManifest = { id: backup.id, ...freshManifestSnap.data() };
    const loaded = await fetchBackupSnapshot(user.uid, freshManifest);
    if (loaded.productCount <= 0) throw new Error('ichigo-restore-first-backup-empty');

    setRestoreBusy(true, `Verified ${loaded.productCount} product${loaded.productCount === 1 ? '' : 's'}. Restoring…`);
    applySnapshot(loaded.snapshot);
    writeRestoreMeta(freshManifest, loaded.productCount);
    clearGuard();
    try { sessionStorage.removeItem(SESSION_DISMISS_KEY); } catch (_) {}
    window.dispatchEvent(new CustomEvent('ichigo-cloud-restore-first-complete', {
      detail: { uid: user.uid, backupId: backup.id, productCount: loaded.productCount }
    }));
    location.reload();
  } catch (error) {
    console.error('Ichigo restore-first failed safely.', error);
    setRestoreBusy(false, 'Restore stopped safely. Your cloud copy and this phone were left protected. Check your connection and try again.');
  }
}

function updateSettingsNotice() {
  const main = qs('#main');
  if (!main || !/Settings & Data/.test(main.textContent || '')) return;

  let notice = qs('#ichigoRestoreFirstNotice');
  const guard = readGuard();
  if (!guard || !auth.currentUser || guard.uid !== auth.currentUser.uid) {
    notice?.remove();
    return;
  }

  if (!notice) {
    notice = document.createElement('section');
    notice.id = 'ichigoRestoreFirstNotice';
    notice.className = 'section';
    const cloud = qs('#ichigoCloudBackupSection');
    if (cloud) cloud.insertAdjacentElement('beforebegin', notice);
    else main.prepend(notice);
  }

  const count = Number(guard.productCount || 0);
  notice.innerHTML = `
    <div class="card" style="border-color:#efbfd0;background:#fff8fa">
      <span class="badge lav">Restore first</span>
      <h3 style="margin:8px 0 5px">Cloud collection protected</h3>
      <p style="margin:0 0 10px">This phone is empty, while your account has ${count} product${count === 1 ? '' : 's'} in a protected cloud backup. Scheduled backup is paused for this fresh device.</p>
      <button class="primary" id="ichigoRestoreProtectedCopy" type="button">Restore cloud collection</button>
    </div>`;
  qs('#ichigoRestoreProtectedCopy')?.addEventListener('click', () => {
    if (guardedUser && guardedBackup) showGate(guardedUser, guardedBackup);
    else void inspectRestoreFirst(auth.currentUser, { forcePrompt: true });
  });
}

function releaseHeldAuthEvent() {
  const detail = heldAuthDetail;
  heldAuthDetail = null;
  if (!detail) return;
  window.dispatchEvent(new CustomEvent('ichigo-auth-ready', {
    detail: { ...detail, restoreFirstReleased: true }
  }));
}

async function inspectRestoreFirst(user, options = {}) {
  if (!user?.uid) {
    clearGuard();
    releaseHeldAuthEvent();
    return null;
  }
  if (inspectionPromise) return inspectionPromise;

  inspectionPromise = (async () => {
    const local = readLocalSummary();
    if (local.hasInventory) {
      clearGuard();
      releaseHeldAuthEvent();
      return null;
    }

    let useful = null;
    try {
      useful = await findUsefulBackup(user.uid);
    } catch (error) {
      console.warn('Ichigo restore-first cloud inspection was deferred.', error);
      return null;
    }

    if (!useful) {
      clearGuard();
      releaseHeldAuthEvent();
      return null;
    }

    guardedUser = user;
    guardedBackup = useful;
    writeGuard(user, useful);
    updateSettingsNotice();

    if (options.forcePrompt || !dismissedThisSession(user.uid, useful.id)) {
      showGate(user, useful);
    }
    return useful;
  })().finally(() => {
    inspectionPromise = null;
  });

  return inspectionPromise;
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-nav="settings"]')) {
    requestAnimationFrame(() => requestAnimationFrame(updateSettingsNotice));
  }
});

window.addEventListener('ichigo-auth-ready', event => {
  if (event.detail?.restoreFirstReleased) return;

  const user = event.detail?.user || null;
  if (!user?.uid) {
    clearGuard();
    return;
  }

  const local = readLocalSummary();
  if (local.hasInventory) {
    clearGuard();
    return;
  }

  event.stopImmediatePropagation();
  heldAuthDetail = event.detail;
  void inspectRestoreFirst(user);
}, true);

window.addEventListener('online', () => {
  if (auth.currentUser && readGuard()) void inspectRestoreFirst(auth.currentUser);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && auth.currentUser && readGuard()) {
    void inspectRestoreFirst(auth.currentUser);
  }
});

window.IchigoRestoreFirst = {
  inspect: () => inspectRestoreFirst(auth.currentUser, { forcePrompt: true }),
  guard: readGuard,
  restore: restoreGuardedBackup
};

ensureStyles();
updateSettingsNotice();
