Supertonic3 Local TTS 공개 업데이트 현황

README-Ver에 분리 규칙 스킬 기록: separation.md

================================================================================
20260616-r2 (2026-06-16) — 실행.bat 한방 실행 개선
================================================================================

비교 기준: 20260616-r1 -> 20260616-r2

한 줄 요약:
실행.bat Python 탐지를 py -0p 실경로 기반으로 전면 교체, hermes/venv PATH 오탐 제거,
venv 생성 실검증, TTS 성공 Python Whisper 재사용.

주요 변경:
1) py -3.12 가짜 탐지 제거 → py -0p + LocalAppData 표준 경로만 사용
2) where python 필터: \venv\, hermes-agent, WindowsApps 등 제외
3) venv: import 검사가 아닌 실제 -m venv 성공 여부로 판단
4) winget은 venv 실패 후에만 시도 (한방 실행 우선)
5) VENV_CREATOR_PY: TTS venv 성공 Python을 Whisper에 재사용
6) Python 3.10~3.14 지원, 브라우저 URL !PORT! delayed expansion

배포:
- SHA256: 459f48912292edc03cc3af92079d6bba805a90cfeea34817fefb9fa3d3b43dcb
- CDN: https://img.min-inter.co.kr/program/supertonic3-local-tts/20260616-r2/supertonic3-local-tts-20260616-r2.zip
- D1: program-supertonic3-free-local-tts-zip-guide-20260616-r2

================================================================================
20260616-r1 (2026-06-16) — 잘못된 r1/r2 공개 ZIP 수정
================================================================================

비교 기준: 20260615-r2 -> 20260616-r1

한 줄 요약:
Studio UI 복원, Python venv 다중 버전 재시도, Server 전용 기능(rate limit/AdSense) 로컬 분리,
패키징 후 validate_release 자동 실행.

주요 변경:
1) ui: Supertonic Studio (Personal TTS API 제거)
2) 실행.bat / start-mac.sh: Python 3.12~3.10~3.13·py -3 venv 재시도, SUPERTONIC3_PUBLIC_MODE=0
3) app.py: SUPERTONIC3_PUBLIC_MODE=1 일 때만 rate limit·ads·usage-log API (로컬 ZIP 기본 off)
4) create_release_zip.py: 002_Public·Studio UI 사전 검사
5) build_release.ps1: ZIP 생성 후 validate_release.py 필수 PASS

================================================================================
20260616 — 폴더 재배치 (001_Server / 002_Public)
================================================================================

- 001_Server/ : Docker 공개 TTS API (Personal TTS API UI, rate limit, ads.txt)
- 002_Public/ : 로컬 ZIP 소스 (Supertonic Studio UI, 실행.bat, packaging/)
- 이전 900_supertonic3-tts/ 통합 폴더 해체
- 002_Public UI: 20260520-r2 Studio 복원 + 최신 src 오버레이
- 스킬: separation.md — Public만 패키징, Server Docker 전용, 혼합 금지
- validate: Studio UI 필수, Server UI(AdSense 등) ZIP 내 FAIL

================================================================================
20260615-r2 (2026-06-15) — 20260615-r1 대비
================================================================================

비교 기준: 20260615-r1 -> 20260615-r2

한 줄 요약:
실행.bat이 Python 3.11만 고집하지 않고 3.12/3.11/3.10/3.13/py -3 순으로 venv 생성을
재시도합니다. py 런처가 3.11을 잘못 탐지해도 다른 버전으로 자동 전환됩니다.

주요 변경:
1) find_system_python: venv 모듈까지 검증, 3.12 우선 탐색
2) ensure_venv: 한 버전 실패 시 다음 후보로 venv 재시도 (즉시 종료하지 않음)
3) winget 자동 설치: Python 3.12 우선, 실패 시 3.11 재시도

================================================================================
20260615-r1 (2026-06-15) — 20260520-r2 대비
================================================================================

비교 기준: 20260520-r2 -> 20260615-r1

한 줄 요약:
공개 API 운영(프라이버시·사용 로그·라이선스 UI), supertonic/onnxruntime 의존성 안정화,
패키징 스크립트 UTF-8·예제 데이터 오버레이·공개/로컬 구분 제외 규칙을 반영한 배포본입니다.

