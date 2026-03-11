"""
Sanatan Lok API - Server Entry Point
This file maintains backward compatibility while using the new modular architecture.
"""

# Import the app from the new modular main.py
from main import app, sio, socket_app

# Re-export for uvicorn compatibility
__all__ = ['app', 'sio', 'socket_app']
