require("events").EventEmitter.defaultMaxListeners = 960;

// ──────────────────────────────────────────────────────────────────────
// Top-of-file: install process error handlers BEFORE any other require
// so we never miss an unhandled rejection during startup.
// ──────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error('════════════════════════════════════════════════════════');
    console.error('🚨 UNHANDLED REJECTION at:', promise);
    console.error('🚨 Reason:', reason?.stack || reason?.message || reason);
    console.error('🚨 Continuing to run, but this likely indicates a bug.');
    console.error('════════════════════════════════════════════════════════');
});
process.on('uncaughtException', (err) => {
    console.error('════════════════════════════════════════════════════════');
    console.error('🚨 UNCAUGHT EXCEPTION:', err?.stack || err?.message || err);
    console.error('🚨 Bot will exit in 3s to let Heroku restart the dyno cleanly.');
    console.error('════════════════════════════════════════════════════════');
    setTimeout(() => process.exit(1), 3000);
});

// Loud structured startup log — appears at the very top of `heroku logs`
console.log('');
console.log('════════════════════════════════════════════════════════');
console.log(`🟢 KLAUS-XMD booting at ${new Date().toISOString()}`);
console.log(`🟢 Node version: ${process.version}`);
console.log(`🟢 Platform:    ${process.platform} ${process.arch}`);
console.log(`🟢 Memory cap:  ${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)} MB heap`);
console.log(`🟢 Process PID: ${process.pid}`);
console.log(`🟢 Working dir: ${process.cwd()}`);
// Log which env var NAMES are set — NEVER log values (especially SESSION_ID)
const envVarNames = Object.keys(process.env).filter(k =>
    !k.toLowerCase().includes('secret') &&
    !k.toLowerCase().includes('token') &&
    !k.toLowerCase().includes('password') &&
    !k.toLowerCase().includes('key')
);
console.log(`🟢 Env vars set: ${envVarNames.join(', ') || '(none)'}`);
console.log('════════════════════════════════════════════════════════');
console.log('');

// Watchdog: if the socket hasn't reached "open" within 90s, log WHY.
let socketOpened = false;
let bootStartTime = Date.now();
const watchdog = setTimeout(() => {
    if (socketOpened) return;
    const elapsed = Math.round((Date.now() - bootStartTime) / 1000);
    console.error('════════════════════════════════════════════════════════');
    console.error(`🔴 WATCHDOG: socket has NOT reached "open" within ${elapsed}s`);
    console.error('🔴 Most likely causes (in order):');
    console.error('   1. SESSION_ID is invalid or expired → generate a new one at');
    console.error('      https://klausxmdpair.pairsite.space');
    console.error('   2. The pair site is still polling with your creds → log it out');
    console.error('      there first, then redeploy');
    console.error('   3. Heroku IP blocked by WhatsApp → try a VPS deploy');
    console.error('   4. Bad build — check the build logs for missing native modules');
    console.error('   5. Database connection hung → check DATABASE_URL or fall back to SQLite');
    console.error('🔴 The process is still alive but the socket is stuck. Will keep waiting.');
    console.error('════════════════════════════════════════════════════════');
}, 90000);
// Allow the process to stay alive even if the express server is the only thing running
watchdog.unref();

require("./gift/gmdHelpers");

const {
    default: klausConnect,
    isJidGroup,
    jidNormalizedUser,
    isJidBroadcast,
    downloadMediaMessage,
    downloadContentFromMessage,
    getContentType,
    fetchLatestWaWebVersion,
} = require("klaus-baileys");

const {
    evt,
    logger,
    emojis,
    commands,
    setSudo,
    delSudo,
    KlausTechApi,
    KlausApiKey,
    KlausAutoReact,
    KlausAntiLink,
    KlausAntibad,
    KlausAntiGroupMention,
    KlausAutoBio,
    handleGameMessage,
    KlausChatBot,
    loadSession,
    useSQLiteAuthState,
    getMediaBuffer,
    getSudoNumbers,
    getFileContentType,
    bufferToStream,
    uploadToPixhost,
    uploadToImgBB,
    setCommitHash,
    getCommitHash,
    gmdBuffer,
    gmdJson,
    formatAudio,
    formatVideo,
    toAudio,
    uploadToGithubCdn,
    uploadToKlausCdn,
    uploadToCatbox,
    KlausAnticall,
    createContext,
    createContext2,
    verifyJidState,
    KlausPresence,
    KlausAntiDelete,
    KlausAntiEdit,
    syncDatabase,
    initializeSettings,
    initializeGroupSettings,
    getAllSettings,
    DEFAULT_SETTINGS,
    standardizeJid,
    serializeMessage,
    loadPlugins,
    findCommand,
    findBodyCommand,
    createHelpers,
    getGroupInfo,
    buildSuperUsers,
    getGroupMetadata,
    createSocketConfig,
    safeNewsletterFollow,
    safeGroupAcceptInvite,
    setupConnectionHandler,
    setupGroupEventsListeners,
    initializeLidStore,
} = require("./gift");

