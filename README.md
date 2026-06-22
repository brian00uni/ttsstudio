Supertonic 3 Local TTS Studio 개발/사용 문서

이 작업 공간은 Supertonic 3를 로컬에서 실행해 텍스트를 음성으로 만들고, faster-whisper로 자막을 보정하며, Codex/Cursor 같은 LLM 코딩 도구가 대본 요청을 로컬 파일로 받아 처리할 수 있게 구성한 통합 프로젝트입니다.

웹앱 자체가 LLM API를 직접 호출하지는 않습니다.
대신 사용자가 웹 UI에서 대본 요청을 저장하면 JSON 요청 파일이 로컬에 남고, Codex/Cursor/기타 에이전트가 그 파일을 읽어 대본 파일과 대본 카탈로그를 갱신하는 방식입니다.


0. 출처와 참고 링크

1) 큐레이터 단비's 웹앱 아이디어 창고
https://min-inter.co.kr

2) Supertonic 공식 GitHub
https://github.com/supertone-inc/supertonic

3) faster-whisper 공식 GitHub
https://github.com/SYSTRAN/faster-whisper

4) 배포/다운로드 안내 페이지
https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide

5) 로컬 웹 UI 라이선스 고지 주소
서버 실행 후 아래 주소에서 LICENSE_NOTICES.txt 내용을 확인할 수 있습니다.

http://127.0.0.1:3093/license-notices


1. 전체 폴더 구조

1) supertonic-upstream
Supertone 공식 Supertonic 저장소를 참고용으로 내려받아 둔 원본 자료입니다.
직접 실행하는 폴더가 아니라 모델 구조, 언어 목록, ONNX 호출 예제, Python/Node/Web/Swift/Rust/Java 등 런타임별 예제를 확인하는 기준 자료입니다.
로컬 앱에서 옵션을 붙이거나 동작을 비교할 때 이 폴더의 README와 예제를 참고합니다.

2) supertonic3-local-tts
실제 웹앱입니다.
Flask 서버가 브라우저 UI와 API를 제공하고, 설치된 supertonic Python SDK를 통해 Supertonic 3 TTS를 호출합니다.
생성 결과는 기본적으로 supertonic3-local-tts/data 폴더에 저장됩니다.
이 폴더가 주 실행 폴더입니다.

3) supertonic3-whisper-subtitles
faster-whisper 기반 자막 보정 도구입니다.
supertonic3-local-tts가 만든 WAV를 다시 분석해 실제 음성 타이밍 기준의 *_whisper.srt, *_whisper.vtt, *_whisper.txt, *_whisper.json, *_whisper_log.txt를 만듭니다.

4) 실행.bat
Windows에서 전체 프로젝트를 편하게 실행하는 루트 배치 파일입니다.
배치파일이 어디서 호출되든 프로젝트 루트를 찾아 supertonic3-local-tts 서버를 실행합니다.
Python, ffmpeg, .venv-win, 필수 pip 패키지를 확인하고 이미 있으면 건너뛰며, 없으면 가능한 범위에서 자동 준비합니다.
Python이 없고 winget이 있으면 Python 3.11 설치를 시도합니다.
ffmpeg는 TTS 생성 필수 조건이 아니므로 설치 전 별도 고지와 두 번의 확인 질문을 표시합니다.
Supertonic SDK와 faster-whisper 업데이트 확인도 시도합니다.

5) start-mac.sh
macOS 또는 Linux 사용자를 위한 베타 실행 스크립트입니다.
Windows용 실행.bat과 달리 macOS 실기기 검증은 아직 하지 못했습니다.
Python venv, pip 패키지, 사용 가능한 로컬 포트, 선택적인 Whisper venv 연결을 준비합니다.

6) sample.txt
긴 한국어 샘플 대본입니다.
웹앱 대본 카탈로그나 수동 테스트에 사용할 수 있습니다.


2. 빠른 실행

1) Windows에서 가장 쉬운 실행
루트 폴더의 실행.bat을 더블클릭합니다.

또는 PowerShell/cmd에서 아래처럼 실행합니다.

<내 컴퓨터의 배포 루트 경로>\실행.bat

실행 후 브라우저에서 아래 주소로 접속합니다.

http://127.0.0.1:3093

2) macOS/Linux 베타 실행
맥은 개발자가 실기기로 검증하지 못했으므로 공식 확인 완료가 아니라 베타 지원입니다.
다만 앱 본체가 Python/Flask이고 Supertonic SDK가 OS Independent Python 패키지로 배포되므로, Python 3.11 또는 3.12가 준비된 macOS에서는 동작 가능성이 높습니다.

터미널에서 배포 루트로 이동한 뒤 아래처럼 실행합니다.

chmod +x ./start-mac.sh
./start-mac.sh

Homebrew를 쓰는 사용자는 Python이 없을 때 먼저 아래처럼 설치할 수 있습니다.

brew install python@3.11

ffmpeg는 TTS WAV 생성 필수 조건이 아닙니다.
다만 다양한 미디어 변환과 자막 싱크 작업까지 쓰려면 macOS에서 아래처럼 별도 설치합니다.

brew install ffmpeg

주의:
macOS Gatekeeper가 인터넷에서 받은 ZIP 내부 스크립트 실행을 막을 수 있습니다.
이 경우 터미널에서 실행 권한을 부여하거나, 시스템 설정의 보안 허용이 필요할 수 있습니다.
Apple Silicon과 Intel Mac 모두 원리상 가능하지만, 실제 성능과 일부 pip wheel 호환성은 사용자 환경에 따라 달라질 수 있습니다.

3) 실행.bat 점검 모드
서버를 실제로 띄우지 않고 경로 탐색과 업데이트 확인만 점검합니다.

실행.bat --check

업데이트 확인도 건너뛰고 빠르게 경로만 확인합니다.

