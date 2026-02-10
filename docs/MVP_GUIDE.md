# MVP Development Guide for Swordle

This guide will walk you through building the Minimum Viable Product (MVP) - the simplest version of Swordle that actually works.

## 🎯 What's in the MVP?

**Included:**
- ✅ 4-player games only
- ✅ Rectangle maps (8x8 grid = 64 squares)
- ✅ Swordsman class only (no special abilities)
- ✅ Basic actions: Move, Attack, Defend
- ✅ Simple combat: Higher weapon tier wins
- ✅ Resource gathering: Chop wood, mine metal
- ✅ Weapon upgrades: Tier 1 → Tier 2 → Tier 3
- ✅ Text-based UI (no fancy graphics yet)

**Not Included (Add Later):**
- ❌ Other fighter classes (Archer, Cavalry, Wizard)
- ❌ Building (walls, traps)
- ❌ Special landmarks (Marketplace, Fortress)
- ❌ Fog of war
- ❌ Storm mechanics
- ❌ Chat system
- ❌ Real money/prizes

## 📋 Step-by-Step Build Process

### Phase 1: Local Testing Setup (Days 1-2)

**Goal:** Get everything running on your computer

1. **Install all tools** (see BEGINNER_GUIDE.md)
2. **Create test Solana wallet:**
   ```bash
   solana-keygen new --outfile ~/.config/solana/test-wallet.json
   solana airdrop 2 --url devnet
   ```

3. **Set up database:**
   ```bash
   createdb swordle_dev
   psql swordle_dev < backend/database/schema.sql
   ```

4. **Start backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env file
   npm run dev
   ```

5. **Start mobile app:**
   ```bash
   cd mobile
   npm install
   npm start
   ```

**✅ Success Criteria:** All three parts running without errors

### Phase 2: Smart Contract Basics (Days 3-5)

**Goal:** Deploy a working smart contract to devnet

**What to build:**
1. Create game function
2. Join game function
3. Submit move function (stores move hash)
4. Process day function (resolves moves)

**Files to work on:**
- `smart-contract/programs/swordle/src/lib.rs`
- `smart-contract/programs/swordle/src/state.rs`
- `smart-contract/tests/swordle.ts`

**Testing:**
```bash
cd smart-contract
anchor test
```

**Deployment:**
```bash
anchor build
anchor deploy --provider.cluster devnet
```

**✅ Success Criteria:** Tests pass, contract deployed to devnet

### Phase 3: Backend Game Logic (Days 6-10)

**Goal:** Process moves and resolve combat

**What to build:**

1. **Game Creation API:**
   - `POST /api/games` - Create 4-player game
   - `GET /api/games` - List available games

2. **Join Game API:**
   - `POST /api/games/:id/join` - Join with Swordsman class

3. **Move Submission API:**
   - `POST /api/moves` - Submit move for the day
   - Validate move is legal (adjacent square, valid action)

4. **Combat Resolver:**
   - Compare weapon tiers
   - Apply damage
   - Update player positions
   - Handle eliminations

5. **Day Processor:**
   - Manual trigger for MVP: `POST /api/admin/process-day`
   - Later: Automated cron job

**Files to work on:**
- `backend/src/controllers/gameController.ts`
- `backend/src/controllers/moveController.ts`
- `backend/src/services/gameEngine.ts`
- `backend/src/services/combatResolver.ts`

**Testing:**
```bash
cd backend
npm test
```

**Manual testing with curl:**
```bash
# Create game
curl -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -d '{"maxPlayers": 4, "mapShape": "rectangle"}'

