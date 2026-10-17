// AutoTextarea：随内容自动长高的多行输入。打开时撑开一次，输入时实时长高，长文完全可读。
// 容器变宽/变窄导致换行变化时（如抽屉从手机竖屏转横屏）会重新计算高度。
// maxRows：超过后不再长高，改为内部滚动（不传则不设上限）。
import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';
import type {ComponentProps} from 'react';

type Props = ComponentProps<'textarea'> & {maxRows?: number};

export function AutoTextarea({value, maxRows, ref, ...rest}: Props) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const lastWidth = useRef(0);

  const fit = useCallback(() => {
    const t = inner.current;
    if (!t) return;
    t.style.height = 'auto';
    let h = t.scrollHeight;
    if (maxRows) {
      const style = getComputedStyle(t);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
      const cap = line * maxRows + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      t.style.overflowY = h > cap ? 'auto' : '';
      h = Math.min(h, cap);
    }
    t.style.height = `${h}px`;
  }, [maxRows]);

  useLayoutEffect(fit, [fit, value]);

  // 仅在宽度变化时重算（自己改高度也会触发 ResizeObserver，必须过滤掉）
  useEffect(() => {
    const t = inner.current;
    if (!t || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (t.clientWidth !== lastWidth.current) { lastWidth.current = t.clientWidth; fit(); }
    });
    ro.observe(t);
    return () => ro.disconnect();
  }, [fit]);

  const setRef = (node: HTMLTextAreaElement | null) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return <textarea ref={setRef} value={value} {...rest}/>;
}
