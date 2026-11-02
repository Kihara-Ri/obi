"""国会图书馆（NDL）编号来源：编号精确匹配、只要录音资料里的 CD、dcndl 详情映射（曲目 / 碟数 / 厂牌）、限流；夹具不连网。"""
import unittest
from io import BytesIO
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from domain import ValidationError
from server.ndl_catalog import NdlCatalog, tracks

BIB = '000010099246'


def opensearch(*items):
    rows = ''.join(f'''<item><title>{title}</title><category>{category}</category>
      <dc:identifier xsi:type="dcndl:RIS502">{catno}</dc:identifier>
      <dc:identifier xsi:type="dcndl:NDLBibID">{bib}</dc:identifier></item>''' for title, category, catno, bib in items)
    return f'''<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcndl="http://ndl.go.jp/dcndl/terms/"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><channel>{rows}</channel></rss>'''


def sru(extent='録音ディスク 1枚 : CD', parts=('(1)Ride the Wind(2)KAMEN RIDE(power guitar edit.)(3)Ride the Wind(instrumental)',),
        label='レーベル名 : avex mode', date='2009.4'):
    part = ''.join(f'<dcndl:partInformation><rdf:Description><dcterms:title>{p}</dcterms:title></rdf:Description></dcndl:partInformation>' for p in parts)
    note = f'<dcterms:description>{label}</dcterms:description>' if label else ''
    return f'''<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><records><record><recordData>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcndl="http://ndl.go.jp/dcndl/terms/" xmlns:foaf="http://xmlns.com/foaf/0.1/">
        <dcndl:BibResource>
          <dcterms:identifier rdf:datatype="http://ndl.go.jp/dcndl/terms/NDLBibID">{BIB}</dcterms:identifier>
          <dcterms:identifier rdf:datatype="http://ndl.go.jp/dcndl/terms/RIS502">AVCA-29189</dcterms:identifier>
          <dcterms:title>Ride the wind 仮面ライダーディケイド</dcterms:title>
          <dc:creator>門矢士 (井上正大)</dc:creator>
          <dcterms:publisher><foaf:Agent><foaf:name>エイベックス・エンタテインメント</foaf:name></foaf:Agent></dcterms:publisher>
          <dcndl:publicationPlace>JP</dcndl:publicationPlace>
          <dcterms:date>{date}</dcterms:date>{part}{note}
          <dcterms:extent>{extent}</dcterms:extent>
        </dcndl:BibResource></rdf:RDF></recordData></record></records></searchRetrieveResponse>'''


class FakeOpener:
    def __init__(self, *bodies): self.bodies, self.urls = list(bodies), []
    def open(self, request, timeout=None):
        self.urls.append(request.full_url)
        body = self.bodies.pop(0)
        if isinstance(body, int): raise HTTPError(request.full_url, body, 'x', {}, BytesIO())
        return BytesIO(body.encode())


def catalog(*bodies):
    opener = FakeOpener(*bodies)
    return NdlCatalog(opener=opener, sleep=lambda s: None, clock=lambda: 0.0), opener


class NdlCatalogTests(unittest.TestCase):
    def test_exact_catalog_number_returns_japanese_cd_release(self):
        service, opener = catalog(opensearch(('Ride the wind', '録音資料', 'AVCA-29189', BIB)), sru())
        [c] = service.search(catno='avca 29189')
        self.assertEqual(parse_qs(urlsplit(opener.urls[0]).query)['any'], ['avca 29189'])
        self.assertIn('itemno="R100000002-I000010099246"', parse_qs(urlsplit(opener.urls[1]).query)['query'][0])
        self.assertEqual((c['id'], c['source'], c['title'], c['artist']),
                         ('ndl-000010099246', 'ndl', 'Ride the wind 仮面ライダーディケイド', '門矢士 (井上正大)'))
        info = c['releaseInfo']
        self.assertEqual((info['catalogNumber'], info['label'], info['country'], info['releaseDate'], info['format'],
                          info['discCount'], info['barcode'], info['ndlBibId']),
                         ('AVCA-29189', 'avex mode', 'JP', '2009-04', 'CD', '1', '', BIB))
        self.assertNotIn('tracklist', info)   # 摘要不带曲目，详情才带
        self.assertEqual(c['url'], 'https://ndlsearch.ndl.go.jp/books/R100000002-I000010099246')

    def test_partial_numbers_books_and_non_cd_media_are_dropped(self):
        service, _ = catalog(opensearch(('x', '録音資料', 'AVCA-2918', '000000000001'),
                                        ('book', '図書', 'AVCA-29189', '000000000002'),
                                        ('dvd', '録音資料', 'AVCA-29189', '000000000003')),
                             sru(extent='ビデオディスク 1枚 : DVD'))
        self.assertEqual(service.search(catno='AVCA-29189'), [])

    def test_barcode_queries_nothing(self):
        service, opener = catalog()
        self.assertEqual(service.search(barcode='4988064291892'), [])
        self.assertEqual(opener.urls, [])

    def test_release_details_map_tracks_and_fall_back_to_publisher_label(self):
        service, _ = catalog(sru(label='', date='2009.4.22'))
        info = service.release_details('ndl-' + BIB)
        self.assertEqual(info['tracklist'], ['1-1 Ride the Wind', '1-2 KAMEN RIDE(power guitar edit.)', '1-3 Ride the Wind(instrumental)'])
        self.assertEqual((info['label'], info['releaseDate']), ('エイベックス・エンタテインメント', '2009-04-22'))
        with self.assertRaises(ValidationError): service.release_details('ndl-abc')

    def test_track_numbering_restart_starts_next_disc_and_unnumbered_text_is_one_track(self):
        discs = tracks(['(1)A(2)B', '(1)C(2)D'])
        self.assertEqual({n: [t['title'] for t in rows] for n, rows in discs.items()}, {1: ['A', 'B'], 2: ['C', 'D']})
        self.assertEqual([t['title'] for t in tracks(['組曲 全曲'])[1]], ['組曲 全曲'])

    def test_rate_limit_starts_cooldown(self):
        service, opener = catalog(503)
        with self.assertRaisesRegex(ValidationError, '限流'): service.search(catno='AVCA-29189')
        with self.assertRaisesRegex(ValidationError, '冷却'): service.search(catno='AVCA-29190')
        self.assertEqual(len(opener.urls), 1)


if __name__ == '__main__':
    unittest.main()
