Supertonic3 Local TTS 사용 안내

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

1. 프로젝트 폴더 구조

1) supertonic-upstream
Supertone 공식 Supertonic 저장소를 참고용으로 내려받아 둔 원본 자료입니다.
직접 실행하는 폴더가 아니라 README, 예제, 모델 호출 방식, 언어 목록, ONNX 흐름을 확인하는 기준 자료로 사용합니다.

2) supertonic3-local-tts
현재 사용하는 로컬 웹앱입니다.
Flask 서버가 브라우저 UI와 API를 제공하고, 설치된 supertonic Python SDK를 통해 Supertonic 3 TTS를 실행합니다.
생성된 WAV, 대본 TXT, 입력 로그, SRT, VTT, Whisper 보정 결과, 대본 요청 JSON은 data 폴더에 저장됩니다.

3) supertonic3-whisper-subtitles
faster-whisper 기반 자막 보정 도구입니다.
supertonic3-local-tts에서 만든 WAV를 다시 듣고 실제 음성 기준으로 *_whisper.srt, *_whisper.vtt, *_whisper.txt, *_whisper_log.txt를 만듭니다.

2. 서버 실행 방법

1) 가장 쉬운 Windows 실행
배포 루트 폴더의 실행.bat을 더블클릭합니다.
이 배치 파일은 Python, ffmpeg, .venv-win, 필수 pip 패키지를 확인하고 이미 있으면 건너뛰며, 없으면 가능한 범위에서 자동 준비합니다.
Python이 없고 winget이 있으면 Python 3.11 설치 여부를 묻습니다.
ffmpeg가 없고 winget이 있으면 설치 여부를 묻습니다.
ffmpeg는 TTS 생성 필수 조건이 아니며, 설치하지 않아도 웹앱 실행과 WAV 음성 생성은 가능합니다.
다만 MP3, M4A, MP4 같은 비-WAV 미디어 변환과 정확한 자막 싱크 워크플로우는 제한될 수 있습니다.
실행.bat은 Gyan.FFmpeg가 GPLv3 빌드라는 점을 고지하고, 이해 여부와 설치 동의를 두 번 확인한 뒤에만 설치를 진행합니다.
실행.bat은 출력 폴더를 현재 ZIP 폴더의 supertonic3-local-tts/data로 맞춥니다.
3093 포트에 이미 다른 폴더에서 띄운 서버가 있으면 그 서버를 재사용하지 않고 3094부터 빈 포트를 찾아 새 서버를 시작합니다.
3093 포트가 비어 있어도 Windows가 예약했거나 보안 도구가 막아 실제로 열 수 없으면 3094부터 접근 가능한 포트를 자동으로 찾습니다.

점검만 하고 서버를 띄우지 않으려면 루트 폴더에서 아래처럼 실행합니다.

실행.bat --check --skip-update --skip-ffmpeg

자동 준비를 건너뛰려면 아래 옵션을 붙입니다.

실행.bat --skip-bootstrap

2) Windows PowerShell
각자 프로젝트를 받은 위치가 다르므로 먼저 본인의 supertonic3-local-tts 폴더로 이동합니다.

cd <내 컴퓨터의 supertonic3-local-tts 경로>
$env:SUPERTONIC3_HOST = "127.0.0.1"
$env:SUPERTONIC3_PORT = "3093"
.\.venv-win\Scripts\python.exe src\app.py

접속 주소는 아래와 같습니다.

http://127.0.0.1:3093

끄려면 실행 중인 PowerShell 창에서 Ctrl+C를 누릅니다.

3) macOS/Linux 베타 루트 실행
맥은 개발자가 실기기로 검증하지 못했으므로 테스트 완료가 아니라 베타 지원입니다.
배포 루트 폴더에서 아래처럼 실행합니다.

chmod +x ./start-mac.sh
./start-mac.sh

