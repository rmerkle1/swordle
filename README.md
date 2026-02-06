# Swordle Mobile App

React Native mobile application for Swordle game.

## Status: ⚠️ STRUCTURE ONLY - NEEDS IMPLEMENTATION

This folder has the configuration, but the actual React Native components need to be written.

## What's Included

- ✅ `package.json` - All dependencies listed
- ❌ `src/` folder - **YOU NEED TO WRITE THE CODE**
- ❌ `App.tsx` - **YOU NEED TO WRITE THIS**

## Quick Start

```bash
# Install dependencies
npm install

# Start Expo (will fail until you write code)
npm start

# Then press:
# i - iOS simulator
# a - Android emulator
# w - Web browser
```

## What You Need to Code

### Priority 1 (Core Screens)

1. **`App.tsx`** - Main app entry point
   - Set up navigation
   - Set up global state
   - Add providers

2. **`src/screens/HomeScreen.tsx`** - Main menu
   - List available games
   - "Create Game" button
   - "My Games" section

3. **`src/screens/GameScreen.tsx`** - Playing a game
   - Show game board
   - Display player stats
   - Move selector
   - Submit button

### Priority 2 (UI Components)

4. **`src/components/GameBoard.tsx`** - Map grid
   - Render 8x8 grid
   - Show landmarks
   - Highlight current position

5. **`src/components/TileCell.tsx`** - Individual tile
   - Show tile type (forest, mountain, empty)
   - Show fighter if present
   - Handle tap

6. **`src/components/MoveSelector.tsx`** - Choose move
   - Select destination
   - Pick action (attack, defend, etc.)
   - Validation

7. **`src/components/PlayerStats.tsx`** - Resource display
   - Wood count
   - Metal count
   - Weapon tier

### Priority 3 (Services)

8. **`src/services/api.ts`** - API client
   - All API calls
   - Error handling

9. **`src/hooks/useGame.ts`** - Game state management
   - Fetch game data
   - Update game state
   - WebSocket connection

## Example Code to Get Started

### App.tsx (Minimal Example)

```typescript
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Swordle</Text>
      <Text>Game goes here!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
});
```

### src/services/api.ts (Minimal Example)

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const api = {
  getGames: async () => {
    const response = await axios.get(`${API_URL}/games`);
    return response.data;
  },
  
  createGame: async (maxPlayers: number) => {
    const response = await axios.post(`${API_URL}/games`, {
      maxPlayers,
      mapShape: 'rectangle',
    });
    return response.data;
  },
};
```

## Testing

```bash
# Start the app
npm start

# On iOS
npm run ios

# On Android
npm run android

# On Web (for quick testing)
npm run web
```

## Architecture

See `../docs/` for full mobile architecture documentation.

## Learning Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)

## Common Issues

**"Unable to resolve module"**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm start --reset-cache
```

**"iOS build failed"**
- Make sure Xcode is installed
- Accept Xcode license: `sudo xcodebuild -license accept`

**"Android emulator not found"**
- Open Android Studio
- Tools → AVD Manager
- Create a virtual device

## Next Steps

1. Read the full mobile architecture from our conversation
2. Start with `App.tsx` - get something showing on screen
3. Build one screen at a time
4. Connect to backend API
5. Add game logic
6. Polish UI
