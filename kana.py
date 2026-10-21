"""假名 → 简易赫伯恩罗马字：只用来比对标题（iTunes 常把日文标题罗马字化，如 キセキ → Kiseki）。"""
import unicodedata

_BASE = dict(zip(
    'あいうえお' 'かきくけこ' 'さしすせそ' 'たちつてと' 'なにぬねの' 'はひふへほ' 'まみむめも' 'やゆよ' 'らりるれろ' 'わをん'
    'がぎぐげご' 'ざじずぜぞ' 'だぢづでど' 'ばびぶべぼ' 'ぱぴぷぺぽ',
    ('a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo '
     'ya yu yo ra ri ru re ro wa o n ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po').split()))
_SMALL = {'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo'}
_PALATAL = {'shi': 'sh', 'chi': 'ch', 'ji': 'j'}


def romaji(text):
    t = unicodedata.normalize('NFKC', str(text))
    t = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in t)   # 片假名 → 平假名
    out, i = [], 0
    while i < len(t):
        c = t[i]
        nxt = _BASE.get(t[i + 1]) if i + 1 < len(t) else None
        if c == 'っ' and nxt:
            out.append(nxt[0]); i += 1; continue
        if c == 'ー':
            if out: out.append(out[-1][-1])
            i += 1; continue
        r = _BASE.get(c)
        if r is None: out.append(c); i += 1; continue
        if i + 1 < len(t) and t[i + 1] in _SMALL:
            y = _SMALL[t[i + 1]]
            r = _PALATAL[r] + y[1:] if r in _PALATAL else r[:-1] + y
            i += 1
        out.append(r); i += 1
    return ''.join(out)
