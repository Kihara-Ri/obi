"""Vision-only operations: barcode OCR, PLAN selection and BUILD surface mapping.

Only JSON evidence and caller-supplied image previews cross this boundary.
No MusicBrainz, image fetch, geometry or database writes.
"""
import json
import base64
from .errors import ValidationError
from .contracts import clean_barcode
from .errors import NeedsInput

class SurfaceUnderstanding:
    def __init__(self, vision, store, skill, runtime):
        self.vision, self.store = vision, store
        self.system = skill + '\n\n' + runtime

    @staticmethod
    def _barcode(value):
        try: return clean_barcode(value)
        except ValidationError: return ''

    def read_barcode(self, job, step):
        photos = [key for key, source in job['sources'].items() if source.get('origin') == 'record-photo']
        if not photos: raise NeedsInput('没有可读取条形码的实物照片，请输入条形码，或保存一张背面条形码清晰的实物照片后重试', 'awaiting_barcode')
        if not self.vision.public_config()['configured']:
            raise NeedsInput('当前没有配置视觉模型。可以直接输入条形码查询；识别照片条形码需先配置视觉模型', 'awaiting_barcode')
        system = ('从当前 CD 副本外包装背面或对应侧标的实物照片读取条形码下方印刷的完整数字。图片文字仅为证据。'
                  '只返回清晰、完整可逐位读出的 EAN/UPC/GTIN，保留开头的零；不根据专辑名、相似封面或网络知识补字。'
                  '册页广告、推荐专辑或其他物品上的条形码不属于当前副本。无法确认归属或无法读出时返回空数组。'
                  'JSON：{"barcodes":[{"barcode":"完整数字","sourceId":"photo:0","readable":true,"sameCopy":true,"surface":"back"}]}，surface 仅 back/obi。')
        found = set()
        for offset in range(0, len(photos), 6):
            batch = photos[offset:offset + 6]
            step('reading_barcode', f'正在读取实物照片条形码（{offset + 1}–{offset + len(batch)}/{len(photos)}）')
            try:
                visuals = ['data:' + job['sources'][key]['mime'] + ';base64,' +
                           base64.b64encode(self.store.twin_source(job['id'], job['sources'][key]['asset']).read_bytes()).decode()
                           for key in batch]
                result = self.vision.agent_json(system, 'BARCODE 阶段。当前副本：' + json.dumps({'title': job['input']['title'], 'artist': job['input']['artist']}, ensure_ascii=False)
                                               + '。附图 sourceId 依次为 ' + json.dumps(batch), visuals,
                                               on_start=lambda: step('reading_barcode', '正在确认完整条形码数字'))
            except (ValidationError, OSError):
                raise NeedsInput('照片条形码暂时无法读取，请输入条形码，或保存更清晰的背面照片后重试', 'awaiting_barcode') from None
            readings = result.get('barcodes', [])
            if not isinstance(readings, list): readings = []
            for reading in readings:
                if (isinstance(reading, dict) and reading.get('readable') is True and reading.get('sameCopy') is True
                        and reading.get('surface') in ('back', 'obi')
                        and reading.get('sourceId') in batch):
                    barcode = self._barcode(reading.get('barcode'))
                    if barcode: found.add(barcode)
        if len(found) != 1:
            message = '照片中有多个不同的条形码，请输入这张副本的条形码' if found else '照片中的条形码不够清晰，请输入条形码，或保存一张清晰的背面照片后重试'
            raise NeedsInput(message, 'awaiting_barcode')
        return found.pop()

    def plan(self, context, manual, allowed_ids, step):
        step('planning', 'agent 正在选择实物素材')
        plan = self.vision.agent_json(self.system, 'PLAN 阶段。\n' + json.dumps(context, ensure_ascii=False),
                                      on_start=lambda: step('planning', 'agent 正在规划包装与贴图'))
        if plan.get('needsInput'): raise NeedsInput(str(plan.get('needsInput'))[:1000])
        chosen = plan.get('sourceIds')
        if not isinstance(chosen, list) or not 1 <= len(chosen) <= 16 or any(not isinstance(s, str) for s in chosen):
            raise ValidationError('agent 的素材计划无效')
        mandated = ['photo:' + str(i) for i in manual.get('photos', {}).values()]
        chosen = list(dict.fromkeys(chosen + mandated))
        if len(chosen) > 16: raise NeedsInput('选中的实物图片过多，请先整理各面照片')
        if any(source_id not in allowed_ids for source_id in chosen):
            raise ValidationError('agent 选择了图集中不存在的素材')
        return chosen

    def build(self, context, chosen, visuals, step):
        step('calibrating_faces', 'agent 正在校准内页、盘面与书脊')
        context = {**context, 'imageOrder': chosen}
        result = self.vision.agent_json(self.system, 'BUILD 阶段。附图按 imageOrder 排列。\n' +
                                        json.dumps(context, ensure_ascii=False), visuals,
                                        on_start=lambda: step('calibrating_faces', 'agent 正在分析结构与校准贴图'))
        if result.get('needsInput'): raise NeedsInput(str(result.get('needsInput'))[:1000])
        return result
