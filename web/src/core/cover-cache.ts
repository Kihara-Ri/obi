// 封面本地缓存（Service Worker 写入 album-covers）：退出登录时整体清空，避免在他人设备上留下库存图片。

export const COVER_CACHE_NAME = 'album-covers';

export async function clearCoverCache(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete(COVER_CACHE_NAME);
  } catch { /* 清理失败不阻断退出；缓存仅含封面图片 */ }
}
