/* ═══════════════════════════════════════════════════════════
   game.js — Mills (Nine Men's Morris) Core Logic
   UI-agnostic. Exposes GameState object read by renderer.js.
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Board topology ───────────────────────────────────────
   24 intersections indexed 0-23.
   Layout (rings, outer→inner):

   0 ─────── 1 ─────── 2
   │  8 ──── 9 ──── 10  │
   │  │ 16─17─18    │  │
   7 15  23   19  11  3
   │  │ 22─21─20    │  │
   │  14──13──12    │  │
   6 ─────── 5 ─────── 4
*/

// Adjacency list — legal slide-moves for Phase 2
const ADJACENCY = [
  [1, 7],       // 0
  [0, 2, 9],    // 1
  [1, 3],       // 2
  [2, 4, 11],   // 3
  [3, 5],       // 4
  [4, 6, 13],   // 5
  [5, 7],       // 6
  [0, 6, 15],   // 7
  [9, 15],      // 8
  [1, 8, 10, 17], // 9
  [9, 11],      // 10
  [3, 10, 19],  // 11
  [11, 13],     // 12  — was missing, fixed
  [5, 12, 14],  // 13
  [13, 15],     // 14  — was missing
  [7, 8, 14, 22], // 15 — corrected from original
  [17, 22],     // 16
  [9, 16, 18],  // 17
  [17, 19],     // 18
  [11, 18, 20], // 19
  [19, 21],     // 20
  [13, 20, 22], // 21  — corrected
  [15, 16, 21], // 22  — corrected
  [],           // 23  — center (unused in standard Mills)
];

// Proper adjacency for standard Nine Men's Morris 24-node board
const ADJ = buildAdjacency();
function buildAdjacency() {
  // Outer ring: 0-1-2-3-4-5-6-7
  // Middle ring: 8-9-10-11-12-13-14-15
  // Inner ring: 16-17-18-19-20-21-22-23 — wait, standard Mills has no node 23
  // Let me use the canonical layout:
  // Outer:  0,1,2,3,4,5,6,7
  // Middle: 8,9,10,11,12,13,14,15
  // Inner:  16,17,18,19,20,21,22,23
  // But standard Mills only has 24 nodes (0-23), no center.

  const adj = Array.from({length: 24}, () => []);

  // Outer ring edges
  const outerRing = [0,1,2,3,4,5,6,7];
  for (let i = 0; i < 8; i++) {
    const a = outerRing[i], b = outerRing[(i+1)%8];
    adj[a].push(b); adj[b].push(a);
  }

  // Middle ring edges
  const midRing = [8,9,10,11,12,13,14,15];
  for (let i = 0; i < 8; i++) {
    const a = midRing[i], b = midRing[(i+1)%8];
    adj[a].push(b); adj[b].push(a);
  }

  // Inner ring edges
  const inRing = [16,17,18,19,20,21,22,23];
  for (let i = 0; i < 8; i++) {
    const a = inRing[i], b = inRing[(i+1)%8];
    adj[a].push(b); adj[b].push(a);
  }

  // Spokes connecting rings (at corners of the board cross)
  // Top: 1-9-17  Left: 7-15-23  Bottom: 5-13-21  Right: 3-11-19
  [[1,9],[9,17],[7,15],[15,23],[5,13],[13,21],[3,11],[11,19]].forEach(([a,b]) => {
    adj[a].push(b); adj[b].push(a);
  });

  return adj;
}

// All possible mills (3-in-a-row lines)
const MILLS = [
  // Outer ring
  [0,1,2],[2,3,4],[4,5,6],[6,7,0],
  // Middle ring
  [8,9,10],[10,11,12],[12,13,14],[14,15,8],
  // Inner ring
  [16,17,18],[18,19,20],[20,21,22],[22,23,16],
  // Spokes (vertical/horizontal cross lines)
  [1,9,17],[3,11,19],[5,13,21],[7,15,23],
];

