import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 開発環境用のデバッグログ（接続先プロジェクトIDの確認）
if (import.meta.env.DEV) {
  console.log('[Firebase Init] Project ID:', firebaseConfig.projectId);
  console.log('firebaseConfig', firebaseConfig);
}

const app = initializeApp(firebaseConfig);
const customDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

export const db = (customDatabaseId && customDatabaseId !== '(default)')
  ? getFirestore(app, customDatabaseId)
  : getFirestore(app);

// 他コンポーネントとの互換性のためのエイリアス
export const FirestoreDB = db;

export default app;