const {
    saveAntiDelete,
    findAntiDelete,
    removeAntiDelete,
    startCleanup,
    SQLiteStore,
} = require('./gift/database/messageStore');

const config = require("./config");
const googleTTS = require("google-tts-api");
const fs = require("fs-extra");
const path = require("path");
const axios = require('axios');
const express = require("express");

/**
 * Resolves any JID to a real phone JID (@s.whatsapp.net).
 * Returns the original jid unchanged if it is already a real JID.
 * Returns null only when jid itself is null/undefined.
 * When a LID cannot be resolved it returns the original LID as a best-effort
 * fallback so the operation still fires rather than being silently skipped.
 */
async function resolveRealJid(Klaus, jid) {
    if (!jid) return null;
    if (!jid.endsWith('@lid')) return jid;   // already real
    try {
        const { getLidMapping } = require('./gift/connection/groupCache');
        const cached = getLidMapping(jid);
        if (cached) return cached;
    } catch (_) {}
    try {
        const resolved = await Klaus.getJidFromLid(jid);
        if (resolved && !resolved.endsWith('@lid')) return resolved;
    } catch (_) {}
    try {
        const { getLidMappingFromDb } = require('./gift/database/lidMapping');
        const fromDb = await getLidMappingFromDb(jid);
        if (fromDb) return fromDb;
    } catch (_) {}
    return jid;   // best effort — return original LID so the operation still fires
}

const { SESSION_ID: sessionId } = config;
const PORT = process.env.PORT || 5000;
const app = express();
let Klaus;
let store;

logger.level = "silent";
app.use(express.static("gift"));
app.get("/", (req, res) => res.sendFile(__dirname + "/gift/klaus.html"));
app.get("/health", (req, res) =>
    res.status(200).json({ status: "alive", uptime: process.uptime() }),
);
app.listen(PORT, () => console.log(`✅ Server Running on Port: ${PORT}`));

setInterval(() => {
    const used = process.memoryUsage();
    if (used.heapUsed > 400 * 1024 * 1024) {
        if (global.gc) global.gc();
    }
}, 60000);

setInterval(async () => {
    try {
        const http = require("http");
        http.get(`http://localhost:${PORT}/health`, () => {});
    } catch (e) {}
}, 240000);

const sessionDir = path.join(__dirname, "gift", "session");
const pluginsPath = path.join(__dirname, "klaus");

let botSettings = {};
async function loadBotSettings() {
    await syncDatabase();
    await initializeSettings();
    await initializeGroupSettings();
    botSettings = await getAllSettings();
    return botSettings;
}

startCleanup();

