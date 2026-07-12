
from supabase import create_client, Client

SUPABASE_URL="https://lwpblqvieqvfkvrbvtwi.supabase.co"
SUPABASE_KET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGJscXZpZXF2Zmt2cmJ2dHdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzY1NDAwNSwiZXhwIjoyMDk5MjMwMDA1fQ.ihRKIE1ri8GgVoFr35hwFNLC4E4H-Wh-EwIumyNL8Vc"


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KET)

# new_row={"Fitrst_name":"Shaheer","Last_name":"hassan","Email":"shaheer.hassan@example.com" ,"pasword":"shaheer123"}

# supabase.table('userdata').insert(new_row).execute()




results=supabase.table("userdata").select("*").execute()
print(results)