============================================================
맥(macOS) 사용자 필독
============================================================

이 ZIP 배포본은 Windows 사용자를 우선 대상으로 만든 로컬 실행 패키지입니다.
개발자는 macOS 실기기를 가지고 있지 않아, 맥에서 실제로 실행되는지 끝까지 검증하지 못했습니다.

따라서 맥 사용자는 이 ZIP을 "바로 실행 보장되는 완제품"으로 보면 안 됩니다.
맥에서는 직접 코드를 확인하고, 필요한 부분을 수정해서 사용해야 합니다.

이 문서는 맥 사용자가 어디부터 봐야 하는지 알려주는 안내문입니다.
맥 실행을 공식 지원 완료라고 보장하는 문서가 아닙니다.


============================================================
1. 가장 중요한 결론
============================================================

1) Windows 사용자
이 ZIP은 Windows 사용자를 기준으로 실행.bat, .venv-win, PowerShell 안내, winget 기반 선택 설치 흐름을 맞춘 배포본입니다.

2) macOS 사용자
맥에서는 실행 가능성이 있지만, 이 배포본 기준으로는 미검증입니다.
start-mac.sh 파일을 넣어 두었지만 베타 편의 스크립트입니다.
동작하지 않으면 사용자가 직접 Python, Homebrew, ffmpeg, Git LFS, ONNX Runtime, 경로 문제를 확인하고 수정해야 합니다.

3) 지원 범위
맥에서 실행 오류가 나면 "배포본이 맥에서 완전히 지원된다"는 전제로 접근하면 안 됩니다.
공식 Supertonic 저장소와 이 로컬 통합 UI 코드를 참고해서 직접 조정해야 합니다.


============================================================
2. 맥에서 먼저 확인할 것
============================================================

1) Python 설치
Python 3.11 또는 3.12 사용을 권장합니다.
너무 최신 버전은 일부 패키지 호환성이 늦게 따라올 수 있습니다.

확인:

python3 --version

2) Homebrew 설치 여부
맥에서 개발 도구를 설치하려면 Homebrew가 사실상 표준입니다.

확인:

brew --version

3) Xcode Command Line Tools
일부 Python 패키지나 네이티브 의존성이 빌드 도구를 요구할 수 있습니다.

설치:

xcode-select --install

4) ZIP 압축 해제 위치
경로에 권한 제한, 한글/공백/특수문자 문제가 있으면 실행 스크립트나 패키지 설치가 실패할 수 있습니다.
처음에는 홈 폴더 아래의 단순한 영문 경로에서 테스트하는 편이 좋습니다.

예:

~/supertonic3-local


============================================================
3. 이 ZIP에서 맥 사용자가 시도할 수 있는 실행
============================================================

1) 터미널에서 ZIP을 푼 루트 폴더로 이동합니다.

예:

cd ~/supertonic3-local

2) start-mac.sh 실행 권한을 줍니다.

chmod +x ./start-mac.sh

3) 실행합니다.

./start-mac.sh

4) 브라우저 접속 주소
기본값은 로컬 PC 내부에서만 열리는 주소입니다.

http://127.0.0.1:3093

5) 실패할 수 있는 부분
Python 가상환경 생성 실패
pip 패키지 설치 실패
supertonic 패키지 설치 실패
faster-whisper 설치 실패
ffmpeg 미설치
Hugging Face 모델 다운로드 실패
Apple Silicon arm64와 Intel x86_64 차이
ONNX Runtime 또는 CTranslate2 바이너리 호환 문제

이런 문제가 생기면 start-mac.sh를 직접 열어 경로, Python 명령어, 패키지 설치 명령을 수정해야 합니다.


============================================================
4. 공식 Supertonic 저장소 기준 맥 사용자 팁
============================================================

공식 저장소:
https://github.com/supertone-inc/supertonic

공식 Supertonic 저장소는 여러 런타임 예제를 제공합니다.
Python, Node.js, Browser, Java, C++, C#, Go, Swift, iOS, Rust, Flutter 예제가 포함되어 있습니다.

맥 사용자는 이 ZIP이 막힐 때 아래 공식 흐름을 먼저 확인하는 편이 좋습니다.

1) Python SDK로 가장 단순하게 테스트

python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install supertonic

공식 Python SDK는 첫 실행 때 필요한 모델 자산을 Hugging Face에서 내려받는 방식으로 안내됩니다.
인터넷 연결이 필요할 수 있습니다.

2) 공식 로컬 HTTP 서버 방식

python -m pip install "supertonic[serve]"
supertonic serve --host 127.0.0.1 --port 7788

공식 SDK의 로컬 서버는 Supertonic을 HTTP로 호출하고 싶을 때 참고할 수 있습니다.
이 ZIP의 Flask UI와는 별개의 공식 SDK 기능입니다.

3) 모델 파일을 직접 받는 경우

