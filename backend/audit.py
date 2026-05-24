"""Admin audit log helper.

Every mutating admin action calls audit_log(...) so the AdminAuditLog
table becomes a full who-did-what-when trail. Failures here never break
the underlying action — the action's transaction has already committed
by the time we log it (or could be moved to within if strict ordering
matters).
"""
import json
import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from models import AdminAuditLog, AdminUser

log = logging.getLogger("savomart.audit")


def audit_log(
    db: Session,
    admin: AdminUser,
    action: str,
    *,
    target_type: Optional[str] = None,
    target_id: Optional[Any] = None,
    details: Optional[dict] = None,
) -> None:
    try:
        entry = AdminAuditLog(
            admin_id=admin.id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            details=json.dumps(details, default=str) if details else None,
        )
        db.add(entry)
        db.commit()
    except Exception as exc:  # noqa: BLE001 — never block the parent action
        db.rollback()
        log.warning("audit log write failed: action=%s target=%s err=%s", action, target_id, exc)
