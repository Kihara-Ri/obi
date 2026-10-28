"""浏览器协议验收服务：固定真实参考样本 + 本机假模型上游，不消耗真实额度。

先 prepare --download，再 seed_listing_reference_photos；不连接个人数据目录。
"""
import argparse
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import build
from server import make_handler
from tools.seed_samples import check_target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, required=True)
    parser.add_argument('--long-copy', action='store_true', help='通过固定样本初始化长文案阅读场景')
    args = parser.parse_args()
    if check_target(args.data_dir): parser.error('必须使用已初始化的固定样本库')
    if args.long_copy:
        from tools.seed_samples import seed_listing_long_copy
        seed_listing_long_copy(args.data_dir)
    class Model(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def do_GET(self):
            if self.path != '/v1/models': self.send_error(404); return
            # OpenCode 真实目录不返回图片/强度元数据；验收用同一个上游模拟这一形态。
            rows = ([{'id': 'acceptance-open-model'}] if
                    self.headers.get('Authorization', '').endswith('acceptance-opencode-placeholder') else [
                        {'id': 'acceptance-vision', 'display_name': '验收图片模型', 'input_modalities': ['text', 'image'],
                         'effort': {'supported_levels': ['low', 'high', 'max']}},
                        {'id': 'acceptance-text', 'display_name': '验收文字模型', 'input_modalities': ['text']}])
            raw = json.dumps({'data': rows}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def do_POST(self):
            request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            if self.path not in ('/v1/chat/completions', '/openai/v1/chat/completions'):
                self.send_error(404); return
            if self.path == '/openai/v1/chat/completions' and (
                    not self.headers.get('x-opencode-session', '').startswith('ses_')
                    or self.headers.get('User-Agent') != 'Obi-Album-Ledger'):
                self.send_error(400); return
            if request['model'] == 'acceptance-vision' and (request.get('thinking') != {'type': 'enabled'} or request.get('reasoning_effort') != 'high'):
                self.send_error(400); return
            content = request['messages'][1]['content']
            if '售卖文案助手' in request['messages'][0]['content']:
                context = json.loads(content[0]['text'])
                facts = context['facts']
                result = {'title': f"{facts['album']['artist']} {facts['album']['title']} CD",
                          'description': facts['versionText'] + '\n' + facts['conditionText'] + '\n模拟写作 · ' + context['style']}
            else:
                has_photos = any(row['type'] == 'image_url' for row in content)
                if has_photos and request['model'] == 'acceptance-text': self.send_error(400); return
                result = {'identifiers': [], 'observations': [
                    {'text': '协议验收观察：固定模型响应，不代表实物品相', 'photos': [0]}] if has_photos else [],
                    'versionText': '沿用已记录发行资料（模拟核对）',
                    'conditionText': '固定模型响应，不代表实物品相' if has_photos else '实物品相尚未核实',
                    'pending': ['此为参考图片与模拟推理；需使用实拍重新分析和试听'] if has_photos else ['尚未核实实物品相'],
                    'conflicts': ['验收：版本标识冲突，争议版本已省略'] if '样本冲突' in content[0]['text'] else []}
            raw = json.dumps({'choices': [{'message': {'content': json.dumps(result)}}]}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
    upstream = ThreadingHTTPServer(('127.0.0.1', 0), Model)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    os.environ.update(LISTING_API_BASE=f'http://127.0.0.1:{upstream.server_port}/v1',
                      LISTING_API_MODEL='acceptance-only-model', LISTING_API_KEY='acceptance-only-key',
                      DEEPSEEK_API_BASE=f'http://127.0.0.1:{upstream.server_port}/v1',
                      OPENCODE_API_BASE=f'http://127.0.0.1:{upstream.server_port}')
    services = build(args.data_dir)
    services.auth = None
    server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(services))
    print(f'ACCEPTANCE_URL=http://127.0.0.1:{server.server_port}', flush=True)
    try: server.serve_forever()
    finally:
        services.listings.close()
        server.server_close(); upstream.shutdown(); upstream.server_close()


if __name__ == '__main__': main()
