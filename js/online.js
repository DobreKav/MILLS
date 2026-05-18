/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   online.js вЂ” Firebase Realtime Database multiplayer
   Auto-matchmaking: no room codes, players are matched
   automatically as soon as two are online simultaneously.

   в”Ђв”Ђ SETUP (one-time, you must do this) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
   1. Go to https://console.firebase.google.com
   2. Create project в†’ name it "Mills"
   3. Project Settings в†’ Your apps в†’ Add Web app (</> icon) в†’ copy config below
   4. Build в†’ Realtime Database в†’ Create database в†’ Start in TEST MODE
   5. Authentication в†’ Sign-in method в†’ Anonymous в†’ Enable
   6. Replace the FIREBASE_CONFIG values below with your Web app config

   NOTE: Add ANDROID app too (for SHA-1 fingerprint if needed later),
         but the config below is the WEB app config вЂ” NOT google-services.json.
в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */

'use strict';

// в”Ђв”Ђ Firebase WEB app config в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAw7Kkdj-KEB8U_U_CwsiWDmNDb7A7F-sc",
  authDomain:        "mills-multyplayer.firebaseapp.com",
  databaseURL:       "https://mills-multyplayer-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "mills-multyplayer",
  storageBucket:     "mills-multyplayer.firebasestorage.app",
  messagingSenderId: "241076979975",
  appId:             "1:241076979975:web:6bdbe4ca6e77b63f9a1da2"
};

