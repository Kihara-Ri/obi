// 设置页：分段标签页（功能 / 数据 / 高级 / 账户），一次只看一类；说明性文字折叠，主区只留控件与状态。
import {useSessionState} from '../core/useSessionState';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {ModuleChooser} from '../components/ModuleChooser';
import {AlbumEngineSettings} from '../components/AlbumEngineSettings';
import {Disclosure} from '../components/ui/Disclosure';
import {Seg} from '../components/ui/Seg';
import {TabPanel} from '../components/ui/TabPanel';
import {AccountSettings} from './settings/AccountSettings';
import {DataSettings} from './settings/DataSettings';
import {FeedbackSection} from '../components/FeedbackSection';
import {AppUpdateSection} from '../components/AppUpdateSection';

type Tab = 'modules' | 'data' | 'advanced' | 'account';
const TABS = [
  {value: 'modules', label: '功能'},
  {value: 'data', label: '数据'},
  {value: 'advanced', label: '高级'},
  {value: 'account', label: '账户'},
];

export function SettingsPage() {
  const app = useApp();
  const {state} = app;
  // 标签记在会话里：进回收站等子页再返回，仍停在原来的标签（原来是组件内 useState，卸载后回到「功能」）
  const [tab, setTab] = useSessionState<Tab>('settings-tab', 'modules', TABS.map(t => t.value as Tab));
  return (
    <>
      <PageHead title="设置与备份" label="KEEP IT IN ORDER"/>
      <Seg className="settings-tabs" persistKey="settings-tabs" ariaLabel="设置分类" options={TABS} value={tab} onValue={v => setTab(v as Tab)}/>

      <TabPanel value={tab} order={TABS.map(t => t.value)}>
      {tab === 'modules' ? (
        <section className="settings-section">
          {state.modules ? <ModuleChooser/> : <p className="small-note">当前后端仍是旧版本。重启 Obi 服务后，即可选择功能模块；原有账本可以继续使用。</p>}
        </section>
      ) : null}

      {tab === 'data' ? <DataSettings/> : null}

      {tab === 'advanced' ? <>
        <section className="settings-section">
          <h3>发行资料自动匹配</h3>
          <dl className="settings-stats">
            <div><dt>版本</dt><dd>{state.service?.version || 'dev'}</dd></div>
            {app.modules.acquisition ? <div><dt>汇率缓存</dt><dd>{state.rateService
              ? `${state.rateService.days} 天（最新 ${state.rateService.latest || '—'}）` : '不可用'}</dd></div> : null}
          </dl>
          <Disclosure summary="匹配如何工作">
            <p>添加专辑时输入实物条形码，系统会从 MusicBrainz 搜索 CD 发行版本。确认对应版本后，自动填写专辑名、艺人、发行日期、厂牌及曲目，并记住该版本，无需重复选择。</p>
            <p>展示封面优先使用 iTunes 的干净数字封面；没有准确匹配时使用已确认 MusicBrainz 发行版的 Cover Art Archive 正面图。数字实体的背面、内页与盘面仍只从已核对的发行版本获取。<strong>这一流程无需配置 AI 模型或 API 密钥</strong>，但需要连接公开资料库。</p>
            {app.modules.acquisition ? <p>日元成本按购买当天汇率自动折算，无需手动维护。</p> : null}
          </Disclosure>
        </section>
        <AlbumEngineSettings/>
        <AppUpdateSection/>
        <FeedbackSection/>
      </> : null}

      {tab === 'account' ? <AccountSettings/> : null}
      </TabPanel>
    </>
  );
}
