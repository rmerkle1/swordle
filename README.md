# Swordle - Daily Strategic Battle Royale

A turn-based strategy game where players control fighters on a grid, making one move per day to outmaneuver opponents and become the last one standing.

## 📁 Project Structure

```
swordle-game/
├── smart-contract/     # Solana blockchain program
├── backend/            # Node.js API server
├── mobile/             # React Native mobile app
└── docs/               # Documentation and guides
```

## 🚀 Quick Start for Beginners

### What You'll Need to Install

Before you start, install these tools on your computer:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)
3. **Visual Studio Code** - [Download here](https://code.visualstudio.com/)
4. **Rust** (for Solana development) - [Install guide](https://www.rust-lang.org/tools/install)
5. **Solana CLI** - [Install guide](https://docs.solana.com/cli/install-solana-cli-tools)
6. **Anchor Framework** - [Install guide](https://www.anchor-lang.com/docs/installation)
7. **PostgreSQL** - [Download here](https://www.postgresql.org/download/)

### Step 1: Check Your Installations

Open your terminal/command prompt and run:

```bash
node --version     # Should show v18.x.x or higher
npm --version      # Should show 9.x.x or higher
git --version      # Should show 2.x.x or higher
solana --version   # Should show 1.17.x or higher
anchor --version   # Should show 0.29.x or higher
psql --version     # Should show PostgreSQL 14.x or higher
```

If any of these commands fail, go back and install that tool.

### Step 2: Set Up the Smart Contract

```bash
cd smart-contract
npm install
anchor build
anchor test
```

If tests pass, you're good! The Solana program is working.

### Step 3: Set Up the Database

```bash
# Start PostgreSQL (this command varies by OS)
# macOS: brew services start postgresql
# Windows: Use pgAdmin or services
# Linux: sudo systemctl start postgresql

# Create database
createdb swordle

# Load schema
psql swordle < backend/database/schema.sql
```

### Step 4: Set Up the Backend

```bash
cd backend
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your settings
# (Open .env in VS Code and fill in the values)

# Start the server
npm run dev
```

The backend should now be running on http://localhost:3000

### Step 5: Set Up the Mobile App

```bash
cd mobile
npm install

# For iOS (Mac only)
cd ios && pod install && cd ..

# Start the app
npm start

# In a new terminal, run on simulator
npm run ios      # For iOS
npm run android  # For Android
```

## 🎮 Testing the Game Locally

Once everything is running:

1. Open the mobile app in your simulator
2. Create a test wallet (the app will guide you)
3. Create a new game (Settings: 4 players, Rectangle map)
4. Open 3 more simulators to join as other players
5. Make moves and test the gameplay!

## 📚 What Each Folder Does

- **smart-contract/** - The blockchain code that ensures fair gameplay and stores game state
- **backend/** - The server that processes moves, manages the database, and runs the daily game updates
- **mobile/** - The app that players use on their phones
- **docs/** - Guides, architecture diagrams, and explanations

## 🆘 Common Problems

**"Command not found"** - You haven't installed that tool yet. Go back to "What You'll Need to Install"

**"Connection refused"** - The backend server isn't running. Make sure you ran `npm run dev` in the backend folder

**"Database does not exist"** - Run `createdb swordle` first

**"Module not found"** - Run `npm install` in that folder

## 🎯 Next Steps

1. Read `docs/BEGINNER_GUIDE.md` for detailed explanations
2. Look at `docs/GAME_MECHANICS.md` to understand how the game works
3. Check `docs/DEVELOPMENT_ROADMAP.md` to see what to build next

## 💬 Getting Help

- Read the docs in the `/docs` folder
- Check the troubleshooting sections in each folder's README
- Look for TODO comments in the code for areas that need work

## 📝 Current Status

This is a **work-in-progress MVP**. Here's what works and what doesn't:

✅ **Working:**
- Game creation and joining
- Move submission
- Basic combat resolution
- Map generation
- Database storage

❌ **Not Yet Implemented:**
- Real money/prizes (kept simple for now)
- All fighter classes (only Swordsman works)
- Advanced features (traps, walls, marketplace)
- Mobile app UI (basic prototype only)
- Daily cron job automation

See `docs/DEVELOPMENT_ROADMAP.md` for the full list.

## 🏗️ Building the MVP

The MVP (Minimum Viable Product) includes:
- 1 fighter class (Swordsman)
- 4-player games only
- Rectangle maps only
- Basic combat (no special abilities)
- Text-based moves (no fancy UI yet)

To build the MVP, follow the guides in `docs/MVP_GUIDE.md`.

## 📄 License

MIT License - See LICENSE file for details