Python 3.11 또는 3.12를 권장합니다.
Homebrew 사용자는 필요할 때 brew install python@3.11, brew install ffmpeg로 준비할 수 있습니다.
ffmpeg는 TTS WAV 생성 필수 조건은 아니며, 다양한 미디어 변환과 자막 싱크 작업에 필요할 수 있습니다.

4) Linux 또는 bash 수동 실행
각자 프로젝트를 받은 위치가 다르므로 먼저 본인의 supertonic3-local-tts 폴더로 이동합니다.

cd <내 컴퓨터의 supertonic3-local-tts 경로>
./start.sh

3. 기본 사용 흐름

1) 브라우저에서 http://127.0.0.1:3093 에 접속합니다.
2) 대본 드롭다운에서 public/scripts.json에 등록된 대본을 선택하거나 텍스트 영역에 직접 입력합니다.
3) 음성, 언어, 속도, 단계, 최대 청크, 청크 무음 값을 조정합니다.
4) 자주 쓰는 설정은 사용자 설정 Custom 1~5에 저장합니다.
5) 생성 버튼을 누르면 data 폴더에 WAV, 대본 TXT, 입력 로그 TXT, SRT, VTT가 저장됩니다.
6) Whisper 자막 보정은 기본값이 꺼짐입니다. 자막 싱크가 필요할 때 체크하면 생성 뒤 faster-whisper가 보정 자막을 추가로 만듭니다.
7) 기존 산출물을 다시 잡고 싶으면 출력 로그 창을 클릭합니다. 최신 WAV와 자막 다운로드 버튼이 다시 활성화됩니다.
8) 기존 WAV에 나중에 보정을 걸고 싶으면 출력 로그 창을 클릭한 뒤 Whisper 보정 실행 버튼을 누릅니다.

4. 음성 샘플 확인

1) 웹 UI의 음성 드롭다운 오른쪽에 있는 듣기 버튼을 누르면 현재 선택한 목소리의 샘플을 바로 들을 수 있습니다.
2) 입력 영역 아래의 음성 샘플 목록에서는 M1~M5 남성 5개, F1~F5 여성 5개를 각각 비교할 수 있습니다.
3) 각 샘플 컨트롤은 왼쪽 2/3가 재생, 오른쪽 1/3이 선택입니다.
4) 왼쪽 재생 영역은 샘플만 들려주고 현재 선택된 목소리는 바꾸지 않습니다.
5) 오른쪽 선택을 눌러야 드롭다운의 목소리가 바뀝니다.
6) 샘플 파일은 public/voice-samples 폴더에 있습니다.
7) 샘플 목록은 public/voice-samples.json에서 불러옵니다.
8) 샘플 대본 원문은 public/voice-samples/voice-test-ko.txt에 있습니다.
9) 샘플 WAV를 다시 만들 때는 supertonic3-local-tts 폴더에서 아래 명령을 실행합니다.

Windows PowerShell

cd <내 컴퓨터의 supertonic3-local-tts 경로>
.\.venv-win\Scripts\python.exe tools\generate_voice_samples.py

Linux 또는 bash

cd <내 컴퓨터의 supertonic3-local-tts 경로>
python tools/generate_voice_samples.py

5. 대본 요청함 로직

1) 이 기능의 목적
웹앱이 Codex, Cursor, 기타 AI를 API 없이 직접 호출하거나 자동 수신시키는 것은 불가능합니다.
대신 웹앱이 로컬 요청 파일을 남기고, 사용자가 AI 코딩툴에게 그 파일을 읽어 처리하라고 지시하는 구조를 사용합니다.
이 방식은 외부 AI API 키가 필요 없고, 로컬 파일만 사용하므로 단순하고 안전합니다.

2) 웹 UI에서 요청 저장
대본 요청 주제에 원하는 주제를 입력합니다.
톤, 분량, 대상, 추가 요청을 필요에 맞게 적습니다.
대본 요청 저장 버튼을 누릅니다.

3) 생성되는 파일
요청은 아래 폴더에 JSON으로 저장됩니다.

data/script_requests/

매 요청마다 고유 파일이 생깁니다.

