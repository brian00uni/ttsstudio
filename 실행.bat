@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Supertonic3 Local TTS Launcher

set "HOST=127.0.0.1"
set "PORT=3093"
set "CHECK_ONLY="
set "SKIP_UPDATE="
set "SKIP_BOOTSTRAP="
set "SKIP_FFMPEG="
set "AUTO_UPDATE="
set "YES="
set "SETUP_STEP="
set "SETUP_HINT="

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="--check" set "CHECK_ONLY=1"
if /I "%~1"=="--skip-update" set "SKIP_UPDATE=1"
if /I "%~1"=="--skip-bootstrap" set "SKIP_BOOTSTRAP=1"
if /I "%~1"=="--skip-ffmpeg" set "SKIP_FFMPEG=1"
if /I "%~1"=="--auto-update" set "AUTO_UPDATE=1"
if /I "%~1"=="--yes" set "YES=1"
shift
goto parse_args

:after_args
if /I "%SUPERTONIC3_SKIP_UPDATE_CHECK%"=="1" set "SKIP_UPDATE=1"
if /I "%SUPERTONIC3_SKIP_BOOTSTRAP%"=="1" set "SKIP_BOOTSTRAP=1"
if /I "%SUPERTONIC3_SKIP_FFMPEG%"=="1" set "SKIP_FFMPEG=1"
if /I "%SUPERTONIC3_AUTO_UPDATE%"=="1" set "AUTO_UPDATE=1"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] SCRIPT_DIR=%SCRIPT_DIR%
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] ARG0=%~f0
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] CMDCMDLINE=%CMDCMDLINE%

set "ROOT_DIR="
call :find_root "%SCRIPT_DIR%"
if not defined ROOT_DIR call :find_root_from_cmdline
if not defined ROOT_DIR call :find_root "%CD%"

if not defined ROOT_DIR (
  echo [ERROR] Could not find the project root.
  echo.
  echo Put this launcher in, below, or near a folder that contains:
  echo   supertonic3-local-tts
  echo   supertonic3-whisper-subtitles
  echo.
  pause
  exit /b 1
)

set "TTS_DIR=%ROOT_DIR%\supertonic3-local-tts"
set "WHISPER_DIR=%ROOT_DIR%\supertonic3-whisper-subtitles"
set "TTS_VENV=%TTS_DIR%\.venv-win"
set "WHISPER_VENV=%WHISPER_DIR%\.venv-win"
set "PY_TTS=%TTS_VENV%\Scripts\python.exe"
set "PY_WHISPER=%WHISPER_VENV%\Scripts\python.exe"
set "VENV_CREATOR_PY="
if /I not "%SUPERTONIC3_KEEP_OUTPUT_DIR%"=="1" set "SUPERTONIC3_OUTPUT_DIR=%TTS_DIR%\data"

echo ============================================================
echo Supertonic3 Local TTS startup
echo ============================================================
echo Project root : %ROOT_DIR%
echo TTS folder   : %TTS_DIR%
echo Whisper tool : %WHISPER_DIR%
echo Output dir   : %SUPERTONIC3_OUTPUT_DIR%
echo URL          : http://%HOST%:%PORT%
echo.

