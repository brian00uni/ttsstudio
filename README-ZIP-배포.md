Supertonic3 Local TTS ZIP 배포 규정

1. 목적

1) 이 문서는 supertonic3-local-tts 배포용 ZIP을 만들 때 지켜야 하는 규정입니다.
2) 목표는 사용자가 바로 받을 수 있는 ZIP, SHA256 검증 파일, manifest JSON을 같은 기준으로 만드는 것입니다.
3) 반디집 같은 GUI 압축 도구를 수동으로 쓰지 않고 scripts/create_release_zip.py를 사용합니다.
4) ZIP 포맷은 보안 도구가 아닙니다. 안전성은 포함 파일 통제, 민감정보 제거, SHA256 검증, 라이선스 고지 보존으로 확보합니다.


2. 배포 파일 이름 규칙

1) 기본 이름

supertonic3-local-tts-<버전>.zip

2) 현재 배포 예시

dist\supertonic3-local-tts-20260516.zip

3) 함께 생성해야 하는 파일

dist\supertonic3-local-tts-20260516.zip.sha256
dist\supertonic3-local-tts-20260516.manifest.json

4) 버전 표기
날짜 기반 배포는 YYYYMMDD 형식을 사용합니다.
동일 날짜에 여러 번 배포하면 20260516-r2 같은 접미사를 사용할 수 있습니다.


3. ZIP 생성 명령

1) 루트 폴더에서 실행합니다.

supertonic3-local-tts\.venv-win\Scripts\python.exe scripts\create_release_zip.py --version 20260516

2) 다른 Python을 사용할 경우
Python 3.11 이상이면 표준 라이브러리만으로 실행됩니다.
별도 npm, archiver, 7-Zip, 반디집은 필요하지 않습니다.

3) 생성 후 스크립트가 출력하는 값
zip: ZIP 파일 경로
sha256: ZIP SHA256 값
sha256_file: SHA256 텍스트 파일 경로
manifest: manifest JSON 파일 경로
file_count: ZIP에 들어간 파일 수
size_bytes: ZIP 바이트 크기

4) 배포/다운로드 안내 페이지

https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide

5) 라이선스 고지 주소

ZIP 내부:
LICENSE_NOTICES.txt

로컬 웹 UI:
http://127.0.0.1:3093/license-notices


4. ZIP에 포함해야 하는 것

1) 루트 문서와 실행 파일

README.md
README-ZIP-배포.md
README-Ver-업데이트현황.txt
README-맥-사용자-필독.txt
LICENSE_NOTICES.txt
sample.txt
start-mac.sh
실행.bat

실행.bat은 Windows 사용자용 자동 실행 파일입니다.
ZIP에는 .venv-win을 넣지 않으므로, 실행.bat이 사용자 PC에서 Python, ffmpeg, .venv-win, 필수 pip 패키지를 확인합니다.
Python이 없고 winget이 있으면 Python 3.11 설치 여부를 묻습니다.
이미 준비된 항목은 건너뛰고, 없는 venv와 패키지는 requirements.txt 기준으로 생성 또는 설치합니다.
ffmpeg가 없고 winget이 있으면 설치 여부를 묻습니다.
ffmpeg는 TTS 생성 필수 조건이 아니므로, 설치하지 않아도 웹앱 실행과 WAV 음성 생성은 가능합니다.
다만 ffmpeg가 없으면 MP3, M4A, MP4 같은 비-WAV 미디어 입력, 미디어 변환, 변환 기반의 정확한 자막 싱크 구현은 제한될 수 있습니다.
실행.bat은 Gyan.FFmpeg가 GPLv3 빌드라는 라이선스 고지를 표시하고, 사용자가 이해 여부와 설치 동의를 두 번 확인한 뒤에만 설치합니다.
실행.bat은 SUPERTONIC3_OUTPUT_DIR을 현재 ZIP 폴더의 supertonic3-local-tts/data로 맞춰, 이전 압축 해제 폴더나 개발 PC 경로가 출력 위치로 남는 상황을 막습니다.
3093 포트에 이미 다른 폴더의 서버가 떠 있으면 /health의 output_dir을 비교해 재사용하지 않고 3094부터 빈 포트로 현재 폴더 서버를 띄웁니다.
3093 포트가 비어 있어도 Windows가 예약했거나 보안 도구가 막아 실제로 열 수 없으면 3094부터 접근 가능한 포트를 자동으로 찾습니다.
supertonic 또는 faster-whisper 새 버전이 감지되면 기본값은 사용자에게 업데이트 여부를 묻고, --auto-update 또는 SUPERTONIC3_AUTO_UPDATE=1을 사용하면 확인 질문 없이 pip 업데이트를 실행합니다.
자동 준비를 원하지 않는 사용자는 --skip-bootstrap 또는 --skip-ffmpeg 옵션을 사용할 수 있습니다.

