# Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run database migrations / seed demo data
python seed.py

# Start development server
uvicorn app.main:app --reload
```
API Documentation (Interactive OpenAPI Swagger UI) will be available at: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend development server runs at: `http://localhost:5173`

### 3. Running Automated Tests

```bash
cd backend
pytest
```

---

# Demo Logins

All demo accounts share the password: `Demo@1234`

| Name | Email | Role | Accessible Projects | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Asha** | `owner@demo.com` | Owner | Core Platform, Executive Roadmap | Can manage members & labels in both projects |
| **Ravi** | `dev@demo.com` | Member | Core Platform | Cannot access or view Executive Roadmap (404) |
| **Meera** | `qa@demo.com` | Member | Core Platform | Cannot access or view Executive Roadmap (404) |

---

# Data Model

The application uses SQLAlchemy 2.0 with strict referential integrity (`PRAGMA foreign_keys=ON` on SQLite and foreign key cascades):

* **User**: Identity and credentials (`name`, `email` [indexed, unique], `password_hash`).
* **Project**: Work container (`name`, `description`, `owner_id`).
* **ProjectMember**: Association table with `(project_id, user_id)` unique constraint and role enum (`owner`, `member`).
* **Label**: Tagging mechanism scoped by project with `(project_id, name)` unique constraint.
* **Issue**: Central workflow item with human-readable, project-scoped sequential numbers (`number`, unique on `(project_id, number)`). Indexed on `(project_id, status)`, `(project_id, assignee_id)`, and `(project_id, priority)`.
* **IssueLabel**: Composite primary key junction table `(issue_id, label_id)` with cascade deletions.
* **Comment**: Chronological discussion thread per issue (`created_at` ascending).
* **IssueHistory**: Immutable audit log of every attribute change (`created_at` descending).

### Key Architectural Decision
> **All issue changes go through one service function so history is always recorded.**
>
> Neither HTTP route handlers nor external modules directly mutate issue attributes or statuses. All state transitions, reassignments, label modifications, and edits must flow through `issue_service.update_issue`. This guarantees that:
> 1. Unchanged fields are discarded without dirty writes.
> 2. Workflow transitions are validated against the state machine before committing.
> 3. Assignees and labels are validated for project membership.
> 4. An `IssueHistory` row is recorded for every modified field within the exact same atomic transaction.

---

# Workflow Rules

Issue state transitions follow a strict finite state machine. Skipping steps or moving backwards is rejected, except for reopening a closed issue:

| Current Status | Permitted Target Status | Description |
| :--- | :--- | :--- |
| `open` | `in_progress` | Work starts on an open backlog item |
| `in_progress` | `in_review` | Development complete; submitted for code review / QA |
| `in_review` | `closed` | Verification complete; issue resolved |
| `closed` | `open` | **Reopen move**: Re-opens an issue if defects reoccur |

*Note: Attempting to transition to the same status or any other state (e.g. `open -> closed`) raises a `WorkflowError` (HTTP 400).*

---

# What's Finished

---

# What I'd Do With More Time

---

# AI Tools Used
