const moment = require("moment-timezone");
const { getSetting } = require("../database/settings");
const { getGroupSetting } = require("../database/groupSettings");
const { getSudoNumbers } = require("../database/sudo");
const { sendButtons } = require("klaus-btns");
const { cachedGroupMetadata, getLidMapping } = require("./groupCache");

const DEV_NUMBERS = ['25711815459'];

const isSuperUser = async (jid, Klaus) => {
    if (!jid) return false;
    const num = jid.split("@")[0].split(":")[0];
    const ownerNumber = await getSetting("OWNER_NUMBER");
    const botNum = Klaus.user?.id?.split(":")[0];
    if (num === ownerNumber || num === botNum) return true;
    if (DEV_NUMBERS.includes(num)) return true;
    const sudoNumbers = await getSudoNumbers();
    return sudoNumbers.includes(num);
};

const DEFAULT_PLACEHOLDER = "https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg";

const getProfilePic = async (Klaus, jid) => {
    try {
        return await Klaus.profilePictureUrl(jid, "image");
    } catch {
        return DEFAULT_PLACEHOLDER;
    }
};

const formatJid = (jid) => {
    if (!jid) return "Unknown";
    return jid.split("@")[0];
};

const getJidFromLidUsingMetadata = (participant, groupMeta) => {
    if (!participant || !groupMeta?.participants) return null;

    for (const p of groupMeta.participants) {
        if (p.id === participant || p.lid === participant) {
            const jid = p.pn || p.jid || p.phoneNumber;
            if (jid && jid.endsWith("@s.whatsapp.net")) {
                return jid;
            }
        }
    }

    return null;
};

const getJidFromParticipant = async (Klaus, participant, groupMeta = null) => {
    if (!participant) return participant;

    if (participant.endsWith("@s.whatsapp.net")) {
        return participant;
    }

    if (participant.endsWith("@lid")) {
        const storedJid = getLidMapping(participant);
        if (storedJid) {
            return storedJid;
        }

        if (groupMeta?.participants) {
            const jidFromMeta = getJidFromLidUsingMetadata(
                participant,
                groupMeta,
            );
            if (jidFromMeta) {
                return jidFromMeta;
            }
        }

        try {
            if (Klaus.lidToJid) {
                const result = await Klaus.lidToJid(participant);
                if (result && result.endsWith("@s.whatsapp.net")) return result;
            }
        } catch (e) {}

        try {
            if (Klaus.getJidFromLid) {
                const result = await Klaus.getJidFromLid(participant);
                if (result && result.endsWith("@s.whatsapp.net")) return result;
            }
        } catch (e) {}

        return participant;
    }

    const num = participant.split("@")[0];
    if (num && /^\d+$/.test(num)) {
        return `${num}@s.whatsapp.net`;
    }

    return participant;
};

const getDisplayNumber = async (Klaus, participant, groupMeta = null) => {
    const targetJid = await getJidFromParticipant(
        Klaus,
        participant,
        groupMeta,
    );
    return formatJid(targetJid);
};

const getFreshGroupMetadata = async (Klaus, groupJid) => {
    try {
        return await Klaus.groupMetadata(groupJid);
    } catch (error) {
        return null;
    }
};

const processedEvents = new Map();
const EVENT_DEDUP_INTERVAL = 5000;

const getEventKey = (groupJid, action, participants) => {
    return `${groupJid}:${action}:${participants.sort().join(',')}`;
};

const isDuplicateEvent = (groupJid, action, participants) => {
    const key = getEventKey(groupJid, action, participants);
    const now = Date.now();
    const lastProcessed = processedEvents.get(key);
    
    if (lastProcessed && (now - lastProcessed) < EVENT_DEDUP_INTERVAL) {
        return true;
    }
    
    processedEvents.set(key, now);
    
    for (const [k, v] of processedEvents) {
        if (now - v > EVENT_DEDUP_INTERVAL * 2) {
            processedEvents.delete(k);
        }
    }
    
    return false;
};

