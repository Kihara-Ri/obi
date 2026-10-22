"""SQLite persistence. All multi-record writes are transactional.

Record status: overseas (held in Japan; optional `listed` mark, e.g. Mercari)
/ transit (in a shipment package) / domestic (home; same optional `listed`
mark, e.g. Xianyu) / shipping (sold, on the way to buyer) / sold / trash.

Shipments group albums sent in one package: creating one stamps an equal
share of the postage onto each album's fees (part of acquisition cost); it
can be rolled back at any step while albums haven't moved on.
Sales start at 'shipping'; only 确认收货 turns them into realized cash ('sold').
"""
import json, sqlite3, uuid, base64, hashlib, re, shutil, threading, time
from pathlib import Path
from datetime import datetime
from contextlib import closing
from domain import ValidationError, ConflictError, clean_record, clean_release_info, clean_modules, clean_start_page, clean_showcase_group, clean_showcase_groups, clean_listing, validate_packaging_photos, MODULE_NAMES, cost, number, money, day, allocate, STATUSES
from decimal import Decimal
from twins import TWIN_KEY, SKILL_VERSION, ID as TWIN_ID, ASSET as TWIN_ASSET, UUID as TWIN_RELEASE_ID, appearance, same_appearance, clean_barcode, clean_registry, image_type, entity_assets

