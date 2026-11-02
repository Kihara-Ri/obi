// 页面内容跟随页面 chunk（core/lazy-page.ts）：只切到 chunk 已到齐的页面，没到齐时停在当前页、到齐再切过去，
// 底栏照常立即响应。加载失败交给 onFail（参数表示首屏是否已出来）；首屏之后在后台预取其余页面。
import {useEffect, useState} from 'react';
import {preloadPages, usePagesArrived} from '../core/lazy-page';

export interface ShownPage {page: string; setup: boolean}
interface PageChunk {load(): Promise<unknown>; readonly loaded: boolean}

export function useShownPage(wanted: PageChunk | null, livePage: string, needsSetup: boolean,
                             onFail: (firstShown: boolean) => void): ShownPage | null {
  usePagesArrived();
  const [shown, setShown] = useState<ShownPage | null>(null);
  if (wanted?.loaded && (shown?.page !== livePage || shown.setup !== needsSetup)) setShown({page: livePage, setup: needsSetup});
  const firstShown = shown !== null;
  useEffect(() => {
    wanted?.load().catch(() => onFail(firstShown));
  }, [wanted]);   // eslint-disable-line react-hooks/exhaustive-deps -- 只在要去的页面变化时触发
  // 失败不打扰，切到那一页时再试
  useEffect(() => { if (firstShown) preloadPages().catch(() => {}); }, [firstShown]);
  return shown;
}
