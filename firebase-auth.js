import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC3f_ouUDV-8z1KK0KvHXy63a73tAvMsBc',
  authDomain: 'ichigo-b7e33.firebaseapp.com',
  projectId: 'ichigo-b7e33',
  storageBucket: 'ichigo-b7e33.firebasestorage.app',
  messagingSenderId: '699022808369',
  appId: '1:699022808369:web:d47cb210c503ee36bd0c10'
};

const LOCAL_MODE_KEY = 'ichigo-auth-local-mode-v1';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let authMode = 'login';
let authReady = false;
let busy = false;

const qs = (selector, root = document) => root.querySelector(selector);

function localModeChosen() {
  try { return localStorage.getItem(LOCAL_MODE_KEY) === '1'; }
  catch (_) { return false; }
}

function setLocalMode(value) {
  try {
    if (value) localStorage.setItem(LOCAL_MODE_KEY, '1');
    else localStorage.removeItem(LOCAL_MODE_KEY);
  } catch (_) {}
}

function friendlyError(error) {
  switch (error?.code) {
    case 'auth/invalid-email': return "That email address doesn't look quite right.";
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return "That email or password didn't match.";
    case 'auth/email-already-in-use': return 'That email already has an Ichigo account. Try logging in instead.';
    case 'auth/weak-password': return 'Choose a password with at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts for now. Please try again later.';
    case 'auth/network-request-failed': return "Ichigo couldn't reach Firebase. Check your connection and try again.";
    case 'auth/operation-not-allowed': return 'Email/password login still needs to be enabled in the Ichigo Firebase project.';
    case 'auth/user-disabled': return 'This account is currently disabled.';
    default: return "Ichigo couldn't complete that just now. Please try again.";
  }
}

function ensureAuthUI() {
  if (qs('#ichigoAuthGate')) return;
  const gate = document.createElement('div');
  gate.id = 'ichigoAuthGate';
  gate.className = 'ichigo-auth-gate hidden';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'ichigoAuthTitle');
  gate.innerHTML = `
    <div class="ichigo-auth-card">
      <div class="ichigo-auth-berry" aria-hidden="true">🍓</div>
      <span class="eyebrow">ICHIGO · いちご</span>
      <h1 id="ichigoAuthTitle">Welcome back to Ichigo</h1>
      <p id="ichigoAuthSubtitle">Your little beauty collection is waiting.</p>

      <form id="ichigoLoginForm" class="ichigo-auth-form">
        <label>Email<input id="ichigoLoginEmail" type="email" autocomplete="email" inputmode="email" required></label>
        <label>Password<input id="ichigoLoginPassword" type="password" autocomplete="current-password" required></label>
        <button class="primary ichigo-auth-main" type="submit">Log in</button>
        <button id="ichigoForgotPassword" class="ichigo-auth-link" type="button">Forgot password?</button>
      </form>

      <form id="ichigoSignupForm" class="ichigo-auth-form hidden">
        <label>Email<input id="ichigoSignupEmail" type="email" autocomplete="email" inputmode="email" required></label>
        <label>Password<input id="ichigoSignupPassword" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>Confirm password<input id="ichigoSignupConfirm" type="password" autocomplete="new-password" minlength="6" required></label>
        <button class="primary ichigo-auth-main" type="submit">Create account</button>
      </form>

      <div id="ichigoAuthMessage" class="ichigo-auth-message hidden" role="status"></div>
      <div class="ichigo-auth-divider"><span>or</span></div>
      <button id="ichigoContinueLocal" class="ichigo-local-button" type="button">Continue without an account</button>
      <p class="ichigo-local-note">Your current collection stays on this device. Logging in does not upload, replace, or delete it.</p>
      <div class="ichigo-auth-switch"><span id="ichigoAuthSwitchCopy">New to Ichigo?</span> <button id="ichigoAuthSwitch" type="button">Create an account</button></div>
    </div>`;
  document.body.appendChild(gate);

  qs('#ichigoLoginForm').addEventListener('submit', handleLogin);
  qs('#ichigoSignupForm').addEventListener('submit', handleSignup);
  qs('#ichigoForgotPassword').addEventListener('click', handleForgotPassword);
  qs('#ichigoContinueLocal').addEventListener('click', chooseLocalMode);
  qs('#ichigoAuthSwitch').addEventListener('click', () => setMode(authMode === 'login' ? 'signup' : 'login'));
}

function showMessage(message, kind = 'error') {
  const box = qs('#ichigoAuthMessage');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden', 'success');
  if (kind === 'success') box.classList.add('success');
}

function clearMessage() {
  const box = qs('#ichigoAuthMessage');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
  box.classList.remove('success');
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('#ichigoAuthGate button, #ichigoAuthGate input').forEach(el => { el.disabled = value; });
}

function setMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  clearMessage();
  const signup = authMode === 'signup';
  qs('#ichigoLoginForm')?.classList.toggle('hidden', signup);
  qs('#ichigoSignupForm')?.classList.toggle('hidden', !signup);
  if (qs('#ichigoAuthTitle')) qs('#ichigoAuthTitle').textContent = signup ? 'Make your Ichigo account' : 'Welcome back to Ichigo';
  if (qs('#ichigoAuthSubtitle')) qs('#ichigoAuthSubtitle').textContent = signup ? 'Create an account now; cloud backup can be added safely later.' : 'Your little beauty collection is waiting.';
  if (qs('#ichigoAuthSwitchCopy')) qs('#ichigoAuthSwitchCopy').textContent = signup ? 'Already have an account?' : 'New to Ichigo?';
  if (qs('#ichigoAuthSwitch')) qs('#ichigoAuthSwitch').textContent = signup ? 'Log in instead' : 'Create an account';
}

