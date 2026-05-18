/* ═══════════════════════════════════════════════════════════
   ai.js — Mills AI opponent (minimax + alpha-beta pruning)
   Reads gameState; returns a move descriptor { type, from?, to, node? }
═══════════════════════════════════════════════════════════ */

'use strict';

class MillsAI {
  constructor() {
    this.depth = 3; // default medium
  }

  setDifficulty(level) {
    // level: 1=easy, 3=medium, 5=hard
    this.depth = parseInt(level, 10);
  }

  /* ── Entry point ───────────────────────────── */
  getBestMove(state) {
    const player = state.currentPlayer;
    const status = state.status;
    const GS = state.getStatus();

    // Pending removal after a mill
    if (status === GS.REMOVE) {
      return this._pickRemove(state, player);
    }

    const phase = state.currentPhase();
    const Phase = state.getPhase();

    if (phase === Phase.PLACEMENT) {
      return this._minimax(state, this.depth, -Infinity, Infinity, true, player).move;
    }
    return this._minimax(state, this.depth, -Infinity, Infinity, true, player).move;
  }

  /* ── Remove: pick opponent piece with lowest value ─────── */
  _pickRemove(state, aiPlayer) {
    const removable = state.removablePieces(aiPlayer);
    if (removable.length === 0) return null;

    // Pick the piece that costs the opponent most: prefer breaking mills
    let best = removable[0];
    let bestScore = -Infinity;
    const board = state.board;
    const MILLS_LIST = state.getMills();

    for (const n of removable) {
      let score = 0;
      // How many mills does removing this piece break?
      for (const mill of MILLS_LIST) {
        if (mill.includes(n)) score += 10;
      }
      // How many potential mills (2 pieces of opponent in same line)?
      const opp = 3 - aiPlayer;
      for (const mill of MILLS_LIST) {
        const cnt = mill.filter(x => board[x] === opp).length;
        if (cnt === 2 && mill.includes(n)) score += 5;
      }
      if (score > bestScore) { bestScore = score; best = n; }
    }
    return { type: 'remove', node: best };
  }

  /* ── Generate all legal moves for a board state ────────── */
  _generateMoves(state) {
    const moves = [];
    const GS    = state.getStatus();
    const Phase = state.getPhase();
    const p     = state.currentPlayer;
    const phase = state.currentPhase();

    if (state.status === GS.REMOVE) {
      const removable = state.removablePieces(p);
      return removable.map(n => ({ type: 'remove', node: n }));
    }

    if (phase === Phase.PLACEMENT) {
      for (let i = 0; i < 24; i++) {
        if (state.board[i] === 0) moves.push({ type: 'place', to: i });
      }
    } else {
      // MOVEMENT or FLYING
      for (let from = 0; from < 24; from++) {
        if (state.board[from] !== p) continue;
        const dests = state.legalMoves(from, p);
        for (const to of dests) moves.push({ type: 'move', from, to });
      }
    }
    return moves;
  }

  /* ── Evaluation function ───────────────────── */
  _evaluate(state, aiPlayer) {
    const GS  = state.getStatus();
    const opp = 3 - aiPlayer;

    if (state.status === GS.WIN) {
      return state.winner === aiPlayer ? 10000 : -10000;
    }

    const board     = state.board;
    const MILLS_LIST= state.getMills();
    let score = 0;

    // Material: pieces on board
    let myPieces = 0, oppPieces = 0;
    for (let i = 0; i < 24; i++) {
      if (board[i] === aiPlayer) myPieces++;
      else if (board[i] === opp) oppPieces++;
    }
    score += (myPieces - oppPieces) * 20;

    // Mills formed
    for (const mill of MILLS_LIST) {
      const myCount  = mill.filter(n => board[n] === aiPlayer).length;
      const oppCount = mill.filter(n => board[n] === opp).length;
      if (myCount === 3)  score += 50;
      if (oppCount === 3) score -= 50;
      if (myCount === 2 && oppCount === 0) score += 8;
      if (oppCount === 2 && myCount === 0) score -= 8;
      if (myCount === 1 && oppCount === 0) score += 2;
    }

    // Mobility (number of legal moves)
    const myMoves  = this._countMoves(state, aiPlayer);
    const oppMoves = this._countMoves(state, opp);
    score += (myMoves - oppMoves) * 2;

    // In-hand pieces
    score += (state.piecesToPlace[aiPlayer] - state.piecesToPlace[opp]) * 3;

    return score;
  }

  _countMoves(state, player) {
    const Phase = state.getPhase();
    const ph    = state.phase[player];
    if (ph === Phase.PLACEMENT) return state.piecesToPlace[player];
    let count = 0;
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === player) count += state.legalMoves(i, player).length;
    }
    return count;
  }

  /* ── Clone state for search ────────────────── */
  _cloneState(state) {
    const clone = new GameState();
    clone._restore(state._snapshot());
    return clone;
  }

  /* ── Minimax + alpha-beta ──────────────────── */
  _minimax(state, depth, alpha, beta, maximising, aiPlayer) {
    const GS = state.getStatus();

    if (depth === 0 || state.status === GS.WIN) {
      return { score: this._evaluate(state, aiPlayer), move: null };
    }

    const moves = this._generateMoves(state);
    if (moves.length === 0) {
      return { score: this._evaluate(state, aiPlayer), move: null };
    }

    // Shuffle to add variety at equal scores
    this._shuffle(moves);

    let bestMove = moves[0];

    if (maximising) {
      let best = -Infinity;
      for (const mv of moves) {
        const clone = this._cloneState(state);
        clone.applyMove(mv);
        const result = this._minimax(clone, depth - 1, alpha, beta, false, aiPlayer);
        if (result.score > best) { best = result.score; bestMove = mv; }
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return { score: best, move: bestMove };
    } else {
      let best = Infinity;
      for (const mv of moves) {
        const clone = this._cloneState(state);
        clone.applyMove(mv);
        const result = this._minimax(clone, depth - 1, alpha, beta, true, aiPlayer);
        if (result.score < best) { best = result.score; bestMove = mv; }
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return { score: best, move: bestMove };
    }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

// Singleton
const ai = new MillsAI();