async function startKlaus() {
    try {
        const { version } = await fetchLatestWaWebVersion();
        const sessionDbPath = path.join(sessionDir, "session.db");
        const { state, saveCreds } = await useSQLiteAuthState(sessionDbPath);

        if (store) store.destroy();
        store = new SQLiteStore();

        const socketConfig = createSocketConfig(version, state, logger);
        socketConfig.getMessage = async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return { conversation: "Error occurred" };
        };

        Klaus = klausConnect(socketConfig);
        store.bind(Klaus.ev);

        Klaus.ev.process(async (events) => {
            if (events["creds.update"]) await saveCreds();
        });

        setupAutoReact(Klaus);
        setupAntiDelete(Klaus);
        setupAutoBio(Klaus);
        setupAntiCall(Klaus);
        setupNewsletterReact(Klaus);
        setupPresence(Klaus);
        setupChatBotAndAntiLink(Klaus);
        setupAntiEdit(Klaus);
        setupStatusHandlers(Klaus);
        setupGroupEventsListeners(Klaus);

        loadPlugins(pluginsPath);

        setupCommandHandler(Klaus);

        setupConnectionHandler(Klaus, sessionDir, startKlaus, {
            onOpen: async (Klaus) => {
                const s = await getAllSettings();
                await safeNewsletterFollow(Klaus, s.NEWSLETTER_JID);
                await safeGroupAcceptInvite(Klaus, s.GC_JID);
                await initializeLidStore(Klaus);

                setTimeout(async () => {
                    try {
                        const totalCommands = commands.filter(
                            (c) => c.pattern && !c.dontAddCommandList,
                        ).length;
                        // Mark watchdog as satisfied
                        socketOpened = true;
                        const myPhone = Klaus.user.id.split(':')[0].split('@')[0];
                        console.log(`💜 Connected to WhatsApp, Active!`);
                        console.log(`💜 Bot phone: ${myPhone}`);
                        console.log(`💜 Bot JID:   ${Klaus.user.id}`);

                        // Always send a confirmation message to the first owner number.
                        // This is the "I'm alive" signal the user wants on Heroku deploy.
                        try {
                            const ownerNumber = (s.OWNER_NUMBER || DEFAULT_SETTINGS.OWNER_NUMBER || '').replace(/\D/g, '');
                            const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : Klaus.user.id;
                            const now = new Date();
                            const tz = s.TIME_ZONE || DEFAULT_SETTINGS.TIME_ZONE || 'Africa/Nairobi';
                            const localTime = now.toLocaleString('en-GB', { timeZone: tz, hour12: false });
                            const confirmMsg = `🟢 ${s.BOT_NAME || 'KLAUS-XMD'} connected on Heroku\n\nTime: ${localTime} (${tz})\nPhone: ${myPhone}\nPlugins: ${totalCommands}\nPrefix: ${s.PREFIX || DEFAULT_SETTINGS.PREFIX}\nMode: ${s.MODE === 'private' ? 'private' : 'public'}\n\n> ${s.FOOTER || DEFAULT_SETTINGS.FOOTER}`;
                            await Klaus.sendMessage(ownerJid, { text: confirmMsg });
                            console.log(`✅ Sent "connected on Heroku" confirmation to ${ownerJid}`);
                        } catch (e) {
                            console.error(`⚠️  Could not send confirmation message: ${e.message}`);
                        }

                        if (s.STARTING_MESSAGE === "true") {
                            const d = DEFAULT_SETTINGS;
                            const md =
                                s.MODE === "public" ? "public" : "private";
                            const connectionMsg = `
*${s.BOT_NAME || d.BOT_NAME} 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃*

𝐏𝐫𝐞𝐟𝐢𝐱       : *[ ${s.PREFIX || d.PREFIX} ]*
𝐏𝐥𝐮𝐠𝐢𝐧𝐬      : *${totalCommands}*
𝐌𝐨𝐝𝐞        : *${md}*
𝐎𝐰𝐧𝐞𝐫       : *${s.OWNER_NUMBER || d.OWNER_NUMBER}*
𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥𝐬     : *${s.YT || d.YT}*
𝐔𝐩𝐝𝐚𝐭𝐞𝐬      : *${s.NEWSLETTER_URL || d.NEWSLETTER_URL}*

𝐍𝐨𝐭𝐞:  Bot may take some few seconds/minutes to sync before being ready to use.

> *${s.CAPTION || d.CAPTION}*`;

                            await Klaus.sendMessage(
                                Klaus.user.id,
                                {
                                    text: connectionMsg,
                                    ...(await createContext(
                                        s.BOT_NAME || d.BOT_NAME,
                                        {
                                            title: "BOT INTEGRATED",
                                            body: "Status: Ready for Use",
                                        },
                                    )),
                                },
                                {
                                    disappearingMessagesInChat: true,
                                    ephemeralExpiration: 300,
                                },
                            );
                        }
                    } catch (err) {
                        console.error("Post-connection setup error:", err);
                    }
                }, 5000);
            },
        });

        // SIGTERM / SIGINT handlers — Heroku sends SIGTERM to shut down dynos.
        // We must call Klaus.end() to cleanly close the WebSocket AND call
        // process.exit() so Heroku doesn't SIGKILL us.
        const shutdown = async (signal) => {
            console.log(`📵 Received ${signal}, shutting down...`);
            try {
                if (Klaus?.end) await Klaus.end();
                if (store?.destroy) await store.destroy();
            } catch (e) {
                console.error('Shutdown error:', e.message);
            }
            console.log(`✅ Shutdown complete, exiting.`);
            process.exit(0);
        };
        process.on("SIGINT", () => shutdown('SIGINT'));
        process.on("SIGTERM", () => shutdown('SIGTERM'));
    } catch (error) {
        console.error("════════════════════════════════════════════════════════");
        console.error("🔴 Socket initialization error:", error?.stack || error?.message || error);
        console.error("🔴 Will retry in 5s. Heroku will see this as a soft failure.");
        console.error("════════════════════════════════════════════════════════");
        setTimeout(() => startKlaus(), 5000);
    }
}

