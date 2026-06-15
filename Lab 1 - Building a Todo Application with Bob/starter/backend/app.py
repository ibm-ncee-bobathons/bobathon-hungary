"""
Todo Application — Flask Backend
A RESTful API for managing todo items with full CRUD operations.

Endpoints
---------
GET    /api/health            Liveness check
GET    /api/todos             List all todos (newest first)
GET    /api/todos/<id>        Get a single todo
POST   /api/todos             Create a new todo
PUT    /api/todos/<id>        Update a todo (partial updates supported)
DELETE /api/todos/<id>        Delete a todo
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from models import Todo
from database import db, init_db
from datetime import datetime

# ---------------------------------------------------------------------------
# Application setup
# ---------------------------------------------------------------------------

app = Flask(__name__)

# SQLite database stored in the same directory as this file
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///todos.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Allow requests from the frontend (served on a different origin / file://)
CORS(app)

# Create tables and bind db to app
init_db(app)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Liveness probe.

    Returns:
        200 {"status": "healthy", "timestamp": "<iso>"}
    """
    return (
        jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
            }
        ),
        200,
    )


@app.route("/api/todos", methods=["GET"])
def get_todos():
    """
    Return all todos ordered by creation time, newest first.

    Returns:
        200  JSON array of todo objects
        500  {"error": "<message>"} on unexpected failure
    """
    try:
        todos = Todo.query.order_by(Todo.created_at.desc()).all()
        return jsonify([todo.to_dict() for todo in todos]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<int:todo_id>", methods=["GET"])
def get_todo(todo_id):
    """
    Return a single todo by primary key.

    Args:
        todo_id: integer primary key

    Returns:
        200  todo object
        404  {"error": "Todo not found"}
    """
    try:
        todo = Todo.query.get_or_404(todo_id)
        return jsonify(todo.to_dict()), 200
    except Exception:
        return jsonify({"error": "Todo not found"}), 404


@app.route("/api/todos", methods=["POST"])
def create_todo():
    """
    Create a new todo item.

    Request body (JSON):
        title       string  required
        description string  optional

    Returns:
        201  created todo object
        400  {"error": "Title is required"}
        500  {"error": "<message>"} on unexpected failure
    """
    try:
        data = request.get_json()

        if not data or "title" not in data:
            return jsonify({"error": "Title is required"}), 400

        todo = Todo(
            title=data["title"],
            description=data.get("description", ""),
            completed=False,
        )

        db.session.add(todo)
        db.session.commit()

        return jsonify(todo.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    """
    Update one or more fields of an existing todo (partial update).

    Request body (JSON) — all fields optional:
        title       string
        description string
        completed   boolean

    Returns:
        200  updated todo object
        404  {"error": "Todo not found"}
        500  {"error": "<message>"} on unexpected failure
    """
    try:
        todo = Todo.query.get_or_404(todo_id)
        data = request.get_json()

        if "title" in data:
            todo.title = data["title"]
        if "description" in data:
            todo.description = data["description"]
        if "completed" in data:
            todo.completed = data["completed"]

        db.session.commit()
        return jsonify(todo.to_dict()), 200
    except HTTPException as e:
        # Re-raise 404 / other HTTP errors so Flask returns the correct status
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    """
    Permanently remove a todo.

    Returns:
        200  {"message": "Todo deleted successfully"}
        404  {"error": "Todo not found"}
        500  {"error": "<message>"} on unexpected failure
    """
    try:
        todo = Todo.query.get_or_404(todo_id)
        db.session.delete(todo)
        db.session.commit()
        return jsonify({"message": "Todo deleted successfully"}), 200
    except HTTPException as e:
        # Re-raise 404 / other HTTP errors so Flask returns the correct status
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":  # pragma: no cover
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=5001)

# Made with Bob
