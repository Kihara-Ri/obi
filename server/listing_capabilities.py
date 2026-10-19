"""统一模型目录协议；保留服务端能力，不按模型名猜思考级别或图片支持。"""
from domain import ValidationError


def normalize_models(provider, rows):
    if not isinstance(rows, list): raise ValidationError('服务商模型目录格式无效')
    result, seen = [], set()
    for row in rows[:300]:
        if not isinstance(row, dict): continue
        value = row.get('slug') or row.get('id') or row.get('value')
        if not isinstance(value, str) or not 1 <= len(value) <= 150 or value in seen: continue
        if provider == 'openai' and row.get('visibility', 'list') != 'list': continue
        seen.add(value)
        label = row.get('display_name') or row.get('displayName') or row.get('name') or value
        levels = row.get('supported_reasoning_levels', row.get('supported_reasoning_efforts', []))
        if isinstance(row.get('effort'), dict): levels = row['effort'].get('supported_levels', levels)
        if provider == 'anthropic': levels = row.get('supportedEffortLevels', []) if row.get('supportsEffort') else []
        efforts = []
        for item in levels if isinstance(levels, list) else []:
            level = item.get('effort') if isinstance(item, dict) else item
            if level in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra') and level not in efforts:
                efforts.append(level)
        # DeepSeek 文档明确：none 通过 thinking.disabled 实现，不在 effort.supported_levels 内。
        if provider == 'deepseek' and efforts and 'none' not in efforts: efforts.insert(0, 'none')
        modalities = row.get('input_modalities')
        vision = 'image' in modalities if isinstance(modalities, list) else None
        if type(row.get('supportsVision')) is bool: vision = row['supportsVision']
        result.append({'value': value, 'label': str(label)[:300], 'efforts': efforts, 'vision': vision,
                       'resolvedModel': str(row.get('resolvedModel', value))[:150]})
    if not result: raise ValidationError('服务商未返回可选择的模型')
    return result
