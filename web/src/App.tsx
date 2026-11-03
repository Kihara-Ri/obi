// 应用外壳：状态装配与刷新、hash 路由、页面分发。抽屉栈、切页动画、导航、PWA 各在自己的 hook / 组件里。
import {useCallback, useDeferredValue, useEffect, useRef, useState} from 'react';
import {ApiError} from './core/api';
import {useLedgerState} from './state/useLedgerState';
import {homePage, LEGACY_MODULES, normalizeModules, pageEnabled, PRESETS} from './core/modules';
import {applyThemePref, themePref} from './core/theme';
import type {ThemePref} from './core/theme';
import {useHashRoute} from './hooks/useHashRoute';
import {usePageTransition} from './hooks/usePageTransition';
import {usePwa} from './hooks/usePwa';
import {AppContext} from './state/AppContext';
import {useDigitalTwins} from './state/useDigitalTwins';
import {useAlbumEngine} from './state/useAlbumEngine';
import {useDrawerStack} from './state/useDrawerStack';
import {useShelfView} from './state/useShelfView';
import type {AppCtx} from './state/AppContext';
import type {SortMode} from './types';
import {MobileNav, navCounts, Sidebar} from './components/AppNav';
import {Drawer} from './components/ui/Drawer';
import {Lightbox} from './components/ui/Lightbox';
import {Toast} from './components/ui/Toast';
import type {ToastAction, ToastKind} from './state/AppContext';
import {Splash} from './components/ui';
import {PageVeil} from './components/PageVeil'; import {PeekUnderlay} from './pages/PeekUnderlay'; import {WhatsNew} from './components/WhatsNew';
import {installReplaceNav} from './core/nav';
import {lazyPage} from './core/lazy-page';
import {useShownPage} from './hooks/useShownPage';

// 每页一个 chunk（core/lazy-page.ts）：首屏只等当前页，其余首屏后预取；切页等目标页到齐，仍是同步的
const ShelfPage = lazyPage(() => import('./pages/ShelfPage').then(m => m.ShelfPage));
const TransitPage = lazyPage(() => import('./pages/TransitPage').then(m => m.TransitPage));
const ShippingPage = lazyPage(() => import('./pages/ShippingPage').then(m => m.ShippingPage));
const TradesPage = lazyPage(() => import('./pages/TradesPage').then(m => m.TradesPage));
const StatsPage = lazyPage(() => import('./pages/StatsPage').then(m => m.StatsPage));
const LookupPage = lazyPage(() => import('./pages/LookupPage').then(m => m.LookupPage));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage').then(m => m.SettingsPage));
const SetupPage = lazyPage(() => import('./pages/SetupPage').then(m => m.SetupPage));
const MorePage = lazyPage(() => import('./pages/MorePage').then(m => m.MorePage));
const GalleryPage = lazyPage(() => import('./pages/GalleryPage').then(m => m.GalleryPage));

/** 与下方 content 的分发一一对应：决定某个页面要等哪个 chunk */
const PAGE_CHUNKS: Record<string, {load(): Promise<unknown>; readonly loaded: boolean}> = {gallery: GalleryPage,
  overseas: ShelfPage, domestic: ShelfPage, trash: ShelfPage, transit: TransitPage, shipping: ShippingPage,
  trades: TradesPage, stats: StatsPage, lookup: LookupPage, more: MorePage};
const pageModule = (page: string, needsSetup: boolean) => needsSetup ? SetupPage : PAGE_CHUNKS[page] ?? SettingsPage;

