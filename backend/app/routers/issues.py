from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth import get_current_user, get_project_member
from app.db import get_db
from app.models import (
    Issue,
    IssuePriority,
    IssueStatus,
    IssueType,
    Label,
    ProjectMember,
    User,
)
from app.schemas import IssueCreate, IssueOut, IssueUpdate, Page
from app.services.issue_service import create_issue, update_issue

router = APIRouter(prefix="/projects/{id}/issues", tags=["issues"])


@router.post("", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def create_project_issue(
    id: int,
    data: IssueCreate,
    member: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = create_issue(db, id, current_user, data)
    # Ensure relationships are loaded for IssueOut response
    return (
        db.scalar(
            select(Issue)
            .options(
                joinedload(Issue.assignee),
                joinedload(Issue.reporter),
                selectinload(Issue.labels),
            )
            .where(Issue.id == issue.id)
        )
        or issue
    )


@router.get("", response_model=Page[IssueOut])
def list_project_issues(
    id: int,
    status: Optional[IssueStatus] = None,
    priority: Optional[IssuePriority] = None,
    assignee_id: Optional[int] = None,
    label_id: Optional[int] = None,
    type: Optional[IssueType] = None,
    q: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="created_at", pattern="^(created_at|updated_at)$"),
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    conditions = [Issue.project_id == id]

    if status is not None:
        conditions.append(Issue.status == status)
    if priority is not None:
        conditions.append(Issue.priority == priority)
    if type is not None:
        conditions.append(Issue.type == type)
    if assignee_id is not None:
        conditions.append(Issue.assignee_id == assignee_id)
    if label_id is not None:
        conditions.append(Issue.labels.any(Label.id == label_id))
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        conditions.append(
            or_(
                Issue.title.ilike(search_term),
                Issue.description.ilike(search_term),
            )
        )

    # Calculate total count matching filters
    total = db.scalar(select(func.count(Issue.id)).where(*conditions)) or 0

    # Build eager-loading query to eliminate N+1 overhead
    query = (
        select(Issue)
        .options(
            joinedload(Issue.assignee),
            joinedload(Issue.reporter),
            selectinload(Issue.labels),
        )
        .where(*conditions)
    )

    if sort == "updated_at":
        query = query.order_by(Issue.updated_at.desc(), Issue.id.desc())
    else:
        query = query.order_by(Issue.created_at.desc(), Issue.id.desc())

    offset = (page - 1) * page_size
    items = db.scalars(query.offset(offset).limit(page_size)).unique().all()

    return Page[IssueOut](
        items=list(items),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{number}", response_model=IssueOut)
def get_project_issue(
    id: int,
    number: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    issue = db.scalar(
        select(Issue)
        .options(
            joinedload(Issue.assignee),
            joinedload(Issue.reporter),
            selectinload(Issue.labels),
        )
        .where(Issue.project_id == id, Issue.number == number)
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )
    return issue


@router.patch("/{number}", response_model=IssueOut)
def patch_project_issue(
    id: int,
    number: int,
    data: IssueUpdate,
    member: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = db.scalar(
        select(Issue)
        .options(
            joinedload(Issue.assignee),
            joinedload(Issue.reporter),
            selectinload(Issue.labels),
        )
        .where(Issue.project_id == id, Issue.number == number)
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    changes = data.changes()
    update_issue(db, issue, current_user, changes)

    # Re-fetch with eager loaded relationships for clean serialization
    refreshed = db.scalar(
        select(Issue)
        .options(
            joinedload(Issue.assignee),
            joinedload(Issue.reporter),
            selectinload(Issue.labels),
        )
        .where(Issue.id == issue.id)
    )
    return refreshed or issue