function showGate(force = false) {
  ensureAuthUI();
  if (!force && (currentUser || localModeChosen())) return hideGate();
  qs('#ichigoAuthGate')?.classList.remove('hidden');
  document.body.classList.add('ichigo-auth-open');
  setMode('login');
  requestAnimationFrame(() => qs('#ichigoLoginEmail')?.focus());
}

function hideGate() {
  qs('#ichigoAuthGate')?.classList.add('hidden');
  document.body.classList.remove('ichigo-auth-open');
}

async function handleLogin(event) {
  event.preventDefault();
  if (busy) return;
  const email = qs('#ichigoLoginEmail')?.value.trim() || '';
  const password = qs('#ichigoLoginPassword')?.value || '';
  if (!email || !password) return showMessage('Enter your email and password.');
  clearMessage();
  setBusy(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setLocalMode(false);
    hideGate();
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    setBusy(false);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  if (busy) return;
  const email = qs('#ichigoSignupEmail')?.value.trim() || '';
  const password = qs('#ichigoSignupPassword')?.value || '';
  const confirmPassword = qs('#ichigoSignupConfirm')?.value || '';
  if (!email || !password) return showMessage('Enter an email and password.');
  if (password !== confirmPassword) return showMessage("Those passwords don't match yet.");
  clearMessage();
  setBusy(true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    setLocalMode(false);
    hideGate();
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    setBusy(false);
  }
}

async function handleForgotPassword() {
  if (busy) return;
  const email = qs('#ichigoLoginEmail')?.value.trim() || '';
  if (!email) return showMessage('Enter your email first, then tap Forgot password again.');
  clearMessage();
  setBusy(true);
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage('Password reset email sent. Check your inbox.', 'success');
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    setBusy(false);
  }
}

function chooseLocalMode() {
  setLocalMode(true);
  hideGate();
  renderAccountPanel();
}

async function handleSignOut() {
  try {
    await signOut(auth);
    setLocalMode(true);
    renderAccountPanel();
  } catch (error) {
    console.warn('Ichigo sign out failed.', error);
  }
}

function renderAccountPanel() {
  const main = qs('#main');
  if (!main || !/Settings & Data/.test(main.textContent || '')) return;

  let section = qs('#ichigoAccountSection');
  if (!section) {
    section = document.createElement('section');
    section.id = 'ichigoAccountSection';
    section.className = 'section ichigo-account-section';
    const firstCard = main.querySelector('.card');
    if (firstCard) firstCard.insertAdjacentElement('beforebegin', section);
    else main.prepend(section);
  }

  const signedIn = Boolean(currentUser);
  const email = currentUser?.email || '';
  section.innerHTML = `
    <div class="section-head"><h2>Account</h2></div>
    <div class="card ichigo-account-card">
      <div>
        <span class="ichigo-account-pill ${signedIn ? 'signed-in' : ''}">${signedIn ? 'Signed in' : 'Local'}</span>
        <h3>${signedIn ? 'Ichigo account' : 'Using Ichigo without an account'}</h3>
        <p>${signedIn ? escapeHtml(email) : 'Your beauty collection is stored on this device.'}</p>
      </div>
      <div class="button-row">
        ${signedIn
          ? '<button id="ichigoSignOutButton" class="secondary" type="button">Sign out</button>'
          : '<button id="ichigoSettingsLoginButton" class="primary" type="button">Log in or create account</button>'}
      </div>
      <div class="ichigo-cloud-note">Cloud backup and cross-device sync are <strong>not enabled yet</strong>. Signing in currently identifies your account only; your existing inventory remains local-first.</div>
    </div>`;

  qs('#ichigoSignOutButton')?.addEventListener('click', handleSignOut);
  qs('#ichigoSettingsLoginButton')?.addEventListener('click', () => showGate(true));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}

function scheduleAccountPanel() {
  requestAnimationFrame(() => requestAnimationFrame(renderAccountPanel));
}

document.addEventListener('click', event => {
  const settingsNav = event.target.closest?.('[data-nav="settings"]');
  if (settingsNav) scheduleAccountPanel();
});

window.addEventListener('popstate', scheduleAccountPanel);
window.IchigoAuth = {
  open: () => showGate(true),
  getUser: () => currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
  isReady: () => authReady
};

ensureAuthUI();

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn('Ichigo could not set Firebase auth persistence.', error);
}

onAuthStateChanged(auth, user => {
  currentUser = user || null;
  authReady = true;
  if (currentUser) {
    setLocalMode(false);
    hideGate();
  } else if (!localModeChosen()) {
    showGate();
  } else {
    hideGate();
  }
  renderAccountPanel();
  window.dispatchEvent(new CustomEvent('ichigo-auth-ready', {
    detail: { user: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null, mode: currentUser ? 'signed-in' : 'local' }
  }));
});
