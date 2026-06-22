param(
    [string]$DataDir = "..\supertonic3-local-tts\data",
    [string]$Model = "medium",
    [string]$Language = "ko",
    [string]$ComputeType = "int8",
    [int]$CpuThreads = 8
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Python = ".\.venv-win\Scripts\python.exe"
if (!(Test-Path $Python)) {
    py -m venv .venv-win
    & $Python -m pip install -r requirements.txt
}

& $Python .\whisper_subtitle_refiner.py `
    --latest-from $DataDir `
    --model $Model `
    --language $Language `
    --compute-type $ComputeType `
    --cpu-threads $CpuThreads
