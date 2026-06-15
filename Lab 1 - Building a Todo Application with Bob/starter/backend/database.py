"""
Database Configuration
Initializes and configures the SQLAlchemy database instance.
"""

from flask_sqlalchemy import SQLAlchemy

# Shared SQLAlchemy instance — imported by models and app
db = SQLAlchemy()


def init_db(app):
    """
    Bind the SQLAlchemy instance to the Flask app and create all tables.

    Args:
        app: Flask application instance
    """
    db.init_app(app)

    with app.app_context():
        # Import models inside the context to avoid circular imports
        import models  # noqa: F401

        # Create tables for any models that don't exist yet
        db.create_all()

        print("Database initialized successfully!")

# Made with Bob
