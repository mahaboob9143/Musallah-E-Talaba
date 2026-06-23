# 🌙 Musallah-E-Talaba

**Community Sehri Distribution Management System**

A comprehensive web platform built for managing Sehri (pre-dawn meal) distribution during Ramadan at SVCET College, Bangalore.

---

## Features

- **Public Landing Page** — Prayer time circle, registration forms, gallery, countdown, community links
- **Admin Dashboard** — Team management, submissions viewer, financial overview, gallery manager, settings, reports (PDF + Excel)
- **Financial Team Dashboard** — Payment verification, income/expense tracking, budget reports
- **Khidmat Team Dashboard** — Daily attendance by zone, checklist management
- **Progressive Web App** — PWA-ready with offline support and service worker
- **Firebase Backend** — Firestore, Auth, Storage with comprehensive security rules

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Build | Vite + PWA Plugin |
| Backend | Firebase (Firestore, Auth, Storage) |
| Charts | Chart.js |
| Exports | jsPDF (PDF), SheetJS (Excel) |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Firebase CLI (`npm i -g firebase-tools`)

### 1. Clone & Install
```bash
cd Talaba-mousallah
npm install
```

### 2. Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Email/Password provider
3. Create **Firestore Database**
4. Enable **Storage**
5. Copy your Firebase config and paste into `src/js/firebase-config.js`

### 3. Create First Admin User
1. In Firebase Console → Authentication, add a user with email & password
2. In Firestore, create a document in the `users` collection with the user's UID as the document ID:
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "role": ["admin"],
  "status": "active"
}
```

### 4. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:5173`

### 5. Deploy to Firebase Hosting
```bash
npm run build
firebase deploy
```

---

## Project Structure

```
├── index.html                    # Main HTML shell
├── vite.config.js                # Vite + PWA configuration
├── firebase.json                 # Firebase hosting config
├── firestore.rules               # Firestore security rules
├── storage.rules                 # Storage security rules
├── src/
│   ├── css/
│   │   ├── styles.css            # Design system & variables
│   │   ├── components.css        # Reusable UI components
│   │   ├── landing.css           # Landing page styles
│   │   ├── admin.css             # Admin dashboard styles
│   │   ├── financial.css         # Financial dashboard styles
│   │   ├── khidmat.css           # Khidmat dashboard styles
│   │   └── responsive.css        # Media queries
│   ├── js/
│   │   ├── main.js               # App entry point & router setup
│   │   ├── auth.js               # Firebase Auth + role management
│   │   ├── router.js             # Hash-based SPA router
│   │   ├── firebase-config.js    # Firebase initialization
│   │   ├── landing-page.js       # Public landing page
│   │   ├── forms.js              # Registration/feedback/donation forms
│   │   ├── prayer-times.js       # Prayer circle & calculations
│   │   ├── admin/                # Admin dashboard modules
│   │   ├── financial/            # Financial team modules
│   │   ├── khidmat/              # Khidmat team modules
│   │   ├── components/           # Reusable JS components
│   │   └── utils/                # Utility functions
│   └── assets/
│       └── data/
│           └── prayer-times.json # Prayer times data
```

---

## User Roles

| Role | Access |
|------|--------|
| **Public** | Landing page, forms, gallery |
| **Admin** | Full access to all dashboards |
| **Financial** | Payment verification, transactions, reports |
| **Khidmat** | Attendance, checklist management |

---

## Security

- Firestore security rules enforce role-based access
- Storage rules limit file uploads to 5MB images/PDFs
- Client-side rate limiting on form submissions
- Input validation and XSS prevention
- Audit logging for all team actions

---

## License

This project is for community use at SVCET College.
