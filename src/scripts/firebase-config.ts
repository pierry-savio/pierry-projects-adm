import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Cole aqui a configuração fornecida pelo painel do seu Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAM8T7h9dTjMNYYrloqXkCgkGzp6VEoZqo",
  authDomain: "pierry-projects.firebaseapp.com",
  projectId: "pierry-projects",
  storageBucket: "pierry-projects.firebasestorage.app",
  messagingSenderId: "195439574222",
  appId: "1:195439574222:web:fd91c31f4979a9a435249f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // <-- Adicione esta linha