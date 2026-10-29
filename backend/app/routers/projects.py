from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_project_member, require_project_owner
from app.db import get_db
from app.models import Label, Project, ProjectMember, ProjectRole, User
from app.schemas import (
    LabelCreate,
    LabelOut,
    MemberAdd,
    MemberOut,
    ProjectCreate,
    ProjectOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=data.name,
        description=data.description,
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()

    # Automatically add creator as owner member
    owner_member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.owner,
    )
    db.add(owner_member)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectOut])
def list_my_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = db.scalars(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.id.desc())
    ).all()
    return projects


@router.get("/{id}", response_model=ProjectOut)
def get_project(
    id: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    project = db.get(Project, id)
    return project


@router.post(
    "/{id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    id: int,
    data: MemberAdd,
    owner_member: ProjectMember = Depends(require_project_owner),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.email == data.email.lower()))
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    existing_member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == id,
            ProjectMember.user_id == target_user.id,
        )
    )
    if existing_member is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a project member",
        )

    new_member = ProjectMember(
        project_id=id,
        user_id=target_user.id,
        role=ProjectRole.member,
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member


@router.get("/{id}/members", response_model=List[MemberOut])
def list_project_members(
    id: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    members = db.scalars(
        select(ProjectMember)
        .options(joinedload(ProjectMember.user))
        .where(ProjectMember.project_id == id)
        .order_by(ProjectMember.id)
    ).all()
    return members


@router.post(
    "/{id}/labels",
    response_model=LabelOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project_label(
    id: int,
    data: LabelCreate,
    owner_member: ProjectMember = Depends(require_project_owner),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(Label).where(
            Label.project_id == id,
            Label.name == data.name,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Label name already exists in this project",
        )

    label = Label(project_id=id, name=data.name, color=data.color)
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.get("/{id}/labels", response_model=List[LabelOut])
def list_project_labels(
    id: int,
    member: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
):
    labels = db.scalars(
        select(Label).where(Label.project_id == id).order_by(Label.name)
    ).all()
    return labels