/* ── Node positions (normalized 0-1) for rendering ────────
   Maps node index → {x, y} in a 0-1 coordinate space.
   Renderer multiplies by canvas size.
*/
const NODE_POS = (() => {
  const p = [];
  // Outer ring  (0..7): corners + midpoints of outer square
  // Square goes from 0.05 to 0.95
  const o = 0.05, m = 0.5, f = 0.95;
  p[0]={x:o,y:o}; p[1]={x:m,y:o}; p[2]={x:f,y:o};
  p[3]={x:f,y:m}; p[4]={x:f,y:f}; p[5]={x:m,y:f};
  p[6]={x:o,y:f}; p[7]={x:o,y:m};
  // Middle ring (8..15): 0.22 to 0.78
  const mo=0.22, mf=0.78;
  p[8]={x:mo,y:mo}; p[9]={x:m,y:mo}; p[10]={x:mf,y:mo};
  p[11]={x:mf,y:m}; p[12]={x:mf,y:mf}; p[13]={x:m,y:mf};
  p[14]={x:mo,y:mf}; p[15]={x:mo,y:m};
  // Inner ring  (16..23): 0.38 to 0.62
  const io=0.38, if_=0.62;
  p[16]={x:io,y:io}; p[17]={x:m,y:io}; p[18]={x:if_,y:io};
  p[19]={x:if_,y:m}; p[20]={x:if_,y:if_}; p[21]={x:m,y:if_};
  p[22]={x:io,y:if_}; p[23]={x:io,y:m};
  return p;
})();

/* ── Game phases ──────────────────────────────────────────*/
const Phase = Object.freeze({ PLACEMENT: 'placement', MOVEMENT: 'movement', FLYING: 'flying' });
const GameStatus = Object.freeze({ PLAYING: 'playing', REMOVE: 'remove', WIN: 'win', DRAW: 'draw' });

/* ═══════════════════════════════════════════════
   GameState class
═══════════════════════════════════════════════ */
class GameState {
  constructor() { this._reset(); }

  _reset() {
    // board[i]: 0=empty, 1=p1, 2=p2
    this.board        = new Int8Array(24);
    this.currentPlayer= 1;
    this.status       = GameStatus.PLAYING;
    this.phase        = [null, Phase.PLACEMENT, Phase.PLACEMENT]; // indexed by player
    this.piecesToPlace= [null, 9, 9];  // remaining hand pieces
    this.piecesOnBoard= [null, 0, 0];
    this.captures     = [null, 0, 0];
    this.selectedNode = -1;           // node index of selected piece for movement
    this.validMoves   = [];           // array of node indices
    this.lastMill     = null;         // {player, nodes:[]} last mill formed
    this.history      = [];           // for undo
    this.pendingRemove= false;        // waiting for capture selection
    this.winReason    = '';
    this.winner       = 0;
    this.moveCount    = 0;
  }

  /* ── Snapshot for undo ─────────────────────── */
  _snapshot() {
    return {
      board:         Int8Array.from(this.board),
      currentPlayer: this.currentPlayer,
      status:        this.status,
      phase:         [...this.phase],
      piecesToPlace: [...this.piecesToPlace],
      piecesOnBoard: [...this.piecesOnBoard],
      captures:      [...this.captures],
      selectedNode:  this.selectedNode,
      validMoves:    [...this.validMoves],
      lastMill:      this.lastMill ? {...this.lastMill, nodes:[...this.lastMill.nodes]} : null,
      pendingRemove: this.pendingRemove,
      winReason:     this.winReason,
      winner:        this.winner,
      moveCount:     this.moveCount,
    };
  }

