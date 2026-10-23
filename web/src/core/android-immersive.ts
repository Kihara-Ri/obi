// 安卓壳「沉浸展示」的调用与诊断：调用 ObiAndroid.setImmersive，再读原生 immersiveState() 的快照，
// 判断执行到了哪一步（壳有没有这个功能 → 调用是否成功 → 原生是否收到 → 系统栏是否真的隐藏），
// 失败时由 ImmersiveDiag 在界面里列出来，用户截图即可定位（不依赖 Toast）。
type Bridge = {setImmersive?: (on: boolean) => void; immersiveState?: () => string};

export type NativeCall = 'none' | 'no-method' | 'called' | `error: ${string}`;
export type NativeReport = {shell?: string; device?: string; android?: string; sdk?: number; rom?: string;
  calls?: number; on?: boolean; stage?: string; notch?: string; fullscreenFlag?: boolean; sysui?: number;
  focus?: boolean; statusVisible?: boolean; insetTop?: number; padTop?: number};
export type DiagStep = {label: string; ok: boolean; detail?: string};
export type ImmersiveDiagnosis = {ok: boolean; steps: DiagStep[]; info: string};

const bridge = () => (window as unknown as {ObiAndroid?: Bridge}).ObiAndroid;

export const inAndroidShell = () => Boolean(bridge());

// 必须是对象上的直接方法调用：写成 `bridge?.setImmersive?.(on)` 会被编译成 `fn.call(bridge, on)`，
// 个别老版本 WebView 上桥接方法不支持 .call
export function callNativeImmersive(on: boolean): NativeCall {
  const b = bridge();
  if (!b) return 'none';
  if (typeof b.setImmersive !== 'function') return 'no-method';
  try { b.setImmersive(on); return 'called'; } catch (e) { return `error: ${e instanceof Error ? e.message : String(e)}`; }
}

export function readNativeImmersive(): NativeReport | null | undefined {
  const b = bridge();
  if (!b || typeof b.immersiveState !== 'function') return undefined;
  try { const text = b.immersiveState(); return text ? JSON.parse(text) as NativeReport : null; } catch { return null; }
}

const OLD_SHELL = '安装包（原生外壳）版本过旧：网页补丁不会更新原生代码，请在「设置 → 应用更新」安装新安装包';

/** call：页面这边调用的结果；report：原生快照（undefined = 壳没有诊断接口，null = 还没有快照）。 */
export function diagnoseImmersive(call: NativeCall, report: NativeReport | null | undefined, webVersion: string): ImmersiveDiagnosis {
  const steps: DiagStep[] = [];
  const push = (label: string, ok: boolean, detail?: string) => { steps.push({label, ok, detail}); return ok; };
  const info = [`网页 ${webVersion}`, report?.shell ? `安装包 ${report.shell}` : '',
    report?.device ? `${report.device} / Android ${report.android ?? '?'}${report.rom ? ` / ${report.rom}` : ''}` : ''].filter(Boolean).join(' · ');
  const done = () => ({ok: steps.every(s => s.ok), steps, info});
  if (!push('安装包支持沉浸', call !== 'no-method', call === 'no-method' ? OLD_SHELL : undefined)) return done();
  if (!push('调用原生隐藏系统栏', call === 'called', call === 'called' ? undefined : call)) return done();
  if (!push('安装包支持诊断', report !== undefined, report === undefined ? OLD_SHELL : undefined)) return done();
  if (!push('原生收到调用', Boolean(report && report.calls), report ? `第 ${report.calls ?? 0} 次` : '没有快照')) return done();
  push('原生已执行隐藏', report?.stage === 'checked' || report?.stage === 'applied',
    `阶段 ${report?.stage ?? '?'}；FULLSCREEN ${report?.fullscreenFlag ? '是' : '否'}；flags 0x${(report?.sysui ?? 0).toString(16)}；刘海 ${report?.notch || '-'}`);
  push('系统栏已隐藏', report?.statusVisible === false,
    report?.statusVisible ? `系统仍显示状态栏（顶部占 ${report.insetTop ?? '?'}px，留白 ${report.padTop ?? '?'}px${report.focus === false ? '，窗口无焦点' : ''}）`
      : report?.stage !== 'checked' ? `原生还没完成自检${report?.focus === false ? '（窗口无焦点，可能被系统弹窗挡住）' : ''}` : undefined);
  return done();
}
