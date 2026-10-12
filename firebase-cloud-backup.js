import { app, auth } from './firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = getFirestore(app);
const DATA_KEY = 'ichigo-v1-data';
const CLOUD_META_KEY = 'ichigo-cloud-backup-meta-v1';
const CLOUD_LOCAL_SAFETY_KEY = 'ichigo-cloud-local-safety-v1';
const RESTORE_GUARD_KEY = 'ichigo-cloud-restore-first-guard-v1';
const DEVICE_ID_KEY = 'ichigo-cloud-device-id-v1';
const CHUNK_CHAR_LIMIT = 180000;
const MAX_BACKUPS = 8;
const LIST_LIMIT = 12;
const AUTO_SYNC_DEBOUNCE_MS = 3500;
const AUTO_SYNC_POLL_MS = 30000;
const FIRESTORE_READ_TIMEOUT_MS = 10000;
const FIRESTORE_WRITE_TIMEOUT_MS = 15000;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let backupBusy = false;
let summaryLoadedForUid = '';
let weeklyTimer = null;
let autoSyncTimer = null;
let autoSyncPoll = null;

const qs = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[ch]));

function getCurrentUser() {
  return auth.currentUser || null;
}

function withCloudTimeout(promise, ms, code = 'ichigo/firestore-timeout') {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Cloud request timed out');
        error.code = code;
        reject(error);
      }, ms);
    })
  ]);
}

function isManagedKey(key) {
  if (!key || !key.startsWith('ichigo-')) return false;
  if (key === 'ichigo-auth-local-mode-v1') return false;
  if (key === CLOUD_META_KEY || key === CLOUD_LOCAL_SAFETY_KEY) return false;
  if (key.startsWith('ichigo-cloud-')) return false;
  return true;
}

function hashText(text = '') {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return 'unknown-device';
  }
}

function restoreGuardActive(uid) {
  try {
    const guard = JSON.parse(localStorage.getItem(RESTORE_GUARD_KEY) || 'null');
    return Boolean(guard?.uid && guard.uid === uid && guard.backupId);
  } catch (_) {
    return false;
  }
}

function collectSnapshot() {
  const unsorted = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (isManagedKey(key)) unsorted[key] = localStorage.getItem(key);
  }
  const keys = {};
  Object.keys(unsorted).sort().forEach(key => { keys[key] = unsorted[key]; });
  const snapshotHash = hashText(JSON.stringify(keys));
  const snapshot = {
    version: 1,
    createdAtMs: Date.now(),
    keys
  };
  let productCount = 0;
  try {
    const data = JSON.parse(keys[DATA_KEY] || '{}');
    productCount = Array.isArray(data?.products) ? data.products.length : 0;
  } catch (_) {}
  const json = JSON.stringify(snapshot);
  return {
    snapshot,
    json,
    snapshotHash,
    productCount,
    keyCount: Object.keys(keys).length,
    byteLength: new Blob([json]).size
  };
}

function splitSnapshot(json) {
  const chunks = [];
  for (let i = 0; i < json.length; i += CHUNK_CHAR_LIMIT) {
    chunks.push(json.slice(i, i + CHUNK_CHAR_LIMIT));
  }
  return chunks.length ? chunks : [''];
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

function readLocalMeta() {
  try {
    const meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) || '{}');
    return meta && typeof meta === 'object' ? meta : {};
  } catch (_) {
    return {};
  }
}

function writeLocalMeta(patch) {
  const next = { ...readLocalMeta(), ...patch };
  localStorage.setItem(CLOUD_META_KEY, JSON.stringify(next));
  return next;
}

function formatDateTime(ms) {
  if (!ms) return 'Not yet';
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

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function kindLabel(kind) {
  if (kind === 'sync') return 'Auto sync';
  if (kind === 'weekly') return 'Weekly';
  if (kind === 'pre-restore') return 'Pre-restore safety';
  return 'Manual';
}

function latestSaturdayEightManila(nowMs = Date.now()) {
  const shifted = new Date(nowMs + PH_OFFSET_MS);
  const day = shifted.getUTCDay();
  const daysSinceSaturday = (day - 6 + 7) % 7;
  const candidateShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceSaturday,
    8, 0, 0, 0
  );
  let candidate = candidateShifted - PH_OFFSET_MS;
  if (candidate > nowMs) candidate -= WEEK_MS;
  return candidate;
}

