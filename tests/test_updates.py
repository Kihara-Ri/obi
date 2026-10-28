import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from tools import update_release as updater
from storage import Store


def release(tag, **flags):
    return {'tag_name': tag, 'draft': False, 'prerelease': False, **flags,
            'assets': [{'name': name,
                        'browser_download_url': f'https://github.com/example/ledger/releases/download/{tag}/{name}'}
                       for name in (updater.PACKAGE, updater.CHECKSUM)]}


def package(version, extra=None):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        for name in ('VERSION', 'app.py', 'rates.py', 'tools/deploy.sh', 'tools/update_release.py',
                     'deploy.toml', '.ai-kit/ship/ship.py'):
            data = version.encode() if name == 'VERSION' else b'# application fixture\n'
            info = tarfile.TarInfo(name); info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        if extra:
            archive.addfile(extra, io.BytesIO(b'') if extra.isfile() else None)
    return output.getvalue()


class UpdateTests(unittest.TestCase):
    def test_only_newer_stable_patch_in_current_series_is_selected(self):
        releases = [release('v3.0.0'), release('v2.2.0'), release('v2.1.2'),
                    release('v2.1.9', draft=True), release('v2.1.8', prerelease=True),
                    release('v2.1.3'), release('v2.1.3-rc1'), release('v2.1.0')]
        self.assertEqual(updater.choose_patch(releases, 'v2.1.1')['tag_name'], 'v2.1.3')
        self.assertIsNone(updater.choose_patch(releases[:2], 'v2.1.1'))
        self.assertIsNone(updater.choose_patch([release('v2.1.0')], 'v2.1.1'))
        with self.assertRaises(ValueError):updater.choose_patch(releases, 'dev')

    def test_build_numbers_compare_by_their_base_release(self):
        releases = [release('v2.1.3'), release('v2.1.1'), release('v2.2.0')]
        self.assertEqual(updater.choose_patch(releases, 'v2.1.1-4-gabc1234')['tag_name'], 'v2.1.3')
        self.assertEqual(updater.choose_patch(releases, 'v2.1.1-4-gabc1234-dirty')['tag_name'], 'v2.1.3')
        # 已在 v2.1.3 之后的构建不会被「降级」回 v2.1.3
        self.assertIsNone(updater.choose_patch(releases, 'v2.1.3-2-gdef5678'))
        for bad in ('abc1234', 'v2.1.1-rc1', 'v2.1.1-4-gXYZ'):
            with self.assertRaises(ValueError):updater.choose_patch(releases, bad)

    def test_package_roots_cover_every_packaged_root_module(self):
        # package_app.manifest() 打包的每个顶层条目（根级 .py 与目录）都必须在 PACKAGE_ROOTS 里，
        # 否则旧校验器会拒收新包、自动补丁更新一直失败（v2.4.2 实际发生过；I-009）。
        import importlib.util
        spec = importlib.util.spec_from_file_location('package_app', Path(updater.__file__).resolve().parent / 'package_app.py')
        package_app = importlib.util.module_from_spec(spec); spec.loader.exec_module(package_app)
        root = package_app.root
        tops = {path.relative_to(root).parts[0] for path in package_app.manifest()}
        self.assertTrue({'app.py', 'musicbrainz.py', 'vendor', 'plugins'} <= tops)
        self.assertLessEqual(tops, updater.PACKAGE_ROOTS)

    def test_missing_or_foreign_assets_are_rejected(self):
        item = release('v2.1.2'); item['assets'].pop()
        with self.assertRaises(ValueError):updater.asset_url(item, 'example/ledger', updater.CHECKSUM)
        item = release('v2.1.2'); item['assets'][0]['browser_download_url'] = 'https://example.test/payload'
        with self.assertRaises(ValueError):updater.asset_url(item, 'example/ledger', updater.PACKAGE)

    def test_archive_rejects_private_paths_traversal_and_links(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / updater.PACKAGE
            for name, kind in [('data/albums.sqlite3', tarfile.REGTYPE),
                               ('../service.env', tarfile.REGTYPE),
                               ('/app.py', tarfile.REGTYPE),
                               ('static/link', tarfile.SYMTYPE),
                               ('tools/link', tarfile.LNKTYPE)]:
                with self.subTest(name=name):
                    extra=tarfile.TarInfo(name);extra.type=kind;extra.linkname='/tmp/target'
                    path.write_bytes(package('v2.1.2', extra))
                    with self.assertRaises(ValueError):updater.validate_package(path, 'v2.1.2')
            path.write_bytes(package('v2.1.1'))
            with self.assertRaises(ValueError):updater.validate_package(path, 'v2.1.2')

    def test_bad_checksum_leaves_service_and_installed_version_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);(base/'current').mkdir();(base/'current'/'VERSION').write_text('v2.1.1')
            responses=[json.dumps([release('v2.1.2')]).encode(),
                       ('0'*64+'  '+updater.PACKAGE).encode(), package('v2.1.2')]
            with patch.object(updater,'download',side_effect=responses), patch.object(updater.subprocess,'run') as run:
                with self.assertRaises(ValueError):updater.install_patch(base,'example/ledger','obi',8765)
                run.assert_not_called()
            self.assertEqual((base/'current'/'VERSION').read_text(),'v2.1.1')

    def test_verified_patch_uses_existing_deploy_pipeline_and_expected_version(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);(base/'current').mkdir();(base/'current'/'VERSION').write_text('v2.1.1')
            raw=package('v2.1.2');digest=hashlib.sha256(raw).hexdigest()
            responses=[json.dumps([release('v2.1.2')]).encode(),
                       (digest+'  '+updater.PACKAGE).encode(),raw]
            def deploy(command, **kwargs):
                self.assertEqual(command,['bash',str(base/'current'/'tools'/'deploy.sh')])
                env=kwargs['env']
                self.assertEqual(env['EXPECTED_VERSION'],'v2.1.2')
                self.assertEqual(env['EXPECTED_PREVIOUS_VERSION'],'v2.1.1')
                self.assertEqual(env['EXPECTED_SHA256'],digest)
                self.assertEqual(env['DEPLOY_HOST'],'local')
                self.assertEqual(Path(env['PACKAGE_PATH']).read_bytes(),raw)
                return subprocess.CompletedProcess(command,0)
            with patch.object(updater,'download',side_effect=responses), patch.object(updater.subprocess,'run',side_effect=deploy) as run:
                self.assertTrue(updater.install_patch(base,'example/ledger','obi',8765))
                self.assertEqual(run.call_count,1)

    def test_check_does_not_download_or_deploy(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);(base/'current').mkdir();(base/'current'/'VERSION').write_text('v2.1.1')
            with patch.object(updater,'download',return_value=json.dumps([release('v2.1.2')]).encode()) as download, patch.object(updater.subprocess,'run') as run:
                self.assertTrue(updater.install_patch(base,'example/ledger','obi',8765,check=True))
                self.assertEqual(download.call_count,1);run.assert_not_called()


class DeployPipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.base=Path(self.tmp.name)/'instance';old=self.base/'releases'/'old';old.mkdir(parents=True)
        (old/'VERSION').write_text('v2.1.0');(self.base/'current').symlink_to(old)
        self.database=self.base/'data'/'albums.sqlite3'
        Store(self.database).save({'title':'合成测试CD','artist':'测试艺人'})
        self.original=self.database.read_bytes()
        self.package=Path(self.tmp.name)/updater.PACKAGE;self.package.write_bytes(package('v2.1.1'))
        self.bin=Path(self.tmp.name)/'bin';self.bin.mkdir()
        fixtures={
            'sudo':'#!/bin/sh\n[ "$1" != -n ] || shift\nexec "$@"\n',
            # migrate：新版本一启动就把库结构升到 5（模拟一次性 schema 升级）
            'systemctl':'''#!/bin/sh
printf "%s\\n" "$*" >> "$FIXTURE_LOG"
if [ "$FIXTURE_FAILURE" = migrate ] && [ "$1" = restart ] && grep -q v2.1.1 "$DEPLOY_DIR/current/VERSION"; then
  python3 -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute(\\"INSERT OR REPLACE INTO meta VALUES('schema','5')\\"); c.commit()" "$DEPLOY_DIR/data/albums.sqlite3"
fi
''',
            'sleep':'#!/bin/sh\nexit 0\n',
            'curl':'''#!/usr/bin/env python3
import json,os,pathlib
import sys
v=(pathlib.Path(os.environ['DEPLOY_DIR'])/'current'/'VERSION').read_text()
if os.environ.get('FIXTURE_FAILURE') in ('health','migrate') and v=='v2.1.1' and 'example.test' not in ' '.join(sys.argv):v='wrong-version'
if os.environ.get('FIXTURE_FAILURE')=='public' and 'example.test' in ' '.join(sys.argv):sys.exit(22)
print(json.dumps({'ok':True,'version':v}))
''',
            'cp':'''#!/bin/sh
if [ "$FIXTURE_FAILURE" = backup ]; then
  case "$2" in *pre-deploy-*) exit 1;; esac
fi
exec /bin/cp "$@"
''',
            # Linux's head -n -N is used by the server release cleanup.
            'head':'''#!/usr/bin/env python3
import sys
lines=sys.stdin.readlines();n=int(sys.argv[-1]);sys.stdout.writelines(lines[:n])
''',
        }
        for name,body in fixtures.items():
            path=self.bin/name;path.write_text(body);path.chmod(0o755)
        self.env={**os.environ,'PATH':str(self.bin)+os.pathsep+os.environ['PATH'],
                  'DEPLOY_HOST':'local','DEPLOY_DIR':str(self.base),'SERVICE':'fixture',
                  'PACKAGE_PATH':str(self.package),'EXPECTED_VERSION':'v2.1.1',
                  'EXPECTED_SHA256':hashlib.sha256(self.package.read_bytes()).hexdigest(),
                  'FIXTURE_LOG':str(Path(self.tmp.name)/'service.log'),'FIXTURE_FAILURE':'',
                  'SHIP_LOCAL_CONFIG':str(Path(self.tmp.name)/'no-personal-override.toml')}
        # 服务器本机发布（DEPLOY_HOST=local）会把 SHIP_HOST 等写进环境；fixture 必须从干净配置起步。
        for key in [name for name in self.env if name.startswith('SHIP_')]:
            if key != 'SHIP_LOCAL_CONFIG': del self.env[key]

    def tearDown(self):self.tmp.cleanup()

    def deploy(self, failure='', *args):
        self.env['FIXTURE_FAILURE']=failure
        script=Path(__file__).resolve().parents[1]/'tools'/'deploy.sh'
        return subprocess.run(['bash',str(script),*args],env=self.env,capture_output=True,text=True,timeout=20)

    def assert_preserved(self, version):
        self.assertEqual((self.base/'current'/'VERSION').read_text(),version)
        self.assertEqual(self.database.read_bytes(),self.original)
        self.assertFalse((self.base/'.deploy-lock').exists())

    def test_success_creates_snapshot_and_switches_to_expected_version(self):
        result=self.deploy();self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        snapshots=list((self.base/'data').glob('pre-deploy-*.sqlite3'))
        self.assertEqual(len(snapshots),1);self.assertEqual(snapshots[0].read_bytes(),self.original)
        self.assert_preserved('v2.1.1')

    def test_wrong_health_version_rolls_back(self):
        result=self.deploy('health');self.assertNotEqual(result.returncode,0)
        self.assertIn('已回滚',result.stdout+result.stderr);self.assert_preserved('v2.1.0')

    def test_snapshot_failure_restarts_previous_service_without_switching(self):
        result=self.deploy('backup');self.assertNotEqual(result.returncode,0)
        self.assertIn('快照失败',result.stdout+result.stderr);self.assert_preserved('v2.1.0')
        self.assertIn('restart fixture',(Path(self.tmp.name)/'service.log').read_text())

    def test_concurrent_manual_upgrade_is_not_overwritten(self):
        self.env['EXPECTED_PREVIOUS_VERSION']='v2.0.0'
        result=self.deploy();self.assertNotEqual(result.returncode,0)
        self.assertIn('运行版本已变更',result.stdout+result.stderr);self.assert_preserved('v2.1.0')
        self.assertFalse((Path(self.tmp.name)/'service.log').exists())

    def test_success_keeps_only_recent_snapshots(self):
        data=self.base/'data'
        for i in range(1,8):(data/f'pre-deploy-20260101-0000{i:02d}.sqlite3').write_bytes(b'old')
        self.env['KEEP_SNAPSHOTS']='3'
        result=self.deploy();self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        names=sorted(p.name for p in data.glob('pre-deploy-*.sqlite3'))
        self.assertEqual(len(names),3,names);self.assertEqual(names[:2],['pre-deploy-20260101-000006.sqlite3','pre-deploy-20260101-000007.sqlite3'])
        self.assertTrue(names[2].startswith('pre-deploy-2'))
        self.assert_preserved('v2.1.1')

    def test_success_appends_deploy_log_with_schema_and_snapshot(self):
        result=self.deploy();self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        log=(self.base/'deploy.log').read_text()
        self.assertIn(' OK v2.1.1 prev=v2.1.0 schema=4->4 snapshot=pre-deploy-',log)

    def test_schema_upgrade_failure_restores_database_snapshot(self):
        result=self.deploy('migrate');self.assertNotEqual(result.returncode,0)
        output=result.stdout+result.stderr
        self.assertIn('恢复发布前快照',output);self.assertIn('已回滚',output)
        self.assert_preserved('v2.1.0')   # 库字节与发布前完全一致
        self.assertIn('ROLLBACK from=v2.1.1',(self.base/'deploy.log').read_text())
        self.assertIn('stop fixture',(Path(self.tmp.name)/'service.log').read_text())

    def test_held_lock_reports_owner_and_stale_hint_without_stealing_it(self):
        import time
        lock=self.base/'.deploy-lock';lock.mkdir()
        (lock/'info').write_text(f'{int(time.time())-60} tester@host\n')
        result=self.deploy();self.assertNotEqual(result.returncode,0)
        self.assertIn('已有发布正在执行',result.stdout+result.stderr);self.assertIn('tester@host',result.stdout+result.stderr)
        self.assertNotIn('--unlock',result.stdout+result.stderr)
        (lock/'info').write_text(f'{int(time.time())-7200} tester@host\n')
        result=self.deploy();self.assertNotEqual(result.returncode,0)
        self.assertIn('--unlock',result.stdout+result.stderr)
        self.assertTrue(lock.exists())   # 他人的锁不能被失败的发布顺手删掉
        result=self.deploy('', '--unlock');self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertFalse(lock.exists())

    def test_public_check_failure_reports_exit_3_without_rollback(self):
        self.env['PUBLIC_URL']='https://example.test'
        result=self.deploy('public');self.assertEqual(result.returncode,3,result.stdout+result.stderr)
        self.assertIn('公网检查失败',result.stdout+result.stderr);self.assert_preserved('v2.1.1')
        result=self.deploy('');self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('公网检查通过',result.stdout+result.stderr)

    def test_unknown_flag_is_rejected(self):
        result=self.deploy('', '--nope');self.assertNotEqual(result.returncode,0)
        self.assertIn('未知参数',result.stdout+result.stderr)

    def test_host_and_options_come_from_config_file_when_env_has_none(self):
        config=Path(self.tmp.name)/'deploy.local.toml'
        config.write_text('[server]\nhost = "local"\n\n[data]\nkeep_snapshots = 2\n')
        del self.env['DEPLOY_HOST'];self.env['SHIP_LOCAL_CONFIG']=str(config)
        (self.base/'data'/'pre-deploy-20260101-000001.sqlite3').write_bytes(b'old')
        (self.base/'data'/'pre-deploy-20260101-000002.sqlite3').write_bytes(b'old')
        result=self.deploy();self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(len(list((self.base/'data').glob('pre-deploy-*.sqlite3'))),2)

    def test_dirty_tree_aborts_before_building(self):
        repo=Path(self.tmp.name)/'repo';(repo/'tools').mkdir(parents=True)
        source=Path(__file__).resolve().parents[1]
        script=repo/'tools'/'deploy.sh'
        for name in ('tools/deploy.sh','deploy.toml','.ai-kit/ship/ship.py'):
            (repo/name).parent.mkdir(parents=True,exist_ok=True);(repo/name).write_bytes((source/name).read_bytes())
        git=lambda *a:subprocess.run(['git',*a],cwd=repo,check=True,capture_output=True,env={**os.environ,'GIT_AUTHOR_NAME':'t','GIT_AUTHOR_EMAIL':'t@t','GIT_COMMITTER_NAME':'t','GIT_COMMITTER_EMAIL':'t@t'})
        git('init','-q');(repo/'tracked.txt').write_text('a');git('add','.');git('commit','-qm','init')
        (repo/'tracked.txt').write_text('changed')
        env={k:v for k,v in self.env.items() if k not in ('PACKAGE_PATH','EXPECTED_VERSION','EXPECTED_SHA256')}
        result=subprocess.run(['bash',str(script)],env=env,capture_output=True,text=True,timeout=20)
        self.assertNotEqual(result.returncode,0);self.assertIn('未提交的改动',result.stdout+result.stderr)
        self.assertFalse((self.base/'.deploy-lock').exists());self.assertEqual((self.base/'current'/'VERSION').read_text(),'v2.1.0')

