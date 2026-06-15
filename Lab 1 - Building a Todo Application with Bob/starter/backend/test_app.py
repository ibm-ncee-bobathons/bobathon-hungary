"""
Unit Tests — Todo Application Flask Backend
============================================
Covers every endpoint and branch to achieve ≥ 90 % code coverage.

Test matrix
-----------
Health
  test_health_check                    GET /api/health → 200

GET /api/todos
  test_get_todos_empty                 empty db → []
  test_get_todos_returns_all           two items → list of 2, newest first

GET /api/todos/<id>
  test_get_todo_found                  existing id → 200 + correct body
  test_get_todo_not_found              missing id  → 404

POST /api/todos
  test_create_todo_minimal             title only  → 201, defaults applied
  test_create_todo_full                title + description → 201
  test_create_todo_missing_title       no title    → 400
  test_create_todo_empty_body          None body   → 400

PUT /api/todos/<id>
  test_update_todo_title               update title only → 200
  test_update_todo_description         update description only → 200
  test_update_todo_completed           mark completed → 200
  test_update_todo_all_fields          update all three fields → 200
  test_update_todo_not_found           missing id → 404

DELETE /api/todos/<id>
  test_delete_todo                     existing id → 200 + message
  test_delete_todo_not_found           missing id  → 404

Model
  test_todo_repr                       __repr__ format
  test_todo_to_dict_null_created_at    to_dict when created_at is None
"""

import json
import pytest
from app import app
from database import db as _db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def flask_app():
    """Configure the app for testing with an in-memory SQLite database."""
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    yield app


@pytest.fixture(scope="session")
def init_database(flask_app):
    """Create all tables once per test session."""
    with flask_app.app_context():
        _db.create_all()
    yield
    with flask_app.app_context():
        _db.drop_all()


@pytest.fixture()
def client(flask_app, init_database):
    """
    Return a test client.
    Each test gets a clean database — all rows are removed after the test.
    """
    with flask_app.test_client() as c:
        yield c
    # Teardown: wipe all rows between tests so state doesn't bleed
    with flask_app.app_context():
        from models import Todo
        _db.session.query(Todo).delete()
        _db.session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def post_todo(client, title="Buy milk", description="From the corner shop"):
    """Convenience wrapper for creating a todo via POST."""
    return client.post(
        "/api/todos",
        data=json.dumps({"title": title, "description": description}),
        content_type="application/json",
    )


def json_body(response):
    """Decode JSON response body."""
    return json.loads(response.data)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

class TestHealthCheck:
    def test_health_check(self, client):
        response = client.get("/api/health")
        body = json_body(response)

        assert response.status_code == 200
        assert body["status"] == "healthy"
        assert "timestamp" in body


# ---------------------------------------------------------------------------
# GET /api/todos
# ---------------------------------------------------------------------------

class TestGetTodos:
    def test_get_todos_empty(self, client):
        response = client.get("/api/todos")
        body = json_body(response)

        assert response.status_code == 200
        assert body == []

    def test_get_todos_returns_all(self, client):
        post_todo(client, title="First todo")
        post_todo(client, title="Second todo")

        response = client.get("/api/todos")
        body = json_body(response)

        assert response.status_code == 200
        assert len(body) == 2
        # Newest first ordering
        assert body[0]["title"] == "Second todo"
        assert body[1]["title"] == "First todo"


# ---------------------------------------------------------------------------
# GET /api/todos/<id>
# ---------------------------------------------------------------------------

class TestGetTodo:
    def test_get_todo_found(self, client):
        created = json_body(post_todo(client, title="Find me"))
        todo_id = created["id"]

        response = client.get(f"/api/todos/{todo_id}")
        body = json_body(response)

        assert response.status_code == 200
        assert body["id"] == todo_id
        assert body["title"] == "Find me"

    def test_get_todo_not_found(self, client):
        response = client.get("/api/todos/99999")
        body = json_body(response)

        assert response.status_code == 404
        assert "error" in body


# ---------------------------------------------------------------------------
# POST /api/todos
# ---------------------------------------------------------------------------

