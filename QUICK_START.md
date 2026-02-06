# 🚀 QUICK START GUIDE - Get Swordle Running in 30 Minutes

This is the fastest way to get Swordle up and running on your computer for the first time.

## ⚡ Prerequisites (Install These First)

Download and install in this order:

1. **Node.js 18+** - https://nodejs.org/ (Click "LTS" version)
2. **PostgreSQL** - https://www.postgresql.org/download/
3. **Git** - https://git-scm.com/downloads
4. **VS Code** - https://code.visualstudio.com/ (recommended editor)

For mobile development (optional for now):
5. **Xcode** (Mac only, for iOS) - From App Store
6. **Android Studio** (for Android) - https://developer.android.com/studio

## 📦 Step 1: Get the Code

Open your terminal and run:

```bash
# Navigate to where you want the project
cd ~/Documents  # or wherever you keep projects

# You should have received a folder called "swordle-game"
# If you have a zip file, unzip it first

cd swordle-game
```

## 🗄️ Step 2: Set Up Database (5 minutes)

```bash
# Start PostgreSQL (command varies by OS)
# Mac with Homebrew:
brew services start postgresql

# Windows: It should start automatically, or use pgAdmin

# Create the database
createdb swordle_dev

# Load the schema
psql swordle_dev < backend/database/schema.sql

# Verify it worked
psql swordle_dev -c "SELECT 'Database ready!' as status"
```

You should see "Database ready!" - if not, check PostgreSQL is running.

## 🔧 Step 3: Set Up Backend (5 minutes)

```bash
cd backend

# Install dependencies (this takes a few minutes)
npm install

# Create your environment file
cp .env.example .env

# Edit .env file
# On Mac/Linux: nano .env
# On Windows: notepad .env
# Or just open it in VS Code

# Change these values:
# DB_PASSWORD=your_postgres_password
# JWT_SECRET=make_up_a_random_string_here

# Save and close

# Start the backend server
npm run dev
```

You should see:
```
✅ Database connected
🚀 Server running on http://localhost:3000
```

Leave this terminal window open! The server needs to keep running.

## 📱 Step 4: Set Up Mobile App (5 minutes)

Open a **NEW** terminal window:

```bash
cd mobile

# Install dependencies
npm install

# Start the app
npm start
```

You should see a QR code and menu. Press:
- `i` to open iOS simulator (Mac only)
- `a` to open Android emulator
- Or scan QR code with Expo Go app on your phone

The app should open and show the home screen!

## ✅ Step 5: Test It Works

In the mobile app:

1. **Create a test account** - The app will create a test wallet for you
2. **Create a new game** - Tap "Create Game", choose 4 players
3. **You should see** - Game lobby waiting for players

**Success! Swordle is running!** 🎉

## 🎮 Playing Your First Test Game

To test the full game flow, you need 4 players. For testing, you can:

**Option A: Use the API directly (Quick test)**

Open another terminal:

```bash
# Join game as 3 more test players
curl -X POST http://localhost:3000/api/games/1/join \
  -H "Content-Type: application/json" \
  -d '{"fighterClass": "swordsman", "playerPubkey": "TestPlayer2"}'

curl -X POST http://localhost:3000/api/games/1/join \
  -H "Content-Type: application/json" \
  -d '{"fighterClass": "swordsman", "playerPubkey": "TestPlayer3"}'

curl -X POST http://localhost:3000/api/games/1/join \
  -H "Content-Type: application/json" \
  -d '{"fighterClass": "swordsman", "playerPubkey": "TestPlayer4"}'

# Start the game
curl -X POST http://localhost:3000/api/games/1/start \
  -H "Content-Type: application/json"
```

**Option B: Use multiple simulators (Realistic test)**

1. Open 3 more simulators/emulators
2. Run the app on each
3. Join the same game from each

**Option C: Just test the UI**

You can browse the app and test the interface even without a full game.

## 🐛 Common Issues

**"Database connection failed"**
```bash
# Make sure PostgreSQL is running
brew services list  # Mac
# Or check Windows Services

# Restart if needed
brew services restart postgresql
```

**"Port 3000 already in use"**
```bash
# Kill whatever's using port 3000
lsof -ti:3000 | xargs kill  # Mac/Linux
# Windows: Use Task Manager

# Or change port in backend/.env
PORT=3001
```

**"Cannot find module"**
```bash
# Re-install dependencies
cd backend
rm -rf node_modules package-lock.json
npm install

# Same for mobile
cd mobile
rm -rf node_modules package-lock.json
npm install
```

**"iOS simulator not found"**
- You need Xcode installed (Mac only)
- Open Xcode once to accept licenses
- Or use Android instead

**"Android emulator not found"**
- Open Android Studio
- Tools → AVD Manager → Create Virtual Device
- Or use iOS instead

## 📂 Project Structure Quick Reference

```
swordle-game/
├── backend/           # Server (keep this running)
│   ├── src/          # Source code
│   ├── .env          # Your config (don't share this!)
│   └── database/     # Database schema
│
├── mobile/           # App (keep this running too)
│   ├── src/          # App code
│   └── App.tsx       # Main file
│
├── smart-contract/   # Blockchain (not needed for local testing yet)
│   └── programs/     # Solana code
│
└── docs/             # Documentation
    ├── BEGINNER_GUIDE.md    # Detailed explanations
    ├── MVP_GUIDE.md         # What to build next
    └── QUICK_START.md       # This file!
```

## 🎯 What's Next?

Now that everything is running:

1. **Play around** - Explore the app, create games, test features
2. **Read BEGINNER_GUIDE.md** - Understand how everything works
3. **Check MVP_GUIDE.md** - Learn what to build next
4. **Make your first change** - Try modifying something small
5. **Break things** - Best way to learn! You can always restart

## 💾 Saving Your Work

After you make changes:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

## 🔄 Restarting Everything

If you need to restart from scratch:

```bash
# Stop all running servers (Ctrl+C in each terminal)

# Drop and recreate database
dropdb swordle_dev
createdb swordle_dev
psql swordle_dev < backend/database/schema.sql

# Restart backend
cd backend && npm run dev

# Restart mobile (in new terminal)
cd mobile && npm start
```

## 📞 Getting Help

**Stuck?** Check these in order:

1. Read the error message carefully - it usually tells you what's wrong
2. Check the troubleshooting section above
3. Look in `docs/BEGINNER_GUIDE.md` for detailed explanations
4. Google the error message
5. Ask on Discord/Stack Overflow with:
   - What you were trying to do
   - The exact error message
   - What you've already tried

## ✅ Success Checklist

You're ready to start developing when:

- [ ] Backend running at http://localhost:3000
- [ ] Mobile app showing on simulator/emulator
- [ ] Can create a test game in the app
- [ ] No error messages in terminal
- [ ] Database connected successfully

**All checked? Congratulations! You're ready to build Swordle!** 🚀

---

**Estimated time to complete:** 20-30 minutes (excluding downloads)

**Next Steps:**
1. Read `docs/BEGINNER_GUIDE.md` for concepts
2. Read `docs/MVP_GUIDE.md` to start building
3. Explore the code in VS Code
4. Make small changes and see what happens!

**Remember:** It's okay if things break. That's how you learn! You can always reset and try again.
