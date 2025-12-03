#!/usr/bin/env node
/**
 * Generate RSA key pair for KOauth JWT signing
 * Outputs base64-encoded keys suitable for environment variables
 */

const crypto = require('crypto');

console.log('Generating RSA 2048-bit key pair for KOauth...\n');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Encode as base64 for easy copy-paste to environment variables
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('='.repeat(80));
console.log('Add these to your .env file or docker-compose.yml environment:');
console.log('='.repeat(80));
console.log('\nJWT_PRIVATE_KEY=' + privateKeyBase64);
console.log('\nJWT_PUBLIC_KEY=' + publicKeyBase64);
console.log('\n' + '='.repeat(80));
console.log('\nOr as PEM format (multi-line):');
console.log('='.repeat(80));
console.log('\nJWT_PRIVATE_KEY=');
console.log(privateKey);
console.log('\nJWT_PUBLIC_KEY=');
console.log(publicKey);
console.log('='.repeat(80));
