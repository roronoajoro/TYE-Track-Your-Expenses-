"""
Database Models — Taka Gelo Koi
Includes: Users, Transactions, Budgets, Income, Goals, GoalAllocations, SavingsTransfer, Loans, LoanPayments
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, Text
from database import Base
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship


class User(Base):
    """User model with Google OAuth"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)

    # Google OAuth fields
    google_id = Column(String, unique=True, index=True, nullable=False)
    picture = Column(String, nullable=True)


class Budget(Base):
    """Monthly budget for each category"""
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=False)
    monthly_limit = Column(Float, nullable=False)
    month = Column(String, nullable=False)  # Format: "2026-02" (YYYY-MM)

    # Notification settings
    alert_threshold = Column(Float, default=80.0)
    notifications_enabled = Column(Boolean, default=True)

    owner = relationship("User", backref="budgets")


class Transaction(Base):
    """Expense Transaction model"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(String, nullable=False)  # Format: "2023-10-25"
    image_path = Column(String, nullable=True)
    raw_text = Column(String, nullable=True)

    # Optional link to goal (if this transaction funds a goal)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    # Flag: if this expense came from savings pool rather than income
    from_savings = Column(Boolean, default=False)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="transactions")


class Income(Base):
    """Income/Earning record"""
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    source = Column(String, nullable=False)  # e.g. "Salary", "Gift", "Donation", custom
    description = Column(String, nullable=True)
    date = Column(String, nullable=False)  # Format: "YYYY-MM-DD"

    owner = relationship("User", backref="incomes")


class Goal(Base):
    """Savings / Financial Goal"""
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    icon = Column(String, default="🎯")
    color = Column(String, default="#e8b84b")
    deadline = Column(String, nullable=True)  # YYYY-MM-DD
    status = Column(String, default="active")  # "active" | "achieved"
    created_month = Column(String, nullable=False)  # YYYY-MM

    owner = relationship("User", backref="goals")
    allocations = relationship("GoalAllocation", back_populates="goal", cascade="all, delete-orphan")


class GoalAllocation(Base):
    """Money allocated to a goal (from income or savings)"""
    __tablename__ = "goal_allocations"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    month = Column(String, nullable=False)  # YYYY-MM (which month this allocation happened)
    source = Column(String, default="income")  # "income" | "savings"
    notes = Column(String, nullable=True)

    goal = relationship("Goal", back_populates="allocations")
    owner = relationship("User", backref="goal_allocations")


class SavingsTransfer(Base):
    """Record of savings carried forward month-to-month or into total savings pool"""
    __tablename__ = "savings_transfers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    from_month = Column(String, nullable=False)   # YYYY-MM
    to_month = Column(String, nullable=True)       # YYYY-MM or null if added to total savings pool
    transfer_type = Column(String, nullable=False)  # "carry_forward" | "pool" | "loan_repayment"
    notes = Column(String, nullable=True)

    owner = relationship("User", backref="savings_transfers")


class Loan(Base):
    """Loan / Debt record — tracks money borrowed from a person or institution"""
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)            # original loan amount
    remaining_amount = Column(Float, nullable=False)  # decreases as repaid
    description = Column(String, nullable=True)
    lender = Column(String, nullable=True)            # person / institution name
    date = Column(String, nullable=False)             # YYYY-MM-DD when loan was taken
    is_paid = Column(Boolean, default=False)

    owner = relationship("User", backref="loans")
    payments = relationship("LoanPayment", back_populates="loan", cascade="all, delete-orphan")


class LoanPayment(Base):
    """Repayment made towards a loan"""
    __tablename__ = "loan_payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    source = Column(String, nullable=False)  # "income" | "savings"
    month = Column(String, nullable=False)   # YYYY-MM
    date = Column(String, nullable=False)    # YYYY-MM-DD
    notes = Column(String, nullable=True)

    loan = relationship("Loan", back_populates="payments")
    owner = relationship("User", backref="loan_payments")


# Setup bidirectional relationship
User.transactions = relationship("Transaction", back_populates="owner")