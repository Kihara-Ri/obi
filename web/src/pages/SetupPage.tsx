import {PageHead} from '../components/PageHead';
import {ModuleChooser} from '../components/ModuleChooser';

export function SetupPage() {
  return <>
    <PageHead title="你想怎样使用 Obi？" desc="从需要的功能开始，之后随时可以在设置中调整。" label="MAKE IT YOURS"/>
    <section className="settings-section"><ModuleChooser initial/></section>
  </>;
}
