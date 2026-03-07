import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
  fetchDigitalAssetByMetadata,
  fetchAllDigitalAssetByOwner,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  keypairIdentity,
  publicKey as umiPublicKey,
  type Umi,
} from '@metaplex-foundation/umi';
import { getConnection, getAuthorityKeypair } from './solana';

type FighterClass = 'knight' | 'archer' | 'cavalry' | 'mage';
type FighterColor = 'red' | 'blue' | 'yellow' | 'purple' | 'green';

export interface OwnedFighter {
  fighterClass: FighterClass;
  color?: FighterColor;
}

const COLLECTION_ENV_KEYS: Record<FighterClass, string> = {
  knight: 'KNIGHT_COLLECTION_MINT',
  archer: 'ARCHER_COLLECTION_MINT',
  cavalry: 'CAVALRY_COLLECTION_MINT',
  mage: 'MAGE_COLLECTION_MINT',
};

const COLLECTION_NAMES: Record<FighterClass, string> = {
  knight: 'Swordle Knight',
  archer: 'Swordle Archer',
  cavalry: 'Swordle Cavalry',
  mage: 'Swordle Mage',
};

let umiInstance: Umi | null = null;

function getUmi(): Umi {
  if (!umiInstance) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    umiInstance = createUmi(rpcUrl).use(mplTokenMetadata());

    // Set authority as identity if available
    if (process.env.SOLANA_AUTHORITY_KEYPAIR) {
      try {
        const solanaKeypair = getAuthorityKeypair();
        const umiKeypair = umiInstance.eddsa.createKeypairFromSecretKey(solanaKeypair.secretKey);
        umiInstance = umiInstance.use(keypairIdentity(umiKeypair));
      } catch {
        console.warn('Could not set UMI authority identity');
      }
    }
  }
  return umiInstance;
}

function getCollectionMint(fighterClass: FighterClass): string | undefined {
  return process.env[COLLECTION_ENV_KEYS[fighterClass]];
}

/**
 * Create the 4 fighter collection NFTs (one-time setup).
 * Returns a map of fighter class → collection mint address.
 */
export async function createFighterCollections(): Promise<Record<FighterClass, string>> {
  const umi = getUmi();
  const result: Record<string, string> = {};
  const metadataBaseUrl = process.env.NFT_METADATA_BASE_URL || 'https://swordle.app/metadata';

  for (const fighterClass of ['knight', 'archer', 'cavalry', 'mage'] as FighterClass[]) {
    const existing = getCollectionMint(fighterClass);
    if (existing) {
      result[fighterClass] = existing;
      console.log(`Collection for ${fighterClass} already exists: ${existing}`);
      continue;
    }

    const collectionMint = generateSigner(umi);
    await createNft(umi, {
      mint: collectionMint,
      name: COLLECTION_NAMES[fighterClass],
      uri: `${metadataBaseUrl}/collection-${fighterClass}.json`,
      sellerFeeBasisPoints: { basisPoints: 0n, identifier: '%', decimals: 2 },
      isCollection: true,
    }).sendAndConfirm(umi);

    result[fighterClass] = collectionMint.publicKey.toString();
    console.log(`Created collection for ${fighterClass}: ${result[fighterClass]}`);
    console.log(`Set ${COLLECTION_ENV_KEYS[fighterClass]}=${result[fighterClass]}`);
  }

  return result as Record<FighterClass, string>;
}

/**
 * Mint a fighter NFT to a player's wallet.
 */
