// 抽屉内文字输入统一走聚焦输入层：手机上点抽屉里的输入框，原框不获得焦点（不弹键盘、页面不追键盘），
// 在键盘上方升起 FocusInput。输入实时写回原框（原生 value setter + input 事件，React 的 onChange 照常触发），
// 取消还原打开时的值；单行按键盘回车会把回车转发给原框（如「从网址」输入框回车即应用）。
// 不接管：只读 / 禁用、勾选 / 单选 / 文件 / 日期等非文字类型、已自带浮层的框、带 data-native-input 的框。
import {useEffect, useRef, useState} from 'react';
import type {ReactNode, RefObject} from 'react';
import {flushSync} from 'react-dom';
import {FocusInput} from './FocusInput';
import type {FocusInputProps} from './FocusInput';

type Field = HTMLInputElement | HTMLTextAreaElement;
const NON_TEXT = new Set(['checkbox', 'radio', 'file', 'date', 'time', 'datetime-local', 'month', 'week',
  'range', 'color', 'hidden', 'button', 'submit', 'reset', 'image']);
const TAP_SLOP = 10;

function floatable(t: EventTarget | null, root: HTMLElement): t is Field {
  if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) || !root.contains(t)) return false;
  if (t.readOnly || t.disabled || t.closest('[data-native-input]')) return false;
  return t instanceof HTMLTextAreaElement || !NON_TEXT.has(t.type);
}

// 字段名：label[for] → 包裹的 label（去掉输入框自身文字）→ aria-label → placeholder
function titleOf(el: Field) {
  const own = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  const wrap = own ?? el.closest('label');
  const text = wrap ? [...wrap.childNodes].filter(n => !n.contains(el) && n.nodeName !== 'TEXTAREA' && n.nodeName !== 'INPUT')
    .map(n => n.textContent ?? '').join('').trim() : '';
  return text || el.getAttribute('aria-label') || el.placeholder || '输入';
}

function writeBack(el: Field, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
  el.dispatchEvent(new Event('input', {bubbles: true}));
}

function propsOf(el: Field): Omit<FocusInputProps, 'open' | 'value' | 'submitLabel' | 'onChange' | 'onSubmit' | 'onEnter' | 'onClose'> {
  const multiline = el instanceof HTMLTextAreaElement;
  const t = multiline ? 'text' : el.type;
  const type = (['password', 'url', 'email', 'tel', 'search'] as const).find(x => x === t);
  const mode = el.getAttribute('inputmode') as FocusInputProps['inputMode'] | null;
  return {
    title: titleOf(el), placeholder: el.placeholder || undefined, multiline,
    maxLength: el.maxLength > 0 ? el.maxLength : undefined, type,
    inputMode: mode ?? (t === 'number' ? 'decimal' : undefined),
    enterKeyHint: (el.getAttribute('enterkeyhint') as FocusInputProps['enterKeyHint'] | null) ?? 'done',
  };
}

/** 只在 media 查询命中时接管（手机 sheet），每次点按实时判断，横竖屏 / 窗口宽度变化随即生效。返回要渲染的浮层节点。 */
export function useFloatingFields(rootRef: RefObject<HTMLElement | null>, media: string): ReactNode {
  const [target, setTarget] = useState<{el: Field; value: string; original: string} | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mq = window.matchMedia(media);
    const take = (t: EventTarget | null): t is Field => mq.matches && floatable(t, root);
    // 在点按手势内同步打开并聚焦浮层输入框，iOS 才会弹出键盘
    const open = (el: Field) => {
      if (targetRef.current) return;
      flushSync(() => setTarget({el, value: el.value, original: el.value}));
    };
    let start: {x: number; y: number; el: Field} | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && take(e.target) ? {x: t.clientX, y: t.clientY, el: e.target} : null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > TAP_SLOP) start = null;
    };
    // 轻点：拦掉原框的聚焦（连带合成的 click），直接升起浮层；滑动不拦，放行滚动
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || !e.cancelable || e.target !== s.el) return;
      e.preventDefault();
      open(s.el);
    };
    // 鼠标 / 触控笔点按：同样不让原框聚焦（聚焦会先把它滚进视野，内容区跟着跳）
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !take(e.target)) return;
      e.preventDefault();
      open(e.target);
    };
    // 兜底：点 label、外接键盘 Tab、程序聚焦等途径让原框拿到焦点时，同样转交给浮层
    const onFocusIn = (e: FocusEvent) => {
      if (!take(e.target)) return;
      e.target.blur();
      open(e.target);
    };
    root.addEventListener('touchstart', onStart, {passive: true, capture: true});
    root.addEventListener('touchmove', onMove, {passive: true, capture: true});
    root.addEventListener('touchend', onEnd, {passive: false, capture: true});
    root.addEventListener('mousedown', onMouseDown, true);
    root.addEventListener('focusin', onFocusIn, true);
    return () => {
      root.removeEventListener('mousedown', onMouseDown, true);
      root.removeEventListener('touchstart', onStart, true);
      root.removeEventListener('touchmove', onMove, true);
      root.removeEventListener('touchend', onEnd, true);
      root.removeEventListener('focusin', onFocusIn, true);
    };
  }, [rootRef, media]);

  // 原框被卸载（换页、关抽屉）时收起浮层
  useEffect(() => {
    if (target && !target.el.isConnected) setTarget(null);
  });

  if (!target) return null;
  const {el} = target;
  const change = (v: string) => { setTarget({...target, value: v}); writeBack(el, v); };
  const done = () => setTarget(null);
  const cancel = () => { if (el.value !== target.original) writeBack(el, target.original); setTarget(null); };
  const enter = () => {
    setTarget(null);
    el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true, cancelable: true}));
  };
  return <FocusInput open {...propsOf(el)} value={target.value} submitLabel="完成"
                     onChange={change} onSubmit={done} onEnter={enter} onClose={cancel}/>;
}
