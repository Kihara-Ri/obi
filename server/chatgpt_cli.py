"""本机 OAuth 与服务器安全导入工具。凭据只写指定数据目录，不输出令牌。"""
import argparse
import json
import time
import webbrowser
from pathlib import Path
from domain import ValidationError
from .chatgpt_auth import ChatGPTAuth


def import_credentials(auth, source):
    incoming = json.loads(Path(source).read_text())
    accounts = incoming.get('accounts')
    if not isinstance(accounts, dict) or len(accounts) > 30: raise ValidationError('授权文件无效')
    cleaned = {}
    for key, account in accounts.items():
        if not isinstance(key, str) or not isinstance(account, dict): raise ValidationError('授权文件无效')
        for field in ('client_id', 'subject', 'access_token', 'refresh_token'):
            if not isinstance(account.get(field), str) or not 1 <= len(account[field]) <= 30000:
                raise ValidationError('授权文件缺少有效凭据')
        if account['client_id'] == 'dynamic_agent_client': raise ValidationError('授权文件尚未完成注册')
        if 'chatgpt.tokens.use.direct' not in account.get('scopes', []): raise ValidationError('未授权使用订阅额度')
        if type(account.get('expires_at')) not in (int, float): raise ValidationError('授权过期时间无效')
        cleaned[key] = {field: account.get(field, '') for field in
                        ('client_id', 'subject', 'access_token', 'refresh_token', 'id_token', 'email', 'scopes', 'expires_at')}
    active = incoming.get('active')
    if active not in cleaned: raise ValidationError('授权文件没有可用账号')
    with auth.credentials.locked() as state:
        state['accounts'].update(cleaned)
        state.update(active=active, method='oauth', model='')
        # 保留服务器自己的 hostId；后续刷新只由服务器执行。


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('login', 'import', 'status'))
    parser.add_argument('--data-dir', required=True, type=Path)
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    auth = ChatGPTAuth(args.data_dir)
    try:
        if args.action == 'login':
            url = auth.start()['url']
            print('请在本机浏览器完成 OpenAI 授权。未自动打开时访问：\n' + url, flush=True)
            webbrowser.open(url)
            while auth.status()['loginPending']: time.sleep(1)
            if not auth.status()['connected']:
                raise ValidationError(auth.login_error or '授权未完成或已超时')
            print('授权已保存到指定目录的 credentials/listing-chatgpt.json；不会输出令牌。')
        elif args.action == 'import':
            if not args.source: parser.error('import 需要 --source')
            import_credentials(auth, args.source)
            print('授权已导入；保留此服务器的 host ID，请由此实例管理后续刷新。')
        else:
            status = auth.status()
            print('已连接' if status['connected'] else '未连接')
            print('host ID: ' + status['hostId'])
    except (ValidationError, ValueError, OSError) as exc:
        parser.exit(1, str(exc) + '\n')
    finally: auth.cancel()


if __name__ == '__main__': main()
