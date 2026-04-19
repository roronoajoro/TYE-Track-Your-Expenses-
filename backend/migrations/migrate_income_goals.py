"""
Migration: Add Income, Goals, GoalAllocations, SavingsTransfers tables
Also adds new columns to transactions table.
Run this once: python migrate_income_goals.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "test_tye.db")

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Add new columns to transactions if not exist
    try:
        c.execute("ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id)")
        print("Added goal_id to transactions")
    except Exception as e:
        print(f"  Skipped goal_id: {e}")

    try:
        c.execute("ALTER TABLE transactions ADD COLUMN from_savings BOOLEAN DEFAULT 0")
        print("Added from_savings to transactions")
    except Exception as e:
        print(f"  Skipped from_savings: {e}")

    # Create incomes table
    c.execute("""
        CREATE TABLE IF NOT EXISTS incomes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            source TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL
        )
    """)
    print("Created incomes table")

    # Create goals table
    c.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL DEFAULT 0.0,
            icon TEXT DEFAULT '🎯',
            color TEXT DEFAULT '#e8b84b',
            deadline TEXT,
            status TEXT DEFAULT 'active',
            created_month TEXT NOT NULL
        )
    """)
    print("Created goals table")

    # Create goal_allocations table
    c.execute("""
        CREATE TABLE IF NOT EXISTS goal_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER NOT NULL REFERENCES goals(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            month TEXT NOT NULL,
            source TEXT DEFAULT 'income',
            notes TEXT
        )
    """)
    print("Created goal_allocations table")

    # Create savings_transfers table
    c.execute("""
        CREATE TABLE IF NOT EXISTS savings_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            from_month TEXT NOT NULL,
            to_month TEXT,
            transfer_type TEXT NOT NULL,
            notes TEXT
        )
    """)
    print("Created savings_transfers table")

    conn.commit()
    conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    run()
