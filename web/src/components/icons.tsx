// 共享线性图标，颜色随 currentColor。
export const ChevDownIco = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export const ChevLeftIco = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <polyline points="15 6 9 12 15 18"/>
  </svg>
);

export const ChevRightIco = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <polyline points="9 6 15 12 9 18"/>
  </svg>
);

export const CamIco = (
  <span className="cam-ico" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
  </span>
);
export const TrashIco = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>
  </svg>
);

export const DownloadIco = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 4v11"/><polyline points="7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>
  </svg>
);

export const CheckIco = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <polyline points="5 12.5 10 17.5 19 7"/>
  </svg>
);

// 通用转圈：加载 / 保存中的按钮图标，尺寸与线性图标一致（样式见 styles/components.css 的 .spin-ico）。
export const SpinIco = <span className="spin-ico" aria-hidden="true"/>;

export const CopyIco = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6.2C5 5.5 5.5 5 6.2 5H15"/>
  </svg>
);

export const InfoIco = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>
  </svg>
);

export const SlidersIco = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>
  </svg>
);

// 「⋯」更多操作（实心圆点，与底栏「更多」同形）
export const MoreIco = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
    <circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/>
  </svg>
);

// 灯箱顶栏「关闭」
export const CloseIco = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6 6 18"/>
  </svg>
);

// 售出中「⋯」操作单：退款 / 退货（折返箭头）、撤销售出（逆时针撤回）
export const RefundIco = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
  </svg>
);

export const UndoIco = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>
  </svg>
);

// 库存视图切换（2026-11-19）：照实际布局画——列表是「小封面＋两行字」一行一行，卡片是两列大封面。
export const ListViewIco = (
  <svg className="view-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="3" y="4" width="6" height="6" rx="1.2"/><rect x="3" y="14" width="6" height="6" rx="1.2"/><path d="M12.5 6h8.5M12.5 9h5M12.5 16h8.5M12.5 19h5"/>
  </svg>
);

export const CardViewIco = (
  <svg className="view-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="7.5" height="18" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="18" rx="1.6"/><path d="M3 12.5h7.5M13.5 12.5h7.5"/>
  </svg>
);
