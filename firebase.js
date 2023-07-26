import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

const firebaseConfig = {
    apiKey: "AIzaSyDPocj21OF0KIZZNNSV4XVL3g3SD-tVnHM",
    authDomain: "paradis-immobilier.firebaseapp.com",
    projectId: "paradis-immobilier",
    storageBucket: "paradis-immobilier.appspot.com",
    messagingSenderId: "579406427147",
    appId: "1:579406427147:web:7b229b2d8920ccb2c6c30e",
    measurementId: "G-NRKCHD4M1D"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app)

const googleProvider = new GoogleAuthProvider()

export { auth, googleProvider }
