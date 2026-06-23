// ============================================================
// FIREBASE CONFIG — Replace with your project credentials
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyCZ9Ry1EpWHoxw5b9isw6zEXnmxinfDDdY",
    authDomain: "musallah-e-talaba.firebaseapp.com",
    projectId: "musallah-e-talaba",
    storageBucket: "musallah-e-talaba.firebasestorage.app",
    messagingSenderId: "817976839918",
    appId: "1:817976839918:web:d9ed99b4d8617b96d22dff",
    measurementId: "G-6X1XE0FH4Q"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Use emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('🔧 Using Firebase Emulators');
}

export { db, auth, storage };
export default app;
