Supertonic 3 Whisper Subtitle Refiner

이 폴더는 supertonic-upstream, supertonic3-local-tts와 별도로 둔 자막 정확도 보정 도구입니다.

목적

1. supertonic3-local-tts가 만든 WAV 파일을 faster-whisper로 다시 분석합니다.

2. 실제 음성 길이와 무음 구간을 기준으로 SRT/VTT 타임코드를 다시 만듭니다.

3. 기본 자막보다 정확한 구간 분할을 얻기 위해 VAD, word timestamp, beam search, int8 CPU 추론을 사용합니다.

4. 원본 대본 파일이 있으면 reference 모드로 원문을 최대한 보존하면서 타이밍만 Whisper 기준으로 맞출 수 있습니다.


설치

1. Windows PowerShell

    cd <이_폴더_경로>
    py -m venv .venv-win
    .\.venv-win\Scripts\python.exe -m pip install -r requirements.txt

2. Linux/bash

    cd <이_폴더_경로>
    python3 -m venv .venv
    ./.venv/bin/python -m pip install -r requirements.txt


빠른 사용

1. supertonic3-local-tts/data 폴더의 최신 WAV를 자동으로 찾아 보정합니다.

    .\.venv-win\Scripts\python.exe .\whisper_subtitle_refiner.py --latest-from ..\supertonic3-local-tts\data

2. 특정 WAV 파일을 직접 지정합니다.

    .\.venv-win\Scripts\python.exe .\whisper_subtitle_refiner.py --audio ..\supertonic3-local-tts\data\파일명.wav

3. PowerShell 편의 스크립트를 사용합니다.

    .\refine_latest.ps1

4. Linux/bash 편의 스크립트를 사용합니다.

    ./refine_latest.sh


생성 결과

1. *_whisper.srt

    faster-whisper 기준으로 다시 만든 SRT 자막입니다.

2. *_whisper.vtt

    브라우저나 웹 플레이어에서 쓰기 좋은 VTT 자막입니다.

3. *_whisper.txt

    인식된 대본 또는 reference 원문 기반 자막 텍스트입니다.

4. *_whisper.json

    구간, 언어 감지, 옵션, cue 정보를 담은 점검용 JSON입니다.

5. *_whisper_log.txt

    어떤 모델과 옵션으로 보정했는지 남기는 로그입니다.


추천 옵션

1. CPU 자막용 기본값

    --model medium --device cpu --compute-type int8 --language ko --beam-size 5 --vad-filter --word-timestamps

2. 빠른 확인

    --model small --compute-type int8

3. 정확도 우선

    --model large-v3 --compute-type int8

4. 한국어 정확도

    --language ko --initial-prompt "다음은 한국어 음성입니다."

5. 환각 감소

    --vad-filter --temperature 0.0 --compression-ratio-threshold 2.4 --no-speech-threshold 0.6


자막 정확도가 올라가는 이유

1. 기존 supertonic3-local-tts 기본 자막은 입력 문장을 전체 음성 길이에 비례해 나누는 방식입니다.

2. 이 도구는 생성된 WAV를 실제로 다시 듣고, faster-whisper가 찾은 발화 시작/종료 시간을 사용합니다.

3. VAD가 무음 구간을 제거해 무음 환각과 불필요한 자막 구간을 줄입니다.

4. word_timestamps가 단어 단위 시간을 제공해 더 자연스러운 줄 분할이 가능합니다.

5. int8 compute_type은 CPU에서 속도와 메모리 사용량의 균형이 좋아 실사용에 적합합니다.
