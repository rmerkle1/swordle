import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';
import { query } from '../config/database';

// Solana Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    connectionInstance = new Connection(rpcUrl, 'confirmed');
  }
  return connectionInstance;
}

export function getAuthorityKeypair(): Keypair {
  const keypairEnv = process.env.SOLANA_AUTHORITY_KEYPAIR;
  if (!keypairEnv) {
    throw new Error('SOLANA_AUTHORITY_KEYPAIR environment variable is required');
  }

  // Support both base58 and JSON array formats
  try {
    if (keypairEnv.startsWith('[')) {
      const bytes = JSON.parse(keypairEnv);
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    }
    return Keypair.fromSecretKey(bs58.decode(keypairEnv));
  } catch {
    throw new Error('Invalid SOLANA_AUTHORITY_KEYPAIR format (expected base58 or JSON array)');
  }
}

function getSKRMint(): PublicKey {
  const mint = process.env.SKR_TOKEN_MINT || 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
  return new PublicKey(mint);
}

/**
 * Get the $SKR token balance for a player's wallet.
 * Returns 0 if no ATA exists.
 */
export async function getSKRBalance(playerPubkey: string): Promise<number> {
  try {
    const connection = getConnection();
    const owner = new PublicKey(playerPubkey);
    const mint = getSKRMint();
    const ata = await getAssociatedTokenAddress(mint, owner);

    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    // Account doesn't exist or other error — return 0
    return 0;
  }
}

/**
 * Build a serialized transfer instruction: player → treasury ATA.
 * Returns base64-encoded transaction for client signing.
 */
export async function buildEntryFeeTransfer(playerPubkey: string, amount: number): Promise<string> {
  const connection = getConnection();
  const authority = getAuthorityKeypair();
  const mint = getSKRMint();
  const playerKey = new PublicKey(playerPubkey);

  const playerATA = await getAssociatedTokenAddress(mint, playerKey);
  const treasuryATA = await getAssociatedTokenAddress(mint, authority.publicKey);

  const transferIx = createTransferInstruction(
    playerATA,
    treasuryATA,
    playerKey,
    amount,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(transferIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = playerKey;

  return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

/**
 * Submit a signed transaction and confirm it.
 */
export async function submitAndConfirmTx(serializedTx: string): Promise<string> {
  const connection = getConnection();
  const buffer = Buffer.from(serializedTx, 'base64');
  const txSignature = await connection.sendRawTransaction(buffer, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction(txSignature, 'confirmed');
  return txSignature;
}

/**
 * Transfer $SKR from treasury to a player's wallet (e.g., prize payouts).
 */
export async function transferSKRFromTreasury(toPubkey: string, amount: number): Promise<string> {
  const connection = getConnection();
  const authority = getAuthorityKeypair();
  const mint = getSKRMint();
  const toKey = new PublicKey(toPubkey);

  const fromATA = await getAssociatedTokenAddress(mint, authority.publicKey);
  const toATA = await getAssociatedTokenAddress(mint, toKey);

  const transferIx = createTransferInstruction(
    fromATA,
    toATA,
    authority.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(transferIx);
  return await sendAndConfirmTransaction(connection, transaction, [authority]);
}

/**
 * Record a day's move hash on-chain using the Memo program.
 * Stores the tx signature in the games table.
 */
export async function recordDayHash(gameId: number, day: number, movesHash: string): Promise<string> {
  try {
    const connection = getConnection();
    const authority = getAuthorityKeypair();

    const memoText = `SWORDLE:${gameId}:${day}:${movesHash}`;
    const memoIx = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, 'utf-8'),
    });

    const transaction = new Transaction().add(memoIx);
    const txSignature = await sendAndConfirmTransaction(connection, transaction, [authority]);

    // Store tx signature in DB
    await query(
      `UPDATE games SET last_chain_tx = $1,
       chain_tx_history = COALESCE(chain_tx_history, '[]'::jsonb) || $2::jsonb
       WHERE id = $3`,
      [txSignature, JSON.stringify({ day, txSignature, hash: movesHash }), gameId]
    );

    console.log(`Recorded day ${day} hash for game ${gameId}: tx=${txSignature}`);
    return txSignature;
  } catch (err: any) {
    console.error(`Failed to record day hash on-chain for game ${gameId} day ${day}:`, err.message);
    throw err;
  }
}

/**
 * Compute SHA-256 hash of sorted moves for a given day.
 */
export function computeMovesHash(moves: Array<{ game_player_id: number; destination: number; action: string; build_option?: string | null; attack_target?: number | null }>): string {
  const sorted = [...moves].sort((a, b) => a.game_player_id - b.game_player_id);
  const data = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(data).digest('hex');
}
