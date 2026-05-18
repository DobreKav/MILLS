/* ═══════════════════════════════════════════════════════════
   main.js — Boot, resize handler, game loop, input routing
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ─────────────────────────────────────────── */
const BANNER_H   = 90;   // px — must match CSS --banner-h
const AI_DELAY   = 200;  // ms before AI move executes

/* AdMob is handled natively in MainActivity.java via Google Mobile Ads SDK.
   No JS initialisation needed — the native banner overlays the bottom of the WebView. */

/* ── App state ──────────────────────────────────────────── */
let mode         = 'ai';  // 'ai' | 'pvp' | 'online'
let aiPlayerNum  = 2;
let gameRunning  = false;
let aiThinking   = false;
let aiTimer      = null;
let lastTime     = 0;
let _hudKey      = '';   // track state changes to avoid per-frame DOM writes
let _gamesPlayed = 0;    // interstitial counter — show every 3rd completed game

function _getHudKey(s) {
  return `${s.currentPlayer}|${s.status}|${s.piecesToPlace[1]}|${s.piecesToPlace[2]}|${s.captures[1]}|${s.captures[2]}|${s.board.join('')}`;
}

/* ── Init on DOMContentLoaded ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const boardCanvas    = document.getElementById('game-canvas');
  const particleCanvas = document.getElementById('particle-canvas');

  // Create renderer singleton
  renderer = new Renderer(boardCanvas, particleCanvas);

  // Wire up UI callbacks
  uiManager.init(handleAction);

  // Show menu
  uiManager.showScreen('menu');

  // Resize once + listen
  handleResize();
  window.addEventListener('resize', handleResize);

  // ResizeObserver: reacts to board-wrap size changes (flex reflows, safe-area changes)
  const wrap = document.getElementById('board-wrap');
  if (wrap && window.ResizeObserver) {
    new ResizeObserver(() => handleResize()).observe(wrap);
  }

  // Canvas click
  boardCanvas.addEventListener('click', onBoardClick);
  boardCanvas.addEventListener('touchend', onBoardTouch, { passive: false });

  // Hint button
  document.getElementById('btn-hint')?.addEventListener('click', onHintClick);

  // Rewarded ad callback (called from Java after reward earned)
  window.onHintRewardEarned = showHint;

  // Matchmaking cancel button
  document.getElementById('btn-cancel-search')?.addEventListener('click', () => {
    onlineManager.cancelSearch();
    _hideMatchmaking();
    goToMenu();
  });

  // Start render loop
  requestAnimationFrame(loop);
});

/* ── Resize handler ─────────────────────────────────────── */
function handleResize() {
  const wrap = document.getElementById('board-wrap');
  if (!wrap) return;
  const size = wrap.clientWidth; // square via CSS
  if (renderer) renderer.resize(size);
}

/* ── Game loop ──────────────────────────────────────────── */
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = ts;

  if (gameRunning && renderer) {
    renderer.draw(dt);
    // Only update HUD DOM when state actually changes (not every frame)
    const key = _getHudKey(gameState);
    if (key !== _hudKey) {
      _hudKey = key;
      uiManager.updateHUD(gameState);
      uiManager.setMessage(
        uiManager.getContextMessage(gameState, mode, aiPlayerNum)
      );
    }
  }

  requestAnimationFrame(loop);
}

/* ── Action dispatcher (from UIManager) ─────────────────── */
function handleAction(action) {
  switch (action.type) {
    case 'start':   startGame(action.mode); break;
    case 'restart': restartGame(); break;
    case 'menu':    goToMenu(); break;
    case 'undo':    doUndo(); break;
  }
}

