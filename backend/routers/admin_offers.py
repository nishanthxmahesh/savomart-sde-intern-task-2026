from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from admin_security import get_current_admin
from audit import audit_log
from database import get_db
from models import AdminRole, AdminUser, Offer, StoreScope, Tier
from schemas import AdminOfferIn, AdminOfferOut

router = APIRouter(prefix="/api/admin/offers", tags=["admin-offers"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_scope(s: str) -> StoreScope:
    return StoreScope.ALL if s == "all" else StoreScope.SPECIFIC


def _parse_tier(t: Optional[str]) -> Optional[Tier]:
    if t is None:
        return None
    return Tier(t)


def _to_out(o: Offer) -> AdminOfferOut:
    return AdminOfferOut(
        id=o.id,
        title=o.title,
        description=o.description,
        discount_label=o.discount_label,
        category=o.category,
        valid_from=o.valid_from,
        valid_until=o.valid_until,
        store_scope=o.store_scope.value,
        store_id=o.store_id,
        store_name=o.store_name,
        tier_required=o.tier_required.value if o.tier_required else None,
        created_at=o.created_at,
    )


def _scope_to_admin(query, admin: AdminUser):
    """Store managers only see their own store's offers + sitewide ones.
    Superadmins see everything."""
    if admin.role == AdminRole.SUPERADMIN:
        return query
    return query.filter(
        or_(
            Offer.store_scope == StoreScope.ALL,
            Offer.store_id == admin.store_id,
        )
    )


def _can_mutate(admin: AdminUser, offer: Offer) -> bool:
    if admin.role == AdminRole.SUPERADMIN:
        return True
    # store managers can only mutate offers tied to their store
    return offer.store_scope == StoreScope.SPECIFIC and offer.store_id == admin.store_id


@router.get("", response_model=list[AdminOfferOut])
def list_offers(
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Offer).order_by(Offer.valid_until.desc())
    q = _scope_to_admin(q, admin)
    return [_to_out(o) for o in q.all()]


@router.post("", response_model=AdminOfferOut, status_code=status.HTTP_201_CREATED)
def create_offer(
    payload: AdminOfferIn,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    scope = _parse_scope(payload.store_scope)

    # Store manager can only create store-specific offers tied to their store
    if admin.role == AdminRole.STORE_MANAGER:
        if scope == StoreScope.ALL:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Store managers cannot create sitewide offers.",
            )
        if payload.store_id != admin.store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create offers tied to your own store.",
            )

    if scope == StoreScope.SPECIFIC and not payload.store_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="store_id is required for specific-store offers.",
        )

    if payload.valid_until <= payload.valid_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="valid_until must be after valid_from.",
        )

    offer = Offer(
        title=payload.title,
        description=payload.description,
        discount_label=payload.discount_label,
        category=payload.category,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        store_scope=scope,
        store_id=payload.store_id,
        store_name=payload.store_name,
        tier_required=_parse_tier(payload.tier_required),
    )
    try:
        db.add(offer)
        db.commit()
        db.refresh(offer)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Couldn't save the offer right now.",
        ) from exc

    audit_log(db, admin, "offer.create", target_type="offer", target_id=offer.id, details={"title": offer.title})
    return _to_out(offer)


@router.put("/{offer_id}", response_model=AdminOfferOut)
def update_offer(
    offer_id: int,
    payload: AdminOfferIn,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found.")
    if not _can_mutate(admin, offer):
        raise HTTPException(status_code=403, detail="You cannot edit this offer.")

    if payload.valid_until <= payload.valid_from:
        raise HTTPException(status_code=422, detail="valid_until must be after valid_from.")

    offer.title = payload.title
    offer.description = payload.description
    offer.discount_label = payload.discount_label
    offer.category = payload.category
    offer.valid_from = payload.valid_from
    offer.valid_until = payload.valid_until
    offer.store_scope = _parse_scope(payload.store_scope)
    offer.store_id = payload.store_id
    offer.store_name = payload.store_name
    offer.tier_required = _parse_tier(payload.tier_required)

    try:
        db.commit()
        db.refresh(offer)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't update the offer.") from exc

    audit_log(db, admin, "offer.update", target_type="offer", target_id=offer.id)
    return _to_out(offer)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(
    offer_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found.")
    if not _can_mutate(admin, offer):
        raise HTTPException(status_code=403, detail="You cannot delete this offer.")
    deleted_title = offer.title
    try:
        db.delete(offer)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't delete the offer.") from exc
    audit_log(db, admin, "offer.delete", target_type="offer", target_id=offer_id, details={"title": deleted_title})


@router.post("/{offer_id}/duplicate", response_model=AdminOfferOut, status_code=status.HTTP_201_CREATED)
def duplicate_offer(
    offer_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    src = db.query(Offer).filter(Offer.id == offer_id).first()
    if src is None:
        raise HTTPException(status_code=404, detail="Offer not found.")
    if not _can_mutate(admin, src):
        raise HTTPException(status_code=403, detail="You cannot duplicate this offer.")

    span = src.valid_until - src.valid_from
    now = _now()
    new_offer = Offer(
        title=f"{src.title} (copy)",
        description=src.description,
        discount_label=src.discount_label,
        category=src.category,
        valid_from=now,
        valid_until=now + span,
        store_scope=src.store_scope,
        store_id=src.store_id,
        store_name=src.store_name,
        tier_required=src.tier_required,
    )
    try:
        db.add(new_offer)
        db.commit()
        db.refresh(new_offer)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't duplicate the offer.") from exc

    audit_log(db, admin, "offer.duplicate", target_type="offer", target_id=new_offer.id, details={"source": offer_id})
    return _to_out(new_offer)
