/* Правила позиции принадлежат chess.js; здесь только управление партией и голосами. */
class GameSession {
  constructor(now = () => Date.now()) { this.now = now; this.reset('w'); }
  reset(streamer) { this.chess = new Chess(); this.streamer = streamer; this.active = false; this.result = ''; this.votes = new Map(); this.sequence = 0; this.deadline = 0; this.lastMove = null; }
  start(streamer) { this.reset(streamer); this.active = true; this.deadline = this.now() + 60000; }
  get chatColor() { return this.streamer === 'w' ? 'b' : 'w'; }
  remaining() { return Math.max(0, this.deadline - this.now()); }
  parse(text) { const m = text.trim().match(/^!?([a-h][1-8])\s*([a-h][1-8])([qrbn])?$/i); return m ? { from: m[1].toLowerCase(), to: m[2].toLowerCase(), promotion: (m[3] || 'q').toLowerCase() } : null; }
  legal(move) { return move && this.chess.moves({ verbose: true }).find(m => m.from === move.from && m.to === move.to && (!m.promotion || m.promotion === move.promotion)); }
  vote(user, text) {
    const move = this.parse(text);
    if (!move) return { ok: false, message: 'Реплика' };
    if (!this.active) return { ok: false, message: 'Партия ещё не идёт' };
    if (this.remaining() <= 0) { this.tick(); return { ok: false, message: 'Время голосования истекло' }; }
    if (this.chess.turn() !== this.chatColor) return { ok: false, message: 'Сейчас ход стримера' };
    if (!this.legal(move)) return { ok: false, message: 'Недопустимый ход' };
    const key = move.from + move.to + (this.legal(move).promotion || '');
    this.votes.set(user.toLowerCase(), { key, move, order: this.sequence++ });
    return { ok: true, message: 'Голос принят: !' + key.toUpperCase(), square: move.from };
  }
  tally() {
    const totals = new Map();
    for (const vote of this.votes.values()) { const item = totals.get(vote.key); if (item) { item.count++; item.order = Math.min(item.order, vote.order); } else totals.set(vote.key, { ...vote, count: 1 }); }
    return [...totals.values()].sort((a, b) => b.count - a.count || a.order - b.order);
  }
  streamerMove(move) {
    if (!this.active || this.chess.turn() !== this.streamer) return false;
    if (this.remaining() <= 0) { this.tick(); return false; }
    return this.apply(move);
  }
  apply(move) {
    if (!this.legal(move)) return false;
    this.lastMove = this.chess.move(move); this.votes.clear(); this.sequence = 0;
    if (this.chess.isCheckmate()) this.finish('Мат. Победил ' + (this.chess.turn() === this.streamer ? 'Twitch-чат!' : 'стример!'));
    else if (this.chess.isStalemate()) this.finish('Ничья: пат.');
    else if (this.chess.isThreefoldRepetition()) this.finish('Ничья: троекратное повторение позиции.');
    else if (this.chess.isInsufficientMaterial()) this.finish('Ничья: недостаточно материала.');
    else if (this.chess.isDraw()) this.finish('Ничья: правило 50 ходов.');
    else this.deadline = this.now() + 60000;
    return true;
  }
  tick() {
    if (!this.active || this.remaining() > 0) return false;
    if (this.chess.turn() === this.chatColor && this.tally().length) this.apply(this.tally()[0].move);
    else this.finish('Время истекло. Победил ' + (this.chess.turn() === this.streamer ? 'Twitch-чат!' : 'стример!'));
    return true;
  }
  finish(result) { this.active = false; this.result = result; this.votes.clear(); }
}
globalThis.GameSession = GameSession;
