import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBiZ_wKdjWZ_FzbjzfBKB7-_OYSR0wFpvo",
  authDomain: "nexa-b709b.firebaseapp.com",
  projectId: "nexa-b709b",
  storageBucket: "nexa-b709b.firebasestorage.app",
  messagingSenderId: "829091168098",
  appId: "1:829091168098:web:80f2c6ad1fe4afbe2ff63b",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;