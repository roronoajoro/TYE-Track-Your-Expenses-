"""
Pydantic Schemas — Taka Gelo Koi
Includes Google OAuth, Budget, Transaction, Income, Goal, GoalAllocation, SavingsTransfer, Loan, LoanPayment
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List


# ============ GOOGLE OAUTH SCHEMAS ============

class GoogleTokenRequest(BaseModel):
    token: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    picture: Optional[str] = None
    google_id: str

    class Config:
        from_attributes = True


class GoogleLoginResponse(BaseModel):
    message: str
    user_id: int
    name: str
    email: str
    picture: Optional[str] = None
    is_new_user: bool


# ============ BUDGET SCHEMAS ============

class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float
    month: str
    alert_threshold: Optional[float] = 80.0
    notifications_enabled: Optional[bool] = True


class BudgetUpdate(BaseModel):
    monthly_limit: Optional[float] = None
    alert_threshold: Optional[float] = None
    notifications_enabled: Optional[bool] = None


class BudgetOut(BaseModel):
    id: int
    user_id: int
    category: str
    monthly_limit: float
    month: str
    alert_threshold: float
    notifications_enabled: bool

    class Config:
        from_attributes = True


class BudgetStatus(BaseModel):
    budget: BudgetOut
    spent: float
    remaining: float
    percentage_used: float
    is_over_budget: bool
    is_near_limit: bool


# ============ TRANSACTION SCHEMAS ============

class TransactionCreate(BaseModel):
    amount: float
    category: str
    description: str
    date: str
    user_id: int
    image_path: Optional[str] = None
    goal_id: Optional[int] = None
    from_savings: Optional[bool] = False


class TransactionOut(BaseModel):
    id: int
    amount: float
    category: str
    description: str
    date: str
    image_path: Optional[str] = None
    raw_text: Optional[str] = None
    goal_id: Optional[int] = None
    from_savings: Optional[bool] = False

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None


class MonthlyExpenseReport(BaseModel):
    month: str
    total_spent: float
    total_income: Optional[float] = 0.0
    category_breakdown: dict
    budget_comparison: Optional[dict] = None


# ============ INCOME SCHEMAS ============

class IncomeCreate(BaseModel):
    amount: float
    source: str           # "Salary" | "Gift" | "Donation" | custom
    description: Optional[str] = ""
    date: str             # YYYY-MM-DD
    user_id: int


class IncomeOut(BaseModel):
    id: int
    user_id: int
    amount: float
    source: str
    description: Optional[str] = ""
    date: str

    class Config:
        from_attributes = True


class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None


# ============ GOAL SCHEMAS ============

class GoalCreate(BaseModel):
    user_id: int
    name: str
    target_amount: float
    icon: Optional[str] = "🎯"
    color: Optional[str] = "#e8b84b"
    deadline: Optional[str] = None   # YYYY-MM-DD
    created_month: str               # YYYY-MM


class GoalOut(BaseModel):
    id: int
    user_id: int
    name: str
    target_amount: float
    current_amount: float
    icon: str
    color: str
    deadline: Optional[str] = None
    status: str
    created_month: str

    class Config:
        from_attributes = True


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None


# ============ GOAL ALLOCATION SCHEMAS ============

class GoalAllocationCreate(BaseModel):
    goal_id: int
    user_id: int
    amount: float
    month: str           # YYYY-MM
    source: str          # "income" | "savings"
    notes: Optional[str] = ""


class GoalAllocationOut(BaseModel):
    id: int
    goal_id: int
    user_id: int
    amount: float
    month: str
    source: str
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


# ============ SAVINGS TRANSFER SCHEMAS ============

class SavingsTransferCreate(BaseModel):
    user_id: int
    amount: float
    from_month: str              # YYYY-MM
    to_month: Optional[str] = None  # YYYY-MM or null if going to pool
    transfer_type: str           # "carry_forward" | "pool" | "loan_repayment"
    notes: Optional[str] = ""


class SavingsTransferOut(BaseModel):
    id: int
    user_id: int
    amount: float
    from_month: str
    to_month: Optional[str] = None
    transfer_type: str
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


# ============ LOAN SCHEMAS ============

class LoanCreate(BaseModel):
    user_id: int
    amount: float
    description: Optional[str] = ""
    lender: Optional[str] = ""   # person / institution
    date: str                    # YYYY-MM-DD


class LoanUpdate(BaseModel):
    description: Optional[str] = None
    lender: Optional[str] = None
    is_paid: Optional[bool] = None


class LoanOut(BaseModel):
    id: int
    user_id: int
    amount: float
    remaining_amount: float
    description: Optional[str] = ""
    lender: Optional[str] = ""
    date: str
    is_paid: bool

    class Config:
        from_attributes = True


class LoanPaymentCreate(BaseModel):
    loan_id: int
    user_id: int
    amount: float
    source: str          # "income" | "savings"
    month: str           # YYYY-MM
    date: str            # YYYY-MM-DD
    notes: Optional[str] = ""


class LoanPaymentOut(BaseModel):
    id: int
    loan_id: int
    user_id: int
    amount: float
    source: str
    month: str
    date: str
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


# ============ AUTO-ALLOCATE CONFIRM SCHEMA ============

class AutoAllocateConfirm(BaseModel):
    months: List[str]