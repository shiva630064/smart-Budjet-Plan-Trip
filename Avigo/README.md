# Smart Budget Trip Planner AI

Full-stack startup-level app with authentication, group trip planning, safety features, maps integration, and premium UI.

## Tech stack
- Frontend: React.js + Tailwind + Framer Motion + Axios + React Router
- Backend: Flask (Python)
- DB: SQLite
- APIs: Google Maps Directions + Places

## Setup Backend
1. cd backend
2. python -m venv venv
3. venv\\Scripts\\activate
4. pip install -r requirements.txt
5. Set environment variables in `.env`:
   - `GOOGLE_API_KEY` your key
   - `DB_PATH=tripplanner.db`
6. python app.py

## Setup Frontend
1. cd frontend
2. npm install
3. `.env`:
   - `REACT_APP_API_BASE=http://localhost:5000`
   - `REACT_APP_GOOGLE_API_KEY=<your key>`
4. npm start

## Features
- Signup, OTP, login flows
- Protected `/planner`
- Trip planning with budget split + group logic
- Safety mode for female solo
- Map route embed
- Itinerary + cost breakout + progress style
- Panic button + nearby emergency places

## Notes
- OTP is printed in backend logs in development
- Add real email SMTP for production
- Ensure Google Maps APIs are enabled (Directions, Places)
