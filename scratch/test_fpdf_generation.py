import os
from fpdf import FPDF

class PDFReport(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 16)
        self.cell(0, 10, 'AI Clinical Simulation Report', 0, 1, 'C')
        self.ln(5)
        
    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

try:
    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font('helvetica', '', 10)
    pdf.cell(0, 10, 'Patient Information', 0, 1)
    os.makedirs("scratch/test_reports", exist_ok=True)
    pdf.output("scratch/test_reports/test.pdf")
    print("PDF generated successfully!")
except Exception as e:
    print("Error:", e)
