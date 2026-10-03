const fs = require("fs-extra");
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
  quiet: true,
  override: false,
});

module.exports = {
    MODE: process.env.MODE,
    SESSION_ID: process.env.SESSION_ID,
    TIME_ZONE: process.env.TIME_ZONE,
    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS,
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS,
    DATABASE_URL: process.env.DATABASE_URL, // Postress(Get one for free from neon.tech/supabase/render/heroku builtin postgress)...will fallback to path: ./gift/database/database.db if not provided
};

let fileName = require.resolve(__filename);
fs.watchFile(fileName, () => {
    fs.unwatchFile(fileName);
    console.log(`Writing File: ${__filename}`);
    delete require.cache[fileName];
    require(fileName);
});
