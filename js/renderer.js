/* ═══════════════════════════════════════════════════════════
   renderer.js — Canvas rendering for Mills game board
   Reads from gameState; draws board, pieces, particles.
═══════════════════════════════════════════════════════════ */

'use strict';

class Renderer {
  constructor(boardCanvas, particleCanvas) {
    this.canvas   = boardCanvas;
    this.ctx      = boardCanvas.getContext('2d');
    this.pCanvas  = particleCanvas;
    this.pCtx     = particleCanvas.getContext('2d');

    this.size     = 0; // set by resize()
    this.particles= [];
    this.animations= [];   // { node, type, t, duration }
    this.millNodes = new Set();
    this.millFlashT= 0;

    this._loadBoardPattern();
  }

  /* ── Board wood texture (procedural fallback) ─ */
  _loadBoardPattern() {
    const off = document.createElement('canvas');
    off.width = off.height = 128;
    const g = off.getContext('2d');
    g.fillStyle = '#7a5228';
    g.fillRect(0, 0, 128, 128);

    // Wood grain lines
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * 128;
      const curl = (Math.random() - 0.5) * 20;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(32, y + curl, 96, y - curl, 128, y + curl * 0.5);
      const alpha = 0.06 + Math.random() * 0.08;
      g.strokeStyle = `rgba(${Math.random()>0.5?'180,120,50':'100,60,20'},${alpha})`;
      g.lineWidth = 0.5 + Math.random() * 1.5;
      g.stroke();
    }
    // Subtle knot
    const kx = 60 + Math.random()*20, ky = 50 + Math.random()*30;
    const kg = g.createRadialGradient(kx,ky,2,kx,ky,18);
    kg.addColorStop(0,'rgba(80,40,10,0.3)');
    kg.addColorStop(1,'transparent');
    g.fillStyle = kg;
    g.beginPath(); g.ellipse(kx,ky,18,12,0.4,0,Math.PI*2); g.fill();

