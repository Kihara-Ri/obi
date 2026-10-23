// 沉浸展示的界面内诊断（只在安卓壳里、且有一步没成功时出现）：逐步列出执行到哪一步、
// 安装包 / 网页版本与机型，用户截图即可反馈；不依赖系统 Toast。「知道了」只关本次。
import {useContext, useState} from 'react';
import {AppContext} from '../../state/AppContext';
import {diagnoseImmersive} from '../../core/android-immersive';
import type {ImmersiveProbe} from '../../hooks/useImmersive';
import './ImmersiveDiag.css';

export function ImmersiveDiag({probe}: {probe: ImmersiveProbe}) {
  const version = useContext(AppContext)?.state.service?.version || 'dev';
  const [closed, setClosed] = useState<ImmersiveProbe | null>(null);
  const diag = diagnoseImmersive(probe.call, probe.report, version);
  if (diag.ok || closed === probe) return null;
  return <section className="immersive-diag" role="alert" aria-label="沉浸展示诊断">
    <h3>系统栏没有隐藏</h3>
    <ol>
      {diag.steps.map(step => <li key={step.label} className={step.ok ? 'is-ok' : 'is-fail'}>
        <span aria-hidden="true">{step.ok ? '✓' : '✗'}</span> {step.label}{step.detail ? <small>{step.detail}</small> : null}
      </li>)}
    </ol>
    <p className="immersive-diag-info">{diag.info}</p>
    <button type="button" className="link-button" onClick={() => setClosed(probe)}>知道了</button>
  </section>;
}
