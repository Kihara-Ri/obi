"""售卖辅助 API；登录/模型网络请求不持有全局业务写锁。"""
from urllib.parse import urlsplit
from domain import ValidationError
from .listing_photos import photo_archive


def service(svc):
    svc.store.require_module('trading')
    if not svc.listings: raise ValidationError('售卖辅助服务不可用，请重启服务')
    return svc.listings


def api_listing_status(h, svc):
    analysis = service(svc)
    h.send({**analysis.model.status(), 'localLoginAvailable': not bool(svc.public_origin)})


def api_listing_analyze(h, svc, body): h.send(service(svc).start(body))


def api_listing_job(h, svc):
    from .routes import query
    h.send(service(svc).status(query(h).get('id', '')))


def api_listing_draft(h, svc, body):
    svc.store.require_module('trading')
    h.send(svc.store.save_listing_draft(body))


def api_listing_photos(h, svc):
    from .routes import query, WRITE_LOCK
    values = query(h)
    try:
        order = [int(i) for i in values.get('order', '').split(',') if i]
        revision = int(values.get('photoRevision', ''))
    except ValueError: raise ValidationError('照片选择格式无效') from None
    with WRITE_LOCK:
        raw = photo_archive(svc.store, values.get('id', ''), order, revision)
    h.send(raw, mime='application/zip', filename='listing-photos.zip')


def api_listing_login(h, svc, body):
    providers = service(svc).model.providers
    if body.get('provider') == 'anthropic':
        h.send(providers.claude.login.start()); return
    auth = providers.auth
    if svc.public_origin or urlsplit('//' + h.headers.get('Host', '')).hostname not in ('127.0.0.1', 'localhost'):
        raise ValidationError('服务器部署请用本机授权工具登录后安全传输凭据，见部署说明')
    h.send(auth.start(body.get('account', '')))


def api_listing_disconnect(h, svc, body):
    providers = service(svc).model.providers
    h.send(providers.disconnect(body.get('provider', providers.config.read()['provider'])))


def api_listing_provider(h, svc, body): h.send(service(svc).model.providers.configure(body))


def api_listing_connection(h, svc, body): h.send(service(svc).model.providers.connect(body))


def api_listing_auth_code(h, svc, body): h.send(service(svc).model.providers.claude.login.submit(body.get('code')))


def api_listing_models(h, svc):
    from .routes import query
    h.send({'models': service(svc).model.providers.models(query(h).get('provider'))})