function nextSaturdayEightManila(nowMs = Date.now()) {
  const latest = latestSaturdayEightManila(nowMs);
  let next = latest + WEEK_MS;
  if (next <= nowMs) next += WEEK_MS;
  return next;
}

function friendlyCloudError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) {
    return 'Cloud Backup is connected, but Firestore security rules are not allowing this account yet.';
  }
  if (code.includes('failed-precondition') || code.includes('not-found')) {
    return 'Cloud Firestore still needs to be created for the Ichigo Firebase project.';
  }
  if (code === 'ichigo/firestore-timeout') {
    return 'Cloud Backup took too long to respond. Ichigo stopped waiting safely; your local collection is untouched. Check your connection and try again.';
  }
  if (code === 'ichigo/backup-busy') {
    return 'Another Ichigo backup is already running. Give it a few seconds, then try again.';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Ichigo could not reach Cloud Firestore. Your local collection is safe; try again when you are online.';
  }
  if (code === 'ichigo/empty-local-protection') {
    return 'Ichigo found an older cloud backup with products, but this device currently has no products. Automatic backup was blocked so an empty device cannot replace your useful backup.';
  }
  if (code === 'ichigo/restore-first-guard') {
    return 'A protected cloud collection is waiting to be restored on this device. Ichigo paused automatic upload so it cannot be overwritten.';
  }
  if (code === 'ichigo/newer-cloud-copy') {
    return 'A newer backup from another device is protected. Review and restore that cloud copy before uploading changes from this device.';
  }
  return 'Cloud Backup could not finish. Your local collection was not changed.';
}