SCHEMA = 4
# 随 /api/state 下发的设置：前端只读展示分组（core/gallery.ts）。新增前端读取的设置要在这里登记。
STATE_SETTINGS = ('showcase-groups-v1',)
SHIPMENT_STATUSES = ('transit', 'arrived', 'cancelled')
SALE_STATUSES = ('shipping', 'complete', 'cancelled', 'returned', 'refunded')
PHOTO_RE = re.compile(r'^data:image/(jpeg|png|webp);base64,')
MBID_RE = re.compile(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
RECORD_ID_RE = re.compile(r'^[0-9a-f]{32}$')
IDENTITY_METHODS = ('manual', 'corroborated', 'single', 'release-credit')

def clean_artist_identities(value):
    """备份恢复校验：artist-identities-v1 映射结构；字段不全或类型不对即拒绝。"""
    if not isinstance(value, dict): raise ValidationError('备份的艺人绑定无效')
    out = {}
    for name, ident in value.items():
        if not isinstance(name, str) or not 1 <= len(name) <= 500: raise ValidationError('备份的艺人绑定无效')
        if not isinstance(ident, dict) or not isinstance(ident.get('artistMbid'), str) or not MBID_RE.match(ident['artistMbid']):
            raise ValidationError('备份的艺人绑定无效')
        if not isinstance(ident.get('sourceName'), str) or not 1 <= len(ident['sourceName']) <= 500:
            raise ValidationError('备份的艺人绑定无效')
        if ident.get('method') not in IDENTITY_METHODS: raise ValidationError('备份的艺人绑定无效')
        if not isinstance(ident.get('confirmedAt'), str) or not 1 <= len(ident['confirmedAt']) <= 40:
            raise ValidationError('备份的艺人绑定无效')
        out[name] = {'artistMbid': ident['artistMbid'], 'sourceName': ident['sourceName'],
                     'method': ident['method'], 'confirmedAt': ident['confirmedAt']}
    return out

def clean_work_links(value):
    """备份恢复校验：record-work-links-v1 映射结构；不存在的记录 ID 在读取时忽略。"""
    if not isinstance(value, dict): raise ValidationError('备份的作品关联无效')
    out = {}
    for rid, link in value.items():
        if not isinstance(rid, str) or not RECORD_ID_RE.match(rid): raise ValidationError('备份的作品关联无效')
        if not isinstance(link, dict) or not isinstance(link.get('artistMbid'), str) or not MBID_RE.match(link['artistMbid']):
            raise ValidationError('备份的作品关联无效')
        if not isinstance(link.get('releaseGroupMbid'), str) or not MBID_RE.match(link['releaseGroupMbid']):
            raise ValidationError('备份的作品关联无效')
        for k in ('recordArtist', 'recordTitle'):
            if not isinstance(link.get(k), str) or not 1 <= len(link[k]) <= 500:
                raise ValidationError('备份的作品关联无效')
        if link.get('method') not in ('manual', 'corroborated'): raise ValidationError('备份的作品关联无效')
        if not isinstance(link.get('confirmedAt'), str) or not 1 <= len(link['confirmedAt']) <= 40:
            raise ValidationError('备份的作品关联无效')
        out[rid] = {k: link[k] for k in ('artistMbid', 'releaseGroupMbid', 'recordArtist',
                                         'recordTitle', 'method', 'confirmedAt')}
    return out

PHOTO_MIME = {'jpeg': '.jpg', 'png': '.png', 'webp': '.webp'}
MAX_PHOTOS = 30

def _strip_cover_blobs(x):
    """递归剔除 data-URL 形式的封面快照（audit 里的纯体积）；返回是否有剔除。"""
    hit = False
    if isinstance(x, dict):
        for k in [k for k, v in x.items() if k == 'cover' and isinstance(v, str) and v.startswith('data:image/')]:
            x.pop(k); hit = True
        for v in x.values(): hit = _strip_cover_blobs(v) or hit
    elif isinstance(x, list):
        for v in x: hit = _strip_cover_blobs(v) or hit
    return hit

def uid(): return uuid.uuid4().hex

def now(): return datetime.now().isoformat(timespec='seconds')

def dumps(x): return json.dumps(x, ensure_ascii=False)

def default_status(currency): return 'domestic' if currency == 'CNY' else 'overseas'

class Store:
    def __init__(self, path, rates=None):
        self.path = Path(path); self.path.parent.mkdir(parents=True, exist_ok=True)
        self.photos_dir = self.path.parent / 'photos'
        self.covers_dir = self.path.parent / 'covers'
        self.rates = rates
        with closing(self.connect()) as db, db:
            db.executescript('''CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS shipments(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT, action TEXT, data TEXT);
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, data TEXT NOT NULL);''')
        self.migrate()
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        return db
    def rows(self, db, table): return [json.loads(r['data']) for r in db.execute(f'SELECT data FROM {table}')]
    def get(self, db, table, id):
        row = db.execute(f'SELECT data FROM {table} WHERE id=?',(id,)).fetchone()
        if not row: raise ValidationError('记录不存在，请刷新页面')
        return json.loads(row['data'])
    def put(self, db, table, r):
        db.execute(f'INSERT OR REPLACE INTO {table}(id,data) VALUES(?,?)',(r['id'],dumps(r)))
    def audit(self, db, action, data):
        db.execute('INSERT INTO audit(at,action,data) VALUES(?,?,?)',(now(),action,dumps(data)))
    def migrate(self):
        """One-way upgrades; idempotent. Schema 3: shipments. Schema 4: covers to files."""
        with closing(self.connect()) as db, db:
            version = db.execute("SELECT data FROM meta WHERE key='schema'").fetchone()
            if version and json.loads(version[0]) >= SCHEMA: return
            changed = False
            for r in self.rows(db,'records'):
                touched = False
                if r.get('status') == 'review':
                    r['status'] = 'domestic'; touched = True
                if r.get('previousStatus') == 'review':
                    r['previousStatus'] = 'domestic'; touched = True
                for k in ('rate','rateSource'):
                    if k in r: r.pop(k); touched = True
                if isinstance(r.get('cover'),str) and r['cover'].startswith('data:image/'):
                    self.stash_cover(r); touched = True
                if touched: self.put(db,'records',r); changed = True
            # 历史审计行里的封面快照是纯体积（base64 整图），只删数据 URL 形式的值
            for aid,data in db.execute('SELECT id,data FROM audit').fetchall():
                try: blob=json.loads(data)
                except Exception: continue
                if _strip_cover_blobs(blob):
                    db.execute('UPDATE audit SET data=? WHERE id=?',(dumps(blob),aid)); changed = True
            db.execute("INSERT OR REPLACE INTO meta VALUES('schema',?)",(dumps(SCHEMA),))
        if changed: self.vacuum()
    def vacuum(self):
        db = sqlite3.connect(self.path, isolation_level=None)
        db.execute('VACUUM'); db.close()
    def backup(self):
        """完整快照（checkpoint / 导出用）。"""
        with closing(self.connect()) as db, db:
            rows=[dict(r) for r in db.execute('SELECT * FROM audit')]
            return {'format':'album-ledger','schema':SCHEMA,'createdAt':now(),
                'records':self.rows(db,'records'),'sales':self.rows(db,'sales'),
                'shipments':self.rows(db,'shipments'),
                'audit':rows,
                'settings':{r['key']:json.loads(r['data']) for r in db.execute('SELECT * FROM meta')}}
    def checkpoint(self):
        folder=self.path.parent/'backups';folder.mkdir(exist_ok=True)
        name=folder/(datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')
        name.write_text(dumps(self.backup()),encoding='utf-8')
    def record_rates(self, records):
        out = {}
        days = {r['date'] for r in records if r.get('currency')=='JPY' and r.get('date') and r.get('actual','')==''}
        if self.rates and days:
            self.rates.warm(sorted(days))
            out = {d: self.rates.get(d) for d in days}
        return out
    def state(self):
        """前端的账本状态：三张表、最近 100 条 audit、前端要读的设置（STATE_SETTINGS），加上派生的成本与利润。

        其余 meta（实体目录、艺人身份、商家缓存、任务注册表、令牌等）不下发，各走自己的接口。
        """
        keys = (*STATE_SETTINGS, 'modules-v1', 'start-page-v1', 'setup-pending')
        with closing(self.connect()) as db, db:
            audit = [dict(r) for r in db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 100')]
            audit.reverse()  # 保持与全量一致的时间正序
            meta = {r['key']: json.loads(r['data']) for r in
                    db.execute(f'SELECT key, data FROM meta WHERE key IN ({",".join("?" * len(keys))})', keys)}
            b = {'format': 'album-ledger', 'schema': SCHEMA,
                 'records': self.rows(db, 'records'), 'sales': self.rows(db, 'sales'),
                 'shipments': self.rows(db, 'shipments'), 'audit': audit,
                 'settings': {k: meta[k] for k in STATE_SETTINGS if k in meta}}
        enabled = meta.get('modules-v1')
        b['modules'] = {'enabled': clean_modules(enabled) if enabled is not None else {k: k != 'showcase' for k in MODULE_NAMES},
                        'configured': enabled is not None,
                        'startPage': clean_start_page(meta.get('start-page-v1', 'domestic')),
                        # 新实例只有起步示例时仍需引导（setup-pending 由 server/starter_albums 写入）
                        'needsSetup': enabled is None and (meta.get('setup-pending') is True
                                                           or not any(b[k] for k in ('records', 'sales', 'shipments')))}
        rates=self.record_rates(b['records'])
        for r in b['records']:
            rate = rates.get(r.get('date')) if r.get('currency')=='JPY' and r.get('date') and r.get('actual','')=='' else None
            if rate: r['rate']=str(rate)
            c=cost(r, rate)
            r['cost']=money(c) if c is not None else None
            r.pop('original',None)
        costs={r['id']:r['cost'] for r in b['records']}
        for s in b['sales']:
            for item in s['items']:
                c=Decimal(costs[item['recordId']]) if costs.get(item['recordId']) not in (None,'') else None
                net=Decimal(item['gross'])-Decimal(item['fees'])-Decimal(item.get('postage','0'))-Decimal(item.get('refund','0'))
                item['net']=money(net)
                # Returned stock retains its acquisition cost; sale shows only residual loss.
                p=net if s['status']=='returned' else (net-c if c is not None else None)
                item['profit']=money(p) if p is not None else None
        if self.rates: b['rateService']=self.rates.status()
        return b
    @staticmethod
    def album_identity(record):
        """One album, however many copies/editions are held. Not a copy flag.

        An explicit release group is not required for old imports, which often
        have title/artist only. Normalize editorial title brackets and spacing.
        """
        import unicodedata
        def norm(value):
            text = unicodedata.normalize('NFKC', str(value or '')).strip()
            if text.startswith('[') and text.endswith(']') and text.count('[') == 1:
                text = text[1:-1].strip()
            return ' '.join(text.split()).casefold()
        return norm(record.get('artist')) + '\u001f' + norm(record.get('title'))

    @staticmethod
    def _valid_work_group(record, work_links):
        link = work_links.get(record['id'])
        if not isinstance(link, dict): return None
        group = link.get('releaseGroupMbid')
        if (not isinstance(group,str) or not MBID_RE.fullmatch(group)
                or link.get('recordArtist') != record.get('artist')
                or link.get('recordTitle') != record.get('title')):
            return None
        return group.lower()

    def _album_catalog(self, db):
        """Idempotent Album entity/relation reconciliation, entirely transactional.

        Album IDs are permanent once assigned; editable titles are display data.
        Confirmed release groups override an ambiguous title match. Legacy
        favorite flags migrate only once and are preserved when groups split.
        """
        records = self.rows(db, 'records')
        existing_entities = self.meta_get(db, 'album-entities-v1')
        entities = existing_entities if existing_entities is not None else {}
        membership = self.meta_get(db, 'album-copy-links-v1') or {}
        old_likes = (self.meta_get(db, 'album-favorites-v1') or {}) if existing_entities is None else {}
        work_links = self.meta_get(db, 'record-work-links-v1') or {}
        if not isinstance(entities, dict) or not isinstance(membership, dict):
            raise ValidationError('专辑归档数据无效')
        entities = {k:dict(v) for k,v in entities.items()}
        membership = dict(membership)
        by_id = {r['id']:r for r in records}
        # Only valid, current snapshot work associations may control an identity.
        rgs = {r['id']:self._valid_work_group(r,work_links) for r in records}
        groups_by_name = {}
        for r in records:
            if rgs[r['id']]:
                groups_by_name.setdefault(self.album_identity(r),set()).add(rgs[r['id']])
        changed = False
        # Keep existing name-group associations on edits, except a newly
        # verified RG disambiguates it. Never merge two verified RGs.
        def create(record, rg=None, favorite=False):
            aid = uid()
            entities[aid] = {'id':aid,'title':record['title'],'artist':record['artist'],
                             'musicBrainzReleaseGroupId':rg,'liked':bool(favorite),
                             'createdAt':now()}
            return aid
        def find_rg(rg):
            return next((k for k,v in entities.items()
                         if v.get('musicBrainzReleaseGroupId') == rg),None)
        def find_name(r):
            key = self.album_identity(r)
            # If exactly one verified release group has this name, an unlinked
            # old record can tentatively share it. Ambiguity stays separate.
            unique = groups_by_name.get(key,set())
            if len(unique) == 1:
                candidate = find_rg(next(iter(unique)))
                if candidate: return candidate
            return next((k for k,v in entities.items()
                         if not v.get('musicBrainzReleaseGroupId') and
                         self.album_identity(v) == key),None)
        # Snapshot group conflicts before changing any copy assignment:
        # otherwise processing one RG first could make another appear safe
        # to reuse the old name-only Album entity.
        original_group_ids = {}
        for rid, aid in membership.items():
            if rid in rgs and rgs[rid]:
                original_group_ids.setdefault(aid, set()).add(rgs[rid])
        # Process verified records first so legacy unlinked copies can join a
        # unique group but never conflate two different release groups.
        sorted_records = sorted(records,key=lambda r:rgs[r['id']] is None)
        for r in sorted_records:
            rid=r['id']; rg=rgs[rid]; old_id=membership.get(rid)
            old_album = entities.get(old_id)
            target = None
            if rg:
                if old_album and old_album.get('musicBrainzReleaseGroupId') == rg:
                    target=old_id
                else:
                    target=find_rg(rg)
                    if not target and old_album and not old_album.get('musicBrainzReleaseGroupId'):
                        # Reuse an old album ID only when no other copy has a
                        # different confirmed group; preserve its liked flag.
                        if original_group_ids.get(old_id,set()) <= {rg}:
                            target = old_id
                            old_album['musicBrainzReleaseGroupId'] = rg
                            changed=True
                if not target:
                    old_favorite = bool(old_album and old_album.get('liked'))
                    target=create(r,rg,old_favorite or self.album_identity(r) in old_likes)
                    changed=True
            else:
                if old_album:
                    # If this unlinked record belongs to a *verified* different
                    # work by title, don't silently assign it to another work.
                    target=old_id
                else:
                    target=find_name(r)
                if not target:
                    target=create(r,None,self.album_identity(r) in old_likes)
                    changed=True
            if membership.get(rid) != target:
                membership[rid]=target
                changed=True
        # An edition title correction never changes albumId. Update the
        # descriptive label when all its extant copies now agree.
        members={}
        for r in records:
            members.setdefault(membership[r['id']],[]).append(r)
        for aid,copies in members.items():
            names={self.album_identity(r) for r in copies}
            if len(names)==1:
                display=copies[0]
                if (entities[aid].get('title'),entities[aid].get('artist')) != (
                        display['title'],display['artist']):
                    entities[aid]['title']=display['title']
                    entities[aid]['artist']=display['artist']
                    changed=True
        # Prune removed copy references, preserve orphan album entities for
        # backups and future restoration; preference is never lost by deletion.
        for rid in list(membership):
            if rid not in by_id:
                del membership[rid]; changed=True
        if changed or existing_entities is None:
            db.execute('INSERT OR REPLACE INTO meta(key,data) VALUES(?,?)',
                       ('album-entities-v1',dumps(entities)))
            db.execute('INSERT OR REPLACE INTO meta(key,data) VALUES(?,?)',
                       ('album-copy-links-v1',dumps(membership)))
            # Legacy title-keyed favorites have now been folded into stable
            # Album IDs. Retaining that old preference key could incorrectly
            # re-apply 'liked' to a newly split or explicitly unliked album.
            if existing_entities is None:
                db.execute("DELETE FROM meta WHERE key='album-favorites-v1'")
        return entities,membership,records

    def album_favorites(self):
        """Compatibility view plus durable Album entities and copy relationships."""
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            entities,links,records = self._album_catalog(db)
        dates = {}
        for r in records:
            date=r.get('date') or ''
            album_id=links[r['id']]
            if isinstance(date,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',date):
                if album_id not in dates or date<dates[album_id]:
                    dates[album_id]=date
        return {'albums':entities,'recordAlbumIds':links,
                'favorites':{rid:True for rid,aid in links.items() if entities[aid].get('liked') is True},
                'collectedAt':{rid:dates[aid] for rid,aid in links.items() if aid in dates}}

    def set_album_favorite(self, body):
        if not isinstance(body,dict) or set(body) != {'recordId','liked'}:
            raise ValidationError('专辑喜好请求格式不正确')
        if not isinstance(body['recordId'],str) or not RECORD_ID_RE.fullmatch(body['recordId']):
            raise ValidationError('专辑记录编号无效')
        if type(body['liked']) is not bool:
            raise ValidationError('我喜欢只能是开或关')
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            entities,links,records = self._album_catalog(db)
            if body['recordId'] not in links:
                raise ValidationError('记录不存在，请刷新页面')
            aid=links[body['recordId']]
            album=entities[aid]
            if album.get('liked') is not body['liked']:
                album['liked']=body['liked']
                db.execute('INSERT OR REPLACE INTO meta(key,data) VALUES(?,?)',
                           ('album-entities-v1',dumps(entities)))
                self.audit(db,'设置专辑喜欢状态',
                           {'recordId':body['recordId'],'albumId':aid,'liked':body['liked']})
        return self.album_favorites()

    def set_modules(self, enabled, start_page=None):
        enabled = clean_modules(enabled)
        if start_page is not None: start_page = clean_start_page(start_page)
        with closing(self.connect()) as db, db:
            before = self.meta_get(db, 'modules-v1')
            before_start_page = self.meta_get(db, 'start-page-v1')
            saved_start_page = start_page if start_page is not None else clean_start_page(
                before_start_page if before_start_page is not None else 'domestic')
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('modules-v1', dumps(enabled)))
            if start_page is not None:
                db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('start-page-v1', dumps(start_page)))
            self.audit(db, '调整功能模块', {'before': before, 'after': enabled,
                                          'beforeStartPage': before_start_page, 'afterStartPage': saved_start_page})
        return {'ok': True, 'enabled': enabled, 'startPage': saved_start_page}
    def require_module(self, name, db=None):
        if db is None:
            with closing(self.connect()) as conn:
                enabled = self.meta_get(conn, 'modules-v1')
        else:
            enabled = self.meta_get(db, 'modules-v1')
        enabled = clean_modules(enabled) if enabled is not None else {k: k != 'showcase' for k in MODULE_NAMES}
        if not enabled[name]:
            label = {'acquisition': '购入记录', 'trading': '二手交易', 'circulation': '海外周转', 'showcase': '收藏展示'}[name]
            raise ValidationError(f'请先在设置中启用「{label}」模块')

    def change_showcase_groups(self, data):
        """手动组 CRUD；全清单版本避免两台设备静默覆盖，组内顺序原样保存。"""
        if not isinstance(data, dict): raise ValidationError('展示组请求格式不正确')
        action = data.get('action')
        fields = {'create': {'action', 'expectedRevision', 'name', 'recordIds'},
                  'update': {'action', 'expectedRevision', 'id', 'name', 'recordIds'},
                  'delete': {'action', 'expectedRevision', 'id'}}
        if not isinstance(action, str) or action not in fields or set(data) != fields[action]:
            raise ValidationError('展示组操作或字段不正确')
        expected = data['expectedRevision']
        if type(expected) is not int or expected < 0:
            raise ValidationError('请提供有效的展示组版本')
        ident = uid() if action == 'create' else data['id']
        if not isinstance(ident, str) or not RECORD_ID_RE.fullmatch(ident):
            raise ValidationError('展示组编号不正确')
        incoming = None if action == 'delete' else clean_showcase_group(
            {'id': ident, 'name': data['name'], 'recordIds': data['recordIds']})
        with closing(self.connect()) as db, db:
            # 先取得写事务再读版本，直接调用 Store 时也不允许两次旧版本写入都成功。
            db.execute('BEGIN IMMEDIATE')
            self.require_module('showcase', db)
            stored = self.meta_get(db, 'showcase-groups-v1')
            before = clean_showcase_groups(stored) if stored is not None else {'revision': 0, 'groups': []}
            if before['revision'] != expected:
                raise ConflictError('展示组已在其他设备修改，请刷新后重试')
            groups = before['groups']
            position = next((i for i, group in enumerate(groups) if group['id'] == ident), None)
            if action != 'create' and position is None:
                raise ValidationError('展示组不存在，请刷新后重试')
            old = groups[position] if position is not None else None
            if incoming is not None:
                existing = {row['id'] for row in db.execute('SELECT id FROM records')}
                retained = set(old['recordIds']) if old is not None else set()
                if any(rid not in existing and rid not in retained for rid in incoming['recordIds']):
                    raise ValidationError('所选副本不存在，请刷新后重新选择')
            if action == 'create': groups.append(incoming)
            elif action == 'update': groups[position] = incoming
            else: groups.pop(position)
            after = clean_showcase_groups({'revision': before['revision'] + 1, 'groups': groups})
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('showcase-groups-v1', dumps(after)))
            self.audit(db, {'create': '创建展示组', 'update': '修改展示组', 'delete': '删除展示组'}[action],
                       {'groupId': ident, 'before': old, 'after': incoming,
                        'beforeRevision': before['revision'], 'afterRevision': after['revision']})
        return {'ok': True, **after}
    def import_preview(self, source):
        if not isinstance(source,list) or len(source)>10000: raise ValidationError('请选择专辑 JSON 数组文件，最多 10000 条')
        with closing(self.connect()) as db, db:
            existing={r.get('sourceId') for r in self.rows(db,'records')}
            modules = self.meta_get(db, 'modules-v1')
        seen=set();good=[];errors=[];duplicates=0
        for i,a in enumerate(source):
            try:
                if not isinstance(a,dict) or not a.get('id'): raise ValidationError('缺少原始 ID')
                sid=str(a['id'])
                if sid in seen: raise ValidationError('文件内 ID 重复')
                seen.add(sid)
                if sid in existing: duplicates+=1;continue
                p=a.get('purchase',{})
                r=clean_record({'title':a.get('title'),'artist':a.get('artist'),'date':p.get('date'),
                    'price':p.get('priceValue'),'currency':p.get('currency'),'location':p.get('location'),
                    'note':a.get('note',''),'rawRemark':a.get('rawRemark',''),'releaseYear':a.get('releaseYear','')})
                status = default_status(r['currency']) if modules is None or modules['circulation'] else 'domestic'
                r.update(id=uid(),sourceId=sid,original=a,status=status,revision=1,createdAt=now())
                good.append(r)
            except (ValidationError,TypeError,AttributeError) as e: errors.append(f'第 {i+1} 条：{e}')
        return {'records':good,'skipped':duplicates,'errors':errors}
    def import_data(self, source):
        preview=self.import_preview(source)
        if preview['errors']: raise ValidationError('；'.join(preview['errors'][:5]))
        self.checkpoint()
        with closing(self.connect()) as db, db:
            for r in preview['records']: self.put(db,'records',r)
            self._album_catalog(db)
            self.audit(db,'导入专辑',{'count':len(preview['records']),'skipped':preview['skipped']})
        return {'count':len(preview['records']),'skipped':preview['skipped']}
    def prepare_photos(self, rid, entries):
        """Validate photo entries against the current set; returns [(ext, bytes)].

        Entries are indexes into the existing photo set (keep) or data URLs (new).
        Raises before any filesystem change, so save() can roll back cleanly.
        """
        if not isinstance(entries, list): raise ValidationError('照片数据不正确')
        d = self.photos_dir / rid
        existing = sorted([p for p in d.iterdir() if p.is_file()], key=lambda p: int(p.stem)) if d.exists() else []
        plan = []
        for e in entries:
            if len(plan) >= MAX_PHOTOS: raise ValidationError(f'每张专辑最多 {MAX_PHOTOS} 张照片')
            if isinstance(e, int) and not isinstance(e, bool):
                if not 0 <= e < len(existing): raise ValidationError('照片序号不存在，请刷新页面后重试')
                plan.append((existing[e].suffix, existing[e].read_bytes()))
            elif isinstance(e, str):
                m = PHOTO_RE.match(e)
                if not m: raise ValidationError('照片格式不正确，请使用 JPG/PNG/WebP 图片')
                try: raw = base64.b64decode(e[m.end():], validate=True)
                except Exception: raise ValidationError('照片数据损坏，请重新选择图片')
                if len(raw) > 8 * 1024 * 1024: raise ValidationError('单张照片过大，请重拍或压缩后再上传')
                plan.append((PHOTO_MIME[m.group(1)], raw))
            else: raise ValidationError('照片数据不正确')
        return plan
    def apply_photos(self, rid, plan):
        d = self.photos_dir / rid
        if d.exists(): shutil.rmtree(d)
        if plan:
            d.mkdir(parents=True, exist_ok=True)
            for i, (ext, raw) in enumerate(plan): (d / f'{i}{ext}').write_bytes(raw)
    def stash_cover(self, r):
        """封面 data URL → data/covers/<内容哈希>.<ext>，记录只留 /api/cover/ 引用。

        内容寻址：同一张图全库共用一个文件，换封面自然得到新 URL，浏览器缓存随之失效。
        非 data URL（空串或已是 /api/cover/ 引用）原样放行。
        """
        cover = r.get('cover')
        if not isinstance(cover, str) or not cover.startswith('data:image/'): return r
        m = PHOTO_RE.match(cover)
        if not m: raise ValidationError('封面格式不正确，请使用 JPG/PNG/WebP 图片')
        if len(cover) > 3000000: raise ValidationError('封面数据过大')
        try: raw = base64.b64decode(cover[m.end():], validate=True)
        except Exception: raise ValidationError('封面数据损坏，请重新选择图片')
        if not raw: raise ValidationError('封面数据为空')
        digest = hashlib.sha256(raw).hexdigest()[:16]
        ext = PHOTO_MIME[m.group(1)]
        self.covers_dir.mkdir(parents=True, exist_ok=True)
        (self.covers_dir / (digest + ext)).write_bytes(raw)
        r['cover'] = f'/api/cover/{digest}{ext}'
        return r
    def save(self, data):
        items=data.get('items')
        if items is None: items=[data]
        if not items or len(items)>500: raise ValidationError('一次可录入 1–500 张专辑')
        if 'batchFees' in data:
            shares=allocate(number(data['batchFees'],'整批额外费用'), [number(i.get('price'),'买入金额', optional=True) or 1 for i in items] if data.get('allocation')=='price' else [1]*len(items))
            items=[{**i,'fees':f} for i,f in zip(items,shares)]
        with closing(self.connect()) as db, db:
            result=[];plans=[]
            modules = self.meta_get(db, 'modules-v1')
            for item in items:
                photos=item.pop('photos',None);item.pop('photoCount',None)
                self.stash_cover(item)  # 封面 data URL 落盘换引用，base64 不进库也不进审计
                if item.get('id'):
                    old=self.get(db,'records',item['id'])
                    if item.get('revision')!=old['revision']: raise ValidationError('记录已变更，请关闭详情并重新打开')
                    r=clean_record({**old,**item})
                    for k in ('id','status','sourceId','original','saleId','shipmentId','previousStatus','createdAt','listed','listingChannel','listingUrl','listingDraft'):
                        if k in old: r[k]=old[k]
                        else: r.pop(k,None)
                    r['revision']=old['revision']+1
                    self.audit(db,'修改专辑',{'id':r['id'],'before':old})
                else:
                    item.pop('listingDraft', None)  # 草稿只经受交易模块保护的独立事务写入
                    r=clean_record({'currency': 'CNY', **item} if modules is not None and not modules['circulation'] else item)
                    status=r.get('status') if r.get('status') in ('overseas','domestic') else default_status(r['currency'])
                    if modules is not None and not modules['circulation']:
                        if item.get('status') == 'overseas':
                            raise ValidationError('请先在设置中启用「海外周转」模块')
                        status = 'domestic'
                    r.update(id=uid(),status=status,revision=1,createdAt=now())
                    self.audit(db,'添加专辑' if modules is not None and not modules['acquisition'] else '记录买入',{'id':r['id'],'title':r['title']})
                if photos is not None:
                    plan=self.prepare_photos(r['id'],photos)
                    plans.append((r['id'],plan))
                    r['photoCount']=len(plan)
                    if not item.get('id') or photos != list(range(old.get('photoCount', 0))):
                        r['photoRevision'] = old.get('photoRevision', 0) + 1 if item.get('id') else 1
                    elif 'photoRevision' in old: r['photoRevision'] = old['photoRevision']
                    # Clients updating photos without packaging retain the same physical
                    # photo identity. Explicit maps already address the new photo order.
                    if 'packaging' not in item and r.get('packaging', {}).get('photos'):
                        role_map = {}
                        for role, old_index in r['packaging']['photos'].items():
                            matches = [i for i, entry in enumerate(photos) if type(entry) is int and entry == old_index]
                            if matches: role_map[role] = matches[0]
                        packaging = {**r['packaging'], 'photos': role_map}
                        if 'photoRegions' in packaging:
                            packaging['photoRegions'] = {
                                role: region for role, region in packaging['photoRegions'].items()
                                if role in role_map or role == 'front' and role not in r['packaging']['photos']
                            }
                        r['packaging'] = packaging
                elif item.get('id'):
                    r['photoCount']=old.get('photoCount',0)
                    if 'photoRevision' in old: r['photoRevision'] = old['photoRevision']
                else: r['photoCount']=0
                validate_packaging_photos(r)
                self.put(db,'records',r);result.append(r['id'])
                # 专辑笔记在同专辑所有副本间共享：保存时传播给同名同艺人的其他记录
                if item.get('id') and 'noteAlbum' in item:
                    cur=db.execute("UPDATE records SET data=json_set(data,'$.noteAlbum',?) WHERE id!=? AND json_extract(data,'$.title')=? AND json_extract(data,'$.artist')=?",(r.get('noteAlbum',''),r['id'],r['title'],r['artist']))
                    if cur.rowcount:self.audit(db,'同步专辑笔记',{'id':r['id'],'title':r['title'],'siblings':cur.rowcount})
            # Persist Album entities alongside newly added/edited copies.
            # Editing a copy's title does not rekey an existing album.
            self._album_catalog(db)
        for rid,plan in plans:self.apply_photos(rid,plan)
        return {'ids':result}
    def save_listing_draft(self, data):
        """草稿只改本副本售卖资料，不触碰上架标记或发行资料。"""
        from domain_listing import clean_draft, photo_order
        draft = clean_draft(data.get('draft'))
        mark = data.get('markListed', False)
        if type(mark) is not bool: raise ValidationError('上架状态无效')
        listing = data.get('listing', {})
        if not isinstance(listing, dict): raise ValidationError('上架资料无效')
        listing = clean_listing({'channel': listing.get('channel', ''), 'url': listing.get('url', '')}) if 'listing' in data else {}
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            self.require_module('trading', db)
            r = self.get(db, 'records', data.get('id'))
            if r['status'] not in ('domestic', 'overseas'):
                raise ValidationError('只有库存中的副本可保存售卖草稿')
            if data.get('revision') != r['revision']:
                raise ValidationError('记录已变更，请关闭后重新打开')
            if draft['photoRevision'] != r.get('photoRevision', 0):
                raise ValidationError('照片已变更，请重新核对')
            photo_order(draft['photoOrder'], r.get('photoCount', 0))
            if draft.get('analysis') and draft['analysis']['photoRevision'] != draft['photoRevision']:
                raise ValidationError('分析依据的照片已变更，请重新分析')
            r.update(listingDraft=draft, listingDescription=draft['description'], revision=r['revision'] + 1)
            r.update(listing)
            if mark: r['listed'] = True
            self.put(db, 'records', r)
            self.audit(db, '保存并标记上架' if mark else '保存售卖草稿', {'id': r['id']})
        return {'id': r['id'], 'revision': r['revision']}

    def last_audit(self, db, action, id):
        for (raw,) in db.execute("SELECT data FROM audit WHERE action=? ORDER BY id DESC LIMIT 500", (action,)):
            d=json.loads(raw)
            if d.get('id')==id: return d.get('before')
        return None

    def last_to_overseas(self, db, id):
        return self.last_audit(db,'to_overseas',id)

    def bulk(self, data):
        ids=list(dict.fromkeys(data.get('ids',[])));action=data.get('action')
        if not ids: raise ValidationError('请先选择专辑')
        if action in ('list', 'unlist'): self.require_module('trading')
        if action in ('to_overseas', 'undo_to_overseas', 'to_domestic', 'undo_to_domestic'): self.require_module('circulation')
        listing = data.get('listing')
        if listing is not None:
            if action != 'list' or not isinstance(listing, dict): raise ValidationError('上架资料格式不正确')
            listing = clean_listing(listing)
        self.checkpoint()
        with closing(self.connect()) as db, db:
            for id in ids:
                r=self.get(db,'records',id);old=dict(r)
                if action=='to_overseas':
                    if r['status']!='domestic': raise ValidationError('只有国内库存的专辑能调回海外')
                    r['status']='overseas';r.pop('shipmentId',None);r.pop('listed',None)
                elif action=='undo_to_overseas':
                    # 撤销「调回海外」：按审计里最近一次该专辑的调回记录还原包裹关联与上架标记；
                    # 之后记录若又被改过（revision 不连续）就拒绝，避免覆盖更新的修改
                    before=self.last_to_overseas(db,id)
                    if not before or r['status']!='overseas' or r['revision']!=before['revision']+1:
                        raise ValidationError('这张专辑之后又有变动，无法撤销；请手动处理')
                    r['status']='domestic'
                    if before.get('shipmentId'): r['shipmentId']=before['shipmentId']
                    if before.get('listed'): r['listed']=before['listed']
                elif action=='to_domestic':
                    # 手动标为国内库存（不走包裹：例如自己带回、本就在国内买的）；运费分摊等钱的记录不动
                    if r['status']!='overseas': raise ValidationError('只有海外库存的专辑能手动标为国内库存')
                    r['status']='domestic'
                elif action=='undo_to_domestic':
                    before=self.last_audit(db,'to_domestic',id)
                    if not before or r['status']!='domestic' or r['revision']!=before['revision']+1:
                        raise ValidationError('这张专辑之后又有变动，无法撤销；请手动处理')
                    r['status']='overseas'
                elif action=='list':
                    if r['status'] not in ('overseas','domestic'): raise ValidationError('只有库存中的专辑能标记上架')
                    r['listed']=True
                    if listing is not None: r.update(listing)
                elif action=='unlist':
                    if r['status'] not in ('overseas','domestic'): raise ValidationError('只有库存中的专辑能取消上架')
                    r.pop('listed',None)
                elif action=='delete':
                    if r['status'] not in ('overseas','domestic'): raise ValidationError('在途或已售的专辑不能移除；请先处理包裹或交易')
                    r['previousStatus']=r['status'];r['status']='trash'
                elif action=='restore':
                    if r['status']!='trash': raise ValidationError('只能恢复回收站记录')
                    r['status']=r.get('previousStatus','domestic')
                else: raise ValidationError('不支持的操作')
                r['revision']+=1;self.put(db,'records',r);self.audit(db,action,{'id':id,'before':old})
        return {'count':len(ids)}
    # ── shipments (打包运输) ──
    def to_cny(self,amount,currency,date,label='金额'):
        """折算为人民币；日元按当日每100円汇率。缺汇率时拒绝：金额要立即入账，不能挂起待定。"""
        if currency=='CNY': return amount
        rate=self.rates.get(date) if self.rates else None
        if rate in ('',None): raise ValidationError(f'暂无当日汇率，无法折算日元{label}；可直接填人民币金额')
        return Decimal(str(amount))*Decimal(str(rate))/100
    def ship(self,data):
        self.require_module('circulation')
        ids=list(dict.fromkeys(data.get('ids',[])))
        if not ids: raise ValidationError('请选择要运输的专辑')
        currency=data.get('currency') or 'CNY'
        if currency not in ('CNY','JPY'): raise ValidationError('币种不支持')
        cost_v=number(data.get('cost',0),'运费')
        method=str(data.get('method','')).strip()
        if not method or len(method)>50: raise ValidationError('请填写运输方式')
        date=day(data.get('date'),'发货日期')
        cny=self.to_cny(cost_v,currency,date,'运费')
        s={'id':uid(),'method':method,'cost':money(cny),'date':date,
            'currency':currency,'costOriginal':money(cost_v) if currency=='JPY' else '',
            'note':str(data.get('note','')),'status':'transit','arrivedDate':'','createdAt':now(),
            'items':[]}
        with closing(self.connect()) as db, db:
            rs=[self.get(db,'records',id) for id in ids]
            if any(r['status']!='overseas' for r in rs): raise ValidationError('只有海外库存的专辑能打包运输')
            shares=allocate(cny,[1]*len(rs))
            orig_shares=allocate(cost_v,[1]*len(rs)) if currency=='JPY' else shares
            s['items']=[{'recordId':r['id'],'fee':f,'feeOriginal':o} for r,f,o in zip(rs,shares,orig_shares)]
            for r,f in zip(rs,shares):
                r['fees']=money(Decimal(r.get('fees') or 0)+Decimal(f))
                r['previousStatus']='overseas';r['status']='transit';r['shipmentId']=s['id'];r['revision']+=1
                self.put(db,'records',r)
            self.put(db,'shipments',s);self.audit(db,'打包运输',{'id':s['id'],'count':len(rs),'cost':s['cost']})
        return {'id':s['id']}
    def shipment_action(self,data):
        self.require_module('circulation')
        with closing(self.connect()) as db, db:
            s=self.get(db,'shipments',data.get('id'));old=json.loads(dumps(s));action=data.get('action')
            if action=='arrive':
                if s['status']!='transit': raise ValidationError('只有在途包裹能签收')
                s['status']='arrived';s['arrivedDate']=day(data.get('date'),'签收日期')
                for item in s['items']:
                    r=self.get(db,'records',item['recordId'])
                    if r['status']!='transit': raise ValidationError('包裹状态与专辑不一致，请刷新页面')
                    r['status']='domestic';r['revision']+=1;self.put(db,'records',r)
            elif action=='undo_arrive':
                if s['status']!='arrived': raise ValidationError('只有已签收的包裹能回滚')
                for item in s['items']:
                    r=self.get(db,'records',item['recordId'])
                    if r['status']!='domestic': raise ValidationError('其中有专辑已售出或移除，无法回滚；请先处理对应交易')
                s['status']='transit';s['arrivedDate']=''
                for item in s['items']:
                    r=self.get(db,'records',item['recordId']);r['status']='transit';r['revision']+=1;self.put(db,'records',r)
            elif action=='cancel':
                if s['status']!='transit': raise ValidationError('包裹已签收，不能撤销运输')
                for item in s['items']:
                    r=self.get(db,'records',item['recordId'])
                    if r['status']=='transit':
                        r['fees']=money(max(Decimal(r.get('fees') or 0)-Decimal(item['fee']),Decimal('0')))
                        r['status']='overseas';r.pop('shipmentId',None);r['revision']+=1;self.put(db,'records',r)
                s['status']='cancelled'
            else: raise ValidationError('不支持的操作')
            self.put(db,'shipments',s);self.audit(db,'运输 '+action,{'before':old,'after':s})
        return {'ok':True}
    def update_shipment(self,data):
        self.require_module('circulation')
        with closing(self.connect()) as db, db:
            s=self.get(db,'shipments',data.get('id'));old=json.loads(dumps(s))
            if s['status']=='cancelled': raise ValidationError('已撤销的包裹不能修改')
            if 'method' in data:
                m=str(data['method']).strip()
                if not m or len(m)>50: raise ValidationError('请填写运输方式')
                s['method']=m
            if 'note' in data: s['note']=str(data['note'])
            if 'date' in data: s['date']=day(data['date'],'发货日期')
            if 'cost' in data or 'currency' in data:
                currency=data.get('currency') or s.get('currency') or 'CNY'
                if currency not in ('CNY','JPY'): raise ValidationError('币种不支持')
                orig=number(data['cost'],'运费') if 'cost' in data else Decimal(s.get('costOriginal') or s['cost'])
                new=self.to_cny(orig,currency,s['date'],'运费')
                shares=allocate(new,[1]*len(s['items']))
                orig_shares=allocate(orig,[1]*len(s['items'])) if currency=='JPY' else shares
                for item,share,o_share in zip(s['items'],shares,orig_shares):
                    r=self.get(db,'records',item['recordId'])
                    r['fees']=money(Decimal(r.get('fees') or 0)+Decimal(share)-Decimal(item['fee']))
                    r['revision']+=1;self.put(db,'records',r)
                    item['fee']=share;item['feeOriginal']=o_share
                s['cost']=money(new);s['currency']=currency
                if currency=='JPY': s['costOriginal']=money(orig)
                else: s.pop('costOriginal',None)
            self.put(db,'shipments',s);self.audit(db,'修改运输',{'before':old,'after':s})
        return {'ok':True}
    # ── sales ──
    def sell(self,data):
        self.require_module('trading')
        ids=list(dict.fromkeys(data.get('ids',[])))
        if not ids: raise ValidationError('请选择要出售的专辑')
        currency=data.get('currency') or 'CNY'
        if currency not in ('CNY','JPY'): raise ValidationError('币种不支持')
        gross=number(data.get('gross'),'成交价')
        fees=number(data.get('fees',0),'平台扣费')
        postage=number(data.get('postage',0),'寄出运费')
        date=day(data.get('date'),'售出日期')
        if data.get('status') not in (None,'shipping'): raise ValidationError('售出后需买家确认收货才到账')
        address=str(data.get('address','')).strip()
        if len(address)>500: raise ValidationError('地址过长')
        # 日元按售出日汇率折算人民币入账，原币金额与分摊留存（同运费口径）
        gross_cny=self.to_cny(gross,currency,date);fees_cny=self.to_cny(fees,currency,date);postage_cny=self.to_cny(postage,currency,date)
        with closing(self.connect()) as db, db:
            rs=[self.get(db,'records',id) for id in ids]
            if any(r['status'] not in ('overseas','domestic') for r in rs): raise ValidationError('其中有专辑不能出售，请刷新列表')
            gs=allocate(gross_cny,[1]*len(rs));fs=allocate(fees_cny,[1]*len(rs));ps=allocate(postage_cny,[1]*len(rs))
            og=allocate(gross,[1]*len(rs)) if currency=='JPY' else gs
            of=allocate(fees,[1]*len(rs)) if currency=='JPY' else fs
            op=allocate(postage,[1]*len(rs)) if currency=='JPY' else ps
            s={'id':uid(),'date':date,'status':'shipping','receivedDate':'',
                'currency':currency,'gross':money(gross_cny),'fees':money(fees_cny),'postage':money(postage_cny),'address':address,
                **({'grossOriginal':money(gross),'feesOriginal':money(fees),'postageOriginal':money(postage)} if currency=='JPY' else {}),
                'note':str(data.get('note','')),'channel':str(data.get('channel','闲鱼')),'orderId':str(data.get('orderId','')),
                'createdAt':now(),
                'items':[{'recordId':r['id'],'gross':g,'fees':f,'postage':p,'refund':'0.00',
                          **({'grossOriginal':g0,'feesOriginal':f0,'postageOriginal':p0} if currency=='JPY' else {})}
                         for r,g,f,p,g0,f0,p0 in zip(rs,gs,fs,ps,og,of,op)]}
            for r in rs:
                r['previousStatus']=r['status'];r['status']='shipping';r['saleId']=s['id'];r['revision']+=1;self.put(db,'records',r)
            self.put(db,'sales',s);self.audit(db,'记录售出',s)
        return {'id':s['id']}
    def update_sale(self,data):
        """补录/修正费用，不改变成交价、币种、到账日期或生命周期。"""
        self.require_module('trading')
        with closing(self.connect()) as db, db:
            before=self.get(db,'sales',data.get('id'))
        if before['status'] not in ('shipping','complete'):
            raise ValidationError('只有售出中或已确认收货的销售单能修改费用')
        currency=before.get('currency') or 'CNY'
        changes={}
        for key,label in (('fees','平台扣费'),('postage','寄出运费')):
            if key not in data: continue
            orig=number(data[key],label)
            previous=before.get(key+'Original') if currency=='JPY' else before.get(key,'0')
            if previous is not None and orig==Decimal(previous): continue
            # 汇率查询在数据库事务之外；沿用售出日折算口径。
            changes[key]=(orig,self.to_cny(orig,currency,before['date'],label))
        with closing(self.connect()) as db, db:
            s=self.get(db,'sales',data.get('id'));old=json.loads(dumps(s))
            if s!=before: raise ValidationError('销售单已变化，请刷新后重试')
            for key,(orig,cny) in changes.items():
                s[key]=money(cny)
                shares=allocate(cny,[1]*len(s['items']))
                originals=allocate(orig,[1]*len(s['items'])) if currency=='JPY' else shares
                if currency=='JPY': s[key+'Original']=money(orig)
                for item,share,original in zip(s['items'],shares,originals):
                    item[key]=share
                    if currency=='JPY': item[key+'Original']=original
            self.put(db,'sales',s);self.audit(db,'修改销售费用',{'before':old,'after':s})
        return {'ok':True}
    def sale_action(self,data):
        self.require_module('trading')
        with closing(self.connect()) as db, db:
            s=self.get(db,'sales',data.get('id'));old=json.loads(dumps(s));action=data.get('action')
            if s['status']=='complete': raise ValidationError('已确认收货，只能修改销售费用，不能重复收货、撤销或退款')
            if s['status'] not in ('shipping',): raise ValidationError('这笔交易已处理，不能重复操作')
            if action=='receive':
                s['status']='complete';s['receivedDate']=day(data.get('date'),'到账日期')
                for item in s['items']:
                    r=self.get(db,'records',item['recordId']);r['status']='sold';r['revision']+=1;self.put(db,'records',r)
            elif action=='cancel':
                s['status']='cancelled'
                for item in s['items']:
                    r=self.get(db,'records',item['recordId']);r['status']=r.get('previousStatus') if r.get('previousStatus') in ('overseas','domestic') else 'domestic';r.pop('saleId',None);r['revision']+=1;self.put(db,'records',r)
            elif action=='refund':
                refund=number(data.get('refund'),'退款总额')
                if refund>Decimal(s['gross']): raise ValidationError('退款不能超过买家支付总额')
                shares=allocate(refund,[Decimal(i['gross']) for i in s['items']])
                returned=data.get('returned') is True
                s['status']='returned' if returned else 'refunded';s['refundDate']=day(data.get('date'),'退款日期')
                for item,share in zip(s['items'],shares):
                    item['refund']=share
                    if returned:
                        r=self.get(db,'records',item['recordId']);r['status']='domestic';r.pop('saleId',None);r['revision']+=1;self.put(db,'records',r)
            else: raise ValidationError('不支持的操作')
            self.put(db,'sales',s);self.audit(db,'销售 '+action,{'before':old,'after':s})
        return {'ok':True}
    def restore_backup(self,b):
        if not isinstance(b,dict) or b.get('format')!='album-ledger': raise ValidationError('不是兼容的完整备份文件')
        if not isinstance(b.get('records'),list) or not isinstance(b.get('sales'),list): raise ValidationError('备份内容不完整')
        if not isinstance(b.get('settings', {}), dict): raise ValidationError('备份的设置无效')
        settings = dict(b.get('settings', {}))
        if 'modules-v1' in settings: settings['modules-v1'] = clean_modules(settings['modules-v1'])
        if 'start-page-v1' in settings: settings['start-page-v1'] = clean_start_page(settings['start-page-v1'])
        if 'album-favorites-v1' in settings:
            likes = settings['album-favorites-v1']
            if (not isinstance(likes,dict) or len(likes)>50000 or any(
                not isinstance(k,str) or len(k)>1200 or '\u001f' not in k or v is not True
                for k,v in likes.items())):
                raise ValidationError('备份的专辑喜好数据无效')
        if 'album-entities-v1' in settings:
            albums=settings['album-entities-v1']
            if (not isinstance(albums,dict) or len(albums)>100000 or any(
                not isinstance(aid,str) or not re.fullmatch(r'[0-9a-f]{32}',aid)
                or not isinstance(album,dict) or album.get('id') != aid
                or not isinstance(album.get('title'),str) or len(album['title'])>500
                or not isinstance(album.get('artist'),str) or len(album['artist'])>500
                or type(album.get('liked')) is not bool
                or not isinstance(album.get('createdAt'),str) or len(album['createdAt'])>40
                or (album.get('musicBrainzReleaseGroupId') is not None and (
                    not isinstance(album['musicBrainzReleaseGroupId'],str)
                    or not MBID_RE.fullmatch(album['musicBrainzReleaseGroupId'])))
                for aid,album in albums.items())):
                raise ValidationError('备份的专辑实体数据无效')
        if 'album-copy-links-v1' in settings:
            links=settings['album-copy-links-v1']
            if (not isinstance(links,dict) or len(links)>100000 or any(
                not isinstance(rid,str) or not RECORD_ID_RE.fullmatch(rid)
                or not isinstance(aid,str) or not re.fullmatch(r'[0-9a-f]{32}',aid)
                for rid,aid in links.items())):
                raise ValidationError('备份的专辑副本关联无效')
            if 'album-entities-v1' in settings and any(
                    aid not in settings['album-entities-v1'] for aid in links.values()):
                raise ValidationError('备份的专辑副本关联无效')
        if 'showcase-groups-v1' in settings:
            settings['showcase-groups-v1'] = clean_showcase_groups(settings['showcase-groups-v1'])
        if 'twin-model-assets-v1' in settings:
            self._validate_model_manifests(settings['twin-model-assets-v1'])
        settings.pop('album-engine-plugin-v1', None)
        if TWIN_KEY in settings:
            registry = clean_registry(settings[TWIN_KEY])
            registry['epoch'] = uid(); registry['revision'] += 1
            for job in registry['jobs'].values():
                if job['status'] in ('queued', 'running'):
                    job.update(status='interrupted', error='备份中的生成任务未继续执行，请手动重试', leaseUntil=0)
                    job.pop('claim', None); job['seq'] += 1
        # 新键只验结构与类型；恢复可能带来不存在的记录 ID / 过期关联，读取时再忽略或标待核对。
        if 'artist-identities-v1' in b.get('settings', {}):
            clean_artist_identities(b['settings']['artist-identities-v1'])
        if 'record-work-links-v1' in b.get('settings', {}):
            clean_work_links(b['settings']['record-work-links-v1'])
        # Old (schema-1/2) backups are upgraded on the fly so they stay restorable.
        for r in b['records']:
            if r.get('status')=='review': r['status']='domestic'
            if r.get('previousStatus')=='review': r['previousStatus']='domestic'
            for k in ('rate','rateSource'): r.pop(k,None)
        for s in b['sales']:
            if s.get('status')=='pending':
                s['status']='complete';s['date']=s.get('receivedDate') or s.get('date')
            s.setdefault('postage','0.00');s.setdefault('address','');s.setdefault('orderId','')
        shipments=b.get('shipments')
        if shipments is None: shipments=[]
        if not isinstance(shipments,list): raise ValidationError('备份的运输数据无效')
        ids=set()
        for r in b['records']:
            normalized=clean_record(r)
            validate_packaging_photos(normalized)
            if 'packaging' in r:
                if 'packaging' in normalized: r['packaging'] = normalized['packaging']
                else: r.pop('packaging')
            if r.get('listingChannel') or r.get('listingUrl'):
                clean_listing({'channel': r.get('listingChannel', ''), 'url': r.get('listingUrl', '')})
            if any(normalized.get(k)!=r.get(k) for k in ('title','artist','date','price','currency','fees','actual','cover')):
                raise ValidationError('备份中的专辑字段不完整或格式不正确')
            if not isinstance(r.get('revision'),int) or r['revision']<1: raise ValidationError('备份缺少记录版本')
            if not r.get('id') or r['id'] in ids or r.get('status') not in STATUSES: raise ValidationError('备份记录无效')
            ids.add(r['id'])
        shipment_ids=set()
        for sh in shipments:
            if sh.get('id') in shipment_ids or sh.get('status') not in SHIPMENT_STATUSES: raise ValidationError('备份的运输状态或 ID 无效')
            shipment_ids.add(sh['id'])
            day(sh.get('date'),'发货日期')
            number(sh.get('cost',0),'运费')
            if not sh.get('items') or any(i.get('recordId') not in ids for i in sh['items']): raise ValidationError('备份的运输关联不完整')
        sale_ids=set()
        for s in b['sales']:
            if s.get('id') in sale_ids or s.get('status') not in SALE_STATUSES: raise ValidationError('备份的销售状态或 ID 无效')
            sale_ids.add(s.get('id'))
            day(s.get('date'),'销售日期')
            number(s.get('gross'),'销售总额');number(s.get('fees'),'销售费用')
            if not s.get('id') or not s.get('items') or any(i.get('recordId') not in ids for i in s['items']): raise ValidationError('备份的销售关联不完整')
            for i in s['items']:
                for k in ('gross','fees','refund'): number(i.get(k,0),k)
        for r in b['records']:
            if r['status'] in ('sold','shipping'):
                want='complete' if r['status']=='sold' else 'shipping'
                matches=[s for s in b['sales'] if s['id']==r.get('saleId') and s['status'] in (want,'refunded') and any(i['recordId']==r['id'] for i in s['items'])]
                if len(matches)!=1: raise ValidationError('备份中的售出记录缺少有效销售单')
        for r in b['records']: self.stash_cover(r)  # 旧备份里的 data URL 封面一并落盘
        self.checkpoint()
        with closing(self.connect()) as db, db:
            plugin_state = self.meta_get(db, 'album-engine-plugin-v1')
            if plugin_state:
                settings['album-engine-plugin-v1'] = {**plugin_state, 'revision':plugin_state['revision'] + 1}
            for table in ('records','sales','shipments','audit','meta'): db.execute(f'DELETE FROM {table}')
            for r in b['records']: self.put(db,'records',r)
            for s in b['sales']: self.put(db,'sales',s)
            for sh in shipments: self.put(db,'shipments',sh)
            for a in b.get('audit',[]): db.execute('INSERT INTO audit(at,action,data) VALUES(?,?,?)',(a['at'],a['action'],a['data']))
            for k,v in settings.items():
                if k!='schema': db.execute('INSERT INTO meta VALUES(?,?)',(k,dumps(v)))
            db.execute("INSERT OR REPLACE INTO meta VALUES('schema',?)",(dumps(SCHEMA),))
            self.audit(db,'恢复完整备份',{'from':b.get('createdAt')})
        return {'ok':True}

    # ── 通用 meta 读取：模块开关与艺人绑定/作品关联等都走这里 ──
    def meta_get(self, db, key):
        row = db.execute('SELECT data FROM meta WHERE key=?',(key,)).fetchone()
        return json.loads(row['data']) if row else None

    # Plugin state is executable installation metadata, independent of entities.
    def plugin_state(self):
        with closing(self.connect()) as db:
            return self.meta_get(db, 'album-engine-plugin-v1') or {'version': None, 'revision': 0}

    @staticmethod
    def check_plugin_revision(state, expected):
        if expected is not None and (type(expected) is not int or expected != state['revision']):
            raise ConflictError('插件状态已在另一窗口更新，请刷新后重试')

    def twin_busy(self, db=None):
        if db is None:
            with closing(self.connect()) as conn: return self.twin_busy(conn)
        registry = self.meta_get(db, TWIN_KEY) or {}
        return any(job.get('status') in ('queued', 'running') for job in registry.get('jobs', {}).values())

    def change_plugin_state(self, version, expected_revision=None):
        if version is not None and (not isinstance(version, str) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version)):
            raise ValidationError('插件版本无效')
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            state = self.meta_get(db, 'album-engine-plugin-v1') or {'version': None, 'revision': 0}
            self.check_plugin_revision(state, expected_revision)
            if self.twin_busy(db): raise ConflictError('数字实体任务正在排队或生成，请等待完成后再更改插件')
            state = {'version': version, 'revision': state['revision'] + 1}
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('album-engine-plugin-v1', dumps(state)))
            self.audit(db, '安装唱片实体引擎' if version else '卸载唱片实体引擎', {'version': version})
            return state

    def _pin_twin_models(self, db, ident, snapshot):
        manifests = self.meta_get(db, 'twin-model-assets-v1') or {}
        # Published jobs retain their exact model bytes across engine upgrades.
        if ident in manifests: return manifests[ident]
        files = {}
        root = self.path.parent / 'engine-models'
        root.mkdir(parents=True, exist_ok=True)
        for name, source in snapshot['files'].items():
            if not isinstance(name, str) or not re.fullmatch(r'[a-zA-Z0-9_.-]+', name):
                raise ValidationError('模型文件名无效')
            raw = Path(source).read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            target = root / digest
            if not target.exists():
                temp = root / ('.' + uid())
                temp.write_bytes(raw)
                temp.replace(target)
            elif hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                raise ValidationError('用户模型资源校验失败，请恢复备份')
            files[name] = {'sha256': digest, 'url': f'/api/twin-model-assets/{ident}/{name}'}
        if not files: raise ValidationError('模型资源不完整')
        result = {'version':snapshot['version'], 'modelSet':snapshot['modelSet'], 'files':files}
        manifests[ident] = result
        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('twin-model-assets-v1', dumps(manifests)))
        return result

    def interrupt_twin_tasks_on_startup(self):
        """Recover a stopped process without replaying work or retaining claims.

        The caller owns the per-data-directory application lifetime lock. That
        lock prevents a second active application from interrupting its peer.
        """
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            registry = self.meta_get(db, TWIN_KEY)
            if not registry: return 0
            count = 0
            for job in registry.get('jobs', {}).values():
                if job.get('status') in ('queued', 'running'):
                    job.update(status='interrupted', error='生成服务中断，任务未继续执行；请手动重试', leaseUntil=0)
                    job.pop('claim', None)
                    self._write_twins(db, registry, job)
                    count += 1
            if count: self.audit(db, '恢复中断的数字实体任务', {'count':count})
            return count

    def published_twins_have_models(self):
        with closing(self.connect()) as db:
            registry = self.meta_get(db, TWIN_KEY) or {}
            manifests = self.meta_get(db, 'twin-model-assets-v1') or {}
            return all(ident in manifests for ident, job in registry.get('jobs', {}).items() if job.get('status') == 'succeeded')

    def pin_published_twin_models(self, snapshot):
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            registry = self.meta_get(db, TWIN_KEY) or {}
            existing = self.meta_get(db, 'twin-model-assets-v1') or {}
            for ident, job in registry.get('jobs', {}).items():
                if job.get('status') == 'succeeded' and ident not in existing:
                    self._pin_twin_models(db, ident, snapshot)
                    self._write_twins(db, registry, job)

    @staticmethod
    def _validate_model_manifests(manifests):
        if not isinstance(manifests, dict) or len(manifests) > 100000: raise ValidationError('备份模型资源清单无效')
        for ident, manifest in manifests.items():
            if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident) or not isinstance(manifest, dict): raise ValidationError('备份模型资源清单无效')
            if not isinstance(manifest.get('version'), str) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', manifest['version']) or manifest.get('modelSet') != 'album-rig-1': raise ValidationError('备份模型版本无效')
            files = manifest.get('files')
            if not isinstance(files, dict) or not 1 <= len(files) <= 100: raise ValidationError('备份模型资源清单无效')
            for name, item in files.items():
                if not isinstance(name, str) or not re.fullmatch(r'[a-zA-Z0-9_.-]+', name) or not isinstance(item, dict) or not isinstance(item.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', item['sha256']) or item.get('url') != f'/api/twin-model-assets/{ident}/{name}': raise ValidationError('备份模型资源清单无效')

    def published_twin_model_asset(self, ident, name):
        if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident): raise ValidationError('生成任务编号无效')
        with closing(self.connect()) as db:
            registry = self.meta_get(db, TWIN_KEY) or {}
            job = registry.get('jobs', {}).get(ident)
            manifest = (self.meta_get(db, 'twin-model-assets-v1') or {}).get(ident, {})
            item = manifest.get('files', {}).get(name)
            if not job or job.get('status') != 'succeeded' or not item: raise ValidationError('模型资源不存在')
            digest = item.get('sha256')
            if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest): raise ValidationError('模型资源清单无效')
            path = self.path.parent / 'engine-models' / digest
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise ValidationError('模型资源文件缺失或损坏，请恢复数据目录')
            return path

    # ── 数字实体任务：BEGIN IMMEDIATE 是跨请求/进程的唯一性与发布闸门 ──
    def _twins(self, db):
        return self.meta_get(db, TWIN_KEY) or {'epoch': uid(), 'revision': 0, 'jobs': {}, 'latest': {}}

    def _write_twins(self, db, registry, job=None):
        registry['revision'] += 1
        if job is not None: job['seq'] += 1; job['updatedAt'] = now()
        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (TWIN_KEY, dumps(registry)))

    def _twin_folder(self, ident):
        if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident): raise ValidationError('生成任务编号无效')
        return self.path.parent / 'digital-twins' / ident

    def _public_twin(self, job, record=None, db=None):
        result = {k: job.get(k) for k in ('id', 'recordId', 'status', 'phase', 'message', 'error', 'seq', 'createdAt', 'updatedAt', 'candidates', 'entity', 'instructions', 'releaseId', 'barcode', 'barcodeSource', 'generationMode')}
        if db is None:
            with closing(self.connect()) as model_db:
                result['models'] = (self.meta_get(model_db, 'twin-model-assets-v1') or {}).get(job['id'])
        else:
            result['models'] = (self.meta_get(db, 'twin-model-assets-v1') or {}).get(job['id'])
        if record is not None and not same_appearance(record, job['input']):
            result.update(status='stale', error='包装、照片或发行资料已变更，请按当前资料重新生成', entity=None)
        elif job['status'] == 'succeeded':
            folder = self._twin_folder(job['id'])
            if not all((folder / name).is_file() for name in entity_assets(job.get('entity', {}))):
                result.update(status='interrupted', error='数字实体原图文件缺失，请恢复数据目录或重新生成', entity=None)
        return result

    def twin_index(self):
        with closing(self.connect()) as db:
            registry = self.meta_get(db, TWIN_KEY)
            if registry is None: return {'epoch': '', 'revision': 0, 'jobs': {}}
            records = {r['id']: r for r in self.rows(db, 'records')}
            jobs = {rid: self._public_twin(registry['jobs'][jid], records[rid], db=db)
                    for rid, jid in registry['latest'].items() if rid in records}
            return {'epoch': registry['epoch'], 'revision': registry['revision'], 'jobs': jobs}

    def start_twin(self, body):
        if not isinstance(body, dict): raise ValidationError('生成请求无效')
        rid, request_id = body.get('recordId'), body.get('requestId')
        if not isinstance(rid, str) or not TWIN_ID.fullmatch(rid) or not isinstance(request_id, str) or not TWIN_ID.fullmatch(request_id):
            raise ValidationError('请提供副本编号和生成请求编号')
        if type(body.get('recordRevision')) is not int: raise ValidationError('请提供有效的副本版本')
        if body.get('mode', 'ai') not in ('ai', 'guided'): raise ValidationError('数字实体生成方式无效')
        if body.get('barcode') not in (None, ''):
            raise ValidationError('条码只能在专辑编辑页修改并验证；生成数字实体不得另传条码')
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); self.require_module('showcase', db)
            record = self.get(db, 'records', rid)
            if record['status'] not in ('domestic', 'overseas', 'transit'): raise ValidationError('只能为当前收藏副本生成数字实体')
            # A confirmed MusicBrainz edition belongs to the copy, not to a transient twin job.
            release_info = record.get('releaseInfo') or {}
            selected_release = release_info.get('musicBrainzReleaseId') or ''
            from twins import UUID
            if not UUID.fullmatch(selected_release):
                raise ValidationError('请先在专辑编辑页通过条码或唱片编号确认 MusicBrainz 发行版本')
            barcode = clean_barcode(release_info.get('barcode', ''))
            registry = self._twins(db)
            # A lost HTTP response cannot turn the same accepted request into another task.
            receipt = next((j for j in registry['jobs'].values() if j['recordId'] == rid and j['requestId'] == request_id), None)
            if receipt: return {'epoch': registry['epoch'], 'revision': registry['revision'], 'job': self._public_twin(receipt, record, db=db)}
            latest_id = registry['latest'].get(rid); latest = registry['jobs'].get(latest_id)
            if latest is None and body.get('expectedJobId') is not None:
                raise ConflictError('任务历史已变化，请刷新状态后重新发起')
            if latest:
                shown = self._public_twin(latest, record, db=db)
                changed_input = shown['status'] == 'stale' and body.get('expectedJobId') == latest_id
                if latest['status'] in ('queued', 'running') and changed_input:
                    latest.update(status='stale', error='副本资料已变化，旧生成已停止', leaseUntil=0)
                    latest.pop('claim', None); latest['seq'] += 1
                elif latest['status'] in ('queued', 'running') or shown['status'] == 'succeeded' or body.get('expectedJobId') != latest_id:
                    return {'epoch': registry['epoch'], 'revision': registry['revision'], 'job': shown}
            if body.get('recordRevision') != record['revision']: raise ConflictError('副本已在其他窗口修改，请刷新后再生成')
            ident = uid(); folder = self._twin_folder(ident); folder.mkdir(parents=True)
            sources = {}
            # Freeze photo identity before the worker or subsequent edits can reorder it.
            for index in range(record.get('photoCount', 0)):
                found = sorted((self.photos_dir / rid).glob(str(index) + '.*'))
                if not found: raise ConflictError('实物照片未保存完整，请稍后重试')
                ext, mime = image_type(found[0].read_bytes()); name = f'photo-{index}.{ext}'
                shutil.copyfile(found[0], folder / name)
                sources['photo:' + str(index)] = {'asset': name, 'mime': mime, 'origin': 'record-photo', 'sourceUrl': ''}
            cover_name = record.get('cover', '').split('/')[-1]
            if re.fullmatch(r'[0-9a-f]{16}\.(jpg|png|webp)', cover_name) and (self.covers_dir / cover_name).is_file():
                raw = (self.covers_dir / cover_name).read_bytes(); ext, mime = image_type(raw); name = 'cover.' + ext
                (folder / name).write_bytes(raw); sources['cover'] = {'asset': name, 'mime': mime, 'origin': 'record-cover', 'sourceUrl': ''}
            job = {'id': ident, 'recordId': rid, 'requestId': request_id, 'skill': SKILL_VERSION,
                   'status': 'queued', 'phase': 'locating_release', 'message': '等待核对发行版', 'error': '', 'seq': 0,
                   'input': appearance(record), 'inputRevision': record['revision'], 'instructions': '',
                   'workflow': 'confirmed-release', 'generationMode': 'guided' if body.get('mode') == 'guided' else 'ai', 'barcode': barcode, 'barcodeSource': 'record',
                   'selectedReleaseId': selected_release,
                   'releaseId': '', 'sources': sources, 'createdAt': now(), 'updatedAt': now(), 'leaseUntil': 0}
            registry['jobs'][ident] = job; registry['latest'][rid] = ident
            self._write_twins(db, registry, job); self.audit(db, '请求生成数字实体', {'id': rid, 'taskId': ident, 'skill': SKILL_VERSION})
            return {'epoch': registry['epoch'], 'revision': registry['revision'], 'job': self._public_twin(job, record, db=db)}

    def claim_twin(self, owner, stamp=None):
        stamp = time.time() if stamp is None else stamp
        # 插件 worker 每 2 秒轮询一次；无排队/运行任务时只读返回，不占写锁。
        with closing(self.connect()) as db:
            registry = self.meta_get(db, TWIN_KEY)
        if not registry or not any(j['status'] in ('queued', 'running') for j in registry['jobs'].values()):
            return None
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); registry = self.meta_get(db, TWIN_KEY)
            if not registry: return None
            try: self.require_module('showcase', db)
            except ValidationError: return None
            changed = False
            for job in registry['jobs'].values():
                if job['status'] == 'running' and job.get('leaseUntil', 0) <= stamp:
                    job.update(status='interrupted', error='生成服务中断，结果未发布；请手动重试', leaseUntil=0)
                    job.pop('claim', None); job['seq'] += 1; changed = True
            selected = next((j for j in registry['jobs'].values() if j['status'] == 'queued'), None)
            if selected:
                record = self.get(db, 'records', selected['recordId'])
                if not same_appearance(record, selected['input']): selected.update(status='stale', error='生成前副本资料已变化')
                elif selected.get('workflow') != 'confirmed-release': selected.update(status='interrupted', error='旧条码识别任务已停用，请从专辑编辑页面确认发行版后重新生成')
                else: selected.update(status='running', owner=owner, claim=uid(), leaseUntil=stamp + 90)
                self._write_twins(db, registry, selected)
                return selected if selected['status'] == 'running' else None
            if changed: self._write_twins(db, registry)
            return None

    def heartbeat_twin(self, ident, claim, stamp=None):
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); registry = self._twins(db); job = registry['jobs'].get(ident)
            if not job or job['status'] != 'running' or job.get('claim') != claim: return False
            job['leaseUntil'] = (time.time() if stamp is None else stamp) + 90
            # Heartbeats do not change the public version or emit fake progress.
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (TWIN_KEY, dumps(registry)))
            return True

    def update_twin(self, ident, claim, **patch):
        allowed = {'phase', 'message', 'status', 'error', 'candidates', 'entity', 'barcode', 'barcodeSource', 'releaseData', 'artData', 'releaseId', 'confirmedRelease', 'confirmedCatalog'}
        if set(patch) - allowed: raise ValidationError('生成任务更新字段无效')
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); registry = self._twins(db); job = registry['jobs'].get(ident)
            if not job or job['status'] != 'running' or job.get('claim') != claim: return False
            if patch.get('status') == 'succeeded':
                self.require_module('showcase', db); record = self.get(db, 'records', job['recordId'])
                if not same_appearance(record, job['input']): patch = {'status': 'stale', 'error': '生成期间副本资料已修改，旧结果未发布'}
                else:
                    from server.album_engine_adapter import prepare_publication
                    patch['entity'] = prepare_publication(patch['entity'], ident, record['title'], context='generation')
                    folder = self._twin_folder(ident)
                    if not all((folder / name).is_file() for name in entity_assets(patch['entity'])):
                        raise ValidationError('生成资源不完整，结果未发布')
                    provider = getattr(self, 'model_snapshot_provider', None)
                    if provider: self._pin_twin_models(db, ident, provider())
                    self.audit(db, '完成数字实体', {'id': job['recordId'], 'taskId': ident})
            job.update(patch)
            if job['status'] != 'running': job.pop('claim', None); job['leaseUntil'] = 0
            self._write_twins(db, registry, job); return True

    def cancel_twin(self, ident):
        if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident): raise ValidationError('生成任务编号无效')
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); self.require_module('showcase', db); registry = self._twins(db)
            job = registry['jobs'].get(ident)
            if not job: raise ValidationError('生成任务不存在')
            if job['status'] in ('queued', 'running', 'needs_input'):
                job.update(status='cancelled', error='', message='已取消生成', leaseUntil=0); job.pop('claim', None)
                self._write_twins(db, registry, job)
            return {'epoch': registry['epoch'], 'revision': registry['revision'], 'job': self._public_twin(job, db=db)}

    def set_twin_accessories(self, ident, selected, downloaded):
        """Publish replacement accessory list while preserving existing main surfaces."""
        from twins import clean_accessories
        if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident):
            raise ValidationError('附件所属数字实体无效')
        sources = {sid:meta for sid,(meta,raw) in downloaded.items()}
        parts = clean_accessories(selected, sources)
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); self.require_module('showcase', db)
            registry = self._twins(db)
            job = registry['jobs'].get(ident)
            if not job or job['status'] != 'succeeded' or registry['latest'].get(job['recordId']) != ident:
                raise ConflictError('数字实体已更新，附件编辑没有保存')
            record = self.get(db,'records',job['recordId'])
            if not same_appearance(record, job['input']):
                raise ConflictError('实体对应的实物资料已发生变化')
            from twins import image_type
            folder = self._twin_folder(ident)
            for source,(meta,raw) in downloaded.items():
                name = meta['asset']
                if not TWIN_ASSET.fullmatch(name) or len(raw)>24*1024*1024:
                    raise ValidationError('附件图片无效或过大')
                image_type(raw)
                path = folder/name
                if not path.is_file():
                    temp = path.with_suffix('.tmp'); temp.write_bytes(raw); temp.replace(path)
            if parts: job['entity']['components'] = parts
            else: job['entity'].pop('components',None)
            from server.album_engine_adapter import prepare_publication
            job['entity'] = prepare_publication(job['entity'], ident, record['title'], context='update')
            if not all((folder/name).is_file() for name in entity_assets(job['entity'])):
                raise ValidationError('附件图片写入失败，实体未修改')
            self._write_twins(db,registry,job)
            self.audit(db,'更新数字实体附件',{'id':job['recordId'],'taskId':ident,'count':len(parts)})
            return {'epoch':registry['epoch'],'revision':registry['revision'],
                    'job':self._public_twin(job,record,db=db)}

    def set_twin_disc_calibration(self, body):
        from twins import clean_disc_calibration
        if not isinstance(body, dict): raise ValidationError('盘面校准请求无效')
        ident, role = body.get('id'), body.get('role')
        if not isinstance(ident, str) or not TWIN_ID.fullmatch(ident) or role not in ('disc', 'disc2', 'disc3', 'disc4'):
            raise ValidationError('数字实体或盘面编号无效')
        value = body.get('calibration')
        calibration = None if value is None else clean_disc_calibration(value)
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); self.require_module('showcase', db)
            registry = self._twins(db)
            job = registry['jobs'].get(ident)
            if not job or job['status'] != 'succeeded' or registry['latest'].get(job['recordId']) != ident:
                raise ValidationError('只能校准已生成且当前有效的数字实体')
            record = self.get(db, 'records', job['recordId'])
            if not same_appearance(record, job['input']): raise ValidationError('数字实体资料已发生变化')
            surface = (job.get('entity') or {}).get('surfaces', {}).get(role)
            if not isinstance(surface, dict) or not surface.get('asset'):
                raise ValidationError('当前光盘没有可校准的原始贴图')
            if calibration is None: surface.pop('discCalibration', None)
            else: surface['discCalibration'] = calibration
            from server.album_engine_adapter import prepare_publication
            job['entity'] = prepare_publication(job['entity'], ident, record['title'], context='update')
            self._write_twins(db, registry, job)
            self.audit(db, '校准数字实体盘面', {'id': job['recordId'], 'taskId': ident, 'role': role})
            return {'epoch': registry['epoch'], 'revision': registry['revision'], 'job': self._public_twin(job, record, db=db)}

    def twin_source(self, ident, name):
        if not isinstance(name, str) or not TWIN_ASSET.fullmatch(name): raise ValidationError('数字实体资源名无效')
        path = self._twin_folder(ident) / name
        if not path.is_file(): raise ValidationError('数字实体资源不存在')
        return path

    def write_twin_source(self, ident, claim, name, raw):
        if not isinstance(name, str) or not TWIN_ASSET.fullmatch(name) or len(raw) > 24 * 1024 * 1024:
            raise ValidationError('数字实体图片过大或文件名无效')
        image_type(raw)
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE'); registry = self._twins(db); job = registry['jobs'].get(ident)
            if not job or job['status'] != 'running' or job.get('claim') != claim: raise ConflictError('生成任务已停止')
            path = self._twin_folder(ident) / name
            temp = path.with_suffix('.tmp'); temp.write_bytes(raw); temp.replace(path)
        return path

    def published_twin_asset(self, ident, name):
        with closing(self.connect()) as db:
            registry = self._twins(db); job = registry['jobs'].get(ident)
            if not job or job['status'] != 'succeeded' or name not in entity_assets(job['entity']):
                raise ValidationError('数字实体资源尚未发布')
        return self.twin_source(ident, name)

    def review_twin_asset(self, ident, name):
        with closing(self.connect()) as db:
            registry = self._twins(db); job = registry['jobs'].get(ident)
            if not job or not any(name == image.get('previewAsset') for candidate in job.get('candidates', [])
                                  for image in candidate.get('artwork', [])):
                raise ValidationError('发行资料预览不存在')
        return self.twin_source(ident, name)

    # ── 艺人身份绑定与副本-作品关联（meta 持久化；调用方先完成外部核验，
    #    这里在单事务内重读当前值并校验预期，竞争失败抛 ConflictError → 409）──
    def artist_identities(self):
        with closing(self.connect()) as db, db:
            return self.meta_get(db, 'artist-identities-v1') or {}

    def bind_artist_identity(self, artist, mbid, source_name, method, expected_mbid):
        """保存确认过的 MusicBrainz 艺人身份；expected_mbid 为调用方读到的当前绑定（未绑定为 None）。"""
        if not isinstance(artist, str) or not 1 <= len(artist.strip()) <= 500: raise ValidationError('艺人名不正确')
        artist = artist.strip()
        if not isinstance(mbid, str) or not MBID_RE.match(mbid): raise ValidationError('艺人编号不正确')
        if method not in IDENTITY_METHODS: raise ValidationError('绑定方式不正确')
        if not isinstance(source_name, str) or not 1 <= len(source_name.strip()) <= 500: raise ValidationError('资料名称不正确')
        source_name = source_name.strip()
        if expected_mbid is not None and (not isinstance(expected_mbid, str) or not MBID_RE.match(expected_mbid)):
            raise ValidationError('预期绑定不正确')
        with closing(self.connect()) as db, db:
            identities = self.meta_get(db, 'artist-identities-v1') or {}
            current = identities.get(artist)
            current_mbid = current.get('artistMbid') if isinstance(current, dict) else None
            if current_mbid != expected_mbid: raise ConflictError('当前绑定已被修改，请刷新后重新确认')
            identities[artist] = {'artistMbid': mbid, 'sourceName': source_name,
                                  'method': method, 'confirmedAt': now()}
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('artist-identities-v1', dumps(identities)))
            self.audit(db, '更换艺人' if current_mbid and current_mbid != mbid else '确认艺人',
                       {'artist': artist, 'artistMbid': mbid, 'method': method})
        return identities[artist]

    def record_work_links(self):
        with closing(self.connect()) as db, db:
            return self.meta_get(db, 'record-work-links-v1') or {}

    def link_record_work(self, record_id, artist_mbid, rg_mbid, expected_rg, record_artist, record_title):
        """把一张实物副本关联到一个作品（release-group）；快照与预期不符时拒绝。"""
        if not isinstance(record_id, str) or not RECORD_ID_RE.match(record_id): raise ValidationError('记录编号不正确')
        if not isinstance(artist_mbid, str) or not MBID_RE.match(artist_mbid): raise ValidationError('艺人编号不正确')
        if not isinstance(rg_mbid, str) or not MBID_RE.match(rg_mbid): raise ValidationError('作品编号不正确')
        if expected_rg is not None and (not isinstance(expected_rg, str) or not MBID_RE.match(expected_rg)):
            raise ValidationError('预期关联不正确')
        for value, label in ((record_artist, '副本艺人'), (record_title, '副本标题')):
            if not isinstance(value, str) or not 1 <= len(value.strip()) <= 500: raise ValidationError(label + '不正确')
        record_artist, record_title = record_artist.strip(), record_title.strip()
        with closing(self.connect()) as db, db:
            r = self.get(db, 'records', record_id)  # 记录必须存在；同时读取快照核对
            if r['artist'] != record_artist or r['title'] != record_title:
                raise ConflictError('这张副本刚被修改，请刷新后重新关联')
            links = self.meta_get(db, 'record-work-links-v1') or {}
            current = links.get(record_id)
            current_rg = current.get('releaseGroupMbid') if isinstance(current, dict) else None
            if current_rg != expected_rg: raise ConflictError('关联已被修改，请刷新后重试')
            links[record_id] = {'artistMbid': artist_mbid, 'releaseGroupMbid': rg_mbid,
                                'recordArtist': record_artist, 'recordTitle': record_title,
                                'method': 'manual', 'confirmedAt': now()}
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('record-work-links-v1', dumps(links)))
            self.audit(db, '关联作品', {'recordId': record_id, 'releaseGroupMbid': rg_mbid})
        return links[record_id]

    def unlink_record_work(self, record_id, expected_rg):
        """只删除该条关联，不动副本本身；预期不符拒绝。"""
        if not isinstance(record_id, str) or not RECORD_ID_RE.match(record_id): raise ValidationError('记录编号不正确')
        if not isinstance(expected_rg, str) or not MBID_RE.match(expected_rg): raise ValidationError('预期关联不正确')
        with closing(self.connect()) as db, db:
            links = self.meta_get(db, 'record-work-links-v1') or {}
            current = links.get(record_id)
            current_rg = current.get('releaseGroupMbid') if isinstance(current, dict) else None
            if current_rg != expected_rg: raise ConflictError('关联已被修改，请刷新后重试')
            links.pop(record_id, None)
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('record-work-links-v1', dumps(links)))
            self.audit(db, '取消作品关联', {'recordId': record_id, 'releaseGroupMbid': expected_rg})
        return {'ok': True}