주요 변경:
1) 프라이버시 모듈(privacy.py): sidecar 미저장, ephemeral 오디오 TTL 옵션
2) 사용 로그(usage_log.py): 글자 수·작업 유형만 SQLite 기록, IP/본문 미저장
3) 라이선스 전용 페이지(ui/license.html, license.js) 및 FFmpeg/SaaS 고지 보강
4) requirements.txt: onnxruntime, huggingface-hub 명시 / supertonic import 오류 메시지 개선
5) 공개 API는 테스트·검증용, 본격 사용은 로컬 ZIP 권장 — LICENSE_NOTICES·UI 문구 반영
6) 패키징: create_release_zip.py 한글 파일명 복구, ads.txt·docker·*.sqlite 제외,
   docs 스냅샷 예제 산출물 오버레이, --output-dir 지원

ZIP에서 제외(로컬 배포본):
- ads.txt (공개 서버 AdSense 전용)
- docker/ (Docker 배포는 별도 compose)
- usage_log.sqlite, *.sqlite

================================================================================
20260520-r1 (작성일: 2026-05-20) — 20260517-r4 대비
================================================================================

작성일: 2026-05-20
비교 기준: 20260517-r4 -> 20260520-r1

1. 문서 목적

이 문서는 배포 사용자가 20260517-r4와 20260520-r1의 차이를 숨김 없이 확인할 수 있도록 작성한 공개 업데이트 기록입니다.
기능 추가, 버그 수정, 사용자 영향, 주의사항, 변경 파일을 구분해서 적습니다.

기준이 되는 이전 배포본은 아래 스냅샷입니다.

<배포 작업 루트>\docs\supertonic3-local-tts-20260517-r4

현재 배포 후보는 루트 작업본입니다.

<배포 작업 루트>

참고: 이 파일은 2026-05-20 작업 시작 시점에 0바이트 빈 파일이었습니다.
따라서 기존 문장을 수정한 것이 아니라, r4 스냅샷과 현재 작업본을 비교해 새로 작성한 업데이트 문서입니다.

2. 한 줄 요약

20260517-r4는 경로 고정 문제, 위스퍼 기본값, 런타임 표시, 라이선스/배포 문서를 정리한 안정화 버전입니다.
20260520-r1은 Windows에서 3093 포트가 예약되어 서버가 죽는 문제를 우회하고, 업데이트 감지만 하던 배치파일을 사용자 선택형 자동 업데이트 구조로 개선한 버전입니다.

3. 사용자에게 보이는 주요 차이

1) 서버 실행 포트 자동 우회가 강화되었습니다.

20260517-r4:
3093 포트에 이미 실행 중인 서버가 있으면 /health의 output_dir을 비교했습니다.
같은 폴더의 서버이면 재사용하고, 다른 폴더이면 3094부터 빈 포트를 찾았습니다.
하지만 포트가 LISTENING 상태가 아니더라도 Windows가 예약해 bind 자체를 거부하는 경우는 잡지 못했습니다.

20260520-r1:
서버 실행 전에 실제로 127.0.0.1:3093 포트를 열 수 있는지 bind 테스트를 합니다.
Windows 예약 포트, Hyper-V, WSL, VPN, 보안 프로그램 등으로 3093이 막혀 있으면 3094부터 65535까지 실제로 열 수 있는 포트를 찾습니다.
이 작업 환경에서는 Windows가 3063-3162 구간을 예약하고 있어서 3093이 실패했습니다.
대체 포트는 실행 시점에 실제로 비어 있고 bind 가능한 값으로 결정되며, 예를 들면 3163 또는 3164처럼 표시될 수 있습니다.

사용자 영향:
실행 중 아래 오류가 나던 환경에서도 배치파일이 자동으로 우회 포트를 찾습니다.

액세스 권한에 의해 숨겨진 소켓에 액세스를 시도했습니다

예상 출력:

[WARN] Port 3093 cannot be opened on 127.0.0.1.
[WARN] Windows may have reserved this port, or a security/network tool may be blocking it.
[INFO] This copy will start on port 3163 instead.

위 숫자는 예시입니다.
이 경우 접속 주소는 http://127.0.0.1:3163 처럼 배치파일이 표시한 포트를 사용합니다.

2) --check 모드도 포트 상태를 확인합니다.

20260517-r4:
--check는 설치 상태와 경로 위주로 확인했습니다.
3093 포트가 실제로 열리는지까지는 확인하지 않았습니다.

20260520-r1:
--check에서도 3093 bind 가능 여부를 확인합니다.
막혀 있으면 서버를 띄우지 않고도 fallback 포트를 알려줍니다.

예상 출력:

