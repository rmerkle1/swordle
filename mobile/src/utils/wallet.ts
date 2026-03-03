import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import type { AppIdentity } from '@solana-mobile/mobile-wallet-adapter-protocol';

export const APP_IDENTITY: AppIdentity = {
  name: 'Swordle',
  uri: 'https://swordle.app',
  icon: 'favicon.ico',
};

/**
 * Opens MWA, authorizes with the wallet, and returns the base58 address + auth token.
 */
export async function authorizeWallet(): Promise<{ address: string; authToken: string }> {
  const result = await transact(async (wallet) => {
    const auth = await wallet.authorize({
      cluster: 'devnet',
      identity: APP_IDENTITY,
    });
    return auth;
  });

  // result.accounts[0].address is base64-encoded — convert to base58 via PublicKey
  const base64Addr = result.accounts[0].address;
  const pubkeyBytes = Buffer.from(base64Addr, 'base64');
  const address = new PublicKey(pubkeyBytes).toBase58();

  return { address, authToken: result.auth_token };
}

/**
 * Sign an authentication message via MWA (for Sign-In with Solana).
 * Returns the signature as a base64 string.
 */
export async function signAuthMessage(message: string, authToken: string): Promise<string> {
  const msgBytes = new TextEncoder().encode(message);

  const result = await transact(async (wallet) => {
    await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });

    const signed = await wallet.signMessages({
      addresses: [], // uses the authorized account
      payloads: [msgBytes],
    });

    return signed;
  });

  // result[0] is the signature bytes — convert to base64
  return Buffer.from(result[0]).toString('base64');
}

/**
 * Sign a Solana transaction via MWA (for $SKR transfers, etc.).
 * Takes a base64-encoded serialized transaction, returns base64-encoded signed transaction.
 */
export async function signTransaction(serializedTx: string, authToken: string): Promise<string> {
  const txBytes = Buffer.from(serializedTx, 'base64');

  const result = await transact(async (wallet) => {
    await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });

    const signed = await wallet.signTransactions({
      payloads: [txBytes],
    });

    return signed;
  });

  return Buffer.from(result[0]).toString('base64');
}

/**
 * Deauthorizes the given auth token with the wallet.
 */
export async function deauthorizeWallet(authToken: string): Promise<void> {
  await transact(async (wallet) => {
    await wallet.deauthorize({ auth_token: authToken });
  });
}

/**
 * Truncates a base58 address for display: "AbCd...WxYz"
 */
export function truncateAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
