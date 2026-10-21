const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
for (const file of ['vendor/chess.js', 'game-session.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));

// Ускоряется только внедрённый источник времени. Производственный лимит — 60 секунд.
function setup(side = 'w', fen) {
  let now = 0;
  const game = new GameSession(() => now);
  game.start(side);
  if (fen) game.chess.load(fen);
  return { game, play(command) {
    assert.equal(game.active, true, 'Партия должна идти перед ходом ' + command);
    if (game.chess.turn() === game.streamer) assert.equal(game.streamerMove(game.parse(command)), true, command);
    else {
      assert.equal(game.vote('viewer', command).ok, true, command);
      now += 59999; assert.equal(game.tick(), false, 'До дедлайна ход запрещён');
      now++; assert.equal(game.tick(), true, 'Ход выполняется по дедлайну');
    }
  } };
}

test('Дурацкий и детский мат: полные партии за оба цвета стримера', () => {
  for (const side of ['w', 'b']) for (const commands of [
    ['!F2F3', '!E7E5', '!G2G4', '!D8H4'],
    ['!E2E4', '!E7E5', '!F1C4', '!B8C6', '!D1H5', '!G8F6', '!H5F7']
  ]) {
    const { game, play } = setup(side); commands.forEach(play);
    assert.equal(game.chess.isCheckmate(), true); assert.equal(game.active, false);
    assert.match(game.result, /Мат/);
    const winner = game.chess.turn() === game.streamer ? 'Twitch-чат' : 'стример';
    assert.ok(game.result.includes(winner));
    const fen = game.chess.fen(); assert.equal(game.streamerMove(game.parse('!A2A3')), false);
    assert.equal(game.vote('late', '!A2A3').ok, false); assert.equal(game.tick(), false);
    assert.equal(game.chess.fen(), fen);
  }
});

test('Шах требует защиты: посторонний ход запрещён; заслон снимает шах', () => {
  const { game, play } = setup('w'); ['!E2E4', '!F7F6', '!D1H5'].forEach(play);
  assert.equal(game.chess.isCheck(), true);
  const fen = game.chess.fen(); assert.equal(game.vote('bad', '!A7A6').ok, false); assert.equal(game.chess.fen(), fen);
  play('!G7G6'); assert.equal(game.chess.isCheck(), false); assert.equal(game.active, true);
});

test('Обе стороны рокируют в полной партии; длинная рокировка переносит ладью', () => {
  const { game, play } = setup('b');
  ['!E2E4','!E7E5','!G1F3','!B8C6','!F1C4','!G8F6','!E1G1','!F8C5','!D2D3','!E8G8'].forEach(play);
  for (const square of ['g1','g8']) assert.equal(game.chess.get(square).type, 'k');
  for (const square of ['f1','f8']) assert.equal(game.chess.get(square).type, 'r');
  for (const side of ['w','b']) {
    const long = setup(side, 'r3k2r/8/8/8/8/8/8/R3K2R ' + side + ' KQkq - 0 1');
    long.play(side === 'w' ? '!E1C1' : '!E8C8');
    assert.equal(long.game.chess.get(side === 'w' ? 'd1' : 'd8').type, 'r');
  }
});

test('Нельзя рокировать через шах, из-под шаха или после хода королём', () => {
  for (const fen of ['4kr2/8/8/8/8/8/8/4K2R w K - 0 1', 'k3r3/8/8/8/8/8/8/4K2R w K - 0 1']) {
    const { game } = setup('w', fen); assert.equal(Boolean(game.legal(game.parse('!E1G1'))), false);
  }
  const { game, play } = setup('w', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  ['!E1E2','!E8E7','!E2E1','!E7E8'].forEach(play);
  assert.equal(Boolean(game.legal(game.parse('!E1G1'))), false);
});

test('Взятие на проходе в партии; право исчезает после промежуточного хода', () => {
  const { game, play } = setup('b'); ['!E2E4','!A7A6','!E4E5','!D7D5','!E5D6'].forEach(play);
  assert.equal(game.chess.get('d5'), undefined); assert.equal(game.chess.get('d6').color, 'w');
  const second = setup(); ['!E2E4','!A7A6','!E4E5','!D7D5','!G1F3','!A6A5'].forEach(second.play);
  assert.equal(Boolean(second.game.legal(second.game.parse('!E5D6'))), false);
});

test('Все четыре превращения через ход стримера и через голосование', () => {
  for (const side of ['w', 'b']) for (const type of ['q','r','b','n']) {
    const { game, play } = setup(side, '7k/P7/8/8/8/8/8/7K w - - 0 1');
    play('!A7A8' + type); assert.equal(game.chess.get('a8').type, type);
  }
});

test('Пат, недостаток материала и правило 50 ходов завершают GameSession', () => {
  for (const side of ['w', 'b']) for (const [fen, move, result] of [
    ['7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', '!F7E6', /пат/],
    ['7k/8/8/8/8/8/1b6/K7 w - - 0 1', '!A1B2', /недостаточно материала/],
    ['4k3/8/8/8/8/8/8/R3K3 w - - 99 50', '!A1A2', /50 ходов/]
  ]) { const { game, play } = setup(side, fen); play(move); assert.equal(game.active, false); assert.match(game.result, result); }
});

test('Троекратное повторение через реальные входы обеих команд', () => {
  const { game, play } = setup('b'); ['!G1F3','!G8F6','!F3G1','!F6G8','!G1F3','!G8F6','!F3G1','!F6G8'].forEach(play);
  assert.equal(game.active, false); assert.match(game.result, /троекратное/);
});

test('Генератор стартовой позиции: perft(3) = 8902', () => {
  const chess = new Chess();
  function perft(depth) { if (!depth) return 1; let total = 0; for (const move of chess.moves({verbose:true})) { chess.move(move); total += perft(depth - 1); chess.undo(); } return total; }
  assert.equal(perft(3), 8902);
});

test('20 детерминированных быстрых партий: сравнение состояния после каждого хода', () => {
  let random = 0x214365;
  function next(n) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % n; }
  let movesPlayed = 0, finished = 0;
  for (let n = 0; n < 20; n++) {
    const { game, play } = setup(n % 2 ? 'w' : 'b'), reference = new Chess();
    for (let ply = 0; ply < 250 && game.active; ply++) {
      const moves = reference.moves({verbose:true}), move = moves[next(moves.length)];
      const command = '!' + move.from + move.to + (move.promotion || '');
      play(command); reference.move(move); movesPlayed++;
      assert.equal(game.chess.fen(), reference.fen()); assert.equal(game.chess.isCheck(), reference.isCheck());
      assert.equal(game.active, !reference.isGameOver()); assert.equal(game.votes.size, 0);
      if (game.active) assert.equal(game.remaining(), 60000);
    }
    if (!game.active) finished++;
  }
  console.log(JSON.stringify({fastGames:20,movesPlayed,naturalFinishes:finished,limitPerGame:250}));
  assert.ok(movesPlayed > 1000);
});