start-mac.sh는 macOS/Linux 사용자를 위한 베타 실행 스크립트입니다.
개발자가 macOS 실기기에서 검증하지 못했으므로 "테스트 완료"가 아니라 "원리상 가능, 사용자 환경 검증 필요"로 안내합니다.
Python 3.11 또는 3.12와 인터넷 연결이 있으면 TTS venv와 선택적인 Whisper venv를 준비하고, 사용 가능한 로컬 포트를 찾아 Flask 서버를 실행합니다.
README-맥-사용자-필독.txt는 맥 사용자가 이 배포본을 Windows 우선 ZIP으로 이해하고, 필요하면 직접 코드 수정해서 써야 한다는 점을 눈에 띄게 안내하는 문서입니다.
Windows, macOS/Linux 실행 스크립트는 기본적으로 127.0.0.1에만 바인딩합니다.
사용자가 SUPERTONIC3_HOST=0.0.0.0을 직접 지정하면 같은 네트워크의 다른 기기에서도 접근할 수 있으므로, 신뢰할 수 있는 LAN에서만 사용하도록 안내합니다.

2) Supertonic 공식 참고 폴더

supertonic-upstream

이 폴더는 공식 저장소 참고용입니다.
공식 예제 코드, README, LICENSE, 이미지, 예제 구조를 보존합니다.
접근 불가능한 링크나 특수 항목은 스크립트가 건너뜁니다.

3) 로컬 TTS 앱 폴더

supertonic3-local-tts

포함 항목:
src
ui
public
tests
tools
requirements.txt
README.md
start.sh
install.sh
configure-hermes-tts.sh
supertonic3-tts.sh
data 예제 산출물

4) Whisper 자막 보정 폴더

supertonic3-whisper-subtitles

포함 항목:
whisper_subtitle_refiner.py
requirements.txt
README.md
refine_latest.ps1
refine_latest.sh
tests

5) 배포 스크립트

scripts/create_release_zip.py

배포 규정 자체를 재현할 수 있게 ZIP 안에도 포함합니다.


5. 예제 산출물 포함 규정

1) data 폴더의 예제 산출물은 포함할 수 있습니다.

포함 가능 예:
WAV
MP3 변환 예제 파일
SRT
VTT
TXT 대본
TXT 입력 로그
Whisper 보정 SRT
Whisper 보정 VTT
Whisper 보정 TXT
Whisper 보정 JSON
Whisper 보정 로그
script_customs TXT
script_requests JSON

2) 산출물을 포함하는 이유
사용자가 앱을 처음 열었을 때 출력 복원, 자막 다운로드, Whisper 결과 형태를 예제로 확인할 수 있습니다.
테스트와 데모 설명에도 유용합니다.
script_requests JSON은 대본 요청 기능이 어떤 형태의 파일을 만들고, LLM/Codex/Cursor 같은 도구가 어떤 값을 읽으면 되는지 보여주는 참고 자료입니다.
script_customs TXT는 사용자가 data/script_customs 폴더에 직접 넣은 로컬 대본 파일을 웹 UI가 자동 인식하는 기능의 예시 자료입니다.

3) 산출물 포함 시 주의
산출물 내용은 공개해도 되는 대본과 음성만 포함합니다.
개인정보, 고객명, 미공개 프로젝트명, 유료 원고, 비공개 음성, 실제 인물 사칭 가능성이 있는 음성은 넣지 않습니다.
사용자가 명시적으로 예제로 취급해도 된다고 확인한 산출물만 포함합니다.
script_requests도 이번 배포에서는 참고용 예제 자료로 포함합니다. 다만 실제 사용자 요청이나 내부 기획 메모가 섞이면 배포 전에 지웁니다.
script_customs도 공개 가능한 TXT 대본만 포함합니다.

