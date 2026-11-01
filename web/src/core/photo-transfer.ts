// 两张并发的幂等照片暂存队列：只重试照片上传，不重试账本写入。
import {apiUpload, ApiError} from './api';

type Transport = (token: string, body: Blob, signal: AbortSignal) => Promise<{ref: string}>;
const cancelled = () => new DOMException('已取消照片上传', 'AbortError');

export class PhotoTransferQueue {
  private lanes: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()];
  private next = 0;
  private disposed = false;
  private controllers = new Set<AbortController>();

  constructor(private send: Transport = (token, body, signal) =>
    apiUpload('photos/stage?token=' + token, body, 'application/octet-stream', {signal}),
    private pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {}

  add(data: string, identity: string): Promise<string> {
    const token = identity.replaceAll('-', '');
    const lane = this.next++ % this.lanes.length;
    const result = this.lanes[lane].then(async () => {
      if (this.disposed) throw cancelled();
      const comma = data.indexOf(',');
      const bytes = Uint8Array.from(atob(data.slice(comma + 1)), c => c.charCodeAt(0));
      const blob = new Blob([bytes], {type: 'application/octet-stream'});
      for (let attempt = 0; attempt < 2; attempt++) {
        if (this.disposed) throw cancelled();
        const controller = new AbortController();
        this.controllers.add(controller);
        const timer = setTimeout(() => controller.abort(), 120000);
        try {
          const response = await this.send(token, blob, controller.signal);
          if (response.ref !== token) throw new ApiError('照片上传校验失败，请重新添加照片', 400);
          return response.ref;
        } catch (error) {
          if (this.disposed) throw cancelled();
          if (error instanceof ApiError && error.status && error.status < 500
              && ![408, 429].includes(error.status)) throw error;
          if (attempt) throw new Error('照片上传未完成，请点“重试上传”；照片仍保留');
          await this.pause(800);
        } finally {
          clearTimeout(timer);
          this.controllers.delete(controller);
        }
      }
      throw new Error('照片上传未完成，请重试');
    });
    this.lanes[lane] = result.catch(() => undefined);
    return result;
  }

  dispose() {
    this.disposed = true;
    this.controllers.forEach(controller => controller.abort());
  }
}
