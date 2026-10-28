import type {ListingProviderId} from '../../core/listing';

export const PROVIDER_NAMES: Record<ListingProviderId, {name: string; access: string; note: string; beta?: boolean}> = {
  deepseek: {name: 'DeepSeek', access: '填密钥', note: 'API Key · 按量计费'},
  openai: {name: 'OpenAI · ChatGPT', access: '授权登录', note: 'ChatGPT OAuth · 用账号额度'},
  anthropic: {name: 'Anthropic · Claude', access: '授权登录', note: 'Claude OAuth · 经官方 Claude Code'},
  opencode: {name: 'OpenCode', access: '填密钥', note: 'Go 订阅 / 按量余额 · Console API Key', beta: true},
  api: {name: 'OpenAI 兼容 API', access: '服务端配置', note: '独立计费 · 由服务端环境变量配置'},
};
