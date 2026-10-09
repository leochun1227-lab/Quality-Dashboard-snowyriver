"""Install a self-contained PDV updater inside Warranty; migrate the existing hook."""
import argparse
import hashlib
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent
BATCH='run_daily_5pm_mandt800_rejection_filter.bat'
BEGIN='rem BEGIN OZZ PDV DASHBOARD'
END='rem END OZZ PDV DASHBOARD'
FILES=('refresh.py','pdv_scope.py','claim_trend_page.py')
HOOK='''rem BEGIN OZZ PDV DASHBOARD
rem Run only after the existing warranty refresh and publication checks succeed.
if "%ERR%"=="0" (
  echo Refreshing standalone Pre Delivery dashboard...>> "%LOG_FILE%"
  call "%~dp0run_pdv_dashboard_update.bat" >> "%LOG_FILE%" 2>&1
  if errorlevel 1 set "ERR=1"
)
rem END OZZ PDV DASHBOARD'''
LAUNCHER=r'''@echo off
setlocal
rem All paths are relative to this Warranty folder, including on Planning.
if not exist "%~dp0pdv_dashboard\refresh.py" (
  echo ERROR: PDV updater missing: "%~dp0pdv_dashboard\refresh.py"
  exit /b 1
)
for %%F in (pdv_scope.py claim_trend_page.py) do (
  if not exist "%~dp0pdv_dashboard\%%F" (
    echo ERROR: PDV companion file missing: "%~dp0pdv_dashboard\%%F"
    exit /b 1
  )
)
if not defined PYTHON_CMD (
  python --version >nul 2>&1
  if errorlevel 1 (
    py -3 --version >nul 2>&1
    if errorlevel 1 (
      echo ERROR: Python is not available for the PDV updater.
      exit /b 1
    )
    set "PYTHON_CMD=py -3"
  ) else (
    set "PYTHON_CMD=python"
  )
)
if "%PYTHON_CMD%"=="py -3" (
  py -3 "%~dp0pdv_dashboard\refresh.py" --warranty-root "%~dp0." --publish-only %*
) else (
  "%PYTHON_CMD%" "%~dp0pdv_dashboard\refresh.py" --warranty-root "%~dp0." --publish-only %*
)
exit /b %ERRORLEVEL%
'''

def update_hook(text):
    text=text.replace('\r\n','\n')
    if BEGIN in text or END in text:
        if text.count(BEGIN)!=1 or text.count(END)!=1 or text.index(END)<text.index(BEGIN):
            raise ValueError('Unexpected PDV markers; daily batch was not changed')
        return text[:text.index(BEGIN)]+HOOK+text[text.index(END)+len(END):]
    anchor='echo CTM V44 daily 5:00 PM run finished'
    if text.count(anchor)!=1 or 'set "ERR=%ERRORLEVEL%"' not in text:
        raise ValueError('Unexpected daily script structure; daily batch was not changed')
    return text.replace(anchor,HOOK+'\n\n'+anchor)

def write_text(path,text):
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_bytes(text.replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
    temp.replace(path)

def install(warranty):
    warranty=Path(warranty).resolve()
    target=warranty/BATCH
    original=target.read_bytes()
    updated=update_hook(original.decode('utf-8-sig'))
    for name in FILES:
        if not (ROOT/name).is_file():raise ValueError('Installer companion file missing: '+name)
    bundle=warranty/'pdv_dashboard'
    bundle.mkdir(exist_ok=True)
    for name in FILES:
        if (ROOT/name).resolve()!=(bundle/name).resolve():
            temp=bundle/(name+'.tmp');shutil.copyfile(ROOT/name,temp);temp.replace(bundle/name)
        if (ROOT/name).read_bytes()!=(bundle/name).read_bytes():raise ValueError('Copy verification failed: '+name)
    write_text(bundle/'.gitignore','.cache/\n__pycache__/\n*.pyc\n')
    backup=bundle/'backups'
    backup.mkdir(exist_ok=True)
    write_text(backup/'.gitignore','*\n!.gitignore\n')
    stamp=hashlib.sha256(original).hexdigest()[:12]
    destination=backup/(BATCH+'.'+stamp+'.bak')
    if not destination.exists():destination.write_bytes(original)
    write_text(warranty/'run_pdv_dashboard_update.bat',LAUNCHER)
    write_text(target,updated)
    print('PASS: Portable PDV updater installed in '+str(bundle))
    print('PASS: Warranty daily hook uses its own folder; no ozz-dashboard sibling required')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--warranty-root',type=Path)
    args=parser.parse_args()
    root=args.warranty_root or (ROOT.parent if (ROOT.parent/BATCH).is_file() else ROOT.parent/'warranty')
    try:install(root)
    except Exception as exc:parser.exit(1,'ERROR: '+str(exc)+'\n')