실행.bat --check --skip-update

ffmpeg 설치 확인을 건너뛰고 점검하려면 아래처럼 실행합니다.

실행.bat --check --skip-update --skip-ffmpeg

4) 실행.bat이 하는 일
현재 작업 폴더에 의존하지 않고 배치파일 위치, cmd 호출 경로, 현재 폴더를 순서대로 검사합니다.
supertonic3-local-tts/src/app.py가 있는 폴더를 찾습니다.
supertonic3-whisper-subtitles/whisper_subtitle_refiner.py가 있으면 SUPERTONIC3_WHISPER_DIR 환경변수로 연결합니다.
시스템 Python 3이 있는지 확인합니다.
Python이 없고 winget이 있으면 Python 3.11 설치 여부를 묻습니다. 설치 뒤 PATH가 바로 반영되지 않으면 배치 파일을 다시 실행합니다.
supertonic3-local-tts/.venv-win이 없으면 자동으로 생성합니다.
supertonic3-whisper-subtitles/.venv-win이 없으면 자동으로 생성합니다.
필수 패키지가 이미 import 가능하면 pip install을 건너뜁니다.
필수 패키지가 없으면 각 폴더의 requirements.txt를 설치합니다.
ffmpeg가 없고 winget이 있으면 설치 여부를 묻습니다.
이때 TTS 생성에는 필요 없지만 MP3, M4A, MP4 같은 비-WAV 미디어 변환과 정밀 자막 싱크 워크플로우에는 필요할 수 있다는 점을 고지합니다.
또한 Gyan.FFmpeg가 GPLv3 빌드라는 라이선스 고지를 보여준 뒤, 이해 여부와 설치 동의를 두 번 확인합니다.
실행.bat으로 실행할 때는 SUPERTONIC3_OUTPUT_DIR을 현재 supertonic3-local-tts/data로 맞춥니다. 이전 PC 경로나 다른 압축 해제 폴더의 출력 경로가 남는 것을 막기 위한 처리입니다.
3093 포트가 이미 LISTENING이면 /health의 output_dir을 확인합니다.
output_dir이 현재 폴더의 data와 같으면 기존 서버를 재사용하고, 다르면 이전 폴더의 서버로 판단해 3094부터 빈 포트를 찾아 현재 폴더의 새 서버를 띄웁니다.
3093 포트가 비어 있어도 Windows가 예약했거나 보안 도구가 막아 실제로 열 수 없으면 3094부터 접근 가능한 포트를 자동으로 찾습니다.
서버가 없으면 supertonic3-local-tts/.venv-win/Scripts/python.exe로 src/app.py를 실행합니다.

5) 실행.bat 옵션
--check는 서버를 띄우지 않고 준비 상태만 확인합니다.
--skip-update는 PyPI 최신 버전 확인을 건너뜁니다.
--skip-bootstrap은 Python/ffmpeg/venv/pip 패키지 자동 준비를 건너뜁니다.
--skip-ffmpeg는 ffmpeg 확인과 winget 설치 제안을 건너뜁니다.
--auto-update는 supertonic과 faster-whisper의 새 버전이 감지되면 확인 질문 없이 pip 업데이트를 실행합니다.
--yes는 Python 설치 확인에는 사용할 수 있지만, ffmpeg 설치 확인은 생략하지 않습니다.

6) ffmpeg 선택 설치 고지
ffmpeg는 기본 TTS 생성과 웹앱 실행에는 필수가 아닙니다.
설치하지 않아도 Supertonic 3로 WAV 음성을 만드는 기능은 동작합니다.
다만 ffmpeg가 없으면 MP3, M4A, MP4 같은 외부 미디어 입력, 미디어 변환, 변환 기반의 정확한 자막 싱크 구현은 제한될 수 있습니다.
현재 faster-whisper는 PyAV를 통해 오디오를 읽을 수 있으므로 WAV 기반 보정은 동작할 수 있지만, 배포 사용자가 다양한 파일 형식을 다룰 가능성을 고려해 선택 설치로 안내합니다.
실행.bat은 ffmpeg를 ZIP에 포함하지 않고, 사용자가 동의한 경우에만 winget으로 Gyan.FFmpeg를 설치합니다.
Gyan.FFmpeg Windows 빌드는 GPLv3 빌드이므로 설치 전 라이선스 고지를 확인해야 합니다.

참고:
https://www.ffmpeg.org/legal.html
https://www.gyan.dev/ffmpeg/builds/
https://pypi.org/project/faster-whisper/


3. 수동 서버 실행 방법

1) Windows PowerShell
각자 프로젝트 위치가 다를 수 있으므로 먼저 supertonic3-local-tts 폴더로 이동합니다.

cd <내 컴퓨터의 supertonic3-local-tts 경로>
$env:SUPERTONIC3_HOST = "127.0.0.1"
$env:SUPERTONIC3_PORT = "3093"
.\.venv-win\Scripts\python.exe src\app.py

접속 주소는 아래와 같습니다.

http://127.0.0.1:3093

끄려면 실행 중인 PowerShell 창에서 Ctrl+C를 누릅니다.

2) macOS/Linux 루트 스크립트
배포 루트 폴더에서 아래처럼 실행합니다.

chmod +x ./start-mac.sh
./start-mac.sh

3) Linux 또는 bash 수동 실행
각자 프로젝트 위치가 다를 수 있으므로 먼저 supertonic3-local-tts 폴더로 이동합니다.

cd <내 컴퓨터의 supertonic3-local-tts 경로>
./start.sh

접속 주소는 아래와 같습니다.

http://127.0.0.1:3093


4. 환경변수

