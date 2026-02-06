# Swordle Smart Contract

Solana blockchain program for Swordle game.

## Status: ⚠️ TEMPLATE ONLY - NEEDS IMPLEMENTATION

This folder contains the structure and configuration for the smart contract, but the actual Rust code needs to be written.

## What's Included

- ✅ `package.json` - Dependencies
- ✅ `Anchor.toml` - Configuration
- ❌ `programs/swordle/src/lib.rs` - **YOU NEED TO WRITE THIS**
- ❌ `programs/swordle/src/state.rs` - **YOU NEED TO WRITE THIS**
- ❌ `tests/swordle.ts` - **YOU NEED TO WRITE THIS**

## Quick Start

```bash
# Install dependencies
npm install

# Build (will fail until you write the code)
anchor build

# Test (will fail until you write the code)
anchor test
```

## What You Need to Code

See the architecture document from our conversation. You'll need to implement:

1. **State structures** (`state.rs`)
   - Game account
   - PlayerState account
   - All the data structures

2. **Program logic** (`lib.rs`)
   - create_game instruction
   - join_game instruction
   - submit_day_result instruction
   - All the functions

3. **Tests** (`tests/swordle.ts`)
   - Test each instruction
   - Test game flow
   - Test edge cases

## Learning Resources

- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Buildspace Solana Course](https://buildspace.so/)

## For MVP: You Can Skip This!

The smart contract is optional for MVP. You can build the entire game using just the backend database for now, and add blockchain later.

## Next Steps

1. Learn Rust and Solana basics (if you haven't)
2. Follow Anchor tutorial
3. Implement the code based on the architecture
4. Test thoroughly on devnet before mainnet