4) 로컬 경로 치환
input_log, whisper_log, whisper_json에는 생성 당시 절대경로가 들어갈 수 있습니다.
scripts/create_release_zip.py는 ZIP에 넣는 텍스트 파일에서 현재 배포 루트 경로를 <배포_루트>로 치환합니다.
원본 작업 폴더 파일은 수정하지 않고 ZIP 내부 파일만 치환합니다.


6. ZIP에서 제외해야 하는 것

1) 가상환경

.venv
.venv-win
site-packages

이유:
가상환경은 사용자 PC 경로에 묶일 수 있고 용량이 큽니다.
설치된 패키지 캐시나 로컬 빌드 정보가 들어갈 수 있습니다.
배포 후 사용자는 requirements.txt 또는 실행 스크립트로 환경을 구성해야 합니다.

2) 빌드/캐시/임시 폴더

__pycache__
.pytest_cache
.mypy_cache
node_modules
dist
.git

3) 서버 로그

server.log
server.err
server_stdout.log
server_stderr.log

이유:
서버 로그에는 로컬 경로, 실행 오류, 환경 정보가 들어갈 수 있습니다.
예제 산출물은 포함 가능하지만 서버 실행 로그는 포함하지 않습니다.

4) 컴파일/임시 파일

*.pyc
*.pyo
*.log
*.tmp

5) 민감 파일

.gitignore
.gitattributes
.env
*.pem
*.pfx
*.key
id_rsa
id_ed25519
credentials 파일
token 파일
secret 파일
password 파일
ads.txt
usage_log.sqlite
*.sqlite

6) 공개 서버 전용 / Docker 배포 전용

ads.txt
  공개 API(tts.min-inter.co.kr) AdSense 검증용. 로컬 ZIP 사용자에게는 불필요합니다.

docker/
  compose.yml 기반 Docker 배포는 저장소 루트에서 별도 관리합니다. ZIP에는 넣지 않습니다.

usage_log.sqlite
  공개 API 운영 통계용 SQLite. 로컬 ZIP에는 포함하지 않습니다.

현재 스크립트는 이름·접두사·확장자 기반으로 일부를 제외하고, 배포 전 검사에서 추가로 확인합니다.


7. 민감정보 검사 규정

1) 반드시 검사할 문자열

Windows 드라이브 절대경로
Windows 사용자 폴더 절대경로
로컬 사용자 계정명
OpenAI API 키 환경 변수명
Hugging Face 토큰 환경 변수명
API 키 표기
토큰 표기
비밀값 표기
비밀번호 표기
인증정보 표기
개인키 표기
SSH 개인키 파일명
.pem
.pfx
.key

2) 반드시 검사할 토큰 패턴

OpenAI API 키 형식 문자열
hf 언더스코어로 시작하는 Hugging Face 토큰
AKIA 로 시작하는 AWS Access Key
PEM 개인키 블록 헤더 문자열
BEGIN RSA PRIVATE KEY 형태의 PEM 개인키 블록
BEGIN OPENSSH PRIVATE KEY 형태의 OpenSSH 개인키 블록

3) 검사 대상
ZIP 내부 파일 이름
ZIP 내부 텍스트 파일 내용
manifest JSON
README 문서
data 예제 로그와 JSON

4) 검사 결과 처리
민감정보가 발견되면 ZIP을 배포하지 않습니다.
원본 파일을 수정할지, ZIP 생성 시 치환할지 결정합니다.
로컬 절대경로는 ZIP 생성 시 <배포_루트>로 치환합니다.
실제 키나 토큰은 치환이 아니라 원본에서 제거하고 키를 폐기 또는 재발급합니다.


8. ZIP 생성 스크립트의 현재 동작

1) 고정된 ZIP 내부 타임스탬프
ZIP 안의 파일 타임스탬프는 2026-05-16 00:00:00으로 고정합니다.
동일한 입력 파일이면 압축 결과의 차이를 줄이기 위한 목적입니다.

2) 압축 방식
Python 표준 zipfile을 사용합니다.
압축 방식은 ZIP_DEFLATED입니다.
압축 수준은 9입니다.

3) 파일 권한
ZIP 내부 파일 권한은 0644로 설정합니다.

4) 경로 치환
텍스트 파일에서 현재 배포 루트 절대경로를 <배포_루트>로 치환합니다.
대상 확장자:
txt, json, md, py, ps1, sh, bat, html, js, css, toml, yml, yaml, ini, cfg