function _configIsSet() {
  return !FIREBASE_CONFIG.apiKey.startsWith('REPLACE');
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   OnlineManager
в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
class OnlineManager {
  constructor() {
    this._db          = null;
    this._auth        = null;
    this.uid          = null;   // Firebase anonymous UID (for DB access)
    this.pgId         = null;   // Play Games player ID (identity for queue)
    this.pgName       = null;   // Play Games display name
    this.roomId       = null;
    this.myPlayer     = null;   // 1 or 2
    this._moveIdx     = 0;
    this._movesRef    = null;
    this._movesUnsub  = null;
    this._roomUnsub   = null;
    this._queueUnsub  = null;
    this._onMoveCb    = null;
    this._onDisconnCb = null;
    this._searching   = false;
    this._initialized = false;
  }

  isConfigured() { return _configIsSet(); }

  /* в”Ђв”Ђ Get identity: Play Games ID preferred, fallback to Firebase UID */
  _myId()   { return this.pgId   || this.uid; }
  _myName() { return this.pgName || 'Player'; }

  /* в”Ђв”Ђ Initialize Firebase + load Play Games identity в”Ђв”Ђв”Ђв”Ђ */
  async init() {
    if (this._initialized) return;
    if (!window.firebase) throw new Error('Firebase SDK not loaded');
    if (!_configIsSet())  throw new Error('Firebase config not set in online.js');

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    this._db   = firebase.database();
    this._auth = firebase.auth();

    // Anonymous auth (just for DB access rules)
    const cred = await this._auth.signInAnonymously();
    this.uid   = cred.user.uid;

    // Try to grab Play Games identity from Android bridge
    if (window.MillsAds && window.MillsAds.isPlayGamesSignedIn && window.MillsAds.isPlayGamesSignedIn()) {
      this.pgId   = window.MillsAds.getPlayGamesId()   || null;
      this.pgName = window.MillsAds.getPlayGamesName() || null;
    }

    // Also register callback for late sign-in (Play Games may arrive after init)
    window.onPlayGamesReady = (id, name) => {
      this.pgId   = id   || this.pgId;
      this.pgName = name || this.pgName;
    };

    this._initialized = true;
  }

  /* в”Ђв”Ђ Find a match в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  async findMatch(onMatched, onWaiting) {
    if (!this._initialized) await this.init();

    this._searching = true;
    this._moveIdx   = 0;

    const myId       = this._myId();
    const myQueueRef = this._db.ref(`queue/${myId}`);

    myQueueRef.onDisconnect().remove();

    // Look for a waiting player
    const snap = await this._db.ref('queue').once('value');
    let opponentId = null;

    if (snap.exists()) {
      const now     = Date.now();
      const entries = snap.val();
      for (const [id, data] of Object.entries(entries)) {
        if (id !== myId && data.status === 'waiting' && (now - data.ts) < 30000) {
          opponentId = id;
          break;
        }
      }
    }

    if (opponentId) {
      /* в”Ђв”Ђ We are Player 2 в”Ђв”Ђ */
      this.myPlayer = 2;
      const roomId  = `r_${Date.now().toString(36)}`;
      this.roomId   = roomId;

      // Tell P1 which room was created for them
      await this._db.ref(`queue/${opponentId}/roomId`).set(roomId);

      // Create room
      await this._db.ref(`rooms/${roomId}`).set({
        players: { p1: opponentId, p2: myId },
        names:   { p1: '', p2: this._myName() },
        status:  'playing',
        moves:   null,
        created: firebase.database.ServerValue.TIMESTAMP
      });
      this._db.ref(`rooms/${roomId}`).onDisconnect().remove();

      onMatched?.(2, this._myName());
      this._listenMoves(roomId);

    } else {
      /* в”Ђв”Ђ We are Player 1 вЂ” wait в”Ђв”Ђ */
      await myQueueRef.set({ ts: Date.now(), id: myId, name: this._myName(), status: 'waiting' });
      onWaiting?.();

      const roomIdRef = myQueueRef.child('roomId');
      const cb = roomIdRef.on('value', async (s) => {
        if (!s.exists() || !this._searching) return;
        const roomId = s.val();
        this._searching = false;
        this.myPlayer   = 1;
        this.roomId     = roomId;
        roomIdRef.off('value', cb);
        myQueueRef.remove();

        // Write P1 name into room
        await this._db.ref(`rooms/${roomId}/names/p1`).set(this._myName());
        this._db.ref(`rooms/${roomId}`).onDisconnect().remove();

        onMatched?.(1, this._myName());
        this._listenMoves(roomId);
      });
      this._queueUnsub = () => roomIdRef.off('value', cb);
    }
  }

  /* в”Ђв”Ђ Get opponent name from room в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  async getOpponentName() {
    if (!this.roomId) return 'Opponent';
    try {
      const key  = this.myPlayer === 1 ? 'p2' : 'p1';
      const snap = await this._db.ref(`rooms/${this.roomId}/names/${key}`).once('value');
      return snap.val() || 'Opponent';
    } catch { return 'Opponent'; }
  }

  /* в”Ђв”Ђ Listen for moves в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  _listenMoves(roomId) {
    const movesRef = this._db.ref(`rooms/${roomId}/moves`);
    this._movesRef = movesRef;

    const roomRef = this._db.ref(`rooms/${roomId}`);
    const disconnCb = roomRef.on('value', (snap) => {
      if (!snap.exists()) {
        this._onDisconnCb?.();
        roomRef.off('value', disconnCb);
      }
    });
    this._roomUnsub = () => roomRef.off('value', disconnCb);

    const movesCb = movesRef.on('value', (snap) => {
      if (!snap.exists()) return;
      const raw = snap.val();
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      while (this._moveIdx < arr.length) {
        const mv = arr[this._moveIdx];
        if (mv && mv.player !== this.myPlayer) {
          this._onMoveCb?.(mv);
        }
        this._moveIdx++;
      }
    });
    this._movesUnsub = () => movesRef.off('value', movesCb);
  }

  /* в”Ђв”Ђ Send a move в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  async sendMove(move) {
    if (!this.roomId || !this._movesRef) return;
    try {
      const snap = await this._movesRef.once('value');
      const arr  = snap.exists()
        ? (Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val()))
        : [];
      arr.push({ ...move, player: this.myPlayer });
      await this._movesRef.set(arr);
    } catch (e) {
      console.warn('[online] sendMove failed:', e);
    }
  }

  /* в”Ђв”Ђ Callbacks в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  onMove(cb)         { this._onMoveCb    = cb; }
  onOpponentLeft(cb) { this._onDisconnCb = cb; }

  cancelSearch() {
    this._searching = false;
    this._queueUnsub?.();
    if (this._myId()) this._db?.ref(`queue/${this._myId()}`).remove();
  }

  leaveGame() {
    this._searching = false;
    this._queueUnsub?.();
    this._movesUnsub?.();
    this._roomUnsub?.();
    const myId = this._myId();
    if (myId)        this._db?.ref(`queue/${myId}`).remove();
    if (this.roomId) this._db?.ref(`rooms/${this.roomId}`).remove();
    this.roomId   = null;
    this.myPlayer = null;
    this._moveIdx = 0;
    this._movesRef   = null;
    this._movesUnsub = null;
    this._roomUnsub  = null;
    this._queueUnsub = null;
  }
}

const onlineManager = new OnlineManager();
