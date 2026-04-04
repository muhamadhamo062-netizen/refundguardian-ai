"""CRUD for order records — scoped to authenticated user only."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import OrderRecord, User
from app.schemas import OrderOut, OrderUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(OrderRecord).filter(OrderRecord.user_id == user.id).order_by(OrderRecord.created_at.desc()).all()
    return rows


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(OrderRecord).filter(OrderRecord.id == order_id, OrderRecord.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return row


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    body: OrderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(OrderRecord).filter(OrderRecord.id == order_id, OrderRecord.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if body.complaint_letter is not None:
        row.complaint_letter = body.complaint_letter
    if body.status is not None:
        row.status = body.status
    db.commit()
    db.refresh(row)
    logger.info("Order updated id=%s user_id=%s", order_id, user.id)
    return row


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(OrderRecord).filter(OrderRecord.id == order_id, OrderRecord.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    db.delete(row)
    db.commit()
    logger.info("Order deleted id=%s user_id=%s", order_id, user.id)
    return None