[WARN] Port 3093 cannot be opened on 127.0.0.1.
[OK] Fallback port available: 3163
[OK] Check completed. The server was not started because --check was used.

위 숫자는 예시이며, 실제 값은 실행 시점에 달라질 수 있습니다.

3) 업데이트 감지 후 설치 흐름이 추가되었습니다.

20260517-r4:
Supertonic TTS SDK와 faster-whisper의 INSTALLED / LATEST 버전을 보여주고, 수동 업데이트 명령만 출력했습니다.
실제 pip install -U는 실행하지 않았습니다.

20260520-r1:
새 버전이 감지되면 기본값은 사용자에게 업데이트 여부를 묻습니다.
사용자가 Y를 누르면 해당 venv 안에서 pip install -U를 실행합니다.

자동 업데이트가 필요한 경우 아래 옵션을 사용할 수 있습니다.

실행.bat --auto-update

또는 환경 변수로 설정할 수 있습니다.

set SUPERTONIC3_AUTO_UPDATE=1
실행.bat

사용자 영향:
업데이트 감지만 되는 것처럼 보이던 혼란을 줄였습니다.
다만 SDK나 faster-whisper 업데이트는 upstream 동작이 바뀔 수 있으므로, 기본값은 사용자 확인 후 설치입니다.

4) --check 모드에서는 업데이트를 설치하지 않습니다.

20260520-r1에서도 --check는 점검 모드입니다.
업데이트 가능 여부를 표시하더라도 설치는 하지 않습니다.
실제 설치 변경 없이 상태만 확인하려는 사용자에게 안전한 동작입니다.

5) Flask 서버 오류 메시지가 명확해졌습니다.

20260517-r4:
Windows가 포트 접근을 거부하면 Flask/Windows 기본 오류가 그대로 표시되었습니다.

20260520-r1:
WinError 10013 계열 오류를 잡아 아래 의미가 드러나도록 설명합니다.

Cannot open http://127.0.0.1:3093.
Windows denied access to that local port.
Use another SUPERTONIC3_PORT value or run 실행.bat so it can choose a fallback port.

사용자 영향:
TTS 엔진 오류인지, Python 오류인지, 포트 오류인지 구분하기 쉬워졌습니다.

4. 변경 파일 목록

1) 실행.bat

변경 성격:
실행 안정성 개선, 업데이트 설치 흐름 추가.

주요 변경:
--auto-update 옵션 추가.
SUPERTONIC3_AUTO_UPDATE=1 환경 변수 지원.
서버 실행 전 포트 bind 테스트 추가.
3093이 Windows 예약 포트이거나 보안 도구에 막힌 경우 fallback 포트 자동 검색.
기존 find_free_port 로직을 netstat 기반의 단순 LISTENING 검사에서 실제 TcpListener bind 검사로 강화.
--check 모드에서도 fallback 포트 확인.
업데이트 감지 시 사용자에게 설치 여부 확인.
자동 업데이트 모드에서는 확인 없이 pip install -U 실행.
업데이트 실패 시 서버 실행을 완전히 중단하지 않고 현재 설치 버전으로 계속 진행.

2) supertonic3-local-tts/src/app.py

변경 성격:
오류 메시지 개선.

주요 변경:
Flask app.run 중 Windows 포트 접근 거부 오류를 감지합니다.
WinError 10013 또는 errno 13/10013인 경우 원인과 해결 방향을 stderr에 출력합니다.

3) README.md

변경 성격:
사용자 문서 업데이트.

주요 변경:
3093 포트가 비어 보여도 Windows 예약으로 bind가 거부될 수 있음을 설명.
자동 fallback 포트 검색 설명 추가.
--auto-update 옵션 설명 추가.
SUPERTONIC3_AUTO_UPDATE 환경 변수 설명 추가.
--check 모드에서는 업데이트를 설치하지 않는다는 설명 추가.

4) supertonic3-local-tts/README.md

변경 성격:
로컬 앱 세부 문서 업데이트.

주요 변경:
포트 예약/접근 거부 상황 설명.
업데이트 감지 후 사용자 선택 설치, --auto-update, SUPERTONIC3_AUTO_UPDATE 설명 추가.

5) README-ZIP-배포.md

변경 성격:
배포 안내 문서 업데이트.

주요 변경:
포트 bind 거부 시 fallback 포트를 찾는 배치파일 동작 설명.
업데이트 감지 후 설치 방식 설명.

6) docs/README-ZIP-배포-방법-현황.md

