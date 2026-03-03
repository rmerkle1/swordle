import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { mintFighterNFT } from '../services/nftService';

const router = Router();

// In-memory nonce store with TTL
const nonces = new Map<string, { pubkey: string; expires: number }>();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, entry] of nonces) {
    if (entry.expires < now) nonces.delete(nonce);
  }
}, 60_000);

// POST /challenge — request a sign-in challenge
router.post('/challenge', (req: Request, res: Response) => {
  const { pubkey } = req.body;
  if (!pubkey || typeof pubkey !== 'string') {
    res.status(400).json({ error: 'pubkey is required' });
    return;
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  nonces.set(nonce, { pubkey, expires: Date.now() + NONCE_TTL_MS });

  const message = `Sign in to Swordle: ${nonce}`;
  res.json({ message, nonce });
});

// POST /verify — verify signature and issue JWT
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { pubkey, signature, nonce } = req.body;
    if (!pubkey || !signature || !nonce) {
      res.status(400).json({ error: 'pubkey, signature, and nonce are required' });
      return;
    }

    // Look up nonce
    const entry = nonces.get(nonce);
    if (!entry) {
      res.status(401).json({ error: 'Invalid or expired nonce' });
      return;
    }

    if (entry.expires < Date.now()) {
      nonces.delete(nonce);
      res.status(401).json({ error: 'Nonce expired' });
      return;
    }

    if (entry.pubkey !== pubkey) {
      res.status(401).json({ error: 'Pubkey mismatch' });
      return;
    }

    // Delete nonce (one-time use)
    nonces.delete(nonce);

    // Reconstruct message and verify Ed25519 signature
    const message = `Sign in to Swordle: ${nonce}`;
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signature, 'base64');
    const pubkeyBytes = bs58.decode(pubkey);

    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!valid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Check if player already exists
    const existingPlayer = await query('SELECT id FROM players WHERE pubkey = $1', [pubkey]);
    const isNewPlayer = existingPlayer.rows.length === 0;

    // Upsert player
    const upsertRes = await query(
      `INSERT INTO players (pubkey, username)
       VALUES ($1, $2)
       ON CONFLICT (pubkey) DO UPDATE SET last_seen = NOW()
       RETURNING *`,
      [pubkey, pubkey.slice(0, 8)]
    );
    const player = upsertRes.rows[0];

    // Ensure player_stats row exists
    await query(
      `INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [player.id]
    );

    // Mint free starter knight NFT for new players
    if (isNewPlayer && process.env.KNIGHT_COLLECTION_MINT) {
      try {
        await mintFighterNFT(pubkey, 'knight', player.username);
        console.log(`Minted starter knight NFT for new player ${pubkey}`);
      } catch (nftErr: any) {
        console.error(`Failed to mint starter NFT for ${pubkey}:`, nftErr.message);
        // Don't block registration if NFT mint fails
      }
    }

    // Sign JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' });
      return;
    }

    const token = jwt.sign({ pubkey, playerId: player.id }, secret, { expiresIn: '7d' });

    const today = new Date().toISOString().slice(0, 10);
    const lastDate = player.last_game_date instanceof Date
      ? player.last_game_date.toISOString().slice(0, 10)
      : player.last_game_date;
    const gamesToday = lastDate === today ? (player.games_today ?? 0) : 0;

    res.json({
      token,
      player: {
        id: String(player.id),
        name: player.username,
        pubkey: player.pubkey,
        coins: player.coins ?? 1000,
        gamesToday,
      },
    });
  } catch (err: any) {
    console.error('Auth verify error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
