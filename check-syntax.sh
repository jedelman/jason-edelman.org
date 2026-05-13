#!/bin/bash
# Run before every commit. Usage: bash check-syntax.sh
FILE="${1:-eastside-commons/index.html}"
python3 - << PYEOF
import re, subprocess, tempfile, os, sys
with open('$FILE', 'r') as f:
    html = f.read()
scripts = re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', html, re.DOTALL)
combined = '\n'.join(scripts)
with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
    f.write(combined); tmp = f.name
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode == 0:
    print(f'✓ {sys.argv[1] if len(sys.argv)>1 else "$FILE"} — syntax OK ({len(combined.splitlines())} JS lines)')
else:
    print(r.stderr[:400]); sys.exit(1)
PYEOF
