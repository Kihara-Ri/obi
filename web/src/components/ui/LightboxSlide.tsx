// 灯箱里的一张照片（2026-11-20）：整张读完才显示，读取中显示转圈。
// 手机上偶尔只露出上半截：缩略图还在下载就点开，灯箱共用同一地址，传输中断/卡住时
// 浏览器把已收到的半张画出来就停了（iOS 合成层也可能不再重绘补齐）。改为加载完成才显示
// （显现动画由 core/image-reveal 统一播放）；
// 出错或 12 秒仍未读完，换一个地址重读一次（服务端忽略多出的查询参数）。
import {useEffect, useState} from 'react';
import {SpinIco} from '../icons';
import {retrySrc} from './photoSave';
import './LightboxSlide.css';

const STALL_MS = 12000;

export function LightboxSlide({src, index, offset}: {src: string; index: number; offset: number}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const shown = retrySrc(src, attempt);
  useEffect(() => {
    if (state !== 'loading' || attempt) return;
    const timer = window.setTimeout(() => setAttempt(1), STALL_MS);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);
  const retry = () => { if (attempt) setState('failed'); else setAttempt(1); };
  return (
    <div className="lb-slide" style={{transform: `translateX(${offset * 100}%)`}}>
      <img key={shown} src={shown} data-src={src} alt={`实物照片 ${index + 1}`} draggable={false}
           className={state === 'ready' ? undefined : 'lb-pending'}
           ref={el => { if (el?.complete && el.naturalWidth && state !== 'ready') setState('ready'); }}
           onLoad={() => setState('ready')} onError={retry}/>
      {state === 'loading' ? <span className="lb-wait" role="status" aria-label="照片读取中">{SpinIco}</span> : null}
      {state === 'failed' ? <span className="lb-wait" role="alert">照片读取失败</span> : null}
    </div>
  );
}