# Join game
curl -X POST http://localhost:3000/api/games/1/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fighterClass": "swordsman"}'
```

**✅ Success Criteria:** Can create game, join, submit moves, process day

### Phase 4: Mobile App UI (Days 11-15)

**Goal:** Players can play the game from their phones

**What to build:**

1. **Home Screen:**
   - List of available games
   - "Create Game" button
   - "My Active Games" section

2. **Game Screen:**
   - 8x8 grid map
   - Current player position highlighted
   - Available moves shown (adjacent squares)
   - Action buttons (Attack, Defend, Chop, Mine)
   - "Submit Move" button

3. **Player Stats:**
   - Wood count
   - Metal count
   - Weapon tier
   - Current day

4. **Game Log:**
   - "You attacked Fighter #3"
   - "You were eliminated by Fighter #2"
   - "Day 5 processed"

**Files to work on:**
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/GameScreen.tsx`
- `mobile/src/components/GameBoard.tsx`
- `mobile/src/components/PlayerStats.tsx`

**Testing:**
- Run on iOS simulator
- Run on Android emulator
- Test on physical device

**✅ Success Criteria:** Can play a full game from phone

### Phase 5: Integration Testing (Days 16-18)

**Goal:** Everything works together

**Test scenarios:**

1. **4-Player Game:**
   - Create game
   - 4 players join
   - Everyone submits moves for Day 1
   - Process day manually
   - Check combat results
   - Repeat until 1 winner

2. **Resource Gathering:**
   - Player moves to forest
   - Action: Chop
   - Verify wood increases
   - Upgrade weapon with resources
   - Test combat with upgraded weapon

3. **Edge Cases:**
   - Two players attack same square
   - Player attacks, other defends
   - Player doesn't submit move
   - Game ends (1 survivor)

**Create test checklist:**
```
[ ] Can create game
[ ] Can join game
[ ] Can see game board
[ ] Can select adjacent square
[ ] Can choose action
[ ] Can submit move
[ ] Can process day
[ ] Combat resolves correctly
[ ] Resources update
[ ] Weapon upgrades work
[ ] Game ends with winner
[ ] Winner is shown
```

**✅ Success Criteria:** All test scenarios pass

### Phase 6: Polish & Bug Fixes (Days 19-21)

**Goal:** Make it feel like a real game

**Polish items:**
1. Add loading states
2. Add error messages
3. Add success confirmations
4. Improve map visuals
5. Add sound effects (optional)
6. Add animations (optional)

**Bug hunting:**
- Play 10+ games
- Note every bug
- Fix them one by one
- Re-test

**✅ Success Criteria:** Game feels polished and bug-free

## 🔧 Simplified MVP Code Examples

### Example 1: Simple Combat Resolution

```typescript
// backend/src/services/combatResolver.ts (MVP version)

export function resolveCombat(attacker: Player, defender: Player): Player {
  // Simple rule: Higher weapon tier wins
  if (attacker.weaponTier > defender.weaponTier) {
    return attacker;
  } else if (defender.weaponTier > attacker.weaponTier) {
    return defender;
  } else {
    // Same tier: Random
    return Math.random() > 0.5 ? attacker : defender;
  }
}
```

### Example 2: Simple Move Validation

```typescript
// backend/src/utils/validators.ts (MVP version)

export function isValidMove(
  currentPosition: number, 
  destination: number, 
  mapSize: number
): boolean {
  const gridWidth = Math.sqrt(mapSize);
  const currentRow = Math.floor(currentPosition / gridWidth);
  const currentCol = currentPosition % gridWidth;
  const destRow = Math.floor(destination / gridWidth);
  const destCol = destination % gridWidth;
  
  // Can only move to adjacent square (within 1 square)
  const rowDiff = Math.abs(currentRow - destRow);
  const colDiff = Math.abs(currentCol - destCol);
  
  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
}
```

### Example 3: Simple Map Generation

