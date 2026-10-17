const WebSocket = require('ws');
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const axios = require('axios');
const logger = require('../utils/logger');
const chalk = require('chalk');
const http = require('http');
const https = require('https');
const { resolvePublicUrl } = require('./urlSafety');

// Connection state
let validatorId = null;
let wsConnection = null;
let isValidating = true;
let pendingPayouts = 0;
let location = "Unknown";
let lastPingTime = null;

// Fixed value to match hub's COST_PER_VALIDATION
const COST_PER_VALIDATION = 100;

/**
 * Sign a message with the validator's keypair
 * @param {string} message - Message to sign
 * @param {object} keypair - Nacl keypair
 * @returns {string} - JSON stringified signature
 */
const signMessage = (message, keypair) => {
  const messageBytes = naclUtil.decodeUTF8(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return JSON.stringify(Array.from(signature));
};

const getStatusCode = async (input, redirects = 0, method = 'HEAD') => {
  if (redirects > 5) throw new Error('Too many redirects');
  const target = await resolvePublicUrl(input);
  const startedAt = Date.now();
  const protocol = target.url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = protocol.request({
      method,
      hostname: target.url.hostname.replace(/^\[|\]$/g, ''),
      port: target.url.port || undefined,
      path: `${target.url.pathname}${target.url.search}`,
      timeout: 5_000,
      headers: { 'Cache-Control': 'no-cache', Connection: 'close', 'User-Agent': 'dPIN-validator/2' },
      lookup: (hostname, options, callback) => callback(null, target.address, target.family),
    }, async (res) => {
      res.resume();
      try {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          if (!res.headers.location) throw new Error('Redirect is missing a location');
          return resolve(await getStatusCode(new URL(res.headers.location, target.url).toString(), redirects + 1, method));
        }
        if (res.statusCode === 405 && method === 'HEAD') {
          return resolve(await getStatusCode(target.url.toString(), redirects, 'GET'));
        }
        return resolve({ time: Date.now() - startedAt, status: res.statusCode || 0 });
      } catch (error) {
        return reject(error);
      }
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.end();
  });
};

const measureAccurateLatency = async (url) => {
  try {
    return await getStatusCode(url);
  } catch {
    return { time: 0, status: 0 };
  }
};

const signupMessage = (challenge, publicKey) => `dpin:signup:${challenge}:${publicKey}`;
const validationMessage = ({ callbackId, validatorId, status, latency, location }) =>
  JSON.stringify([callbackId, String(validatorId), status, latency, location]);

/**
 * Format latency with appropriate color coding
 * @param {number} latency - Latency in ms
 * @returns {string} - Colorized latency string
 */
const formatLatency = (latency) => {
  if (latency < 50) {
    return chalk.green(`${latency}ms`); // Excellent
  } else if (latency < 100) {
    return chalk.greenBright(`${latency}ms`); // Very good
  } else if (latency < 200) {
    return chalk.yellow(`${latency}ms`); // Good
  } else if (latency < 500) {
    return chalk.yellowBright(`${latency}ms`); // Fair
  } else {
    return chalk.red(`${latency}ms`); // Poor
  }
};

/**
 * Connect to the WebSocket hub server
 * @param {string} privateKeyBase64 - Base64 encoded private key
 * @param {string} hubServer - WebSocket server URL
 * @param {object} spinner - Optional ora spinner for UI feedback
 * @returns {object} - WebSocket connection
 */
