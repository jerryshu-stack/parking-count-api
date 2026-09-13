"""Device-level API key check, password hashing, opaque bearer tokens, and the
register/login/logout/me routes.

Sessions are opaque random tokens, not JWTs: only the sha256 hash is stored (same
reasoning as password hashing -- a DB dump shouldn't hand out live sessions), and
revoking one is a plain row update, which a signed JWT can't do without an extra
denylist anyway.
"""

import hashlib
import os
import secrets
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from db_models import AuthCredential, Session as DbSession, User
from points import award_points

WELCOME_GRANT = 4
PHOTO_UNLOCK_COST = int(os.environ.get("PHOTO_UNLOCK_COST", "2"))
PHOTO_UNLOCK_SECONDS = int(os.environ.get("PHOTO_UNLOCK_SECONDS", "60"))

API_KEY = os.environ.get("PARKING_API_KEY")
if not API_KEY:
    raise RuntimeError("PARKING_API_KEY environment variable is not set")


def require_api_key(x_api_key: str = Header(None)) -> None:
    if x_api_key is None or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def issue_token() -> str:
    return secrets.token_hex(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_bearer_token(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    return authorization.removeprefix("Bearer ").strip()


def optional_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User | None:
    """Same lookup as require_user, but returns None instead of raising.

    Used by routes that must keep serving government data to callers without a
    session while still honouring the unlock rule for community rows.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    session = db.get(DbSession, hash_token(authorization.removeprefix("Bearer ").strip()))
    if session is None or session.revoked_at is not None:
        return None
    return db.get(User, session.user_id)


def require_user(token: str = Depends(get_bearer_token), db: Session = Depends(get_db)) -> User:
    session = db.get(DbSession, hash_token(token))
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="invalid or expired session")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid or expired session")
    return user


router = APIRouter(dependencies=[Depends(require_api_key)])


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=200)


def _issue_session(db: Session, user: User) -> str:
    token = issue_token()
    db.add(DbSession(token_hash=hash_token(token), user_id=user.id))
    return token


@router.post("/auth/register")
def register(body: Credentials, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    if db.execute(select(User).where(User.username == username)).first():
        raise HTTPException(status_code=409, detail="username already taken")

    user = User(username=username)
    db.add(user)
    db.flush()  # assign user.id before it's referenced below

    db.add(
        AuthCredential(
            user_id=user.id,
            provider="password",
            provider_subject=username,
            password_hash=hash_password(body.password),
        )
    )
    balance = award_points(db, user, WELCOME_GRANT, reason="welcome_grant")
    token = _issue_session(db, user)
    db.commit()

    return {"token": token, "username": username, "points_balance": balance}


@router.post("/auth/login")
def login(body: Credentials, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    cred = db.execute(
        select(AuthCredential).where(
            AuthCredential.provider == "password", AuthCredential.provider_subject == username
        )
    ).scalar_one_or_none()
    if cred is None or not cred.password_hash or not verify_password(body.password, cred.password_hash):
        raise HTTPException(status_code=401, detail="invalid username or password")

    user = db.get(User, cred.user_id)
    token = _issue_session(db, user)
    db.commit()

    return {"token": token, "username": user.username, "points_balance": user.points_balance}


@router.post("/auth/logout")
def logout(
    token: str = Depends(get_bearer_token),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    session = db.get(DbSession, hash_token(token))
    if session is not None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(require_user)):
    now = datetime.now(timezone.utc)
    unlock_active = user.photo_unlock_until is not None and user.photo_unlock_until > now
    remaining = int((user.photo_unlock_until - now).total_seconds()) if unlock_active else 0
    return {
        "username": user.username,
        "points_balance": user.points_balance,
        "unlock_active": unlock_active,
        "unlock_remaining_seconds": max(remaining, 0),
        "photo_unlock_cost": PHOTO_UNLOCK_COST,
    }
