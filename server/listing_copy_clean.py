"""买家可见文案的收尾清洗：标题不带易被闲鱼截断的括号引号，正文不得出现不确定、待核实一类措辞。"""
import re

TITLE_STRIP = re.compile(r'[《》〈〉「」『』【】〖〗〔〕\[\]（）()“”"‘’\'<>]')
# 这些词一旦出现就是把内部待核实事项写给了买家：整句删除。
HEDGE = re.compile('|'.join((
    '不确定', '尚未核实', '未核实', '待核实', '待确认', '无法确认', '无法判断', '不清楚', '暂无法', '有待',
    '需(?:要)?(?:自行)?(?:确认|核实|查看实物|看实物|看了)', '以实物为准', '以实际为准',
    '请自行(?:确认|核实)', '看了再说', '没有核实', '没核实')))
# 语气上的含糊词：不直接删句（常有正当用法），只触发一次重写。
SOFT = re.compile('可能|或许|大概|也许')
SENTENCE = re.compile(r'[^。！？!?；;]+[。！？!?；;]?')
SYSTEM_PREFIXES = re.compile(r'(?:资料标注|系统记录|数据显示|本副本记录为)\s*')
COPY_WORD = re.compile(r'本副本')


def clean_title(value):
    title = re.sub(r'\s+', ' ', TITLE_STRIP.sub(' ', value or '')).strip()
    return title.rstrip('。.，,、!！;；:：').strip()


def clean_system_jargon(text):
    if not text: return ''
    lines = []
    for line in text.split('\n'):
        line = SYSTEM_PREFIXES.sub('', line)
        line = COPY_WORD.sub('实物', line)
        lines.append(line)
    return '\n'.join(lines)


def hedge_hits(*parts):
    joined = '\n'.join(p or '' for p in parts)
    return sorted({m.group(0) for m in HEDGE.finditer(joined)} | {m.group(0) for m in SOFT.finditer(joined)})


def strip_hedges(description):
    lines = []
    for line in (description or '').split('\n'):
        if not HEDGE.search(line):
            lines.append(line); continue
        kept = ''.join(part for part in SENTENCE.findall(line) if not HEDGE.search(part)).strip()
        if kept: lines.append(kept)
    cleaned = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    return clean_system_jargon(cleaned)


def extract_partial_copy(raw):
    """从正在生成的 JSON 片段中提取 title 与 description 供前端流式展示。"""
    if not raw: return {'title': '', 'description': ''}
    title, desc = '', ''
    m_title = re.search(r'"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)', raw)
    if m_title:
        title = m_title.group(1).replace(r'\"', '"').replace(r'\n', '\n')
    m_desc = re.search(r'"description"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)', raw)
    if m_desc:
        desc = m_desc.group(1).replace(r'\"', '"').replace(r'\n', '\n')
    elif not m_title and not raw.strip().startswith('{'):
        desc = raw.strip()
    return {'title': clean_title(title), 'description': clean_system_jargon(desc.strip())}