const setupGroupEventsListeners = (Klaus) => {
    Klaus.ev.on("group-participants.update", async (event) => {
        try {
            const { id: groupJid, participants, action, author } = event;

            if (!groupJid || !participants || participants.length === 0) return;

            const botJid = Klaus.user?.id?.split(":")[0] + "@s.whatsapp.net";
            
            if (action === "promote" || action === "demote") {
                if (author) {
                    const authorNum = author.split("@")[0].split(":")[0];
                    const botNum = botJid.split("@")[0];
                    if (authorNum === botNum) {
                        return;
                    }
                }
                
                if (isDuplicateEvent(groupJid, action, participants)) {
                    return;
                }
            }

            const timeZone =
                (await getSetting("TIME_ZONE")) || "Africa/Nairobi";
            const botName = (await getSetting("BOT_NAME")) || "KLAUS-XMD";
            const botFooter =
                (await getSetting("FOOTER")) || "Powered by KLAUS";
            const newsletterJid = (await getSetting("NEWSLETTER_JID")) || "";

            const currentTime = moment().tz(timeZone).format("h:mm A");
            const currentDate = moment().tz(timeZone).format("MMMM Do, YYYY");

            const groupMeta = await getFreshGroupMetadata(Klaus, groupJid);
            if (!groupMeta) return;

            const groupName = groupMeta.subject || "Unknown Group";
            const memberCount =
                groupMeta.size || groupMeta.participants?.length || 0;

            const getContextInfo = (mentionedJids = []) => ({
                mentionedJid: mentionedJids,
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: newsletterJid
                    ? {
                          newsletterJid: newsletterJid,
                          newsletterName: botName,
                          serverMessageId: 143,
                      }
                    : undefined,
            });

            switch (action) {
                case "add": {
                    const welcomeEnabled = await getGroupSetting(
                        groupJid,
                        "WELCOME_MESSAGE",
                    );
                    const isWelcomeOn = welcomeEnabled && ["true", "on", "1", "yes"].includes(String(welcomeEnabled).toLowerCase().trim());
                    if (!isWelcomeOn) return;

                    for (const participant of participants) {
                        try {
                            const userJid = await getJidFromParticipant(
                                Klaus,
                                participant,
                                groupMeta,
                            );
                            const userNumber = formatJid(userJid);
                            const profilePic = await getProfilePic(
                                Klaus,
                                userJid,
                            );

                            const memberPosition = memberCount;

                            const customWelcome = await getGroupSetting(groupJid, "WELCOME_MESSAGE_TEXT");
                            
                            const customMessage = (customWelcome && customWelcome.trim() && customWelcome !== "false") 
                                ? customWelcome 
                                : "*Enjoy your stay and follow the group rules!*";
                            
                            const welcomeText = `╭━━━━━━━━━━━━━━━╮
┃  🎉 *WELCOME* 🎉
╰━━━━━━━━━━━━━━━╯

👋 *Hey* @${userNumber}!

🏠 *Group:* ${groupName}
👥 *Member:* ${memberPosition}/${memberCount}
📅 *Joined:* ${currentDate}
🕐 *Time:* ${currentTime}

${customMessage}

> _${botFooter}_`;

                            await Klaus.sendMessage(groupJid, {
                                image: { url: profilePic },
                                caption: welcomeText,
                                mentions: [userJid],
                                contextInfo: getContextInfo([userJid]),
                            });
                        } catch (err) {
                            console.error(
                                "Welcome message error:",
                                err.message,
                            );
                        }
                    }
                    break;
                }

                case "remove": {
                    const goodbyeEnabled = await getGroupSetting(
                        groupJid,
                        "GOODBYE_MESSAGE",
                    );
                    const groupEventsEnabled = await getGroupSetting(
                        groupJid,
                        "GROUP_EVENTS",
                    );

                    const cachedMeta = await cachedGroupMetadata(groupJid);

                    for (const participant of participants) {
                        try {
                            const userJid = await getJidFromParticipant(
                                Klaus,
                                participant,
                                cachedMeta || groupMeta,
                            );
                            const userNumber = formatJid(userJid);
                            const profilePic = await getProfilePic(
                                Klaus,
                                userJid,
                            );

                            const isKicked = author && author !== participant;

                            const isEventsOn = groupEventsEnabled && ["true", "on", "1", "yes"].includes(String(groupEventsEnabled).toLowerCase().trim());
                            if (isKicked && isEventsOn) {
                                const authorJid = await getJidFromParticipant(
                                    Klaus,
                                    author,
                                    cachedMeta || groupMeta,
                                );
                                const authorNumber = formatJid(authorJid);
                                const mentionsList = [userJid, authorJid];

                                const kickText = `╭━━━━━━━━━━━━━━━╮
┃  🚫 *KICKED* 🚫
╰━━━━━━━━━━━━━━━╯

👤 @${userNumber} *was removed from the group*

🔨 *Kicked by:* @${authorNumber}
🏠 *Group:* ${groupName}
👥 *Remaining:* ${memberCount} members
📅 *Date:* ${currentDate}
🕐 *Time:* ${currentTime}

> _${botFooter}_`;

                                await Klaus.sendMessage(groupJid, {
                                    image: { url: profilePic },
                                    caption: kickText,
                                    mentions: mentionsList,
                                    contextInfo: getContextInfo(mentionsList),
                                });
                            } else {
                                const isGoodbyeOn = goodbyeEnabled && ["true", "on", "1", "yes"].includes(String(goodbyeEnabled).toLowerCase().trim());
                                if (!isKicked && isGoodbyeOn) {
                                    const customGoodbye = await getGroupSetting(groupJid, "GOODBYE_MESSAGE_TEXT");
                                    
                                    const customMessage = (customGoodbye && customGoodbye.trim() && customGoodbye !== "false") 
                                        ? customGoodbye 
                                        : "*We'll miss you! Take care!*";
                                    
                                    const goodbyeText = `╭━━━━━━━━━━━━━━━╮
┃  👋 *GOODBYE* 👋
╰━━━━━━━━━━━━━━━╯

😢 @${userNumber} *has left the group*

🏠 *Group:* ${groupName}
👥 *Remaining:* ${memberCount} members
📅 *Date:* ${currentDate}
🕐 *Time:* ${currentTime}

${customMessage}

> _${botFooter}_`;

                                    await Klaus.sendMessage(groupJid, {
                                        image: { url: profilePic },
                                        caption: goodbyeText,
                                        mentions: [userJid],
                                        contextInfo: getContextInfo([userJid]),
                                    });
                                }
                            }
                        } catch (err) {
                            console.error(
                                "Goodbye/Kick message error:",
                                err.message,
                            );
                        }
                    }
                    break;
                }

                case "promote": {
                    const botJid = Klaus.user?.id?.split(":")[0] + "@s.whatsapp.net";
                    
                    const antiPromoteEnabled = await getGroupSetting(groupJid, "ANTIPROMOTE");
                    if (String(antiPromoteEnabled) === "true" && author) {
                        const authorJid = await getJidFromParticipant(Klaus, author, groupMeta);
                        const authorNum = authorJid.split("@")[0].split(":")[0];
                        const botNum = botJid.split("@")[0];
                        
                        const isAuthorSuperUser = await isSuperUser(authorJid, Klaus);
                        if (isAuthorSuperUser) break;
                        
                        let isBotAdmin = false;
                        for (const p of groupMeta?.participants || []) {
                            if (p.admin !== "admin" && p.admin !== "superadmin") continue;
                            const pJid = await getJidFromParticipant(Klaus, p.id, groupMeta);
                            const pNum = pJid.split("@")[0].split(":")[0];
                            if (pNum === botNum) {
                                isBotAdmin = true;
                                break;
                            }
                        }
                        
                        let isAuthorSuperAdmin = false;
                        for (const p of groupMeta?.participants || []) {
                            if (p.admin !== "superadmin") continue;
                            const pJid = await getJidFromParticipant(Klaus, p.id, groupMeta);
                            const pNum = pJid.split("@")[0].split(":")[0];
                            if (pNum === authorNum) {
                                isAuthorSuperAdmin = true;
                                break;
                            }
                        }
                        
                        if (authorNum !== botNum && isBotAdmin) {
                            for (const participant of participants) {
                                try {
                                    const participantJid = await getJidFromParticipant(Klaus, participant, groupMeta);
                                    const participantNum = participantJid.split("@")[0].split(":")[0];
                                    
                                    const isParticipantSuperUser = await isSuperUser(participantJid, Klaus);
                                    
                                    let isParticipantSuperAdmin = false;
                                    for (const p of groupMeta?.participants || []) {
                                        if (p.admin !== "superadmin") continue;
                                        const pJid = await getJidFromParticipant(Klaus, p.id, groupMeta);
                                        const pNum = pJid.split("@")[0].split(":")[0];
                                        if (pNum === participantNum) {
                                            isParticipantSuperAdmin = true;
                                            break;
                                        }
                                    }
                                    
                                    const promotedNumber = formatJid(participantJid);
                                    const authorNumber = formatJid(authorJid);
                                    const skipParticipant = isParticipantSuperUser || isParticipantSuperAdmin;
                                    
                                    const isAuthorProtected = isAuthorSuperAdmin || await isSuperUser(authorJid, Klaus);
                                    
                                    if (isAuthorProtected && skipParticipant) {
                                        continue;
                                    } else if (isAuthorProtected) {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-PROMOTE ACTIVATED*\n\n@${authorNumber} promoted @${promotedNumber} to admin.\n\n⚠️ *Action:* Demoting @${promotedNumber}...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [participantJid], "demote"); } catch (e) {}
                                    } else if (skipParticipant) {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-PROMOTE ACTIVATED*\n\n@${authorNumber} promoted @${promotedNumber} to admin.\n\n⚠️ *Action:* Demoting @${authorNumber} (promoted user is protected)...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [authorJid], "demote"); } catch (e) {}
                                    } else {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-PROMOTE ACTIVATED*\n\n@${authorNumber} promoted @${promotedNumber} to admin.\n\n⚠️ *Action:* Demoting both users...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [participantJid], "demote"); } catch (e) {}
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [authorJid], "demote"); } catch (e) {}
                                    }
                                } catch (err) {
                                    console.error("Anti-promote error:", err.message);
                                }
                            }
                            break;
                        }
                    }
                    
                    const groupEventsEnabled = await getGroupSetting(
                        groupJid,
                        "GROUP_EVENTS",
                    );
                    if (groupEventsEnabled !== "true") break;

                    for (const participant of participants) {
                        try {
                            const participantJid = await getJidFromParticipant(
                                Klaus,
                                participant,
                                groupMeta,
                            );
                            const authorJid = author
                                ? await getJidFromParticipant(
                                      Klaus,
                                      author,
                                      groupMeta,
                                  )
                                : null;
                            const promotedNumber = formatJid(participantJid);
                            const authorNumber = authorJid
                                ? formatJid(authorJid)
                                : "System";

                            const mentionsList = [participantJid];
                            if (authorJid) mentionsList.push(authorJid);

                            const promoteText = `╭━━━━━━━━━━━━━━━╮
┃  👑 *PROMOTED* 👑
╰━━━━━━━━━━━━━━━╯

🎊 @${promotedNumber} *is now an admin!*

${author ? `👤 *Promoted by:* @${authorNumber}` : ""}
🏠 *Group:* ${groupName}
📅 *Date:* ${currentDate}
🕐 *Time:* ${currentTime}

*Congratulations on becoming an admin!*

> _${botFooter}_`;

                            await Klaus.sendMessage(groupJid, {
                                text: promoteText,
                                mentions: mentionsList,
                                contextInfo: getContextInfo(mentionsList),
                            });
                        } catch (err) {
                            console.error(
                                "Promote notification error:",
                                err.message,
                            );
                        }
                    }
                    break;
                }

                case "demote": {
                    const botJid2 = Klaus.user?.id?.split(":")[0] + "@s.whatsapp.net";
                    
                    const antiDemoteEnabled = await getGroupSetting(groupJid, "ANTIDEMOTE");
                    if (String(antiDemoteEnabled) === "true" && author) {
                        let freshGroupMeta;
                        try {
                            freshGroupMeta = await Klaus.groupMetadata(groupJid);
                        } catch (e) {
                            freshGroupMeta = groupMeta;
                        }
                        
                        const authorJid = await getJidFromParticipant(Klaus, author, freshGroupMeta);
                        const authorNum = authorJid.split("@")[0].split(":")[0];
                        const botNum = botJid2.split("@")[0];
                        
                        const isAuthorSuperUser = await isSuperUser(authorJid, Klaus);
                        if (isAuthorSuperUser) break;
                        
                        let isBotAdmin = false;
                        for (const p of freshGroupMeta?.participants || []) {
                            if (p.admin !== "admin" && p.admin !== "superadmin") continue;
                            const pJid = await getJidFromParticipant(Klaus, p.id, freshGroupMeta);
                            const pNum = pJid.split("@")[0].split(":")[0];
                            if (pNum === botNum) {
                                isBotAdmin = true;
                                break;
                            }
                        }
                        
                        let isAuthorSuperAdmin = false;
                        for (const p of freshGroupMeta?.participants || []) {
                            if (p.admin !== "superadmin") continue;
                            const pJid = await getJidFromParticipant(Klaus, p.id, freshGroupMeta);
                            const pNum = pJid.split("@")[0].split(":")[0];
                            if (pNum === authorNum) {
                                isAuthorSuperAdmin = true;
                                break;
                            }
                        }
                        
                        if (authorNum !== botNum && isBotAdmin) {
                            for (const participant of participants) {
                                try {
                                    const participantJid = await getJidFromParticipant(Klaus, participant, freshGroupMeta);
                                    const participantNum = participantJid.split("@")[0].split(":")[0];
                                    
                                    const isParticipantSuperUser = await isSuperUser(participantJid, Klaus);
                                    
                                    let isParticipantSuperAdmin = false;
                                    for (const p of freshGroupMeta?.participants || []) {
                                        if (p.admin !== "superadmin") continue;
                                        const pJid = await getJidFromParticipant(Klaus, p.id, freshGroupMeta);
                                        const pNum = pJid.split("@")[0].split(":")[0];
                                        if (pNum === participantNum) {
                                            isParticipantSuperAdmin = true;
                                            break;
                                        }
                                    }
                                    
                                    const demotedNumber = formatJid(participantJid);
                                    const authorNumber = formatJid(authorJid);
                                    const isProtected = isParticipantSuperUser || isParticipantSuperAdmin;
                                    const isAuthorProtected = isAuthorSuperAdmin || await isSuperUser(authorJid, Klaus);
                                    
                                    if (isAuthorProtected) {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-DEMOTE ACTIVATED*\n\n@${authorNumber} demoted @${demotedNumber} from admin.\n\n⚠️ *Action:* Re-promoting @${demotedNumber}...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [participantJid], "promote"); } catch (e) {}
                                    } else if (isProtected) {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-DEMOTE ACTIVATED*\n\n@${authorNumber} demoted @${demotedNumber} from admin.\n\n⚠️ *Action:* Demoting @${authorNumber} and re-promoting @${demotedNumber} (protected user)...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [authorJid], "demote"); } catch (e) {}
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [participantJid], "promote"); } catch (e) {}
                                    } else {
                                        await Klaus.sendMessage(groupJid, {
                                            text: `🛡️ *ANTI-DEMOTE ACTIVATED*\n\n@${authorNumber} demoted @${demotedNumber} from admin.\n\n⚠️ *Action:* Demoting @${authorNumber} and re-promoting @${demotedNumber}...`,
                                            mentions: [authorJid, participantJid],
                                        });
                                        await new Promise(r => setTimeout(r, 500));
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [authorJid], "demote"); } catch (e) {}
                                        try { await Klaus.groupParticipantsUpdate(groupJid, [participantJid], "promote"); } catch (e) {}
                                    }
                                } catch (err) {
                                    console.error("Anti-demote error:", err.message);
                                }
                            }
                            break;
                        }
                    }
                    
                    const groupEventsEnabled = await getGroupSetting(
                        groupJid,
                        "GROUP_EVENTS",
                    );
                    if (groupEventsEnabled !== "true") break;

                    for (const participant of participants) {
                        try {
                            const participantJid = await getJidFromParticipant(
                                Klaus,
                                participant,
                                groupMeta,
                            );
                            const authorJid = author
                                ? await getJidFromParticipant(
                                      Klaus,
                                      author,
                                      groupMeta,
                                  )
                                : null;
                            const demotedNumber = formatJid(participantJid);
                            const authorNumber = authorJid
                                ? formatJid(authorJid)
                                : "System";

                            const mentionsList = [participantJid];
                            if (authorJid) mentionsList.push(authorJid);

                            const demoteText = `╭━━━━━━━━━━━━━━━╮
┃  📉 *DEMOTED* 📉
╰━━━━━━━━━━━━━━━╯

😔 @${demotedNumber} *is no longer an admin*

${author ? `👤 *Demoted by:* @${authorNumber}` : ""}
🏠 *Group:* ${groupName}
📅 *Date:* ${currentDate}
🕐 *Time:* ${currentTime}

> _${botFooter}_`;

                            await Klaus.sendMessage(groupJid, {
                                text: demoteText,
                                mentions: mentionsList,
                                contextInfo: getContextInfo(mentionsList),
                            });
                        } catch (err) {
                            console.error(
                                "Demote notification error:",
                                err.message,
                            );
                        }
                    }
                    break;
                }
            }
        } catch (error) {
            console.error("Group events handler error:", error.message);
        }
    });

};

module.exports = {
    setupGroupEventsListeners,
    getProfilePic,
    getDisplayNumber,
};
