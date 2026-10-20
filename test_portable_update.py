import contextlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile
from unittest.mock import patch
import install_daily_hook as installer
import refresh

class PortableUpdateTest(unittest.TestCase):
    def prepare(self,root):
        root.mkdir(parents=True)
        (root/installer.BATCH).write_text('@echo off\nset "ERR=%ERRORLEVEL%"\necho CTM V44 daily 5:00 PM run finished\n',encoding='utf-8')
        (root/'firebase-service-account.json').write_text('{}')
        (root/'issue_subcategories.json').write_text('{"categories":{}}')
        with contextlib.redirect_stdout(io.StringIO()):installer.install(root)

    def check(self,root,cwd):
        env={**os.environ,'PYTHON_CMD':sys.executable,'PYTHONIOENCODING':'utf-8'}
        return subprocess.run(['cmd.exe','/d','/c',str(root/'run_pdv_dashboard_update.bat'),'--check'],
                              cwd=cwd,env=env,capture_output=True,encoding='utf-8',timeout=30)

    def test_relocated_bundle_from_unrelated_working_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);original=base/'initial'
            self.prepare(original)
            relocated=base/'Planning 电脑 (Daily Update)'
            original.rename(relocated)
            result=self.check(relocated,base)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertIn('PASS: PDV local paths',result.stdout)
            self.assertIn(str(relocated),result.stdout)
            self.assertFalse((relocated/'pdv_dashboard'/'public').exists())
            self.assertFalse((relocated/'pdv_dashboard'/'.cache').exists())
            with patch.object(refresh,'ROOT',relocated/'pdv_dashboard'):
                self.assertEqual(refresh.resolve_warranty_root(),relocated.resolve())

    def test_missing_files_fail_before_network(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);root=base/'Planning warranty'
            self.prepare(root)
            (root/'issue_subcategories.json').unlink()
            result=self.check(root,base)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Missing Warranty files',result.stderr)
            (root/'pdv_dashboard'/'pdv_scope.py').unlink()
            result=self.check(root,base)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('companion file missing',result.stdout)

    def test_hook_migration_and_repeat_install_preserve_rest(self):
        old='prefix\n'+installer.BEGIN+'\nold absolute or sibling command\n'+installer.END+'\nsuffix\n'
        new=installer.update_hook(old)
        self.assertEqual(installer.update_hook(new),new)
        self.assertTrue(new.startswith('prefix\n'))
        self.assertTrue(new.endswith('\nsuffix\n'))
        self.assertNotIn('ozz-dashboard',new)
        self.assertEqual(new.count(installer.BEGIN),1)
        with self.assertRaises(ValueError):installer.update_hook(installer.BEGIN)

    def test_planning_zip_installs_without_sibling_project(self):
        package=Path(__file__).parent/'dist'/'pdv-planning-update.zip'
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);root=base/'Planning Warranty (5pm)';root.mkdir()
            (root/installer.BATCH).write_text('@echo off\nset "ERR=%ERRORLEVEL%"\necho CTM V44 daily 5:00 PM run finished\n')
            (root/'firebase-service-account.json').write_text('{}')
            (root/'issue_subcategories.json').write_text('{"categories":{}}')
            with ZipFile(package) as archive:
                self.assertEqual(set(archive.namelist()),{'pdv_update_install/'+name for name in (
                    'refresh.py','pdv_scope.py','claim_trend_page.py','claim_trend_snapshot.py',
                    'install_daily_hook.py','install_on_planning.cmd','README.txt')})
                self.assertTrue(all(name.startswith('pdv_update_install/') and '..' not in Path(name).parts for name in archive.namelist()))
                archive.extractall(root)
            result=subprocess.run(['cmd.exe','/d','/c',str(root/'pdv_update_install'/'install_on_planning.cmd')],
                cwd=base,input='\n',capture_output=True,encoding='utf-8',env={**os.environ,'PYTHONIOENCODING':'utf-8'},timeout=30)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertIn('Installed and local checks passed',result.stdout)
            self.assertEqual((root/installer.BATCH).read_text().count(installer.BEGIN),1)

if __name__=='__main__':unittest.main()
