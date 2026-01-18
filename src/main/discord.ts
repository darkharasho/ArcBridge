import axios from 'axios';

export class DiscordNotifier {
    private webhookUrl: string | null = null;

    constructor() {
    }

    public setWebhookUrl(url: string | null) {
        this.webhookUrl = url;
    }

    public async sendLog(logData: { permalink: string, id: string, filePath: string }, jsonDetails?: any) {
        if (!this.webhookUrl) {
            console.log("No webhook URL configured, skipping Discord notification.");
            return;
        }

        let embedFields: any[] = [];

        console.log(`[Discord] sending log. Has JSON? ${!!jsonDetails}`);
        if (jsonDetails) console.log(`[Discord] JSON Keys: ${Object.keys(jsonDetails)}`);

        if (jsonDetails && (jsonDetails.evtc || jsonDetails.players)) {
            console.log('[Discord] Building Rich Embed...');
            const players = jsonDetails.players || [];

            // --- Helpers ---
            const fmtNum = (n: number) => n.toLocaleString();

            let totalDps = 0;
            let totalDmg = 0;
            let totalDowns = 0;
            let totalDeaths = 0;
            let totalDmgTaken = 0;

            let totalMiss = 0;
            let totalBlock = 0;
            let totalEvade = 0;
            let totalDodge = 0;

            let squadDps = 0;
            let squadDmg = 0;
            let squadDowns = 0;
            let squadDeaths = 0;

            let totalCCTaken = 0;
            let totalStripsTaken = 0;

            const profCounts: { [key: string]: number } = {};

            players.forEach((p: any, index: number) => {
                if (index === 0) {
                    console.log('[Discord] Full player keys:', Object.keys(p));
                    if (p.defenses) {
                        console.log('[Discord] Defenses[0] keys:', Object.keys(p.defenses[0]));
                        console.log('[Discord] Defenses[0] content:', JSON.stringify(p.defenses[0]));
                    }
                }
                const isSquad = !p.notInSquad;

                if (p.dpsAll && p.dpsAll.length > 0) {
                    const dps = p.dpsAll[0].dps;
                    const dmg = p.dpsAll[0].damage;
                    totalDps += dps;
                    totalDmg += dmg;
                    if (isSquad) {
                        squadDps += dps;
                        squadDmg += dmg;
                    }
                }
                if (p.defenses && p.defenses.length > 0) {
                    const d = p.defenses[0];
                    totalDowns += d.downCount;
                    totalDeaths += d.deadCount;
                    totalDmgTaken += d.damageTaken || 0;

                    if (isSquad) {
                        squadDowns += d.downCount;
                        squadDeaths += d.deadCount;
                    }

                    // Elite Insights keys: missedCount, blockedCount, evadedCount, dodgeCount, interruptedCount, boonStrips
                    totalMiss += d.missedCount || d.missCount || d.missed || 0;
                    totalBlock += d.blockedCount || d.blockCount || d.blocked || 0;
                    totalEvade += d.evadedCount || d.evadeCount || 0;
                    totalDodge += d.dodgeCount || 0;
                    totalCCTaken += d.interruptedCount || 0;
                    totalStripsTaken += d.boonStrips || 0;
                }
                const prof = p.profession;
                profCounts[prof] = (profCounts[prof] || 0) + 1;
            });

            // Parse Duration
            const durationSec = jsonDetails.durationMS ? jsonDetails.durationMS / 1000 : 1;
            const totalIncomingDps = Math.round(totalDmgTaken / durationSec);
            // "Average Enemy" likely refers to incoming damage per second per player? 
            // Or total incoming damage / duration?
            // PlenBot sometimes puts "Enemy" stats. Let's assume Avg Incoming DPS per player for now 
            // or just Total Incoming DPS.
            // User said "average squad, average enemy". 
            // Let's interpret as: Avg Squad DPS (Output) and Avg Enemy DPS (Incoming).
            // Actually, usually "Avg Squad" in PlenBot refers to "Average Player DPS".
            // "Avg Enemy" might refer to "Average Damage Taken per Player" (DTPS)?
            // I'll calculate Avg Squad DPS and Avg Incoming DPS (DTPS).
            const avgEnemyDps = players.length > 0 ? Math.round(totalIncomingDps / players.length) : 0;
            // Wait, duration might be string "00m 53s". `encounterDuration` is string.
            // `durationMS` usually exists in raw JSON. If not, I can parse `encounterDuration` or check jsonDetails keys.
            // Let's rely on simple averages if duration is hard to parse safely without type info.
            // Actually, Total DPS is already (Total Damage / Duration).
            // So Avg Squad DPS = Total DPS / Count.

            // For Enemy, if I don't have Incoming DPS readily available, I might skip precise calculation and just show what's available.
            // But I found `damageTaken` in defenses.
            // Let's try to calculate Avg Incoming DPS.
            // I'll stick to adding lines to "Squad Summary" as requested.

            // Build Description
            let desc = `**Recorded by:** ${jsonDetails.recordedBy || 'Unknown'}\n`;
            desc += `**Duration:** ${jsonDetails.encounterDuration || 'Unknown'}\n`;
            desc += `**Elite Insights version:** ${jsonDetails.eliteInsightsVersion || 'Unknown'}\n`;
            desc += `**arcdps version:** ${jsonDetails.arcVersion || 'Unknown'}\n`;

            // Line 1: Squad Summary | Team Summary (Enemy)
            // Helper to format lines with consistent label width (numbers left-aligned)
            const formatStatLine = (label: string, value: string | number) => {
                const paddedLabel = label.padEnd(8); // Pad label to 8 characters
                return `${paddedLabel}${value}`;
            };

            // Separate squad vs non-squad players
            const squadPlayers = players.filter((p: any) => !p.notInSquad);
            const nonSquadPlayers = players.filter((p: any) => p.notInSquad);

            const squadSummary = [
                formatStatLine('Count:', nonSquadPlayers.length > 0 ? `${squadPlayers.length} (+${nonSquadPlayers.length})` : squadPlayers.length),
                formatStatLine('DMG:', fmtNum(squadDmg)),
                formatStatLine('DPS:', fmtNum(squadDps)),
                formatStatLine('Downs:', squadDowns),
                formatStatLine('Deaths:', squadDeaths)
            ].join('\n');

            const enemySummary = [
                formatStatLine('Count:', players.length),
                formatStatLine('DMG:', fmtNum(totalDmgTaken)),
                formatStatLine('DPS:', fmtNum(totalIncomingDps)),
                formatStatLine('Avg:', fmtNum(avgEnemyDps)),
                formatStatLine('Deaths:', totalDeaths)
            ].join('\n');

            embedFields.push({
                name: "Squad Summary:",
                value: `\`\`\`\n${squadSummary}\n\`\`\``,
                inline: true
            });
            embedFields.push({
                name: "Team ID (?):",
                value: `\`\`\`\n${enemySummary}\n\`\`\``,
                inline: true
            });
            embedFields.push({ name: '\u200b', value: '\u200b', inline: false }); // Non-inline empty field for row break

            // Line 2: Incoming Attacks | Incoming CC | Incoming Strips
            // Line 2: Incoming Attacks | Incoming CC | Incoming Strips
            const formatIncoming = (miss: number, block: number, total: number) => {
                return [
                    `Miss:  ${miss.toString().padStart(6)}`,
                    `Block: ${block.toString().padStart(6)}`,
                    `Total: ${total.toString().padStart(6)}`
                ].join('\n');
            };

            embedFields.push({
                name: "Incoming Attacks:",
                value: `\`\`\`\n${formatIncoming(totalMiss, totalBlock, totalMiss + totalBlock + totalEvade + totalDodge)}\n\`\`\``,
                inline: true
            });
            embedFields.push({
                name: "Incoming CC:",
                value: `\`\`\`\n${formatIncoming(totalMiss, totalBlock, totalCCTaken)}\n\`\`\``,
                inline: true
            });
            embedFields.push({
                name: "Incoming Strips:",
                value: `\`\`\`\n${formatIncoming(totalMiss, totalBlock, totalStripsTaken)}\n\`\`\``,
                inline: true
            });

            // --- Top Lists Helper ---
            const addTopList = (title: string, sortFn: (a: any, b: any) => number, valFn: (p: any) => any, fmtVal: (v: any) => string) => {
                const top = [...players].sort(sortFn).slice(0, 10);
                let str = "";
                let debugValues: any[] = [];

                top.forEach((p, i) => {
                    const val = valFn(p);
                    debugValues.push({ name: p.character_name || p.account, val });

                    if (val > 0 || (typeof val === 'string' && val !== '0')) {
                        const rank = (i + 1).toString() + " ";
                        const name = (p.character_name || p.account || 'Unknown').substring(0, 14).padEnd(15);
                        const vStr = fmtVal(val).padStart(6);
                        str += `${rank}${name}${vStr}\n`;
                    }
                });

                // Debug log for healing and barrier specifically
                if (title === 'Healing' || title === 'Barrier' || title === 'CC' || title === 'Stability') {
                    console.log(`[Discord] ${title} top values:`, JSON.stringify(debugValues.slice(0, 3)));
                }

                if (!str) {
                    str = "No Data\n";
                }

                embedFields.push({
                    name: title + ":",
                    value: `\`\`\`\n${str}\`\`\``,
                    inline: true
                });
            };

            // Line 3: Damage | Down Contribution
            addTopList("Damage",
                (a, b) => (b.dpsAll?.[0]?.damage || 0) - (a.dpsAll?.[0]?.damage || 0),
                p => p.dpsAll?.[0]?.damage || 0,
                v => v.toLocaleString()
            );
            addTopList("Down Contribution",
                (a, b) => {
                    const aVal = (a.statsAll?.[0]?.downContribution || 0);
                    const bVal = (b.statsAll?.[0]?.downContribution || 0);
                    return bVal - aVal;
                },
                p => (p.statsAll?.[0]?.downContribution || 0),
                v => v.toLocaleString()
            );
            embedFields.push({ name: '\u200b', value: '\u200b', inline: false }); // Non-inline empty field for row break

            // Line 4: Healing | Barrier
            addTopList("Healing",
                (a, b) => {
                    // outgoingHealingAllies is array of arrays, get total healing from [0][0]
                    const aTotal = a.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0;
                    const bTotal = b.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0;
                    return bTotal - aTotal;
                },
                p => {
                    const val = p.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0;
                    return val;
                },
                v => v.toLocaleString()
            );

            // Debug: Log first few healing values
            const healingValues = players.map((p: any) => ({
                name: p.character_name || p.account,
                healing: p.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0
            })).slice(0, 5);
            console.log('[Discord] Sample healing values:', JSON.stringify(healingValues));

            addTopList("Barrier",
                (a, b) => {
                    // outgoingBarrierAllies is array of arrays, get total barrier from [0][0]
                    const aTotal = a.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0;
                    const bTotal = b.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0;
                    return bTotal - aTotal;
                },
                p => {
                    const val = p.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0;
                    return val;
                },
                v => v.toLocaleString()
            );
            embedFields.push({ name: '\u200b', value: '\u200b', inline: false }); // Non-inline empty field for row break

            // Line 5: Cleanses | Boon Strips
            addTopList("Cleanses",
                (a, b) => (b.support?.[0]?.condiCleanse || 0) - (a.support?.[0]?.condiCleanse || 0),
                p => p.support?.[0]?.condiCleanse || 0,
                v => v.toString()
            );
            addTopList("Boon Strips",
                (a, b) => (b.support?.[0]?.boonStrips || 0) - (a.support?.[0]?.boonStrips || 0),
                p => p.support?.[0]?.boonStrips || 0,
                v => v.toString()
            );
            embedFields.push({ name: '\u200b', value: '\u200b', inline: false }); // Non-inline empty field for row break

            // Line 6: CC | Stability
            addTopList("CC",
                (a, b) => (b.dpsAll?.[0]?.breakbarDamage || 0) - (a.dpsAll?.[0]?.breakbarDamage || 0),
                p => p.dpsAll?.[0]?.breakbarDamage || 0,
                v => Math.round(v).toLocaleString()
            );
            addTopList("Stability",
                (a, b) => {
                    // Stability buff ID is 1122, look in squadBuffVolumes with buffVolumeData
                    const aBuff = a.squadBuffVolumes?.find((buff: any) => buff.id === 1122);
                    const bBuff = b.squadBuffVolumes?.find((buff: any) => buff.id === 1122);
                    const aStab = aBuff?.buffVolumeData?.[0]?.outgoing || 0;
                    const bStab = bBuff?.buffVolumeData?.[0]?.outgoing || 0;
                    return bStab - aStab;
                },
                p => {
                    const buff = p.squadBuffVolumes?.find((b: any) => b.id === 1122);
                    return buff?.buffVolumeData?.[0]?.outgoing || 0;
                },
                v => v.toLocaleString()
            );
            embedFields.push({ name: '\u200b', value: '\u200b', inline: false }); // Non-inline empty field for row break

            // Construct Final Embed
            try {
                await axios.post(this.webhookUrl, {
                    username: "GW2 Arc Log Uploader",
                    embeds: [
                        {
                            title: `${jsonDetails.fightName || 'Log Uploaded'}`,
                            url: logData.permalink,
                            description: desc,
                            color: jsonDetails.success ? 3066993 : 15158332,
                            timestamp: new Date().toISOString(),
                            // No thumbnail per user request
                            footer: {
                                text: `GW2 Arc Log Uploader • ${new Date().toLocaleTimeString()}`
                            },
                            fields: embedFields
                        }
                    ]
                });
                console.log("Sent Discord notification.");
            } catch (error) {
                console.error("Failed to send Discord notification:", error);
            }
            return;
        }

        /* 
          Legacy / Minimal Embed (Fallthrough if no JSON)
        */
        try {
            await axios.post(this.webhookUrl, {
                username: "GW2 Arc Log Uploader",
                embeds: [{
                    title: "Log Uploaded",
                    description: `**Log:** [${logData.filePath.split(/[\\/]/).pop()}](${logData.permalink})`,
                    color: 3447003,
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (error) {
            console.error("Failed to send Discord notification:", error);
        }
    }
}
