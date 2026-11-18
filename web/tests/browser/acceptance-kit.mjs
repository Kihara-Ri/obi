// 浏览器验收共用：快速失败的超时、等界面稳定、失败现场。
// 以前单步默认等 30 秒，一处选择器失效就干等半分钟、只留下一句 Timeout；这里统一缩到 8 秒，
// 失败时给每个打开的页面截图，并打印地址、可见标题、焦点所在和错误提示，直接看出卡在哪。
import {join} from 'node:path';

export const STEP_TIMEOUT = Number(process.env.OBI_ACCEPTANCE_TIMEOUT || 8000);

/** 新建的浏览器上下文都用短超时；生成这类真要等的步骤在调用处单独放宽。 */
export const fastFail = context => {
  context.setDefaultTimeout(STEP_TIMEOUT);
  context.setDefaultNavigationTimeout(STEP_TIMEOUT * 2);
  return context;
};

/**
 * 等界面稳定：给定元素的矩形连续 quiet 毫秒不变，且没有按时间推进的动画在跑。
 * 滚动驱动的动画（如书架横滑渐隐）随滚动位置变化，永远是 running，不算“还在动”。
 * 每次调用用新的计时状态，不会沿用上一次的“已稳定”而立刻返回。
 */
export const settle = (page, selectors, {quiet = 200, timeout = STEP_TIMEOUT} = {}) =>
  page.waitForFunction(({selectors, quiet, token}) => {
    const now = performance.now();
    const key = selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return '-';
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map(value => value.toFixed(2)).join();
    }).join('|');
    const idle = document.getAnimations().every(animation =>
      animation.playState !== 'running' || !(animation.timeline instanceof DocumentTimeline));
    const all = window.__acceptanceSettle || (window.__acceptanceSettle = {});
    const state = all[token] || (all[token] = {key, since: now});
    if (state.key !== key || !idle) {state.key = key; state.since = now;}
    return now - state.since >= quiet;
  }, {selectors, quiet, token: Math.random().toString(36).slice(2)}, {polling: 50, timeout})
    .catch(error => {
      throw new Error(`界面 ${timeout}ms 内没有稳定下来（${selectors.join('、')} 仍在变化或有动画在跑）\n${error.message}`);
    });

/** 失败现场：所有上下文里还开着的页面各截一张，并打印它当时的状态。 */
export const reportFailure = async (browser, output, name) => {
  const pages = browser.contexts().flatMap(context => context.pages()).filter(page => !page.isClosed());
  for (const [index, page] of pages.entries()) {
    const path = join(output, `${name}-failure-${index + 1}.png`);
    const shot = await page.screenshot({path, timeout: 3000}).then(() => path, () => '截图失败');
    const scene = await page.evaluate(() => {
      const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      const texts = selector => [...document.querySelectorAll(selector)].filter(visible)
        .map(el => el.textContent.trim().replace(/\s+/gu, ' ').slice(0, 60)).filter(Boolean);
      const active = document.activeElement;
      return {
        headings: texts('h1, h2, h3, [role="dialog"] [role="heading"]').slice(0, 8),
        errors: texts('.error, [role="alert"]'),
        focus: active && active !== document.body
          ? `${active.tagName.toLowerCase()} ${active.getAttribute('aria-label') || active.textContent.trim().slice(0, 30)}` : '无',
      };
    }).catch(() => ({headings: [], errors: [], focus: '页面已无法读取'}));
    console.error(`失败现场 ${index + 1}：${page.url()}\n  截图：${shot}\n  可见标题：${scene.headings.join(' / ') || '无'}`
      + `\n  焦点：${scene.focus}${scene.errors.length ? `\n  错误提示：${scene.errors.join(' / ')}` : ''}`);
  }
};
