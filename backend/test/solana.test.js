import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

test('builds a payout transfer with the supported Solana SDK', async () => {
  const payer = await Keypair.generate();
  const restored = await Keypair.fromSecretKey(payer.secretKey);
  const destination = new PublicKey('11111111111111111111111111111111');
  const transaction = new Transaction().add(SystemProgram.transfer({
    fromPubkey: restored.publicKey,
    toPubkey: destination,
    lamports: 1,
  }));

  assert.equal(restored.publicKey.equals(payer.publicKey), true);
  assert.equal(transaction.instructions.length, 1);
});
