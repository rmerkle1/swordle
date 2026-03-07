import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getOwnedFighters, mintFighterNFT, createFighterCollections } from '../services/nftService';
import { query } from '../config/database';

const router = Router();

type FighterClass = 'knight' | 'archer' | 'cavalry' | 'mage';

const UNLOCK_THRESHOLDS: Record<FighterClass, number> = {
  knight: 0,
  archer: 1,
  mage: 5,
  cavalry: 10,
};

// GET / — list owned fighters, mintable classes, and win count
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.playerPubkey) {
      res.status(400).json({ error: 'Player pubkey not available' });
      return;
    }

    const owned = await getOwnedFighters(req.playerPubkey);

    // Get player wins
    const statsRes = await query(
      'SELECT wins FROM player_stats WHERE player_id = $1',
      [req.playerId]
    );
    const wins = statsRes.rows.length > 0 ? statsRes.rows[0].wins : 0;

    // Compute mintable classes: wins >= threshold and not already owned
    const ownedClasses = new Set(owned.map((f) => f.fighterClass));
    const mintable: FighterClass[] = [];
    for (const [cls, threshold] of Object.entries(UNLOCK_THRESHOLDS) as [FighterClass, number][]) {
      if (wins >= threshold && !ownedClasses.has(cls)) {
        mintable.push(cls);
      }
    }

    res.json({ owned, mintable, wins });
  } catch (err: any) {
    console.error('Fighters route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /mint — mint a new fighter NFT (unlock-based with wins validation)
router.post('/mint', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.playerPubkey) {
      res.status(400).json({ error: 'Player pubkey not available' });
      return;
    }

    const { fighterClass, color } = req.body;
    const validClasses = ['knight', 'archer', 'cavalry', 'mage'];
    if (!fighterClass || !validClasses.includes(fighterClass)) {
      res.status(400).json({ error: 'Valid fighterClass is required (knight, archer, cavalry, mage)' });
      return;
    }

    // Check wins requirement
    const statsRes = await query(
      'SELECT wins FROM player_stats WHERE player_id = $1',
      [req.playerId]
    );
    const wins = statsRes.rows.length > 0 ? statsRes.rows[0].wins : 0;
    const threshold = UNLOCK_THRESHOLDS[fighterClass as FighterClass];
    if (wins < threshold) {
      res.status(403).json({
        error: `Need ${threshold} wins to unlock ${fighterClass} (you have ${wins})`,
      });
      return;
    }

    // For knights, accept optional color (random if not specified)
    const validColors = ['red', 'blue', 'yellow', 'purple', 'green'];
    const knightColor = fighterClass === 'knight'
      ? (color && validColors.includes(color) ? color : validColors[Math.floor(Math.random() * validColors.length)])
      : undefined;

    const mintAddress = await mintFighterNFT(req.playerPubkey, fighterClass, undefined, knightColor);
    res.json({ success: true, mintAddress, fighterClass, color: knightColor });
  } catch (err: any) {
    console.error('Mint fighter error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to mint fighter NFT' });
  }
});

// POST /mint-starter — mint free knight NFT for new players
router.post('/mint-starter', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.playerPubkey) {
      res.status(400).json({ error: 'Player pubkey not available' });
      return;
    }

    const playerName = req.body.playerName || req.playerPubkey.slice(0, 8);
    const mintAddress = await mintFighterNFT(req.playerPubkey, 'knight', playerName);
    res.json({ success: true, mintAddress, fighterClass: 'knight' });
  } catch (err: any) {
    console.error('Mint starter error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to mint starter NFT' });
  }
});

// POST /setup-collections — one-time setup to create collection NFTs (admin only)
router.post('/setup-collections', async (req: Request, res: Response) => {
  try {
    const collections = await createFighterCollections();
    res.json({ success: true, collections });
  } catch (err: any) {
    console.error('Setup collections error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create collections' });
  }
});

export default router;