async function listBackups(uid, count = LIST_LIMIT) {
  const snap = await withCloudTimeout(
    getDocs(query(backupCollection(uid), orderBy('createdAtMs', 'desc'), limit(count))),
    FIRESTORE_READ_TIMEOUT_MS
  );
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function deleteBackup(uid, item) {
  const chunkCount = Number(item?.chunkCount || 0);
  const batch = writeBatch(db);
  for (let i = 0; i < chunkCount; i += 1) {
    batch.delete(chunkRef(uid, item.id, i));
  }
  batch.delete(backupRef(uid, item.id));
  await withCloudTimeout(batch.commit(), FIRESTORE_WRITE_TIMEOUT_MS);
}

async function pruneBackups(uid) {
  const items = await listBackups(uid, 20);
  const extras = items.slice(MAX_BACKUPS);
  for (const item of extras) {
    try { await deleteBackup(uid, item); }
    catch (error) { console.warn('Ichigo could not prune an old cloud backup.', error); }
  }
}

async function createBackup(kind = 'manual', options = {}) {
  const user = getCurrentUser();
  if (!user) throw new Error('ichigo/not-signed-in');
  if (backupBusy) {
    const error = new Error('backup already running');
    error.code = 'ichigo/backup-busy';
    throw error;
  }
  backupBusy = true;
  updateCloudButtons();

  try {
    if ((kind === 'sync' || kind === 'weekly') && restoreGuardActive(user.uid)) {
      const error = new Error('restore-first guard');
      error.code = 'ichigo/restore-first-guard';
      throw error;
    }

    const local = collectSnapshot();
    const localMeta = readLocalMeta();
    if (options.skipIfUnchanged && localMeta.lastBackupHash && localMeta.lastBackupHash === local.snapshotHash) {
      return null;
    }

    let existing = [];
    if (!options.skipEmptyProtection && !options.allowEmpty && local.productCount === 0) {
      existing = await listBackups(user.uid, 1);
    }
    if (!options.allowEmpty && local.productCount === 0 && Number(existing[0]?.productCount || 0) > 0) {
      const error = new Error('empty local protection');
      error.code = 'ichigo/empty-local-protection';
      throw error;
    }

    const chunks = splitSnapshot(local.json);
    const backupId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const manifest = {
      uid: user.uid,
      kind,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
      chunkCount: chunks.length,
      charLength: local.json.length,
      byteLength: local.byteLength,
      productCount: local.productCount,
      keyCount: local.keyCount,
      snapshotHash: local.snapshotHash,
      sourceDeviceId: deviceId(),
      schemaVersion: 1,
      appVersion: '1.0'
    };

    const batch = writeBatch(db);
    batch.set(backupRef(user.uid, backupId), manifest);
    chunks.forEach((data, index) => {
      batch.set(chunkRef(user.uid, backupId, index), { index, data });
    });
    await withCloudTimeout(batch.commit(), FIRESTORE_WRITE_TIMEOUT_MS);

    writeLocalMeta({
      lastSuccessfulBackupAt: manifest.createdAtMs,
      lastBackupKind: kind,
      lastBackupId: backupId,
      lastSeenBackupId: backupId,
      lastBackupHash: local.snapshotHash,
      lastBackupProductCount: local.productCount,
      cloudNewerBackupId: '',
      cloudNewerAt: 0,
      lastSyncReason: kind,
      lastError: ''
    });

    summaryLoadedForUid = user.uid;
    const lastBackupEl = qs('#ichigoCloudLastBackup');
    if (lastBackupEl) lastBackupEl.textContent = formatDateTime(manifest.createdAtMs);
    const autoStatusEl = qs('#ichigoCloudAutoStatus');
    if (autoStatusEl) autoStatusEl.textContent = 'Up to date';

    if (!options.skipPrune) {
      setTimeout(() => {
        pruneBackups(user.uid).catch(error => {
          console.warn('Ichigo deferred backup pruning.', error);
        });
      }, 0);
    }
    scheduleWeeklyTimer();

    window.dispatchEvent(new CustomEvent('ichigo-cloud-backup-complete', {
      detail: { backupId, kind, createdAtMs: manifest.createdAtMs, productCount: local.productCount }
    }));
    return { id: backupId, ...manifest };
  } finally {
    backupBusy = false;
    updateCloudButtons();
  }
}

async function fetchBackupSnapshot(uid, item) {
  const parts = [];
  const chunkCount = Number(item?.chunkCount || 0);
  if (!chunkCount) throw new Error('Backup has no chunks.');
  for (let i = 0; i < chunkCount; i += 1) {
    const snap = await withCloudTimeout(
      getDoc(chunkRef(uid, item.id, i)),
      FIRESTORE_READ_TIMEOUT_MS
    );
    if (!snap.exists()) throw new Error(`Backup chunk ${i} is missing.`);
    parts.push(String(snap.data()?.data || ''));
  }
  const parsed = JSON.parse(parts.join(''));
  if (!parsed || parsed.version !== 1 || !parsed.keys || typeof parsed.keys !== 'object') {
    throw new Error('Backup format is invalid.');
  }
  if (parsed.keys[DATA_KEY]) {
    const data = JSON.parse(parsed.keys[DATA_KEY]);
    if (!data || !Array.isArray(data.products)) throw new Error('Backup inventory is invalid.');
  }
  return parsed;
}

function applySnapshot(snapshot) {
  const before = collectSnapshot().snapshot;
  try {
    localStorage.setItem(CLOUD_LOCAL_SAFETY_KEY, JSON.stringify({
      createdAtMs: Date.now(),
      keys: before.keys
    }));
  } catch (_) {}

  const removeManagedKeys = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (isManagedKey(key)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  };

  try {
    removeManagedKeys();
    Object.entries(snapshot.keys).forEach(([key, value]) => {
      if (isManagedKey(key) && typeof value === 'string') localStorage.setItem(key, value);
    });
  } catch (error) {
    try {
      removeManagedKeys();
      Object.entries(before.keys).forEach(([key, value]) => {
        if (isManagedKey(key) && typeof value === 'string') localStorage.setItem(key, value);
      });
    } catch (rollbackError) {
      console.error('Ichigo local rollback also failed.', rollbackError);
    }
    throw error;
  }
}

async function restoreBackup(backupId) {
  const user = getCurrentUser();
  if (!user || backupBusy) return;
  const backups = await listBackups(user.uid, LIST_LIMIT);
  const item = backups.find(entry => entry.id === backupId);
  if (!item) throw new Error('Backup not found.');

  const ok = window.confirm(
    `Restore the ${formatDateTime(item.createdAtMs)} backup with ${Number(item.productCount || 0)} product(s)?\n\nIchigo will first create a fresh pre-restore safety backup of what is on this device now.`
  );
  if (!ok) return;

  const safety = await createBackup('pre-restore', {
    allowEmpty: true,
    skipEmptyProtection: true,
    skipPrune: true
  });
  if (!safety) throw new Error('Could not create pre-restore backup.');

  backupBusy = true;
  updateCloudButtons();
  try {
    const snapshot = await fetchBackupSnapshot(user.uid, item);
    applySnapshot(snapshot);
    writeLocalMeta({
      lastRestoreAt: Date.now(),
      lastRestoreFromId: backupId,
      lastError: ''
    });
    location.reload();
  } finally {
    backupBusy = false;
    updateCloudButtons();
  }
}

function cloudSection() {
  return qs('#ichigoCloudBackupSection');
}

function ensureCloudPanel() {
  const main = qs('#main');
  if (!main || !/Settings & Data/.test(main.textContent || '')) return null;

  let section = cloudSection();
  if (!section) {
    section = document.createElement('section');
    section.id = 'ichigoCloudBackupSection';
    section.className = 'section';
    const account = qs('#ichigoAccountSection');
    if (account) account.insertAdjacentElement('afterend', section);
    else main.prepend(section);
  }
  return section;
}

function renderCloudPanelBase() {
  const section = ensureCloudPanel();
  if (!section) return;
  const user = getCurrentUser();
  const meta = readLocalMeta();
  const nextDue = nextSaturdayEightManila();
  const signedIn = Boolean(user);

  section.innerHTML = `
    <div class="section-head"><div><h2>Cloud Backup</h2><p>Optional, versioned backups for your local-first Ichigo collection.</p></div></div>
    <div class="card">
      <div class="badges" style="margin-bottom:10px">
        <span class="badge ${signedIn ? 'green' : 'gray'}">${signedIn ? 'Signed in' : 'Sign in required'}</span>
        <span class="badge lav">Saturday · 8:00 AM PH</span>
      </div>
      <h3 style="margin:0 0 5px">Cloud backup & safe sync</h3>
      <p style="margin:0 0 12px">Changes are backed up automatically a few seconds after Ichigo saves them. Cloud data never silently replaces this device.</p>
      <div class="info-box" style="margin-bottom:12px">
        <strong>Last successful backup:</strong> <span id="ichigoCloudLastBackup">${formatDateTime(meta.lastSuccessfulBackupAt)}</span><br>
        <strong>Auto backup:</strong> <span id="ichigoCloudAutoStatus">${meta.cloudNewerBackupId ? 'Paused · newer cloud copy protected' : 'On'}</span><br>
        <strong>Weekly safety backup:</strong> ${formatDateTime(nextDue)}
        <div style="margin-top:6px;font-size:10px">Local changes sync to your cloud backup after a short debounce. Saturday 8:00 AM PH remains the weekly safety checkpoint.</div>
      </div>
      <div class="button-row">
        <button class="primary" id="ichigoBackupNow" type="button" ${signedIn ? '' : 'disabled'}>Back up now</button>
        <button class="secondary" id="ichigoShowBackups" type="button" ${signedIn ? '' : 'disabled'}>View & restore backups</button>
      </div>
      <div id="ichigoCloudStatus" class="info-box hidden" style="margin-top:10px"></div>
      <div id="ichigoBackupList" style="margin-top:12px"></div>
    </div>`;

  qs('#ichigoBackupNow')?.addEventListener('click', async () => {
    showCloudStatus('Creating a protected cloud backup…');
    try {
      const result = await createBackup('manual');
      if (result) showCloudStatus(`Backup complete · ${result.productCount} product(s) · ${formatBytes(result.byteLength)}`, true);
    } catch (error) {
      console.warn('Ichigo manual backup failed.', error);
      writeLocalMeta({ lastError: error?.code || error?.message || 'backup failed' });
      showCloudStatus(friendlyCloudError(error));
    }
  });

  qs('#ichigoShowBackups')?.addEventListener('click', async () => {
    await renderBackupList();
  });
}

function updateCloudButtons() {
  const disabled = backupBusy || !getCurrentUser();
  ['#ichigoBackupNow', '#ichigoShowBackups'].forEach(selector => {
    const button = qs(selector);
    if (button) button.disabled = disabled;
  });
}

function showCloudStatus(message, good = false) {
  const box = qs('#ichigoCloudStatus');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
  if (good) {
    box.style.background = '#edf6f0';
    box.style.borderColor = '#cfe5d6';
    box.style.color = '#3d684d';
  } else {
    box.style.background = '';
    box.style.borderColor = '';
    box.style.color = '';
  }
}

async function renderBackupList() {
  const box = qs('#ichigoBackupList');
  const user = getCurrentUser();
  if (!box || !user) return;
  box.innerHTML = '<div class="empty"><p>Loading cloud backups…</p></div>';
  try {
    const items = await listBackups(user.uid, LIST_LIMIT);
    if (!items.length) {
      box.innerHTML = '<div class="empty"><h3>No cloud backups yet</h3><p>Use Back up now to create the first protected copy.</p></div>';
      return;
    }
    box.innerHTML = `
      <div class="section-head" style="margin-top:8px"><h3>Available backups</h3></div>
      ${items.map(item => `
        <div class="card" style="margin-top:8px;padding:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <div>
              <strong>${esc(kindLabel(item.kind))}</strong>
              <p style="margin:4px 0 0">${esc(formatDateTime(item.createdAtMs))} · ${Number(item.productCount || 0)} product(s) · ${esc(formatBytes(item.byteLength))}</p>
            </div>
            <button class="secondary" data-ichigo-restore="${esc(item.id)}" type="button">Restore</button>
          </div>
        </div>`).join('')}`;
    box.querySelectorAll('[data-ichigo-restore]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          await restoreBackup(button.dataset.ichigoRestore);
        } catch (error) {
          console.error('Ichigo restore failed.', error);
          showCloudStatus(`Restore stopped safely. ${friendlyCloudError(error)}`);
        }
      });
    });
  } catch (error) {
    console.warn('Ichigo could not list cloud backups.', error);
    box.innerHTML = `<div class="empty"><h3>Cloud Backup needs setup</h3><p>${esc(friendlyCloudError(error))}</p></div>`;
  }
}

