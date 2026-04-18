# MindBridge 

MindBridge  is a full-stack mental wellness platform that connects patients
with licensed therapists for secure chat and video consultations, backed by an
intelligent assessment engine and real‑time notifications.

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
git clone <repo-url>
cd MindBridge
```

2. **Install dependencies**
   - Backend: `cd server && npm install`
   - Frontend: `cd client && npm install`

3. **Configure environment variables**
   - Copy the example files or use the templates below:
     - `server/.env`
     - `client/.env`
   - At minimum you need MongoDB URI, JWT secret, Gmail SMTP credentials and a
     Google Gemini key for AI summaries.

4. **Run MongoDB** (local or Atlas cloud)

5. **Start the servers**
   ```bash
# backend
cd server
npm run dev

# frontend
cd client
npm run dev
```

6. **Open the app** in your browser at `http://localhost:5173` and sign up as a
   patient or doctor to begin using the platform.

## 🧱 Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express, MongoDB, Mongoose
- Real-time: Socket.io, WebRTC
- AI: Google Gemini for generating chat summaries
- Email: Nodemailer (Gmail SMTP)
- Authentication: JWT with role-based guards

## 🔧 Features

### Patient Capabilities

- Complete a multi-step wellness assessment to receive a recommended
  specialization
- Browse and filter doctors by specialization, rating, and rate
- Book appointments with availability checks
- Join real-time text chat and video sessions with doctors
- Receive email confirmations and in-app notifications
- View upcoming and past appointments on a dashboard

### Doctor Capabilities

- Create and update profile, set availability and hourly rate
- View and manage patient appointments
- Access dashboard metrics on appointment counts
- Participate in real-time chat and video sessions

### Shared Platform Features

- JWT-based authentication with protected routes
- Socket.io for low-latency messaging and WebRTC signaling
- WebRTC video calls with mute/camera toggling and end controls
- AI-generated summaries for chat sessions with download option
- Notifications for both patients and doctors about upcoming events
- Clear/delete controls for chat and video sessions

## ⚙️ API Endpoints

Endpoints are organized under `/server/routes`. Key routes include:

- `/api/auth` – signup, login, profile
- `/api/doctors` – list and profile operations
- `/api/appointments` – booking and management
- `/api/assessment` – patient wellness data
- `/api/chat` – session and message handling
- `/api/contact` – support form

(All routes that change data require a valid JWT token from the frontend.)

## 🛠 Development Notes

- Frontend pages live in `client/src/pages`; components under
  `client/src/components`.
- Zustand store used for auth (`client/src/store/authStore.js`).
- WebRTC utilities in `client/src/utils/webrtc.js` manage peer connections.
- Backend controllers are in `server/controllers`; models in `server/models`.
- ProtectedRoute component enforces role-based access in `client/src/App.jsx`.
- New features should add API routes, controller handlers, and corresponding
  UI pages.

## 📁 Project Structure

```
MindBridge/
├─ client/
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  ├─ store/
│  │  ├─ services/
│  │  └─ utils/
│  ├─ package.json
│  └─ vite.config.js
├─ server/
│  ├─ config/
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ server.js
│  └─ package.json
└─ README.md
```

## 📌 Notes

- Ensure Gmail App Password and 2FA for email notifications.
- Use a modern browser with WebRTC support (Chrome, Firefox, Safari).
- The landing page now redirects logged-in users to their dashboard.
- The assessment form pre-fills and recommends specializations after
  submission.

This README replaces earlier documentation and should be updated as the
project evolves.