export default function App() {
  const route = useHashRoute();
  const {state, refresh, applyRecordMetadata} = useLedgerState();
  const [fatal, setFatal] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [flip, setFlip] = useState(false);
  const [tradeFilter, setTradeFilter] = useState('all');
  const [shelfFilter, setShelfFilter] = useState('all');
  const [shelfView, setShelfView] = useShelfView();
  const [mobileSelecting, setMobileSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [theme, setThemeState] = useState<ThemePref>(() => themePref());
  const setTheme = useCallback((v: ThemePref) => { applyThemePref(v); setThemeState(v); }, []);
  const [toastMsg, setToastMsg] = useState<{key: number; kind: ToastKind; text: string; action?: ToastAction} | null>(null);
  const [inventoryPage, setInventoryPage] = useState('domestic');
  const shelfPageRef = useRef('');
  const modules = state?.modules?.needsSetup ? PRESETS[0].enabled
    : state ? normalizeModules(state.modules?.enabled ?? LEGACY_MODULES) : undefined;
  const home = modules ? homePage(state?.modules?.startPage, modules) : 'domestic';
  const target = route === 'ledger' ? 'stats' : route;   // 旧的「账本概览」已并入账本（stats）
  const livePage = !target ? home : modules && !pageEnabled(target, modules) ? 'domestic' : target;
  const needsSetup = Boolean(state?.modules?.needsSetup);   // 内容只切到 chunk 已到齐的页面；首屏前失败显示重试界面
  const shown = useShownPage(state && modules ? pageModule(livePage, needsSetup) : null, livePage, needsSetup, firstShown =>
    firstShown ? toast('页面文件没有加载完整，请检查网络后重试', 'err') : setFatal('页面文件没有加载完整，请检查网络后重新连接'));
  const page = useDeferredValue(shown?.page ?? livePage);   // 内容延后一拍：底栏（livePage）先响应，重渲染随后在后台完成
  // 以展示为主（展示是底栏标签）：库存 ↔ 展示按普通换页处理
  const showcaseTab = Boolean(modules?.showcase) && home === 'gallery';
  const albumEngine = useAlbumEngine();
  const twinState = useDigitalTwins(!!modules?.showcase);

  // 首次加载：401 → 登录页；失败 → 重试界面。地址里已有页面时先取它的 chunk，与 /api/state 并行，都到齐才出首屏
  useEffect(() => {
    if (target) pageModule(target, false).load().catch(() => {});
    refresh().catch(e => {
      if (e instanceof ApiError && e.status === 401) { location.replace('/login'); return; }
      setFatal(e instanceof Error ? e.message : String(e));
    });
  }, [refresh]);   // eslint-disable-line react-hooks/exhaustive-deps -- target 只取首次地址
  const firstShown = shown !== null;

  // 换页重置选择与筛选，并记住手机库存的地区。
  useEffect(() => {
    setSelected(new Set());
    setQuery('');
    // 国内 ↔ 海外是同一张库存页的子标签：保留已选的排序与上架筛选，换到其他页才重置
    const sameShelf = (a: string, b: string) => (a === 'domestic' || a === 'overseas') && (b === 'domestic' || b === 'overseas');
    if (!sameShelf(shelfPageRef.current, page)) { setSort('new'); setShelfFilter('all'); }
    shelfPageRef.current = page;
    setMobileSelecting(false);
    if (page === 'domestic' || page === 'overseas') setInventoryPage(page);
  }, [page, modules?.acquisition, modules?.trading, modules?.circulation, modules?.showcase]);

  useEffect(() => {
    if (state && !state.modules?.needsSetup && livePage !== route) location.replace(`#${livePage}`);
  }, [state, livePage, route]);
  // 消失时机由 Toast 组件自己的计时器决定（按级别区分时长、悬停暂停），这里只负责换新
  const toast = useCallback((msg: string, kind: ToastKind = 'ok', action?: ToastAction) => {
    setToastMsg(t => ({key: (t?.key ?? 0) + 1, kind, text: msg, action}));
  }, []);

  // 数字输入框聚焦时，滚动页面/抽屉的滚轮会悄悄改掉金额；滚轮一动就让它失焦
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === 'number' && document.activeElement === t) t.blur();
    };
    document.addEventListener('wheel', onWheel, {passive: true});
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  // 回到页签时刷新：拾取其他设备/实例的改动，保持全量状态一致。
  // 30 秒内跳过重复拉取——页签频繁切换不应每次都全量下载状态。
  const lastRefreshAt = useRef(0);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden || Date.now() - lastRefreshAt.current < 30000) return;
      lastRefreshAt.current = Date.now();
      refresh().catch(() => { /* 离线时静默 */ });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const {drawer, drawerClosing, drawerPage, drawerPages, drawerExited,
    openDrawer, closeDrawer, backDrawer, closeDrawerAndGo, setDrawerDirty} = useDrawerStack();

  useEffect(() => installReplaceNav(), []);
  const {mainRef, veil, setVeil} = usePageTransition(page, showcaseTab, state?.records);

  const {offline, installEvt, setInstallEvt} = usePwa();

  if (!state || !modules || !firstShown) {
    if (fatal) {
      return (
        <div className="empty">
          <h2>暂时无法打开 Obi</h2>
          <p>{fatal}</p>
          <button onClick={() => location.reload()}>重新连接</button>
        </div>
      );
    }
    // Splash 在加载 / 就绪两个分支里处于同一位置（第二个子节点），就绪后不重挂载，才能接着播退场转场
    return <>{null}<Splash ready={false}/></>;
  }

  const ctx: AppCtx = {
    state, modules, page,
    query, setQuery,
    sort, setSort,
    flip, setFlip,
    tradeFilter, setTradeFilter,
    shelfFilter, setShelfFilter,
    shelfView, setShelfView, mobileSelecting, setMobileSelecting,
    selected, setSelected,
    theme, setTheme,
    rec: id => state.records.find(r => r.id === id),
    refresh, applyRecordMetadata, toast, albumEngine, ...twinState,
    openDrawer, closeDrawer, backDrawer, closeDrawerAndGo, setDrawerDirty,
  };

  const counts = navCounts(state, modules);
  const content = shown.setup ? <SetupPage/>
    : page === 'gallery' ? <GalleryPage/>
    : ['overseas', 'domestic', 'trash'].includes(page) ? <ShelfPage/>
    : page === 'transit' ? <TransitPage/>
      : page === 'shipping' ? <ShippingPage/>
        : page === 'trades' ? <TradesPage/>
          : page === 'stats' ? <StatsPage/>
            : page === 'lookup' ? <LookupPage/>
            : page === 'more' ? <MorePage installEvt={installEvt} onInstalled={() => setInstallEvt(null)}/>
              : <SettingsPage/>;

  return (
    <>
    <AppContext.Provider value={ctx}>
      <a className="skip" href="#main">跳至内容</a>
      <div id="shell" className={page === 'gallery' ? 'showcase-shell' : undefined}>
        <Sidebar page={livePage} home={home} modules={modules} counts={counts}
                 installEvt={installEvt} onInstalled={() => setInstallEvt(null)}/>
        <main id="main" className={page === 'gallery' ? 'showcase-main' : undefined} tabIndex={-1} ref={mainRef}><div className="page-layer">{content}</div></main>
      </div>
      {offline ? <div id="connection-status" role="status">网络已断开，保存前请恢复连接。</div> : null}
      <MobileNav page={livePage} modules={modules} counts={counts} showcaseTab={showcaseTab} inventoryPage={inventoryPage}/>
      {drawer ? <Drawer spec={drawer} closing={drawerClosing} pages={drawerPages} pageKey={drawerPage.key} direction={drawerPage.direction}
                        onClose={() => closeDrawer()} onClosed={drawerExited}/> : null}
      {toastMsg ? <Toast key={toastMsg.key} kind={toastMsg.kind} text={toastMsg.text} action={toastMsg.action} onDone={() => setToastMsg(null)}/> : null}
      <Lightbox/><PeekUnderlay/><WhatsNew/>
    </AppContext.Provider>
    <Splash ready/>
    {veil ? <PageVeil key={page} covers={veil} onDone={() => setVeil(null)}/> : null}
    </>
  );
}
