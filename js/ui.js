/* ═══════════════════════════════════════════════════════════
   ui.js — Menus, modals, HUD updates, sound, settings
═══════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════
   SoundManager — lazy AudioContext
═══════════════════════════════════════════════ */
const SoundManager = (() => {
  let ctx = null;
  let volume = 0.7;
  let enabled = true;

  function _ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function _tone(freq, type, duration, gainVal) {
    if (!enabled || volume === 0) return;
    _ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  const sounds = {
    place()   { _tone(440, 'sine',     0.18, 0.25); _tone(660, 'sine', 0.12, 0.15); },
    move()    { _tone(380, 'triangle', 0.15, 0.20); },
    mill()    {
      [523,659,784,1047].forEach((f,i) =>
        setTimeout(() => _tone(f, 'sine', 0.25, 0.3), i*80)
      );
    },
    capture() { _tone(200, 'sawtooth', 0.25, 0.3); _tone(150, 'square', 0.15, 0.2); },
    win()     {
      [523,659,784,1047,1319].forEach((f,i) =>
        setTimeout(() => _tone(f, 'sine', 0.4, 0.35), i*120)
      );
    },
    click()   { _tone(660, 'sine', 0.08, 0.15); },
    invalid() { _tone(180, 'square', 0.12, 0.2); },
  };

  return {
    play(name) { sounds[name]?.(); },
    setVolume(v) { volume = v / 100; },
    setEnabled(b) { enabled = b; },
    unlock() { _ensure(); }, // call on first user gesture
  };
})();

/* ═══════════════════════════════════════════════
   UIManager
═══════════════════════════════════════════════ */
class UIManager {
  constructor() {
    this.mode       = 'ai';   // 'ai' | 'pvp'
    this.aiPlayer   = 2;
    this.showHints  = true;
    this.animEnabled= true;
    this._activeScreen = 'menu';
    this._modalStack   = [];
    this._onAction     = null; // callback set by main.js
    this._bound        = false;
  }

  /* ── Bind ──────────────────────────────────── */
  init(onAction) {
    this._onAction = onAction;
    if (this._bound) return;
    this._bound = true;
    this._bindMenu();
    this._bindGame();
    this._bindModals();
    this._loadSettings();
  }

  setActionHandler(fn) { this._onAction = fn; }

  /* ── Screen transitions ────────────────────── */
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const el = document.getElementById(`screen-${name}`);
    if (el) {
      el.classList.add('active');
      this._activeScreen = name;
    }
  }

  /* ── Modals ────────────────────────────────── */
  openModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (!el) return;
    el.hidden = false;
    this._modalStack.push(id);
    // Trigger CSS transition
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1';
    }));
    SoundManager.play('click');
  }

  closeModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (!el) return;
    el.hidden = true;
    const idx = this._modalStack.indexOf(id);
    if (idx !== -1) this._modalStack.splice(idx, 1);
  }

  closeTopModal() {
    if (this._modalStack.length > 0) {
      this.closeModal(this._modalStack[this._modalStack.length - 1]);
    }
  }

  /* ── HUD ───────────────────────────────────── */
  updateHUD(state) {
    const GS    = state.getStatus();
    const Phase = state.getPhase();

    // Phase label + icon
    const phaseEl  = document.getElementById('hud-phase');
    const iconEl   = document.getElementById('hud-phase-icon');
    const ph       = state.currentPhase();
    const phaseData = {
      [Phase.PLACEMENT]: { label: 'Placement Phase', icon: '⬡' },
      [Phase.MOVEMENT]:  { label: 'Movement Phase',  icon: '⇄' },
      [Phase.FLYING]:    { label: 'Flying Phase',    icon: '◎' },
    };
    const pd = phaseData[ph] || { label: '', icon: '' };
    if (phaseEl) phaseEl.textContent = pd.label;
    if (iconEl)  iconEl.textContent  = pd.icon;

    // Piece dot tracks
    const p1Alive = (state.piecesToPlace[1] || 0) + (state.piecesOnBoard[1] || 0);
    const p2Alive = (state.piecesToPlace[2] || 0) + (state.piecesOnBoard[2] || 0);
    this._updatePieceTrack('p1-piece-track', p1Alive, 1);
    this._updatePieceTrack('p2-piece-track', p2Alive, 2);

    // Captures badges (score bar + burger panel)
    const c1 = state.captures[1] || 0;
    const c2 = state.captures[2] || 0;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('p1-cap-badge', c1);
    set('p2-cap-badge', c2);
    set('p1-captures',  c1);
    set('p2-captures',  c2);

    // Active player highlight
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('active'));
    if (state.status === GS.PLAYING || state.status === GS.REMOVE) {
      const activeEl = document.getElementById(`hud-p${state.currentPlayer}`);
      if (activeEl) activeEl.classList.add('active');
    }

    // Undo button state
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.disabled = !state.history || state.history.length === 0;
  }

  /* ── Piece dot track helper ─────────────────── */
  _updatePieceTrack(id, alive, player) {
    const el = document.getElementById(id);
    if (!el) return;
    const dots = el.querySelectorAll('.pdot');
    if (dots.length !== 9) {
      el.innerHTML = Array.from({ length: 9 }, (_, i) =>
        `<span class="pdot pdot--p${player}${i >= alive ? ' pdot--dead' : ''}"></span>`
      ).join('');
    } else {
      dots.forEach((d, i) => d.classList.toggle('pdot--dead', i >= alive));
    }
  }

  setMessage(text) {
    const el = document.getElementById('hud-message');
    if (!el || el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('hud-msg-flash');
    void el.offsetWidth; // force reflow
    el.classList.add('hud-msg-flash');
  }

  /* ── Player names ─────────────────────────── */
  setPlayerNames(p1, p2) {
    const set = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    set('p1-name', p1);
    set('p2-name', p2);
  }

  /* ── Game over modal ──────────────────────── */
  showGameOver(state) {
    const title  = document.getElementById('gameover-title');
    const reason = document.getElementById('gameover-reason');
    const badge  = document.getElementById('gameover-badge');
    const p1n = this.mode === 'ai' ? 'You' : 'Player 1';
    const p2n = this.mode === 'ai' ? 'AI'  : 'Player 2';
    const names = [null, p1n, p2n];
    if (title)  title.textContent  = `${names[state.winner]} Wins!`;
    if (reason) reason.textContent = state.winReason || '';
    if (badge) {
      badge.className = `gameover-badge gameover-badge--p${state.winner}`;
    }
    this.openModal('gameover');
    SoundManager.play('win');
    // Show interstitial on Android (via native JS bridge)
    if (window.MillsAds) {
      window.MillsAds.showInterstitial();
    }
  }

  /* ── Settings persistence ─────────────────── */
  _loadSettings() {
    try {
      const vol  = parseInt(localStorage.getItem('mills_volume') ?? '70', 10);
      const diff = localStorage.getItem('mills_difficulty') ?? '3';
      const hints= localStorage.getItem('mills_hints') !== 'false';
      const anim = localStorage.getItem('mills_anim')  !== 'false';

      const volEl  = document.getElementById('setting-volume');
      const diffEl = document.getElementById('setting-difficulty');
      const hintsEl= document.getElementById('setting-hints');
      const animEl = document.getElementById('setting-animations');

      if (volEl)   { volEl.value = vol; SoundManager.setVolume(vol); }
      if (diffEl)  { diffEl.value = diff; ai.setDifficulty(diff); }
      if (hintsEl) { hintsEl.checked = hints; this.showHints = hints; }
      if (animEl)  { animEl.checked = anim;   this.animEnabled = anim; }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      const vol  = document.getElementById('setting-volume')?.value ?? 70;
      const diff = document.getElementById('setting-difficulty')?.value ?? 3;
      const hints= document.getElementById('setting-hints')?.checked ?? true;
      const anim = document.getElementById('setting-animations')?.checked ?? true;
      localStorage.setItem('mills_volume', vol);
      localStorage.setItem('mills_difficulty', diff);
      localStorage.setItem('mills_hints', hints);
      localStorage.setItem('mills_anim', anim);
      SoundManager.setVolume(parseInt(vol, 10));
      ai.setDifficulty(diff);
      this.showHints   = hints;
      this.animEnabled = anim;
    } catch (_) {}
  }

  /* ── Menu bindings ────────────────────────── */
  _bindMenu() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { SoundManager.unlock(); SoundManager.play('click'); fn(); });
    };

    on('btn-vs-ai',      () => { this.mode = 'ai';  this._onAction?.({ type: 'start', mode: 'ai' }); });
    on('btn-vs-player',  () => { this.mode = 'pvp'; this._onAction?.({ type: 'start', mode: 'pvp' }); });
    on('btn-how-to-play',() => this.openModal('howtoplay'));
    on('btn-settings',   () => this.openModal('settings'));
  }

  /* ── In-game bindings ─────────────────────── */
  _bindGame() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { SoundManager.play('click'); fn(); });
    };

    // Burger drawer open/close
    const drawer   = document.getElementById('burger-drawer');
    const backdrop = document.getElementById('burger-backdrop');
    const burgerBtn= document.getElementById('btn-burger');
    const openDrawer = () => {
      drawer?.classList.add('open');
      drawer?.setAttribute('aria-hidden', 'false');
      burgerBtn?.setAttribute('aria-expanded', 'true');
    };
    const closeDrawer = () => {
      drawer?.classList.remove('open');
      drawer?.setAttribute('aria-hidden', 'true');
      burgerBtn?.setAttribute('aria-expanded', 'false');
    };
    on('btn-burger',       () => openDrawer());
    on('btn-drawer-close', () => closeDrawer());
    backdrop?.addEventListener('click', () => { SoundManager.play('click'); closeDrawer(); });

    on('btn-pause',      () => this.openModal('pause'));
    on('btn-menu-back',  () => { closeDrawer(); this.openModal('pause'); });
    on('btn-undo',       () => this._onAction?.({ type: 'undo' }));
    on('btn-new-game',   () => { closeDrawer(); this._onAction?.({ type: 'restart' }); });
  }

  /* ── Modal bindings ───────────────────────── */
  _bindModals() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { SoundManager.play('click'); fn(); });
    };

    on('btn-resume',       () => this.closeModal('pause'));
    on('btn-restart',      () => { this.closeModal('pause'); this._onAction?.({ type: 'restart' }); });
    on('btn-to-menu',      () => { this.closeModal('pause'); this._onAction?.({ type: 'menu' }); });

    on('btn-play-again',   () => { this.closeModal('gameover'); this._onAction?.({ type: 'restart' }); });
    on('btn-gameover-menu',() => { this.closeModal('gameover'); this._onAction?.({ type: 'menu' }); });

    on('btn-howto-close',  () => this.closeModal('howtoplay'));

    on('btn-settings-close',() => { this._saveSettings(); this.closeModal('settings'); });

    // Live volume feedback
    const volEl = document.getElementById('setting-volume');
    if (volEl) volEl.addEventListener('input', e => SoundManager.setVolume(parseInt(e.target.value, 10)));

    // Keyboard Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeTopModal();
    });
  }

  /* ── Contextual message helper ────────────── */
  getContextMessage(state, mode, aiPlayer) {
    const GS    = state.getStatus();
    const Phase = state.getPhase();
    const p     = state.currentPlayer;
    const isAI  = mode === 'ai' && p === aiPlayer;

    if (state.status === GS.REMOVE) {
      return isAI ? 'AI is choosing a piece to capture…' : 'Mill! Select an opponent piece to capture.';
    }
    if (state.status === GS.WIN)    return '';

    const ph = state.currentPhase();
    const who = isAI ? 'AI' : `Player ${p}`;

    if (ph === Phase.PLACEMENT) return `${who}: Place a piece (${state.piecesToPlace[p]} remaining)`;
    if (ph === Phase.FLYING)    return `${who}: Flying! Move to any empty space.`;
    if (state.selectedNode !== -1) return `${who}: Select a destination.`;
    return `${who}: Select a piece to move.`;
  }
}

// Singleton
const uiManager = new UIManager();
