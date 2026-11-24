// 首页「五个模块」的开关联动，和应用的模块设置一致：海外周转依赖购入记录。
// 打开海外周转时自动打开购入记录；关掉购入记录时一并关掉海外周转。
const acq = document.querySelector<HTMLInputElement>('#mod-acq');
const circ = document.querySelector<HTMLInputElement>('#mod-circ');
if (acq && circ) {
  circ.addEventListener('change', () => { if (circ.checked) acq.checked = true; });
  acq.addEventListener('change', () => { if (!acq.checked) circ.checked = false; });
}
