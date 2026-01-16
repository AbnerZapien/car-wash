# Carwash Project Status

> Hedgestone Carwash Management System | HexaGO Framework

---

## 0. Documentation

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Go | 1.23.2+ | https://go.dev/dl/ |
| Node.js | 20.x | https://nodejs.org/ |
| pnpm | latest | `npm install -g pnpm` |
| Air | latest | `go install github.com/cosmtrek/air@latest` |
| Templ | latest | `go install github.com/a-h/templ/cmd/templ@latest` |

### Environment Setup

Create `.env` file from example:
```bash
cp .env.example .env
```

Environment variables:
| Variable | Default | Description |
|----------|---------|-------------|
| GO_PORT | 3000 | Server port |
| JWT_SECRET | SECRET | JWT signing key (change in production) |
| ENV | development | Environment mode |

### Development Commands

**Backend (Go)**
```bash
# Start dev server with hot reload
air

# Generate Templ templates manually
templ generate

# Build binary
go build -o ./tmp/main .
```

**Frontend (TypeScript/Alpine.js)**
```bash
cd js

# Install dependencies
pnpm install

# Build CSS (Tailwind)
pnpm tailwind:build

# Build JS (Vite)
pnpm build

# Dev server
pnpm dev
```

### Docker Deployment

```bash
cd deployments

# Build and run
docker compose up -d

# View logs
docker compose logs -f server
```

Services:
- `server` - Go app on port 3000
- `nginx` - Reverse proxy on port 80

### Project URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Main app |
| http://localhost:3000/login | Login page |
| http://localhost:3000/signup | Registration |
| http://localhost:3000/dashboard | User dashboard |
| http://localhost:3000/admin/portal | Admin portal |
| http://localhost:3000/qr-code | QR code display |
| http://localhost:3000/scanner | QR scanner |

### Architecture: Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────┐
│                    Adapters                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  HTTP API   │  │  Web Views  │  │  SQLite DB  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
│         ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────┐   │
│  │                   Ports                      │   │
│  │  (Interfaces defining contracts)             │   │
│  └─────────────────────┬───────────────────────┘   │
│                        │                            │
│                        ▼                            │
│  ┌─────────────────────────────────────────────┐   │
│  │                   Core                       │   │
│  │  (Business logic, domain models)             │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Each hexagon (service) follows:
```
<ServiceName>/
├── core/           # Business logic & domain
├── ports/          # Interfaces (driving & driven)
└── adapters/       # Implementations (HTTP, DB)
```

### Dependencies

**Go Modules**
| Package | Purpose |
|---------|---------|
| echo/v4 | HTTP framework |
| templ | Go HTML templating |
| sqlx | SQL extensions |
| go-sqlite3 | SQLite driver |
| go-auth | JWT authentication |
| godotenv | Environment loading |

**JS Packages**
| Package | Purpose |
|---------|---------|
| alpinejs | Reactive frontend |
| htmx.org | HTML-over-the-wire |
| tailwindcss | CSS framework |
| daisyui | UI components |
| vite | Build tool |

---

## 1. Project Overview

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Go 1.23.2, Echo v4, SQLite3 |
| Frontend | TypeScript, Alpine.js, HTMX, Tailwind CSS, DaisyUI |
| Build | Templ, Vite, pnpm |
| Deploy | Docker, Docker Compose, Nginx |

### Architecture
Hexagonal Architecture (Ports & Adapters) - separates business logic from external concerns.

### Directory Structure

```
carwash/
├── internal/           # Core business logic
│   ├── calculator/     # Demo calculator service
│   └── users/          # User management
├── web/                # Templ views & components
│   ├── components/     # Reusable UI
│   ├── templates/      # Root templates
│   └── views/          # Page views
├── js/src/             # TypeScript/Alpine.js
│   ├── core/models/    # Data models
│   ├── store/          # Alpine stores
│   ├── ports/          # Interfaces
│   └── adapters/       # localStorage, mockData
├── static/             # Compiled assets
├── db/                 # Database & schema
├── deployments/        # Docker files
└── docs/               # Documentation
```

---

## 2. Working Features

### Backend (Go)