/* ── Start / restart / menu ─────────────────────────────── */
function startGame(gameMode) {
  mode        = gameMode;
  aiPlayerNum = 2;
  gameState.restart();
  renderer.clearMillHighlight();
  renderer.particles = [];

  const diff = document.getElementById('setting-difficulty')?.value ?? 3;
  ai.setDifficulty(diff);

  uiManager.showHints = document.getElementById('setting-hints')?.checked ?? true;

  // Topbar badge
  const badge = document.getElementById('topbar-badge');
  if (badge) {
    if (mode === 'ai') {
      const diffNames = { '1': 'Easy', '3': 'Medium', '5': 'Hard' };
      badge.textContent = diffNames[String(diff)] || 'Medium';
      badge.className   = 'topbar-badge';
      badge.hidden      = false;
    } else if (mode === 'online') {
      badge.textContent = '🌐 Online';
      badge.className   = 'topbar-badge topbar-badge--online';
      badge.hidden      = false;
    } else {
      badge.hidden = true;
    }
  }

  if (mode === 'online') {
    _startOnlineGame();
    return; // player names + gameRunning set after match found
  }

  const p1Name = mode === 'ai' ? 'You'      : 'Player 1';
  const p2Name = mode === 'ai' ? 'AI'       : 'Player 2';
  uiManager.setPlayerNames(p1Name, p2Name);

  gameRunning = true;
  aiThinking  = false;
  _hudKey     = '';
  clearTimeout(aiTimer);

  uiManager.showScreen('game');
  handleResize();
  scheduleAIIfNeeded();
}

function restartGame() { startGame(mode); }

function goToMenu() {
  gameRunning = false;
  clearTimeout(aiTimer);
  if (mode === 'online') onlineManager.leaveGame();
  uiManager.showScreen('menu');
}

/* ── Online game flow ───────────────────────────────────── */
function _showMatchmaking(msg) {
  const el = document.getElementById('overlay-matchmaking');
  const st = document.getElementById('matchmaking-status');
  if (el) el.hidden = false;
  if (st) st.textContent = msg || 'Searching for opponent…';
}
function _hideMatchmaking() {
  const el = document.getElementById('overlay-matchmaking');
  if (el) el.hidden = true;
}

async function _startOnlineGame() {
  if (!onlineManager.isConfigured()) {
    alert('Online play not configured.\nOpen js/online.js and fill in your Firebase config.');
    goToMenu();
    return;
  }

  uiManager.showScreen('game');
  handleResize();
  _showMatchmaking('Connecting…');

  try {
    await onlineManager.init();
  } catch (e) {
    _hideMatchmaking();
    alert('Could not connect to server.\nCheck your internet connection.');
    goToMenu();
    return;
  }

  _showMatchmaking('Searching for opponent…');

  onlineManager.onMove(applyRemoteMove);
  onlineManager.onOpponentLeft(() => {
    if (!gameRunning) return;
    gameRunning = false;
    _hideMatchmaking();
    alert('Opponent disconnected.');
    goToMenu();
  });

  await onlineManager.findMatch(
    async (myPlayer) => {
      // Match found — fetch opponent's gamer name
      _hideMatchmaking();
      const oppName  = await onlineManager.getOpponentName();
      const p1Name   = myPlayer === 1 ? (onlineManager.pgName || 'You') : oppName;
      const p2Name   = myPlayer === 2 ? (onlineManager.pgName || 'You') : oppName;
      uiManager.setPlayerNames(p1Name, p2Name);
      gameRunning = true;
      aiThinking  = false;
      _hudKey     = '';
    },
    () => {
      _showMatchmaking('Waiting for opponent…');
    }
  );
}

/* ── Apply a remote (opponent) move ─────────────────────── */
function applyRemoteMove(mv) {
  if (!gameRunning) return;

  if (mv.type === 'place') {
    const res = gameState.place(mv.to);
    if (res.ok) {
      SoundManager.play('place');
      renderer.animatePlace(mv.to);
      if (res.mill) {
        renderer.spawnMillParticles(res.millNodes);
        SoundManager.play('mill');
      } else if (res.win) {
        onGameWin();
      }
    }
  } else if (mv.type === 'move') {
    const res = gameState.move(mv.from, mv.to);
    if (res.ok) {
      SoundManager.play('move');
      if (res.mill) {
        renderer.spawnMillParticles(res.millNodes);
        SoundManager.play('mill');
      } else if (res.win) {
        onGameWin();
      }
    }
  } else if (mv.type === 'remove') {
    const res = gameState.remove(mv.node);
    if (res.ok) {
      renderer.spawnCaptureParticles(mv.node);
      SoundManager.play('capture');
      renderer.clearMillHighlight();
      if (res.win) onGameWin();
    }
  }
}

