// 安卓壳注入（document start，只对应用自身的源）：WebView 没有 Web Share，
// 把 navigator.share({files}) 转成原生保存——图片进相册 Pictures/Obi，其余进 下载/Obi。
// 页面代码（core/download.ts、PhotoDownload）不用为安卓分支。
(() => {
  const native = window.ObiAndroid;
  if (!native || navigator.__obiAndroid) return;
  Object.defineProperty(navigator, '__obiAndroid', {value: true});
  let savedTo = ''; // 最近一次保存的位置，页面提示里显示（见 core/download.ts savedPlace）
  Object.defineProperty(navigator, '__obiSavedTo', {get: () => savedTo});
  const CHUNK = 3 * 256 * 1024; // 3 的倍数：每块单独 base64 编码不产生填充
  const save = async file => {
    const id = native.begin(file.name || 'Obi', file.type || 'application/octet-stream');
    if (!id) throw new DOMException('无法在手机上创建文件', 'DataError');
    let ok = true;
    try {
      for (let offset = 0; offset < file.size && ok; offset += CHUNK) {
        const bytes = new Uint8Array(await file.slice(offset, offset + CHUNK).arrayBuffer());
        let text = '';
        for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        ok = native.chunk(id, btoa(text));
      }
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      if (!native.finish(id, ok) && ok) ok = false;
    }
    if (!ok) throw new DOMException('保存文件失败', 'DataError');
  };
  const canShare = data => !!data && (Array.isArray(data.files) ? data.files.length > 0 : !!(data.text || data.url));
  const share = async data => {
    if (!canShare(data)) throw new TypeError('没有可分享的内容');
    if (data.files?.length) {
      savedTo = '';
      try { for (const file of data.files) await save(file); } finally { savedTo = native.report() || ''; }
      return;
    }
    native.shareText(data.title || '', [data.text, data.url].filter(Boolean).join('\n'));
  };
  Object.defineProperty(navigator, 'canShare', {value: canShare, configurable: true});
  Object.defineProperty(navigator, 'share', {value: share, configurable: true});
})();