변경 성격:
내부 작업용 배포 현황 문서 업데이트.

주요 변경:
Windows 예약 포트와 bind 거부 처리 기록.
업데이트 감지/설치 흐름 기록.
이 문서는 배포 ZIP에는 포함하지 않습니다.

7) scripts/create_release_zip.py

변경 성격:
배포 포함 파일 목록 업데이트.

주요 변경:
README-Ver-업데이트현황.txt를 ZIP 루트 포함 대상에 추가했습니다.
사용자가 ZIP을 받은 뒤에도 r4와 20260520-r1 차이를 직접 확인할 수 있게 하기 위한 조치입니다.

5. 기능 변화가 없는 영역

아래 영역은 20260517-r4 대비 20260520-r1에서 의도적으로 변경하지 않았습니다.

1) Supertonic 3 TTS 생성 엔진의 합성 로직
2) 음성 목록과 샘플 음성 연결 UI
3) 대본 선택 UI와 샘플 대본 구조
4) 위스퍼 보정 기본값
5) 런타임 아코디언 기본 펼침 상태
6) 라이선스 고지 본문
7) 생성 WAV, SRT, VTT, TXT, JSON, 입력 로그 저장 구조
8) LLM 대본 요청 파일 저장 구조

즉, 20260520-r1은 음성 품질이나 UI 사용 흐름을 크게 바꾸는 버전이 아니라 실행 안정성과 업데이트 설치 흐름을 보강한 유지보수 버전입니다.

6. 검증 내용

아래 검증을 수행했습니다.

1) 배치파일 점검

명령:

실행.bat --check --skip-update --skip-ffmpeg

결과:
통과.
현재 환경에서 3093이 Windows 예약 포트로 막힌 것을 감지했고, 3163 이후의 사용 가능한 fallback 포트를 찾았습니다.

2) 업데이트 확인 점검

명령:

실행.bat --check --skip-ffmpeg

결과:
통과.
네트워크 또는 PyPI 접근이 제한된 경우 업데이트 확인 실패 메시지를 출력하고 서버 실행 가능 상태는 유지했습니다.
--check 모드이므로 설치는 수행하지 않았습니다.

3) Python 테스트

명령:

supertonic3-local-tts\.venv-win\Scripts\python.exe -m unittest discover -s supertonic3-local-tts\tests

결과:
20개 테스트 통과.

4) app.py 문법 확인

명령:

supertonic3-local-tts\.venv-win\Scripts\python.exe -m py_compile supertonic3-local-tts\src\app.py

결과:
통과.

5) 실행.bat 줄바꿈 확인

결과:
CRLF 줄바꿈 유지.
LF-only 줄바꿈 없음.
BOM 없음.

7. 알려진 주의사항

1) 자동 업데이트는 인터넷과 PyPI 접근이 필요합니다.

회사망, 방화벽, 오프라인 환경에서는 pip index versions 또는 pip install -U가 실패할 수 있습니다.
이 경우 서버 실행 자체와는 별개로 처리됩니다.

2) SDK 업데이트는 음성 합성 결과에 영향을 줄 수 있습니다.

supertonic 패키지의 새 버전은 옵션 이름, 내부 기본값, 모델 호출 방식이 바뀔 수 있습니다.
공개 콘텐츠 제작 전에는 짧은 테스트 대본으로 먼저 확인하는 것이 좋습니다.

3) faster-whisper 업데이트는 자막 보정 결과에 영향을 줄 수 있습니다.

모델 로딩, VAD, timestamp 처리, 의존성 버전이 달라질 수 있습니다.
정밀 자막 작업 전에는 기존 WAV로 SRT/VTT를 다시 생성해 비교하는 것이 좋습니다.

4) 모든 로컬 포트가 막힌 경우에는 자동 fallback도 실패할 수 있습니다.

20260520-r1은 3094부터 65535까지 실제로 열 수 있는 포트를 찾습니다.
그래도 실패한다면 Windows 네트워크 정책, 보안 프로그램, 관리자 권한, 포트 예약 상태를 확인해야 합니다.

5) 20260520-r1은 r4 ZIP의 내용 전체를 다시 설계한 버전이 아닙니다.

핵심 변경은 실행 안정성, 업데이트 흐름, 문서 투명성입니다.
UI 대규모 개편이나 TTS 합성 품질 변경은 포함하지 않았습니다.

8. 배포 파일 확인 방법

20260517-r4 ZIP:

dist\supertonic3-local-tts-20260517-r4.zip

