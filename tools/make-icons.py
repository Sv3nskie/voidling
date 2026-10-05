"""Renders tools/icon.html in headless Chrome and saves the icons to voidling/icons/.

Usage: python tools/make-icons.py
"""
import base64
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = ROOT / "voidling" / "icons"

page = (ROOT / "tools" / "icon.html").as_uri()
dom = subprocess.run(
    [CHROME, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
     "--virtual-time-budget=3000", "--dump-dom", page],
    capture_output=True, text=True, check=True,
).stdout
data = json.loads(re.search(r'<pre id="out">(.*?)</pre>', dom, re.S).group(1).replace("&quot;", '"'))
OUT.mkdir(parents=True, exist_ok=True)
for name, url in data.items():
    (OUT / name).write_bytes(base64.b64decode(url.split(",", 1)[1]))
    print("wrote", OUT / name)
