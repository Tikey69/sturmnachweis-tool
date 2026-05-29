from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from datetime import date, timedelta
from models.schemas import PdfReportRequest
from services import aggregator, pdf_generator

router = APIRouter(prefix="/api/report", tags=["report"])


@router.post("/pdf")
async def generate_pdf_report(request: PdfReportRequest):
    """
    Generiert einen offiziellen Sturmnachweis als PDF.
    Enthält Datentabelle, Diagramm und Quellenangaben.
    """
    report_date = request.report_date or date.today()
    start_date = request.start_date or (request.damage_date - timedelta(days=1))
    end_date   = request.end_date   or (request.damage_date + timedelta(days=1))

    # Mindestens 7 Tage Kontext für das Diagramm
    if (end_date - start_date).days < 7:
        start_date = request.damage_date - timedelta(days=7)
        end_date   = request.damage_date + timedelta(days=1)

    try:
        result = await aggregator.query_all_sources(
            plz=request.plz,
            start_date=start_date,
            end_date=end_date,
            threshold_kmh=62.0,
            sources=request.sources,
        )

        pdf_bytes = pdf_generator.generate_pdf(
            result=result,
            damage_date=request.damage_date,
            policy_number=request.policy_number,
            insured_name=request.insured_name,
            insured_address=request.insured_address,
            claim_number=request.claim_number,
        )

        filename = (
            f"Sturmnachweis_{request.plz}_{request.damage_date.strftime('%Y%m%d')}.pdf"
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"PDF-Generierung fehlgeschlagen: {e}")