SHA256:

0651a2d946c74cc23dfcc8648b0a174d16527f688a6b0b3209b718bcda69fd6f

20260520-r1 ZIP은 생성 후 아래 파일로 해시를 확인합니다.

dist\supertonic3-local-tts-20260520-r1.zip.sha256

ZIP 내부에는 이 업데이트 문서가 루트 파일로 포함됩니다.

9. 결론

20260517-r4에서 20260520-r1로 넘어가는 핵심 이유는 두 가지입니다.

1) Windows 예약 포트 때문에 3093 서버 실행이 실패하는 문제를 자동 우회하기 위해서입니다.
2) 업데이트 버전 감지만 되고 실제 설치가 되지 않는 혼란을 줄이기 위해, 사용자 선택형 업데이트와 자동 업데이트 옵션을 추가하기 위해서입니다.

따라서 20260520-r1은 신규 기능을 크게 늘린 버전이라기보다, 배포 사용자가 처음 실행할 때 막히는 지점을 줄이고 운영 문서를 투명하게 만든 유지보수 릴리스입니다.


10. 2026-05-20 최종 배포 후보 추가 변경

아래 내용은 20260520-r1 문서 작성 뒤, 같은 날짜에 배포 직전까지 추가로 반영한 변경 사항입니다.
최종 ZIP을 만들기 전 기준의 작업본 상태를 투명하게 남깁니다.

1) macOS 사용자 필독 문서가 추가되었습니다.

추가 파일:

README-맥-사용자-필독.txt
start-mac.sh

핵심 내용:
이 ZIP은 Windows 사용자를 우선 대상으로 만든 배포본입니다.
macOS는 개발자가 실기기로 검증하지 못했습니다.
맥 사용자는 start-mac.sh를 참고할 수 있지만, 공식 지원 완료가 아니라 베타 편의 스크립트로 봐야 합니다.
문제가 생기면 Python, Homebrew, ffmpeg, Git LFS, ONNX Runtime, 경로 문제를 직접 확인하고 코드를 수정해서 사용해야 한다고 명확히 안내했습니다.

사용자 영향:
맥 사용자에게 “될 수도 있다”가 아니라 “미검증이며 직접 수정 필요”라는 기대치를 명확히 전달합니다.

2) 우측 상단 링크 구조를 정리했습니다.

변경 파일:

supertonic3-local-tts/ui/index.html
supertonic3-local-tts/ui/style.css

현재 상단 구조:

출처: 큐레이터 단비's 웹앱 아이디어 창고 - 배포 안내(Guide) | 라이선스(License)
모델 라이선스(Model License) | Supertonic GitHub | faster-whisper GitHub
미포함된 소스코드 | FFmpeg 선택설치 소스(Gyan) | FFmpeg 라이선스(Legal)
라이트(Light) | 준비됨(ready) - supertonic3-local

핵심 내용:
출처와 배포 안내 링크를 하나로 합쳤습니다.
Supertonic 3 모델 라이선스 링크를 추가했습니다.
Supertonic GitHub와 faster-whisper GitHub 링크를 유지했습니다.
FFmpeg는 ZIP에 포함된 소스코드가 아니므로 “미포함된 소스코드” 줄로 따로 구분했습니다.
FFmpeg 선택 설치 소스(Gyan)와 FFmpeg 라이선스(Legal)를 연결했습니다.
라이트/상태 표시는 링크가 아니라 작은 상태 카드 형태로 분리했습니다.

사용자 영향:
포함된 코드/모델과 미포함 선택 설치 도구인 FFmpeg를 시각적으로 구분할 수 있습니다.

3) MP3 변환 버튼이 추가되었습니다.

변경 파일:

supertonic3-local-tts/src/app.py
supertonic3-local-tts/ui/index.html
supertonic3-local-tts/ui/main.js
supertonic3-local-tts/ui/style.css
supertonic3-local-tts/tests/test_app.py
README.md
LICENSE_NOTICES.txt

새 API:

POST /api/convert-mp3

동작:
생성된 WAV를 사용자의 PC에 설치된 ffmpeg로 MP3로 변환합니다.
결과 MP3는 supertonic3-local-tts/data 폴더에 WAV와 같은 이름의 .mp3 파일로 저장됩니다.
브라우저에서 MP3 다운로드를 자동으로 시도합니다.
변환 로그는 *_mp3_convert_log.txt 형식으로 저장될 수 있습니다.

짧아진 확인창 고지:

