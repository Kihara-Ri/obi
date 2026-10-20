// 手机顶栏的返回目标：只有「更多」里的子页需要返回；回收站从设置进入，其余回到「更多」。
export const BACK_TARGET: Record<string, {href: string; label: string}> = {
  lookup: {href: '#more', label: '更多'},
  trades: {href: '#more', label: '更多'},
  stats: {href: '#more', label: '更多'},
  settings: {href: '#more', label: '更多'},
  trash: {href: '#settings', label: '设置与备份'},
};