async function refreshCloudPanel(force = false) {
  const user = getCurrentUser();
  renderCloudPanelBase();
  if (!user) return;
  if (!force && summaryLoadedForUid === user.uid) return;
  summaryLoadedForUid = user.uid;
  try {
    const items = await listBackups(user.uid, 1);
    const latest = items[0];
    if (latest) {
      writeLocalMeta({
        lastSuccessfulBackupAt: Number(latest.createdAtMs || 0),
        lastBackupKind: latest.kind || '',
        lastBackupId: latest.id,
        lastSeenBackupId: latest.id,
        lastBackupHash: latest.snapshotHash || readLocalMeta().lastBackupHash || '',
        lastBackupProductCount: Number(latest.productCount || 0),
        lastError: ''
      });
      const el = qs('#ichigoCloudLastBackup');
      if (el) el.textContent = formatDateTime(latest.createdAtMs);
    }
  } catch (error) {
    console.warn('Ichigo cloud summary unavailable.', error);
    writeLocalMeta({ lastError: error?.code || error?.message || 'cloud summary failed' });
    showCloudStatus(friendlyCloudError(error));
  }
}

async function runScheduledBackupIfDue() {
  const user = getCurrentUser();
  if (!user || backupBusy || !navigator.onLine) return;
  try {
    const dueBoundary = latestSaturdayEightManila();
    const items = await listBackups(user.uid, 1);
    const latest = Number(items[0]?.createdAtMs || 0);
    if (latest >= dueBoundary) {
      writeLocalMeta({ lastSuccessfulBackupAt: latest, lastError: '' });
      return;
    }
    const result = await createBackup('weekly');
    if (result) showCloudStatus(`Weekly backup complete · ${result.productCount} product(s)`, true);
  } catch (error) {
    console.warn('Ichigo scheduled backup did not run.', error);
    writeLocalMeta({ lastError: error?.code || error?.message || 'scheduled backup failed' });
    showCloudStatus(friendlyCloudError(error));
  }
}