/* ── Undo ────────────────────────────────────────────────── */
function doUndo() {
  if (!gameRunning) return;
  clearTimeout(aiTimer);
  aiThinking = false;

  // In AI mode, undo twice (AI move + player move) so player gets their turn back
  const undoCount = mode === 'ai' ? 2 : 1;
  let ok = false;
  for (let i = 0; i < undoCount; i++) {
    if (gameState.undo()) ok = true;
  }
  if (!ok) gameState.undo(); // fallback: at least undo once

  renderer.clearMillHighlight();
  SoundManager.play('click');
}

/* ── Board input ─────────────────────────────────────────── */
function onBoardClick(e) {
  if (!gameRunning || aiThinking) return;
  const rect = renderer.canvas.getBoundingClientRect();
  const scaleX = renderer.canvas.width  / rect.width;
  const scaleY = renderer.canvas.height / rect.height;
  const x = (e.clientX - rect.left)  * scaleX;
  const y = (e.clientY - rect.top)   * scaleY;
  handleBoardInput(x, y);
}

function onBoardTouch(e) {
  e.preventDefault();
  if (!gameRunning || aiThinking) return;
  const touch = e.changedTouches[0];
  const rect  = renderer.canvas.getBoundingClientRect();
  const scaleX = renderer.canvas.width  / rect.width;
  const scaleY = renderer.canvas.height / rect.height;
  const x = (touch.clientX - rect.left) * scaleX;
  const y = (touch.clientY - rect.top)  * scaleY;
  handleBoardInput(x, y);
}

function handleBoardInput(x, y) {
  SoundManager.unlock();

  // Don't accept input if it's AI's turn
  if (mode === 'ai' && gameState.currentPlayer === aiPlayerNum) return;

  // Don't accept input if it's opponent's turn in online mode
  if (mode === 'online' && gameState.currentPlayer !== onlineManager.myPlayer) return;

  const node = renderer.nodeAt(x, y);
  if (node === -1) {
    // Click on empty area — deselect
    gameState.selectedNode = -1;
    gameState.validMoves   = [];
    return;
  }

  const GS    = gameState.getStatus();
  const Phase = gameState.getPhase();
  const status= gameState.status;

  /* Removal phase */
  if (status === GS.REMOVE) {
    const res = gameState.remove(node);
    if (!res.ok) { SoundManager.play('invalid'); return; }
    renderer.spawnCaptureParticles(node);
    SoundManager.play('capture');
    renderer.clearMillHighlight();
    if (mode === 'online') onlineManager.sendMove({ type: 'remove', node });
    if (res.win) { onGameWin(); return; }
    scheduleAIIfNeeded();
    return;
  }

  if (status !== GS.PLAYING) return;

  const phase = gameState.currentPhase();

  /* Placement */
  if (phase === Phase.PLACEMENT) {
    const res = gameState.place(node);
    if (!res.ok) { SoundManager.play('invalid'); return; }
    SoundManager.play('place');
    renderer.animatePlace(node);
    if (mode === 'online') onlineManager.sendMove({ type: 'place', to: node });
    if (res.mill) {
      renderer.spawnMillParticles(res.millNodes);
      SoundManager.play('mill');
      // Stay in REMOVE state — wait for player to pick opponent piece
    } else {
      scheduleAIIfNeeded();
    }
    return;
  }

  /* Movement / Flying */
  if (phase === Phase.MOVEMENT || phase === Phase.FLYING) {
    // Already have a selected piece?
    if (gameState.selectedNode !== -1) {
      // Try to move to this node
      if (gameState.validMoves.includes(node)) {
        const from = gameState.selectedNode;
        const res  = gameState.move(from, node);
        if (!res.ok) { SoundManager.play('invalid'); return; }
        SoundManager.play('move');
        if (mode === 'online') onlineManager.sendMove({ type: 'move', from, to: node });
        if (res.mill) {
          renderer.spawnMillParticles(res.millNodes);
          SoundManager.play('mill');
        } else if (res.win) {
          onGameWin();
        } else {
          scheduleAIIfNeeded();
        }
        return;
      }
      // Clicked another own piece — re-select
      if (gameState.board[node] === gameState.currentPlayer) {
        gameState.select(node);
        SoundManager.play('click');
        return;
      }
      // Invalid target
      SoundManager.play('invalid');
      return;
    }

    // Select a piece
    const res = gameState.select(node);
    if (!res.ok) { SoundManager.play('invalid'); return; }
    SoundManager.play('click');
  }
}

