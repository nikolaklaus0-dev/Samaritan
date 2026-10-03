const { getSetting } = require("./database/settings");

async function getContextInfo(mentionedJid = []) {
    const botName = await getSetting("BOT_NAME") || "𝐊𝐋𝐀𝐔𝐒-𝐗𝐌𝐃";
    const channelJid = await getSetting("NEWSLETTER_JID") || "";
    return {
        mentionedJid,
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            newsletterName: botName,
            serverMessageId: -1
        }
    };
}

module.exports = { getContextInfo };
