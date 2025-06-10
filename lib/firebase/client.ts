import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBUh1KIHvkuI1YB7GNXphi8q2oG3JQIpqM",
  authDomain: "feedbackland-5bf9e.firebaseapp.com",
  projectId: "feedbackland-5bf9e",
  storageBucket: "feedbackland-5bf9e.firebasestorage.app",
  messagingSenderId: "181921772665",
  appId: "1:181921772665:web:3ed1790346b67060ef10a8",
};

export const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);

export const auth = getAuth(app);
