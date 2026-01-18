import axios from 'axios';
import FormData from 'form-data';

export class DiscordNotifier {
    private webhookUrl: string | null = null;

    constructor() {
    }

    public setWebhookUrl(url: string | null) {
        this.webhookUrl = url;
    }

    public async sendLog(logData: { permalink: string, id: string, filePath: string, imageBuffer?: Uint8Array, mode?: 'image' | 'embed' }, jsonDetails?: any) {
        if (!this.webhookUrl) {
            console.log("No webhook URL configured, skipping Discord notification.");
            return;
        }

        const mode = logData.imageBuffer ? 'image' : (logData.mode || 'embed');
        console.log(`[Discord] sending log. Mode: ${mode}`);

        try {
            if (mode === 'image' && logData.imageBuffer) {
                // IMAGE MODE: Plain text with suppression + PNG attachment
                const form = new FormData();
                const content = `**${jsonDetails?.fightName || 'Log Uploaded'}**\n<${logData.permalink}>`;

                form.append('payload_json', JSON.stringify({
                    username: "GW2 Arc Log Uploader",
                    content: content
                }));

                form.append('file', Buffer.from(logData.imageBuffer), {
                    filename: 'log_summary.png',
                    contentType: 'image/png'
                });

                await axios.post(this.webhookUrl, form, {
                    headers: form.getHeaders()
                });
                console.log("Sent Discord notification with image.");
            } else {
                // EMBED MODE: Complex Rich Embed based on GitHub reference
                if (jsonDetails && (jsonDetails.evtc || jsonDetails.players)) {
                    console.log('[Discord] Building Complex Rich Embed...');
                    const players = jsonDetails.players || [];
                    let embedFields: any[] = [];

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

                    players.forEach((p: any) => {
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

                    // Build Description
                    let desc = `**Recorded by:** ${jsonDetails.recordedBy || 'Unknown'}\n`;
                    desc += `**Duration:** ${jsonDetails.encounterDuration || 'Unknown'}\n`;
                    desc += `**Elite Insights version:** ${jsonDetails.eliteInsightsVersion || 'Unknown'}\n`;
                    desc += `**arcdps version:** ${jsonDetails.arcVersion || 'Unknown'}\n`;

                    // Line 1: Squad Summary | Team Summary (Enemy)
                    const formatStatLine = (label: string, value: string | number) => {
                        const paddedLabel = label.padEnd(8);
                        return `${paddedLabel}${value}`;
                    };

                    const squadPlayers = players.filter((p: any) => !p.notInSquad);
                    const nonSquadPlayers = players.filter((p: any) => p.notInSquad);

                    const squadSummaryLines = [
                        formatStatLine('Count:', nonSquadPlayers.length > 0 ? `${squadPlayers.length} (+${nonSquadPlayers.length})` : squadPlayers.length),
                        formatStatLine('DMG:', fmtNum(squadDmg)),
                        formatStatLine('DPS:', fmtNum(squadDps)),
                        formatStatLine('Downs:', squadDowns),
                        formatStatLine('Deaths:', squadDeaths)
                    ].join('\n');

                    const enemySummaryLines = [
                        formatStatLine('Count:', players.length),
                        formatStatLine('DMG:', fmtNum(totalDmgTaken)),
                        formatStatLine('DPS:', fmtNum(totalIncomingDps)),
                        formatStatLine('Downs:', totalDowns),  // Changed from Avg as requested
                        formatStatLine('Deaths:', totalDeaths)
                    ].join('\n');

                    embedFields.push({
                        name: "Squad Summary:",
                        value: `\`\`\`\n${squadSummaryLines}\n\`\`\``,
                        inline: true
                    });
                    embedFields.push({
                        name: "Team Summary:",
                        value: `\`\`\`\n${enemySummaryLines}\n\`\`\``,
                        inline: true
                    });
                    embedFields.push({ name: '\u200b', value: '\u200b', inline: false });

                    // Line 2: Incoming Attacks | Incoming CC | Incoming Strips
                    const formatIncoming = (val1: number, val2: number, total: number) => {
                        return [
                            `Miss/Blk:  ${(val1 + val2).toString().padStart(6)}`,
                            `Total:     ${total.toString().padStart(6)}`
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
                        top.forEach((p, i) => {
                            const val = valFn(p);
                            if (val > 0 || (typeof val === 'string' && val !== '0' && val !== '')) {
                                const rank = (i + 1).toString().padEnd(2);
                                const name = (p.character_name || p.account || 'Unknown').substring(0, 14).padEnd(15);
                                const vStr = fmtVal(val).padStart(8);
                                str += `${rank} ${name}${vStr}\n`;
                            }
                        });
                        if (!str) str = "No Data\n";
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
                        (a, b) => (b.statsAll?.[0]?.downContribution || 0) - (a.statsAll?.[0]?.downContribution || 0),
                        p => (p.statsAll?.[0]?.downContribution || 0),
                        v => v.toLocaleString()
                    );
                    embedFields.push({ name: '\u200b', value: '\u200b', inline: false });

                    // Line 4: Healing | Barrier
                    addTopList("Healing",
                        (a, b) => (b.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0) - (a.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0),
                        p => p.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0,
                        v => v.toLocaleString()
                    );
                    addTopList("Barrier",
                        (a, b) => (b.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0) - (a.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0),
                        p => p.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0,
                        v => v.toLocaleString()
                    );
                    embedFields.push({ name: '\u200b', value: '\u200b', inline: false });

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
                    embedFields.push({ name: '\u200b', value: '\u200b', inline: false });

                    // Line 6: CC | Stability
                    addTopList("CC",
                        (a, b) => (b.dpsAll?.[0]?.breakbarDamage || 0) - (a.dpsAll?.[0]?.breakbarDamage || 0),
                        p => p.dpsAll?.[0]?.breakbarDamage || 0,
                        v => Math.round(v).toLocaleString()
                    );
                    addTopList("Stability",
                        (a, b) => {
                            const aStab = a.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0;
                            const bStab = b.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0;
                            return bStab - aStab;
                        },
                        p => p.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0,
                        v => v.toLocaleString()
                    );

                    await axios.post(this.webhookUrl, {
                        username: "GW2 Arc Log Uploader",
                        embeds: [{
                            title: `${jsonDetails.fightName || 'Log Uploaded'}`,
                            url: logData.permalink,
                            description: desc,
                            color: jsonDetails.success ? 3066993 : 15158332,
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: `GW2 Arc Log Uploader • ${new Date().toLocaleTimeString()}`
                            },
                            fields: embedFields
                        }]
                    });
                    console.log("Sent complex Discord notification.");
                } else {
                    // Fallback Simple Embed
                    await axios.post(this.webhookUrl, {
                        username: "GW2 Arc Log Uploader",
                        embeds: [{
                            title: "Log Uploaded",
                            description: `**Log:** [${logData.filePath.split(/[\\\/]/).pop()}](${logData.permalink})`,
                            color: 3447003,
                            timestamp: new Date().toISOString()
                        }]
                    });
                }
            }
        } catch (error) {
            console.error("Failed to send Discord notification:", error);
        }
    }
}
