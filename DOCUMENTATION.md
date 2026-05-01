# Project Documentation: Event QR Entry System (QRB)

## 1. Overview
The **Event QR Entry System (QRB)** is a full-stack web application designed to streamline event check-ins using QR code technology. It provides a secure, fast, and scalable solution for managing event attendees, preventing duplicate entries, and providing real-time analytics to administrators.

## 2. Technical Stack
- **Frontend**: React.js (Vite), Tailwind CSS (Styling), React Router (Navigation).
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB (Mongoose ODM).
- **Authentication**: Role-based access (Admin/Volunteer) using JWT tokens and local storage.
- **Security**: Express-rate-limit for preventing brute-force and spam.

---

## 3. Core Features Implemented

### 🛡️ Security & Authentication
- **Role-Based Access Control (RBAC)**: Distinct interfaces and permissions for **Admins** and **Volunteers**.
- **Rate Limiting**: Implemented `express-rate-limit` on critical endpoints:
    - `Scan`: Max 60 requests/min.
    - `OTP`: Max 10 requests/min.
- **OTP Integration**: Secure one-time password system for secondary verification or login.

### 📱 Volunteer Scanner (The Frontend)
- **Real-time QR Scanning**: Integrated camera-based scanner optimized for mobile browsers.
- **Instant Feedback**: Visual cues for success (Green), duplicate scan (Orange), or invalid token (Red).
- **Mobile Optimized**: Responsive design focused on speed and ease of use for volunteers on the ground.
- **Camera Fixes**: Resolved specific issues related to camera access on mobile devices and Vercel deployments.

### 📊 Admin Dashboard
- **Attendee Management**: Full CRUD operations for attendees.
- **Analytics**: Real-time tracking of how many people have checked in vs. total attendees.
- **Scan Logs**: Detailed logs of every scan attempt, including timestamp and method.
- **Data Export/Import**: Capability to handle attendee data via Excel files (`.xlsx`).

### 🔗 QR Verification Engine (Backend)
- **Authorized Scanner Only**: Modified the system so that QR scan counts only increase when scanned through the official platform. Direct hits from external apps (Google Lens, etc.) are redirected to a non-destructive landing page.
- **Atomic Operations**: Uses MongoDB's `findOneAndUpdate` with status checks to ensure no two people can enter with the same QR code (prevents race conditions).
- **Public Instruction Page**: The `/verify/:token` route now serves as an instructional landing page, informing users to use the official platform instead of automatically granting entry.

---

## 4. Work Done So Far (Milestones)

### Phase 1: Foundation
- [x] Initialized MERN stack project structure.
- [x] Established MongoDB schemas for `Attendee`, `User` (Auth), and `ScanLog`.
- [x] Set up basic Express API with CORS and environment variables.

### Phase 2: Core Logic
- [x] Developed the QR token generation and verification logic.
- [x] Implemented "Anti-Duplicate" logic at the database level.
- [x] Built the **Login** system with JWT support.

### Phase 3: Frontend Development
- [x] Created the **Volunteer Scanner** with `react-qr-scanner`.
- [x] Designed the **Admin Dashboard** with real-time data fetching.
- [x] Polished the UI with Tailwind CSS for a premium "Glassmorphism" look.

### Phase 4: Optimization & Debugging
- [x] **OTP Troubleshooting**: Fixed issues with email delivery for OTPs.
- [x] **Camera Access**: Fixed bugs where mobile cameras wouldn't open on HTTPS/Vercel environments.
- [x] **Empty Lists**: Resolved bugs where attendee lists were appearing empty in certain views.
- [x] **Excel Integration**: Added scripts for seeding data and exporting results.

---

## 5. System Workflow

1.  **Attendee Registration**: Attendees are added (manually or via Excel) and assigned a unique QR token.
2.  **QR Scanning**:
    - **Authorized Path**: Volunteer scans using the **Official Platform Scanner**. This extracts the token and hits the protected API (with JWT auth) to increment the scan count.
    - **External Path**: Any user scans via a regular camera. This opens the **Instruction Landing Page**. No scan count is triggered.
3.  **Verification (Authorized Path Only)**: The backend checks the token status:
    - If `UNUSED` -> Change to `USED`, mark timestamp, and allow entry.
    - If `USED` -> Reject and show "Already Scanned" error.
4.  **Admin Monitoring**: Admins see the scan logs update in real-time on their dashboard.

---

## 6. How to Run
- **Backend**: `npm start` (Runs on Port 5000)
- **Frontend**: `npm run dev` (Runs inside `/frontend` directory)
- **Environment**: Requires `MONGODB_URI`, `JWT_SECRET`, `SMTP` configs, and `FRONTEND_URL` in `.env`.
