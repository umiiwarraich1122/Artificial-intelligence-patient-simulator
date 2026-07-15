"""
PDF Report generation using ReportLab.
"""
import html
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from clinic_backend.config import REPORTS_DIR


def generate_pdf_report(patient_id: str, patient_info: dict, convo_id: str, transcript: list, summary_data: dict, evaluation: dict):
    """Generate a formatted PDF report of the clinical interview and evaluation."""
    file_path = REPORTS_DIR / f"{convo_id}.pdf"

    # Letter size page: 612 x 792 pt. Margins: 54 pt. Printable width: 504 pt.
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    bold_body_style = ParagraphStyle(
        'ReportBoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    def clean_and_wrap_text(text):
        if not text:
            return ""
        escaped = html.escape(str(text))
        words = []
        for word in escaped.split():
            if len(word) > 40:
                chunks = [word[i:i+40] for i in range(0, len(word), 40)]
                words.append(" ".join(chunks))
            else:
                words.append(word)
        return " ".join(words)

    def format_field(val):
        if not val:
            return "None"
        if isinstance(val, list):
            return ", ".join(str(x) for x in val)
        return str(val)

    patient_name = patient_info.get("name", "Unknown Patient")
    patient_age = str(patient_info.get("age", "N/A"))
    patient_gender = patient_info.get("gender", "N/A")
    chief_complaint = patient_info.get("chief_complaint", "N/A")
    past_history = format_field(patient_info.get("past_history"))
    medications = format_field(patient_info.get("medications"))
    allergies = format_field(patient_info.get("allergies"))

    story = []

    story.append(Paragraph("Clinical Consultation Report", title_style))
    story.append(Spacer(1, 10))

    # Divider line
    divider = Table([[""]], colWidths=[504])
    divider.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 10))

    # Section I: Patient Information
    story.append(Paragraph("I. PATIENT INFORMATION", h1_style))

    info_data = [
        [Paragraph(f"<b>Patient ID:</b> {clean_and_wrap_text(patient_id or 'N/A')}", body_style),
         Paragraph(f"<b>Name:</b> {clean_and_wrap_text(patient_name)}", body_style)],
        [Paragraph(f"<b>Age / Gender:</b> {clean_and_wrap_text(patient_age)} / {clean_and_wrap_text(patient_gender)}", body_style),
         Paragraph(f"<b>Date:</b> {datetime.now().strftime('%Y-%m-%d')}", body_style)],
        [Paragraph(f"<b>Chief Complaint:</b> {clean_and_wrap_text(chief_complaint)}", body_style),
         Paragraph(f"<b>Medical History:</b> {clean_and_wrap_text(past_history)}", body_style)],
        [Paragraph(f"<b>Current Medications:</b> {clean_and_wrap_text(medications)}", body_style),
         Paragraph(f"<b>Allergies:</b> {clean_and_wrap_text(allergies)}", body_style)]
    ]
    info_table = Table(info_data, colWidths=[252, 252])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    # Section II: Performance Evaluation
    story.append(Paragraph("II. PERFORMANCE EVALUATION", h1_style))

    score_data = [
        [
            Paragraph(f"<b>Communication:</b> {evaluation.get('communication_score', 0)}/100", bold_body_style),
            Paragraph(f"<b>Empathy:</b> {evaluation.get('empathy_score', 0)}/100", bold_body_style),
            Paragraph(f"<b>Completeness:</b> {evaluation.get('completeness_score', 0)}/100", bold_body_style),
            Paragraph(f"<b>Overall Score:</b> {evaluation.get('overall_score', 0)}/100", bold_body_style)
        ]
    ]
    score_table = Table(score_data, colWidths=[126, 126, 126, 126])
    score_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Clinical Evaluation Feedback:</b>", bold_body_style))
    feedback_text = clean_and_wrap_text(evaluation.get('history_taking_evaluation', 'N/A'))
    for para in feedback_text.split('\n'):
        if para.strip():
            story.append(Paragraph(para, body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Critical Missing Questions:</b>", bold_body_style))
    for q in evaluation.get('missing_questions', []):
        story.append(Paragraph(f"• {clean_and_wrap_text(q)}", body_style))
    if not evaluation.get('missing_questions'):
        story.append(Paragraph("None", body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Educational Recommendations:</b>", bold_body_style))
    edu_text = clean_and_wrap_text(evaluation.get('educational_feedback', 'N/A'))
    for para in edu_text.split('\n'):
        if para.strip():
            story.append(Paragraph(para, body_style))
    story.append(Spacer(1, 15))

    # Section III: Consultation Summary
    if summary_data:
        story.append(Paragraph("III. CONSULTATION SUMMARY", h1_style))
        story.append(Paragraph(f"<b>Chief Complaint:</b> {clean_and_wrap_text(summary_data.get('chief_complaint', 'N/A'))}", body_style))
        story.append(Paragraph(f"<b>Timeline:</b> {clean_and_wrap_text(summary_data.get('timeline', 'N/A'))}", body_style))
        story.append(Paragraph(f"<b>Symptoms Discussed:</b> {clean_and_wrap_text(', '.join(summary_data.get('symptoms', [])))}", body_style))
        story.append(Paragraph(f"<b>History Collected:</b> {clean_and_wrap_text(', '.join(summary_data.get('history', [])))}", body_style))
        story.append(Spacer(1, 15))

    # Section IV: Dialogue Transcript
    story.append(Paragraph("IV. DIALOGUE TRANSCRIPT", h1_style))
    for msg in transcript:
        sender = "Clinician" if msg["sender"] == "user" else "Patient"
        msg_content = clean_and_wrap_text(msg["content"])
        dialogue_text = f"<b>{sender}:</b> {msg_content}"
        for line in dialogue_text.split('\n'):
            if line.strip():
                story.append(Paragraph(line, body_style))
    story.append(Spacer(1, 15))

    # Disclaimer
    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=body_style,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#64748b')
    )
    story.append(Paragraph("<b>Disclaimer:</b> This report is generated by an artificial intelligence patient simulator for educational purposes only. It does not constitute medical advice or a formal professional clinical assessment.", disclaimer_style))

    def add_page_decorations(canvas, doc_ref):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.setStrokeColor(colors.HexColor('#e2e8f0'))
        canvas.setLineWidth(0.5)
        canvas.line(54, 40, 558, 40)
        canvas.drawString(54, 28, "Developer: Muhammad Umar Ashraf")
        canvas.drawRightString(558, 28, f"Page {canvas._pageNumber}")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
    return file_path
