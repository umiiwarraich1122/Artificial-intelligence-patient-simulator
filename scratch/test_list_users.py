import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

supabase = create_client(url, key)

print("Admin methods:")
for attr in dir(supabase.auth.admin):
    if not attr.startswith("_"):
        print(f"  {attr}")
