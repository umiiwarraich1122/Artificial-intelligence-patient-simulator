try:
    import reportlab
    print("reportlab is installed")
except ImportError:
    print("reportlab is NOT installed")

try:
    import fpdf
    print("fpdf is installed")
except ImportError:
    print("fpdf is NOT installed")
