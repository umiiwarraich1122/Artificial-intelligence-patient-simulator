import os
import shutil
from pathlib import Path

# Paths
root_dir = Path("d:/Internship/Week 1/llm/AI patient for student")
app_dir = root_dir / "app"
backend_dir = root_dir / "clinic_backend"

# 1. Rename directory if exists
if app_dir.exists():
    if backend_dir.exists():
        shutil.rmtree(backend_dir)
    app_dir.rename(backend_dir)
    print("Renamed app/ to clinic_backend/")

# 2. Replaces all instances of 'from clinic_backend.' or 'import clinic_backend.'
for py_file in root_dir.glob("**/*.py"):
    if ".venv" in py_file.parts or "venv" in py_file.parts or "__pycache__" in py_file.parts:
        continue
    
    with open(py_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    modified = False
    
    # Simple search & replace
    if "from clinic_backend." in content:
        content = content.replace("from clinic_backend.", "from clinic_backend.")
        modified = True
    if "import clinic_backend." in content:
        content = content.replace("import clinic_backend.", "import clinic_backend.")
        modified = True
    if "from clinic_backend import" in content:
        content = content.replace("from clinic_backend import", "from clinic_backend import")
        modified = True
        
    if modified:
        with open(py_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated imports in: {py_file.relative_to(root_dir)}")

print("Import migration complete.")
