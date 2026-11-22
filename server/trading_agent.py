"""外部订单事实与账本动作的 HTTP 边界。"""
from .agent_auth import authorize_agent, load_secret


def load_trading_agent_secret(data_dir):
    return load_secret(data_dir, 'trading-agent.token', b'obi_trading_', '交易同步 Agent')


def authorize_trading_agent(h, svc):
    return authorize_agent(h, svc.trading_agent_secret, '交易同步 Agent')


def api_listing_receipt(h, svc, body):
    h.send(svc.store.record_xianyu_listing(body))


def api_paid_order(h, svc, body):
    h.send(svc.store.record_xianyu_order(body))


def api_order_settlement(h, svc, body):
    h.send(svc.store.record_xianyu_settlement(body))