공식 저장소는 Hugging Face 모델 저장소를 사용할 때 Git LFS가 필요하다고 안내합니다.
맥에서는 Homebrew로 Git LFS를 설치한 뒤 초기화하는 흐름을 참고할 수 있습니다.

brew install git-lfs
git lfs install

모델 저장소:
https://huggingface.co/Supertone/supertonic-3

모델 라이선스:
https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE

4) Go 예제를 직접 돌리는 경우

공식 저장소는 Go 예제에서 ONNX Runtime C 라이브러리가 필요할 수 있다고 안내합니다.
맥에서는 Homebrew의 onnxruntime 설치가 도움이 될 수 있습니다.

brew install onnxruntime

5) Java 예제를 직접 돌리는 경우

공식 저장소는 Java 예제에 JDK가 필요하다고 안내합니다.
맥에서는 OpenJDK 17 설치를 참고할 수 있습니다.

brew install openjdk@17

6) iOS 또는 Swift 쪽을 보는 경우

iOS 예제는 Xcode 프로젝트 생성과 실제 기기/시뮬레이터 설정이 필요합니다.
Swift 예제는 Swift 빌드 도구가 필요합니다.
이 ZIP의 Windows용 실행.bat 흐름과는 완전히 다릅니다.


============================================================
5. ffmpeg와 Whisper 자막 보정
============================================================

1) TTS 음성 생성만 할 때
Supertonic 3 WAV 생성 자체는 ffmpeg가 필수라고 단정할 수 없습니다.
이 로컬 UI의 핵심 TTS 생성은 Python SDK와 Supertonic 모델 호출이 중심입니다.

2) 자막 보정까지 할 때
faster-whisper, PyAV, 미디어 변환, 비-WAV 파일 처리, 자막 싱크 보정까지 쓰려면 ffmpeg가 필요하거나 도움이 될 수 있습니다.

맥 설치 예:

brew install ffmpeg

3) 주의
ffmpeg는 이 ZIP에 포함되어 있지 않습니다.
사용자가 자신의 맥에 별도로 설치하는 도구입니다.
재배포나 제품 포함 시에는 ffmpeg 라이선스를 별도로 확인해야 합니다.


============================================================
6. 맥에서 안 되면 어떻게 해야 하나
============================================================

1) 이 파일을 먼저 다시 읽습니다.
이 배포본은 Windows 우선이며, 맥은 검증 완료 상태가 아닙니다.

2) start-mac.sh를 열어 직접 수정합니다.
Python 명령어가 python3인지, python인지 확인합니다.
가상환경 폴더가 .venv인지, .venv-win을 참조하고 있지 않은지 확인합니다.
포트가 막혀 있으면 다른 포트를 지정합니다.

예:

SUPERTONIC3_PORT=3094 ./start-mac.sh

3) 공식 Supertonic 저장소의 Python SDK 예제를 먼저 성공시킵니다.
공식 Python SDK가 맥에서 먼저 동작해야 이 로컬 UI도 조정할 수 있습니다.

4) 그 다음 이 로컬 UI를 연결합니다.
공식 SDK 단독 실행이 성공했다면, supertonic3-local-tts/src/app.py와 start-mac.sh를 확인하면서 이 UI 쪽 문제를 좁힙니다.

5) 오류를 공유할 때
마지막 한 줄만 보내면 원인을 알기 어렵습니다.
터미널에서 실패 직전 30줄 이상을 함께 확인해야 합니다.


============================================================
7. 책임과 기대치
============================================================

이 ZIP은 맥에서 "무조건 된다"고 말하는 배포본이 아닙니다.
맥 사용자는 직접 개발 환경을 맞추고, 필요하면 코드를 수정해서 사용해야 합니다.

맥에서 안정적으로 쓰려면 다음 중 하나를 선택하는 편이 현실적입니다.

1) 공식 Supertonic Python SDK만 먼저 사용한다.
2) 공식 저장소의 런타임별 예제를 직접 따라간다.
3) 이 ZIP의 start-mac.sh와 Flask UI 코드를 직접 수정한다.
4) Windows PC 또는 Windows 가상환경에서 이 ZIP을 사용한다.

공식 Supertonic 저장소:
https://github.com/supertone-inc/supertonic

이 로컬 ZIP 통합 UI는 공식 Supertonic 제품이 아닙니다.
Supertonic 3, faster-whisper, ffmpeg 등 각 구성요소의 라이선스와 사용 조건은 LICENSE_NOTICES.txt를 확인해야 합니다.


============================================================
8. 한 줄 요약
============================================================

Windows 사용자는 실행.bat 중심으로 사용하세요.
맥 사용자는 start-mac.sh를 참고하되, 미검증 베타로 보고 직접 코드 수정해서 쓰세요.
막히면 공식 Supertonic 저장소의 Python SDK 예제를 먼저 성공시키는 것이 가장 좋은 출발점입니다.
