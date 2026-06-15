# Todo Application — Implementation Plan

## Overview

Build a full-stack Todo Application with a Python Flask REST API backend and a
vanilla JavaScript frontend. The backend uses SQLite via Flask-SQLAlchemy for
persistence. The frontend communicates with the API using the native `fetch` API
with no build step or framework required.

**Scope:** Populate `Lab 1 - Building a Todo Application with Bob/starter/` with
a working, runnable application that mirrors the design of the reference solution
in `solution/`.

**Non-goals:** Authentication, pagination, due dates, tags, or any feature not
present in the reference solution.

---

## Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend language | Python 3 | Readable, widely taught, Flask ecosystem |
| Web framework | Flask 3.0 | Lightweight, minimal boilerplate |
| ORM | Flask-SQLAlchemy 3.1 | Declarative models, auto migrations |
| Database | SQLite (file-based) | Zero-config, suitable for lab use |
| CORS | Flask-CORS 4.0 | Allows browser frontend on a different port |
| Frontend | Vanilla JS + HTML + CSS | No build tooling required |

---

## Directory Structure

```
starter/
├── backend/
│   ├── app.py            # Flask app, route handlers, CORS, DB config
│   ├── database.py       # SQLAlchemy instance + init_db helper
│   ├── models.py         # Todo SQLAlchemy model
│   ├── requirements.txt  # Pinned Python dependencies
│   ├── test_app.py       # Unit tests (pytest)
│   └── run_tests.sh      # Convenience script to run tests
└── frontend/
    ├── index.html        # App shell, form, todo list markup
    ├── styles.css        # CSS variables, responsive layout, animations
    └── app.js            # Fetch-based API client + DOM rendering
```

---

## API Endpoints

| Method | Path | Description | Success | Error |
|---|---|---|---|---|
| GET | `/api/health` | Liveness check | 200 | — |
| GET | `/api/todos` | List all todos (newest first) | 200 | 500 |
| GET | `/api/todos/<id>` | Get single todo | 200 | 404 |
| POST | `/api/todos` | Create todo (`title` required, `description` optional) | 201 | 400, 500 |
| PUT | `/api/todos/<id>` | Update todo fields (partial update allowed) | 200 | 404, 500 |
| DELETE | `/api/todos/<id>` | Delete todo | 200 | 404, 500 |

---

## Database Schema

**Table: `todos`**

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY, auto-increment |
| `title` | VARCHAR(200) | NOT NULL |
| `description` | TEXT | NULLABLE |
| `completed` | BOOLEAN | NOT NULL, DEFAULT false |
| `created_at` | DATETIME | NOT NULL, DEFAULT utcnow |

---

## Sub-Tasks

---

### Sub-Task 1 — Backend: Dependencies and Database Layer

**Intent**
Create the Python dependency manifest and the database initialisation module so
that the ORM is available before any models or routes are defined.

**Expected Outcomes**
- `backend/requirements.txt` exists with pinned versions for Flask, Flask-CORS,
  and Flask-SQLAlchemy.
- `backend/database.py` exports a `db` SQLAlchemy instance and an `init_db(app)`
  function that calls `db.init_app`, enters the app context, imports models, and
  calls `db.create_all()`.

**Todo List**
1. Create `backend/requirements.txt` with:
   - `Flask==3.0.0`
   - `Flask-CORS==4.0.0`
   - `Flask-SQLAlchemy==3.1.1`
2. Create `backend/database.py` with `db = SQLAlchemy()` and `init_db(app)`.

**Relevant Context**
- Reference: [`solution/backend/database.py`](../solution/backend/database.py)
- Reference: [`solution/backend/requirements.txt`](../solution/backend/requirements.txt)

**Status:** [ ] pending

---

### Sub-Task 2 — Backend: Todo Model

**Intent**
Define the `Todo` SQLAlchemy model that maps to the `todos` table and provides a
`to_dict()` serialiser for JSON responses.

**Expected Outcomes**
- `backend/models.py` defines a `Todo(db.Model)` class with columns: `id`,
  `title`, `description`, `completed`, `created_at`.
- `to_dict()` returns a plain dict with ISO-formatted `created_at`.

**Todo List**
1. Create `backend/models.py` importing `db` from `database`.
2. Define the `Todo` model with all columns and the `to_dict()` method.

**Relevant Context**
- Reference: [`solution/backend/models.py`](../solution/backend/models.py)
- `db` is imported from `database`, not from `flask_sqlalchemy` directly, to
  avoid circular imports.

**Status:** [ ] pending

---

### Sub-Task 3 — Backend: Flask Application and REST Routes

**Intent**
Wire together Flask, CORS, the database layer, and all six REST route handlers
into `app.py`.

**Expected Outcomes**
- `backend/app.py` creates the Flask app, configures SQLite URI, enables CORS,
  calls `init_db`, and registers all six endpoints.
- Each route returns appropriate HTTP status codes and JSON payloads.
- Running `python app.py` starts the dev server on `0.0.0.0:5000`.

