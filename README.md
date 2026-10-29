# Full-Stack Issue Tracker

A modern, responsive issue tracking and project management system built with **FastAPI**, **SQLAlchemy 2.0**, and **React 19 (Vite + Tailwind CSS)**.

---

## Setup & Getting Started

### Prerequisites
* **Python 3.10+** (tested on Python 3.12 & 3.14)
* **Node.js 18+** & **npm**

---

### 1. Backend Setup

```bash
cd backend

# Create a fresh virtual environment
python -m venv venv

# Activate the virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Seed demo data and populate initial database
python seed.py

# Start development server
uvicorn app.main:app --port 8000 --reload
```

* Backend API: `http://localhost:8000`
* Interactive API Documentation (OpenAPI Swagger UI): `http://localhost:8000/docs`

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Optional: configure environment variables (defaults to http://localhost:8000)
cp .env.example .env

# Start development server
npm run dev
```

* Frontend application: `http://localhost:5173`

To build the frontend for production:
```bash
npm run build
```

---

### 3. Running Automated Tests

```bash
cd backend

# Run pytest test suite
.\venv\Scripts\pytest -v

# Run with warnings summary
.\venv\Scripts\pytest -W default
```

* **Test Suite Metrics**: **52 tests passed**, 1 harmless third-party deprecation warning, completed in **~2.7 seconds**.

---

## Demo Logins

All demo accounts share the password: `Demo@1234`

| Name | Email | Role | Accessible Projects | Permissions & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Asha** | `owner@demo.com` | Owner | Core Platform, Executive Roadmap | Full access. Can manage members, invite by email, create scoped labels, and transition issues across both projects. |
| **Ravi** | `dev@demo.com` | Member | Core Platform | Project member. Can view and update issues, post comments, and view history in Core Platform. Accessing Executive Roadmap returns `404 Not Found`. Cannot add members or create labels (`403 Forbidden`). |
| **Meera** | `qa@demo.com` | Member | Core Platform | QA member. Can view, create, edit issues, test transitions, and comment in Core Platform. Accessing Executive Roadmap returns `404 Not Found`. |

---

## Data Model Summary

The database uses SQLAlchemy 2.0 with referential integrity (`PRAGMA foreign_keys=ON` on SQLite and foreign key cascades on relational backends):

* **User**: Identity and credentials (`id`, `name`, `email` [indexed, unique, lowercase], `password_hash`, `created_at`).
* **Project**: Workspace container (`id`, `name`, `description`, `owner_id`, `created_at`).
* **ProjectMember**: Association table with `(project_id, user_id)` unique constraint and role enum (`owner`, `member`).
* **Label**: Tagging mechanism scoped per project with a `(project_id, name)` unique constraint and hex color code (`#RRGGBB`).
* **Issue**: Central workflow item with project-scoped sequential numbers (`number`, unique on `(project_id, number)`). Indexed on `(project_id, status)`, `(project_id, assignee_id)`, and `(project_id, priority)`.
* **IssueLabel**: Composite primary key junction table `(issue_id, label_id)` with cascading deletions.
* **Comment**: Chronological discussion thread per issue (`created_at` ascending).
* **IssueHistory**: Immutable audit log of every attribute change (`created_at` descending), storing field name, old value, and new value.

---

## Main Design Decisions

1. **Single Write Path for Issues (`issue_service.update_issue`)**
   * Neither HTTP route handlers nor external modules directly mutate issue attributes or statuses. All state transitions, reassignments, label changes, and content edits must flow through `backend/app/services/issue_service.py`.
   * This guarantees that:
     * Unchanged fields are discarded without dirty writes.
     * Workflow transitions are validated against the state machine before committing.
     * Assignees and labels are validated for project membership.
     * An `IssueHistory` record is generated for every modified field within the exact same atomic transaction.

2. **Server-Side Workflow State Machine**
   * Issue transitions follow a strict directional workflow enforced in `backend/app/services/workflow.py`:
     * `open` &rarr; `in_progress`
     * `in_progress` &rarr; `in_review`
     * `in_review` &rarr; `closed`
     * `closed` &rarr; `open` (*reopen move*)
   * Any attempt to skip states, jump backwards, or transition to the same state is rejected with an HTTP 400 `WorkflowError`. The UI only displays valid next actions, but the backend is the authoritative gatekeeper.

3. **Project Membership Dependency Returns 404 to Non-Members**
   * All `/projects/{id}` subroutes enforce membership via the `get_project_member` FastAPI dependency.
   * If a user requests a project they are not a member of, the API returns **404 Not Found** instead of **403 Forbidden**. This prevents project enumeration and metadata disclosure. Non-owners attempting owner-only actions within a visible project (such as adding members or creating labels) receive **403 Forbidden**.

4. **Strict Schemas Forbidding Unknown Fields**
   * Pydantic v2 schemas use `model_config = ConfigDict(extra="forbid")` across all mutation schemas (`IssueCreate`, `IssueUpdate`, `LabelCreate`, `MemberAdd`, etc.).
   * This prevents parameter pollution, unexpected field injections, and silent ignores of misspelled fields.

5. **Test-Only Bcrypt Cost Optimization**
   * Password hashing cost is configurable via `BCRYPT_ROUNDS` (defaulting to 12 in production for maximum security).
   * In `conftest.py`, test execution overrides `BCRYPT_ROUNDS = 4`. This brought the test suite execution time down from ~40s to under 3s while maintaining identical hashing and verification logic.

---

## What is Finished vs. What Isn't

### What is Finished
* **Authentication**: User registration, login with JWT bearer tokens, `/auth/me` bootstrap, automatic logout on 401, password hashing with bcrypt.
* **Project Management**: Project listing, creation, role-based member drawer (invite by email with 404/409 handling), project-scoped label management with color picker.
* **Issue Management**:
  * Project-scoped sequential issue numbers (`#1`, `#2`, etc.).
  * Comprehensive filtering (status, priority, type, assignee, label).
  * Debounced search (`q`, 300ms delay).
  * Multi-column sorting (`created_at`, `updated_at`, `priority`, etc.).
  * Server-side pagination (20 items/page) with URL query parameter synchronization (`?status=open&page=2`).
  * Desktop tabular view and mobile-optimized stacked touch card view.
* **Issue Detail & Workflow**:
  * Inline editing for title and Markdown description with Write/Preview toggle.
  * Direct sidebar dropdown changes for priority, type, assignee (or Unassigned), and labels.
  * Status workflow transition buttons reflecting permitted state changes.
  * Chronological comment thread with plain-text formatting and relative timestamps.
  * Reverse-chronological audit history log detailing who changed what and when.
* **Responsive & UI Quality**:
  * Audited and tested across 360px, 768px, and 1280px viewports.
  * All interactive buttons, drawer elements, and modal controls meet minimum 44px tap target requirements.
  * Double-click submit prevention across all forms.
  * Error alerts, empty states, and loading skeletons on every list and modal.

### Stretch Features Not Built
* **Real-time WebSockets / SSE**: Real-time collaborative typing indicators or live issue status push without manual refresh.
* **File & Media Attachments**: Uploading image/video attachments to issues or comments.
* **Email & In-App Notifications**: Automated notification dispatches on issue assignment or comment mentions.
* **Saved Filter Presets**: Custom user-defined filter queries saved to user profiles.

### What I'd Do With More Time
1. **Interactive Kanban Board View**: Add a toggleable drag-and-drop Kanban view alongside the table view, mapping column drops to `issue_service.update_issue`.
2. **Full-Text Search Engine**: Upgrade search from substring matching to PostgreSQL full-text search (`tsvector` / `tsquery`) or SQLite FTS5 for ranked relevance search.
3. **OAuth2 / Social Authentication**: Support GitHub and Google single sign-on.
4. **Markdown Mention Autocomplete**: Add `@username` and `#issue_number` typeahead autocomplete in comment and description textareas.
5. **Dark Mode**: Add a system-aware light/dark mode theme switcher with Tailwind's `dark:` classes and `localStorage` persistence.

---

## AI Tools Used

* **Google DeepMind Antigravity Coding Agent**:
  * **Code Scaffolding**: Generated initial boilerplate for SQLAlchemy models, Pydantic schemas, and Vite React components based on architectural requirements.
  * **Test Engineering**: Decomposed monolithic test cases into 52 isolated, deterministic pytest functions and configured test-only bcrypt round reduction.
  * **Responsive UI Auditing**: Scanned CSS layouts across 360px mobile viewports, identifying tap target constraints (<44px) and full-screen drawer sizing adjustments.
  * **Security & Constraint Verification**: Validated input sanitization, Pydantic extra-field forbidding, and authorization dependencies (`get_project_member` returning 404).

---

## Known Limitations

1. **SQLite Concurrency in Production**:
   * The project defaults to SQLite for zero-setup local development. Under heavy multi-process concurrent write workloads, SQLite may encounter database locks. For production deployments, configuring `DATABASE_URL` with a PostgreSQL connection string is strongly recommended.
2. **Safe Markdown Rendering**:
   * The frontend uses `react-markdown` in safe mode without raw HTML parsing. Embedded HTML tags (e.g., `<script>`, `<iframe style=...>`) are rendered safely as escaped plain text to eliminate XSS risks.
3. **Starlette TestClient Warning**:
   * Running `pytest -W default` triggers one warning from Starlette/FastAPI's internal test client:
     ```
     StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
     ```
     This warning originates from third-party FastAPI / Starlette library code and does not affect application runtime or test execution.