if defined SKIP_BOOTSTRAP (
  echo [SETUP] Bootstrap skipped by option.
  call :detect_existing_python
) else (
  set "SETUP_STEP=ffmpeg check"
  set "SETUP_HINT=ffmpeg is optional. Run again with --skip-ffmpeg if you only need TTS."
  call :ensure_ffmpeg
  if errorlevel 1 goto setup_failed
  set "SETUP_STEP=TTS virtual environment"
      set "SETUP_HINT=Install Python 3.12 from https://www.python.org/downloads/ (3.10-3.14 supported). The launcher uses py -0p and real python.exe paths only."
  call :ensure_venv "%TTS_DIR%" "%TTS_VENV%" "TTS"
  if errorlevel 1 goto setup_failed
  set "SETUP_STEP=TTS Python packages"
  set "SETUP_HINT=Check internet access and pip. Manual command: ""%PY_TTS%"" -m pip install -r ""%TTS_DIR%\requirements.txt"""
  call :ensure_tts_packages
  if errorlevel 1 goto setup_failed
  if exist "%WHISPER_DIR%\requirements.txt" (
    set "SETUP_STEP=Whisper virtual environment"
    set "SETUP_HINT=Whisper is optional. TTS can run without it, but precise subtitle refinement is limited."
    call :ensure_venv "%WHISPER_DIR%" "%WHISPER_VENV%" "Whisper"
    if errorlevel 1 (
      echo [WARN] Whisper setup skipped. TTS server can still run.
      set "PY_WHISPER="
    ) else (
      if exist "%PY_WHISPER%" (
        "%PY_WHISPER%" -c "import sys" >nul 2>nul
        if errorlevel 1 (
          echo [WARN] Whisper Python is not usable. Whisper setup skipped.
          set "PY_WHISPER="
        ) else (
          set "SETUP_STEP=Whisper Python packages"
          set "SETUP_HINT=Check internet access and pip. Manual command: ""%PY_WHISPER%"" -m pip install -r ""%WHISPER_DIR%\requirements.txt"""
          call :ensure_whisper_packages
          if errorlevel 1 (
            echo [WARN] Whisper package setup failed. TTS server can still run.
            set "PY_WHISPER="
          )
        )
      )
    )
  )
)

if not exist "%PY_TTS%" (
  if exist "%TTS_DIR%\.venv\Scripts\python.exe" set "PY_TTS=%TTS_DIR%\.venv\Scripts\python.exe"
)

if not exist "%PY_TTS%" (
  echo [ERROR] TTS Python was not found.
  echo Expected:
  echo   %TTS_VENV%\Scripts\python.exe
  echo.
  pause
  exit /b 1
)

echo.
echo [READY] Python: %PY_TTS%
if defined PY_WHISPER if exist "%PY_WHISPER%" echo [READY] Whisper Python: %PY_WHISPER%
echo.

if not defined SKIP_UPDATE (
  call :check_package "%PY_TTS%" "supertonic" "Supertonic TTS SDK"
  if defined PY_WHISPER (
    if exist "%PY_WHISPER%" (
      call :check_package "%PY_WHISPER%" "faster-whisper" "faster-whisper"
    ) else (
      echo [UPDATE] faster-whisper: no Whisper venv found. Skipped.
    )
  ) else (
    echo [UPDATE] faster-whisper: no Whisper venv found. Skipped.
  )
) else (
  echo [UPDATE] Update check skipped.
)
echo.

if defined CHECK_ONLY (
  call :port_can_bind "%PORT%"
  if defined PORT_BIND_OK (
    echo [OK] Port %PORT% can be opened on %HOST%.
  ) else (
    echo [WARN] Port %PORT% cannot be opened on %HOST%.
    echo [WARN] Windows may have reserved this port, or a security/network tool may be blocking it.
    call :find_free_port 3094
    if errorlevel 1 exit /b 1
    echo [OK] Fallback port available: !PORT!
  )
  echo [OK] Check completed. The server was not started because --check was used.
  exit /b 0
)

set "LISTEN_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "LISTEN_PID=%%P"
)

if defined LISTEN_PID (
  call :check_existing_server "%PORT%"
  if /I "!SERVER_MATCH!"=="1" (
    echo [INFO] A matching server is already listening on port %PORT%. PID=!LISTEN_PID!
    echo [OPEN] http://!HOST!:!PORT!
    start "" "http://!HOST!:!PORT!"
    echo.
    echo Reusing the existing server for this folder.
    pause
    exit /b 0
  )
  echo [WARN] Port %PORT% is already used by another server or another project folder.
  if defined EXISTING_OUTPUT_DIR echo [WARN] Existing output: !EXISTING_OUTPUT_DIR!
  echo [WARN] Current output : %SUPERTONIC3_OUTPUT_DIR%
  call :find_free_port 3094
  if errorlevel 1 goto setup_failed
  echo [INFO] This copy will start on port !PORT! instead.
  echo.
)