**Todo List**
1. Create `backend/app.py`.
2. Configure `SQLALCHEMY_DATABASE_URI` to `sqlite:///todos.db`.
3. Enable `CORS(app)`.
4. Call `init_db(app)`.
5. Implement `GET /api/health`.
6. Implement `GET /api/todos` (ordered by `created_at` descending).
7. Implement `GET /api/todos/<id>`.
8. Implement `POST /api/todos` with title validation.
9. Implement `PUT /api/todos/<id>` with partial field updates.
10. Implement `DELETE /api/todos/<id>`.
11. Add `if __name__ == '__main__': app.run(debug=True, host='0.0.0.0', port=5000)`.

**Relevant Context**
- Reference: [`solution/backend/app.py`](../solution/backend/app.py)
- All routes should wrap logic in try/except and roll back the session on errors.

**Status:** [ ] pending

---

### Sub-Task 4 — Backend: Unit Tests

**Intent**
Provide a pytest test suite and a shell runner so the backend can be verified
without a running server.

**Expected Outcomes**
- `backend/test_app.py` uses an in-memory SQLite database and Flask's test client
  to test happy-path and error cases for all CRUD endpoints.
- `backend/run_tests.sh` installs dependencies and runs pytest.
- `bash run_tests.sh` completes successfully.

**Todo List**
1. Create `backend/test_app.py` with a pytest fixture that configures
   `TESTING=True` and `SQLALCHEMY_DATABASE_URI=sqlite:///:memory:`.
2. Write test cases for: list todos (empty), create todo, get todo, update todo,
   delete todo, health check, 404 on missing todo, 400 on missing title.
3. Create `backend/run_tests.sh` that pip-installs requirements and runs
   `pytest test_app.py -v`.

**Relevant Context**
- Reference solution had a `test_app.py` and `run_tests.sh` (now deleted from
  starter).
- Use Flask's built-in `app.test_client()` and `app.app_context()`.

**Status:** [ ] pending

---

### Sub-Task 5 — Frontend: HTML Shell

**Intent**
Create the application markup with a form for adding todos and a section for
displaying the list, plus all the state containers (loading, empty, error).

**Expected Outcomes**
- `frontend/index.html` links `styles.css` and `app.js`.
- Contains: header with title/subtitle, add-todo form (`#todo-form`) with title
  input and description textarea, todos section with count badge (`#todo-count`),
  loading spinner (`#loading`), empty state (`#empty-state`), error state
  (`#error-state`), and list container (`#todos-list`).

**Todo List**
1. Create `frontend/index.html` with the structure described above.

**Relevant Context**
- Reference: [`solution/frontend/index.html`](../solution/frontend/index.html)
- `app.js` expects the element IDs listed above to exist.

**Status:** [ ] pending

---

### Sub-Task 6 — Frontend: Stylesheet

**Intent**
Provide the CSS that makes the app responsive and visually polished using CSS
custom properties.

**Expected Outcomes**
- `frontend/styles.css` defines CSS variables in `:root` for colours, shadows,
  and borders.
- Styles all components: container, header, form, buttons, todo items, loading
  spinner, empty/error states, footer.
- Responsive layout adjustments at `max-width: 768px`.
- Fade-in animation for todo items.

**Todo List**
1. Create `frontend/styles.css` with all component styles and media query.

**Relevant Context**
- Reference: [`solution/frontend/styles.css`](../solution/frontend/styles.css)

**Status:** [ ] pending

---

### Sub-Task 7 — Frontend: JavaScript API Client and DOM Logic

**Intent**
Implement the full client-side logic: fetching todos, creating, toggling
completion, deleting, and rendering the DOM.

**Expected Outcomes**
- `frontend/app.js` defines `API_URL = 'http://localhost:5000/api/todos'`.
- Implements `fetchTodos()`, `createTodo()`, `toggleTodo()`, `deleteTodo()`.
- Renders todo items with title, description, date, and action buttons.
- Shows loading, empty, and error states appropriately.
- Form submission creates a todo and refreshes the list.

**Todo List**
1. Create `frontend/app.js` with all functions listed above.
2. Attach `DOMContentLoaded` listener to bootstrap the app.
3. Implement `escapeHtml()` to sanitise user input before injection.
4. Implement `setLoadingState()`, `showErrorState()`, `showError()`, `clearForm()`.

**Relevant Context**
- Reference: [`solution/frontend/app.js`](../solution/frontend/app.js)
- Do **not** use `innerHTML` with unsanitised user data; use `escapeHtml()`.

**Status:** [ ] pending

---

## Validation Checklist

After all sub-tasks are complete:

- [ ] `cd backend && pip install -r requirements.txt && python app.py` starts
      without errors.
- [ ] `GET http://localhost:5000/api/health` returns `{"status": "healthy", ...}`.
- [ ] Opening `frontend/index.html` in a browser shows the UI and loads todos.
- [ ] Create / toggle / delete operations all work end-to-end.
- [ ] `bash backend/run_tests.sh` passes all tests.
