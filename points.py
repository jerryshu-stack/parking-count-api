"""Points ledger: every balance change is one atomic UPDATE plus a ledger row.

The UPDATE's WHERE clause re-checks the balance server-side, so two concurrent
spends can't both succeed against a balance that only covers one of them --
the same problem results.json's whole-file read-modify-write can't solve.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from db_models import PointsLedger, User


class InsufficientPoints(Exception):
    pass


def _apply_delta(db: Session, user: User, delta: int, reason: str, related_spot_id: int | None) -> int:
    row = db.execute(
        text(
            "UPDATE users SET points_balance = points_balance + :delta "
            "WHERE id = :id AND points_balance + :delta >= 0 "
            "RETURNING points_balance"
        ),
        {"delta": delta, "id": user.id},
    ).first()
    if row is None:
        raise InsufficientPoints(f"user {user.id} has insufficient points for delta {delta}")

    new_balance = row[0]
    db.add(
        PointsLedger(
            user_id=user.id,
            delta=delta,
            reason=reason,
            related_spot_id=related_spot_id,
            balance_after=new_balance,
        )
    )
    user.points_balance = new_balance
    return new_balance


def award_points(db: Session, user: User, delta: int, reason: str, related_spot_id: int | None = None) -> int:
    return _apply_delta(db, user, abs(delta), reason, related_spot_id)


def spend_points(db: Session, user: User, delta: int, reason: str) -> int:
    """Raises InsufficientPoints without writing anything if the balance is too low."""
    return _apply_delta(db, user, -abs(delta), reason, None)
