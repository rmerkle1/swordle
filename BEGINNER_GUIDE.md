# Beginner's Guide to Swordle Development

This guide assumes you have ZERO experience with game development, blockchain, or mobile apps. We'll explain everything step by step.

## 🎓 Understanding the Big Picture

### What is Swordle?

Swordle is a mobile game where:
- Players control a fighter on a grid map
- Each player makes ONE move per day (like Wordle's one puzzle per day)
- Moves happen simultaneously - no one sees what others are doing until the "day" processes
- Last fighter standing wins

Think of it like:
- **Chess** (strategic, turn-based) + **Battle Royale** (last one standing) + **Wordle** (daily puzzle)

### Why Three Parts? (Smart Contract, Backend, Mobile)

Most apps are just "app + server". Swordle has THREE parts because we're using blockchain:

```
┌─────────────┐
│ MOBILE APP  │  ← What players see and tap on
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  BACKEND    │  ← Processes moves, stores data
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ BLOCKCHAIN  │  ← Ensures fairness, can't be cheated
└─────────────┘
```

**Mobile App (React Native):**
- The interface players use
- Like a web browser for your game
- Runs on iOS and Android phones

**Backend (Node.js):**
- The "brain" that processes all moves
- Stores game data in a database
- Runs once per day to resolve all moves

**Smart Contract (Solana):**
- The "referee" that ensures no cheating
- Stores important data on the blockchain
- Makes the game provably fair

## 🔧 Development Environment Setup

### Part 1: Installing Tools (30 minutes)

**What is each tool for?**

| Tool | What It Does | Why We Need It |
|------|-------------|----------------|
| **Node.js** | Runs JavaScript code on your computer | Backend and mobile app need this |
| **npm** | Installs code libraries (comes with Node.js) | Downloads dependencies |
| **Git** | Tracks code changes | Industry standard for code management |
| **VS Code** | Code editor | Makes coding easier with autocomplete |
| **Rust** | Programming language | Solana smart contracts use Rust |
| **Solana CLI** | Command-line tools for Solana | Deploy and test blockchain code |
| **Anchor** | Framework for Solana | Makes smart contracts easier to write |
| **PostgreSQL** | Database | Stores game data (players, moves, etc.) |

**Installation Order:**

1. **Node.js** - https://nodejs.org/ (Download LTS version)
   - Windows: Run the `.msi` installer
   - Mac: Run the `.pkg` installer
   - Verify: Open terminal, type `node --version`

2. **Git** - https://git-scm.com/
   - Download and install for your OS
   - Verify: `git --version`

3. **VS Code** - https://code.visualstudio.com/
   - Download and install
   - Recommended extensions:
     - Rust Analyzer
     - Solana
     - ESLint
     - Prettier

4. **Rust** - https://rustup.rs/
   - Mac/Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
   - Windows: Download `rustup-init.exe`
   - Verify: `rustc --version`

5. **Solana CLI** - https://docs.solana.com/cli/install-solana-cli-tools
   - Mac/Linux: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
   - Windows: Follow the guide on Solana docs
   - Verify: `solana --version`

6. **Anchor** - https://www.anchor-lang.com/docs/installation
   - After Rust is installed: `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
   - Then: `avm install latest && avm use latest`
   - Verify: `anchor --version`

7. **PostgreSQL** - https://www.postgresql.org/download/
   - Mac: `brew install postgresql` (if you have Homebrew)
   - Windows: Download installer
   - Linux: `sudo apt-get install postgresql`
   - Verify: `psql --version`

### Part 2: Understanding the Code Structure

Each folder has a specific purpose:

```
swordle-game/
│
├── smart-contract/           # Solana blockchain code
│   ├── programs/
│   │   └── swordle/
│   │       └── src/
│   │           ├── lib.rs    # Main program logic
│   │           └── state.rs  # Data structures
│   ├── tests/                # Tests to verify it works
│   └── Anchor.toml           # Configuration
│
├── backend/                  # Server code
│   ├── src/
│   │   ├── controllers/      # Handle API requests
│   │   ├── services/         # Game logic
│   │   ├── routes/           # API endpoints
│   │   └── index.ts          # Main entry point
│   ├── database/
│   │   └── schema.sql        # Database structure
│   └── package.json          # Dependencies list
│
└── mobile/                   # Mobile app code
    ├── src/
    │   ├── screens/          # Different app screens
    │   ├── components/       # Reusable UI pieces
    │   ├── services/         # API calls
    │   └── App.tsx           # Main app file
    └── package.json          # Dependencies list
```

## 🎯 Building Your First Feature

Let's build something simple to understand how everything works.

### Example: Adding a "Health" stat to fighters

**Step 1: Update the Smart Contract**

Open `smart-contract/programs/swordle/src/state.rs`:

```rust
// Find the PlayerState struct and add:
pub health: u8,  // Add this line
```

**Step 2: Update the Database**

Open `backend/database/schema.sql`:

```sql
-- Find the game_players table and add:
health SMALLINT NOT NULL DEFAULT 100,
```

Run: `psql swordle < backend/database/schema.sql`

**Step 3: Update the Backend Types**

Open `backend/src/types/index.ts`:

```typescript
// Find GamePlayer interface and add:
health: number;
```

**Step 4: Update the Mobile App**

Open `mobile/src/types/index.ts`:

```typescript
// Find GamePlayer interface and add:
health: number;
```

**Step 5: Display Health in UI**

Open `mobile/src/components/ui/PlayerStats.tsx`:

```typescript
// Add this line:
<Text>Health: {player.health}</Text>
```

**See how they all connect?** Smart Contract → Database → Backend → Mobile App

## 🧪 Testing Everything

### Testing the Smart Contract

```bash
cd smart-contract
anchor test
```

What this does:
1. Starts a local Solana blockchain (like a mini test version)
2. Deploys your smart contract to it
3. Runs test scenarios to make sure it works
4. Shuts down the test blockchain

If tests pass ✅ - your smart contract works!

### Testing the Backend

```bash
cd backend
npm test
```

This tests:
- API endpoints (can you create a game?)
- Game logic (does combat work correctly?)
- Database queries (can you save/load data?)

### Testing the Mobile App

```bash
cd mobile
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator

The app should open on your simulator. Try clicking around!

## 🐛 Debugging Tips

**"Error: Command not found"**
- You didn't install that tool, or it's not in your PATH
- Re-run the installation for that tool

**"Module not found"**
- You forgot to run `npm install`
- Run it in the folder with the error

**"Port already in use"**
- Something else is using that port
- Kill the process: `lsof -ti:3000 | xargs kill` (Mac/Linux)
- Or change the port in `.env`

**"Database connection failed"**
- PostgreSQL isn't running
- Mac: `brew services start postgresql`
- Check credentials in `.env`

**"Transaction simulation failed"**
- Your smart contract has a bug
- Read the error message carefully
- Check `anchor test` output for details

## 📖 Learning Resources

**Blockchain Basics:**
- [Solana Cookbook](https://solanacookbook.com/) - Recipes for common Solana tasks
- [Anchor Book](https://book.anchor-lang.com/) - Learn Anchor framework

**Backend Development:**
- [Node.js Docs](https://nodejs.org/docs/) - Official documentation
- [Express.js Guide](https://expressjs.com/en/guide/routing.html) - API framework we use

**Mobile Development:**
- [React Native Docs](https://reactnative.dev/docs/getting-started) - Official guide
- [Expo Docs](https://docs.expo.dev/) - Easier way to build React Native apps

**Game Development:**
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) - Common patterns
- [Red Blob Games](https://www.redblobgames.com/) - Grid-based game tutorials

## 🚀 Your Development Workflow

**Daily routine when building features:**

1. **Morning: Plan what to build**
   - Pick ONE small feature
   - Write down what needs to change in each part (smart contract, backend, mobile)

2. **Code the feature**
   - Start with smart contract (the foundation)
   - Then backend (the logic)
   - Finally mobile (the UI)

3. **Test it**
   - Run tests after each change
   - Fix errors immediately, don't let them pile up

4. **Commit your code**
   - `git add .`
   - `git commit -m "Add health stat to fighters"`
   - `git push`

5. **Take breaks!**
   - Coding is mentally exhausting
   - Take a 10-minute break every hour

## 🎯 MVP Development Path

**Week 1: Get everything running**
- Install all tools
- Get smart contract tests passing
- Get backend server running
- Get mobile app showing on simulator

**Week 2: Basic game flow**
- Create a game
- Join a game
- Submit a move
- See the results

**Week 3: Combat system**
- Implement basic attack/defend
- Add weapon tiers
- Test combat scenarios

**Week 4: UI polish**
- Make the map look good
- Add animations
- Improve user experience

**Week 5: Playtesting**
- Test with friends
- Fix bugs
- Improve based on feedback

## 💡 When You Get Stuck

1. **Read the error message** - It usually tells you what's wrong
2. **Google the error** - Someone else has had this problem
3. **Check the docs** - Official documentation is your friend
4. **Ask for help** - Discord communities, Stack Overflow
5. **Take a break** - Sometimes stepping away helps you see the solution

## 🎓 Key Concepts to Understand

**Async/Await** - JavaScript code that waits for things
```javascript
// Without await (bad)
api.getGame();  // This returns a Promise, not the game!

// With await (good)
const game = await api.getGame();  // Now we have the actual game
```

**State Management** - Keeping track of data in your app
```javascript
const [game, setGame] = useState(null);  // game is the data, setGame updates it
```

**API Endpoints** - URLs your backend responds to
```
GET  /api/games     → List all games
POST /api/games     → Create a new game
GET  /api/games/:id → Get one specific game
```

**Database Queries** - Getting data from PostgreSQL
```sql
SELECT * FROM games WHERE id = 1;  -- Get game with id 1
INSERT INTO games (name) VALUES ('My Game');  -- Create new game
```

You don't need to master these immediately, but understanding them helps!

## ✅ Checklist: "Am I Ready to Code?"

Before you start building features, make sure:

- [ ] All tools installed and verified with `--version` commands
- [ ] Can run `anchor test` successfully
- [ ] Can run `npm run dev` in backend folder
- [ ] Can see the app in your simulator
- [ ] Database is created and schema loaded
- [ ] You understand what each folder does
- [ ] VS Code is set up with recommended extensions

If you checked all boxes, you're ready! 🎉

## 🎮 Next: Building Your First Game

Once you're set up, try playing a game:

1. Start the backend: `cd backend && npm run dev`
2. Start the mobile app: `cd mobile && npm start`
3. Create a test game with 4 players
4. Make some moves and see what happens!

Then read `MVP_GUIDE.md` to start building new features.