  _restore(snap) {
    this.board         = Int8Array.from(snap.board);
    this.currentPlayer = snap.currentPlayer;
    this.status        = snap.status;
    this.phase         = [...snap.phase];
    this.piecesToPlace = [...snap.piecesToPlace];
    this.piecesOnBoard = [...snap.piecesOnBoard];
    this.captures      = [...snap.captures];
    this.selectedNode  = snap.selectedNode;
    this.validMoves    = [...snap.validMoves];
    this.lastMill      = snap.lastMill ? {...snap.lastMill, nodes:[...snap.lastMill.nodes]} : null;
    this.pendingRemove = snap.pendingRemove;
    this.winReason     = snap.winReason;
    this.winner        = snap.winner;
    this.moveCount     = snap.moveCount;
  }

  undo() {
    if (this.history.length === 0) return false;
    this._restore(this.history.pop());
    return true;
  }

  /* ── Phase helpers ─────────────────────────── */
  _updatePhase(player) {
    if (this.piecesToPlace[player] > 0) {
      this.phase[player] = Phase.PLACEMENT;
    } else if (this.piecesOnBoard[player] <= 3) {
      this.phase[player] = Phase.FLYING;
    } else {
      this.phase[player] = Phase.MOVEMENT;
    }
  }

  currentPhase() { return this.phase[this.currentPlayer]; }

  /* ── Mill detection ────────────────────────── */
  isInMill(node, player) {
    return MILLS.some(m => m.includes(node) && m.every(n => this.board[n] === player));
  }

  _findNewMills(node, player) {
    return MILLS.filter(m => m.includes(node) && m.every(n => this.board[n] === player));
  }

  /* ── Removable pieces for opponent ─────────── */
  removablePieces(byPlayer) {
    const opp = 3 - byPlayer;
    const notInMill = [];
    const inMill = [];
    for (let i = 0; i < 24; i++) {
      if (this.board[i] === opp) {
        if (this.isInMill(i, opp)) inMill.push(i);
        else notInMill.push(i);
      }
    }
    // Can only remove mill pieces if all opponent pieces are in mills
    return notInMill.length > 0 ? notInMill : inMill;
  }

  /* ── Legal moves for movement/flying ───────── */
  legalMoves(node, player) {
    const ph = this.phase[player];
    if (ph === Phase.FLYING) {
      return Array.from({length:24}, (_,i)=>i).filter(i => this.board[i] === 0);
    }
    return ADJ[node].filter(n => this.board[n] === 0);
  }

  /* ── Win / draw checks ──────────────────────── */
  _checkWin(forPlayer) {
    const opp = 3 - forPlayer;
    this._updatePhase(opp);
    if (this.piecesOnBoard[opp] + this.piecesToPlace[opp] <= 2 && this.piecesToPlace[opp] === 0) {
      this.status    = GameStatus.WIN;
      this.winner    = forPlayer;
      this.winReason = 'Opponent reduced to 2 pieces';
      return true;
    }
    // Check if opponent is blocked (no legal moves), only after placement phase
    if (this.piecesToPlace[opp] === 0 && this.phase[opp] === Phase.MOVEMENT) {
      const oppNodes = [];
      for (let i=0;i<24;i++) if (this.board[i]===opp) oppNodes.push(i);
      const blocked = oppNodes.every(n => this.legalMoves(n, opp).length === 0);
      if (blocked) {
        this.status    = GameStatus.WIN;
        this.winner    = forPlayer;
        this.winReason = 'Opponent has no legal moves';
        return true;
      }
    }
    return false;
  }

  _switchPlayer() {
    this.currentPlayer = 3 - this.currentPlayer;
    this._updatePhase(this.currentPlayer);
    this.selectedNode = -1;
    this.validMoves   = [];
  }

