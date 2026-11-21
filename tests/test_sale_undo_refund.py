"""撤销退款 / 退货：误把「退款」点成「退货」后，交易回到售出中，可重新处理（2026-11-17）。"""
import tempfile, unittest
from pathlib import Path
from domain import ValidationError
from storage import Store
from tests.test_ledger import FakeRates


class UndoRefundTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'db.sqlite3', FakeRates({'2026-09-07': '4.8'}))
    def tearDown(self): self.tmp.cleanup()
    def buy(self):
        return self.store.save({'title': '测试专辑', 'artist': '艺人', 'date': '2026-09-07', 'price': '2000', 'currency': 'JPY', 'fees': '10'})['ids'][0]
    def sell(self, ids): return self.store.sell({'ids': ids, 'gross': '160', 'fees': '10', 'date': '2026-09-07'})['id']
    def record(self, id): return next(r for r in self.store.state()['records'] if r['id'] == id)
    def sale(self, id): return next(s for s in self.store.state()['sales'] if s['id'] == id)

    def test_undo_return_puts_record_back_on_sale(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '160', 'date': '2026-09-08', 'returned': True})
        self.store.sale_action({'id': sid, 'action': 'undo_refund'})
        s = self.sale(sid); r = self.record(id)
        self.assertEqual(s['status'], 'shipping'); self.assertNotIn('refundDate', s)
        self.assertNotIn('refund', s['items'][0])
        self.assertEqual(r['status'], 'shipping'); self.assertEqual(r['saleId'], sid)
        # 改做「还没发货就退款」：专辑回到售出前的位置，费用清零、不计损失
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '160', 'date': '2026-09-08', 'unshipped': True})
        s = self.sale(sid); r = self.record(id)
        self.assertEqual(s['status'], 'refunded'); self.assertEqual(r['status'], 'overseas'); self.assertNotIn('saleId', r)  # 售出前在海外库存
        self.assertEqual((s['fees'], s['items'][0]['fees'], s['items'][0]['profit']), ('0.00', '0.00', '0.00'))

    def test_unshipped_refund_restores_costs_on_undo(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '160', 'date': '2026-09-08', 'unshipped': True})
        self.store.sale_action({'id': sid, 'action': 'undo_refund'})
        s = self.sale(sid)
        self.assertEqual((s['status'], s['fees'], s['items'][0]['fees']), ('shipping', '10.00', '10.00'))
        self.assertNotIn('unshipped', s); self.assertNotIn('refundKeptCosts', s)
        self.assertEqual(self.record(id)['saleId'], sid)

    def test_return_keeps_costs_as_loss(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '160', 'date': '2026-09-08', 'returned': True})
        self.assertEqual(self.sale(sid)['items'][0]['profit'], '-10.00')

    def test_undo_refund_keeps_record(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '50', 'date': '2026-09-08'})
        self.store.sale_action({'id': sid, 'action': 'undo_refund'})
        self.assertEqual(self.sale(sid)['status'], 'shipping'); self.assertEqual(self.record(id)['saleId'], sid)

    def test_undo_return_refused_after_record_resold(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '160', 'date': '2026-09-08', 'returned': True})
        self.sell([id])
        with self.assertRaises(ValidationError): self.store.sale_action({'id': sid, 'action': 'undo_refund'})
        self.assertEqual(self.sale(sid)['status'], 'returned')

    def test_undo_only_for_refunded(self):
        id = self.buy(); sid = self.sell([id])
        with self.assertRaises(ValidationError): self.store.sale_action({'id': sid, 'action': 'undo_refund'})

    def test_return_postage_counts_as_loss(self):
        """退货时自己承担的寄回运费与寄出运费分开记，一起计入损失；退货后可补填，撤销退款清空（2026-11-21）。"""
        a = self.buy(); b = self.buy()
        sid = self.store.sell({'ids': [a, b], 'gross': '200', 'fees': '0', 'postage': '6', 'date': '2026-09-07'})['id']
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '200', 'date': '2026-09-08', 'returned': True, 'returnPostage': '9.01'})
        s = self.sale(sid)
        self.assertEqual(s['returnPostage'], '9.01')
        self.assertEqual(sorted(i['returnPostage'] for i in s['items']), ['4.50', '4.51'])
        self.assertEqual(sum(float(i['profit']) for i in s['items']), -15.01)  # 寄出 6 + 寄回 9.01
        self.store.sale_action({'id': sid, 'action': 'return_postage', 'returnPostage': '12'})
        self.assertEqual(sum(float(i['profit']) for i in self.sale(sid)['items']), -18.0)
        self.store.sale_action({'id': sid, 'action': 'return_postage', 'returnPostage': ''})
        s = self.sale(sid); self.assertNotIn('returnPostage', s); self.assertNotIn('returnPostage', s['items'][0])
        self.store.sale_action({'id': sid, 'action': 'return_postage', 'returnPostage': '5'})
        self.store.sale_action({'id': sid, 'action': 'undo_refund'})
        s = self.sale(sid); self.assertNotIn('returnPostage', s); self.assertNotIn('returnPostage', s['items'][0])
        with self.assertRaises(ValidationError): self.store.sale_action({'id': sid, 'action': 'return_postage', 'returnPostage': '5'})

    def test_return_postage_ignored_for_plain_refund(self):
        id = self.buy(); sid = self.sell([id])
        self.store.sale_action({'id': sid, 'action': 'refund', 'refund': '10', 'date': '2026-09-08', 'returnPostage': '8'})
        self.assertNotIn('returnPostage', self.sale(sid))


if __name__ == '__main__':
    unittest.main()
