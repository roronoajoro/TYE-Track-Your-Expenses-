# Taka Gelo Koi — টাকা গেলো কই 💸

> **A personal finance tracker** for income, expenses, budgets, goals, savings, and loans — built for Bengali-speaking users with Google OAuth and AI-powered OCR receipt scanning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + SQLAlchemy + PostgreSQL |
| Frontend | React 19 + Vite + Recharts |
| Auth | Google OAuth 2.0 |
| OCR | Google Cloud Vision API (REST) |
| Tests | Pytest (backend) · Vitest (frontend) |

---

## Project Structure

```
Taka Gelo Koi/
├── backend/
│   ├── app/                  # Core FastAPI logic
│   │   ├── main.py           # All API routes (transactions, budgets, income, goals, loans, OCR)
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── database.py       # DB engine & session factory
│   │   ├── ocr_service.py    # Google Cloud Vision OCR (REST)
│   │   └── parser_service.py # Bengali + English receipt parser
│   ├── migrations/           # One-time DB migration scripts
│   ├── tests/                # Pytest test suite
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── pages/            # Dashboard, LandingPage, LoginPage
│   │   ├── hooks/useApi.js   # Central data hook (all API calls)
│   │   └── components/       # Shared UI components
│   ├── tests/                # Vitest test suite
│   ├── package.json
│   └── .env.example          # Frontend env var template
├── docs/                     # Project reports and presentations
├── .gitignore
└── README.md
```

---

## Quick Start

### 1. Clone & configure

```bash
git clone https://github.com/your-org/taka-gelo-koi.git
cd taka-gelo-koi
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env         # Windows
# cp .env.example .env         # macOS/Linux
# → Edit .env and fill in DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_VISION_API_KEY

# Run the API server (from inside backend/app/)
cd app
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux
# → Edit .env.local and fill in VITE_API_URL, VITE_GOOGLE_CLIENT_ID

# Start dev server
npm run dev
```

The app will be available at **http://localhost:5173**

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string e.g. `postgresql://user:pass@localhost/dbname` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID (from Google Cloud Console) |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision REST API key |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL e.g. `http://localhost:8000` |
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth Client ID as backend |

---

## Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

---

## Key Features

- 🔐 **Google OAuth** — one-click login, no passwords
- 💰 **Expense Tracking** — categorised transactions with CRUD
- 📊 **Budget Management** — monthly limits with alert thresholds
- 💵 **Income Tracking** — multi-source income with monthly summaries
- 🎯 **Goals & Savings** — allocate savings to financial goals
- 🏦 **Loan Tracking** — track debts and repayments
- 🤖 **OCR Scanning** — scan Bengali/English receipts via Google Vision API
- 📈 **Analytics** — charts for spending trends and budget comparisons

---

## Team

**Team 17 — CSE412** | Taka Gelo Koi

---

## License

MIT License
