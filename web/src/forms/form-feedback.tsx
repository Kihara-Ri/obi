// 抽屉表单的字段校验提示：定位首个错误，不聚焦输入框或触发手机键盘。
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import type {FormEvent, ReactNode} from 'react';
import {createPortal} from 'react-dom';
import './form-feedback.css';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Issue = {anchor: HTMLElement; control: HTMLElement; message: string; native: boolean; serial: number};

function validity(control: Control) {
  // 手机金额框为只读的输入层入口，浏览器会跳过只读字段的约束校验。
  if (!('readOnly' in control) || !control.readOnly) return control.validity;
  const candidate = control.cloneNode(true) as Control;
  candidate.value = control.value;
  if (candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) candidate.readOnly = false;
  if (candidate instanceof HTMLInputElement && control instanceof HTMLInputElement) candidate.checked = control.checked;
  return candidate.validity;
}

function messageFor(control: Control) {
  const state = validity(control);
  if (state.valueMissing) return control instanceof HTMLInputElement && control.type === 'checkbox' ? '请先勾选确认' : '请填写此项';
  if (state.rangeUnderflow) return `请输入不小于 ${control.getAttribute('min')} 的数值`;
  if (state.rangeOverflow) return `请输入不大于 ${control.getAttribute('max')} 的数值`;
  if (state.stepMismatch) return '请输入符合精度要求的数值';
  if (state.typeMismatch) return '请输入有效的内容';
  return '请检查此项的输入';
}

function reveal(anchor: HTMLElement) {
  const body = anchor.closest<HTMLElement>('.drawer-body');
  if (!body) return;
  const box = anchor.getBoundingClientRect();
  const area = body.getBoundingClientRect();
  const label = anchor.previousElementSibling;
  const top = label instanceof HTMLLabelElement ? Math.min(box.top, label.getBoundingClientRect().top) : box.top;
  const padding = parseFloat(getComputedStyle(body).paddingTop) || 0;
  const upper = area.top + padding, lower = area.bottom - padding;
  if (top < upper) body.scrollTop += top - upper;
  else if (box.bottom > lower) body.scrollTop += Math.min(top - upper, box.bottom - lower);
}

export function useFormFeedback() {
  const id = `form-error-${useId().replace(/:/g, '')}`;
  const [issue, setIssue] = useState<Issue>();
  // 只增不减：提交时先 clear 再 show 会被批处理，序号不能从上一个状态推导，否则重复失败不会重新播放抖动。
  const serial = useRef(0);
  const show = (control: HTMLElement, message: string, native = false) => {
    const anchor = control.closest<HTMLElement>('[data-error-anchor], .field, .row, .check-line') || control;
    setIssue({anchor, control, message, native, serial: ++serial.current});
  };
  const clear = () => setIssue(undefined);
  useLayoutEffect(() => {
    if (!issue) return;
    const {control, anchor} = issue;
    const oldDescription = control.getAttribute('aria-describedby');
    const oldInvalid = control.getAttribute('aria-invalid');
    control.setAttribute('aria-describedby', [oldDescription, id].filter(Boolean).join(' '));
    control.setAttribute('aria-invalid', 'true');
    anchor.classList.add('has-form-error');
    reveal(anchor);
    return () => {
      if (oldDescription === null) control.removeAttribute('aria-describedby'); else control.setAttribute('aria-describedby', oldDescription);
      if (oldInvalid === null) control.removeAttribute('aria-invalid'); else control.setAttribute('aria-invalid', oldInvalid);
      anchor.classList.remove('has-form-error');
    };
  }, [issue, id]);
  // 受控字段在 React 更新后才反映新值；包括手机输入层的回填。
  useLayoutEffect(() => {
    if (issue?.native && issue.control instanceof HTMLElement && issue.control.isConnected
        && validity(issue.control as Control).valid) clear();
  });
  const onSubmitCapture = (event: FormEvent<HTMLFormElement>) => {
    const controls = Array.from(event.currentTarget.elements).filter((el): el is Control =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)
      && !el.matches(':disabled') && el.type !== 'hidden' && (el.willValidate || ('readOnly' in el && el.readOnly)));
    const invalid = controls.find(control => !validity(control).valid);
    if (invalid) {event.preventDefault(); event.stopPropagation(); show(invalid, messageFor(invalid), true);}
    else clear();
  };
  const feedback: ReactNode = issue && issue.anchor.isConnected
    ? createPortal(<p id={id} key={issue.serial} className="error form-field-error" role="alert">{issue.message}</p>, issue.anchor)
    : null;
  return {show, clear, issue, feedback, onSubmitCapture};
}

/** 固定底栏内的非字段错误，保持可见直至重试；再点底栏按钮仍失败时轻抖一下。 */
export function FormMessage({error}: {error: string}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const footer = box.current?.parentElement;
    if (!footer) return;
    let frame = 0;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('button')) return;
      cancelAnimationFrame(frame);
      // 等本次点击的处理与重渲染完成后再看错误是否仍在。
      frame = requestAnimationFrame(() => {
        const el = box.current;
        if (!el?.textContent?.trim()) return;
        el.classList.remove('is-nudged'); void el.offsetWidth; el.classList.add('is-nudged');
      });
    };
    footer.addEventListener('click', onClick);
    return () => {footer.removeEventListener('click', onClick); cancelAnimationFrame(frame);};
  }, []);
  return <div ref={box} className="error form-footer-error" role="alert"
    onAnimationEnd={e => e.currentTarget.classList.remove('is-nudged')}>{error}</div>;
}