data/script_requests/script_request_날짜_시간_고유값.json

가장 최근 요청은 항상 아래 파일에도 복사됩니다.

data/script_requests/latest.json

4) 요청 JSON에 들어가는 내용
topic에는 사용자가 입력한 주제가 들어갑니다.
tone에는 차분함, 따뜻함, 정보형 같은 톤이 들어갑니다.
length에는 3분, 5분 같은 목표 분량이 들어갑니다.
audience에는 일반 청취자, 직장인, 학생 같은 대상이 들어갑니다.
notes에는 포함할 키워드, 금지 표현, 문체 요청이 들어갑니다.
expression_tags에는 Supertonic 3 표현 태그 목록이 들어갑니다.
expression_tag_guidance에는 AI가 태그를 어디에, 얼마나, 어떤 감정에 맞게 넣어야 하는지에 대한 규칙이 들어갑니다.
recommended_output에는 AI가 만들 대본 TXT 경로와 scripts.json에 넣을 catalog_id가 들어갑니다.
ai_workflow와 prompt_for_ai에는 Codex나 Cursor가 따라야 할 처리 순서가 들어갑니다.

5) 대본 요청에 포함되는 표현 태그
대본 요청 JSON에는 아래 태그를 자연스럽게 삽입하라는 지시가 함께 저장됩니다.

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

6) Codex 또는 Cursor에서 처리하는 방법
웹 UI에서 대본 요청을 저장한 뒤 AI 코딩툴에게 아래처럼 말합니다.

최신 대본 요청함 JSON을 읽고, 조건에 맞는 Supertonic TTS용 대본을 만든 뒤 public/scripts.json에 등록해줘.

또는 더 짧게 이렇게 말해도 됩니다.

최신 대본 요청 처리해줘.

7) AI가 해야 하는 실제 작업
AI는 data/script_requests/latest.json을 읽습니다.
요청 조건에 맞는 대본을 작성합니다.
expression_tags와 expression_tag_guidance를 참고해 호흡, 웃음, 한숨, 놀람, 슬픔 같은 표현 태그를 적절히 삽입합니다.
대본 TXT 파일을 public 폴더에 저장합니다.
public/scripts.json에 새 항목을 추가합니다.
웹 UI에서 대본 새로고침을 누르면 새 대본이 드롭다운에 나타나야 합니다.

8) scripts.json에 등록되는 방식
새 대본은 보통 이런 구조로 등록합니다.

id: 요청 JSON의 recommended_output.catalog_id
title: 사용자가 알아볼 수 있는 대본 제목
description: 대본 설명
lang: ko
text_url: public 폴더에 저장한 대본 TXT 경로
voice, speed, total_step, max_chunk_length, silence_duration: 추천 TTS 설정

9) 중요한 제한
이 기능은 AI API 호출 기능이 아닙니다.
웹앱은 요청 파일만 남깁니다.
Codex, Cursor, 기타 AI 코딩툴은 사용자가 지시했을 때 그 파일을 읽고 처리합니다.
완전 자동으로 AI가 깨어나서 처리하려면 별도의 API, MCP 서버, 자동화 작업, 또는 에이전트 실행 환경이 필요합니다.

6. 자막과 보정 파일

1) 기본 자막
생성 버튼을 누르면 입력 대본 기준으로 같은 이름의 .srt와 .vtt가 만들어집니다.

2) Whisper 보정 자막
Whisper 보정은 실제 WAV를 다시 듣고 자막을 만듭니다.
결과 파일 이름은 아래와 같습니다.

*_whisper.srt
*_whisper.vtt
*_whisper.txt
*_whisper_log.txt

3) 현재 기본 보정 모델
현재 웹 UI에서 보정에 사용하는 모델은 medium입니다.
CPU 환경에서는 compute_type int8을 사용합니다.
빠르게 초안을 만들려면 small, 일반 작업은 medium, 최종 품질 우선은 large-v3를 사용합니다.

7. 개발자를 위한 전체 처리 로직

