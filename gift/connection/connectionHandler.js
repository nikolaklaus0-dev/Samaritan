const { Boom } = require("@hapi/boom");
const { DisconnectReason } = require("klaus-baileys");
const fs = require("fs-extra");
const path = require("path");
const { setupGroupCacheListeners } = require("./groupCache");

const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 50;

let reconnectAttempts = 0;

const safeNewsletterFollow = async (Klaus, newsletterJid) => {
    if (!newsletterJid) return false;
    try {
        await Klaus.newsletterFollow(newsletterJid);
        // console.log(`✅ Followed Channel: ${newsletterJid}`);
        return true;
    } catch (error) {
        console.error(
            `❌ Channel follow failed for ${newsletterJid}:`,
            error.message,
        );
        return false;
    }
};

const safeGroupAcceptInvite = async (Klaus, groupJid) => {
    if (!groupJid) return false;
    try {
        await Klaus.groupAcceptInvite(groupJid);
        // console.log(`✅ Joined group: ${groupJid}`);
        return true;
    } catch (error) {
        switch (error.data) {
            case 409:
                console.log(`ℹ️ Already in group: ${groupJid}`);
                break;
            case 400:
                console.log(`⚠️ Invalid invite code for group: ${groupJid}`);
                break;
            case 403:
                console.log(`⚠️ No permission to join group: ${groupJid}`);
                break;
            default:
                console.error(
                    `❌ Group join failed for ${groupJid}:`,
                    error.message,
                );
        }
        return false;
    }
};

const setupConnectionHandler = (
    Klaus,
    sessionDir,
    startKlaus,
    callbacks = {},
) => {
    setupGroupCacheListeners(Klaus);

    Klaus.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting") {
            console.log("🕗 Connecting Bot...");
            reconnectAttempts = 0;
        }

        if (connection === "open") {
            const myJid = Klaus?.user?.id || 'unknown';
            const myPhone = myJid.split(':')[0].split('@')[0];
            console.log(`✅ Connection OPEN — bot is online`);
            console.log(`✅ CONNECTED as ${myPhone} (jid: ${myJid})`);
            reconnectAttempts = 0;

            if (callbacks.onOpen) {
                await callbacks.onOpen(Klaus);
            }
        }

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const reasonName = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === reason) || 'UNKNOWN';
            console.log(`❌ Connection CLOSED — reason code ${reason} (${reasonName})`);
            if (lastDisconnect?.error?.message) {
                console.log(`   error: ${lastDisconnect.error.message}`);
            }

            const handleReconnect = () => {
                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting.`);
                    process.exit(1);
                }
                reconnectAttempts++;
                const delay = Math.min(
                    RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
                    300000,
                );
                console.log(`🕗 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
                setTimeout(() => startKlaus(), delay);
            };

            switch (reason) {
                case DisconnectReason.badSession:
                    console.log(`🔴 SESSION INVALID (badSession 500). The session credentials are corrupt or partial.`);
                    console.log(`🔴 Generate a new SESSION_ID at https://klausxmdpair.pairsite.space`);
                    console.log(`🔴 Update the SESSION_ID env var, then restart.`);
                    try { await fs.remove(sessionDir); } catch (e) {}
                    process.exit(1);
                    break;

                case DisconnectReason.loggedOut:
                    console.log(`🔴 SESSION INVALID (loggedOut 401). WhatsApp revoked the session.`);
                    console.log(`🔴 The owner likely clicked "Log out" in WhatsApp → Linked Devices.`);
                    console.log(`🔴 Generate a new SESSION_ID at https://klausxmdpair.pairsite.space`);
                    console.log(`🔴 Update the SESSION_ID env var, then restart.`);
                    try { await fs.remove(sessionDir); } catch (e) {}
                    process.exit(1);
                    break;

                case DisconnectReason.connectionReplaced:
                    console.log(`🔴 SESSION INVALID (connectionReplaced 440). Another bot instance connected with the SAME session.`);
                    console.log(`🔴 Likely cause: the pair site at klausxmdpair.pairsite.space is STILL POLLING with your creds.`);
                    console.log(`🔴 Or you deployed the bot TWICE (e.g. two Heroku apps, or Heroku + your laptop).`);
                    console.log(`🔴 Fix: visit the pair site and click "Logout" / clear your session there, OR generate a brand new SESSION_ID.`);
                    console.log(`🔴 Then redeploy. Do NOT keep reusing the same SESSION_ID across multiple instances.`);
                    try { await fs.remove(sessionDir); } catch (e) {}
                    process.exit(1);
                    break;

                case DisconnectReason.multideviceMismatch:
                    console.log(`🔴 SESSION INVALID (multideviceMismatch 411). The session was made for a different WhatsApp protocol.`);
                    console.log(`🔴 Generate a new SESSION_ID at https://klausxmdpair.pairsite.space`);
                    try { await fs.remove(sessionDir); } catch (e) {}
                    process.exit(1);
                    break;

                case DisconnectReason.forbidden:
                    console.log(`🔴 SESSION INVALID (forbidden 403). WhatsApp rejected the connection — account may be banned.`);
                    console.log(`🔴 Try logging into the WhatsApp account on a phone first, then generate a new SESSION_ID.`);
                    try { await fs.remove(sessionDir); } catch (e) {}
                    process.exit(1);
                    break;

                case DisconnectReason.connectionClosed:
                case DisconnectReason.connectionLost:
                case DisconnectReason.restartRequired:
                    console.log("🕗 Recoverable disconnect, reconnecting...");
                    handleReconnect();
                    break;

                case DisconnectReason.timedOut:
                    console.log("🕗 Connection timed out, reconnecting...");
                    setTimeout(() => handleReconnect(), RECONNECT_DELAY * 2);
                    break;

                default:
                    console.log(`⚠️  Unknown disconnect reason: ${reason} (${reasonName}), attempting reconnection...`);
                    handleReconnect();
            }
        }
    });
};

module.exports = {
    safeNewsletterFollow,
    safeGroupAcceptInvite,
    setupConnectionHandler,
    RECONNECT_DELAY,
    MAX_RECONNECT_ATTEMPTS,
};
