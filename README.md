# Swordle Backend

Node.js/Express API server for Swordle game.

## Status: ⚠️ STRUCTURE ONLY - NEEDS IMPLEMENTATION

This folder has the configuration and structure, but the actual TypeScript code needs to be written.

## What's Included

- ✅ `package.json` - All dependencies listed
- ✅ `.env.example` - Environment variable template
- ✅ `database/schema.sql` - Complete database schema (copy/paste ready!)
- ❌ `src/` folder - **YOU NEED TO WRITE THE CODE**

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Create database
createdb swordle_dev
psql swordle_dev < database/schema.sql

# Start server (will fail until you write the code)
npm run dev
```

## What You Need to Code

### Priority 1 (Core API)

1. **`src/index.ts`** - Main server file
   - Set up Express
   - Connect to database
   - Add routes
   - Start server

2. **`src/config/database.ts`** - Database connection
   - Create PostgreSQL pool
   - Export query function

3. **`src/controllers/gameController.ts`** - Game endpoints
   - createGame
   - listGames
   - getGame
   - joinGame
   - startGame

4. **`src/controllers/moveController.ts`** - Move endpoints
   - submitMove
   - getCurrentMove
   - getRevealedMoves

### Priority 2 (Game Logic)

5. **`src/services/mapGenerator.ts`** - Generate maps
   - Create 8x8 grid
   - Place landmarks
   - Return tile array

6. **`src/services/combatResolver.ts`** - Combat logic
   - Compare weapon tiers
   - Determine winner
   - Return result

7. **`src/services/gameEngine.ts`** - Process moves
   - Collect all moves for day
   - Resolve conflicts
   - Update game state
   - Return events

### Priority 3 (Helpers & Tests)

8. **`src/routes/`** - Express routes
9. **`src/utils/validators.ts`** - Input validation
10. **`tests/`** - API tests

## Example Code to Get Started

### src/index.ts (Minimal Example)

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### src/config/database.ts (Minimal Example)

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
```

## Testing

```bash
# Run tests (after you write them)
npm test

# Manual API testing
curl http://localhost:3000/health
```

## Architecture

See `../docs/` for full architecture documentation.

## Learning Resources

- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Node.js](https://node-postgres.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Next Steps

1. Read the full backend architecture from our conversation
2. Start with `src/index.ts` and `src/config/database.ts`
3. Build one endpoint at a time
4. Test each endpoint before moving on
5. Gradually add game logic
