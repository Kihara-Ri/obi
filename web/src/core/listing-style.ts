// 自定义文案风格：用几组选项代替自由写提示词。选项拼成 instructions 交给模型，选项值随风格保存以便回显。
export interface StyleOptions {
  tone: string; length: string; layout: string; title: string;
  tracks: boolean; condition: boolean; emoji: boolean; ending: string; extra: string;
}
type Choice = {value: string; label: string; text: string};
export const STYLE_GROUPS: {key: 'tone' | 'length' | 'layout' | 'title'; label: string; options: Choice[]}[] = [
  {key: 'tone', label: '语气', options: [
    {value: 'concise', label: '简洁', text: '语气简洁直接，避免营销词'},
    {value: 'friendly', label: '友好', text: '语气友好自然，像和买家聊天'},
    {value: 'collector', label: '收藏者', text: '像唱片收藏者自然交流，用词专业，不编造评价与发行背景'},
    {value: 'formal', label: '正式', text: '语气正式克制'}]},
  {key: 'length', label: '篇幅', options: [
    {value: 'short', label: '精简', text: '篇幅精简，控制在约 150 字内'},
    {value: 'medium', label: '适中', text: '篇幅适中'},
    {value: 'long', label: '详细', text: '篇幅详细，完整保留已知版本信息'}]},
  {key: 'layout', label: '排版', options: [
    {value: 'para', label: '一段话', text: '写成一段话'},
    {value: 'sections', label: '分段', text: '分段书写：版本、品相、附件各一段'},
    {value: 'bullets', label: '要点', text: '用要点列表，每行一条'}]},
  {key: 'title', label: '标题', options: [
    {value: 'plain', label: '艺人 专辑', text: '标题写艺人与专辑名，再接版本信息'},
    {value: 'ident', label: '带版本', text: '标题突出已确认的版本标识（如日版、侧标），再接专辑名'},
    {value: 'short', label: '简短', text: '标题简短，只写艺人和专辑名'}]},
];
export const DEFAULT_STYLE: StyleOptions = {tone: 'concise', length: 'short', layout: 'para', title: 'plain',
  tracks: false, condition: true, emoji: false, ending: '', extra: ''};

export function composeInstructions(o: StyleOptions): string {
  const parts = STYLE_GROUPS.map(g => g.options.find(c => c.value === o[g.key])?.text).filter(Boolean) as string[];
  if (o.tracks) parts.push('列出曲目（版本有冲突时省略）');
  if (o.condition) parts.push('品相与附件单独成段，如实写已知问题');
  parts.push(o.emoji ? '可少量使用表情符号' : '不使用表情符号');
  if (o.ending.trim()) parts.push(`结尾固定写：${o.ending.trim()}`);
  if (o.extra.trim()) parts.push(o.extra.trim());
  return `${parts.join('；')}。`;
}

/** 选项的一行概述（内置风格也用它展示）。 */
export function describeStyle(o: Partial<StyleOptions>): string {
  const names = STYLE_GROUPS.map(g => g.options.find(c => c.value === o[g.key])?.label).filter(Boolean);
  return names.join(' · ');
}
