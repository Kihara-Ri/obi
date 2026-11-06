// Public quote handoff between local Workers. ACK means current-session SQLite
// acceptance; this disposable cache may be refetched after a browser restart.
globalThis.ObiRateSync = Object.freeze({
  create({role, session, channel, adopt, timeout = 15000}) {
    let sequence = 0;
    const pending = new Map();
    return {
      async transfer(reply) {
        if (role !== 'net' || reply.status !== 200) return;
        const parsed = JSON.parse(new TextDecoder().decode(reply.body));
        const quotes = (parsed.quotes || [parsed]).filter(q => typeof q.checkedAt === 'number' || ['exact', 'previous'].includes(q.status));
        if (!quotes.length) return;
        const id = `${session}:${++sequence}`;
        const canonical = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {pending.delete(id); reject(new Error('报价同步超时，请重试'));}, timeout);
          pending.set(id, {resolve, reject, timer});
          channel.postMessage({t: 'rate-cache', session, id, quotes});
        });
        if (canonical) {
          if (parsed.quotes) parsed.quotes = canonical;
          else Object.assign(parsed, canonical[0]);
          reply.body = new TextEncoder().encode(JSON.stringify(parsed));
        }
      },
      handle(message) {
        if (message.session !== session) return false;
        if (role === 'main' && message.t === 'rate-cache') {
          let error = '', quotes;
          try {quotes = adopt(message.quotes);} catch {error = '报价同步失败，请重试';}
          channel.postMessage({t: 'rate-cache-ack', session, id: message.id, error, quotes});
          return true;
        }
        if (role === 'net' && message.t === 'rate-cache-ack') {
          const request = pending.get(message.id);
          if (request) {
            clearTimeout(request.timer); pending.delete(message.id);
            if (message.error) request.reject(new Error(message.error)); else request.resolve(message.quotes);
          }
          return true;
        }
        return false;
      },
    };
  },
});
