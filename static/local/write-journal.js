// D-041：内存回执防止落盘失败重试重复执行业务；未知回执绝不自动重放。
globalThis.ObiWriteJournal = class {
  constructor(run, persist) {
    this.run = run; this.persist = persist;
    this.receipts = new Map(); this.pending = null;
  }
  error(status, error) {
    return {status, headers: {'Content-Type': 'application/json'},
      body: new TextEncoder().encode(JSON.stringify({error}))};
  }
  async execute(m) {
    if (m.method === 'GET') return this.run(m);
    const headers = new Headers(m.headers);
    const id = headers.get('X-Obi-Operation');
    const retry = headers.get('X-Obi-Retry') === '1';
    const raw = new Uint8Array(m.body || new ArrayBuffer(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)),
      b => b.toString(16).padStart(2, '0')).join('');
    const same = (r) => r.target === m.target && r.method === m.method &&
      r.type === headers.get('Content-Type') && r.digest === digest;
    let receipt = id && this.receipts.get(id);
    if (receipt && !same(receipt)) return this.error(409, '重试内容已改变，请核对账本后再操作');
    if (!receipt && retry) return this.error(409, '上次保存结果无法确认，请核对账本后关闭此标签页，再打开应用操作');
    if (this.pending && this.pending !== receipt) {
      const reply = this.error(507, '上次保存尚未写入磁盘，请保留页面并重试原操作');
      reply.headers['X-Obi-Operation-Complete'] = '1'; // this command did not execute
      return reply;
    }
    if (!receipt) {
      receipt = {target: m.target, method: m.method, type: headers.get('Content-Type'), digest,
        reply: this.run(m), durable: false};
      if (id) this.receipts.set(id, receipt);
      this.pending = receipt;
    }
    if (!receipt.durable) {
      try { await this.persist(); }
      catch { return this.error(507, '保存尚未写入磁盘，请保留页面、腾出空间后重试原操作'); }
      receipt.durable = true;
      this.pending = null;
    }
    // Bounded replay window; evicted/unknown retries fail closed, never execute twice.
    while (this.receipts.size > 32) this.receipts.delete(this.receipts.keys().next().value);
    return {...receipt.reply, headers: {...receipt.reply.headers, 'X-Obi-Operation-Complete': '1'}};
  }
};