export async function mintFighterNFT(
  playerPubkey: string,
  fighterClass: FighterClass,
  playerName?: string,
  color?: FighterColor
): Promise<string> {
  const umi = getUmi();
  const collectionMintStr = getCollectionMint(fighterClass);
  if (!collectionMintStr) {
    throw new Error(`Collection mint not configured for ${fighterClass}. Set ${COLLECTION_ENV_KEYS[fighterClass]}`);
  }

  const metadataBaseUrl = process.env.NFT_METADATA_BASE_URL || 'https://swordle.app/metadata';
  const displayName = playerName || playerPubkey.slice(0, 8);

  // Knights encode color in URI and name; other classes use generic URI
  let nftName: string;
  let nftUri: string;
  if (fighterClass === 'knight' && color) {
    const colorCapitalized = color.charAt(0).toUpperCase() + color.slice(1);
    nftName = `${displayName}'s ${colorCapitalized} Knight`;
    nftUri = `${metadataBaseUrl}/knight-${color}.json`;
  } else {
    nftName = `${displayName}'s ${fighterClass.charAt(0).toUpperCase() + fighterClass.slice(1)}`;
    nftUri = `${metadataBaseUrl}/${fighterClass}.json`;
  }

  const mint = generateSigner(umi);
  await createNft(umi, {
    mint,
    name: nftName,
    uri: nftUri,
    sellerFeeBasisPoints: { basisPoints: 0n, identifier: '%', decimals: 2 },
    collection: { verified: false, key: umiPublicKey(collectionMintStr) },
    tokenOwner: umiPublicKey(playerPubkey),
  }).sendAndConfirm(umi);

  console.log(`Minted ${fighterClass}${color ? `-${color}` : ''} NFT for ${playerPubkey}: ${mint.publicKey.toString()}`);
  return mint.publicKey.toString();
}

/**
 * Verify if a player owns an NFT from the specified fighter class collection.
 * Returns true if the player owns at least one NFT from the collection,
 * or if NFT collections are not configured (graceful degradation).
 */
export async function verifyFighterOwnership(
  playerPubkey: string,
  fighterClass: string
): Promise<boolean> {
  const collectionMintStr = getCollectionMint(fighterClass as FighterClass);
  if (!collectionMintStr) {
    // NFT system not configured — allow all (graceful degradation)
    return true;
  }

  try {
    const umi = getUmi();
    const assets = await fetchAllDigitalAssetByOwner(umi, umiPublicKey(playerPubkey));

    return assets.some((asset) => {
      const collection = asset.metadata.collection;
      if (!collection.__option || collection.__option === 'None') return false;
      const val = collection as { __option: 'Some'; value: { verified: boolean; key: any } };
      return val.value.key.toString() === collectionMintStr && val.value.verified;
    });
  } catch (err: any) {
    console.error(`NFT ownership check failed for ${playerPubkey}:`, err.message);
    // On error, allow access (don't block gameplay due to RPC issues)
    return true;
  }
}

/**
 * Get all fighter NFTs the player owns, with color info for knights.
 */
export async function getOwnedFighters(playerPubkey: string): Promise<OwnedFighter[]> {
  const knightCollectionMint = getCollectionMint('knight');

  // If NFT system is not configured, return all classes as owned (graceful degradation)
  if (!knightCollectionMint) {
    return [
      { fighterClass: 'knight' },
      { fighterClass: 'archer' },
      { fighterClass: 'cavalry' },
      { fighterClass: 'mage' },
    ];
  }

  try {
    const umi = getUmi();
    const assets = await fetchAllDigitalAssetByOwner(umi, umiPublicKey(playerPubkey));
    const owned: OwnedFighter[] = [];
    const seenClasses = new Set<FighterClass>();

    for (const asset of assets) {
      const collection = asset.metadata.collection;
      if (!collection.__option || collection.__option === 'None') continue;
      const val = collection as { __option: 'Some'; value: { verified: boolean; key: any } };
      if (!val.value.verified) continue;

      const collectionKey = val.value.key.toString();

      for (const fighterClass of ['knight', 'archer', 'cavalry', 'mage'] as FighterClass[]) {
        const expectedMint = getCollectionMint(fighterClass);
        if (!expectedMint || collectionKey !== expectedMint) continue;

        if (fighterClass === 'knight') {
          // Parse color from URI: knight-{color}.json
          const uri = asset.metadata.uri;
          const colorMatch = uri.match(/knight-(red|blue|yellow|purple|green)/);
          const color = colorMatch ? colorMatch[1] as FighterColor : undefined;
          owned.push({ fighterClass: 'knight', color });
        } else if (!seenClasses.has(fighterClass)) {
          seenClasses.add(fighterClass);
          owned.push({ fighterClass });
        }
        break;
      }
    }

    return owned;
  } catch (err: any) {
    console.error(`getOwnedFighters failed for ${playerPubkey}:`, err.message);
    // On error, return all classes (don't block gameplay)
    return [
      { fighterClass: 'knight' },
      { fighterClass: 'archer' },
      { fighterClass: 'cavalry' },
      { fighterClass: 'mage' },
    ];
  }
}