async function runAutoSync(reason = 'local-change') {
  const user = getCurrentUser();
  if (!user || backupBusy || !navigator.onLine) return;
  if (restoreGuardActive(user.uid)) return;

  const local = collectSnapshot();
  const meta = readLocalMeta();
  if (meta.lastBackupHash && meta.lastBackupHash === local.snapshotHash) return;

  try {
    const items = await listBackups(user.uid, 1);
    const latest = items[0] || null;

    if (latest?.snapshotHash && latest.snapshotHash === local.snapshotHash) {
      writeLocalMeta({
        lastSuccessfulBackupAt: Number(latest.createdAtMs || Date.now()),
        lastBackupId: latest.id,
        lastSeenBackupId: latest.id,
        lastBackupHash: local.snapshotHash,
        lastBackupProductCount: local.productCount,
        cloudNewerBackupId: '',
        cloudNewerAt: 0,
        lastError: ''
      });
      return;
    }

    const otherDevice = Boolean(
      latest?.sourceDeviceId &&
      latest.sourceDeviceId !== deviceId()
    );
    const unseenRemote = Boolean(
      otherDevice &&
      meta.lastSeenBackupId &&
      latest.id !== meta.lastSeenBackupId
    );

    if (unseenRemote) {
      writeLocalMeta({
        cloudNewerBackupId: latest.id,
        cloudNewerAt: Number(latest.createdAtMs || Date.now()),
        lastError: 'ichigo/newer-cloud-copy'
      });
      showCloudStatus('A newer backup from another device is protected. Use View & restore backups to review it before this device uploads changes.');
      const status = qs('#ichigoCloudAutoStatus');
      if (status) status.textContent = 'Paused · newer cloud copy protected';
      return;
    }

    const result = await createBackup('sync', { skipIfUnchanged: true });
    if (result) {
      const status = qs('#ichigoCloudAutoStatus');
      if (status) status.textContent = 'Up to date';
    }
  } catch (error) {
    console.warn(`Ichigo auto sync deferred (${reason}).`, error);
    writeLocalMeta({ lastError: error?.code || error?.message || 'auto sync failed' });
    if (qs('#ichigoCloudStatus')) showCloudStatus(friendlyCloudError(error));
  }
}