function setupAutoReact(Klaus) {
    Klaus.ev.on("messages.upsert", async (mek) => {
        try {
            const ms = mek.messages[0];
            const s = await getAllSettings();
            const autoReactMode = s.AUTO_REACT || "off";

            if (
                autoReactMode === "off" ||
                autoReactMode === "false" ||
                ms.key.fromMe ||
                !ms.message
            )
                return;

            const from = ms.key.remoteJid;
            const isGroup = from?.endsWith("@g.us");
            const isDm = from?.endsWith("@s.whatsapp.net");

            let shouldReact = false;
            if (autoReactMode === "all" || autoReactMode === "true") {
                shouldReact = true;
            } else if (autoReactMode === "dm" && isDm) {
                shouldReact = true;
            } else if (autoReactMode === "groups" && isGroup) {
                shouldReact = true;
            }

            if (!shouldReact) return;

            const randomEmoji =
                emojis[Math.floor(Math.random() * emojis.length)];
            await KlausAutoReact(randomEmoji, ms, Klaus);
        } catch (err) {
            console.error("Error during auto reaction:", err);
        }
    });
}

function setupAntiDelete(Klaus) {
    const botJid = `${Klaus.user?.id.split(":")[0]}@s.whatsapp.net`;
    const botOwnerJid = botJid;

    const getSender = (ms) => {
        const key = ms.key;
        const realJid = (j) => j && !j.endsWith('@lid') ? j : null;
        return (
            realJid(key.participantPn) ||
            realJid(key.senderPn) ||
            realJid(ms.senderPn) ||
            realJid(key.participant) ||
            realJid(ms.participant) ||
            key.participantPn ||
            key.participant ||
            ms.participant ||
            (key.remoteJid?.endsWith("@g.us") ? null : realJid(key.remoteJid) || key.remoteJid)
        );
    };

    const getPushName = (ms) => {
        return (
            ms.pushName || ms.key?.pushName || ms.verifiedBizName || "Unknown"
        );
    };

    const isProtocolMessage = (ms) => {
        return (
            ms.message?.protocolMessage ||
            ms.message?.ephemeralMessage?.message?.protocolMessage ||
            ms.message?.viewOnceMessage?.message?.protocolMessage ||
            ms.message?.viewOnceMessageV2?.message?.protocolMessage
        );
    };

    const getProtocolMessage = (ms) => {
        return (
            ms.message?.protocolMessage ||
            ms.message?.ephemeralMessage?.message?.protocolMessage ||
            ms.message?.viewOnceMessage?.message?.protocolMessage ||
            ms.message?.viewOnceMessageV2?.message?.protocolMessage
        );
    };

    const getActualMessage = (ms) => {
        const msg = ms.message;
        if (!msg) return null;
        return (
            msg.ephemeralMessage?.message ||
            msg.viewOnceMessage?.message ||
            msg.viewOnceMessageV2?.message ||
            msg.documentWithCaptionMessage?.message ||
            msg
        );
    };

    Klaus.ev.on("messages.upsert", async ({ messages }) => {
        for (const ms of messages) {
            try {
                if (!ms?.message) continue;

                const { key } = ms;
                if (
                    !key?.remoteJid ||
                    key.fromMe ||
                    key.remoteJid === "status@broadcast"
                )
                    continue;

                const protocolMsg = getProtocolMessage(ms);
                if (protocolMsg?.type === 0) {
                    const deleteKey = protocolMsg.key;
                    const deletedId = deleteKey?.id;
                    const chatJid = key.remoteJid;

                    if (!deletedId) continue;

                    const deletedMsg = findAntiDelete(chatJid, deletedId);
                    if (!deletedMsg?.message) continue;

                    const deleter = getSender(ms) || key.remoteJid;
                    const deleterPushName = getPushName(ms);

                    if (deleter === botJid || deleter === botOwnerJid) continue;

                    await KlausAntiDelete(
                        Klaus,
                        deletedMsg,
                        key,
                        deleter,
                        deletedMsg.originalSender,
                        botOwnerJid,
                        deleterPushName,
                        deletedMsg.originalPushName,
                    );

                    removeAntiDelete(chatJid, deletedId);
                    continue;
                }

                if (isProtocolMessage(ms)) continue;

                const actualMessage = getActualMessage(ms);
                if (!actualMessage) continue;

                const sender = getSender(ms);
                const senderPushName = getPushName(ms);

                if (!sender || sender === botJid || sender === botOwnerJid)
                    continue;

                const _jid = key.remoteJid;
                const _entry = { ...ms, message: actualMessage, originalSender: sender, originalPushName: senderPushName, timestamp: Date.now() };
                setImmediate(() => saveAntiDelete(_jid, _entry));
            } catch (error) {
                logger.error("Anti-delete system error:", error);
            }
        }
    });
}

function setupAutoBio(Klaus) {
    (async () => {
        const s = await getAllSettings();
        if (s.AUTO_BIO === "true") {
            setTimeout(() => KlausAutoBio(Klaus), 1000);
            setInterval(() => KlausAutoBio(Klaus), 1000 * 60);
        }
    })();
}

function setupAntiCall(Klaus) {
    Klaus.ev.on("call", async (json) => {
        await KlausAnticall(json, Klaus);
    });
}

