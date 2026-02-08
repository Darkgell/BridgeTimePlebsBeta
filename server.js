const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } = require('firebase/firestore');
require('dotenv').config();

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const appId = 'bridgetime-v1';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } 
});

let realms = {};

io.on('connection', (socket) => {
    let currentRealm = null;
    let userName = "Anónimo";

    socket.on('join_realm', async (data) => {
        const { realmId, name } = data;
        currentRealm = realmId;
        userName = name || "Pleb";
        socket.join(realmId);

        try {
            if (!realms[realmId]) {
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'realms', realmId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    realms[realmId] = snap.data();
                } else {
                    realms[realmId] = { tiles: [], princessBehavior: 'normal', lastUpdate: Date.now() };
                    await setDoc(docRef, realms[realmId]);
                }
            }
            socket.emit('init_state', realms[realmId]);
        } catch (error) {
            console.error(error);
        }
    });

    socket.on('build_block', (data) => {
        const { realmId, m, by } = data;
        const newTile = { m, by, t: Date.now() };
        if (realms[realmId]) {
            realms[realmId].tiles.push(newTile);
            io.to(realmId).emit('update_tiles', realms[realmId].tiles);
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'realms', realmId);
            updateDoc(docRef, { tiles: arrayUnion(newTile) }).catch(() => setDoc(docRef, realms[realmId]));
        }
    });

    socket.on('set_princess', (data) => {
        const { realmId, behavior } = data;
        if (realms[realmId]) {
            realms[realmId].princessBehavior = behavior;
            io.to(realmId).emit('update_princess', behavior);
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'realms', realmId);
            updateDoc(docRef, { princessBehavior: behavior });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
