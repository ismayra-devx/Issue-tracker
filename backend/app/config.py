import json
import os
from pathlib import Path
import sys
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


def _is_pytest() -> bool:
    """Return True if code is executing under pytest test runner."""
    return (
        "pytest" in sys.modules
        or any("pytest" in arg.lower() for arg in sys.argv)
        or bool(os.environ.get("PYTEST_CURRENT_TEST"))
    )


class Settings(BaseSettings):
    SECRET_KEY: Optional[str] = None
    DATABASE_URL: str = "sqlite:///./issue_tracker.db"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173"]
    BCRYPT_ROUNDS: int = 12

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        if _is_pytest():
            if not self.SECRET_KEY:
                self.SECRET_KEY = "test-secret-key-for-testing-only-32-chars-long"
            return self

        if not self.SECRET_KEY or not self.SECRET_KEY.strip():
            raise ValueError(
                "SECRET_KEY is not set. A secret key is required to run the application. "
                "Please set SECRET_KEY in your environment or in backend/.env. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return self

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
