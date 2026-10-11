// Server-Sent Events hub. Clients subscribe to channels that the server has already authorised:
//   branch:<id>   staff of that branch (orders, tables, service requests, payments)
//   session:<id>  customer devices authorised for that dining session
//   menu:<id>     anyone viewing the branch menu (menu/stock/pause changes; no private data)
//   join:<id>     a single pending join request (approval result)
export function createHub() {
  const channels = new Map(); // channel -> Set<client>
  let nextId = 1;

  function subscribe(res, chans, { onClose } = {}) {
    const client = { id: nextId++, res, chans: new Set(chans) };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    res.write(`event: hello\ndata: ${JSON.stringify({ channels: [...client.chans] })}\n\n`);
    for (const c of client.chans) {
      if (!channels.has(c)) channels.set(c, new Set());
      channels.get(c).add(client);
    }
    const ping = setInterval(() => { try { res.write(`: ping\n\n`); } catch { /* closed */ } }, 25000);
    const cleanup = () => {
      clearInterval(ping);
      for (const c of client.chans) {
        const set = channels.get(c);
        if (set) { set.delete(client); if (!set.size) channels.delete(c); }
      }
      onClose?.();
    };
    res.on('close', cleanup);
    return client;
  }

  function publish(channel, event, data = {}) {
    const set = channels.get(channel);
    if (!set) return 0;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of set) {
      try { client.res.write(payload); } catch { /* ignore */ }
    }
    return set.size;
  }

  // Forcefully end every stream subscribed to a channel (used when a dining session closes so
  // customer phones from that session immediately lose their live view).
  function terminate(channel, event = 'ended', data = {}) {
    const set = channels.get(channel);
    if (!set) return;
    for (const client of [...set]) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        client.res.end();
      } catch { /* ignore */ }
    }
  }

  const count = (channel) => channels.get(channel)?.size || 0;
  return { subscribe, publish, terminate, count };
}
