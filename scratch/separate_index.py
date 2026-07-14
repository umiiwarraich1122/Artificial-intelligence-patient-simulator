import re
from pathlib import Path

# Paths
base_dir = Path("d:/Internship/Week 1/llm/AI patient for student")
html_path = base_dir / "index.html"

# Read index.html
html_content = html_path.read_text(encoding="utf-8")

# Replace style block
# Match from <style> to </style>
style_pattern = re.compile(r'    <style>.*?</style>', re.DOTALL)
html_content, count_style = style_pattern.subn('    <link rel="stylesheet" href="index.css">', html_content)
print(f"Replaced {count_style} style block(s)")

# Replace script block
# Match from <script type="module"> to </script> at the bottom
# To make it safer, we find the last script tag
script_pattern = re.compile(r'    <script type="module">.*?</script>', re.DOTALL)
html_content, count_script = script_pattern.subn('    <script type="module" src="index.js"></script>', html_content)
print(f"Replaced {count_script} script block(s)")

# Save index.html
html_path.write_text(html_content, encoding="utf-8")
print("Done separating index.html!")
