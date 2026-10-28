// 系统剪贴板只放一张图片；保持像素尺寸，兼容转换为 PNG，不裁切、不美化。
export function canCopyPhoto(): boolean {
  return window.isSecureContext && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

async function pngBlob(source: Blob | Promise<Blob>): Promise<Blob> {
  const file = await source;
  if (file.type === 'image/png') return file;
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('图片转换失败，请保存图片');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob); else reject(new Error('图片转换失败，请保存图片'));
    }, 'image/png'));
  } finally {image.close();}
}

export async function copyPhoto(file: Blob | Promise<Blob>): Promise<void> {
  if (!canCopyPhoto()) throw new Error('当前环境不支持复制图片，请保存图片');
  // write 必须在点击手势内调用，PNG 转换放进 ClipboardItem 的 Promise，保留 Safari 用户激活。
  const image = pngBlob(file);
  void image.catch(() => undefined); // 权限先被拒绝时，图片解码失败也不产生游离拒绝。
  return navigator.clipboard.write([new ClipboardItem({'image/png': image})]);
}
