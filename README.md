# TYE — Track Your Expenses

A full-stack expense tracking app with:
- **Backend**: FastAPI + PostgreSQL + Google Cloud Vision OCR
- **Frontend**: React (Vite) + Google OAuth

---

## Folder Structure

```
TYE-Clean/
├── Backend/            ← FastAPI backend
│   ├── main.py         ← All API routes
│   ├── models.py       ← SQLAlchemy DB models
│   ├── schemas.py      ← Pydantic schemas
│   ├── database.py     ← DB connection (edit your credentials here)
│   ├── ocr_service.py  ← Google Cloud Vision OCR
│   ├── parser_service.py ← Receipt text parser
│   ├── bakend test/    ← pytest test suite
│   ├── google_credentials/ ← your GCP service account JSON
│   └── requirements.txt
├── Frontend/           ← React app (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/      ← LandingPage, LoginPage, Dashboard
│   │   ├── components/ ← ParticleCanvas
│   │   ├── hooks/      ← useApi.js (all backend API calls)
│   │   └── Test/       ← Vitest test suite
│   ├── package.json
│   └── vitest.config.js
└── Report And Others/  ← Project documentation
```

---

## Quick Setup

### 1 — Backend

```bash
cd Backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy English model
python -m spacy download en_core_web_sm

# Edit database.py — set your PostgreSQL credentials
# SQLALCHEMY_DATABASE_URL = "postgresql://YOUR_USER:YOUR_PASS@localhost/tye_db"

# Create the database tables
python -c "from database import engine; from models import Base; Base.metadata.create_all(bind=engine)"

# Start the API server
uvicorn main:app --reload
# → http://127.0.0.1:8000
# → API docs: http://127.0.0.1:8000/docs
```

### 2 — Frontend

```bash
cd Frontend

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
# → http://localhost:5173
```

### 3 — Google Cloud Setup (one-time)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Cloud Vision API**
3. Create a **Service Account** → download the JSON key
4. Place the JSON file in `Backend/google_credentials/`
5. Set the environment variable:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=google_credentials/your-key.json
   ```
6. Enable **Google OAuth 2.0** (for login):
   - Go to APIs & Services → Credentials → OAuth 2.0 Client IDs
   - Add `http://localhost:5173` to **Authorized JavaScript origins**
   - Copy the **Client ID** and paste it in `Frontend/src/pages/LoginPage.jsx`

---

## Running Tests

**Backend** (from `Backend/`):
```bash
python -m pytest "bakend test" -v
```

**Frontend** (from `Frontend/`):
```bash
npm test
```

---

## Key API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/google` | Google OAuth login |
| GET | `/transactions/{user_id}` | List transactions |
| POST | `/transactions/` | Add transaction |
| PUT | `/transactions/{id}` | Edit transaction |
| DELETE | `/transactions/{id}` | Delete transaction |
| GET | `/summary/{user_id}?month=YYYY-MM` | Monthly summary |
| GET | `/budgets/{user_id}/{month}` | List budgets |
| POST | `/budgets/` | Create budget |
| PUT | `/budgets/{id}` | Edit budget |
| DELETE | `/budgets/{id}` | Delete budget |
| GET | `/monthly-report/{user_id}?month=YYYY-MM` | Full monthly report |
| POST | `/ocr/upload` | Upload receipt for OCR |
