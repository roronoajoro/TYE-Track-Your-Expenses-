"""
Database Migration Script
Adds raw_text column to transactions table for OCR extracted text
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import create_engine, text

# Database connection (same as in database.py)
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "")
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        # Add raw_text column to transactions table
        try:
            conn.execute(text("""
                ALTER TABLE transactions 
                ADD COLUMN IF NOT EXISTS raw_text VARCHAR;
            """))
            conn.commit()
            print("[SUCCESS] Added raw_text column to transactions table!")
        except Exception as e:
            print(f"[ERROR] {e}")

if __name__ == "__main__":
    print("Running database migration for OCR...")
    migrate()
    print("Migration complete!")

