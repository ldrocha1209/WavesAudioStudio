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

tools_dir="$engine_dir/dist/waves-engine-onedir/tools"
mkdir -p "$tools_dir"
for tool in ffmpeg ffprobe node; do
  tool_path="$(command -v "$tool" || true)"
  if [[ -z "$tool_path" ]]; then
    echo "Required local tool '$tool' was not found on PATH." >&2
    exit 1
  fi
  cp -L "$tool_path" "$tools_dir/$tool"
  chmod 755 "$tools_dir/$tool"
done

"$engine_binary" <<<'{"protocol":1,"type":"shutdown","requestId":"build-check"}' >/dev/null
echo "Frozen Waves engine is ready at $engine_dir/dist/waves-engine-onedir"
