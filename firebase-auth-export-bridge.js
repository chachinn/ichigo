import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC3f_ouUDV-8z1KK0KvHXy63a73tAvMsBc',
  authDomain: 'ichigo-b7e33.firebaseapp.com',
  projectId: 'ichigo-b7e33',
  storageBucket: 'ichigo-b7e33.firebasestorage.app',
  messagingSenderId: '699022808369',
  appId: '1:699022808369:web:d47cb210c503ee36bd0c10'
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
