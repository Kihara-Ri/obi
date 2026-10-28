// 剪贴板：复制文本（copyText）与读取纯文本（readClipboardText，OpenCode 网页登录回填密钥）。

// 复制文本：优先异步剪贴板（需要 HTTPS / 用户手势），不可用时退回隐藏 textarea + execCommand。
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 无权限或非安全上下文：走兜底 */ }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

// 读剪贴板纯文本：安卓壳走原生 ObiAndroid.clipboardText()（WebView 不授予 clipboard-read），其余用 navigator.clipboard。
// 只在用户显式操作后调用（网页登录回来、点「粘贴」）；读不到或被拒返回空串，不抛错。
export async function readClipboardText(): Promise<string> {
  const bridge = (window as unknown as {ObiAndroid?: {clipboardText?: () => string}}).ObiAndroid;
  try {
    if (typeof bridge?.clipboardText === 'function') return bridge.clipboardText() || '';
    return await navigator.clipboard?.readText?.() || '';
  } catch {
    return '';
  }
}

// 像一把 API 密钥：单行、无空白、长度合理。只决定要不要回填输入框，不做格式承诺，保存前由用户确认。
export const looksLikeKey = (text: string) => /^[\w.\-:]{20,300}$/.test(text.trim());
