(() => {
  const $ = id => document.getElementById(id);
  const game = new GameSession();
  const names = { k: 'король', q: 'ферзь', r: 'ладья', b: 'слон', n: 'конь', p: 'пешка' };
  let selected = null, flipped = false, demo = false, connected = false, pendingPromotion = null;
  const speech = new Map();
  const twitch = new TwitchChat(receive, (ready, text) => { connected = ready; $('connection-status').textContent = text; $('connection-dot').classList.toggle('online', ready); $('start').disabled = game.active || !(ready || demo); $('connect').textContent = ready ? 'Переподключить' : 'Подключить'; render(); });
  function board() {
    const files = flipped ? 'hgfedcba' : 'abcdefgh'; const ranks = flipped ? '12345678' : '87654321';
    const legal = selected && game.active ? game.chess.moves({ square: selected, verbose: true }).map(m => m.to) : [];
    $('board').replaceChildren();
    for (const [row, rank] of [...ranks].entries()) for (const [col, file] of [...files].entries()) {
      const square = file + rank, piece = game.chess.get(square), cell = document.createElement('button');
      cell.type = 'button'; cell.dataset.square = square;
      cell.className = 'square ' + ((file.charCodeAt(0) + Number(rank)) % 2 ? 'light' : 'dark');
      cell.setAttribute('aria-label', square + (piece ? ': ' + (piece.color === 'w' ? 'белые, ' : 'чёрные, ') + names[piece.type] : ': пусто'));
      if (piece) cell.append(pieceArt(piece.type, piece.color));
      if (col === 0) { const el = document.createElement('span'); el.className = 'coordinate rank'; el.textContent = rank; cell.append(el); }
      if (row === 7) { const el = document.createElement('span'); el.className = 'coordinate file'; el.textContent = file; cell.append(el); }
      if (selected === square) cell.classList.add('selected');
      if (legal.includes(square)) cell.classList.add('legal');
      if (game.lastMove && [game.lastMove.from, game.lastMove.to].includes(square)) cell.classList.add('last');
      if (piece?.type === 'k' && piece.color === game.chess.turn() && game.chess.isCheck()) cell.classList.add('check');
      const bubble = speech.get(square);
      if (bubble && bubble.until > Date.now() && piece && $('bubbles').checked) { const el = document.createElement('span'); el.className = 'bubble'; el.textContent = bubble.text; cell.append(el); }
      cell.onclick = () => clickSquare(square); $('board').append(cell);
    }
  }
  function render() {
    board(); const turn = game.chess.turn(), streamerTurn = turn === game.streamer;
    $('turn-title').textContent = game.result ? 'Партия завершена' : game.active ? (streamerTurn ? 'Ход стримера' : 'Чат выбирает ход') : 'Всё готово к игре';
    $('game-status').textContent = game.result || (game.active ? (game.chess.isCheck() ? 'Шах! ' : '') + (streamerTurn ? 'Выбери фигуру и клетку назначения.' : 'Голосуй в чате: !E7E5. Итог — по таймеру.') : demo ? 'Пробный режим. Нажми «Начать партию».' : connected ? 'Чат подключён. Можно начинать партию.' : 'Подключи чат или включи пробный режим.');
    const topColor = flipped ? 'w' : 'b', topStreamer = topColor === game.streamer;
    $('top-name').textContent = topStreamer ? 'Стример' : 'Twitch-чат'; $('bottom-name').textContent = topStreamer ? 'Twitch-чат' : 'Стример';
    const label = color => color === 'w' ? 'Белые фигуры' : 'Чёрные фигуры';
    $('top-color').textContent = label(topColor); $('bottom-color').textContent = label(topColor === 'w' ? 'b' : 'w');
    const topActive = game.active && turn === topColor;
    for (const [id, active] of [['top-badge', topActive], ['bottom-badge', game.active && !topActive]]) { $(id).classList.toggle('active', active); $(id).textContent = active ? 'ДЕЛАЕТ ХОД' : game.result ? 'ФИНИШ' : 'ОЖИДАНИЕ'; }
    $('votes').replaceChildren(); const tally = game.tally();
    if (!tally.length) { const el = document.createElement('span'); el.className = 'subtle'; el.textContent = 'Пока нет голосов за ход'; $('votes').append(el); }
    for (const item of tally) { const el = document.createElement('div'); el.className = 'vote-row'; const move = document.createElement('strong'); move.textContent = '!' + item.key.toUpperCase(); const count = document.createElement('span'); count.textContent = item.count + ' гол.'; el.append(move, count); $('votes').append(el); }
    const history = game.chess.history(); $('history').textContent = history.length ? history.map((m, i) => (i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : '') + m).join('  ') : 'Первый ход ещё впереди.';
    $('side').disabled = game.active; $('resign').disabled = !game.active; $('start').disabled = game.active || !(connected || demo); $('demo').disabled = game.active; updateClock();
  }
  function updateClock() { const sec = game.active ? Math.ceil(game.remaining() / 1000) : game.result ? 0 : 60; $('clock').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); $('clock').classList.toggle('urgent', game.active && sec <= 10); $('timer-bar').style.width = sec / 60 * 100 + '%'; }
  function clickSquare(square) {
    if (game.tick()) { selected = null; render(); return; }
    if (!game.active || game.chess.turn() !== game.streamer || pendingPromotion) return;
    const piece = game.chess.get(square);
    if (piece?.color === game.streamer) { selected = selected === square ? null : square; board(); return; }
    if (!selected) return;
    const options = game.chess.moves({ square: selected, verbose: true }).filter(m => m.to === square);
    if (!options.length) { selected = null; board(); return; }
    if (options[0].promotion) {
      pendingPromotion = { from: selected, to: square }; $('promotion-options').replaceChildren();
      for (const type of ['q', 'r', 'b', 'n']) { const button = document.createElement('button'); button.append(pieceArt(type, game.streamer)); button.setAttribute('aria-label', names[type]); button.onclick = () => { game.streamerMove({ ...pendingPromotion, promotion: type }); closePromotion(); selected = null; speech.clear(); render(); }; $('promotion-options').append(button); }
      $('promotion').showModal();
    } else { game.streamerMove({ from: selected, to: square, promotion: 'q' }); selected = null; speech.clear(); render(); }
  }
  function closePromotion() { pendingPromotion = null; $('promotion').close(); }
  function receive(user, display, text) {
    if (game.tick()) { speech.clear(); selected = null; }
    text = text.slice(0, 300); const vote = game.vote(user, text);
    const addressed = text.match(/^@([a-h][1-8])\s+(.+)/i);
    let square = vote.square || addressed?.[1].toLowerCase();
    const pieces = game.chess.board().flat().filter(p => p && p.color === game.chatColor);
    if (!square && pieces.length) square = pieces[Math.floor(Math.random() * pieces.length)].square;
    if (square && game.chess.get(square)?.color === game.chatColor) { speech.delete(square); speech.set(square, { text: display.slice(0, 25) + ': ' + (addressed ? addressed[2] : text).slice(0, 85), until: Date.now() + 5500 }); while (speech.size > 3) speech.delete(speech.keys().next().value); }
    if ($('chat-log').querySelector('.empty-chat')) $('chat-log').replaceChildren();
    const line = document.createElement('div'); line.className = 'chat-line'; const name = document.createElement('strong'); name.textContent = display; const message = document.createElement('span'); message.textContent = text; line.append(name, message);
    if (game.parse(text)) { const status = document.createElement('small'); status.textContent = vote.message; line.append(status); }
    $('chat-log').append(line); while ($('chat-log').children.length > 60) $('chat-log').firstChild.remove(); $('chat-log').scrollTop = $('chat-log').scrollHeight; render();
  }
  $('connect-form').onsubmit = e => { e.preventDefault(); if (demo && game.active) return; if (demo) { demo = false; $('demo-form').hidden = true; } twitch.connect($('channel').value); };
  $('demo').onclick = () => { twitch.disconnect(); connected = false; demo = true; $('connection-dot').classList.remove('online'); $('connection-status').textContent = 'Пробный режим: сообщения вводятся ниже.'; $('demo-form').hidden = false; render(); };
  $('demo-form').onsubmit = e => { e.preventDefault(); const text = $('demo-message').value.trim(); if (text) receive('demo:' + ($('demo-user').value.trim() || 'Зритель1').toLowerCase(), $('demo-user').value.trim() || 'Зритель1', text); $('demo-message').value = ''; };
  $('start').onclick = () => { if (game.active || !(connected || demo)) return; closePromotion(); game.start($('side').value); flipped = game.streamer === 'b'; selected = null; speech.clear(); render(); };
  $('new-game').onclick = () => { if (game.active && !confirm('Завершить текущую партию и подготовить новую?')) return; closePromotion(); game.reset($('side').value); selected = null; speech.clear(); render(); };
  $('resign').onclick = () => { if (!game.active || !confirm('Сдаться? Победит Twitch-чат.')) return; game.finish('Стример сдался. Победил Twitch-чат!'); closePromotion(); render(); };
  $('flip').onclick = () => { flipped = !flipped; board(); render(); };
  $('side').onchange = () => { game.reset($('side').value); flipped = game.streamer === 'b'; selected = null; speech.clear(); render(); };
  $('bubbles').onchange = board; $('cancel-promotion').onclick = closePromotion; $('promotion').oncancel = () => { pendingPromotion = null; };
  $('export').onclick = () => { const url = URL.createObjectURL(new Blob([game.chess.pgn()], { type: 'application/x-chess-pgn' })); const a = document.createElement('a'); a.href = url; a.download = 'streamer-vs-chat.pgn'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  setInterval(() => { if (game.tick()) { closePromotion(); selected = null; speech.clear(); render(); } updateClock(); let expired = false; for (const [square, item] of speech) if (item.until <= Date.now()) { speech.delete(square); expired = true; } if (expired) board(); }, 200);
  render();
})();
