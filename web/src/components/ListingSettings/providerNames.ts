import type {ListingProviderId} from '../../core/listing';

export const PROVIDER_NAMES: Record<ListingProviderId, {name: string; mark: string; access: string; note: string}> = {
  deepseek: {name: 'DeepSeek', mark: 'D', access: '填密钥', note: 'API Key · 按量计费'},
  openai: {name: 'OpenAI · ChatGPT', mark: 'O', access: '授权登录', note: 'ChatGPT OAuth · 用账号额度'},
  anthropic: {name: 'Anthropic · Claude', mark: 'C', access: '授权登录', note: 'Claude OAuth · 经官方 Claude Code'},
  api: {name: 'OpenAI 兼容 API', mark: 'A', access: '服务端配置', note: '独立计费 · 由服务端环境变量配置'},
};
