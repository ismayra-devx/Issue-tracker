import enum
from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.models import IssuePriority, IssueStatus, IssueType, ProjectRole

HEX_COLOR_REGEX = r"^#[0-9a-fA-F]{6}$"


# --- AUTH SCHEMAS ---


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()


class TokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


# --- PROJECT SCHEMAS ---


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, min_length=1, max_length=1000)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime


class MemberAdd(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    email: str
    role: ProjectRole

    @model_validator(mode="before")
    @classmethod
    def resolve_user_attributes(cls, data: Any) -> Any:
        if hasattr(data, "user") and getattr(data, "user") is not None:
            user = data.user
            return {
                "user_id": data.user_id,
                "name": getattr(user, "name", None) or getattr(data, "name", None),
                "email": getattr(user, "email", None) or getattr(data, "email", None),
                "role": data.role,
            }
        return data


class LabelCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=30)
    color: str = Field(default="#888888", pattern=HEX_COLOR_REGEX)


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str


# --- ISSUE SCHEMAS ---


class IssueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    type: IssueType
    priority: IssuePriority = IssuePriority.medium
    assignee_id: Optional[int] = None
    label_ids: List[int] = Field(default_factory=list, max_length=20)

    @field_validator("label_ids")
    @classmethod
    def validate_unique_label_ids(cls, v: List[int]) -> List[int]:
        if len(v) != len(set(v)):
            raise ValueError("label_ids must not contain duplicates")
        return v


class IssueUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    type: Optional[IssueType] = None
    priority: Optional[IssuePriority] = None
    status: Optional[IssueStatus] = None
    assignee_id: Optional[int] = None
    label_ids: Optional[List[int]] = Field(default=None, max_length=20)

    @field_validator("label_ids")
    @classmethod
    def validate_unique_label_ids(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is not None and len(v) != len(set(v)):
            raise ValueError("label_ids must not contain duplicates")
        return v

    @model_validator(mode="after")
    def validate_not_empty(self) -> "IssueUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided for update")
        return self

    def changes(self) -> dict[str, Any]:
        return {field: getattr(self, field) for field in self.model_fields_set}


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: int
    project_id: int
    title: str
    description: Optional[str] = None
    type: IssueType
    priority: IssuePriority
    status: IssueStatus
    assignee: Optional[UserOut] = None
    reporter: UserOut
    labels: List[LabelOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class IssueSort(str, enum.Enum):
    created_at = "created_at"
    updated_at = "updated_at"


class IssueFilters(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: Optional[IssueStatus] = None
    priority: Optional[IssuePriority] = None
    type: Optional[IssueType] = None
    assignee_id: Optional[int] = None
    label_id: Optional[int] = None
    q: Optional[str] = Field(default=None, min_length=1, max_length=100)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: IssueSort = IssueSort.created_at


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(from_attributes=True)


# --- COMMENTS AND HISTORY SCHEMAS ---


class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    body: str = Field(..., min_length=1, max_length=5000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
    author: UserOut
    created_at: datetime


class HistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    actor: UserOut
    created_at: datetime


# --- ERROR SCHEMAS ---


class ErrorOut(BaseModel):
    detail: str

    model_config = ConfigDict(from_attributes=True)