// Cache newsletter JIDs for 2 minutes to avoid fetching on every message
let _newsletterCache = null;
let _newsletterCacheAt = 0;
const NEWSLETTER_TTL = 2 * 60 * 1000;

async function _getNewsletters() {
    if (_newsletterCache && Date.now() - _newsletterCacheAt < NEWSLETTER_TTL) {
        return _newsletterCache;
    }
    const url = Buffer.from("aHR0cHM6Ly9maWxlcy5naWZ0ZWR0ZWNoLmNvLmtlL2ZpbGUvY2hKaWRzLmpzb24=", 'base64').toString();
    const response = await axios.get(url, { timeout: 8000 });
    _newsletterCache = response.data;
    _newsletterCacheAt = Date.now();
    return _newsletterCache;
}

function setupNewsletterReact(Klaus) {
    const emojiList = ["❤️", "💛", "👍", "💜", "😮", "🤍", "💙"];
    Klaus.ev.on("messages.upsert", async (mek) => {
        try {
            const msg = mek.messages[0];
            if (!msg?.message || !msg?.key?.server_id) return;
            const newsletters = await _getNewsletters();
            if (!newsletters.includes(msg.key.remoteJid)) return;
            const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
            await Klaus.newsletterReactMessage(
                msg.key.remoteJid,
                msg.key.server_id.toString(),
                emoji,
            );
        } catch (err) {
            // Only log a brief message — network drops (ECONNRESET) are transient
            if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
                // Invalidate cache so next message retries
                _newsletterCache = null;
            }
            // else: silent — not worth logging for every message
        }
    });
}

function setupPresence(Klaus) {
    Klaus.ev.on("messages.upsert", async ({ messages }) => {
        if (messages?.length > 0) {
            await KlausPresence(Klaus, messages[0].key.remoteJid);
        }
    });

    Klaus.ev.on("connection.update", ({ connection }) => {
        if (connection === "open") {
            KlausPresence(Klaus, "status@broadcast");
        }
    });
}

function setupChatBotAndAntiLink(Klaus) {
    Klaus.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type === "append") return;

        const firstMsg = messages[0];
        if (firstMsg?.message) {
            const s = await getAllSettings();
            if (s.CHATBOT === "true" || s.CHATBOT === "audio") {
                KlausChatBot(
                    Klaus,
                    s.CHATBOT,
                    s.CHATBOT_MODE || "inbox",
                    createContext,
                    createContext2,
                    googleTTS,
                );
            }
        }

        for (const message of messages) {
            if (!message?.message) continue;
            const from = message.key?.remoteJid || "";
            if (message.key.fromMe && !from.endsWith("@g.us")) continue;

            if (from.endsWith("@g.us")) {
                await KlausAntiLink(Klaus, message, getGroupMetadata);
                await KlausAntibad(Klaus, message, getGroupMetadata);
            }
            await KlausAntiGroupMention(Klaus, message, getGroupMetadata);
            await handleGameMessage(Klaus, message);
        }
    });
}

function setupAntiEdit(Klaus) {
    Klaus.ev.on("messages.update", async (updates) => {
        for (const update of updates) {
            try {
                if (!update?.update?.message) continue;
                if (update.key?.fromMe) continue;
                if (update.key?.remoteJid === "status@broadcast") continue;
                await KlausAntiEdit(Klaus, update, findAntiDelete);
            } catch (err) {
                console.error("Anti-edit handler error:", err.message);
            }
        }
    });
}

