const fs = require("fs-extra");
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
  quiet: true,
  override: false,
});

// Helper: trim whitespace, strip surrounding quotes, normalize
const cleanEnv = (val) => {
  if (val == null) return undefined;
  let s = String(val).trim();
  // Strip matching surrounding quotes (single or double)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
};

// Helper: normalize phone-like values (strip +, spaces, dashes, parens)
const cleanPhone = (val) => {
  const s = cleanEnv(val);
  if (!s) return undefined;
  return s.replace(/[\s\-()+]/g, '');
};

// Helper: parse boolean-like env var ('true', '1', 'yes' → true)
const cleanBool = (val, defaultVal = false) => {
  const s = cleanEnv(val);
  if (s == null) return defaultVal;
  return /^(true|1|yes|on)$/i.test(s);
};

module.exports = {
    MODE: cleanEnv(process.env.MODE),
    SESSION_ID: cleanEnv(process.env.SESSION_ID),
    TIME_ZONE: cleanEnv(process.env.TIME_ZONE),
    AUTO_READ_STATUS: cleanEnv(process.env.AUTO_READ_STATUS),
    AUTO_LIKE_STATUS: cleanEnv(process.env.AUTO_LIKE_STATUS),
    DATABASE_URL: cleanEnv(process.env.DATABASE_URL),
    // New: explicit owner numbers (comma-separated, normalized)
    OWNER_NUMBERS: cleanPhone(process.env.OWNER_NUMBERS),
    // New: public/private mode (defaults to MODE if not set)
    PUBLIC_MODE: cleanEnv(process.env.PUBLIC_MODE),
    // New: pairing phone override
    PAIRING_PHONE: cleanPhone(process.env.PAIRING_PHONE),
    // New: auth method ('session' | 'pairing'); defaults to 'session' when SESSION_ID present
    AUTH_METHOD: cleanEnv(process.env.AUTH_METHOD),
    // New: log level override (default 'info')
    LOG_LEVEL: cleanEnv(process.env.LOG_LEVEL) || 'info',
};

let fileName = require.resolve(__filename);
fs.watchFile(fileName, () => {
    fs.unwatchFile(fileName);
    console.log(`Writing File: ${__filename}`);
    delete require.cache[fileName];
    require(fileName);
});