const connectWebsocket = async (privateKeyBase64, hubServer, spinner = null) => {
  try {
    // Create keypair from private key
    const privateKeyBytes = naclUtil.decodeBase64(privateKeyBase64);
    const keypair = nacl.sign.keyPair.fromSecretKey(privateKeyBytes);
    const publicKeyBase64 = naclUtil.encodeBase64(keypair.publicKey);
    
    if (spinner) {
      spinner.color = 'cyan';
      spinner.text = 'Connecting to hub server...';
    }
    
    logger.log(`Connecting to ${chalk.magenta.bold(hubServer)}`);
    
    // Create WebSocket connection
    wsConnection = new WebSocket(hubServer);
    
    // Handle WebSocket open event
    wsConnection.on("open", () => {
      if (spinner) {
        spinner.succeed(chalk.greenBright('Connected to WebSocket hub!'));
      } else {
        logger.success("Connected to WebSocket hub!");
      }
      const shortenedKey = publicKeyBase64.substring(0, 12) + '...' + publicKeyBase64.substring(publicKeyBase64.length - 8);
      logger.log(`Public Key: ${chalk.yellowBright(shortenedKey)}`);
      if (spinner) {
        spinner.text = 'Waiting for authentication challenge...';
        spinner.color = 'yellow';
      }
    });
    
    // Handle WebSocket messages
    wsConnection.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'challenge') {
          const challenge = data.data.challenge;
          wsConnection.send(JSON.stringify({
            type: 'signup',
            data: {
              challenge,
              publicKey: publicKeyBase64,
              signedMessage: signMessage(signupMessage(challenge, publicKeyBase64), keypair),
            },
          }));
        } else if (data.type === "signup") {
          validatorId = String(data.data.validatorId);
          location = data.data.location;
          
          // Display styled validator ID
          console.log(chalk.green('\n ┌─────────────────────────────────────┐'));
          console.log(chalk.green(` │       VALIDATOR REGISTERED: ${validatorId.padEnd(10, ' ')} │`));
          console.log(chalk.green(' └─────────────────────────────────────┘\n'));
          
          // Check if pending payouts were included in the signup response
          if (data.data.pendingPayouts !== undefined) {
            pendingPayouts = data.data.pendingPayouts;
            logger.success(`Current rewards: ${chalk.yellowBright(pendingPayouts)} lamports`);
          }
          
          // Show active status message
          console.log(chalk.green(' ✓ ') + chalk.white('Validator is now ') + chalk.green.bold('ACTIVE') + chalk.white(' and ready for validation requests\n'));
        } else if (data.type === 'error') {
          logger.error(`Hub rejected a message: ${data.data?.message || 'Unknown error'}`);
        } else if (data.type === "validate") {
          const { url, callbackId } = data.data;
          logger.ping(`Validating URL: ${chalk.cyan(url)}`);

          try {
            const pingResult = await measureAccurateLatency(url);
            const responseStatus = pingResult.status;
            lastPingTime = Date.now();
            const latency = pingResult.time;
            logger.network(`HTTP latency: ${formatLatency(latency)}`);
            const statusColor = responseStatus >= 200 && responseStatus < 300 ? 
                chalk.green : (responseStatus >= 300 && responseStatus < 400 ? 
                chalk.yellow : chalk.red);
            logger.success(`Response status: ${statusColor(responseStatus || 'unknown')}`);

            const result = {
              callbackId,
              validatorId,
              status: responseStatus > 0 && responseStatus < 400 ? 'Good' : 'Bad',
              latency: responseStatus > 0 ? Math.round(latency) : 0,
              location,
            };
            const signedMessage = signMessage(validationMessage(result), keypair);
            wsConnection.send(JSON.stringify({ type: 'validate', data: { ...result, signedMessage } }));
            pendingPayouts += COST_PER_VALIDATION;
            logger.success(`Rewards: +${COST_PER_VALIDATION} lamports (Total: ${pendingPayouts})`);
          } catch (error) {
            logger.error(`Website check failed: ${error.message}`);
            const result = { callbackId, validatorId, status: 'Bad', latency: 0, location };
            const signedMessage = signMessage(validationMessage(result), keypair);
            wsConnection.send(JSON.stringify({ type: 'validate', data: { ...result, signedMessage } }));
            pendingPayouts += COST_PER_VALIDATION;
          }
        }
      } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
      }
    });
    
    // Handle WebSocket close
    wsConnection.on("close", () => {
      if (isValidating) {
        console.log(chalk.yellow('\n ┌─────────────────────────────────────┐'));
        console.log(chalk.yellow(' │        CONNECTION INTERRUPTED        │'));
        console.log(chalk.yellow(' └─────────────────────────────────────┘\n'));
        
        logger.warn("Reconnecting in 5 seconds...");
        setTimeout(() => connectWebsocket(privateKeyBase64, hubServer), 5000);
      }
    });
    
    // Handle WebSocket errors
    wsConnection.on("error", (error) => {
      logger.error(`WebSocket error: ${error.message}`);
      wsConnection.close();
    });
    
    return wsConnection;
  } catch (error) {
    if (spinner) spinner.fail(`Connection failed: ${error.message}`);
    logger.error(`Failed to connect: ${error.message}`);
    throw error;
  }
};

/**
 * Get the current validator status
 * @returns {object} - Current validator status
 */
const getValidatorStatus = () => {
  return {
    connected: wsConnection && wsConnection.readyState === WebSocket.OPEN,
    validatorId,
    location,
    lastPingTime,
    pendingPayouts
  };
};

/**
 * Stop the validator
 */
const stopValidator = () => {
  isValidating = false;
  if (wsConnection) {
    wsConnection.close();
  }
};

module.exports = { 
  connectWebsocket, 
  getValidatorStatus, 
  stopValidator,
  signMessage
};
