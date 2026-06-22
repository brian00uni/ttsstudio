#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
CONFIG="${HERMES_CONFIG_PATH:-/opt/data/config.yaml}"
PROVIDER="supertonic3-local"
CMD="$PWD/supertonic3-tts.sh --input {input_path} --output {output_path} --voice {voice} --lang ko --speed {speed}"

python3 - "$CONFIG" "$PROVIDER" "$CMD" <<'PY'
import sys
from pathlib import Path
import yaml

config_path = Path(sys.argv[1])
provider = sys.argv[2]
command = sys.argv[3]
config = yaml.safe_load(config_path.read_text(encoding='utf-8')) or {}
tts = config.setdefault('tts', {})
tts['provider'] = provider
providers = tts.setdefault('providers', {})
providers[provider] = {
    'type': 'command',
    'command': command,
    'output_format': 'wav',
    'voice': 'M1',
    'speed': 1.05,
    'timeout': 900,
    'max_text_length': 5000,
    'voice_compatible': True,
}
config_path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding='utf-8')
print(f'Configured Hermes TTS provider {provider} in {config_path}')
print('Restart Hermes gateway/session for config changes to take effect.')
PY
