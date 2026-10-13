from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.ai import AnomalyOut, CategorizeRequest, CategorizeResponse, InsightsResponse, ReceiptDraftOut
from app.services import analytics, anomaly, insights, receipt
from app.services.ai_classifier import LLMClassifier, classify, get_llm

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/categorize", response_model=CategorizeResponse)
def categorize(data: CategorizeRequest, user: User = Depends(get_current_user),
               db: Session = Depends(get_db), llm: LLMClassifier | None = Depends(get_llm)):
    """Suggest a category without saving anything (used for previews and receipt scanning)."""
    r = classify(db, user.id, data.description, float(data.amount) if data.amount else None,
                 data.type.value, llm)
    return CategorizeResponse(
        category_id=r.category.id if r.category else None,
        category=r.category.name if r.category else None,
        confidence=r.confidence, source=r.source, auto_apply=r.auto_apply,
    )


@router.get("/insights", response_model=InsightsResponse)
def get_insights(month: str | None = Query(None, description="YYYY-MM, defaults to the current month"),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db),
                 writer: insights.InsightWriter | None = Depends(insights.get_insight_writer)):
    """Plain-language summary of a month. Numbers come from SQL; the LLM only words them."""
    try:
        start = analytics.parse_month(month)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return insights.generate(db, user.id, start, writer)


@router.get("/anomalies", response_model=list[AnomalyOut])
def get_anomalies(days: int = Query(30, ge=1, le=365),
                  month: str | None = Query(None, description="YYYY-MM; if given, covers that whole month instead of the last N days"),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unusual expenses: amount outliers and possible duplicates."""
    if month:
        try:
            start = analytics.parse_month(month)
        except ValueError as e:
            raise HTTPException(422, str(e))
        return anomaly.detect(db, user.id, start, analytics.add_months(start, 1))
    today = date.today()
    return anomaly.detect(db, user.id, today - timedelta(days=days - 1), today + timedelta(days=1))


@router.post("/receipt", response_model=ReceiptDraftOut)
def scan_receipt(file: UploadFile = File(...), user: User = Depends(get_current_user),
                 db: Session = Depends(get_db),
                 extractor: receipt.ReceiptExtractor | None = Depends(receipt.get_receipt_extractor),
                 llm: LLMClassifier | None = Depends(get_llm)):
    """Photo of a receipt -> a transaction draft (merchant, total, date, suggested category). Saves nothing."""
    if extractor is None:
        raise HTTPException(503, "Receipt scanning isn't set up on this server (needs ANTHROPIC_API_KEY).")
    data = file.file.read(receipt.MAX_BYTES + 1)
    if len(data) > receipt.MAX_BYTES:
        raise HTTPException(413, "That image is too large (limit 5 MB).")
    media_type = receipt.sniff_media_type(data)
    if media_type is None:
        raise HTTPException(415, "Upload a JPEG, PNG or WebP image.")
    try:
        draft = receipt.validate(extractor.extract(data, media_type), date.today())
    except receipt.ReceiptError as e:
        raise HTTPException(422, str(e))
    c = classify(db, user.id, draft.description, float(draft.amount), "expense", llm)
    return ReceiptDraftOut(
        description=draft.description, amount=draft.amount, date=draft.date, date_guessed=draft.date_guessed,
        currency=draft.currency, warnings=draft.warnings,
        category_id=c.category.id if c.category else None, category=c.category.name if c.category else None,
        confidence=c.confidence, source=c.source, auto_apply=c.auto_apply,
    )