1) SUPERTONIC3_HOST
Flask 서버가 바인딩할 호스트입니다.
기본값은 127.0.0.1입니다.
배포판은 로컬 사용을 기준으로 하므로 127.0.0.1을 권장합니다.
0.0.0.0으로 바꾸면 같은 네트워크의 다른 기기에서도 접근할 수 있으므로 신뢰할 수 있는 LAN에서만 사용합니다.

2) SUPERTONIC3_PORT
Flask 서버 포트입니다.
기본값은 3093입니다.
포트 충돌이 있으면 3094 같은 다른 값으로 바꿉니다.

3) SUPERTONIC3_OUTPUT_DIR
생성된 WAV, 대본, 로그, 자막이 저장될 폴더입니다.
지정하지 않으면 supertonic3-local-tts/data가 사용됩니다.
실행.bat은 기본적으로 이 값을 현재 실행 중인 ZIP 폴더의 supertonic3-local-tts/data로 설정합니다.
사용자가 직접 지정한 SUPERTONIC3_OUTPUT_DIR을 유지하고 싶으면 SUPERTONIC3_KEEP_OUTPUT_DIR=1을 먼저 설정합니다.

4) SUPERTONIC3_WHISPER_DIR
Whisper 보정 도구 폴더입니다.
실행.bat은 supertonic3-whisper-subtitles 폴더를 찾으면 자동으로 이 값을 설정합니다.

5) SUPERTONIC3_SKIP_UPDATE_CHECK
1로 설정하면 실행.bat의 PyPI 업데이트 확인을 건너뜁니다.

6) SUPERTONIC3_AUTO_UPDATE
1로 설정하면 새 버전이 감지될 때 확인 질문 없이 pip install -U를 실행합니다.
설정하지 않으면 업데이트 여부를 사용자에게 묻습니다.

5. 웹 UI 기본 사용 흐름

1) 브라우저에서 http://127.0.0.1:3093에 접속합니다.

2) 대본 입력 탭
기본값은 사용자 입력(User text)입니다.
아래 텍스트 영역에 바로 대본을 입력하면 됩니다.
텍스트(Text) 제목 오른쪽의 크기 슬라이더는 텍스트 편집 영역만 90%~180%로 키우거나 줄입니다.
기본값은 115%이며, 같은 브라우저의 localStorage에 저장됩니다.

샘플 대본(Samples) 탭을 누르면 public/scripts.json에 등록된 샘플 대본을 선택할 수 있습니다.
로컬 TXT(Local TXT) 탭을 누르면 supertonic3-local-tts/data/script_customs 폴더의 .txt 파일을 자동으로 목록화합니다.
사용자가 이 폴더에 텍스트 대본 파일을 넣고 새로고침(Reload)을 누르면 파일명이 화면에 표시되고, 선택하면 텍스트 영역으로 불러옵니다.
로컬 TXT 파일은 최신순, 오래된순, 파일명 오름차순, 파일명 내림차순으로 정렬할 수 있고 검색어로 좁힐 수 있습니다.
대본 요청(Request) 탭을 눌러야 AI에게 넘길 대본 요청 저장 폼이 보입니다.

3) 표현 태그
화면의 표현 태그 버튼을 누르면 텍스트 입력 위치에 태그가 삽입됩니다.
현재 지원 목록은 아래와 같습니다.

<laugh>
<breath>
<surprise>
<sigh>
<scream>
<throatclear>
<sad>
<angry>
<cough>
<yawn>

4) 음성 선택
음성 드롭다운에서 M1~M5, F1~F5를 선택합니다.
음성 샘플 목록의 왼쪽 2/3 영역은 단순 재생입니다.
오른쪽 1/3 선택 버튼을 눌러야 실제 드롭다운 목소리가 바뀝니다.

5) 필터 값
속도, 단계, 최대 청크, 청크 무음 값을 직접 입력하거나 선택 드롭다운으로 빠르게 지정합니다.
필터 우측/하단 팁 영역은 현재 필드가 무엇을 의미하는지 설명합니다.

6) 사용자 설정
Custom 1~5 슬롯에 현재 설정을 저장할 수 있습니다.
브라우저 localStorage에 저장되므로 같은 브라우저에서 다시 불러올 수 있습니다.

7) 생성
생성 버튼을 누르면 서버가 Supertonic 3 TTS를 호출합니다.
짧은 대본은 /api/tts로 즉시 처리됩니다.
긴 대본은 /api/tts-job 백그라운드 작업으로 등록되고 UI가 상태를 폴링합니다.

8) 다운로드
생성 후 WAV, 대본 TXT, 입력 로그 TXT, SRT, VTT, Whisper 보정 파일 버튼이 활성화됩니다.
MP3 변환/다운로드 버튼은 선택 설치된 ffmpeg를 사용해 현재 WAV를 같은 data 폴더의 MP3로 변환한 뒤 내려받습니다.
이 버튼은 "개인 사용 OK", "ZIP에 ffmpeg 미포함", "내 PC의 ffmpeg로 변환", "재배포 시 라이선스 확인" 고지를 두 번 확인한 뒤에만 실행됩니다.


6. 생성 파일 구조

1) 기본 저장 위치
supertonic3-local-tts/data

2) WAV
Supertonic 3가 만든 음성 파일입니다.
예시:

supertonic3_20260516_193115_274.wav

3) 대본 TXT
실제 TTS에 넘긴 텍스트입니다.
이모지나 Python/Windows 콘솔에서 문제가 되는 일부 문자는 sanitize_tts_text 로직에서 제거될 수 있습니다.

4) 사용자 로컬 TXT 대본 폴더
사용자가 직접 넣는 텍스트 대본 파일은 아래 폴더에 둡니다.

supertonic3-local-tts/data/script_customs

.txt 파일만 자동 인식합니다.
파일명은 로컬 TXT 탭의 목록에 표시되고, 선택하면 텍스트 영역에 불러옵니다.