class TestCreateTodo:
    def test_create_todo_minimal(self, client):
        response = client.post(
            "/api/todos",
            data=json.dumps({"title": "Minimal todo"}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 201
        assert body["title"] == "Minimal todo"
        assert body["completed"] is False
        assert body["id"] is not None
        assert body["created_at"] is not None

    def test_create_todo_full(self, client):
        response = post_todo(client, title="Full todo", description="With description")
        body = json_body(response)

        assert response.status_code == 201
        assert body["title"] == "Full todo"
        assert body["description"] == "With description"

    def test_create_todo_missing_title(self, client):
        response = client.post(
            "/api/todos",
            data=json.dumps({"description": "No title here"}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 400
        assert body["error"] == "Title is required"

    def test_create_todo_empty_body(self, client):
        response = client.post(
            "/api/todos",
            data=json.dumps({}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 400
        assert body["error"] == "Title is required"


# ---------------------------------------------------------------------------
# PUT /api/todos/<id>
# ---------------------------------------------------------------------------

class TestUpdateTodo:
    def _create(self, client):
        return json_body(post_todo(client, title="Original title", description="Original desc"))

    def test_update_todo_title(self, client):
        todo = self._create(client)
        response = client.put(
            f"/api/todos/{todo['id']}",
            data=json.dumps({"title": "Updated title"}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 200
        assert body["title"] == "Updated title"
        assert body["description"] == "Original desc"  # unchanged

    def test_update_todo_description(self, client):
        todo = self._create(client)
        response = client.put(
            f"/api/todos/{todo['id']}",
            data=json.dumps({"description": "New description"}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 200
        assert body["description"] == "New description"
        assert body["title"] == "Original title"  # unchanged

    def test_update_todo_completed(self, client):
        todo = self._create(client)
        response = client.put(
            f"/api/todos/{todo['id']}",
            data=json.dumps({"completed": True}),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 200
        assert body["completed"] is True

    def test_update_todo_all_fields(self, client):
        todo = self._create(client)
        response = client.put(
            f"/api/todos/{todo['id']}",
            data=json.dumps({
                "title": "All new title",
                "description": "All new desc",
                "completed": True,
            }),
            content_type="application/json",
        )
        body = json_body(response)

        assert response.status_code == 200
        assert body["title"] == "All new title"
        assert body["description"] == "All new desc"
        assert body["completed"] is True

    def test_update_todo_not_found(self, client):
        response = client.put(
            "/api/todos/99999",
            data=json.dumps({"title": "Ghost update"}),
            content_type="application/json",
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/todos/<id>
# ---------------------------------------------------------------------------

class TestDeleteTodo:
    def test_delete_todo(self, client):
        todo = json_body(post_todo(client, title="Delete me"))
        todo_id = todo["id"]

        response = client.delete(f"/api/todos/{todo_id}")
        body = json_body(response)

        assert response.status_code == 200
        assert body["message"] == "Todo deleted successfully"

        # Confirm the record is gone
        get_response = client.get(f"/api/todos/{todo_id}")
        assert get_response.status_code == 404

    def test_delete_todo_not_found(self, client):
        response = client.delete("/api/todos/99999")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Error branch tests (patch db to trigger 500 / HTTPException re-raise paths)
# ---------------------------------------------------------------------------

class TestErrorBranches:
    """Force the exception branches in each route handler."""

    def test_get_todos_db_error(self, client, flask_app):
        """GET /api/todos → 500 when Todo.query.order_by raises unexpectedly."""
        from unittest.mock import patch, MagicMock

        # Build a fake Todo class whose .query descriptor doesn't need an app
        # context to be accessed — we replace the entire Todo symbol in app.py.
        mock_todo = MagicMock()
        mock_todo.query.order_by.side_effect = RuntimeError("db boom")

        with patch("app.Todo", mock_todo):
            response = client.get("/api/todos")

        assert response.status_code == 500
        assert "error" in json_body(response)

    def test_create_todo_db_error(self, client, flask_app, monkeypatch):
        """POST /api/todos → 500 when session.commit raises."""
        import database as db_module
        original_commit = db_module.db.session.commit

        def bad_commit():
            raise RuntimeError("commit failed")

        monkeypatch.setattr(db_module.db.session, "commit", bad_commit)
        response = client.post(
            "/api/todos",
            data=json.dumps({"title": "Will fail"}),
            content_type="application/json",
        )
        assert response.status_code == 500
        assert "error" in json_body(response)

    def test_update_todo_http_exception_reraises(self, client):
        """PUT /api/todos/<id> with missing id → HTTPException re-raised → 404."""
        response = client.put(
            "/api/todos/88888",
            data=json.dumps({"title": "x"}),
            content_type="application/json",
        )
        assert response.status_code == 404

    def test_delete_todo_http_exception_reraises(self, client):
        """DELETE /api/todos/<id> with missing id → HTTPException re-raised → 404."""
        response = client.delete("/api/todos/88887")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Model unit tests
# ---------------------------------------------------------------------------

class TestTodoModel:
    def test_todo_repr(self, client, flask_app):
        with flask_app.app_context():
            from models import Todo
            todo = Todo(id=1, title="Test repr")
            assert repr(todo) == "<Todo 1: Test repr>"

    def test_todo_to_dict_null_created_at(self, client, flask_app):
        with flask_app.app_context():
            from models import Todo
            todo = Todo(id=5, title="No timestamp", completed=False)
            todo.created_at = None
            result = todo.to_dict()
            assert result["created_at"] is None
            assert result["title"] == "No timestamp"

# Made with Bob