  /* ── PLACE ──────────────────────────────────── */
  place(nodeIndex) {
    if (this.status !== GameStatus.PLAYING) return { ok: false };
    if (this.currentPhase() !== Phase.PLACEMENT) return { ok: false };
    if (this.board[nodeIndex] !== 0) return { ok: false };

    this.history.push(this._snapshot());

    const p = this.currentPlayer;
    this.board[nodeIndex] = p;
    this.piecesToPlace[p]--;
    this.piecesOnBoard[p]++;
    this._updatePhase(p);
    this.moveCount++;

    const mills = this._findNewMills(nodeIndex, p);
    if (mills.length > 0) {
      this.lastMill = { player: p, nodes: mills.flat() };
      this.status   = GameStatus.REMOVE;
      this.pendingRemove = true;
      return { ok: true, mill: true, millNodes: this.lastMill.nodes };
    }

    this._switchPlayer();
    return { ok: true, mill: false };
  }

  /* ── SELECT (for movement/flying) ──────────── */
  select(nodeIndex) {
    if (this.status !== GameStatus.PLAYING) return { ok: false };
    const ph = this.currentPhase();
    if (ph !== Phase.MOVEMENT && ph !== Phase.FLYING) return { ok: false };
    if (this.board[nodeIndex] !== this.currentPlayer) return { ok: false };

    this.selectedNode = nodeIndex;
    this.validMoves   = this.legalMoves(nodeIndex, this.currentPlayer);
    return { ok: true, validMoves: this.validMoves };
  }

  /* ── MOVE ───────────────────────────────────── */
  move(fromNode, toNode) {
    if (this.status !== GameStatus.PLAYING) return { ok: false };
    const ph = this.currentPhase();
    if (ph !== Phase.MOVEMENT && ph !== Phase.FLYING) return { ok: false };
    if (this.board[fromNode] !== this.currentPlayer) return { ok: false };
    if (this.board[toNode] !== 0) return { ok: false };
    if (ph === Phase.MOVEMENT && !ADJ[fromNode].includes(toNode)) return { ok: false };

    this.history.push(this._snapshot());

    const p = this.currentPlayer;
    this.board[fromNode] = 0;
    this.board[toNode]   = p;
    this.selectedNode    = -1;
    this.validMoves      = [];
    this.moveCount++;

    const mills = this._findNewMills(toNode, p);
    if (mills.length > 0) {
      this.lastMill = { player: p, nodes: mills.flat() };
      this.status   = GameStatus.REMOVE;
      this.pendingRemove = true;
      return { ok: true, mill: true, millNodes: this.lastMill.nodes };
    }

    this._switchPlayer();
    this._checkWin(p);
    return { ok: true, mill: false };
  }

  /* ── REMOVE ─────────────────────────────────── */
  remove(nodeIndex) {
    if (this.status !== GameStatus.REMOVE) return { ok: false };
    const p   = this.currentPlayer;
    const opp = 3 - p;
    if (this.board[nodeIndex] !== opp) return { ok: false };

    // Check removability
    const removable = this.removablePieces(p);
    if (!removable.includes(nodeIndex)) return { ok: false };

    this.board[nodeIndex] = 0;
    this.piecesOnBoard[opp]--;
    this.captures[p]++;
    this.pendingRemove = false;
    this.status = GameStatus.PLAYING;
    this.lastMill = null;

    if (this._checkWin(p)) return { ok: true, win: true };
    this._switchPlayer();
    return { ok: true, win: false };
  }

  /* ── Public helpers ─────────────────────────── */
  /** Called externally (AI) to apply a full move descriptor */
  applyMove(mv) {
    if (mv.type === 'place')  return this.place(mv.to);
    if (mv.type === 'move')   return this.move(mv.from, mv.to);
    if (mv.type === 'remove') return this.remove(mv.node);
    return { ok: false };
  }

  restart() { this._reset(); }

  getBoardCopy()  { return Int8Array.from(this.board); }
  getNodePos()    { return NODE_POS; }
  getAdjacency()  { return ADJ; }
  getMills()      { return MILLS; }
  getPhase()      { return Phase; }
  getStatus()     { return GameStatus; }
}

// Singleton exposed globally
const gameState = new GameState();
