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


def clean_title(value):
    title = re.sub(r'\s+', ' ', TITLE_STRIP.sub(' ', value or '')).strip()
    return title.rstrip('。.，,、!！;；:：').strip()


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
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
