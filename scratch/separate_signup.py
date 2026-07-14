import re
from pathlib import Path

# Paths
base_dir = Path("d:/Internship/Week 1/llm/AI patient for student")
html_path = base_dir / "signup.html"

# Read signup.html
html_content = html_path.read_text(encoding="utf-8")

# Replace style block
# Match from <style> to </style>
style_pattern = re.compile(r'    <style>.*?</style>', re.DOTALL)
html_content, count_style = style_pattern.subn('    <link rel="stylesheet" href="signup.css">', html_content)
print(f"Replaced {count_style} style block(s)")

# Replace script block
# Match from <script type="module"> to </script> at the bottom
script_pattern = re.compile(r'    <script type="module">.*?</script>', re.DOTALL)
html_content, count_script = script_pattern.subn('    <script type="module" src="signup.js"></script>', html_content)
print(f"Replaced {count_script} script block(s)")

# Save signup.html
html_path.write_text(html_content, encoding="utf-8")
print("Done separating signup.html!")
