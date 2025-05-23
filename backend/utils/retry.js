const retry = async (fn, options = {}) => {
  const {
    retries = 4,
    delayMs = 1500,
    factor = 2,
    jitter = true
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
        let delayWithJitter = currentDelay;
        if (jitter) {
          delayWithJitter += Math.floor(Math.random() * 300);
        }
        console.log(`🔁 Retrying in ${delayWithJitter}ms...`);
        await new Promise(res => setTimeout(res, delayWithJitter));
        currentDelay *= factor;
      }
    }
  }

  throw lastError;
};

module.exports = { retry };
