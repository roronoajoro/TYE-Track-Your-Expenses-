"""
Main FastAPI Application — Taka Gelo Koi
Expense Tracker with Google OAuth, Budget Management, Income Tracking,
Goals, Savings Pools, Auto-Allocation, Loans & Debt Management
"""

import io
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend root (one level up from app/)
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
from collections import defaultdict
from datetime import datetime

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import ocr_service
import parser_service
import schemas
from database import Base, SessionLocal, engine



# Google OAuth Client ID (set via environment variable or .env file)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# ── Startup: create all tables + safe column migrations ────────────────────────
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Taka Gelo Koi API", version="5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def run_column_migrations():
    """Safely add new columns to existing tables without losing data."""
    new_columns = [
        ("transactions", "goal_id",      "INTEGER"),
        ("transactions", "from_savings",  "BOOLEAN DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore


# ── helpers ────────────────────────────────────────────────────────────────────

def _net_savings_pool(user_id: int, db: Session) -> float:
    """Return current lifetime savings pool balance for a user."""
    pool_transfers = db.query(models.SavingsTransfer).filter(
        models.SavingsTransfer.user_id == user_id,
        models.SavingsTransfer.transfer_type == "pool"
    ).all()
    total_pooled = sum(t.amount for t in pool_transfers)

    savings_goal_allocs = db.query(models.GoalAllocation).filter(
        models.GoalAllocation.user_id == user_id,
        models.GoalAllocation.source == "savings"
    ).all()
    spent_on_goals = sum(a.amount for a in savings_goal_allocs)

    loan_payments = db.query(models.LoanPayment).filter(
        models.LoanPayment.user_id == user_id,
        models.LoanPayment.source == "savings"
    ).all()
    spent_on_loans = sum(p.amount for p in loan_payments)

    return max(total_pooled - spent_on_goals - spent_on_loans, 0)


# ============ GOOGLE OAUTH ENDPOINTS ============

@app.post("/auth/google", response_model=schemas.GoogleLoginResponse)
async def google_login(token_request: schemas.GoogleTokenRequest, db: Session = Depends(get_db)):
    """Authenticate user with Google OAuth token"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token_request.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        picture = idinfo.get('picture', None)

        user = db.query(models.User).filter(models.User.google_id == google_id).first()
        is_new_user = False

        if not user:
            user = models.User(name=name, email=email, google_id=google_id, picture=picture)
            db.add(user)
            db.commit()
            db.refresh(user)
            is_new_user = True
        else:
            user.name = name
            user.email = email
            user.picture = picture
            db.commit()
            db.refresh(user)

        return schemas.GoogleLoginResponse(
            message="Login successful",
            user_id=user.id,
            name=user.name,
            email=user.email,
            picture=user.picture,
            is_new_user=is_new_user
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Authentication failed: {str(e)}")


@app.get("/auth/verify/{user_id}")
def verify_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"user_id": user.id, "name": user.name, "email": user.email, "picture": user.picture}


# ============ TRANSACTION ENDPOINTS ============

@app.post("/transactions/", response_model=schemas.TransactionOut)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    if transaction.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than 0")
    db_tx = models.Transaction(**transaction.dict())
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


@app.get("/transactions/{user_id}", response_model=list[schemas.TransactionOut])
def read_transactions(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Transaction).filter(models.Transaction.user_id == user_id).all()


@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted"}


@app.put("/transactions/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction(transaction_id: int, update: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if update.amount is not None:
        if update.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be > 0")
        tx.amount = update.amount
    if update.category is not None:
        tx.category = update.category
    if update.description is not None:
        tx.description = update.description
    if update.date is not None:
        tx.date = update.date
    db.commit()
    db.refresh(tx)
    return tx


@app.get("/summary/{user_id}")
def get_monthly_summary(
    user_id: int,
    month: str = Query(default=None),
    db: Session = Depends(get_db)
):
    txs = db.query(models.Transaction).filter(models.Transaction.user_id == user_id).all()
    current_month = month if month else datetime.now().strftime("%Y-%m")
    total_spent = 0.0
    category_breakdown: defaultdict = defaultdict(float)
    for t in txs:
        if t.date.startswith(current_month):
            total_spent += t.amount
            category_breakdown[t.category] += t.amount
    return {"total_spent": total_spent, "month": current_month, "breakdown": dict(category_breakdown)}


# ============ BUDGET ENDPOINTS ============

@app.post("/budgets/", response_model=schemas.BudgetOut)
def create_budget(budget: schemas.BudgetCreate, user_id: int, db: Session = Depends(get_db)):
    existing = db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.category == budget.category,
        models.Budget.month == budget.month
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Budget for {budget.category} in {budget.month} already exists")
    if budget.monthly_limit <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Budget amount must be greater than 0")
    db_budget = models.Budget(user_id=user_id, **budget.dict())
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@app.get("/budgets/{user_id}/{month}", response_model=list[schemas.BudgetOut])
def get_budgets(user_id: int, month: str, db: Session = Depends(get_db)):
    return db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.month == month
    ).all()


@app.put("/budgets/{budget_id}", response_model=schemas.BudgetOut)
def update_budget(budget_id: int, budget_update: schemas.BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.query(models.Budget).filter(models.Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget_update.monthly_limit is not None:
        if budget_update.monthly_limit <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Budget amount must be greater than 0")
        budget.monthly_limit = budget_update.monthly_limit
    if budget_update.alert_threshold is not None:
        budget.alert_threshold = budget_update.alert_threshold
    if budget_update.notifications_enabled is not None:
        budget.notifications_enabled = budget_update.notifications_enabled
    db.commit()
    db.refresh(budget)
    return budget


@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(models.Budget).filter(models.Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted"}


# ============ MONTHLY REPORT ENDPOINT ============

@app.get("/monthly-report/{user_id}", response_model=schemas.MonthlyExpenseReport)
def get_monthly_report(user_id: int, month: str, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.date.like(f"{month}%")
    ).all()
    total_spent = 0
    category_breakdown = defaultdict(float)
    for t in transactions:
        total_spent += t.amount
        category_breakdown[t.category] += t.amount

    # Fetch income for the report month (for 3-slice pie)
    incomes = db.query(models.Income).filter(
        models.Income.user_id == user_id,
        models.Income.date.like(f"{month}%")
    ).all()
    total_income = sum(i.amount for i in incomes)

    budgets = db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.month == month
    ).all()

    budget_comparison = {}
    for budget in budgets:
        spent = category_breakdown.get(budget.category, 0)
        budget_comparison[budget.category] = {
            "budget": budget.monthly_limit,
            "spent": spent,
            "remaining": budget.monthly_limit - spent,
            "percentage_used": (spent / budget.monthly_limit * 100) if budget.monthly_limit > 0 else 0,
            "is_over_budget": spent > budget.monthly_limit
        }

    return schemas.MonthlyExpenseReport(
        month=month,
        total_spent=total_spent,
        total_income=total_income,
        category_breakdown=dict(category_breakdown),
        budget_comparison=budget_comparison if budget_comparison else None
    )


# ============ INCOME ENDPOINTS ============

@app.post("/incomes/", response_model=schemas.IncomeOut)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    if income.amount <= 0:
        raise HTTPException(status_code=400, detail="Income amount must be greater than 0")
    db_income = models.Income(**income.dict())
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income


@app.get("/incomes/{user_id}", response_model=list[schemas.IncomeOut])
def get_incomes(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Income).filter(models.Income.user_id == user_id).all()


@app.delete("/incomes/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income record not found")
    db.delete(income)
    db.commit()
    return {"message": "Income deleted"}


@app.put("/incomes/{income_id}", response_model=schemas.IncomeOut)
def update_income(income_id: int, update: schemas.IncomeUpdate, db: Session = Depends(get_db)):
    income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income record not found")
    if update.amount is not None:
        if update.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be > 0")
        income.amount = update.amount
    if update.source is not None:
        income.source = update.source
    if update.description is not None:
        income.description = update.description
    if update.date is not None:
        income.date = update.date
    db.commit()
    db.refresh(income)
    return income


@app.get("/income-summary/{user_id}")
def get_income_summary(
    user_id: int,
    month: str = Query(default=None),
    db: Session = Depends(get_db)
):
    """Returns total income, source breakdown, and computed savings for a month."""
    current_month = month if month else datetime.now().strftime("%Y-%m")
    incomes = db.query(models.Income).filter(
        models.Income.user_id == user_id,
        models.Income.date.like(f"{current_month}%")
    ).all()
    total_income = sum(i.amount for i in incomes)
    source_breakdown = defaultdict(float)
    for i in incomes:
        source_breakdown[i.source] += i.amount

    # Monthly spending (regular expenses only)
    txs = db.query(models.Transaction).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.date.like(f"{current_month}%")
    ).all()
    total_spent = sum(t.amount for t in txs)
    savings = total_income - total_spent

    # Savings carried in from previous months
    carried_in = db.query(models.SavingsTransfer).filter(
        models.SavingsTransfer.user_id == user_id,
        models.SavingsTransfer.to_month == current_month
    ).all()
    carried_amount = sum(s.amount for s in carried_in)

    return {
        "month": current_month,
        "total_income": total_income,
        "total_spent": total_spent,
        "savings": savings,
        "carried_forward": carried_amount,
        "net_savings": savings + carried_amount,
        "source_breakdown": dict(source_breakdown)
    }


# ============ GOAL ENDPOINTS ============

@app.post("/goals/", response_model=schemas.GoalOut)
def create_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    if goal.target_amount <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be greater than 0")
    db_goal = models.Goal(**goal.dict())
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


@app.get("/goals/{user_id}", response_model=list[schemas.GoalOut])
def get_goals(user_id: int, status_filter: str = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(models.Goal).filter(models.Goal.user_id == user_id)
    if status_filter:
        q = q.filter(models.Goal.status == status_filter)
    return q.all()


@app.put("/goals/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, update: schemas.GoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, val in update.dict(exclude_none=True).items():
        setattr(goal, field, val)
    # Auto-mark achieved
    if goal.current_amount >= goal.target_amount:
        goal.status = "achieved"
    db.commit()
    db.refresh(goal)
    return goal


@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
    return {"message": "Goal deleted"}


# ============ GOAL ALLOCATION ENDPOINTS ============

@app.post("/goal-allocations/", response_model=schemas.GoalAllocationOut)
def allocate_to_goal(alloc: schemas.GoalAllocationCreate, db: Session = Depends(get_db)):
    """
    Allocate money to a goal.
    - If source == "income": also creates a Transaction with category="Goal" (monthly expense)
    - If source == "savings": validates against lifetime savings pool balance
    Updates goal.current_amount.
    """
    goal = db.query(models.Goal).filter(models.Goal.id == alloc.goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if alloc.amount <= 0:
        raise HTTPException(status_code=400, detail="Allocation amount must be > 0")

    # Validate savings pool balance for savings source
    if alloc.source == "savings":
        net_pool = _net_savings_pool(alloc.user_id, db)
        if alloc.amount > net_pool:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient savings pool. Available: ৳{max(net_pool, 0):,.0f}"
            )

    # Create allocation record
    db_alloc = models.GoalAllocation(**alloc.dict())
    db.add(db_alloc)

    # Update goal progress
    goal.current_amount += alloc.amount
    if goal.current_amount >= goal.target_amount:
        goal.status = "achieved"

    # If from income — create a monthly transaction expense
    if alloc.source == "income":
        tx = models.Transaction(
            user_id=alloc.user_id,
            amount=alloc.amount,
            category="Goal",
            description=f"Goal contribution — {goal.name}",
            date=f"{alloc.month}-01",
            goal_id=goal.id,
            from_savings=False
        )
        db.add(tx)

    db.commit()
    db.refresh(db_alloc)
    return db_alloc


@app.get("/goal-allocations/{user_id}", response_model=list[schemas.GoalAllocationOut])
def get_goal_allocations(user_id: int, goal_id: int = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(models.GoalAllocation).filter(models.GoalAllocation.user_id == user_id)
    if goal_id:
        q = q.filter(models.GoalAllocation.goal_id == goal_id)
    return q.all()


# ============ SAVINGS TRANSFER ENDPOINTS ============

@app.post("/savings-transfers/", response_model=schemas.SavingsTransferOut)
def create_savings_transfer(transfer: schemas.SavingsTransferCreate, db: Session = Depends(get_db)):
    """
    Record a savings transfer:
    - carry_forward: moves amount to next month's pool
    - pool: adds to permanent savings pool (no target month)
    - loan_repayment: deducts from savings pool to repay a loan
    """
    if transfer.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be > 0")
    db_transfer = models.SavingsTransfer(**transfer.dict())
    db.add(db_transfer)
    db.commit()
    db.refresh(db_transfer)
    return db_transfer


@app.get("/savings-transfers/{user_id}", response_model=list[schemas.SavingsTransferOut])
def get_savings_transfers(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.SavingsTransfer).filter(models.SavingsTransfer.user_id == user_id).all()


@app.get("/total-savings/{user_id}")
def get_total_savings(user_id: int, db: Session = Depends(get_db)):
    """
    Compute lifetime total savings pool:
    pool transfers − goal allocations from savings − loan repayments from savings
    """
    pool_transfers = db.query(models.SavingsTransfer).filter(
        models.SavingsTransfer.user_id == user_id,
        models.SavingsTransfer.transfer_type == "pool"
    ).all()
    total_pooled = sum(t.amount for t in pool_transfers)

    savings_goal_allocs = db.query(models.GoalAllocation).filter(
        models.GoalAllocation.user_id == user_id,
        models.GoalAllocation.source == "savings"
    ).all()
    spent_on_goals = sum(a.amount for a in savings_goal_allocs)

    loan_payments = db.query(models.LoanPayment).filter(
        models.LoanPayment.user_id == user_id,
        models.LoanPayment.source == "savings"
    ).all()
    spent_on_loans = sum(p.amount for p in loan_payments)

    net_pool = total_pooled - spent_on_goals - spent_on_loans
    return {
        "total_pooled": total_pooled,
        "spent_on_goals_from_savings": spent_on_goals,
        "spent_on_loans_from_savings": spent_on_loans,
        "net_savings_pool": max(net_pool, 0)
    }


# ============ AUTO-ALLOCATE SAVINGS ENDPOINTS ============

@app.get("/check-unallocated-savings/{user_id}")
def check_unallocated_savings(user_id: int, db: Session = Depends(get_db)):
    """
    Detect past months with positive unallocated savings.
    Returns a list of months + amounts for user confirmation.
    Does NOT create any transfers — purely informational.
    """
    current_month = datetime.now().strftime("%Y-%m")

    # Get all months with income records before current month
    income_records = db.query(models.Income).filter(
        models.Income.user_id == user_id
    ).all()

    past_months = set()
    for inc in income_records:
        ym = inc.date[:7]
        if ym < current_month:
            past_months.add(ym)

    unhandled = []
    for month in sorted(past_months):
        incomes = db.query(models.Income).filter(
            models.Income.user_id == user_id,
            models.Income.date.like(f"{month}%")
        ).all()
        total_income = sum(i.amount for i in incomes)

        txs = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date.like(f"{month}%")
        ).all()
        total_spent = sum(t.amount for t in txs)

        savings = total_income - total_spent
        if savings <= 0:
            continue

        # Check if already handled (any savings_transfer from this month)
        existing_transfers = db.query(models.SavingsTransfer).filter(
            models.SavingsTransfer.user_id == user_id,
            models.SavingsTransfer.from_month == month
        ).all()
        total_transferred = sum(t.amount for t in existing_transfers)

        # Check goal allocations from savings for this month
        goal_allocs = db.query(models.GoalAllocation).filter(
            models.GoalAllocation.user_id == user_id,
            models.GoalAllocation.month == month,
            models.GoalAllocation.source == "savings"
        ).all()
        total_goal_alloc = sum(a.amount for a in goal_allocs)

        unallocated = savings - total_transferred - total_goal_alloc
        if unallocated > 1:  # threshold of ৳1 to avoid floating point noise
            unhandled.append({
                "month": month,
                "savings": round(savings, 2),
                "total_transferred": round(total_transferred, 2),
                "unallocated": round(unallocated, 2)
            })

    return {"unhandled_months": unhandled}


@app.post("/confirm-auto-allocate/{user_id}")
def confirm_auto_allocate(user_id: int, body: schemas.AutoAllocateConfirm, db: Session = Depends(get_db)):
    """
    Create pool transfers for confirmed months.
    Called only when the user explicitly confirms they want to auto-allocate.
    """
    created = []
    for month in body.months:
        # Recompute unallocated amount for safety
        incomes = db.query(models.Income).filter(
            models.Income.user_id == user_id,
            models.Income.date.like(f"{month}%")
        ).all()
        total_income = sum(i.amount for i in incomes)

        txs = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date.like(f"{month}%")
        ).all()
        total_spent = sum(t.amount for t in txs)
        savings = total_income - total_spent
        if savings <= 0:
            continue

        existing = db.query(models.SavingsTransfer).filter(
            models.SavingsTransfer.user_id == user_id,
            models.SavingsTransfer.from_month == month
        ).all()
        total_transferred = sum(t.amount for t in existing)

        goal_allocs = db.query(models.GoalAllocation).filter(
            models.GoalAllocation.user_id == user_id,
            models.GoalAllocation.month == month,
            models.GoalAllocation.source == "savings"
        ).all()
        total_goal_alloc = sum(a.amount for a in goal_allocs)

        unallocated = savings - total_transferred - total_goal_alloc
        if unallocated > 1:
            transfer = models.SavingsTransfer(
                user_id=user_id,
                amount=round(unallocated, 2),
                from_month=month,
                to_month=None,
                transfer_type="pool",
                notes="Auto-allocated at month end"
            )
            db.add(transfer)
            created.append({"month": month, "amount": round(unallocated, 2)})

    db.commit()
    return {"created": created, "count": len(created)}


# ============ LOAN ENDPOINTS ============

@app.post("/loans/", response_model=schemas.LoanOut)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    if loan.amount <= 0:
        raise HTTPException(status_code=400, detail="Loan amount must be greater than 0")
    db_loan = models.Loan(
        user_id=loan.user_id,
        amount=loan.amount,
        remaining_amount=loan.amount,  # starts fully unpaid
        description=loan.description,
        lender=loan.lender,
        date=loan.date,
        is_paid=False
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan


@app.get("/loans/{user_id}", response_model=list[schemas.LoanOut])
def get_loans(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Loan).filter(models.Loan.user_id == user_id).order_by(models.Loan.date.desc()).all()


@app.delete("/loans/{loan_id}")
def delete_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    db.delete(loan)
    db.commit()
    return {"message": "Loan deleted"}


@app.put("/loans/{loan_id}", response_model=schemas.LoanOut)
def update_loan(loan_id: int, update: schemas.LoanUpdate, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, val in update.dict(exclude_none=True).items():
        setattr(loan, field, val)
    db.commit()
    db.refresh(loan)
    return loan


@app.post("/loan-payments/", response_model=schemas.LoanPaymentOut)
def create_loan_payment(payment: schemas.LoanPaymentCreate, db: Session = Depends(get_db)):
    """
    Make a repayment toward a loan.
    - source == "income": creates a monthly Transaction (category="Loan Repayment")
    - source == "savings": deducts from savings pool via LoanPayment record
    Reduces loan.remaining_amount; marks loan.is_paid if fully repaid.
    """
    loan = db.query(models.Loan).filter(models.Loan.id == payment.loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be > 0")
    if payment.amount > loan.remaining_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds remaining balance. Remaining: ৳{loan.remaining_amount:,.2f}"
        )

    # Validate savings pool if paying from savings
    if payment.source == "savings":
        net_pool = _net_savings_pool(payment.user_id, db)
        if payment.amount > net_pool:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient savings pool. Available: ৳{max(net_pool, 0):,.0f}"
            )

    # Create payment record
    db_payment = models.LoanPayment(**payment.dict())
    db.add(db_payment)

    # Update loan balance
    loan.remaining_amount = round(loan.remaining_amount - payment.amount, 2)
    if loan.remaining_amount <= 0:
        loan.remaining_amount = 0
        loan.is_paid = True

    # From income → create a monthly expense transaction
    if payment.source == "income":
        lender_label = f" to {loan.lender}" if loan.lender else ""
        tx = models.Transaction(
            user_id=payment.user_id,
            amount=payment.amount,
            category="Loan Repayment",
            description=f"Loan repayment{lender_label} — {loan.description or 'Loan'}",
            date=payment.date,
            from_savings=False
        )
        db.add(tx)

    db.commit()
    db.refresh(db_payment)
    return db_payment


@app.get("/loan-payments/{user_id}", response_model=list[schemas.LoanPaymentOut])
def get_loan_payments(user_id: int, loan_id: int = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(models.LoanPayment).filter(models.LoanPayment.user_id == user_id)
    if loan_id:
        q = q.filter(models.LoanPayment.loan_id == loan_id)
    return q.order_by(models.LoanPayment.date.desc()).all()


# ============ OCR ENDPOINTS (memory-only, no disk save) ============

@app.post("/parse-image")
async def parse_image_instantly(file: UploadFile = File(...)):
    """Parse uploaded image instantly using OCR — no file is saved to disk."""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP")

    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")

    if not ocr_service.is_paddleocr_available():
        raise HTTPException(status_code=500, detail="OCR service is not available")

    try:
        image_buffer = io.BytesIO(contents)
        extracted_text = ocr_service.extract_text_from_image_bytes(image_buffer)
        parsed_data = parser_service.parse_receipt(extracted_text)
        return {
            "message": "Image parsed successfully",
            "parsed_data": parsed_data,
            "raw_text": extracted_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse image: {str(e)}")


# ============ HEALTH CHECK ============

@app.get("/")
def read_root():
    return {
        "status": "running",
        "message": "Taka Gelo Koi API",
        "version": "5.0",
        "features": [
            "Google OAuth 2.0",
            "Income tracking",
            "Budget tracking with alerts",
            "Monthly expense reports with income pie",
            "Goals & savings management",
            "Auto-allocation with user confirmation",
            "Loan & debt tracking",
            "AI-powered OCR (memory-only)"
        ]
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "auth": "Google OAuth configured",
        "ocr": "available" if ocr_service.is_paddleocr_available() else "unavailable",
        "features": {
            "budget_system": True,
            "monthly_reports": True,
            "income_tracking": True,
            "goals": True,
            "savings_pool": True,
            "auto_allocate": True,
            "loans": True,
            "ocr_no_disk_save": True
        }
    }
