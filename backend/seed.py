import os
import sys
from pathlib import Path

# Ensure backend directory is in python search path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Provide a seed fallback key if .env has not yet been copied
if "SECRET_KEY" not in os.environ and not (backend_dir / ".env").exists():
    os.environ["SECRET_KEY"] = "seed-script-temporary-key-min-32-chars-long"

from app.auth import hash_password
from app.db import Base, SessionLocal, engine
from app.models import (
    Comment,
    IssuePriority,
    IssueType,
    Label,
    Project,
    ProjectMember,
    ProjectRole,
    User,
)
from app.schemas import IssueCreate
from app.services.issue_service import create_issue, update_issue


def seed_database():
    print("=" * 60)
    print("Resetting database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding demo users (password: 'Demo@1234')...")
        demo_password_hash = hash_password("Demo@1234")

        asha = User(name="Asha", email="owner@demo.com", password_hash=demo_password_hash)
        ravi = User(name="Ravi", email="dev@demo.com", password_hash=demo_password_hash)
        meera = User(name="Meera", email="qa@demo.com", password_hash=demo_password_hash)

        db.add_all([asha, ravi, meera])
        db.commit()
        db.refresh(asha)
        db.refresh(ravi)
        db.refresh(meera)

        print(f"  [+] Created {asha.name} ({asha.email}) [Owner]")
        print(f"  [+] Created {ravi.name} ({ravi.email}) [Developer]")
        print(f"  [+] Created {meera.name} ({meera.email}) [QA Engineer]")

        print("\nSeeding projects & memberships...")
        # Project 1: Core Platform (all 3 members)
        p1 = Project(
            name="Core Platform",
            description="Main engineering issue tracker and microservices platform",
            owner_id=asha.id,
        )
        # Project 2: Executive Roadmap (only Asha)
        p2 = Project(
            name="Executive Roadmap",
            description="Confidential quarterly strategy and initiatives (Asha only)",
            owner_id=asha.id,
        )
        db.add_all([p1, p2])
        db.commit()
        db.refresh(p1)
        db.refresh(p2)

        # Memberships for Project 1: Asha (owner), Ravi (member), Meera (member)
        m_asha_p1 = ProjectMember(project_id=p1.id, user_id=asha.id, role=ProjectRole.owner)
        m_ravi_p1 = ProjectMember(project_id=p1.id, user_id=ravi.id, role=ProjectRole.member)
        m_meera_p1 = ProjectMember(project_id=p1.id, user_id=meera.id, role=ProjectRole.member)

        # Membership for Project 2: Asha only
        m_asha_p2 = ProjectMember(project_id=p2.id, user_id=asha.id, role=ProjectRole.owner)

        db.add_all([m_asha_p1, m_ravi_p1, m_meera_p1, m_asha_p2])
        db.commit()

        print(f"  [+] Project 1: '{p1.name}' (Members: Asha [Owner], Ravi, Meera)")
        print(f"  [+] Project 2: '{p2.name}' (Members: Asha [Owner])")

        print("\nSeeding labels for Project 1...")
        lbl_backend = Label(project_id=p1.id, name="backend", color="#3b82f6")
        lbl_frontend = Label(project_id=p1.id, name="frontend", color="#8b5cf6")
        lbl_security = Label(project_id=p1.id, name="security", color="#ef4444")
        lbl_perf = Label(project_id=p1.id, name="performance", color="#f59e0b")

        db.add_all([lbl_backend, lbl_frontend, lbl_security, lbl_perf])
        db.commit()
        for lbl in (lbl_backend, lbl_frontend, lbl_security, lbl_perf):
            db.refresh(lbl)

        print("\nSeeding 15 issues in Project 1 via issue_service (generating real history)...")

        # 1. Closed critical bug
        i1 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Database connection pool exhaustion under load",
                description="Worker threads hang when database query latency spikes over 500ms.",
                type=IssueType.bug,
                priority=IssuePriority.critical,
                assignee_id=ravi.id,
                label_ids=[lbl_backend.id, lbl_perf.id],
            ),
        )
        update_issue(db, i1, ravi, {"status": "in_progress"})
        update_issue(db, i1, ravi, {"status": "in_review"})
        update_issue(db, i1, asha, {"status": "closed"})

        # 2. In-Review high task
        i2 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Implement OAuth2 refresh token rotation",
                description="Issue short-lived access tokens and rotate single-use refresh tokens.",
                type=IssueType.task,
                priority=IssuePriority.high,
                assignee_id=ravi.id,
                label_ids=[lbl_backend.id, lbl_security.id],
            ),
        )
        update_issue(db, i2, ravi, {"status": "in_progress"})
        update_issue(db, i2, ravi, {"status": "in_review"})

        # 3. In-Progress high bug
        i3 = create_issue(
            db,
            p1.id,
            ravi,
            IssueCreate(
                title="Memory leak in WebSocket notification dispatcher",
                description="Detached subscriber channels are not garbage collected on disconnect.",
                type=IssueType.bug,
                priority=IssuePriority.high,
                assignee_id=ravi.id,
                label_ids=[lbl_backend.id],
            ),
        )
        update_issue(db, i3, ravi, {"status": "in_progress"})

        # 4. Open medium task
        i4 = create_issue(
            db,
            p1.id,
            meera,
            IssueCreate(
                title="Add rate limiting headers to /auth/login",
                description="Include X-RateLimit-Limit and Retry-After headers on 429 responses.",
                type=IssueType.task,
                priority=IssuePriority.medium,
                assignee_id=ravi.id,
                label_ids=[lbl_security.id],
            ),
        )

        # 5. Closed low bug
        i5 = create_issue(
            db,
            p1.id,
            meera,
            IssueCreate(
                title="Fix CSS flexbox overflow on mobile navigation bar",
                description="Navbar links overlap hamburger button at 375px viewport.",
                type=IssueType.bug,
                priority=IssuePriority.low,
                assignee_id=meera.id,
                label_ids=[lbl_frontend.id],
            ),
        )
        update_issue(db, i5, meera, {"status": "in_progress"})
        update_issue(db, i5, meera, {"status": "in_review"})
        update_issue(db, i5, asha, {"status": "closed"})

        # 6. In-Progress medium task
        i6 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Add dark mode toggle to user preference dashboard",
                description="Persist theme preference in localStorage and synchronize with system color scheme.",
                type=IssueType.task,
                priority=IssuePriority.medium,
                label_ids=[lbl_frontend.id],
            ),
        )
        update_issue(db, i6, meera, {"assignee_id": meera.id, "status": "in_progress"})

        # 7. In-Review high task
        i7 = create_issue(
            db,
            p1.id,
            meera,
            IssueCreate(
                title="Automated regression tests for issue pagination",
                description="Add end-to-end tests validating boundary conditions across multiple pages.",
                type=IssueType.task,
                priority=IssuePriority.high,
                assignee_id=meera.id,
                label_ids=[lbl_backend.id],
            ),
        )
        update_issue(db, i7, meera, {"status": "in_progress"})
        update_issue(db, i7, meera, {"status": "in_review"})

        # 8. Reopened bug (open)
        i8 = create_issue(
            db,
            p1.id,
            ravi,
            IssueCreate(
                title="CORS preflight failure on localhost with custom headers",
                description="OPTIONS request rejected when Authorization header sent from cross-origin.",
                type=IssueType.bug,
                priority=IssuePriority.medium,
                assignee_id=ravi.id,
                label_ids=[lbl_backend.id],
            ),
        )
        update_issue(db, i8, ravi, {"status": "in_progress"})
        update_issue(db, i8, ravi, {"status": "in_review"})
        update_issue(db, i8, asha, {"status": "closed"})
        update_issue(db, i8, meera, {"status": "open"})  # Reopen move

        # 9. Closed medium task
        i9 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Enforce password complexity rules during registration",
                description="Validate min 8 chars with uppercase, lowercase, and numeric characters.",
                type=IssueType.task,
                priority=IssuePriority.medium,
                assignee_id=asha.id,
                label_ids=[lbl_security.id],
            ),
        )
        update_issue(db, i9, asha, {"status": "in_progress"})
        update_issue(db, i9, asha, {"status": "in_review"})
        update_issue(db, i9, asha, {"status": "closed"})

        # 10. Open low task
        i10 = create_issue(
            db,
            p1.id,
            ravi,
            IssueCreate(
                title="Audit log search query optimization using composite index",
                description="Add compound index on (issue_id, created_at) to accelerate timeline rendering.",
                type=IssueType.task,
                priority=IssuePriority.low,
                label_ids=[lbl_backend.id, lbl_perf.id],
            ),
        )

        # 11. In-Progress critical bug
        i11 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Session cookie SameSite policy misconfigured in production",
                description="Lax policy allows cross-site top-level navigation state leaking.",
                type=IssueType.bug,
                priority=IssuePriority.critical,
                assignee_id=ravi.id,
                label_ids=[lbl_security.id],
            ),
        )
        update_issue(db, i11, ravi, {"status": "in_progress"})

        # 12. Open low bug
        i12 = create_issue(
            db,
            p1.id,
            meera,
            IssueCreate(
                title="Kanban board drag-and-drop state flicker",
                description="Card briefly snaps back to origin column before server responds.",
                type=IssueType.bug,
                priority=IssuePriority.low,
                assignee_id=meera.id,
                label_ids=[lbl_frontend.id],
            ),
        )

        # 13. Closed high bug
        i13 = create_issue(
            db,
            p1.id,
            asha,
            IssueCreate(
                title="Health check endpoint returns 503 during migrations",
                description="Probe fails when database DDL transactions lock catalog tables.",
                type=IssueType.bug,
                priority=IssuePriority.high,
                assignee_id=asha.id,
                label_ids=[lbl_backend.id],
            ),
        )
        update_issue(db, i13, asha, {"status": "in_progress"})
        update_issue(db, i13, asha, {"status": "in_review"})
        update_issue(db, i13, asha, {"status": "closed"})

        # 14. Open low task
        i14 = create_issue(
            db,
            p1.id,
            meera,
            IssueCreate(
                title="Export project issue list to CSV / JSON format",
                description="Provide button on project page to download filtered issue list.",
                type=IssueType.task,
                priority=IssuePriority.low,
            ),
        )

        # 15. In-Review medium bug
        i15 = create_issue(
            db,
            p1.id,
            ravi,
            IssueCreate(
                title="Fix broken markdown image rendering in issue description",
                description="Inline markdown images fail to load with relative paths.",
                type=IssueType.bug,
                priority=IssuePriority.medium,
                assignee_id=meera.id,
                label_ids=[lbl_frontend.id],
            ),
        )
        update_issue(db, i15, meera, {"status": "in_progress"})
        update_issue(db, i15, meera, {"status": "in_review"})

        print("\nSeeding comments on selected issues...")
        c1 = Comment(
            issue_id=i1.id,
            author_id=ravi.id,
            body="Root cause identified in SQLAlchemy pool overflow. Increased queue size to 20 with 30s timeout.",
        )
        c2 = Comment(
            issue_id=i1.id,
            author_id=asha.id,
            body="Verified fix on staging under 2,000 req/s load test. Closing issue.",
        )
        c3 = Comment(
            issue_id=i2.id,
            author_id=meera.id,
            body="Integration test suite for refresh token revocation completed and passing.",
        )
        c4 = Comment(
            issue_id=i8.id,
            author_id=meera.id,
            body="Bug reproduced on Safari iOS 17 with custom headers. Reopening for investigation.",
        )
        c5 = Comment(
            issue_id=i11.id,
            author_id=asha.id,
            body="Critical security item: please prioritize for deployment in next hotfix.",
        )
        db.add_all([c1, c2, c3, c4, c5])
        db.commit()

        print("  [+] Added 5 comments across issues #1, #2, #8, #11")

        print("\n" + "=" * 60)
        print("Demo database seeding complete!")
        print("Credentials for testing:")
        print("  1. Asha (Owner):     owner@demo.com  / Demo@1234  -> Access to Project 1 & 2")
        print("  2. Ravi (Developer): dev@demo.com    / Demo@1234  -> Access to Project 1 only")
        print("  3. Meera (QA):       qa@demo.com     / Demo@1234  -> Access to Project 1 only")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
