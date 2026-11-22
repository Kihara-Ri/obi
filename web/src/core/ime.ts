// 输入法回车判断：中文/日文输入法里按回车确认候选词时，浏览器同样发出 key === 'Enter' 的 keydown。
// 自定义「回车提交 / 选中 / 收起」的输入框都要先用它过滤，否则拼音还没上屏就被当成提交。
// Safari 不支持 isComposing（确认候选词时已被重置为 false），所以同时看 keyCode === 229（输入法处理中）。
type EnterLike = {key: string; keyCode: number; isComposing?: boolean; nativeEvent?: {isComposing?: boolean}};

/** 是「真正的回车」而不是输入法确认候选词的回车。 */
export function isPlainEnter(e: EnterLike): boolean {
  if (e.key !== 'Enter') return false;
  const composing = e.nativeEvent ? e.nativeEvent.isComposing : e.isComposing;
  return !composing && e.keyCode !== 229;
}