```typescript
// backend/src/services/mapGenerator.ts (MVP version)

export function generateMap(playerCount: number) {
  const mapSize = 64; // 8x8 grid for 4 players
  const tiles: MapTile[] = [];
  
  // Create empty tiles
  for (let i = 0; i < mapSize; i++) {
    tiles.push({
      tileIndex: i,
      tileType: 'empty',
      isTraversable: true,
      isLandmark: false,
    });
  }
  
  // Add 4 forests (randomly placed)
  const forestPositions = [5, 15, 48, 58]; // Or random
  forestPositions.forEach(pos => {
    tiles[pos].tileType = 'forest';
    tiles[pos].isLandmark = true;
  });
  
  // Add 4 mountains (randomly placed)
  const mountainPositions = [10, 20, 43, 53];
  mountainPositions.forEach(pos => {
    tiles[pos].tileType = 'mountain';
    tiles[pos].isLandmark = true;
  });
  
  return tiles;
}
```

## 🎮 Manual Testing Workflow

Since there's no automated daily processing yet, test manually:

1. **Create game:**
   ```bash
   curl -X POST http://localhost:3000/api/games \
     -H "Content-Type: application/json" \
     -d '{"maxPlayers": 4, "mapShape": "rectangle"}'
   ```

2. **Join as 4 players:** Use mobile app or API

3. **Submit moves for Day 1:** All 4 players

4. **Process day manually:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/process-day \
     -H "Content-Type: application/json" \
     -d '{"gameId": 1}'
   ```

5. **Check results:** Query game state

6. **Repeat for Day 2, 3, etc.**

## 📊 MVP Success Metrics

**Before launch, achieve:**
- [ ] 10 complete test games played
- [ ] 0 critical bugs
- [ ] < 3 second load time for game board
- [ ] 100% of moves processed correctly
- [ ] All 4 actions working (move, attack, defend, gather)
- [ ] Weapon upgrades functioning
- [ ] Winner correctly determined

## 🚀 After MVP: Next Features

Once MVP is solid, add features in this order:

1. **Fog of War** - Adds strategy, prevents meta-gaming
2. **Storm Mechanics** - Forces combat, prevents camping
3. **Chat System** - Social interaction
4. **Archer Class** - First special ability
5. **Building (Walls/Traps)** - Defense strategies
6. **Marketplace** - Resource trading
7. **Cavalry & Wizard** - More variety
8. **Automated Daily Processing** - Remove manual step
9. **Leaderboards** - Competitive ranking
10. **Skins & Cosmetics** - Monetization

## 💡 Tips for Success

**Start Small:**
- Don't try to build everything at once
- Get ONE feature working perfectly before moving on

**Test Constantly:**
- After every code change, test it
- Don't accumulate bugs

**Ask for Help:**
- Join Solana Discord
- Post on Stack Overflow
- Read error messages carefully

**Take Breaks:**
- Coding for 12 hours straight = burnout
- 2 hours on, 30 minutes off = sustainable

**Document as You Go:**
- Write down what you learned
- Future you will thank you

## 🆘 Common MVP Problems

**"Game won't start"**
- Check all 4 players joined
- Verify game status in database
- Look at backend logs

**"Moves not processing"**
- Did you call the process-day endpoint?
- Check for errors in game engine
- Verify all players submitted moves

**"Combat not working"**
- Log both players' weapon tiers
- Check combat resolver logic
- Test with simple scenarios first

**"Map not showing"**
- Verify map data in database
- Check API response in network tab
- Ensure mobile app is fetching correctly

## ✅ MVP Completion Checklist

Before you call it "done", make sure:

- [ ] Code is on GitHub
- [ ] README explains how to run it
- [ ] All dependencies listed in package.json
- [ ] Database schema documented
- [ ] Basic tests written
- [ ] Played 10+ full games
- [ ] No known critical bugs
- [ ] Screenshots of gameplay
- [ ] 2-3 friends tested it

**When all boxes are checked: Congratulations! You have a working MVP! 🎉**

## 📚 Next Steps

1. Read `ADVANCED_FEATURES.md` for next features to add
2. Check `DEPLOYMENT.md` when ready to launch
3. See `MONETIZATION.md` for business model ideas

Remember: The MVP doesn't need to be perfect. It needs to WORK. You'll improve it over time!