| Feature | Status |
|---------|--------|
| User Registration | Working |
| User Authentication | Working |
| JWT Session Management | Working |
| Cookie Auth (Web) | Working |
| Token Auth (API) | Working |
| Calculator CRUD | Working |
| SQLite Persistence | Working |

### API Endpoints

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/v1/users/signin` | POST | Working |
| `/api/v1/users/signup` | POST | Working |
| `/api/v1/users/all` | GET | Working |
| `/api/v1/calculator/*` | ALL | Working |

### Web Routes

| Route | Status |
|-------|--------|
| `/login` | Working |
| `/signup` | Working |
| `/home` | Working |
| `/dashboard` | Working |
| `/qr-code` | Working |
| `/scanner` | Working |
| `/admin/portal` | Working |

### Frontend UI (Templ)

| View | Status |
|------|--------|
| Login/Register Pages | Complete |
| User Dashboard | Complete |
| QR Code Page | Complete |
| Scanner Interface | Complete |
| Admin Portal - Dashboard | Complete |
| Admin Portal - Members | Partial |

### TypeScript Stores (Alpine.js)

| Store | Status |
|-------|--------|
| authStore | Working |
| dashboardStore | Working |
| adminStore | Working |
| scannerStore | Working |
| qrCodeStore | Working |

---

## 3. Missing Features

### Critical Priority

| Feature | Status |
|---------|--------|
| Database schema gaps | Missing tables: locations, subscriptions, plans, wash_history |
| Sessions table syntax error | Missing comma in CREATE statement |
| User table incomplete | Missing: email, phone, subscription_id |
| Core business APIs | No endpoints for locations, subscriptions, washes |

### High Priority

| Feature | Status |
|---------|--------|
| Frontend-backend integration | Alpine stores use mock data, no API calls |
| QR code API | No generation or validation endpoints |
| Admin statistics API | No reporting endpoints |
| Security improvements | SHA256→bcrypt, add CSRF, input validation |

### Medium Priority

| Feature | Status |
|---------|--------|
| Admin Portal sections | 7 of 9 sections show "Coming Soon" |
| Test coverage | No unit, integration, or E2E tests |
| Member CRUD | UI exists, no backend implementation |
| Scanner functionality | Simulation only, no actual scanning |

### Low Priority

| Feature | Status |
|---------|--------|
| API documentation | None |
| Deployment guide | None |
| Rate limiting | Not implemented |
| Logging setup | Not configured |

---

## 4. Implementation Roadmap

### Phase 1: Database & Schema
- Fix sessions table syntax error
- Add missing tables: locations, subscriptions, plans, wash_history, wash_types
- Extend users table with email, phone, subscription_id fields
- Create proper foreign key relationships

### Phase 2: Core Business APIs
- Location management endpoints (CRUD)
- Subscription/plan management endpoints
- Wash history tracking endpoints
- QR code generation and validation endpoints
- Admin statistics and reporting endpoints

### Phase 3: Frontend-Backend Integration
- Replace mock data in Alpine stores with API calls
- Add fetch/axios layer for HTTP requests
- Implement proper error handling
- Add loading states to UI components

### Phase 4: Security Hardening
- Switch password hashing to bcrypt
- Add CSRF token protection
- Implement input validation on all endpoints
- Add rate limiting
- Move secrets to proper environment configuration

### Phase 5: Testing
- Add unit tests for core business logic
- Add integration tests for API endpoints
- Add E2E tests for critical user flows
- Configure test frameworks and CI integration

### Phase 6: Admin Portal Completion
- Implement Usage section
- Implement Attrition section
- Implement Attendants section
- Implement Promotions section
- Implement Revenue section
- Implement Income section
- Implement Widget section

---

## 5. Summary Matrix

| Category | Progress | Status |
|----------|----------|--------|
| User Auth | 80% | Working, missing logout/profile |
| Calculator | 100% | Complete (demo) |
| Dashboard UI | 95% | UI complete, needs real data |
| Admin Portal | 40% | Dashboard only, 7 sections pending |
| QR Features | 30% | UI complete, no backend |
| Backend APIs | 15% | Auth only |
| Tests | 0% | None |
| Database | 40% | Basic schema, missing tables |
| Documentation | 10% | Minimal |

---

*Generated: 2026-01-05*
