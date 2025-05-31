// utils/retry.js

const retry = async (fn, options = {}) => {
  const {
    retries = 2,      // Lowered from 3 or 4
    delayMs  = 1000,  // Lowered from 1500
    factor   = 2,
    jitter   = true
  } = options;

  let lastError;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`⚡ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        let wait = currentDelay + (jitter ? Math.floor(Math.random() * 300) : 0);
        console.log(`🔁 Retrying in ${wait}ms…`);
        await new Promise(r => setTimeout(r, wait));
        currentDelay *= factor;
      }
    }
  }

  throw lastError;
};

module.exports = { retry };
