# SightSync Backend

A modular monolith REST API backend built with Express.js, PostgreSQL, and Passport.js authentication.

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js 5
- **Database:** PostgreSQL (Neon)
- **Authentication:** JWT + Passport.js (GitHub, Google, Facebook OAuth)
- **Testing:** Jest

## Project Structure

```
backend sightsync/
├── server.js                  # Entry point
├── app.js                     # Express app setup & route mounting
├── shared/
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection pool
│   │   └── passport.js        # Passport OAuth strategies
│   └── middleware/
│       ├── authMiddleware.js   # JWT auth guard
│       └── roleMiddleware.js   # Role-based access control
├── modules/
│   ├── auth/                  # Registration, login, OAuth flows
│   ├── users/                 # User CRUD (admin only)
│   ├── lenses/                # Lens catalog
│   └── patient_management/    # Patient profile management
└── .env                       # Environment variables
```

## Prerequisites

- Node.js 18+
- PostgreSQL database (Neon or Supabase)

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd backend sightsync
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```env
   PORT=3500
   DATABASE_URL_NEON=postgresql://<user>:<password>@<host>/<database>?sslmode=require
   JWT_SECRET=<your-jwt-secret>
   SESSION_SECRET=<your-session-secret>
   FRONTEND_URL=http://localhost:5173
   GITHUB_CLIENT_ID=<your-github-client-id>
   GITHUB_CLIENT_SECRET=<your-github-client-secret>
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   FACEBOOK_CLIENT_ID=<your-facebook-client-id>
   FACEBOOK_CLIENT_SECRET=<your-facebook-client-secret>
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Run tests:
   ```bash
   npm test
   ```

The server starts on `http://localhost:3500` by default.

## API Endpoints

### Auth (`/auth`)

| Method | Endpoint              | Description                  | Auth Required |
|--------|-----------------------|------------------------------|---------------|
| POST   | `/auth/register`      | Register a new user          | No            |
| POST   | `/auth/login`         | Login with email/password    | No            |
| GET    | `/auth/logout`        | Clear auth cookie            | No            |
| GET    | `/auth/me`            | Get current authenticated user | Yes         |
| GET    | `/auth/github`        | Initiate GitHub OAuth        | No            |
| GET    | `/auth/github/callback` | GitHub OAuth callback      | No            |
| GET    | `/auth/google`        | Initiate Google OAuth        | No            |
| GET    | `/auth/google/callback` | Google OAuth callback      | No            |
| GET    | `/auth/facebook`      | Initiate Facebook OAuth      | No            |
| GET    | `/auth/facebook/callback` | Facebook OAuth callback   | No            |

### Users (`/users`) — Admin Only

| Method | Endpoint       | Description       |
|--------|----------------|-------------------|
| GET    | `/users/:id`   | Get user by ID    |
| PATCH  | `/users/:id`   | Update user       |
| DELETE | `/users/:id`   | Delete user       |

### Lenses (`/lenses`)

| Method | Endpoint           | Description       |
|--------|--------------------|-------------------|
| GET    | `/lenses/allLenses`| Get all lenses    |

### Patients (`/patients`)

| Method | Endpoint      | Description           | Auth Required |
|--------|---------------|-----------------------|---------------|
| GET    | `/patients/`  | Get own profile       | Yes           |
| PATCH  | `/patients/`  | Update own profile    | Yes           |

## CORS

Allowed origins are configured in `app.js`:
- `http://127.0.0.1:5500`
- `http://localhost:5500`
- `http://localhost:5173`
- `http://localhost:5174`
