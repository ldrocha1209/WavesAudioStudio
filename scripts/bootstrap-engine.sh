#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
engine_dir="$repo_root/engine"
venv_dir="$engine_dir/.venv"

if ! command -v python3.11 >/dev/null 2>&1; then
  echo "Waves requires Python 3.11 to build the local engine." >&2
  exit 1
fi

if [[ ! -x "$venv_dir/bin/python" ]]; then
  python3.11 -m venv "$venv_dir"
fi

"$venv_dir/bin/python" -m pip install --upgrade pip
"$venv_dir/bin/python" -m pip install -r "$engine_dir/requirements-lock.txt"

echo "Waves engine environment is ready at $venv_dir"