call :port_can_bind "%PORT%"
if not defined PORT_BIND_OK (
  echo [WARN] Port %PORT% cannot be opened on %HOST%.
  echo [WARN] Windows may have reserved this port, or a security/network tool may be blocking it.
  call :find_free_port 3094
  if errorlevel 1 goto setup_failed
  echo [INFO] This copy will start on port !PORT! instead.
  echo.
)

set "SUPERTONIC3_HOST=%HOST%"
set "SUPERTONIC3_PORT=%PORT%"
set "SUPERTONIC3_PUBLIC_MODE=0"
if exist "%WHISPER_DIR%\whisper_subtitle_refiner.py" (
  set "SUPERTONIC3_WHISPER_DIR=%WHISPER_DIR%"
)

echo [OPEN] Opening browser...
start "" "http://!HOST!:!PORT!"
echo [RUN] Starting server. Press Ctrl+C in this window to stop it.
echo.

pushd "%TTS_DIR%"
"%PY_TTS%" "src\app.py"
set "APP_EXIT=%ERRORLEVEL%"
popd

echo.
echo [STOP] Server stopped. Exit code: %APP_EXIT%
pause
exit /b %APP_EXIT%

:check_existing_server
set "CHECK_PORT=%~1"
set "SERVER_MATCH="
set "EXISTING_OUTPUT_DIR="
set "EXPECTED_OUTPUT_DIR="
for %%I in ("%SUPERTONIC3_OUTPUT_DIR%") do set "EXPECTED_OUTPUT_DIR=%%~fI"
for /f "usebackq delims=" %%H in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $h = Invoke-RestMethod -Uri 'http://%HOST%:%CHECK_PORT%/health' -TimeoutSec 2; if ($h.output_dir) { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8; Write-Output $h.output_dir } } catch {}"`) do set "EXISTING_OUTPUT_DIR=%%H"
if not defined EXISTING_OUTPUT_DIR exit /b 0
for %%I in ("%EXISTING_OUTPUT_DIR%") do set "EXISTING_OUTPUT_DIR=%%~fI"
if /I "%EXISTING_OUTPUT_DIR%"=="%EXPECTED_OUTPUT_DIR%" set "SERVER_MATCH=1"
exit /b 0