5) manifest
manifest JSON에는 다음 정보가 들어갑니다.
release_name
created_at_utc
zip
zip_sha256
file_count
excludes
files 배열

files 배열에는 각 파일의 상대경로, ZIP에 들어간 바이트 기준 크기, SHA256이 들어갑니다.


9. ZIP 생성 후 필수 검증

1) 단위 테스트

supertonic3-local-tts\.venv-win\Scripts\python.exe -m unittest discover -s tests

2) 배포 스크립트 문법 검사

supertonic3-local-tts\.venv-win\Scripts\python.exe -m py_compile scripts\create_release_zip.py

3) ZIP CRC 검사
zipfile.testzip() 결과가 None이어야 합니다.

4) 포함 확인
LICENSE_NOTICES.txt가 있어야 합니다.
README.md가 있어야 합니다.
README-ZIP-배포.md가 있어야 합니다.
supertonic3-local-tts/data 예제 산출물이 있어야 합니다.

5) 제외 확인
.venv와 .venv-win이 없어야 합니다.
site-packages가 없어야 합니다.
server.log, server.err, server_stdout.log, server_stderr.log가 없어야 합니다.
dist 폴더가 ZIP 안에 다시 들어가면 안 됩니다.

6) 민감정보 확인
파일명과 텍스트 내용에서 비밀키, 토큰, 로컬 사용자 경로가 검출되지 않아야 합니다.
단, <배포_루트> 치환 문자열은 정상입니다.


10. 현재 배포 ZIP 확인값

1) ZIP 파일

dist\supertonic3-local-tts-20260516.zip

2) SHA256

최종 SHA256은 ZIP을 다시 만들 때마다 dist\supertonic3-local-tts-20260516.zip.sha256 파일에서 확인합니다.

3) 파일 수

222개

4) 크기

166,724,787 bytes

5) 현재 검사 결과

ZIP CRC 검사 정상
LICENSE_NOTICES.txt 포함
README-ZIP-배포.md 포함
README-Ver-업데이트현황.txt 포함
README-맥-사용자-필독.txt 포함
start-mac.sh 포함
data 예제 산출물 포함
.venv, .venv-win 제외
site-packages 제외
서버 로그 제외
dist 재포함 없음
비밀키, API 토큰, HF 토큰, 개인키 패턴 없음
로컬 절대경로는 ZIP 내부에서 <배포_루트>로 치환됨


11. 배포 페이지에 표시할 권장 문구

1) 짧은 고지

이 ZIP은 Supertonic 3와 faster-whisper를 활용한 로컬 통합 배포판입니다.
원본 코드, 모델 가중치, 의존 패키지는 각 원본 라이선스를 따릅니다.
생성 음성과 자막의 사용 책임은 사용자에게 있으며 사칭, 동의 없는 음성 복제, 기만, 괴롭힘, 불법 콘텐츠, 유해 콘텐츠 제작에 사용하면 안 됩니다.

2) 해시 고지

다운로드 후 SHA256 값이 zip.sha256 파일의 값과 일치하는지 확인하세요.

3) 라이선스 고지

자세한 라이선스와 저작권 고지는 ZIP 루트의 LICENSE_NOTICES.txt를 확인하세요.
로컬 서버 실행 중에는 http://127.0.0.1:3093/license-notices 에서도 확인할 수 있습니다.

4) 배포 안내 주소

배포/다운로드 안내 페이지:
https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide


12. 배포 전 최종 체크리스트

1) README 문서에 특정 개인 PC 절대경로가 남아 있지 않다.
2) ZIP 안에 .venv 또는 .venv-win이 없다.
3) ZIP 안에 server.log 또는 server.err가 없다.
4) ZIP 안에 LICENSE_NOTICES.txt가 있다.
5) ZIP 안에 README-ZIP-배포.md가 있다.
6) ZIP 안에 README-Ver-업데이트현황.txt가 있다.
7) ZIP 안에 start-mac.sh가 있다.
8) data 예제 산출물은 공개 가능한 내용만 들어 있다.
7) input_log와 whisper_log의 로컬 경로는 <배포_루트>로 치환되어 있다.
8) SHA256 파일을 ZIP과 함께 배포한다.
9) manifest JSON을 ZIP과 함께 보존한다.
10) 다운로드 페이지에는 원본 라이선스와 생성물 책임 고지를 표시한다.
