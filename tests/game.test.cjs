const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
for (const file of ['vendor/chess.js', 'game-session.js']) vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8'));
function session(side = 'w') { let time = 1000; const g = new GameSession(() => time); g.start(side); return { g, advance: n => { time += n; } }; }
test('Команды !E2E4 без учёта регистра; незаконное !E4E6 отклоняется', () => { const { g } = session('b'); assert.equal(g.vote('1', '!E2E4').ok, true); assert.equal(g.vote('2', '!E4E6').ok, false); assert.equal(g.vote('3', '!E2E5').ok, false); assert.equal(g.parse('привет !E2E4'), null); });
test('Один изменяемый голос на зрителя, победитель исполняется ровно через минуту', () => { const { g, advance } = session('b'); g.vote('Alice', '!E2E4'); g.vote('alice', '!D2D4'); g.vote('Bob', '!E2E4'); g.vote('Carol', '!E2E4'); assert.equal(g.votes.size, 3); assert.equal(g.tally()[0].count, 2); advance(59999); assert.equal(g.tick(), false); advance(1); assert.equal(g.tick(), true); assert.equal(g.chess.get('e4').type, 'p'); assert.equal(g.votes.size, 0); assert.equal(g.remaining(), 60000); });
test('Равенство голосов решается порядком первых текущих голосов', () => { const { g, advance } = session('b'); g.vote('a', '!D2D4'); g.vote('b', '!E2E4'); advance(60000); g.tick(); assert.equal(g.chess.get('d4').type, 'p'); });
test('Чат не ходит за стримера; стример не ходит за чат', () => { const { g } = session(); assert.equal(g.vote('a', '!E2E4').ok, false); assert.equal(g.streamerMove(g.parse('!E2E4')), true); assert.equal(g.streamerMove(g.parse('!E7E5')), false); assert.equal(g.vote('a', '!E7E5').ok, true); });
test('Просроченный ход стримера и отсутствие голосов завершают партию', () => { for (const side of ['w', 'b']) { const { g, advance } = session(side); advance(60000); g.tick(); assert.equal(g.active, false); assert.match(g.result, /Время истекло/); } const { g, advance } = session(); advance(60000); assert.equal(g.streamerMove(g.parse('!E2E4')), false); assert.equal(g.chess.history().length, 0); });
test('Голос после дедлайна не меняет результат голосования', () => { const { g, advance } = session('b'); g.vote('a', '!D2D4'); advance(60000); assert.equal(g.vote('b', '!E2E4').ok, false); assert.equal(g.chess.get('d4').type, 'p'); });
test('Рокировка, взятие на проходе, превращение и запрет оставлять короля под шахом', () => {
  const { g } = session(); g.chess.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); assert.ok(g.legal(g.parse('!E1G1'))); g.apply(g.parse('!E1G1')); assert.equal(g.chess.get('f1').type, 'r');
  g.chess.load('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2'); g.apply(g.parse('!E5D6')); assert.equal(g.chess.get('d5'), undefined);
  g.chess.load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'); assert.ok(g.legal(g.parse('!A7A8N'))); g.apply(g.parse('!A7A8N')); assert.equal(g.chess.get('a8').type, 'n');
  g.chess.load('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1'); assert.equal(Boolean(g.legal(g.parse('!E2D2'))), false);
});
test('Мат, пат, недостаток материала, 50 ходов, повторение позиции', () => {
  const { g } = session(); for (const move of ['f2f3','e7e5','g2g4','d8h4']) g.apply(g.parse(move)); assert.equal(g.active, false); assert.match(g.result, /Мат/);
  const s = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); assert.equal(s.isStalemate(), true);
  assert.equal(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1').isInsufficientMaterial(), true);
  assert.equal(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 51').isDraw(), true);
  const repeated = new Chess(); for (const m of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) repeated.move(m); assert.equal(repeated.isThreefoldRepetition(), true);
});
test('IRC: подтверждение канала, PING/PONG, сообщения, старый сокет игнорируется', () => {
  const sockets = []; class Socket { constructor(url) { this.url = url; this.sent = []; sockets.push(this); } send(s) { this.sent.push(s); } close() { this.onclose?.(); } }
  const events = []; const context = { WebSocket: Socket, setTimeout: () => 1, clearTimeout() {}, Math };
  vm.createContext(context); vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '..', 'twitch-chat.js'), 'utf8') + '\nglobalThis.TwitchChat = TwitchChat;', context);
  const t = new context.TwitchChat((...args) => events.push(args), () => {}); t.connect('Example'); sockets[0].onopen(); assert.ok(sockets[0].sent.some(x => x.includes('JOIN #example')));
  sockets[0].onmessage({ data: ':tmi.twitch.tv ROOMSTATE #example\r\nPING :tmi.twitch.tv\r\n@display-name=Alice;user-id=123 :alice!alice@alice.tmi.twitch.tv PRIVMSG #example :!E2E4\r\n' });
  assert.equal(t.ready, true); assert.deepEqual(events[0], ['123', 'Alice', '!E2E4']); assert.ok(sockets[0].sent.includes('PONG :tmi.twitch.tv\r\n'));
  t.connect('Other'); sockets[0].onmessage({ data: ':tmi.twitch.tv ROOMSTATE #example\r\n' }); assert.equal(t.ready, false); t.disconnect();
});