개인 사용 OK
ZIP에 ffmpeg 미포함
내 PC의 ffmpeg로 변환
재배포 시 라이선스 확인

사용자 영향:
ffmpeg가 설치된 사용자라면 웹 UI에서 WAV를 MP3로 바로 바꿀 수 있습니다.
ffmpeg가 없으면 변환은 실패하지만 TTS WAV 생성에는 영향이 없습니다.
ffmpeg는 ZIP에 포함되지 않으며, 배포 시 GPL/LGPL 조건을 별도로 확인해야 합니다.

4) 최신 산출물 복원에 MP3 파일도 연결되도록 했습니다.

변경 파일:

supertonic3-local-tts/src/app.py
supertonic3-local-tts/ui/main.js

핵심 내용:
로그 창을 클릭하거나 /api/latest-output으로 최신 산출물을 복원할 때, 같은 이름의 .mp3와 *_mp3_convert_log.txt가 있으면 다운로드 URL을 함께 복원합니다.

사용자 영향:
이미 변환해 둔 MP3를 다시 받기 쉽습니다.

5) 배포 ZIP 포함 규칙이 조정되었습니다.

변경 파일:

scripts/create_release_zip.py
README-ZIP-배포.md
README.md
docs/README-ZIP-배포-방법-현황.md

핵심 내용:
data 폴더의 예제 산출물과 data/script_requests JSON은 참고용 자료로 포함합니다.
README-맥-사용자-필독.txt를 ZIP 루트 포함 대상에 추가했습니다.
README-ZIP-배포-방법-현황.md는 내부 작업용 문서이므로 docs 폴더에 두고 ZIP에는 포함하지 않습니다.
docs, dist, .venv, .venv-win, node_modules, 서버 실행 로그는 계속 제외합니다.

사용자 영향:
ZIP을 받은 사용자는 예제 WAV/SRT/VTT/TXT/Whisper 결과와 대본 요청 JSON 구조를 확인할 수 있습니다.
단, 배포 전에 data에 개인정보, 비공개 원고, 실사용 고객 정보가 들어 있으면 정리해야 합니다.

6) 라이선스 고지가 보강되었습니다.

변경 파일:

LICENSE_NOTICES.txt
README.md
README-ZIP-배포.md
supertonic3-local-tts/ui/index.html

추가/유지 링크:

Supertonic GitHub:
https://github.com/supertone-inc/supertonic

Supertonic 3 모델 라이선스:
https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE

faster-whisper GitHub:
https://github.com/SYSTRAN/faster-whisper

FFmpeg legal:
https://www.ffmpeg.org/legal.html

Gyan FFmpeg builds:
https://www.gyan.dev/ffmpeg/builds/

핵심 내용:
Supertonic 예제 코드, Supertonic 3 모델 가중치, faster-whisper, FFmpeg, 로컬 통합 UI를 분리해서 설명합니다.
FFmpeg는 ZIP에 포함하지 않고 선택 설치로만 안내합니다.
MP3 변환도 사용자의 로컬 ffmpeg를 호출한다는 점을 명확히 적었습니다.

11. 2026-05-20 최종 배포 전 점검 결과

아래 점검은 최종 ZIP 생성 직전 작업본 기준입니다.
ZIP 파일은 이 점검 시점에는 아직 다시 만들지 않았습니다.

1) Python 단위 테스트

명령:

supertonic3-local-tts\.venv-win\Scripts\python.exe -m unittest discover -s supertonic3-local-tts\tests

결과:
22개 테스트 통과.

2) JavaScript 문법 확인

명령:

node --check supertonic3-local-tts\ui\main.js

결과:
통과.

3) Python 문법 확인

확인 대상:

scripts/create_release_zip.py
supertonic3-local-tts/src/app.py
supertonic3-local-tts/src/supertonic3_engine.py
supertonic3-local-tts/src/supertonic3_cli.py
supertonic3-whisper-subtitles/whisper_subtitle_refiner.py

결과:
통과.

4) Windows 실행.bat 점검

명령:

실행.bat --check --skip-update --skip-ffmpeg

결과:
통과.
현재 점검 환경에서는 3093 포트가 열리지 않아 3164 fallback 포트를 찾았습니다.
Whisper venv Python은 현재 환경에서 사용 불가로 감지되어 Whisper setup skipped 경고가 나왔지만, TTS 서버 자체는 실행 가능한 상태로 판정되었습니다.

5) 실행.bat 줄바꿈 점검