function scheduleAutoSync(reason = 'local-change', delay = AUTO_SYNC_DEBOUNCE_MS) {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  const user = getCurrentUser();
  if (!user || restoreGuardActive(user.uid)) return;
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void runAutoSync(reason);
  }, Math.max(250, delay));
}

function startAutoSyncPoll() {
  if (autoSyncPoll) clearInterval(autoSyncPoll);
  if (!getCurrentUser()) return;
  autoSyncPoll = setInterval(() => {
    if (document.visibilityState === 'visible') scheduleAutoSync('periodic-check', 500);
  }, AUTO_SYNC_POLL_MS);
}

function stopAutoSyncPoll() {
  if (autoSyncPoll) {
    clearInterval(autoSyncPoll);
    autoSyncPoll = null;
  }
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

function scheduleWeeklyTimer() {
  if (weeklyTimer) clearTimeout(weeklyTimer);
  if (!getCurrentUser()) return;
  const delay = Math.max(1000, nextSaturdayEightManila() - Date.now() + 1500);
  weeklyTimer = setTimeout(async () => {
    await runScheduledBackupIfDue();
    scheduleWeeklyTimer();
  }, delay);
}

function scheduleSettingsRender() {
  requestAnimationFrame(() => requestAnimationFrame(() => refreshCloudPanel()));
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-nav="settings"]')) scheduleSettingsRender();
});

window.addEventListener('ichigo-local-data-changed', event => {
  scheduleAutoSync(event.detail?.source || 'local-change');
});
window.addEventListener('storage', event => {
  if (event.key?.startsWith('ichigo-') && !event.key.startsWith('ichigo-cloud-')) {
    scheduleAutoSync('storage-change');
  }
});
window.addEventListener('online', () => {
  scheduleAutoSync('online', 500);
  runScheduledBackupIfDue();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleAutoSync('resume', 700);
    runScheduledBackupIfDue();
  }
});

window.addEventListener('ichigo-auth-ready', event => {
  const signedIn = Boolean(event.detail?.user);
  summaryLoadedForUid = '';
  if (signedIn) {
    scheduleAutoSync('sign-in', 1200);
    setTimeout(() => runScheduledBackupIfDue(), 2500);
    scheduleWeeklyTimer();
    startAutoSyncPoll();
  } else {
    if (weeklyTimer) {
      clearTimeout(weeklyTimer);
      weeklyTimer = null;
    }
    stopAutoSyncPoll();
  }
  scheduleSettingsRender();
});

window.IchigoCloudBackup = {
  backupNow: () => createBackup('manual'),
  restore: restoreBackup,
  list: async () => {
    const user = getCurrentUser();
    return user ? listBackups(user.uid, LIST_LIMIT) : [];
  },
  dueBoundary: latestSaturdayEightManila,
  nextDue: nextSaturdayEightManila
};

scheduleSettingsRender();