1) 서버 진입점
src/app.py가 Flask 앱을 만듭니다.
/ 경로는 ui/index.html을 반환합니다.
/assets 경로는 ui/main.js와 ui/style.css를 반환합니다.
/public 경로는 public 폴더의 이미지, 대본, 음성 샘플, scripts.json을 반환합니다.
/audio 경로는 data 폴더의 생성 결과 파일을 반환합니다.

2) 옵션 로드
브라우저는 시작 시 /health와 /api/options를 호출합니다.
/api/options는 src/supertonic3_engine.py의 option_metadata 값을 반환합니다.
여기에는 모델 목록, 음성 목록, 언어 목록, 표현 태그, 기본값, 제한값이 들어갑니다.

3) 대본 로드
브라우저는 public/scripts.json을 읽어 대본 드롭다운을 구성합니다.
대본 항목에 text_url이 있으면 해당 TXT 파일을 fetch해서 텍스트 영역에 넣습니다.
대본 항목에 추천 voice, speed, total_step, max_chunk_length, silence_duration이 있으면 현재 설정에 반영합니다.

4) 음성 샘플 로드
브라우저는 public/voice-samples.json을 읽어 샘플 컨트롤을 만듭니다.
왼쪽 2/3 영역은 단순 재생입니다.
오른쪽 1/3 선택 버튼을 눌러야 실제 voice 드롭다운 값이 바뀝니다.
샘플 WAV 파일은 public/voice-samples 폴더에 있습니다.

5) 생성 요청
브라우저는 입력 텍스트와 설정값을 모아 payload를 만듭니다.
짧은 텍스트는 /api/tts로 보냅니다.
긴 텍스트는 /api/tts-job으로 보내고 /api/tts-job/<job_id>를 폴링합니다.
생성 결과는 applyTtsResult가 오디오 플레이어와 다운로드 버튼에 연결합니다.

6) 서버 TTS 처리
서버는 _parse_tts_payload로 모델, 음성, 언어, 속도, 단계, 청크, 무음, 스레드 값을 정리합니다.
run_tts_generation은 sanitize_tts_text로 이모지와 일부 제어 문자를 제거합니다.
Supertonic3Engine.synthesize_to_file이 supertonic Python SDK를 호출합니다.
생성된 WAV 옆에 대본 TXT, 입력 로그 TXT, SRT, VTT를 만듭니다.

7) 최신 산출물 복원
생성 중 브라우저가 끊기거나 Failed to fetch가 나도 data 폴더에 결과가 남아 있을 수 있습니다.
출력 로그 창을 클릭하면 /api/latest-output을 호출해 최신 WAV와 sidecar 파일을 다시 연결합니다.
이 로직은 긴 대본 생성 후 화면 상태를 복원할 때 중요합니다.

8) Whisper 보정
Whisper 보정이 켜져 있으면 생성 뒤 /api/refine-subtitles를 호출합니다.
서버는 SUPERTONIC3_WHISPER_DIR 또는 상위 폴더의 supertonic3-whisper-subtitles를 찾아 whisper_subtitle_refiner.py를 실행합니다.
결과로 *_whisper.srt, *_whisper.vtt, *_whisper.txt, *_whisper.json, *_whisper_log.txt가 생성됩니다.

8. LLM 대본 요청 처리 방식

1) 핵심 구조
웹앱은 Codex, Cursor, 기타 LLM을 직접 호출하지 않습니다.
웹앱은 요청 JSON만 로컬 파일로 남깁니다.
사용자가 LLM 코딩 도구에게 그 JSON을 읽고 처리하라고 지시해야 합니다.
즉, 이 기능은 API 연동이 아니라 로컬 파일 기반 작업 큐입니다.

2) 요청 생성
사용자가 웹 UI에서 대본 요청 주제, 톤, 분량, 대상, 추가 요청을 입력하고 대본 요청 저장을 누릅니다.
서버는 data/script_requests 폴더에 고유 JSON 파일을 저장합니다.
가장 최근 요청은 항상 data/script_requests/latest.json에도 복사합니다.

