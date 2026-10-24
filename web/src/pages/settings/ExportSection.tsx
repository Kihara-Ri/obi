// 设置 · 数据 · 导出表格：把账本导成 CSV 给 Excel / Numbers 查看整理。只出不进，和完整备份是两回事（D-026）；
// 账本页、交易记录页顶栏的导出按钮下载的是同一份文件。
import {useApp} from '../../state/AppContext';
import {DownloadButton} from '../../components/DownloadButton';

export function ExportSection() {
  const app = useApp();
  return <section className="settings-section data-block">
    <h3>导出表格</h3>
    <div className="inline-actions">
      <DownloadButton path="export" fileName="albums.csv">导出专辑 CSV</DownloadButton>
      {app.modules.trading ? <DownloadButton path="export?scope=sales" fileName="sales.csv">导出交易 CSV</DownloadButton> : null}
    </div>
    <p className="small-note">表格用于查看和整理，不能用来恢复；要保存或搬迁数据，请用上面的「下载完整备份」。</p>
  </section>;
}
