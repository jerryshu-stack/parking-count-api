"""ORM models. Named db_models.py, not models.py, so it isn't confused with the
unrelated model.py (the vision-model HTTP client)."""

from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    points_balance: Mapped[int] = mapped_column(default=0)
    photo_unlock_until: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")


class AuthCredential(Base):
    __tablename__ = "auth_credentials"
    __table_args__ = (UniqueConstraint("provider", "provider_subject"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    provider: Mapped[str]
    provider_subject: Mapped[str]
    password_hash: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")

    user: Mapped[User] = relationship()


class Session(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
    revoked_at: Mapped[datetime | None] = mapped_column(default=None)

    user: Mapped[User] = relationship()


class ParkingSpot(Base):
    __tablename__ = "parking_spots"
    __table_args__ = (Index("parking_spots_source_idx", "source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str]
    count: Mapped[int]
    latitude: Mapped[float]
    longitude: Mapped[float]
    location = mapped_column(Geography(geometry_type="POINT", srid=4326))
    recorded_at: Mapped[datetime]
    name: Mapped[str] = mapped_column(default="")
    price: Mapped[str] = mapped_column(default="")
    total: Mapped[int | None] = mapped_column(default=None)
    image_filename: Mapped[str | None] = mapped_column(default=None)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")


class PointsLedger(Base):
    __tablename__ = "points_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    delta: Mapped[int]
    reason: Mapped[str]
    related_spot_id: Mapped[int | None] = mapped_column(
        ForeignKey("parking_spots.id", ondelete="SET NULL"), default=None
    )
    balance_after: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
