/** Messaggio di sfida wallet — modulo puro, condiviso client/server. */
export function walletChallengeMessage(nonce: string, address: string): string {
  return `Maneki: verify wallet ownership\n\nAddress: ${address}\nNonce: ${nonce}\n\nThis signature costs nothing and sends no transaction.`;
}
