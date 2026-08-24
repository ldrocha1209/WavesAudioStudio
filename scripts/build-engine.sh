#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
engine_dir="$repo_root/engine"
python_bin="$engine_dir/.venv/bin/python"
export PYINSTALLER_CONFIG_DIR="$engine_dir/.pyinstaller"

if [[ ! -x "$python_bin" ]]; then
  echo "Engine environment is missing. Run 'npm run engine:bootstrap' first." >&2
  exit 1
fi

cd "$engine_dir"
"$python_bin" -m PyInstaller --clean --noconfirm waves-engine-onedir.spec

engine_binary="$engine_dir/dist/waves-engine-onedir/waves-engine"
if [[ ! -x "$engine_binary" ]]; then
  echo "Frozen engine was not created at $engine_binary" >&2
  exit 1
fi

"$engine_binary" <<<'{"protocol":1,"type":"shutdown","requestId":"build-check"}' >/dev/null
echo "Frozen Waves engine is ready at $engine_dir/dist/waves-engine-onedir"