    this.boardPattern = this.ctx.createPattern(off, 'repeat');
  }

  resize(size) {
    this.size = size;
    this.canvas.width  = this.canvas.height  = size;
    this.pCanvas.width = this.pCanvas.height = size;
  }

  /* ── Coordinate helpers ────────────────────── */
  _pos(nodeIndex) {
    const np = gameState.getNodePos()[nodeIndex];
    const pad = this.size * 0.06;
    const inner = this.size - pad * 2;
    return {
      x: pad + np.x * inner,
      y: pad + np.y * inner,
    };
  }

  nodeRadius() { return Math.max(14, this.size * 0.038); }

  nodeAt(px, py) {
    const r = this.nodeRadius() * 1.4;
    for (let i = 0; i < 24; i++) {
      const p = this._pos(i);
      if ((px-p.x)**2 + (py-p.y)**2 <= r*r) return i;
    }
    return -1;
  }

  /* ═══════════════════════════════════════════════
     MAIN DRAW
  ═══════════════════════════════════════════════ */
  draw(dt) {
    const ctx  = this.ctx;
    const size = this.size;
    ctx.clearRect(0, 0, size, size);

    this._drawBoardBg(ctx, size);
    this._drawBoardLines(ctx);
    this._drawMillHighlight(ctx, dt);
    this._drawNodes(ctx);
    this._drawValidMoves(ctx);
    this._drawPieces(ctx, dt);
    this._drawSelectedRing(ctx, dt);
    this._drawHint(ctx);
    this._updateParticles(dt);
    this._drawParticles();
  }

  /* ── Board background ──────────────────────── */
  _drawBoardBg(ctx, size) {
    const r = size * 0.03;
    ctx.save();
    this._roundRect(ctx, 0, 0, size, size, r);
    ctx.clip();

    // Wood texture
    ctx.fillStyle = this.boardPattern || '#7a5228';
    ctx.fillRect(0, 0, size, size);

    // Vignette overlay
    const vig = ctx.createRadialGradient(size/2,size/2,size*0.2,size/2,size/2,size*0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);

    // Subtle inner border glow
    ctx.strokeStyle = 'rgba(200,146,42,0.25)';
    ctx.lineWidth = 3;
    this._roundRect(ctx, 4, 4, size-8, size-8, r);
    ctx.stroke();

    // Corner ornament brackets (drawn outside clip)
    ctx.restore();
    this._drawCornerBrackets(ctx, size);
    ctx.save();
    ctx.restore();
  }

  _drawCornerBrackets(ctx, size) {
    const pad = size * 0.028;
    const len = size * 0.09;
    const corners = [
      { x: pad,       y: pad,       sx: 1,  sy: 1  },
      { x: size-pad,  y: pad,       sx: -1, sy: 1  },
      { x: pad,       y: size-pad,  sx: 1,  sy: -1 },
      { x: size-pad,  y: size-pad,  sx: -1, sy: -1 },
    ];
    ctx.save();
    ctx.strokeStyle = 'rgba(200,146,42,0.55)';
    ctx.lineWidth   = Math.max(1.5, size * 0.0035);
    ctx.lineCap     = 'square';
    ctx.shadowColor = 'rgba(200,146,42,0.3)';
    ctx.shadowBlur  = 4;
    for (const { x, y, sx, sy } of corners) {
      ctx.beginPath();
      ctx.moveTo(x + sx * len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * len);
      ctx.stroke();
      // Diamond jewel at corner tip
      const d = size * 0.013;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x, y - d);
      ctx.lineTo(x + d, y);
      ctx.lineTo(x, y + d);
      ctx.lineTo(x - d, y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,146,42,0.50)';
      ctx.fill();
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  /* ── Board lines ───────────────────────────── */
  _drawBoardLines(ctx) {
    ctx.save();
    ctx.strokeStyle = '#d4b896';
    ctx.lineWidth   = Math.max(1.5, this.size * 0.003);
    ctx.shadowColor = 'rgba(200,146,42,0.3)';
    ctx.shadowBlur  = 4;

    const MILLS_LIST = gameState.getMills();
    // Draw each mill line as a segment
    const drawn = new Set();
    for (const mill of MILLS_LIST) {
      for (let i = 0; i < mill.length - 1; i++) {
        const key = [mill[i],mill[i+1]].sort().join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = this._pos(mill[i]);
        const b = this._pos(mill[i+1]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ── Mill flash highlight ──────────────────── */
  _drawMillHighlight(ctx, dt) {
    if (this.millNodes.size === 0) return;
    this.millFlashT = (this.millFlashT + dt * 2) % (Math.PI * 2);
    const alpha = 0.3 + 0.3 * Math.sin(this.millFlashT);

    ctx.save();
    ctx.strokeStyle = `rgba(255,204,0,${alpha})`;
    ctx.lineWidth   = Math.max(3, this.size * 0.006);
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = 12;

    const MILLS_LIST = gameState.getMills();
    for (const mill of MILLS_LIST) {
      if (mill.every(n => this.millNodes.has(n))) {
        const a = this._pos(mill[0]);
        const b = this._pos(mill[2]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ── Intersection dots ─────────────────────── */
  _drawNodes(ctx) {
    ctx.save();
    ctx.fillStyle   = '#d4b896';
    ctx.shadowColor = 'rgba(200,146,42,0.4)';
    ctx.shadowBlur  = 3;
    const dotR = Math.max(3, this.size * 0.008);
    for (let i = 0; i < 24; i++) {
      const p = this._pos(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── Valid move hints ──────────────────────── */
  _drawValidMoves(ctx) {
    const moves = gameState.validMoves;
    if (!moves || moves.length === 0) return;
    const r = this.nodeRadius() * 0.55;
    ctx.save();
    ctx.fillStyle = 'rgba(80,200,80,0.40)';
    ctx.shadowColor = 'rgba(80,200,80,0.6)';
    ctx.shadowBlur = 8;
    for (const n of moves) {
      const p = this._pos(n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── Pieces ────────────────────────────────── */
  _drawPieces(ctx, dt) {
    const board = gameState.board;
    const r     = this.nodeRadius();

    for (let i = 0; i < 24; i++) {
      if (board[i] === 0) continue;
      const p = this._pos(i);
      const isP1 = board[i] === 1;
      this._drawPiece(ctx, p.x, p.y, r, isP1, false);
    }
  }

  _drawPiece(ctx, x, y, r, isP1, selected) {
    ctx.save();

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = r * 0.5;
    ctx.shadowOffsetX = r * 0.1;
    ctx.shadowOffsetY = r * 0.2;

    // Base sphere gradient
    const grd = ctx.createRadialGradient(
      x - r*0.3, y - r*0.3, r*0.05,
      x,         y,         r
    );
    if (isP1) {
      grd.addColorStop(0, '#f5e6c8');
      grd.addColorStop(0.6, '#d4a865');
      grd.addColorStop(1,   '#c4a46b');
    } else {
      grd.addColorStop(0, '#6b4020');
      grd.addColorStop(0.5, '#3a1e08');
      grd.addColorStop(1,   '#1a0d04');
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Inner highlight arc
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    const hl = ctx.createRadialGradient(x-r*0.35, y-r*0.35, 0, x-r*0.35, y-r*0.35, r*0.65);
    hl.addColorStop(0, isP1 ? 'rgba(255,255,230,0.55)' : 'rgba(180,100,40,0.30)');
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = hl;
    ctx.fill();

    // Rim
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.strokeStyle = isP1 ? 'rgba(180,140,80,0.6)' : 'rgba(80,40,10,0.8)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /* ── Selected piece ring ───────────────────── */
  _selectedPulseT = 0;
  _drawSelectedRing(ctx, dt) {
    const sel = gameState.selectedNode;
    if (sel === -1) return;
    this._selectedPulseT += dt * 3;
    const pulse = 0.6 + 0.4 * Math.sin(this._selectedPulseT);
    const r = this.nodeRadius();
    const p = this._pos(sel);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 4 + pulse*3, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(200,146,42,${0.7 + 0.3*pulse})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#c8922a';
    ctx.shadowBlur  = 12 * pulse;
    ctx.stroke();
    ctx.restore();
  }

  /* ═══════════════════════════════════════════════
     PARTICLES
  ═══════════════════════════════════════════════ */

  /** Spawn mill-formation sparks */
  spawnMillParticles(millNodeList) {
    this.millNodes = new Set(millNodeList);
    this.millFlashT = 0;

    for (const nodeIdx of millNodeList) {
      const p = this._pos(nodeIdx);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI*2/6)*i + Math.random()*0.5;
        const speed = 60 + Math.random()*80;
        this.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(angle)*speed,
          vy: Math.sin(angle)*speed,
          life: 1, decay: 1.2 + Math.random()*0.8,
          r: 2 + Math.random()*3,
          color: `hsl(${40+Math.random()*30},90%,${60+Math.random()*20}%)`
        });
      }
    }
  }

  /** Spawn capture dissolve particles */
  spawnCaptureParticles(nodeIdx) {
    const p = this._pos(nodeIdx);
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI*2;
      const speed = 30 + Math.random()*60;
      this.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 1, decay: 1.5 + Math.random(),
        r: 2 + Math.random()*4,
        color: `rgba(150,80,30,${0.6+Math.random()*0.4})`
      });
    }
  }

  clearMillHighlight() { this.millNodes.clear(); }

  /** Flash a hint move on the board for ~5 seconds */
  flashHint(move) {
    this._hintMove    = move;
    this._hintStartTs = performance.now();
    this._hintDurationMs = 5000;
  }

  _clearHintIfExpired() {
    if (!this._hintMove) return;
    if (performance.now() - this._hintStartTs > this._hintDurationMs) {
      this._hintMove = null;
    }
  }

  _drawHint(ctx) {
    this._clearHintIfExpired();
    if (!this._hintMove) return;
    const elapsed = (performance.now() - this._hintStartTs) / 1000;
    const pulse   = 0.5 + 0.5 * Math.sin(elapsed * 5);
    const r       = this.nodeRadius();
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 18 * pulse;
    ctx.strokeStyle = `rgba(0,200,255,${0.6 + 0.4 * pulse})`;
    ctx.lineWidth   = 3;
    // "from" node (piece to move)
    const fromNode = this._hintMove.from ?? this._hintMove.node;
    if (fromNode !== undefined && fromNode !== null) {
      const p = this._pos(fromNode);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // "to" node (destination)
    const toNode = this._hintMove.to;
    if (toNode !== undefined && toNode !== null) {
      const p = this._pos(toNode);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      // Arrow line from → to
      if (fromNode !== undefined && fromNode !== null) {
        const pf = this._pos(fromNode);
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pf.x, pf.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _drawParticles() {
    const ctx = this.pCtx;
    ctx.clearRect(0, 0, this.pCanvas.width, this.pCanvas.height);
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.r * 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── Piece placement animation (scale pop) ─── */
  animatePlace(nodeIdx) {
    // We schedule a CSS-like scale animation by drawing a ghost over canvas
    this.animations.push({ type: 'place', node: nodeIdx, t: 0, duration: 0.25 });
  }

  _drawPlaceAnim(ctx, dt) {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      anim.t += dt / anim.duration;
      if (anim.t >= 1) { this.animations.splice(i, 1); continue; }
      const t = anim.t;
      // Spring: overshoot scale
      const scale = t < 0.7
        ? (t/0.7) * 1.18
        : 1.18 - (t-0.7)/0.3 * 0.18;
      const p    = this._pos(anim.node);
      const base = this.nodeRadius();
      const r    = base * scale;
      const isP1 = gameState.board[anim.node] === 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t*3);
      this._drawPiece(ctx, p.x, p.y, r, isP1, false);
      ctx.restore();
    }
  }
}

// Singleton (instantiated in main.js after DOM ready)
let renderer = null;