결과:
CRLF 줄바꿈 유지.
LF-only 줄바꿈 없음.
BOM 없음.

6) 위험 파일/비밀값 점검

릴리즈 포함 대상 269개 파일 기준으로 확인했습니다.

확인 결과:
API 키 패턴 0건.
HF 토큰 패턴 0건.
GitHub 토큰 패턴 0건.
AWS 키 패턴 0건.
private key 블록 0건.
텍스트 릴리즈 대상의 실제 사용자 홈 경로 또는 작업 PC 절대경로 0건.

제외 확인:
docs 제외.
dist 제외.
.venv 제외.
.venv-win 제외.
node_modules 제외.
서버 실행 로그 제외.

포함 확인:
data 예제 산출물 포함.
data/script_requests 예제 JSON 포함.
LICENSE_NOTICES.txt 포함.
README-ZIP-배포.md 포함.
README-Ver-업데이트현황.txt 포함.
README-맥-사용자-필독.txt 포함.
start-mac.sh 포함.
실행.bat 포함.

7) macOS 관련 점검

macOS 실기기 검증은 하지 못했습니다.
현재 작업 환경에는 bash/WSL 실행 환경이 준비되어 있지 않아 start-mac.sh 문법 검사를 완료하지 못했습니다.
따라서 macOS는 README-맥-사용자-필독.txt에 적은 대로 미검증 베타이며, 맥 사용자가 직접 수정해서 써야 한다는 안내가 필요합니다.

12. 최종 배포 판단

Windows 사용자 중심 ZIP으로는 배포 가능한 상태입니다.
TTS 기본 기능은 ffmpeg 없이도 동작하도록 안내되어 있습니다.
MP3 변환은 ffmpeg가 있는 사용자만 사용할 수 있으며, ZIP 미포함/선택 설치/재배포 시 라이선스 확인 고지가 들어가 있습니다.
macOS는 공식 보장으로 말하면 안 되며, 미검증 베타와 직접 수정 필요를 계속 명시해야 합니다.

최종 ZIP 생성 전 마지막으로 확인할 것:

1) data 폴더 안 예제 산출물에 개인정보나 비공개 원고가 없는지 육안 확인.
2) README-맥-사용자-필독.txt가 ZIP 루트에 포함되는지 manifest에서 확인.
3) ZIP 생성 후 SHA256과 manifest를 함께 보관.
4) 배포 페이지에도 ZIP 미포함 FFmpeg, 선택 설치, 개인 사용 OK, 재배포 시 라이선스 확인 문구를 유지.


13. 2026-05-20 대본 입력 UI 추가 변경

최종 ZIP 생성 후 사용자의 추가 요청으로 대본 입력부를 다시 정리했습니다.
이 변경 이후 ZIP을 다시 생성해 최종 산출물에 반영해야 합니다.

1) 대본 입력 탭 구조가 추가되었습니다.

변경 파일:

supertonic3-local-tts/ui/index.html
supertonic3-local-tts/ui/main.js
supertonic3-local-tts/ui/style.css

탭 구성:

사용자 입력(User text)
샘플 대본(Samples)
로컬 TXT(Local TXT)
대본 요청(Request)

기본값:
사용자 입력(User text) 탭입니다.
대본 요청 폼은 기본 화면에 바로 보이지 않고, 대본 요청(Request) 탭을 눌러야 표시됩니다.

2) data/script_customs 로컬 TXT 자동 인식 기능이 추가되었습니다.

새 폴더:

supertonic3-local-tts/data/script_customs

새 API:

GET /api/script-customs
GET /api/script-customs/<name>

동작:
사용자가 data/script_customs 폴더에 .txt 파일을 넣으면 웹 UI의 로컬 TXT(Local TXT) 탭에서 자동으로 파일명을 표시합니다.
파일명을 선택하면 해당 TXT 내용을 텍스트 입력 영역으로 불러옵니다.
경로 이동은 막고 파일명 기준으로만 읽습니다.
UTF-8, UTF-8 BOM, CP949 텍스트를 순서대로 시도합니다.

3) 예제 로컬 TXT 대본

현재 data/script_customs 폴더에는 예제 TXT 파일이 있습니다.
이 파일들은 로컬 TXT 자동 인식 기능의 참고용 자료로 취급합니다.
다만 실제 배포 전에는 개인정보나 비공개 원고가 들어 있지 않은지 다시 확인해야 합니다.


14. 2026-05-20 대본 탭 변경 반영 후 ZIP 재생성

