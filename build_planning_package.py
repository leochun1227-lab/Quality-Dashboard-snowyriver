"""Build a credentials-free installer to apply inside Planning's Warranty folder."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from install_daily_hook import FILES
ROOT=Path(__file__).resolve().parent
INSTALL=r'''@echo off
setlocal
if not exist "%~dp0..\run_daily_5pm_mandt800_rejection_filter.bat" (
  echo ERROR: Extract pdv_update_install INSIDE your existing Warranty folder.
  pause
  exit /b 1
)
set "PYTHON_CMD=python"
python --version >nul 2>&1
if errorlevel 1 (
  py -3 --version >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python was not found. Use the Python environment that runs Warranty.
    pause
    exit /b 1
  )
  set "PYTHON_CMD=py -3"
)
if "%PYTHON_CMD%"=="py -3" (
  py -3 "%~dp0install_daily_hook.py" --warranty-root "%~dp0.."
) else (
  "%PYTHON_CMD%" "%~dp0install_daily_hook.py" --warranty-root "%~dp0.."
)
if errorlevel 1 (
  echo ERROR: Installation failed. Review the message above.
  pause
  exit /b 1
)
call "%~dp0..\run_pdv_dashboard_update.bat" --check
if errorlevel 1 (
  echo ERROR: Files installed, but local checks failed. Fix the error before the next daily run.
  pause
  exit /b 1
)
echo PASS: Installed and local checks passed. No scheduled task was changed.
echo Firebase access is tested only when the normal daily update runs.
pause
exit /b 0
'''
README='''Planning 安装方法

1. 找到 Planning 每晚 5 点实际运行的 Warranty 文件夹。
2. 将压缩包里的 pdv_update_install 文件夹解压到该 Warranty 文件夹内。
   Warranty 文件夹中应同时有：
   run_daily_5pm_mandt800_rejection_filter.bat
   pdv_update_install\\install_on_planning.cmd
3. 双击 install_on_planning.cmd。看到 Installed and local checks passed 才算本地检查通过。

安装程序会保留原批处理备份，并更新其中 PDV 接入部分。
新脚本放在 Warranty 内的 pdv_dashboard 文件夹，不需要另一个 ozz-dashboard 文件夹。
使用 Warranty 现有的 Python、Firebase 凭据及分类文件；安装包不包含这些凭据或业务数据。
程序按自身位置找文件，不依赖用户名、盘符或任务的起始目录。
不会修改或启用 Windows 定时任务，不会在安装时抓数或写 Firebase。
晚间正常 Warranty 更新成功后，会自动接着发布独立 PDV 网页的数据。
检查网络及 Firebase 权限是否成功，需要查看首次实际更新日志：
logs\\ctm_daily_5pm_YYYYMMDD.log
成功信息为 PASS: Firebase dashboard publication verified。
'''

def build():
    output=ROOT/'dist'/'pdv-planning-update.zip'
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output,'w',ZIP_DEFLATED) as archive:
        for name in (*FILES,'install_daily_hook.py'):
            archive.write(ROOT/name,'pdv_update_install/'+name)
        archive.writestr('pdv_update_install/install_on_planning.cmd',INSTALL.replace('\n','\r\n'))
        archive.writestr('pdv_update_install/README.txt',README.encode('utf-8-sig'))
    print(output)
    return output
if __name__=='__main__':build()
