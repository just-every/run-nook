"""Bound apt work after a real bundled Chromium launch fails on a hosted runner."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile

archives = Path(os.environ["APT_ARCHIVES"])
(archives / "partial").mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(mode="w", prefix="nook-apt-", suffix=".conf") as config:
    config.write(f'Dir::Cache::archives "{archives}";\n'
                 'Acquire::Retries "2";\n'
                 'Acquire::http::Timeout "30";\n'
                 'Acquire::https::Timeout "30";\n'
                 'DPkg::Lock::Timeout "60";\n')
    config.flush()
    child = subprocess.Popen(
        ["pnpm", "exec", "playwright", "install-deps", "chromium"],
        env={**os.environ, "APT_CONFIG": config.name, "DEBIAN_FRONTEND": "noninteractive"},
        start_new_session=True,
    )
    try:
        raise SystemExit(child.wait(timeout=180))
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
        raise SystemExit("Chromium dependency installation exceeded 180 seconds")
