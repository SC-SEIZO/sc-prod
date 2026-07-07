# Hardcoded Credentials Documentation

This document logs all historical, fallback, and hardcoded credentials in the PT. Sugity Creatives Integrated Production Planning System.

---

## 1. Planner Dashboard Credentials

*   **Fallback PIN**: `5555`
*   **Environment Variable**: `PLANNER_PIN`
*   **Locations**:
    *   `src/components/auth/LoginPage.tsx` (client-side verification fallback)
    *   `server.ts` (Express server validation fallback)
    *   `api/leaders.ts` / `api/leaders/pins.ts` / `api/leaders/[id].ts` (Vercel serverless validation fallback)
    *   `api/_lib.ts` (Shared utility verification helper fallback)

---

## 2. Leader Dashboard Credentials

*   **Fallback Master PIN**: `8888` / `8811` (AP)
*   **Environment Variable**: `MASTER_LEADER_PIN`
*   **Locations**:
    *   `server.ts` (Express server validation fallback)
    *   `api/leaders/verify.ts` (Vercel serverless validation fallback)
    *   `api/_lib.ts` (Shared utility verification helper fallback)

*Individual leader PINs are stored securely inside the database table `public.leaders` using scrypt hashing and optional AES-256-GCM encryption.*

---

## 3. Member Operator (Machine Console) Credentials

Member PINs are generated dynamically per machine to prevent static credentials from leaking.

### Generation Logic (`getMemberPin` in `src/lib/utils.ts`)

The formula derives a **4-character uppercase code** based on the chosen Factory Name and Machine ID:

1.  **Factory Code**:
    *   `FACT 2` $\rightarrow$ `F2`
    *   `FACT 3` $\rightarrow$ `F3`
    *   `FACT 4` $\rightarrow$ `F4`
    *   `SC2 Resin` $\rightarrow$ `SC`
    *   Other names $\rightarrow$ extracts digits (e.g. `FACT 5` $\rightarrow$ `F5`)
2.  **Machine Code**:
    *   Strip whitespace and `MC` prefix.
    *   Padded to fill the remaining length up to 4 characters.

### Machine PIN Reference List

Based on the default `FACTORY_DATA` configuration, the generated PINs are:

#### SC1 - Factory 2 (Cibitung)
*   Machine MC 1 $\rightarrow$ `F201`
*   Machine MC 2 $\rightarrow$ `F202`
*   Machine MC 3 $\rightarrow$ `F203`
*   Machine MC 4 $\rightarrow$ `F204`
*   Machine MC 5 $\rightarrow$ `F205`
*   Machine MC 6 $\rightarrow$ `F206`
*   Machine MC 7 $\rightarrow$ `F207`
*   Machine MC 8 $\rightarrow$ `F208`

#### SC1 - Factory 3 (Cibitung)
*   Machine MC 1 $\rightarrow$ `F301`
*   Machine MC 2 $\rightarrow$ `F302`
*   Machine MC 3 $\rightarrow$ `F303`
*   Machine MC 4 $\rightarrow$ `F304`
*   Machine MC 5 $\rightarrow$ `F305`
*   Machine MC 6 $\rightarrow$ `F306`
*   Machine MC 7 $\rightarrow$ `F307`
*   Machine MC 8 $\rightarrow$ `F308`
*   Machine MC 9 $\rightarrow$ `F309`
*   Machine MC 10 $\rightarrow$ `F310`
*   Machine MC 10B $\rightarrow$ `F30B`
*   Machine MC 11 $\rightarrow$ `F311`
*   Machine MC 13 $\rightarrow$ `F313`
*   Machine MC 14 $\rightarrow$ `F314`

#### SC1 - Factory 4 (Cibitung)
*   Machine MC 1 $\rightarrow$ `F401`
*   Machine MC 7 $\rightarrow$ `F407`
*   Machine MC 8 $\rightarrow$ `F408`
*   Machine MC B1 $\rightarrow$ `F4B1`
*   Machine MC B2 $\rightarrow$ `F4B2`
*   Machine MC B3 $\rightarrow$ `F4B3`

#### SC2 - Karawang Plant
*   Machine MC 1 $\rightarrow$ `SC01`
*   Machine MC 2 $\rightarrow$ `SC02`
*   Machine MC 3 $\rightarrow$ `SC03`
*   Machine MC 4 $\rightarrow$ `SC04`
*   Machine MC 5 $\rightarrow$ `SC05`