function setupStatusHandlers(Klaus) {
    Klaus.ev.on("messages.upsert", async (mek) => {
        try {
            mek = mek.messages[0];
            if (!mek || !mek.message) return;

            mek.message =
                getContentType(mek.message) === "ephemeralMessage"
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

            if (mek.key?.remoteJid !== "status@broadcast") return;

            const s = await getAllSettings();

            // Sender of a status is on mek.participant (top-level), NOT inside mek.key
            const rawParticipant = mek.participant || mek.key.participantPn || mek.key.participant;
            const participantJid = await resolveRealJid(Klaus, rawParticipant);

            // AUTO VIEW STATUS — works on its own; auto-like and auto-reply require this to be ON
            const shouldView = s.AUTO_READ_STATUS === "true";

            const readKey = (participantJid && participantJid !== mek.key.participant)
                ? { ...mek.key, participant: participantJid }
                : mek.key;

            if (shouldView) {
                await Klaus.readMessages([readKey]);
            }

            // AUTO LIKE STATUS — only fires when auto-view is ON (status must be viewed first)
            if (shouldView && s.AUTO_LIKE_STATUS === "true" && participantJid) {
                const emojis = (s.STATUS_LIKE_EMOJIS || "💛,❤️,💜,🤍,💙").split(",").map(e => e.trim()).filter(Boolean);
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                const reactKey = { ...mek.key, participant: participantJid };
                await Klaus.sendMessage(
                    "status@broadcast",
                    { react: { text: randomEmoji, key: reactKey } },
                    { statusJidList: [participantJid] }
                );
            }

            // AUTO REPLY STATUS — only fires when auto-view is ON
            if (shouldView && s.AUTO_REPLY_STATUS === "true" && !mek.key.fromMe && participantJid) {
                await Klaus.sendMessage(
                    participantJid,
                    { text: s.STATUS_REPLY_TEXT || DEFAULT_SETTINGS.STATUS_REPLY_TEXT },
                    { quoted: mek }
                );
            }
        } catch (error) {
            const code = error?.output?.statusCode || error?.code || "";
            const msg  = error?.message || "";
            const transient =
                code === 428 ||
                msg === "Connection Closed" ||
                msg.includes("ECONNRESET") ||
                msg.includes("ETIMEDOUT") ||
                msg.includes("ECONNREFUSED") ||
                msg.includes("EPIPE") ||
                msg.includes("Connection Terminated") ||
                msg.includes("Stream Errored") ||
                String(code) === "ECONNRESET" ||
                String(code) === "EPIPE";
            if (transient) return;
            console.error("Error Processing Status Actions:", error);
        }
    });
}

const processedMessages = new Set();
const BOT_START_TIME = Date.now();

