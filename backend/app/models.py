import enum
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ProjectRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class IssueType(str, enum.Enum):
    bug = "bug"
    task = "task"


class IssuePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IssueStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    in_review = "in_review"
    closed = "closed"


# UNIQUE & INDEX on email: Enforces unique user identities and ensures fast lookup during authentication.
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owned_projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="owner", foreign_keys="Project.owner_id"
    )
    memberships: Mapped[List["ProjectMember"]] = relationship(
        "ProjectMember", back_populates="user", cascade="all, delete-orphan"
    )
    assigned_issues: Mapped[List["Issue"]] = relationship(
        "Issue", back_populates="assignee", foreign_keys="Issue.assignee_id"
    )
    reported_issues: Mapped[List["Issue"]] = relationship(
        "Issue", back_populates="reporter", foreign_keys="Issue.reporter_id"
    )
    comments: Mapped[List["Comment"]] = relationship(
        "Comment", back_populates="author", cascade="all, delete-orphan"
    )
    history_entries: Mapped[List["IssueHistory"]] = relationship(
        "IssueHistory", back_populates="actor", cascade="all, delete-orphan"
    )


# FK owner_id: Identifies the project creator; project deletion cascades to all associated members, labels, and issues.
class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner: Mapped["User"] = relationship("User", back_populates="owned_projects")
    members: Mapped[List["ProjectMember"]] = relationship(
        "ProjectMember", back_populates="project", cascade="all, delete-orphan"
    )
    labels: Mapped[List["Label"]] = relationship(
        "Label", back_populates="project", cascade="all, delete-orphan"
    )
    issues: Mapped[List["Issue"]] = relationship(
        "Issue", back_populates="project", cascade="all, delete-orphan"
    )


# UNIQUE(project_id, user_id): Prevents duplicate membership records for the same user within a project.
class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[ProjectRole] = mapped_column(
        Enum(ProjectRole, native_enum=False), default=ProjectRole.member, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship("Project", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")


# UNIQUE(project_id, name): Ensures label names are distinct within a single project scope.
class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_labels_project_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)

    project: Mapped["Project"] = relationship("Project", back_populates="labels")
    issues: Mapped[List["Issue"]] = relationship(
        "Issue", secondary="issue_labels", back_populates="labels"
    )


# Composite PK (issue_id, label_id): Represents the many-to-many relationship while preventing duplicate label attachments.
class IssueLabel(Base):
    __tablename__ = "issue_labels"

    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True
    )
    label_id: Mapped[int] = mapped_column(
        ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True
    )


# UNIQUE(project_id, number): Guarantees per-project human-readable sequence numbers (e.g. #1, #2).
# INDEX(project_id): Speeds up project-scoped issue listings.
# INDEXES on (project_id, status), (project_id, assignee_id), (project_id, priority): Optimize kanban board, triage, and filter queries.
class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("project_id", "number", name="uq_issues_project_number"),
        Index("ix_issues_project_status", "project_id", "status"),
        Index("ix_issues_project_assignee", "project_id", "assignee_id"),
        Index("ix_issues_project_priority", "project_id", "priority"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[IssueType] = mapped_column(
        Enum(IssueType, native_enum=False), nullable=False
    )
    priority: Mapped[IssuePriority] = mapped_column(
        Enum(IssuePriority, native_enum=False), nullable=False
    )
    status: Mapped[IssueStatus] = mapped_column(
        Enum(IssueStatus, native_enum=False), default=IssueStatus.open, nullable=False
    )
    assignee_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship("Project", back_populates="issues")
    assignee: Mapped[Optional["User"]] = relationship(
        "User", back_populates="assigned_issues", foreign_keys=[assignee_id]
    )
    reporter: Mapped["User"] = relationship(
        "User", back_populates="reported_issues", foreign_keys=[reporter_id]
    )
    labels: Mapped[List["Label"]] = relationship(
        "Label", secondary="issue_labels", back_populates="issues"
    )
    comments: Mapped[List["Comment"]] = relationship(
        "Comment", back_populates="issue", cascade="all, delete-orphan"
    )
    history: Mapped[List["IssueHistory"]] = relationship(
        "IssueHistory", back_populates="issue", cascade="all, delete-orphan"
    )


# INDEX(issue_id): Accelerates retrieving conversation threads for a specific issue.
class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    issue: Mapped["Issue"] = relationship("Issue", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")


# INDEX(issue_id): Accelerates loading the audit history timeline for a given issue.
class IssueHistory(Base):
    __tablename__ = "issue_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), index=True, nullable=False
    )
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    field: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    issue: Mapped["Issue"] = relationship("Issue", back_populates="history")
    actor: Mapped["User"] = relationship("User", back_populates="history_entries")
