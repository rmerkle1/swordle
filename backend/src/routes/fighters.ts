import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getOwnedFighters, mintFighterNFT, createFighterCollections } from '../services/nftService';

const router = Router();

// GET / — list fighter classes the authenticated player owns NFTs for
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.playerPubkey) {
      res.status(400).json({ error: 'Player pubkey not available' });
      return;
    }

    const fighters = await getOwnedFighters(req.playerPubkey);
    res.json({ fighters });
  } catch (err: any) {
    console.error('Fighters route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /mint — mint a new fighter NFT (admin or unlock-based)
router.post('/mint', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.playerPubkey) {
      res.status(400).json({ error: 'Player pubkey not available' });
      return;
    }

    const { fighterClass } = req.body;
    const validClasses = ['knight', 'archer', 'cavalry', 'mage'];
    if (!fighterClass || !validClasses.includes(fighterClass)) {
      res.status(400).json({ error: 'Valid fighterClass is required (knight, archer, cavalry, mage)' });
      return;
    }

    const mintAddress = await mintFighterNFT(req.playerPubkey, fighterClass);
    res.json({ success: true, mintAddress, fighterClass });
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
