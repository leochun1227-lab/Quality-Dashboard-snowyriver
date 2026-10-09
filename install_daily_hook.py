"""Attach this site to the existing 5pm batch file, idempotently."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
target=ROOT.parent/'warranty'/'run_daily_5pm_mandt800_rejection_filter.bat'
marker='rem BEGIN OZZ PDV DASHBOARD'
original=target.read_bytes()
text=original.decode('utf-8-sig').replace('\r\n','\n')
hook='''rem BEGIN OZZ PDV DASHBOARD
rem Run only after the existing warranty refresh and publication checks succeed.
if "%ERR%"=="0" (
  echo Refreshing standalone Pre Delivery dashboard...>> "%LOG_FILE%"
  if "%PYTHON_CMD%"=="py -3" (
    py -3 "%~dp0..\\ozz-dashboard\\refresh.py" --warranty-root "%~dp0." >> "%LOG_FILE%" 2>&1
  ) else (
    "%PYTHON_CMD%" "%~dp0..\\ozz-dashboard\\refresh.py" --warranty-root "%~dp0." >> "%LOG_FILE%" 2>&1
  )
  if errorlevel 1 set "ERR=1"
)
rem END OZZ PDV DASHBOARD

'''
if marker in text:
    print('PASS: PDV dashboard hook already installed')
else:
    anchor='echo CTM V44 daily 5:00 PM run finished'
    if text.count(anchor)!=1 or 'set "ERR=%ERRORLEVEL%"' not in text:
        raise SystemExit('Unexpected daily script structure; no files changed')
    backup=ROOT/'.cache'/'integration'/'run_daily_5pm.original.bat'
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():backup.write_bytes(original)
    updated=text.replace(anchor,hook+anchor)
    target.write_bytes(updated.replace('\n','\r\n').encode('utf-8'))
    if marker not in target.read_text():raise SystemExit('Hook verification failed')
    print('PASS: existing 5pm batch now refreshes standalone PDV site after success')
    print('Original saved to '+str(backup))
