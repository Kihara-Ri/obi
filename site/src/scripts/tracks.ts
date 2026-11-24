// 「开始使用」曲目表：展开 / 收起过渡与互斥，见 details-motion.ts。
import { accordion } from './details-motion';
accordion(document.querySelectorAll<HTMLDetailsElement>('#start details'));