:find_free_port
set "CANDIDATE_PORT=%~1"
if not defined CANDIDATE_PORT set "CANDIDATE_PORT=3094"
set "FOUND_PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip = [Net.IPAddress]::Parse('%HOST%'); $start = [int]'%CANDIDATE_PORT%'; for ($p = $start; $p -le 65535; $p++) { $listener = $null; try { $listener = [Net.Sockets.TcpListener]::new($ip, $p); $listener.Start(); $listener.Stop(); Write-Output $p; break } catch { } finally { if ($listener) { try { $listener.Stop() } catch { } } } }"`) do (
  set "FOUND_PORT=%%P"
)
if defined FOUND_PORT (
  set "PORT=%FOUND_PORT%"
  exit /b 0
)
echo [ERROR] Could not find an accessible local port from %CANDIDATE_PORT% to 65535.
exit /b 1

:port_can_bind
set "PORT_BIND_OK="
set "CHECK_BIND_PORT=%~1"
if not defined CHECK_BIND_PORT exit /b 1
"%PY_TTS%" -c "import socket, sys; host=sys.argv[1]; port=int(sys.argv[2]); s=socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.bind((host, port)); s.close()" "%HOST%" "%CHECK_BIND_PORT%" >nul 2>nul
if not errorlevel 1 set "PORT_BIND_OK=1"
exit /b 0

:setup_failed
echo.
echo [ERROR] Startup setup failed.
if defined SETUP_STEP echo [ERROR] Failed step: %SETUP_STEP%
if defined SETUP_HINT echo [HINT] %SETUP_HINT%
echo.
echo Common causes:
echo - Python is not installed, not on PATH, or the Microsoft Store Python alias is interfering.
echo - Python is too new for one dependency. Python 3.11 or 3.12 is recommended.
echo - Internet, firewall, VPN, or antivirus blocked pip/Hugging Face downloads.
echo - The ZIP was not fully extracted before running.
echo - The project is in a cloud-synced or permission-restricted folder.
echo.
echo Please copy the 20-40 lines above this message when reporting the error.
pause
exit /b 1

:find_root
set "PROBE=%~1"
if not defined PROBE exit /b 1
for %%I in ("%PROBE%") do set "PROBE=%%~fI"
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] find_root start=%PROBE%

:find_root_loop
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] probe=%PROBE%
if exist "%PROBE%\supertonic3-local-tts\src\app.py" (
  set "ROOT_DIR=%PROBE%"
  exit /b 0
)
for %%P in ("%PROBE%\..") do set "PARENT=%%~fP"
if /I "%PARENT%"=="%PROBE%" exit /b 1
set "PROBE=%PARENT%"
goto find_root_loop

:find_root_from_cmdline
set "CMD_SCAN=%CMDCMDLINE:"=%"
set "CMD_SCRIPT_DIR="
for %%A in (%CMD_SCAN%) do (
  if /I "%%~xA"==".bat" (
    if exist "%%~fA" (
      for %%I in ("%%~fA") do set "CMD_SCRIPT_DIR=%%~dpI"
    )
  )
)
if not defined CMD_SCRIPT_DIR exit /b 0
for %%I in ("%CMD_SCRIPT_DIR%.") do set "CMD_SCRIPT_DIR=%%~fI"
if /I "%SUPERTONIC3_DEBUG_LAUNCHER%"=="1" echo [DEBUG] CMD_SCRIPT_DIR=%CMD_SCRIPT_DIR%
call :find_root "%CMD_SCRIPT_DIR%"
exit /b 0

:ensure_system_python
call :find_system_python
if defined SYSTEM_PY_EXE (
  echo [SETUP] Python found: !SYSTEM_PY_EXE!
  exit /b 0
)
echo [SETUP] Python 3.10-3.13 was not found on this PC.
where winget >nul 2>nul
if errorlevel 1 (
  echo [ERROR] winget was not found, so Python cannot be installed automatically.
  echo Install Python 3.12 from https://www.python.org/downloads/
  echo During setup, enable "Add python.exe to PATH".
  exit /b 1
)
if defined YES goto install_python
choice /C YN /N /M "Install Python 3.12 with winget now? [Y/N] "
if errorlevel 2 (
  echo [ERROR] Python install skipped.
  echo Install Python 3.12 from https://www.python.org/downloads/
  echo During setup, enable "Add python.exe to PATH".
  exit /b 1
)

:install_python
echo [SETUP] Installing Python 3.12 with winget...
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [WARN] Python 3.12 install failed. Trying Python 3.11...
  winget install --id Python.Python.3.11 -e --accept-package-agreements --accept-source-agreements
)
if errorlevel 1 (
  echo [ERROR] Python install failed.
  exit /b 1
)
call :find_system_python
if defined SYSTEM_PY_EXE (
  echo [SETUP] Python found: !SYSTEM_PY_EXE!
  exit /b 0
)
echo [ERROR] Python was installed, but this command window cannot find it yet.
echo Close this window and run 실행.bat again so PATH can refresh.
exit /b 1

:detect_existing_python
call :find_system_python
if defined SYSTEM_PY_EXE echo [SETUP] System Python: !SYSTEM_PY_EXE!
exit /b 0

:python_path_rejected
set "CHECK_PY=%~1"
if not defined CHECK_PY exit /b 1
echo !CHECK_PY! | findstr /I /R "\\venv\\ \\.venv-win\\ \\.venv\\ \\hermes-agent\\ \\node_modules\\ \\site-packages\\ \\codex-runtimes\\ \\WindowsApps\\" >nul
if not errorlevel 1 exit /b 1
exit /b 0

:python_runtime_ok
set "CHECK_PY=%~1"
if not defined CHECK_PY exit /b 1
call :python_path_rejected "%CHECK_PY%"
if errorlevel 1 exit /b 1
"%CHECK_PY%" -c "import sys,venv; raise SystemExit(0 if (sys.version_info.major == 3 and 10 <= sys.version_info.minor <= 14) else 1)" >nul 2>nul
exit /b %ERRORLEVEL%

:find_system_python
set "SYSTEM_PY_EXE="
where py >nul 2>nul
if not errorlevel 1 (
  for /f "usebackq delims=" %%P in (`py -0p 2^>nul`) do (
    if "!SYSTEM_PY_EXE!"=="" call :try_pick_py0p_line "%%P"
  )
)
for %%V in (312 311 310 313 314) do (
  if "!SYSTEM_PY_EXE!"=="" (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
      call :python_runtime_ok "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
      if not errorlevel 1 set "SYSTEM_PY_EXE=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
    )
  )
)
for %%V in (12 11 10 13 14) do (
  if "!SYSTEM_PY_EXE!"=="" (
    if exist "%LOCALAPPDATA%\Python\pythoncore-3.%%V-64\python.exe" (
      call :python_runtime_ok "%LOCALAPPDATA%\Python\pythoncore-3.%%V-64\python.exe"
      if not errorlevel 1 set "SYSTEM_PY_EXE=%LOCALAPPDATA%\Python\pythoncore-3.%%V-64\python.exe"
    )
  )
)
for %%C in (python python3) do (
  if "!SYSTEM_PY_EXE!"=="" (
    for /f "delims=" %%P in ('where %%C 2^>nul') do (
      if "!SYSTEM_PY_EXE!"=="" (
        call :python_runtime_ok "%%P"
        if not errorlevel 1 set "SYSTEM_PY_EXE=%%P"
      )
    )
  )
)
exit /b 0

:try_pick_py0p_line
call :extract_py0p_exe "%~1"
if not defined PY0P_EXE exit /b 0
if not exist "!PY0P_EXE!" exit /b 0
call :python_runtime_ok "!PY0P_EXE!"
if errorlevel 1 exit /b 0
set "SYSTEM_PY_EXE=!PY0P_EXE!"
exit /b 0

:extract_py0p_exe
set "PY0P_SCRATCH=%~1"
set "PY0P_EXE="
if not defined PY0P_SCRATCH exit /b 0
:extract_py0p_next
for /f "tokens=1* delims= " %%A in ("!PY0P_SCRATCH!") do (
  if "%%B"=="" (
    set "PY0P_EXE=%%A"
  ) else (
    set "PY0P_SCRATCH=%%B"
    goto extract_py0p_next
  )
)
exit /b 0

:ensure_ffmpeg
if defined SKIP_FFMPEG (
  echo [SETUP] ffmpeg check skipped.
  exit /b 0
)
where ffmpeg >nul 2>nul
if not errorlevel 1 (
  echo [SETUP] ffmpeg found.
  exit /b 0
)
echo [SETUP] ffmpeg was not found.
where winget >nul 2>nul
if errorlevel 1 (
  echo [WARN] winget was not found. Install ffmpeg manually if subtitle/media decoding fails.
  echo        Recommended command: winget install --id Gyan.FFmpeg -e
  exit /b 0
)
echo.
echo ============================================================
echo Optional FFmpeg installation notice
echo ============================================================
echo FFmpeg is NOT required for basic Supertonic 3 TTS generation.
echo You can generate WAV audio and use the local web app without FFmpeg.
echo.
echo FFmpeg is used only for broader media/subtitle workflows:
echo - decoding or converting MP3, M4A, MP4, and other media formats
echo - future subtitle sync workflows that require precise media conversion
echo - environments where PyAV/faster-whisper audio decoding is not enough
echo.
echo If you skip FFmpeg, TTS generation still works.
echo However, accurate subtitle sync for non-WAV media or conversion-heavy
echo workflows may be unavailable or limited.
echo.
echo The launcher will install the Windows package Gyan.FFmpeg via winget.
echo Gyan FFmpeg builds are GPLv3 builds. FFmpeg itself is generally
echo LGPLv2.1-or-later, but builds with GPL components apply GPL terms.
echo This ZIP does not bundle FFmpeg; winget installs it separately on
echo this PC. Review the license before installing:
echo - https://www.ffmpeg.org/legal.html
echo - https://www.gyan.dev/ffmpeg/builds/
echo.
echo The --yes option does NOT bypass this FFmpeg confirmation.
echo.
choice /C YN /N /M "1/2 Did you read and understand the FFmpeg notice above? [Y/N] "
if errorlevel 2 (
  echo [WARN] ffmpeg install skipped. You can install it later with:
  echo        winget install --id Gyan.FFmpeg -e
  exit /b 0
)
choice /C YN /N /M "2/2 Do you agree to install Gyan.FFmpeg under its GPLv3 build terms? [Y/N] "
if errorlevel 2 (
  echo [WARN] ffmpeg install skipped after license confirmation.
  echo        TTS generation still works without FFmpeg.
  exit /b 0
)

:install_ffmpeg
echo [SETUP] Installing ffmpeg with winget...
winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [WARN] ffmpeg install failed. Continue without ffmpeg.
  exit /b 0
)
echo [SETUP] ffmpeg installed. If Windows cannot find it immediately, reopen this launcher.
exit /b 0

:ensure_venv
set "TARGET_DIR=%~1"
set "TARGET_VENV=%~2"
set "TARGET_LABEL=%~3"
set "TARGET_PY=%TARGET_VENV%\Scripts\python.exe"
if exist "%TARGET_PY%" (
  "%TARGET_PY%" -c "import sys" >nul 2>nul
  if not errorlevel 1 (
    echo [SETUP] %TARGET_LABEL% venv exists. Skipped.
    exit /b 0
  )
  echo [WARN] %TARGET_LABEL% venv exists but Python is not usable.
  echo [WARN] It will be recreated if system Python is available.
  call :find_system_python
  rmdir /S /Q "%TARGET_VENV%" >nul 2>nul
  if exist "%TARGET_VENV%" (
    echo [ERROR] Could not remove broken venv: %TARGET_VENV%
    exit /b 1
  )
)
call :find_system_python
echo [SETUP] Creating %TARGET_LABEL% venv...
if not exist "%TARGET_DIR%" (
  echo [ERROR] Folder not found: %TARGET_DIR%
  exit /b 1
)
call :create_venv_with_fallback
if errorlevel 1 (
  call :ensure_system_python
  if errorlevel 1 exit /b 1
  call :create_venv_with_fallback
)
if errorlevel 1 exit /b 1
"%TARGET_PY%" -m pip install --upgrade pip
if errorlevel 1 (
  echo [WARN] pip upgrade failed. Continuing with bundled pip.
)
echo [SETUP] %TARGET_LABEL% venv created.
exit /b 0

:create_venv_with_fallback
set "VENV_OK="
if defined VENV_CREATOR_PY (
  call :attempt_venv_create "!VENV_CREATOR_PY!"
)
if defined SYSTEM_PY_EXE if "!VENV_OK!"=="" (
  call :attempt_venv_create "!SYSTEM_PY_EXE!"
)
where py >nul 2>nul
if not errorlevel 1 if "!VENV_OK!"=="" (
  for /f "usebackq delims=" %%P in (`py -0p 2^>nul`) do (
    if "!VENV_OK!"=="" call :attempt_venv_from_py0p "%%P"
  )
)
for %%V in (312 311 310 313 314) do (
  if "!VENV_OK!"=="" (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
      call :attempt_venv_create "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
    )
  )
)
for %%V in (12 11 10 13 14) do (
  if "!VENV_OK!"=="" (
    if exist "%LOCALAPPDATA%\Python\pythoncore-3.%%V-64\python.exe" (
      call :attempt_venv_create "%LOCALAPPDATA%\Python\pythoncore-3.%%V-64\python.exe"
    )
  )
)
for %%C in (python python3) do (
  if "!VENV_OK!"=="" (
    for /f "delims=" %%P in ('where %%C 2^>nul') do (
      if "!VENV_OK!"=="" call :attempt_venv_create "%%P"
    )
  )
)
if not defined VENV_OK (
  echo [ERROR] Could not create venv with any Python 3.10-3.14 on this PC.
  echo [HINT] Install Python 3.12 from https://www.python.org/downloads/
  echo        Enable "Add python.exe to PATH", then run this launcher again.
  exit /b 1
)
exit /b 0

:attempt_venv_from_py0p
call :extract_py0p_exe "%~1"
if not defined PY0P_EXE exit /b 0
call :attempt_venv_create "!PY0P_EXE!"
exit /b 0

:attempt_venv_create
set "ATTEMPT_EXE=%~1"
if defined VENV_OK exit /b 0
if not defined ATTEMPT_EXE exit /b 0
call :python_runtime_ok "%ATTEMPT_EXE%"
if errorlevel 1 exit /b 0
if exist "%TARGET_VENV%" rmdir /S /Q "%TARGET_VENV%" >nul 2>nul
echo [SETUP] Trying %ATTEMPT_EXE% ...
"%ATTEMPT_EXE%" -m venv "%TARGET_VENV%" >nul 2>nul
if errorlevel 1 (
  if exist "%TARGET_VENV%" rmdir /S /Q "%TARGET_VENV%" >nul 2>nul
  exit /b 0
)
if not exist "%TARGET_PY%" (
  if exist "%TARGET_VENV%" rmdir /S /Q "%TARGET_VENV%" >nul 2>nul
  exit /b 0
)
"%TARGET_PY%" -c "import sys, venv" >nul 2>nul
if errorlevel 1 (
  if exist "%TARGET_VENV%" rmdir /S /Q "%TARGET_VENV%" >nul 2>nul
  exit /b 0
)
set "VENV_OK=1"
set "VENV_CREATOR_PY=%ATTEMPT_EXE%"
set "SYSTEM_PY_EXE=%ATTEMPT_EXE%"
echo [SETUP] venv created with %ATTEMPT_EXE%
exit /b 0

:ensure_tts_packages
if not exist "%PY_TTS%" set "PY_TTS=%TTS_VENV%\Scripts\python.exe"
"%PY_TTS%" -c "import flask, supertonic, soundfile, numpy" >nul 2>nul
if not errorlevel 1 (
  echo [SETUP] TTS packages already installed. Skipped.
  exit /b 0
)
echo [SETUP] Installing TTS packages...
"%PY_TTS%" -m pip install -r "%TTS_DIR%\requirements.txt"
if errorlevel 1 (
  echo [ERROR] TTS package install failed.
  exit /b 1
)
echo [SETUP] TTS packages installed.
exit /b 0

:ensure_whisper_packages
if not exist "%PY_WHISPER%" set "PY_WHISPER=%WHISPER_VENV%\Scripts\python.exe"
"%PY_WHISPER%" -c "import faster_whisper" >nul 2>nul
if not errorlevel 1 (
  echo [SETUP] Whisper packages already installed. Skipped.
  exit /b 0
)
echo [SETUP] Installing Whisper packages...
"%PY_WHISPER%" -m pip install -r "%WHISPER_DIR%\requirements.txt"
if errorlevel 1 (
  echo [ERROR] Whisper package install failed.
  exit /b 1
)
echo [SETUP] Whisper packages installed.
exit /b 0

:check_package
set "CHECK_PY=%~1"
set "CHECK_PACKAGE=%~2"
set "CHECK_LABEL=%~3"
set "CHECK_LOG=%TEMP%\supertonic3_update_%CHECK_PACKAGE%.txt"
set "CHECK_INSTALLED="
set "CHECK_LATEST="

echo [UPDATE] Checking %CHECK_LABEL%...
"%CHECK_PY%" -m pip --disable-pip-version-check --timeout 8 index versions "%CHECK_PACKAGE%" > "%CHECK_LOG%" 2>&1
if errorlevel 1 (
  echo          Could not check updates. Network, PyPI, or pip may be unavailable.
  echo          Manual check: "%CHECK_PY%" -m pip index versions %CHECK_PACKAGE%
  del "%CHECK_LOG%" >nul 2>nul
  exit /b 0
)

findstr /I /C:"INSTALLED:" /C:"LATEST:" "%CHECK_LOG%" >nul 2>nul
if errorlevel 1 (
  echo          Version details were not found.
) else (
  for /f "usebackq delims=" %%L in (`findstr /I /C:"INSTALLED:" /C:"LATEST:" "%CHECK_LOG%"`) do echo          %%L
  for /f "usebackq tokens=1,* delims=:" %%A in (`findstr /I /C:"INSTALLED:" "%CHECK_LOG%"`) do set "CHECK_INSTALLED=%%B"
  for /f "usebackq tokens=1,* delims=:" %%A in (`findstr /I /C:"LATEST:" "%CHECK_LOG%"`) do set "CHECK_LATEST=%%B"
  for /f "tokens=* delims= " %%V in ("!CHECK_INSTALLED!") do set "CHECK_INSTALLED=%%V"
  for /f "tokens=* delims= " %%V in ("!CHECK_LATEST!") do set "CHECK_LATEST=%%V"
)
echo          Update command: "%CHECK_PY%" -m pip install -U %CHECK_PACKAGE%

if not defined CHECK_INSTALLED goto check_package_done
if not defined CHECK_LATEST goto check_package_done
if /I "!CHECK_INSTALLED!"=="!CHECK_LATEST!" (
  echo          Already up to date.
  goto check_package_done
)
echo          Update available: !CHECK_INSTALLED! -^> !CHECK_LATEST!
if defined CHECK_ONLY (
  echo          Check-only mode: not installing.
  goto check_package_done
)
if defined AUTO_UPDATE goto check_package_update
choice /C YN /N /M "Update %CHECK_LABEL% now? [Y/N] "
if errorlevel 2 (
  echo          Update skipped by user.
  goto check_package_done
)

:check_package_update
call :update_package "%CHECK_PY%" "%CHECK_PACKAGE%" "%CHECK_LABEL%"

:check_package_done
del "%CHECK_LOG%" >nul 2>nul
exit /b 0

:update_package
set "UPDATE_PY=%~1"
set "UPDATE_PACKAGE=%~2"
set "UPDATE_LABEL=%~3"
echo [UPDATE] Installing latest %UPDATE_LABEL%...
"%UPDATE_PY%" -m pip install -U "%UPDATE_PACKAGE%"
if errorlevel 1 (
  echo [WARN] %UPDATE_LABEL% update failed. Continuing with the currently installed version.
  exit /b 0
)
echo [UPDATE] %UPDATE_LABEL% updated.
exit /b 0
