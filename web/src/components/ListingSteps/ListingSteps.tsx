// 售卖流程进度：分析照片 → 核对版本与品相 → 生成文案。只展示，各步状态由调用方根据草稿算出。
// 当前步 = 第一个未完成的步骤；已完成用对勾 + 文字「已完成」区分，不只靠颜色。
import './ListingSteps.css';

export interface ListingStep {label: string; done: boolean}

export function ListingSteps({steps}: {steps: ListingStep[]}) {
  const current = steps.findIndex(s => !s.done);
  return <ol className="listing-steps" aria-label="售卖准备进度">
    {steps.map((s, i) => <li key={s.label} className={s.done ? 'is-done' : i === current ? 'is-current' : ''}
                             aria-current={i === current ? 'step' : undefined}>
      <span className="listing-step-dot" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
      <span>{s.label}<small>{s.done ? '已完成' : i === current ? '进行中' : '待办'}</small></span>
    </li>)}
  </ol>;
}
