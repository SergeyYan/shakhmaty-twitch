class TwitchChat {
  constructor(onMessage, onStatus) { this.onMessage = onMessage; this.onStatus = onStatus; this.socket = null; this.ready = false; this.generation = 0; }
  connect(channel) {
    this.disconnect(); const generation = this.generation;
    this.channel = channel.trim().replace(/^#/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(this.channel)) { this.onStatus(false, 'Введи логин канала: латиница, цифры, подчёркивание.'); return; }
    this.onStatus(false, 'Подключаемся к #' + this.channel + '…');
    const socket = this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    const timeout = setTimeout(() => { if (!this.ready && generation === this.generation) { socket.close(); this.onStatus(false, 'Канал не подтвердил подключение. Проверь имя и попробуй ещё раз.'); } }, 15000);
    socket.onopen = () => { socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n'); socket.send('NICK justinfan' + Math.floor(Math.random() * 900000 + 100000) + '\r\n'); socket.send('JOIN #' + this.channel + '\r\n'); };
    socket.onmessage = event => {
      if (generation !== this.generation) return;
      for (const line of event.data.split('\r\n')) {
        if (line.startsWith('PING')) { socket.send(line.replace(/^PING/, 'PONG') + '\r\n'); continue; }
        if (line.includes(' RECONNECT')) { socket.close(); continue; }
        if (line.includes(' ROOMSTATE #' + this.channel) || line.includes(' 366 ') && line.includes('#' + this.channel + ' ')) { clearTimeout(timeout); this.ready = true; this.onStatus(true, 'Подключено к #' + this.channel); }
        if (line.includes(' NOTICE ')) { const message = line.slice(line.indexOf(' :') + 2); this.onStatus(this.ready, message); }
        const m = line.match(/^(?:@([^ ]+) )?:([^! ]+)![^ ]+ PRIVMSG #([^ ]+) :(.*)$/);
        if (m && m[3].toLowerCase() === this.channel) { const tags = Object.fromEntries((m[1] || '').split(';').map(tag => { const i = tag.indexOf('='); return [tag.slice(0, i), tag.slice(i + 1)]; })); this.onMessage(tags['user-id'] || m[2], tags['display-name'] || m[2], m[4]); }
      }
    };
    socket.onerror = () => { if (generation === this.generation) this.onStatus(false, 'Ошибка сети Twitch. Проверь подключение и повтори попытку.'); };
    socket.onclose = () => { clearTimeout(timeout); if (generation === this.generation) { this.ready = false; this.onStatus(false, 'Соединение закрыто. Подключись повторно.'); } };
  }
  disconnect() { this.generation++; this.ready = false; if (this.socket) this.socket.close(); this.socket = null; }
}