대본 입력 탭과 data/script_customs 자동 인식 기능을 반영한 뒤 ZIP을 다시 생성했습니다.

최종 산출물:

dist\supertonic3-local-tts-20260520-r1.zip
dist\supertonic3-local-tts-20260520-r1.zip.sha256
dist\supertonic3-local-tts-20260520-r1.manifest.json

최종 SHA256:

975a1081fe0f3524719bb63d60126d1e8b70cb50789e53460e998a9eecd24683

최종 파일 수:

manifest file_count: 271
ZIP entry count: 271

추가 포함:

data/script_customs 예제 TXT 2개 항목 포함.

최종 검증:
ZIP CRC 문제 없음.
SHA256 파일과 실제 ZIP 해시 일치.
manifest의 zip_sha256과 실제 ZIP 해시 일치.
필수 루트 문서와 실행 파일 포함.
docs, dist, .venv, .venv-win, node_modules, __pycache__, 서버 실행 로그 제외.
private key, OpenAI API 키, Hugging Face 토큰, GitHub 토큰, AWS 키 패턴 없음.
사용자 홈 경로, 개발 작업 루트 절대경로, 개발자 계정명 문자열 없음.


15. 2026-05-20 r2 최종 UI 정리 및 산출물 재생성

20260520-r1 이후 사용자의 최종 UI/UX 요청을 반영해 배포 ZIP을 다시 만들기 위한 변경 기록입니다.
이 버전은 기능 구조를 크게 바꾸기보다, 대본 입력 영역과 로컬 TXT 사용 흐름을 더 명확하게 정리한 최종 배포 후보입니다.

1) 텍스트 편집 영역 확대 슬라이더 추가

텍스트(Text) 제목 오른쪽에 드래그 슬라이더를 추가했습니다.
적용 범위는 텍스트 편집 textarea 하나로 제한됩니다.
기본값은 115%입니다.
사용자가 조절한 값은 브라우저 localStorage에 저장됩니다.
범위는 90%~180%입니다.

2) 로컬 TXT UI 정리

로컬 TXT(Local TXT) 탭에서 필터, 새로고침, 상태 문구를 상단 한 줄에 정리했습니다.
파일 버튼은 그 아래에 자동 줄바꿈으로 차곡차곡 표시합니다.
파일이 많아져도 내부 가로 스크롤을 쓰지 않고 화면 폭에 맞춰 여러 줄로 배치합니다.
정렬 옵션은 최신, 오래된, 이름 오름차순, 이름 내림차순입니다.
검색 입력으로 파일명을 좁힐 수 있습니다.
파일명은 가능한 한 잘리지 않도록 2줄 표기를 사용합니다.

3) 상단 경로 카드와 사용자 설정 카드 정리

슈퍼토닉 스튜디오 제목 아래에 경로 안내 카드를 배치했습니다.
로컬 TXT 파일 위치, 대본 요청 파일 위치, 샘플 목록 파일 위치, 생성 결과 파일 위치를 1줄 4열로 표시합니다.
오른쪽에는 사용자 설정(Custom) 카드가 같은 높이로 붙습니다.
사용자 설정 상태는 제목 줄에 함께 표시해 높이를 줄였습니다.

4) 최종 산출물 생성 예정

최종 산출물 이름:

dist\supertonic3-local-tts-20260520-r2.zip
dist\supertonic3-local-tts-20260520-r2.zip.sha256
dist\supertonic3-local-tts-20260520-r2.manifest.json

생성 후 실제 SHA256은 .zip.sha256 파일과 manifest의 zip_sha256에서 확인합니다.
ZIP 내부 README-Ver-업데이트현황.txt는 자기 자신을 포함한 ZIP 해시를 미리 적을 수 없으므로, 최종 해시는 별도 산출물 파일로 검증합니다.

5) 배포 전 확인 항목

node --check로 ui/main.js 문법 확인.
supertonic3-local-tts 테스트 통과.
supertonic3-whisper-subtitles 테스트 통과 여부 확인.
핵심 Python 파일 py_compile 확인.
ZIP CRC 확인.
필수 루트 문서와 실행 파일 포함 확인.
docs, dist, .venv, .venv-win, node_modules, __pycache__, 서버 실행 로그 제외 확인.
private key, OpenAI API 키, Hugging Face 토큰, GitHub 토큰, AWS 키 패턴 없음 확인.
개발 PC 절대경로와 사용자 홈 경로가 텍스트 산출물에 남지 않았는지 확인.