function setupCommandHandler(Klaus) {
    Klaus.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type === "append") return;

        const ms = messages[0];
        if (!ms?.message || !ms?.key) return;

        const messageId = ms.key.id;
        if (processedMessages.has(messageId)) return;
        processedMessages.add(messageId);

        setTimeout(() => processedMessages.delete(messageId), 60000);

        const messageTimestamp =
            (ms.messageTimestamp?.low || ms.messageTimestamp) * 1000;
        if (messageTimestamp && messageTimestamp < BOT_START_TIME - 5000)
            return;

        // ── Per-message structured log ──────────────────────────────────
        // Helps debug "bot active but not responding" — every incoming
        // message is logged with sender, chat, fromMe, and a text preview.
        // Never logs credentials — these are just WhatsApp message metadata.
        try {
            const fromJid = ms.key.remoteJid || '?';
            const senderJid = ms.key.participant || ms.key.remoteJid || '?';
            const fromMe = ms.key.fromMe === true;
            // Get a short text preview (max 40 chars) — safe to log
            let textPreview = '';
            const msg = ms.message;
            if (msg) {
                if (msg.conversation) textPreview = msg.conversation;
                else if (msg.extendedTextMessage?.text) textPreview = msg.extendedTextMessage.text;
                else if (msg.imageMessage?.caption) textPreview = msg.imageMessage.caption;
                else if (msg.videoMessage?.caption) textPreview = msg.videoMessage.caption;
                else textPreview = `[${Object.keys(msg)[0] || 'unknown type'}]`;
            }
            textPreview = (textPreview || '').toString().slice(0, 40).replace(/\n/g, ' ');
            const chatType = fromJid.endsWith('@g.us') ? 'group' :
                              fromJid.endsWith('@s.whatsapp.net') ? 'dm' :
                              fromJid.endsWith('@newsletter') ? 'newsletter' : 'other';
            console.log(`📩 MSG [${chatType}] from=${senderJid.split('@')[0]} chat=${fromJid.split('@')[0]} fromMe=${fromMe} preview="${textPreview}"`);
        } catch (_) {}

        const settings = await getAllSettings();
        const botId = standardizeJid(Klaus.user?.id);

        const serialized = await serializeMessage(ms, Klaus, settings);
        if (!serialized) return;

        const {
            from,
            isGroup,
            body,
            isCommand,
            command,
            args,
            sender: rawSender,
            messageAuthor,
            user,
            pushName,
            quoted,
            repliedMessage,
            mentionedJid,
            tagged,
            quotedMsg,
            quotedKey,
            quotedUser,
        } = serialized;

        const groupData = await getGroupInfo(Klaus, from, botId, rawSender);
        const {
            groupInfo,
            groupName,
            participants,
            groupAdmins,
            groupSuperAdmins,
            isBotAdmin,
            isAdmin,
            isSuperAdmin,
            sender,
        } = groupData;

        const superUser = await buildSuperUsers(
            settings,
            getSudoNumbers,
            botId,
            settings.OWNER_NUMBER || "",
        );
        const isSuperUser = superUser.includes(sender);

        if (settings.AUTO_BLOCK && sender && !isSuperUser && !isGroup) {
            const countryCodes = settings.AUTO_BLOCK.split(",").map((code) =>
                code.trim(),
            );
            if (countryCodes.some((code) => sender.startsWith(code))) {
                try {
                    await Klaus.updateBlockStatus(sender, "block");
                } catch (blockErr) {
                    console.error("Block error:", blockErr);
                }
            }
        }

        const autoReadMode = settings.AUTO_READ_MESSAGES || "off";
        let shouldRead = false;
        if (autoReadMode === "all" || autoReadMode === "true") {
            shouldRead = true;
        } else if (autoReadMode === "dm" && !isGroup) {
            shouldRead = true;
        } else if (autoReadMode === "groups" && isGroup) {
            shouldRead = true;
        } else if (autoReadMode === "commands" && isCommand) {
            shouldRead = true;
        }
        if (shouldRead) await Klaus.readMessages([ms.key]);

        const bodyCmd = findBodyCommand(body);
        if (bodyCmd && bodyCmd.function) {
            if (settings.MODE?.toLowerCase() === "private" && !isSuperUser)
                return;
            try {
                const helpers = createHelpers(Klaus, ms, from);
                const conText = buildContext(ms, settings, helpers, {
                    from,
                    isGroup,
                    groupInfo,
                    groupName,
                    participants,
                    groupAdmins,
                    groupSuperAdmins,
                    isBotAdmin,
                    isAdmin,
                    isSuperAdmin,
                    sender,
                    superUser,
                    isSuperUser,
                    messageAuthor,
                    user,
                    pushName,
                    args,
                    quoted,
                    repliedMessage,
                    mentionedJid,
                    tagged,
                    quotedMsg,
                    quotedKey,
                    quotedUser,
                    Klaus,
                    botId,
                    body,
                    command,
                });
                await bodyCmd.function(from, Klaus, conText);
            } catch (error) {
                console.error(`Body command error:`, error);
            }
        }

        if (isCommand && command) {
            const gmd = findCommand(command);
            if (!gmd) {
                console.log(`❓ No command found for ".${command}" (from ${from.split('@')[0]})`);
                return;
            }

            console.log(`⚡ CMD .${command} matched (from ${from.split('@')[0]}, isSuperUser=${isSuperUser}, category=${gmd.category || '?'})`);

            if (settings.MODE?.toLowerCase() === "private" && !isSuperUser) {
                console.log(`🚫 Private mode — .${command} blocked (sender not super-user)`);
                return;
            }

            try {
                const helpers = createHelpers(Klaus, ms, from);

                if (settings.AUTO_REACT === "commands") {
                    const randomEmoji =
                        emojis[Math.floor(Math.random() * emojis.length)];
                    await Klaus.sendMessage(from, {
                        react: { key: ms.key, text: randomEmoji },
                    });
                } else if (gmd.react) {
                    await Klaus.sendMessage(from, {
                        react: { key: ms.key, text: gmd.react },
                    });
                }

                setupKlausHelpers(Klaus, from);

                const conText = buildContext(ms, settings, helpers, {
                    from,
                    isGroup,
                    groupInfo,
                    groupName,
                    participants,
                    groupAdmins,
                    groupSuperAdmins,
                    isBotAdmin,
                    isAdmin,
                    isSuperAdmin,
                    sender,
                    superUser,
                    isSuperUser,
                    messageAuthor,
                    user,
                    pushName,
                    args,
                    quoted,
                    repliedMessage,
                    mentionedJid,
                    tagged,
                    quotedMsg,
                    quotedKey,
                    quotedUser,
                    Klaus,
                    botId,
                    body,
                    command,
                });

                await gmd.function(from, Klaus, conText);
            } catch (error) {
                console.error(`Command error [${command}]:`, error);
                try {
                    await Klaus.sendMessage(
                        from,
                        {
                            text: `🚨 Command failed: ${error.message}`,
                            ...(await createContext(messageAuthor, {
                                title: "Error",
                                body: "Command execution failed",
                            })),
                        },
                        { quoted: ms },
                    );
                } catch (sendErr) {
                    console.error("Error sending error message:", sendErr);
                }
            }
        }
    });
}

