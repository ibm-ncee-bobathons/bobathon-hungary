"""
Database Models
Defines the Todo model that maps to the 'todos' table.
"""

from database import db
from datetime import datetime


class Todo(db.Model):
    """
    Represents a single todo item.

    Columns
    -------
    id          : auto-increment primary key
    title       : short description of the task (required)
    description : longer optional notes
    completed   : whether the task is done (default False)
    created_at  : UTC timestamp set automatically on creation
    """

    __tablename__ = "todos"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Todo {self.id}: {self.title}>"

    def to_dict(self):
        """
        Serialize the model to a plain dict suitable for JSON responses.

        Returns:
            dict: {id, title, description, completed, created_at}
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "completed": self.completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

# Made with Bob
