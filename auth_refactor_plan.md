# Authentication Refactor & Database Plan

This document outlines the step-by-step implementation plan for transitioning the PT. Sugity Creatives Shopfloor Integration System to a secure, email/password-based device authentication gateway using JWT (JSON Web Tokens) stored in cookies.

---

## Key Requirements & Goals
1.  **Outer Gate Gateway**: Require users to authenticate once using an email and password. This session is persisted via cookies on the shopfloor tablets to prevent constant logout.
2.  **No PIN Prompt for Roles**: Once authenticated on a device, clicking "Planner", "Leader", or "Production Board" will enter the respective panels **without requiring a PIN**.
3.  **Member Console Preservation**: Operators still choose their name, select a machine, and enter the dynamic Machine PIN (e.g. `F201`) to maintain initials calculation inside the Kanban printing logs.
4.  **Disabled Viewer**: The "Viewer" workspace role will be disabled/hidden.
5.  **Seeder & Database Column**: Add the `password_hash` column to the `public.users` table and seed users for each role.

---

## Step 1: Database Migrations & Seed Data

A new SQL script `migration_users_auth.sql` will be created to perform:
1.  Add `password_hash` to the `public.users` table.
2.  Update the constraint checks on user roles to support all active application roles.
3.  Seed initial accounts for each workspace role.

### Seed Accounts (Password: `<role>123`):
*   **Planner**: `planner@sugity.co.id` / `planner123`
*   **Leader**: `leader@sugity.co.id` / `leader123`
*   **Member Operator**: `operator@sugity.co.id` / `operator123`
*   **Production Board**: `board@sugity.co.id` / `board123`

Passwords will be hashed using the **scrypt** cryptographic derivation algorithm (`scrypt:salt:hash`) for database consistency with leader PINs.

---

## Step 2: Backend Authentication API Development

We will implement three new API endpoints in the Express server (`server.ts`) and Vercel serverless functions (`api/auth/`):

1.  **`POST /api/auth/login`**:
    *   Accepts `email` and `password`.
    *   Retrieves the user from `public.users` and verifies the password hash.
    *   Generates a HS256 JWT containing `{ email, role }` signed using a server-side secret (`JWT_SECRET`).
    *   Attaches the JWT as a cookie named `sugity_session` (`HttpOnly`, `Path=/`, `Max-Age=30 days`, `SameSite=Lax`).
2.  **`GET /api/auth/me`**:
    *   Reads and verifies the `sugity_session` cookie.
    *   Returns the authenticated user details `{ email, role }`.
3.  **`POST /api/auth/logout`**:
    *   Clears the `sugity_session` cookie by setting `Max-Age=0`.

*JWT signing and verification will be implemented in pure TypeScript/JavaScript inside the shared `api/_lib.ts` to avoid adding external dependencies.*

---

## Step 3: Frontend Authentication Context Integration (`UserContext.tsx`)

*   Add state: `isAuthenticated`, `currentUser`, and `isLoadingAuth`.
*   On initialization, perform an API request to `GET /api/auth/me`. If successful, set `isAuthenticated = true` and `currentUser`.
*   Expose `login(email, password)` and `logout()` functions.

---

## Step 4: Login & Profile Portal UI Refactoring (`LoginPage.tsx`)

1.  **Conditional Rendering**:
    *   If `isAuthenticated === false`: Display the **new Email & Password Login Screen**.
    *   If `isAuthenticated === true`: Display the **Dashboard Selection portal** (the current Login screen).
2.  **No PIN Validation on Portal**:
    *   Clicking **Planner**, **Leader**, or **Production Board** will transition the profile state directly without showing the PIN prompt modal.
3.  **Preserved Member Flow**:
    *   Clicking **Member Operator** prompts the operator to select their machine, type their name, and enter the machine-specific PIN (e.g. `F201`) to access the Member Console.
4.  **Disabled Viewer Card**:
    *   The "Viewer" profile card will be removed from the Landing Portal.
5.  **Global Logout Link**:
    *   Add a subtle "Logout System" button on the Portal Selector screen to clear the device session.