5) 입력 로그 TXT
어떤 설정으로 생성했는지 기록하는 로그입니다.
모델, 음성, 언어, 속도, 단계, 청크, 무음 길이 같은 값을 추적할 때 사용합니다.

6) 기본 SRT/VTT
입력 대본과 전체 음성 길이를 기준으로 생성하는 기본 자막입니다.
정밀한 음성 인식 결과는 아니므로 실제 발화 타이밍과 조금 다를 수 있습니다.

7) Whisper 보정 SRT/VTT/TXT/JSON/LOG
faster-whisper가 생성된 WAV를 다시 듣고 실제 음성 타이밍 기준으로 만든 보정 결과입니다.
파일 이름은 보통 아래처럼 끝납니다.

*_whisper.srt
*_whisper.vtt
*_whisper.txt
*_whisper.json
*_whisper_log.txt

8) MP3 변환 파일
웹 UI의 MP3 변환/다운로드 버튼을 누르면 선택 설치된 ffmpeg로 WAV를 MP3로 변환합니다.
결과는 WAV와 같은 이름의 .mp3 파일로 data 폴더에 저장됩니다.
변환 로그는 *_mp3_convert_log.txt 형식으로 저장될 수 있습니다.
이 ZIP에는 ffmpeg 바이너리를 포함하지 않으며, 사용자의 PC에 설치된 ffmpeg를 호출합니다.
개인 사용은 괜찮습니다. 다만 ffmpeg 바이너리를 ZIP, 제품, 서비스에 포함해 다시 배포하는 경우 GPL/LGPL 조건을 별도로 확인해야 합니다.


7. TTS 생성 내부 로직

1) 브라우저가 설정값을 수집합니다.
텍스트, 모델, 음성, 언어, 속도, 단계, 최대 청크, 청크 무음, 런타임 스레드, Whisper 보정 여부를 payload로 만듭니다.

2) 짧은 대본은 /api/tts로 전송합니다.
서버는 request JSON을 파싱하고 _parse_tts_payload로 기본값을 보완합니다.

3) 긴 대본은 /api/tts-job으로 전송합니다.
서버는 job_id를 발급하고 백그라운드 스레드에서 run_tts_generation을 실행합니다.
브라우저는 /api/tts-job/<job_id>를 반복 조회합니다.

4) run_tts_generation은 텍스트를 sanitize_tts_text로 정리합니다.
Windows cp949 문제를 유발하는 이모지와 일부 제어 문자를 제거합니다.

5) Supertonic3Engine.synthesize_to_file이 실제 SDK를 호출합니다.
model, model_dir, auto_download, intra_op_num_threads, inter_op_num_threads, voice, voice_style_path, lang, speed, total_step, max_chunk_length, silence_duration, verbose 값이 전달됩니다.

6) 생성 완료 후 _write_sidecar_files가 보조 파일을 만듭니다.
대본 TXT, 입력 로그, SRT, VTT가 WAV와 같은 이름 규칙으로 생성됩니다.

7) _tts_response_payload가 브라우저용 다운로드 URL을 반환합니다.
브라우저는 audio player와 다운로드 버튼을 갱신합니다.

8) Whisper 보정이 켜져 있으면 /api/refine-subtitles를 호출합니다.
서버는 supertonic3-whisper-subtitles/whisper_subtitle_refiner.py를 별도 프로세스로 실행합니다.


8. faster-whisper 자막 보정 로직

1) 목적
기본 자막은 입력 대본 기준으로 대략 나눈 파일입니다.
Whisper 보정은 실제 WAV를 다시 듣고 발화 구간을 찾아 타임코드를 더 정확하게 만듭니다.

2) 기본 모델
현재 웹 UI의 보정 기본값은 medium입니다.
CPU 환경에서는 compute_type int8을 사용합니다.

3) 모델 선택 기준
small은 빠른 초안용입니다.
medium은 일반 작업 추천값입니다.
large-v3는 시간이 오래 걸리지만 최종 품질 우선 작업에 적합합니다.

4) 주요 옵션
language ko는 한국어 오인식을 줄입니다.
beam_size 5는 속도와 정확도의 균형점입니다.
vad_filter는 무음 구간 환각을 줄입니다.
word_timestamps는 단어 단위 시간 정보를 확보해 자막 줄 나누기에 유리합니다.
temperature 0.0은 출력 변동성과 환각을 줄이는 데 유리합니다.

5) 독립 실행
supertonic3-whisper-subtitles 폴더에서 최신 WAV를 직접 보정할 수 있습니다.

cd <내 컴퓨터의 supertonic3-whisper-subtitles 경로>
.\.venv-win\Scripts\python.exe .\whisper_subtitle_refiner.py --latest-from ..\supertonic3-local-tts\data

또는 PowerShell 편의 스크립트를 씁니다.

.\refine_latest.ps1


9. 대본 카탈로그 public/scripts.json

1) 역할
웹 UI의 대본 드롭다운이 읽는 카탈로그입니다.
새 대본을 UI에서 선택하게 하려면 이 파일에 항목을 추가해야 합니다.

2) 기본 필드
id: 대본 고유 ID
title: UI에 표시될 제목
description: 선택 후 상태줄과 로그에 보여줄 설명
lang: 보통 ko
text_url: public 폴더 기준 대본 TXT 경로
voice: 추천 음성
speed: 추천 속도
total_step: 추천 단계
max_chunk_length: 추천 최대 청크
silence_duration: 추천 청크 사이 무음
whisper_refine: 생성 후 Whisper 보정 여부

