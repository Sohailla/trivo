// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔥 your config (keep yours)
const firebaseConfig = {
  apiKey: "AIzaSyDTbffvFWLKA0DFpKxKAwqHhkzz9pib_eU",
  authDomain: "trip-app-f2dc4.firebaseapp.com",
  projectId: "trip-app-f2dc4",
  storageBucket: "trip-app-f2dc4.firebasestorage.app",
  messagingSenderId: "37353079568",
  appId: "1:37353079568:web:a637faad2468dc66e55b95"
};

// Initialize app
const app = initializeApp(firebaseConfig);

// ✅ EXPORT THESE
export const auth = getAuth(app);
export const db = getFirestore(app);

// Keep users logged in
setPersistence(auth, browserLocalPersistence);