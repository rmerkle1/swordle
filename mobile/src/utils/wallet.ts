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