3) text_url 사용
긴 대본은 scripts.json 안에 직접 text를 넣지 말고 public/*.txt 파일로 저장한 뒤 text_url을 연결하는 것이 좋습니다.
브라우저는 대본 선택 시 text_url을 fetch해서 텍스트 영역에 채웁니다.

4) LLM이 scripts.json을 수정할 때 주의할 점
JSON 문법을 반드시 유지합니다.
기존 scripts 배열을 깨지 않습니다.
id는 중복되지 않게 합니다.
대본 TXT 파일의 경로는 /public/... URL이 아니라 public/... 파일 경로를 기준으로 판단하고, scripts.json에는 브라우저가 읽을 수 있는 /public/... 또는 기존 파일의 관례에 맞는 URL을 사용합니다.


10. 대본 요청함 로직

1) 목적
웹 UI가 LLM API를 직접 호출하지 않고도 사용자의 대본 요청을 LLM 코딩 도구에 넘기기 위한 로컬 파일 기반 인터페이스입니다.

2) 웹 UI에서 사용자가 입력하는 값
대본 요청 주제
톤
분량
대상
추가 요청
현재 선택된 언어

3) 서버가 저장하는 위치
요청은 아래 폴더에 저장됩니다.

supertonic3-local-tts/data/script_requests

매 요청마다 고유 JSON이 생깁니다.

script_request_날짜_시간_고유값.json

가장 최근 요청은 항상 아래 파일에도 복사됩니다.

latest.json

4) 요청 JSON 주요 필드
id: 요청 ID
type: script_request
status: pending
created_at: 생성 시각
topic: 사용자가 요청한 주제
tone: 요청 톤
length: 목표 분량
audience: 대상 청취자
language: 요청 언어
notes: 추가 요청
target_catalog: public/scripts.json
recommended_output.text_file: LLM이 대본 TXT를 저장할 추천 경로
recommended_output.catalog_id: scripts.json에 넣을 추천 ID
expression_tags: Supertonic 3 표현 태그 목록
expression_tag_guidance: 태그 사용 규칙
ai_workflow: LLM이 따라야 할 작업 단계
prompt_for_ai: 사용자가 LLM에게 그대로 말해도 되는 요약 지시문

5) 표현 태그 삽입 규칙
태그는 감정이나 호흡이 필요한 지점에만 넣습니다.
짧은 대본은 1~3개 정도가 적당합니다.
긴 대본은 장면 전환이나 감정 변화마다 소량만 씁니다.
설명문은 <breath>, <sigh> 위주가 안전합니다.
대화나 연기형 대본은 <laugh>, <surprise>, <sad>, <angry>를 문맥에 맞게 섞을 수 있습니다.
<scream>, <cough>, <yawn>, <throatclear>는 의도가 분명한 장면에서만 사용합니다.
태그를 과하게 반복하면 음성이 어색해질 수 있습니다.


11. LLM이 대본 요청을 받아 처리하는 방법

1) 사용자가 웹 UI에서 대본 요청 저장 버튼을 누릅니다.
이 시점에는 대본이 자동 생성되지 않습니다.
요청 JSON만 저장됩니다.

2) 사용자가 Codex/Cursor/기타 LLM 코딩 도구에게 아래처럼 말합니다.

최신 대본 요청 처리해줘.

또는 더 상세히 말할 수 있습니다.

data/script_requests/latest.json을 읽고 조건에 맞는 Supertonic TTS용 대본을 작성한 뒤 public/scripts.json에 등록해줘.

3) LLM은 latest.json을 읽습니다.
topic, tone, length, audience, notes, language를 해석합니다.
expression_tags와 expression_tag_guidance를 확인합니다.
recommended_output.text_file과 recommended_output.catalog_id를 확인합니다.

4) LLM은 대본 TXT를 작성합니다.
대본은 TTS가 읽기 쉬운 문장으로 씁니다.
한 문장을 지나치게 길게 만들지 않습니다.
쉼표와 마침표를 자연스럽게 사용합니다.
표현 태그는 필요한 곳에만 넣습니다.
이모지나 특수 장식 문자는 피합니다.

5) LLM은 대본 TXT를 public 폴더에 저장합니다.
예시:

supertonic3-local-tts/public/script_request_20260516_211351_62739d01.txt

6) LLM은 public/scripts.json에 새 항목을 추가합니다.
id는 recommended_output.catalog_id를 우선 사용합니다.
text_url은 새로 만든 TXT 파일의 브라우저 접근 경로를 씁니다.
voice, speed, total_step, max_chunk_length, silence_duration은 대본 성격에 맞춰 추천값을 넣습니다.

7) 사용자는 웹 UI에서 대본 새로고침을 누릅니다.
새 대본이 드롭다운에 나타납니다.

8) 사용자는 대본을 선택하고 생성 버튼을 누릅니다.
이제 TTS 생성과 자막 생성이 진행됩니다.

9) LLM이 요청 JSON을 완료 처리할 때
선택 사항이지만, 특정 요청 JSON과 latest.json의 status를 completed로 바꾸고 generated_script, updated_catalog 같은 필드를 추가하면 추적이 쉬워집니다.
다만 웹앱은 completed 상태를 필수로 요구하지 않습니다.


12. LLM 작업 시 금지/주의사항

1) 사용자가 요청하지 않은 파일을 삭제하지 않습니다.

2) public/scripts.json을 덮어쓰기 전에 기존 scripts 배열을 보존합니다.

3) 기존 대본 파일을 임의로 수정하지 않습니다.
새 요청은 새 TXT 파일로 저장하는 편이 안전합니다.

4) 대본에 이모지, 장식용 특수문자, 너무 많은 따옴표, Markdown 표를 넣지 않습니다.
TTS 입력은 평문이 가장 안정적입니다.

5) 표현 태그를 과하게 쓰지 않습니다.
태그는 연기 지시가 아니라 음성 표현 힌트입니다.

6) 긴 URL, 파일 경로, 숫자, 금액, 날짜는 사람이 읽기 쉬운 형태로 씁니다.
예를 들어 125000000000보다 1,250억 원이 낫습니다.

7) Whisper 보정은 시간이 걸립니다.
긴 대본에서 medium이나 large-v3를 쓰면 CPU 환경에서는 몇 분에서 수십 분까지 걸릴 수 있습니다.

8) 웹앱은 외부 LLM API를 호출하지 않습니다.
완전 자동 대본 생성을 원하면 별도 API, MCP 서버, 자동화 작업, 또는 에이전트 실행 환경이 필요합니다.

9) 네트워크가 막힌 환경에서는 실행.bat의 업데이트 확인이 실패할 수 있습니다.
이 경우 서버 실행 자체에는 문제가 없을 수 있습니다.

10) Windows에서 한글 경로나 공백 경로를 사용하므로 명령어에는 항상 따옴표를 쓰는 편이 안전합니다.


13. 음성 샘플 로직

1) 샘플 위치
샘플 WAV는 아래 폴더에 있습니다.

supertonic3-local-tts/public/voice-samples

2) 샘플 목록
브라우저는 아래 파일을 읽어 샘플 버튼을 만듭니다.

supertonic3-local-tts/public/voice-samples.json

3) 샘플 대본
샘플 음성을 만들 때 사용한 원문은 아래 파일입니다.

supertonic3-local-tts/public/voice-samples/voice-test-ko.txt

4) 샘플 재생/선택 동작
각 샘플 컨트롤의 왼쪽 2/3는 재생입니다.
재생은 현재 선택된 목소리를 바꾸지 않습니다.
오른쪽 1/3 선택 버튼을 눌러야 드롭다운 음성이 바뀝니다.

5) 샘플 재생성
supertonic3-local-tts 폴더에서 아래 명령을 실행합니다.

.\.venv-win\Scripts\python.exe tools\generate_voice_samples.py


14. 주요 API

1) GET /
웹 UI index.html을 반환합니다.

2) GET /assets/<name>
ui 폴더의 main.js, style.css를 제공합니다.

3) GET /public/<name>
public 폴더의 이미지, 대본, 샘플 음성, scripts.json 등을 제공합니다.

4) GET /health
서버 상태와 output_dir를 반환합니다.

5) GET /api/options
모델, 음성, 언어, 표현 태그, 기본값, 제한값을 반환합니다.

6) POST /api/tts
짧은 텍스트를 즉시 TTS로 생성합니다.

7) POST /api/tts-job
긴 텍스트를 백그라운드 작업으로 생성합니다.

8) GET /api/tts-job/<job_id>
백그라운드 TTS 작업 상태를 조회합니다.

9) GET /api/latest-output
data 폴더의 최신 WAV와 관련 sidecar 파일을 찾아 다운로드 URL을 복원합니다.
브라우저에서 로그 창을 클릭하면 이 API를 통해 기존 산출물을 다시 잡을 수 있습니다.

10) GET /api/script-customs
data/script_customs 폴더의 .txt 대본 파일 목록을 반환합니다.

11) GET /api/script-customs/<name>
data/script_customs 폴더 안의 특정 .txt 대본을 읽어 텍스트로 반환합니다.
경로 이동은 막고 파일명 기준으로만 읽습니다.

12) POST /api/script-requests
대본 요청 JSON을 data/script_requests에 저장합니다.

13) GET /api/script-requests/latest
가장 최근 대본 요청 JSON을 반환합니다.

14) POST /api/refine-subtitles
기존 WAV를 faster-whisper로 보정합니다.

15) POST /api/convert-mp3
기존 WAV를 선택 설치된 ffmpeg로 MP3로 변환합니다.
변환 전 프론트에서는 ffmpeg GPL 라이선스 주의와 ZIP 미포함 고지를 두 번 확인합니다.
결과 MP3는 data 폴더에 저장되고 /audio/<name>.mp3로 다운로드됩니다.

16) GET /audio/<name>
data 폴더의 생성 결과 파일을 브라우저에 제공합니다.


15. 개발자가 주로 수정하는 파일

1) supertonic3-local-tts/src/app.py
Flask API, 파일 저장, 최신 산출물 복원, 대본 요청 저장, Whisper 보정 호출을 담당합니다.

2) supertonic3-local-tts/src/supertonic3_engine.py
Supertonic SDK 래퍼입니다.
모델 목록, 음성 목록, 언어 목록, 표현 태그 목록, 기본 옵션, TTS 호출 로직이 있습니다.

3) supertonic3-local-tts/ui/index.html
브라우저 UI 구조입니다.

4) supertonic3-local-tts/ui/main.js
대본 로드, 대본 요청 저장, 사용자 설정, TTS 생성, 작업 폴링, 샘플 재생, 다운로드 링크 갱신을 담당합니다.

5) supertonic3-local-tts/ui/style.css
화면 레이아웃, 다크/라이트 모드, 카드형 UI, 폰트 적용, 반응형 레이아웃을 담당합니다.

6) supertonic3-local-tts/public/scripts.json
대본 카탈로그입니다.
LLM이 대본을 만들 때 가장 자주 수정하는 파일입니다.

7) supertonic3-whisper-subtitles/whisper_subtitle_refiner.py
faster-whisper 기반 보정 로직입니다.

8) 실행.bat
Windows 실행 진입점입니다.
경로 자동 탐색, 업데이트 확인, 포트 중복 확인, 서버 실행을 담당합니다.


16. 테스트와 점검

1) Python 단위 테스트
supertonic3-local-tts 폴더에서 실행합니다.

.\.venv-win\Scripts\python.exe -m unittest discover -s tests

2) JavaScript 문법 확인

node --check ui\main.js

3) Python 문법 확인

.\.venv-win\Scripts\python.exe -m py_compile src\app.py src\supertonic3_engine.py src\supertonic3_cli.py

4) 실행.bat 점검
루트 폴더에서 실행합니다.

실행.bat --check --skip-update

다른 폴더에서도 절대경로로 호출할 수 있습니다.

"<내 컴퓨터의 배포 루트 경로>\실행.bat" --check --skip-update


17. 업데이트 확인과 업데이트 방법

1) 실행.bat 자동 확인
실행.bat은 시작 시 아래 패키지의 PyPI 버전 확인을 시도합니다.

supertonic
faster-whisper

새 버전이 감지되면 기본값은 바로 설치하지 않고 업데이트 여부를 묻습니다.
완전 자동 업데이트를 원하면 아래처럼 실행합니다.

실행.bat --auto-update

또는 환경 변수를 사용합니다.

set SUPERTONIC3_AUTO_UPDATE=1
실행.bat

--check 모드에서는 업데이트 가능 여부만 확인하고 설치는 하지 않습니다.

2) 확인이 실패하는 경우
인터넷 연결이 없거나 PyPI 접근이 막혀 있으면 확인 불가 메시지가 나옵니다.
이 경우 서버 실행 자체는 계속 가능합니다.

3) 수동 업데이트 명령
Supertonic SDK:

supertonic3-local-tts\.venv-win\Scripts\python.exe -m pip install -U supertonic

faster-whisper:

supertonic3-whisper-subtitles\.venv-win\Scripts\python.exe -m pip install -U faster-whisper

4) 업데이트 주의사항
업데이트 후 기존 옵션 이름이나 모델 동작이 바뀔 수 있으므로 짧은 테스트 대본으로 먼저 확인합니다.
Whisper 모델 파일은 Hugging Face 캐시에 저장되며, Windows에서 symlink 경고가 나올 수 있습니다.
symlink 경고는 보통 치명적 오류가 아니며 캐시 공간을 더 사용할 수 있다는 의미입니다.


18. 문제 해결

1) 페이지가 열리지 않을 때
서버가 켜져 있는지 확인합니다.
PowerShell/cmd에 오류가 표시되는지 확인합니다.
http://127.0.0.1:3093/health 에 접속해 봅니다.

2) 포트가 이미 사용 중일 때
실행.bat은 3093 포트 사용 여부를 확인하고, 이미 실행 중인 서버의 /health output_dir이 현재 폴더와 같은지 비교합니다.
같은 폴더이면 기존 서버를 사용하고, 다른 폴더이면 3094부터 빈 포트를 찾아 새 서버를 실행합니다.
수동 실행 시에는 SUPERTONIC3_PORT를 다른 값으로 바꿉니다.

3) "액세스 권한에 의해 숨겨진 소켓에 액세스를 시도했습니다"가 표시될 때
Windows가 해당 로컬 포트의 bind를 거부했다는 뜻입니다.
포트가 실제로 점유된 경우뿐 아니라 Hyper-V/WSL/VPN/보안 프로그램/Windows 예약 포트 때문에 생길 수 있습니다.
실행.bat은 이런 경우 3094부터 실제로 열 수 있는 포트를 찾아 우회합니다.
수동 실행 중이면 SUPERTONIC3_PORT를 3094, 3095 같은 값으로 바꿔 실행합니다.

4) [ERROR] Startup setup failed가 표시될 때
이 줄은 최종 요약 메시지입니다.
진짜 원인은 이 줄 위쪽 20~40줄 안에 있습니다.
실행.bat은 실패 단계와 힌트를 마지막에 다시 표시하도록 구성되어 있습니다.

자주 나오는 원인은 아래와 같습니다.

Python이 설치되어 있지 않거나 PATH에 없습니다.
Microsoft Store Python 별칭이 실제 Python 대신 잡혔습니다.
Python 버전이 너무 새로워 일부 wheel이 맞지 않습니다. Python 3.11 또는 3.12를 권장합니다.
pip가 인터넷, 방화벽, VPN, 백신, 회사망 정책 때문에 PyPI 또는 Hugging Face에 접속하지 못했습니다.
ZIP을 압축 해제하지 않고 압축 프로그램 안에서 바로 실행했습니다.
OneDrive, 네트워크 드라이브, 권한 제한 폴더에서 venv 생성 또는 파일 쓰기가 막혔습니다.
경로에 특수문자나 매우 긴 경로가 있어 일부 설치 도구가 실패했습니다.

사용자에게 요청할 로그:

마지막 세 줄만으로는 원인을 알 수 없습니다.
아래 줄부터 실패 지점까지 함께 보내 달라고 안내합니다.

[SETUP]
[ERROR]
[WARN]

빠른 확인 명령:

실행.bat --check --skip-update --skip-ffmpeg

5) TTS 생성이 오래 걸릴 때
대본 길이, total_step, max_chunk_length, CPU 성능에 영향을 받습니다.
긴 대본은 /api/tts-job으로 처리되며 상태 폴링이 필요합니다.

6) Failed to fetch가 날 때
짧은 요청용 /api/tts에서 시간이 너무 오래 걸리면 브라우저 요청이 끊길 수 있습니다.
현재 UI는 긴 대본을 자동으로 /api/tts-job 백그라운드 작업에 넘기도록 구성되어 있습니다.
오류 후에도 로그 창을 클릭하면 최신 산출물 복원을 시도할 수 있습니다.

7) cp949 codec 오류가 날 때
이모지나 일부 유니코드 문자가 Windows 콘솔 인코딩에서 문제를 만들 수 있습니다.
현재 엔진은 stdout/stderr를 UTF-8로 재설정하고 TTS 입력에서 일부 unsupported 문자를 제거합니다.
대본에는 이모지를 넣지 않는 것이 가장 안전합니다.

8) Whisper 보정이 느릴 때
medium은 정확도와 속도의 균형이지만 CPU에서는 오래 걸릴 수 있습니다.
빠른 확인은 small, 최종 품질은 large-v3를 고려합니다.

9) Whisper 버튼이 비활성화될 때
먼저 WAV 생성 결과가 UI에 연결되어 있어야 합니다.
출력 로그 창을 클릭하면 최신 산출물을 다시 연결하고 Whisper 보정 버튼이 활성화될 수 있습니다.

10) 새 대본이 드롭다운에 안 보일 때
public/scripts.json 문법을 확인합니다.
브라우저에서 대본 새로고침 버튼을 누릅니다.
text_url 경로가 실제 public 파일과 맞는지 확인합니다.

11) 폰트가 안 보일 때
supertonic3-local-tts/public/font 폴더의 Paperlogy TTF 파일이 있는지 확인합니다.

12) 이미지가 안 보일 때
아래 파일들이 public 폴더에 있는지 확인합니다.

public/only-cpu-can-generate.jpg
public/supertonic_3.jpg


19. 운영상 권장값

1) 일반 한국어 대본
voice: M1 또는 F1부터 비교
lang: ko
speed: 1.00~1.10
total_step: 8~12
max_chunk_length: 120
silence_duration: 0.3
whisper_refine: 필요할 때 켜기
기본값은 꺼짐이며, 최종 자막 싱크를 맞출 때만 켭니다.

2) 긴 낭독 대본
speed: 0.95~1.05
total_step: 10~12
max_chunk_length: 120~200
silence_duration: 0.3~0.5
표현 태그는 <breath>, <sigh> 위주로 소량 사용

3) 짧은 알림/안내
speed: 1.05~1.20
total_step: 8
max_chunk_length: 120~300
silence_duration: 0.2~0.3

4) 대화/연기형 대본
음성 샘플을 먼저 비교합니다.
감정 태그는 장면에 맞게 제한적으로 씁니다.
문장 단위를 짧게 유지합니다.


20. 라이선스와 출처 주의

1) 자세한 라이선스 고지 파일
이 배포 루트의 LICENSE_NOTICES.txt를 함께 보존합니다.
이 파일은 Supertonic GitHub 예제 코드, Supertonic 3 모델 가중치, faster-whisper, 로컬 통합 UI를 네 덩어리로 나누어 설명합니다.

2) 배포/다운로드 안내 페이지
https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide

3) 로컬 웹 UI 라이선스 고지 주소
http://127.0.0.1:3093/license-notices

4) Supertonic 공식 저장소와 라이선스
https://github.com/supertone-inc/supertonic

5) Supertonic 3 모델 라이선스
https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE

6) faster-whisper 공식 저장소
https://github.com/SYSTRAN/faster-whisper

7) 로컬 프로젝트 UI 출처 표기
웹 UI 상단에는 아래 출처 링크가 들어갑니다.

출처: 큐레이터 단비's 웹앱 아이디어 창고
https://min-inter.co.kr

8) 다운로드 페이지에 넣을 짧은 고지
이 ZIP은 공식 Supertonic 3와 faster-whisper를 활용한 로컬 통합 배포판입니다.
원본 코드, 모델 가중치, 의존 패키지는 각 원본 라이선스를 따릅니다.
생성 음성과 자막의 사용 책임은 사용자에게 있으며 사칭, 동의 없는 음성 복제, 기만, 괴롭힘, 불법 콘텐츠, 유해 콘텐츠 제작에 사용하면 안 됩니다.

9) 무료라는 표현 주의
무료 다운로드 또는 로컬 실행 가능이라는 말은 무제한 권리 부여가 아닙니다.
모델, 예제 코드, 의존 패키지, 생성물 책임은 각각 분리해서 안내해야 합니다.


21. 배포 ZIP 만들기

1) 권장 방식
반디집 같은 GUI 도구로 수동 압축하지 말고 scripts/create_release_zip.py를 사용합니다.
이 스크립트는 배포에 필요한 파일만 ZIP으로 묶고 SHA256 검증 파일과 manifest JSON을 함께 만듭니다.

2) 실행 명령
루트 폴더에서 아래 명령을 실행합니다.

supertonic3-local-tts\.venv-win\Scripts\python.exe scripts\create_release_zip.py --version 20260516

3) 생성 위치
결과물은 dist 폴더에 만들어집니다.

dist\supertonic3-local-tts-20260516.zip
dist\supertonic3-local-tts-20260516.zip.sha256
dist\supertonic3-local-tts-20260516.manifest.json

4) ZIP에 포함하는 것
README.md
README-ZIP-배포.md
README-Ver-업데이트현황.txt
README-맥-사용자-필독.txt
LICENSE_NOTICES.txt
실행.bat
sample.txt
supertonic-upstream
supertonic3-local-tts
supertonic3-whisper-subtitles
scripts/create_release_zip.py
supertonic3-local-tts\data 예제 산출물
supertonic3-local-tts\data\script_customs 예제 로컬 TXT 대본
supertonic3-local-tts\data\script_requests 예제 대본 요청 JSON

5) ZIP에서 제외하는 것
.venv, .venv-win, __pycache__, dist, node_modules, 서버 로그, pyc 파일은 제외합니다.
가상환경은 사용자 PC 경로에 묶일 수 있으므로 배포 ZIP에 넣지 않는 편이 안전합니다.
data 폴더의 WAV, SRT, VTT, TXT, Whisper 보정 결과는 예제 산출물로 포함할 수 있습니다.
script_customs는 사용자가 직접 넣는 로컬 TXT 대본 기능을 설명하는 예제 자료로 포함합니다.
script_requests도 대본 요청 기능을 설명하는 참고용 예제 자료로 포함합니다.

6) 해시 확인
업로드 페이지나 DB에는 zip.sha256 파일의 SHA256 값을 저장합니다.
사용자가 받은 ZIP의 SHA256과 이 값이 같아야 같은 파일입니다.