3) 요청 JSON 주요 필드
topic: 사용자가 원하는 주제
tone: 차분함, 따뜻함, 정보형 등 요청 톤
length: 3분, 5분 등 목표 분량
audience: 일반 청취자, 직장인, 학생 등 대상
notes: 포함할 키워드, 금지 표현, 문체 요청
recommended_output.text_file: LLM이 대본 TXT를 저장할 추천 경로
recommended_output.catalog_id: public/scripts.json에 등록할 추천 ID
expression_tags: 사용할 수 있는 Supertonic 3 표현 태그 목록
expression_tag_guidance: 표현 태그를 어떻게 넣어야 하는지에 대한 규칙
ai_workflow: LLM이 따라야 할 단계
prompt_for_ai: 사용자가 LLM에게 그대로 말해도 되는 요약 지시문

4) LLM에게 하는 지시 예시
아래처럼 말하면 됩니다.

최신 대본 요청 처리해줘.

또는 더 구체적으로 말합니다.

data/script_requests/latest.json을 읽고 조건에 맞는 Supertonic TTS용 대본을 작성한 뒤 public/scripts.json에 등록해줘.

5) LLM이 해야 하는 작업
data/script_requests/latest.json을 읽습니다.
topic, tone, length, audience, notes를 해석합니다.
expression_tags와 expression_tag_guidance를 참고합니다.
TTS가 읽기 좋은 평문 대본을 작성합니다.
recommended_output.text_file 경로에 대본 TXT를 저장합니다.
public/scripts.json의 scripts 배열에 새 항목을 추가합니다.
웹 UI에서 대본 새로고침을 누르면 새 대본이 선택 가능해야 합니다.

6) scripts.json 등록 권장 필드
id: recommended_output.catalog_id
title: 사용자가 알아볼 제목
description: 대본 설명
lang: ko
text_url: 브라우저가 fetch할 대본 TXT URL
voice: 추천 음성
speed: 추천 속도
total_step: 추천 단계
max_chunk_length: 추천 최대 청크
silence_duration: 추천 무음 길이
whisper_refine: Whisper 보정 여부

7) LLM 처리 후 선택 사항
요청 JSON의 status를 completed로 바꿀 수 있습니다.
generated_script, updated_catalog, completed_at 같은 필드를 추가하면 추적이 쉽습니다.
단, 웹앱은 completed 상태를 필수로 요구하지 않습니다.

9. 표현 태그 사용 규칙

1) 사용 가능한 태그
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

2) 일반 규칙
표현 태그는 감정이나 호흡이 필요한 지점에만 넣습니다.
짧은 대본은 1~3개 정도만 사용합니다.
긴 대본은 장면 전환이나 감정 변화가 있는 지점에 소량만 넣습니다.
설명문에는 <breath>, <sigh> 위주가 안전합니다.
대화형 대본에는 <laugh>, <surprise>, <sad>, <angry>를 문맥에 맞게 넣을 수 있습니다.
<scream>, <cough>, <yawn>, <throatclear>는 의도가 분명한 장면에서만 사용합니다.

3) LLM 대본 작성 주의
태그를 많이 넣으면 음성이 어색해질 수 있습니다.
문장 중간보다 문장 사이 또는 감정 전환 지점이 안정적입니다.
이모지와 Markdown 장식은 넣지 않는 것이 좋습니다.
TTS 입력은 평문이 가장 안정적입니다.

10. 주요 API 목록

1) GET /
웹 UI를 반환합니다.

2) GET /health
서버 상태와 output_dir를 반환합니다.

3) GET /api/options
모델, 음성, 언어, 표현 태그, 기본값, 제한값을 반환합니다.

4) POST /api/tts
짧은 텍스트를 즉시 생성합니다.

5) POST /api/tts-job
긴 텍스트를 백그라운드 작업으로 등록합니다.

6) GET /api/tts-job/<job_id>
백그라운드 작업 상태를 조회합니다.

