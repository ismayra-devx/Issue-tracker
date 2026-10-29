from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_project_member
from app.db import get_db
from app.models import Comment, Issue, IssueHistory, ProjectMember, User
from app.schemas import CommentCreate, CommentOut, HistoryOut

router = APIRouter(prefix="/projects/{id}/issues/{number}", tags=["comments & history"])


def _get_issue_or_404(db: Session, project_id: int, number: int) -> Issue:
    issue = db.scalar(
        select(Issue).where(
            Issue.project_id == project_id,
            Issue.number == number,
        )
    )
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )
    return issue


@router.post(
    "/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    id: int,
    number: int,
    data: CommentCreate,
    member: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = _get_issue_or_404(db, id, number)
    comment = Comment(
        issue_id=issue.id,
        author_id=current_user.id,
        body=data.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/comments", response_model=List[CommentOut])
def list_comments(
    id: int,
    number: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    issue = _get_issue_or_404(db, id, number)
    comments = db.scalars(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.issue_id == issue.id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    return comments


@router.get("/history", response_model=List[HistoryOut])
def list_issue_history(
    id: int,
    number: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    issue = _get_issue_or_404(db, id, number)
    history = db.scalars(
        select(IssueHistory)
        .options(joinedload(IssueHistory.actor))
        .where(IssueHistory.issue_id == issue.id)
        .order_by(IssueHistory.created_at.desc(), IssueHistory.id.desc())
    ).all()
    return history
