import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  "projectId": "studio-6431704675-6ab18",
  "appId": "1:806000673656:web:fe09f249bac4332c23be8d",
  "apiKey": "AIzaSyBHjMCwvNeX8w9n3M4bJ3KdarkybZsf83o",
  "authDomain": "studio-6431704675-6ab18.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "806000673656",
  "storageBucket": "studio-6431704675-6ab18.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