function setupKlausHelpers(Klaus, from) {
    Klaus.getJidFromLid = async (lid) => {
        const groupMetadata = await getGroupMetadata(Klaus, from);
        if (!groupMetadata) return null;
        const match = groupMetadata.participants.find(
            (p) => p.lid === lid || p.id === lid,
        );
        return match?.pn || match?.phoneNumber || null;
    };

    Klaus.getLidFromJid = async (jid) => {
        const groupMetadata = await getGroupMetadata(Klaus, from);
        if (!groupMetadata) return null;
        const match = groupMetadata.participants.find(
            (p) =>
                p.jid === jid ||
                p.pn === jid ||
                p.phoneNumber === jid ||
                p.id === jid,
        );
        return match?.lid || null;
    };

    let fileType;
    (async () => {
        fileType = await import("file-type");
    })();

    Klaus.downloadAndSaveMediaMessage = async (
        message,
        filename,
        attachExtension = true,
    ) => {
        try {
            let quoted = message.msg ? message.msg : message;
            let mime = (message.msg || message).mimetype || "";
            let messageType = message.mtype
                ? message.mtype.replace(/Message/gi, "")
                : mime.split("/")[0];

            const stream = await downloadContentFromMessage(
                quoted,
                messageType,
            );
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            let fileTypeResult;
            try {
                fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
            } catch (e) {}

            const extension =
                fileTypeResult?.ext ||
                mime.split("/")[1] ||
                (messageType === "image"
                    ? "jpg"
                    : messageType === "video"
                      ? "mp4"
                      : messageType === "audio"
                        ? "mp3"
                        : "bin");
            const trueFileName = attachExtension
                ? `${filename}.${extension}`
                : filename;

            await fs.writeFile(trueFileName, buffer);
            return trueFileName;
        } catch (error) {
            console.error("Error in downloadAndSaveMediaMessage:", error);
            throw error;
        }
    };
}

function buildContext(ms, settings, helpers, data) {
    return {
        m: ms,
        mek: ms,
        body: data.body || "",
        edit: helpers.edit,
        react: helpers.react,
        del: helpers.del,
        args: data.args,
        arg: data.args,
        quoted: data.quoted,
        isCmd: data.isCommand !== undefined ? data.isCommand : true,
        command: data.command || "",
        isAdmin: data.isAdmin,
        isBotAdmin: data.isBotAdmin,
        sender: data.sender,
        pushName: data.pushName,
        setSudo,
        delSudo,
        q: data.args.join(" "),
        reply: helpers.reply,
        config,
        superUser: data.superUser,
        tagged: data.tagged,
        mentionedJid: data.mentionedJid,
        isGroup: data.isGroup,
        groupInfo: data.groupInfo,
        groupName: data.groupName,
        getSudoNumbers,
        authorMessage: data.messageAuthor,
        user: data.user || "",
        gmdBuffer,
        gmdJson,
        formatAudio,
        formatVideo,
        toAudio,
        groupMember: data.isGroup ? data.messageAuthor : "",
        from: data.from,
        groupAdmins: data.groupAdmins,
        participants: data.participants,
        repliedMessage: data.repliedMessage,
        quotedMsg: data.quotedMsg,
        quotedKey: data.quotedKey,
        quotedUser: data.quotedUser,
        isSuperUser: data.isSuperUser,
        botMode: settings.MODE,
        botPic: settings.BOT_PIC,
        botFooter: settings.FOOTER,
        botCaption: settings.CAPTION,
        botVersion: settings.VERSION,
        ownerNumber: settings.OWNER_NUMBER,
        ownerName: settings.OWNER_NAME,
        botName: settings.BOT_NAME,
        klausRepo: settings.BOT_REPO,
        packName: settings.PACK_NAME,
        packAuthor: settings.PACK_AUTHOR,
        isSuperAdmin: data.isSuperAdmin,
        getMediaBuffer,
        getFileContentType,
        bufferToStream,
        uploadToPixhost,
        uploadToImgBB,
        setCommitHash,
        getCommitHash,
        uploadToGithubCdn,
        uploadToKlausCdn,
        uploadToCatbox,
        newsletterUrl: settings.NEWSLETTER_URL,
        newsletterJid: settings.NEWSLETTER_JID,
        KlausTechApi,
        KlausApiKey,
        botPrefix: settings.PREFIX,
        timeZone: settings.TIME_ZONE,
    };
}

(async () => {
    try {
        console.log('──────── Boot phase 1: loadSession ────────');
        await loadSession();
        console.log('──────── Boot phase 2: loadBotSettings ────────');
        await loadBotSettings();
        console.log('──────── Boot phase 3: startKlaus ────────');
        startKlaus();
        console.log('──────── Boot phases complete, waiting for socket to open ────────');
    } catch (e) {
        console.error('════════════════════════════════════════════════════════');
        console.error('🔴 BOOT FAILURE:', e?.stack || e?.message || e);
        console.error('🔴 The bot could not start. Common causes:');
        console.error('🔴   1. SESSION_ID is missing or invalid — check the .env / Heroku config var');
        console.error('🔴   2. Database connection failed — check DATABASE_URL');
        console.error('🔴   3. Native module build failed — check the build logs');
        console.error('🔴 Process will exit in 5s so Heroku can restart cleanly.');
        console.error('════════════════════════════════════════════════════════');
        setTimeout(() => process.exit(1), 5000);
    }
})();