/* ── AI turn scheduling ──────────────────────────────────── */
function scheduleAIIfNeeded() {
  if (!gameRunning) return;
  if (mode !== 'ai') return;  // AI only in 'ai' mode, not pvp/online

  const GS = gameState.getStatus();
  if (gameState.status === GS.WIN) return;

  if (gameState.currentPlayer === aiPlayerNum || gameState.status === GS.REMOVE && gameState.currentPlayer === aiPlayerNum) {
    aiThinking = true;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(doAIMove, AI_DELAY);
  }
}

function doAIMove() {
  if (!gameRunning) { aiThinking = false; return; }

  const GS = gameState.getStatus();
  if (gameState.status === GS.WIN) { aiThinking = false; return; }

  const mv = ai.getBestMove(gameState);
  if (!mv) { aiThinking = false; return; }

  if (mv.type === 'place') {
    const res = gameState.place(mv.to);
    if (res.ok) {
      SoundManager.play('place');
      renderer.animatePlace(mv.to);
      if (res.mill) {
        renderer.spawnMillParticles(res.millNodes);
        SoundManager.play('mill');
        // AI immediately picks best removal
        aiTimer = setTimeout(() => {
          const rmv = ai._pickRemove(gameState, aiPlayerNum);
          if (rmv) {
            const rres = gameState.remove(rmv.node);
            if (rres.ok) {
              renderer.spawnCaptureParticles(rmv.node);
              SoundManager.play('capture');
              renderer.clearMillHighlight();
              if (rres.win) onGameWin();
            }
          }
          aiThinking = false;
        }, 400);
        return;
      }
    }
  } else if (mv.type === 'move') {
    const res = gameState.move(mv.from, mv.to);
    if (res.ok) {
      SoundManager.play('move');
      if (res.mill) {
        renderer.spawnMillParticles(res.millNodes);
        SoundManager.play('mill');
        aiTimer = setTimeout(() => {
          const rmv = ai._pickRemove(gameState, aiPlayerNum);
          if (rmv) {
            const rres = gameState.remove(rmv.node);
            if (rres.ok) {
              renderer.spawnCaptureParticles(rmv.node);
              SoundManager.play('capture');
              renderer.clearMillHighlight();
              if (rres.win) { onGameWin(); aiThinking = false; return; }
            }
          }
          aiThinking = false;
        }, 400);
        return;
      }
      if (res.win) { onGameWin(); aiThinking = false; return; }
    }
  } else if (mv.type === 'remove') {
    const res = gameState.remove(mv.node);
    if (res.ok) {
      renderer.spawnCaptureParticles(mv.node);
      SoundManager.play('capture');
      renderer.clearMillHighlight();
      if (res.win) { onGameWin(); aiThinking = false; return; }
    }
  }

  aiThinking = false;
}

/* ── Win ────────────────────────────────────────────────── */
function onGameWin() {
  gameRunning = false;
  renderer.clearMillHighlight();

  _gamesPlayed++;
  const showAd = (_gamesPlayed % 3 === 0) && window.MillsAds;
  const delay  = showAd ? 0 : 600;

  if (showAd) {
    window.MillsAds.showInterstitial();
  }

  setTimeout(() => uiManager.showGameOver(gameState), delay + 600);
}

/* ── Hint (rewarded ad) ─────────────────────────────────── */
let _hintCooldown = false;

function onHintClick() {
  if (!gameRunning || _hintCooldown) return;
  _hintCooldown = true;
  const btn = document.getElementById('btn-hint');
  if (btn) btn.disabled = true;

  if (window.MillsAds) {
    window.MillsAds.showRewarded(); // Java calls onHintRewardEarned() after reward
  } else {
    showHint(); // browser / dev fallback — give hint for free
  }
}

function showHint() {
  const best = ai.getBestMove(gameState, 3);
  if (best !== null && best !== undefined) {
    renderer.flashHint(best);
  }
  // Re-enable after 8 s so player can't spam
  setTimeout(() => {
    _hintCooldown = false;
    const btn = document.getElementById('btn-hint');
    if (btn) btn.disabled = false;
  }, 8000);
}