7) GET /api/latest-output
data 폴더에서 최신 WAV와 관련 파일을 찾아 복원합니다.

8) POST /api/script-requests
대본 요청 JSON을 저장합니다.

9) GET /api/script-requests/latest
가장 최근 대본 요청 JSON을 반환합니다.

10) POST /api/refine-subtitles
기존 WAV를 faster-whisper로 보정합니다.

11) GET /audio/<name>
data 폴더의 생성 결과 파일을 제공합니다.

11. 개발 및 유지보수 주의사항

1) public/scripts.json 수정
JSON 문법을 반드시 유지해야 합니다.
기존 scripts 배열을 덮어쓰거나 지우지 않습니다.
id는 중복되지 않아야 합니다.
긴 대본은 scripts.json에 직접 넣기보다 public/*.txt 파일로 저장하고 text_url로 연결하는 것이 좋습니다.

2) 파일 삭제 금지
data 폴더, public 대본, scripts.json, voice-samples 파일은 사용자가 생성한 산출물일 수 있습니다.
명시 요청 없이는 삭제하지 않습니다.

3) Windows 인코딩
이모지나 일부 유니코드 문자는 cp949 환경에서 오류를 만들 수 있습니다.
현재 코드는 stdout/stderr를 UTF-8로 맞추고 TTS 입력을 sanitize하지만, 대본 자체에는 이모지를 쓰지 않는 것이 안전합니다.

4) 긴 대본
긴 대본은 브라우저 요청 시간이 길어질 수 있으므로 /api/tts-job 백그라운드 작업을 사용합니다.
오류가 나도 data 폴더에 결과가 남아 있으면 출력 로그 클릭으로 복원할 수 있습니다.

5) Whisper 속도
medium 모델은 CPU에서 시간이 걸릴 수 있습니다.
빠른 확인은 small, 일반 작업은 medium, 최종 품질 우선은 large-v3를 사용합니다.

6) 업데이트
루트 실행.bat은 supertonic과 faster-whisper 버전 확인을 시도합니다.
새 버전이 감지되면 기본값은 바로 설치하지 않고 업데이트 여부를 묻습니다.
완전 자동 업데이트를 원하면 실행.bat --auto-update 또는 SUPERTONIC3_AUTO_UPDATE=1을 사용합니다.
--check 모드에서는 업데이트 가능 여부만 확인하고 설치는 하지 않습니다.
네트워크가 막히면 확인 불가 메시지가 나올 수 있지만 서버 실행 자체와는 별개입니다.

7) 테스트
수정 뒤 아래 명령으로 확인합니다.

node --check ui\main.js
.\.venv-win\Scripts\python.exe -m unittest discover -s tests
.\.venv-win\Scripts\python.exe -m py_compile src\app.py src\supertonic3_engine.py src\supertonic3_cli.py

8) 라이선스와 저작권 고지
배포 루트의 LICENSE_NOTICES.txt를 함께 보존합니다.
이 로컬 앱은 Supertonic GitHub 예제 코드, Supertonic 3 모델 가중치, faster-whisper, 로컬 통합 UI를 한 화면에 묶지만 각 층의 라이선스는 서로 다릅니다.
다운로드 페이지에는 원본 프로젝트 링크, 모델 사용 제한, 생성 음성 책임, 사칭 및 동의 없는 음성 복제 금지 문구를 함께 표시합니다.
배포/다운로드 안내 페이지는 아래 주소입니다.
https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide
로컬 웹 UI에서는 아래 주소로 라이선스 고지를 열 수 있습니다.
http://127.0.0.1:3093/license-notices

9) 배포 ZIP 생성
배포 루트에서 scripts/create_release_zip.py를 실행합니다.
이 스크립트는 .venv, .venv-win, 서버 로그를 제외하고 ZIP, SHA256, manifest JSON을 만듭니다.
data 폴더의 WAV, SRT, VTT, TXT, Whisper 보정 결과는 예제 산출물로 포함할 수 있습니다.
