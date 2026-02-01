import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trophy, Share2, Swords, Shield, Zap, Activity, HelpingHand, ShieldCheck, Map as MapIcon, Users, Skull, Sparkles, Star, UploadCloud, Loader2, CheckCircle2, XCircle, X, ChevronDown, ChevronRight, HeartPulse } from 'lucide-react';
import { toPng } from 'html-to-image';
import { applyStabilityGeneration, getPlayerCleanses, getPlayerStrips, getPlayerDownContribution, getPlayerSquadHealing, getPlayerSquadBarrier, getPlayerOutgoingCrowdControl, getTargetStatTotal } from '../shared/dashboardMetrics';
import { Player, Target } from '../shared/dpsReportTypes';
import { getProfessionColor, getProfessionIconPath } from '../shared/professionUtils';
import { BoonCategory, BoonMetric, buildBoonTables, formatBoonMetricDisplay, getBoonMetricValue } from '../shared/boonGeneration';
import { DEFAULT_DISRUPTION_METHOD, DEFAULT_MVP_WEIGHTS, DEFAULT_STATS_VIEW_SETTINGS, DEFAULT_WEB_UPLOAD_STATE, DisruptionMethod, IMvpWeights, IStatsViewSettings, IWebUploadState } from './global.d';
import { computeOutgoingConditions, normalizeConditionLabel, resolveConditionNameFromEntry, type OutgoingConditionsResult } from '../shared/conditionsMetrics';
import { renderProfessionIcon } from './stats/ui/StatsViewShared';
import { SkillUsageSection } from './stats/sections/SkillUsageSection';
import { ApmSection } from './stats/sections/ApmSection';
import { OffenseSection } from './stats/sections/OffenseSection';
import { ConditionsSection } from './stats/sections/ConditionsSection';
import { BoonOutputSection } from './stats/sections/BoonOutputSection';
import { DefenseSection } from './stats/sections/DefenseSection';
import { SupportSection } from './stats/sections/SupportSection';
import { HealingSection } from './stats/sections/HealingSection';
import { SpecialBuffsSection } from './stats/sections/SpecialBuffsSection';
import { OverviewSection } from './stats/sections/OverviewSection';
import { FightBreakdownSection } from './stats/sections/FightBreakdownSection';
import { TopPlayersSection } from './stats/sections/TopPlayersSection';
import { TopSkillsSection } from './stats/sections/TopSkillsSection';
import { SquadCompositionSection } from './stats/sections/SquadCompositionSection';
import { TimelineSection } from './stats/sections/TimelineSection';
import { MapDistributionSection } from './stats/sections/MapDistributionSection';

interface StatsViewProps {
    logs: ILogData[];
    onBack: () => void;
    mvpWeights?: IMvpWeights;
    statsViewSettings?: IStatsViewSettings;
    webUploadState?: IWebUploadState;
    onWebUpload?: (payload: { meta: any; stats: any }) => Promise<void> | void;
    disruptionMethod?: DisruptionMethod;
    precomputedStats?: any;
    embedded?: boolean;
    sectionVisibility?: (id: string) => boolean;
    dashboardTitle?: string;
    uiTheme?: 'classic' | 'modern';
}

const sidebarListClass = 'max-h-80 overflow-y-auto space-y-1 pr-1';
const NON_DAMAGING_CONDITIONS = new Set([
    'Vulnerability',
    'Weakness',
    'Blind',
    'Cripple',
    'Chill',
    'Immobilize',
    'Slow',
    'Fear',
    'Taunt'
]);

const OFFENSE_METRICS: Array<{
    id: string;
    label: string;
    field?: string;
    isRate?: boolean;
    isPercent?: boolean;
    weightField?: string;
    denomField?: string;
    source?: 'statsTargets' | 'dpsTargets' | 'statsAll' | 'dpsAll';
}> = [
    { id: 'damage', label: 'Damage', field: 'damage', source: 'dpsAll' },
    { id: 'directDmg', label: 'Direct Damage', field: 'directDmg', source: 'statsTargets' },
    { id: 'connectedDamageCount', label: 'Connected Damage Count', field: 'connectedDamageCount', source: 'statsTargets' },
    { id: 'connectedDirectDamageCount', label: 'Connected Direct Damage Count', field: 'connectedDirectDamageCount', source: 'statsTargets' },
    { id: 'criticalRate', label: 'Critical Rate', field: 'criticalRate', isRate: true, isPercent: true, denomField: 'critableDirectDamageCount', source: 'statsTargets' },
    { id: 'criticalDmg', label: 'Critical Damage', field: 'criticalDmg', source: 'statsTargets' },
    { id: 'flankingRate', label: 'Flanking Rate', field: 'flankingRate', isRate: true, isPercent: true, denomField: 'connectedDirectDamageCount', source: 'statsTargets' },
    { id: 'glanceRate', label: 'Glance Rate', field: 'glanceRate', isRate: true, isPercent: true, denomField: 'connectedDirectDamageCount', source: 'statsTargets' },
    { id: 'missed', label: 'Missed', field: 'missed', source: 'statsTargets' },
    { id: 'evaded', label: 'Evaded (enemy)', field: 'evaded', source: 'statsTargets' },
    { id: 'blocked', label: 'Blocked (enemy)', field: 'blocked', source: 'statsTargets' },
    { id: 'interrupts', label: 'Interrupts', field: 'interrupts', source: 'statsTargets' },
    { id: 'invulned', label: 'Invulned', field: 'invulned', source: 'statsTargets' },
    { id: 'killed', label: 'Killed', field: 'killed', source: 'statsTargets' },
    { id: 'downed', label: 'Downed', field: 'downed', source: 'statsTargets' },
    { id: 'downContribution', label: 'Down Contribution', field: 'downContribution', source: 'statsTargets' },
    { id: 'downContributionPercent', label: 'Down Contribution %', isRate: true, isPercent: true },
    { id: 'againstDownedDamage', label: 'Against Downed Damage', field: 'againstDownedDamage', source: 'statsTargets' },
    { id: 'appliedCrowdControl', label: 'Applied CC', field: 'appliedCrowdControl', source: 'statsTargets' },
    { id: 'appliedCrowdControlDuration', label: 'Applied CC Duration', field: 'appliedCrowdControlDuration', source: 'statsTargets' },
    { id: 'appliedCrowdControlDownContribution', label: 'Applied CC Down Contribution', field: 'appliedCrowdControlDownContribution', source: 'statsTargets' },
    { id: 'appliedCrowdControlDurationDownContribution', label: 'Applied CC Duration Down Contribution', field: 'appliedCrowdControlDurationDownContribution', source: 'statsTargets' }
];

const DEFENSE_METRICS: Array<{
    id: string;
    label: string;
    field: string;
    isTimeMs?: boolean;
}> = [
    { id: 'damageTaken', label: 'Damage Taken', field: 'damageTaken' },
    { id: 'damageTakenCount', label: 'Damage Taken Count', field: 'damageTakenCount' },
    { id: 'conditionDamageTaken', label: 'Condition Damage Taken', field: 'conditionDamageTaken' },
    { id: 'conditionDamageTakenCount', label: 'Condition Damage Taken Count', field: 'conditionDamageTakenCount' },
    { id: 'powerDamageTaken', label: 'Power Damage Taken', field: 'powerDamageTaken' },
    { id: 'powerDamageTakenCount', label: 'Power Damage Taken Count', field: 'powerDamageTakenCount' },
    { id: 'downedDamageTaken', label: 'Downed Damage Taken', field: 'downedDamageTaken' },
    { id: 'downedDamageTakenCount', label: 'Downed Damage Taken Count', field: 'downedDamageTakenCount' },
    { id: 'damageBarrier', label: 'Damage Barrier', field: 'damageBarrier' },
    { id: 'damageBarrierCount', label: 'Damage Barrier Count', field: 'damageBarrierCount' },
    { id: 'blockedCount', label: 'Blocked Count', field: 'blockedCount' },
    { id: 'evadedCount', label: 'Evaded Count', field: 'evadedCount' },
    { id: 'missedCount', label: 'Missed Count', field: 'missedCount' },
    { id: 'dodgeCount', label: 'Dodge Count', field: 'dodgeCount' },
    { id: 'invulnedCount', label: 'Invulnerable Count', field: 'invulnedCount' },
    { id: 'interruptedCount', label: 'Interrupted Count', field: 'interruptedCount' },
    { id: 'downCount', label: 'Down Count', field: 'downCount' },
    { id: 'deadCount', label: 'Death Count', field: 'deadCount' },
    { id: 'boonStrips', label: 'Boon Strips (Incoming)', field: 'boonStrips' },
    { id: 'conditionCleanses', label: 'Cleanses (Incoming)', field: 'conditionCleanses' },
    { id: 'receivedCrowdControl', label: 'Crowd Control (Incoming)', field: 'receivedCrowdControl' }
];

const SUPPORT_METRICS: Array<{
    id: string;
    label: string;
    field: string;
    isTime?: boolean;
}> = [
    { id: 'condiCleanse', label: 'Condition Cleanses', field: 'condiCleanse' },
    { id: 'condiCleanseTime', label: 'Condition Cleanse Time', field: 'condiCleanseTime', isTime: true },
    { id: 'condiCleanseSelf', label: 'Condition Cleanse Self', field: 'condiCleanseSelf' },
    { id: 'condiCleanseTimeSelf', label: 'Condition Cleanse Time Self', field: 'condiCleanseTimeSelf', isTime: true },
    { id: 'boonStrips', label: 'Boon Strips', field: 'boonStrips' },
    { id: 'boonStripsTime', label: 'Boon Strips Time', field: 'boonStripsTime', isTime: true },
    { id: 'boonStripDownContribution', label: 'Boon Strip Down Contribution', field: 'boonStripDownContribution' },
    { id: 'boonStripDownContributionTime', label: 'Boon Strip Down Contribution Time', field: 'boonStripDownContributionTime', isTime: true },
    { id: 'stunBreak', label: 'Stun Breaks', field: 'stunBreak' },
    { id: 'removedStunDuration', label: 'Removed Stun Duration', field: 'removedStunDuration', isTime: true },
    { id: 'resurrects', label: 'Resurrects', field: 'resurrects' },
    { id: 'resurrectTime', label: 'Resurrect Time', field: 'resurrectTime', isTime: true }
];

const HEALING_METRICS: Array<{
    id: string;
    label: string;
    baseField: 'healing' | 'barrier' | 'downedHealing' | 'resUtility';
    perSecond: boolean;
    decimals: number;
}> = [
    { id: 'healing', label: 'Healing', baseField: 'healing', perSecond: false, decimals: 0 },
    { id: 'healingPerSecond', label: 'Healing Per Second', baseField: 'healing', perSecond: true, decimals: 2 },
    { id: 'barrier', label: 'Barrier', baseField: 'barrier', perSecond: false, decimals: 0 },
    { id: 'barrierPerSecond', label: 'Barrier Per Second', baseField: 'barrier', perSecond: true, decimals: 2 },
    { id: 'downedHealing', label: 'Downed Healing', baseField: 'downedHealing', perSecond: false, decimals: 0 },
    { id: 'downedHealingPerSecond', label: 'Downed Healing Per Second', baseField: 'downedHealing', perSecond: true, decimals: 1 },
    { id: 'resUtility', label: 'Resurrect Utility', baseField: 'resUtility', perSecond: false, decimals: 0 }
];

const RES_UTILITY_NAME_MATCHES = [
    'battle standard',
    'glyph of renewal',
    'glyph of the stars',
    'illusion of life',
    'spirit of nature',
    'nature spirit',
    'search and rescue',
    'signet of mercy'
];

const RES_UTILITY_IDS = new Set<number>([10244]);

const isResUtilitySkill = (id: number, skillMap: Record<string, { name?: string }> | undefined) => {
    if (RES_UTILITY_IDS.has(id)) {
        return true;
    }
    const entry = skillMap?.[`s${id}`] || skillMap?.[`${id}`];
    const name = entry?.name?.toLowerCase() || '';
    return RES_UTILITY_NAME_MATCHES.some((match) => name.includes(match));
};

const isAutoAttackName = (name: string) => {
    const lowered = name.toLowerCase();
    return lowered.includes('autoattack') || lowered.includes('auto attack');
};

interface SkillUsagePlayer {
    key: string;
    account: string;
    displayName: string;
    profession: string;
    professionList: string[];
    logs: number;
    totalActiveSeconds?: number;
    skillTotals: Record<string, number>;
}

interface SkillOption {
    id: string;
    name: string;
    total: number;
    autoAttack?: boolean;
}

interface SkillUsageLogRecord {
    id: string;
    label: string;
    timestamp: number;
    skillEntries: Record<string, { name: string; players: Record<string, number> }>;
    playerActiveSeconds?: Record<string, number>;
    durationSeconds?: number;
}

interface SkillUsageSummary {
    logRecords: SkillUsageLogRecord[];
    players: SkillUsagePlayer[];
    skillOptions: SkillOption[];
    resUtilitySkills?: Array<{ id: string; name: string }>;
}

interface ApmPlayerRow {
    key: string;
    account: string;
    displayName: string;
    profession: string;
    professionList: string[];
    logs: number;
    totalActiveSeconds: number;
    totalCasts: number;
    totalAutoCasts: number;
    apm: number;
    apmNoAuto: number;
    aps: number;
    apsNoAuto: number;
}

interface ApmSkillEntry {
    id: string;
    name: string;
    totalCasts: number;
    playerCounts: Map<string, number>;
}

interface ApmSpecBucket {
    profession: string;
    players: SkillUsagePlayer[];
    playerRows: ApmPlayerRow[];
    totalActiveSeconds: number;
    totalCasts: number;
    totalAutoCasts: number;
    skillMap: Map<string, ApmSkillEntry>;
}

export function StatsView({ logs, onBack, mvpWeights, statsViewSettings, webUploadState, onWebUpload, disruptionMethod, precomputedStats, embedded = false, sectionVisibility, dashboardTitle, uiTheme }: StatsViewProps) {
    const method = disruptionMethod || DEFAULT_DISRUPTION_METHOD;
    const activeMvpWeights = mvpWeights || DEFAULT_MVP_WEIGHTS;
    const activeStatsViewSettings = statsViewSettings || DEFAULT_STATS_VIEW_SETTINGS;
    const activeWebUploadState = webUploadState || DEFAULT_WEB_UPLOAD_STATE;
    const showTopStats = activeStatsViewSettings.showTopStats;
    const showMvp = activeStatsViewSettings.showMvp;
    const roundCountStats = activeStatsViewSettings.roundCountStats;
    const topStatsMode = activeStatsViewSettings.topStatsMode || 'total';
    const uploadingWeb = activeWebUploadState.uploading;
    const webUploadMessage = activeWebUploadState.message;
    const webUploadUrl = activeWebUploadState.url;
    const webUploadBuildStatus = activeWebUploadState.buildStatus;
    const devMockAvailable = !embedded && import.meta.env.DEV && !!window.electronAPI?.mockWebReport;
    const mvpStatWeightKeys: Record<string, keyof IMvpWeights> = {
        'Down Contribution': 'downContribution',
        'Healing': 'healing',
        'Cleanses': 'cleanses',
        'Strips': 'strips',
        'Stability': 'stability',
        'CC': 'cc',
        'Revives': 'revives',
        'Distance to Tag': 'distanceToTag',
        'Participation': 'participation',
        'Dodging': 'dodging',
        'DPS': 'dps',
        'Damage': 'damage'
    };
    const isMvpStatEnabled = (name: string) => {
        const key = mvpStatWeightKeys[name];
        if (!key) return true;
        return activeMvpWeights[key] > 0;
    };
    const [sharing, setSharing] = useState(false);
    const [devMockUploadState, setDevMockUploadState] = useState<{
        uploading: boolean;
        message: string | null;
        url: string | null;
    }>({ uploading: false, message: null, url: null });
    const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
    const [activeBoonTab, setActiveBoonTab] = useState<string | null>(null);
    const [activeBoonCategory, setActiveBoonCategory] = useState<BoonCategory>('totalBuffs');
    const [activeBoonMetric, setActiveBoonMetric] = useState<BoonMetric>('total');
    const [boonSearch, setBoonSearch] = useState('');
    const [activeSpecialTab, setActiveSpecialTab] = useState<string | null>(null);
    const [specialSearch, setSpecialSearch] = useState('');
    const [offenseSearch, setOffenseSearch] = useState('');
    const [defenseSearch, setDefenseSearch] = useState('');
    const [conditionSearch, setConditionSearch] = useState('');
    const [conditionDirection, setConditionDirection] = useState<'outgoing' | 'incoming'>('outgoing');
    const [supportSearch, setSupportSearch] = useState('');
    const [activeOffenseStat, setActiveOffenseStat] = useState<string>('damage');
    const [activeDefenseStat, setActiveDefenseStat] = useState<string>('damageTaken');
    const [activeConditionName, setActiveConditionName] = useState<string>('all');
    const [conditionSort, setConditionSort] = useState<{ key: 'applications' | 'damage'; dir: 'asc' | 'desc' }>({
        key: 'damage',
        dir: 'desc'
    });
    const isNonDamagingCondition = activeConditionName !== 'all' && NON_DAMAGING_CONDITIONS.has(activeConditionName);
    const showConditionDamage = !isNonDamagingCondition;
    const conditionGridClass = showConditionDamage
        ? 'grid-cols-[0.4fr_1.6fr_1fr_1fr]'
        : 'grid-cols-[0.4fr_1.6fr_1fr]';
    const effectiveConditionSort = showConditionDamage
        ? conditionSort
        : { key: 'applications', dir: conditionSort.key === 'applications' ? conditionSort.dir : 'desc' };
    const [activeSupportStat, setActiveSupportStat] = useState<string>('condiCleanse');
    const [activeHealingMetric, setActiveHealingMetric] = useState<string>('healing');
    const [healingCategory, setHealingCategory] = useState<'total' | 'squad' | 'group' | 'self' | 'offSquad'>('total');
    const [activeResUtilitySkill, setActiveResUtilitySkill] = useState<string>('all');
    const [offenseViewMode, setOffenseViewMode] = useState<'total' | 'per1s' | 'per60s'>('total');
    const [defenseViewMode, setDefenseViewMode] = useState<'total' | 'per1s' | 'per60s'>('total');
    const [supportViewMode, setSupportViewMode] = useState<'total' | 'per1s' | 'per60s'>('total');
    const [cleanseScope, setCleanseScope] = useState<'squad' | 'all'>('all');
    const [timelineFriendlyScope, setTimelineFriendlyScope] = useState<'squad' | 'squadAllies'>('squad');
    const [webCopyStatus, setWebCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [skillUsagePlayerFilter, setSkillUsagePlayerFilter] = useState('');
    const [skillUsageSkillFilter, setSkillUsageSkillFilter] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [hoveredSkillPlayer, setHoveredSkillPlayer] = useState<string[]>([]);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [expandedSectionClosing, setExpandedSectionClosing] = useState(false);
    const expandedCloseTimerRef = useRef<number | null>(null);
    const [fightBreakdownTab, setFightBreakdownTab] = useState<'sizes' | 'outcomes' | 'damage' | 'barrier'>('sizes');
    const [skillUsageView, setSkillUsageView] = useState<'total' | 'perSecond'>('total');
    const [expandedSkillUsageClass, setExpandedSkillUsageClass] = useState<string | null>(null);
    const [apmView, setApmView] = useState<'total' | 'perSecond'>('total');
    const [activeApmSpec, setActiveApmSpec] = useState<string | null>(null);
    const [expandedApmSpec, setExpandedApmSpec] = useState<string | null>(null);
    const [activeApmSkillId, setActiveApmSkillId] = useState<string | null>(null);
    const [apmSkillSearch, setApmSkillSearch] = useState('');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [activeNavId, setActiveNavId] = useState('overview');
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const scrollRafRef = useRef<number | null>(null);
    const scrollDeltaRef = useRef(0);

    const formatWithCommas = (value: number, decimals = 2) =>
        value.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    const formatTopStatValue = (value: number) => {
        if (!Number.isFinite(value)) return '--';
        const absValue = Math.abs(value);
        if (absValue >= 1_000_000) {
            const compact = (value / 1_000_000);
            const formatted = compact.toFixed(2).replace(/\.?0+$/, '');
            return `${formatted}m`;
        }
        return Math.round(value).toLocaleString();
    };

    const formatDurationMs = (durationMs?: number) => {
        if (!durationMs || !Number.isFinite(durationMs)) return '--:--';
        const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const isSectionVisible = (id: string) => (sectionVisibility ? sectionVisibility(id) : true);
    const sectionClass = (id: string, base: string) => {
        const visible = isSectionVisible(id);
        return `${base} transition-[opacity,transform] duration-700 ease-in-out ${visible
            ? 'opacity-100 translate-y-0 max-h-[99999px]'
            : 'opacity-0 -translate-y-2 max-h-0 h-0 min-h-0 overflow-hidden pointer-events-none p-0 !p-0 m-0 !mb-0 !mt-0 border-0 !border-0 border-transparent'}`;
    };
    const orderedSectionIds = [
        'overview',
        'fight-breakdown',
        'top-players',
        'top-skills-outgoing',
        'squad-composition',
        'timeline',
        'map-distribution',
        'boon-output',
        'offense-detailed',
        'conditions-outgoing',
        'defense-detailed',
        'support-detailed',
        'healing-stats',
        'special-buffs',
        'skill-usage',
        'apm-stats'
    ];
    const firstVisibleSectionId = orderedSectionIds.find((id) => isSectionVisible(id)) || null;
    const isFirstVisibleSection = (id: string) => id === firstVisibleSectionId;

    const tocItems = useMemo(() => ([
        { id: 'overview', label: 'Overview', icon: Trophy },
        { id: 'top-players', label: 'Top Players', icon: Trophy },
        { id: 'top-skills-outgoing', label: 'Top Skills', icon: Swords },
        { id: 'timeline', label: 'Squad vs Enemy', icon: Users },
        { id: 'map-distribution', label: 'Map Distribution', icon: MapIcon },
        { id: 'boon-output', label: 'Boon Output', icon: ShieldCheck },
        { id: 'offense-detailed', label: 'Offense Detailed', icon: Swords },
        { id: 'conditions-outgoing', label: 'Conditions', icon: Skull },
        { id: 'defense-detailed', label: 'Defense Detailed', icon: Shield },
        { id: 'support-detailed', label: 'Support Detailed', icon: HelpingHand },
        { id: 'healing-stats', label: 'Healing Stats', icon: HeartPulse },
        { id: 'special-buffs', label: 'Special Buffs', icon: Star },
        { id: 'skill-usage', label: 'Skill Usage', icon: Zap },
        { id: 'apm-stats', label: 'APM Breakdown', icon: Activity }
    ]), []);

    const scrollToSection = (id: string) => {
        const targetId = id === 'kdr' ? 'overview' : id;
        const container = scrollContainerRef.current;
        const node = document.getElementById(targetId);
        if (container && node) {
            const containerRect = container.getBoundingClientRect();
            const nodeRect = node.getBoundingClientRect();
            const rawTop = nodeRect.top - containerRect.top + container.scrollTop;
            const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
            const nextTop = Math.min(Math.max(rawTop - 16, 0), maxTop);
            container.scrollTo({ top: nextTop, behavior: 'smooth' });
            setActiveNavId(targetId);
        } else if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveNavId(targetId);
        }
        setMobileNavOpen(false);
    };

    useEffect(() => {
        if (embedded) return;
        const onWheel = (event: WheelEvent) => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const target = event.target as Node | null;
            if (target && container.contains(target)) return;
            if (event.deltaY === 0) return;
            if (container.scrollHeight <= container.clientHeight) return;
            scrollDeltaRef.current += event.deltaY;
            if (scrollRafRef.current === null) {
                const tick = () => {
                    const current = scrollDeltaRef.current;
                    if (Math.abs(current) < 0.5) {
                        scrollDeltaRef.current = 0;
                        scrollRafRef.current = null;
                        return;
                    }
                    const step = current * 0.2;
                    scrollDeltaRef.current = current - step;
                    container.scrollBy({ top: step, behavior: 'auto' });
                    scrollRafRef.current = requestAnimationFrame(tick);
                };
                scrollRafRef.current = requestAnimationFrame(tick);
            }
            event.preventDefault();
        };
        window.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', onWheel);
            if (scrollRafRef.current !== null) {
                cancelAnimationFrame(scrollRafRef.current);
                scrollRafRef.current = null;
            }
            scrollDeltaRef.current = 0;
        };
    }, [embedded]);

    const stepSection = (direction: -1 | 1) => {
        const currentIndex = Math.max(0, tocItems.findIndex((item) => item.id === activeNavId));
        const nextIndex = Math.min(Math.max(currentIndex + direction, 0), tocItems.length - 1);
        const nextId = tocItems[nextIndex]?.id;
        if (nextId) scrollToSection(nextId);
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        let raf = 0;
        const updateActiveSection = () => {
            const containerTop = container.getBoundingClientRect().top;
            let currentId = tocItems[0]?.id || 'overview';
            tocItems.forEach((item) => {
                const el = document.getElementById(item.id);
                if (!el) return;
                const offset = el.getBoundingClientRect().top - containerTop;
                if (offset <= 24) {
                    currentId = item.id;
                }
            });
            setActiveNavId((prev) => (prev === currentId ? prev : currentId));
        };
        const onScroll = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateActiveSection);
        };
        updateActiveSection();
        container.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            container.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [tocItems]);

    const getFightDurationLabel = (details: any, log: any) => {
        const candidates = [details?.encounterDuration, details?.duration, log?.encounterDuration];
        for (const candidate of candidates) {
            if (candidate === undefined || candidate === null) continue;
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                return formatDurationMs(candidate);
            }
            if (typeof candidate === 'string') {
                const trimmed = candidate.trim();
                if (!trimmed) continue;
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
                    return trimmed;
                }
                const hmsMatch = trimmed.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*ms)?$/i);
                if (hmsMatch) {
                    const hours = Number(hmsMatch[1] || 0);
                    const minutes = Number(hmsMatch[2] || 0);
                    const seconds = Number(hmsMatch[3] || 0);
                    const ms = Number(hmsMatch[4] || 0);
                    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
                    if (totalMs > 0) {
                        return formatDurationMs(totalMs);
                    }
                }
                const msMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*ms$/i);
                if (msMatch) {
                    return formatDurationMs(Number(msMatch[1]));
                }
                const msWordMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(milliseconds?|msec|msecs)$/i);
                if (msWordMatch) {
                    return formatDurationMs(Number(msWordMatch[1]));
                }
                const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?)$/i);
                if (secMatch) {
                    return formatDurationMs(Number(secMatch[1]) * 1000);
                }
                if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
                    return formatDurationMs(Number(trimmed));
                }
                return trimmed;
            }
        }
        return formatDurationMs(details?.durationMS);
    };

    const shortenFightLabel = (label: string) => {
        const normalized = label.trim();
        const lowered = normalized.toLowerCase();
        if (lowered.includes('eternal battleground')) return 'EBG';
        if (lowered.includes('green borderlands') || lowered.includes('green alpine borderlands')) return 'Green BL';
        if (lowered.includes('blue borderlands') || lowered.includes('blue alpine borderlands')) return 'Blue BL';
        if (lowered.includes('red borderlands') || lowered.includes('red desert borderlands')) return 'Red BL';
        return normalized;
    };

    const formatFightDateTime = (details: any, log: any) => {
        const raw = details?.timeStartStd || details?.timeStart || details?.timeEndStd || details?.timeEnd;
        let date: Date | null = null;
        if (typeof raw === 'string') {
            const parsed = Date.parse(raw);
            if (!Number.isNaN(parsed)) {
                date = new Date(parsed);
            }
        } else if (typeof raw === 'number' && Number.isFinite(raw)) {
            date = new Date(raw * 1000);
        } else if (typeof details?.uploadTime === 'number') {
            date = new Date(details.uploadTime * 1000);
        } else if (typeof log?.uploadTime === 'number') {
            date = new Date(log.uploadTime * 1000);
        }
        if (!date) return '';
        return date.toLocaleString(undefined, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const validLogs = useMemo(() => logs.filter(l => (l.status === 'success' || l.status === 'discord') && l.details), [logs]);
    const stats = useMemo(() => {
        if (precomputedStats) {
            return precomputedStats;
        }
        const total = validLogs.length;

        // Wins/Losses (Combat Stat Based)
        let wins = 0;
        let losses = 0;

        // --- Player Aggregation ---
        interface PlayerStats {
            name: string;
            account: string;
            downContrib: number;
            cleanses: number;
            strips: number;
            stab: number;
            healing: number;
            barrier: number;
            cc: number;
            logsJoined: number;
            totalDist: number;
            distCount: number;
            dodges: number;
            downs: number;
            deaths: number;
            totalFightMs: number;
            offenseTotals: Record<string, number>;
            offenseRateWeights: Record<string, number>;
            defenseActiveMs: number;
            defenseTotals: Record<string, number>;
            supportActiveMs: number;
            supportTotals: Record<string, number>;
            healingActiveMs: number;
            healingTotals: Record<string, number>;
            profession: string;
            professions: Set<string>;
            professionList?: string[];
            professionTimeMs: Record<string, number>;
            isCommander: boolean;
            damage: number;
            dps: number;
            revives: number;
            outgoingConditions: Record<string, {
                applications: number;
                damage: number;
                skills: Record<string, { name: string; hits: number; damage: number }>;
                applicationsFromBuffs?: number;
                applicationsFromBuffsActive?: number;
            }>;
            incomingConditions: Record<string, {
                applications: number;
                damage: number;
                skills: Record<string, { name: string; hits: number; damage: number }>;
            }>;
        }

        const playerStats = new Map<string, PlayerStats>();
        const supportTimeSanityFields = new Set(['boonStripsTime', 'condiCleanseTime', 'condiCleanseTimeSelf']);

        // --- Skill Aggregation ---
        // skillId -> { name, damage, hits }
        const skillDamageMap: Record<number, { name: string, damage: number, hits: number }> = {};
        const outgoingCondiTotals: Record<string, { name: string; applications: number; damage: number; applicationsFromBuffs?: number; applicationsFromBuffsActive?: number }> = {};
        const incomingCondiTotals: Record<string, { name: string; applications: number; damage: number }> = {};
        const incomingSkillDamageMap: Record<number, { name: string, damage: number, hits: number }> = {};

        let totalSquadSizeAccum = 0;
        let totalEnemiesAccum = 0;

        // KDR Tracking
        let totalSquadDeaths = 0;
        let totalSquadKills = 0; // Enemies we killed
        let totalEnemyDeaths = 0; // Same as squad kills, but from enemy perspective
        let totalEnemyKills = 0; // How many of us they killed

        validLogs.forEach(log => {
            const details = log.details;
            if (!details) return;
            const players = details.players as unknown as Player[];
            const targets = details.targets || [];
            const conditionDetails = details;
            const conditionPlayers = (conditionDetails?.players as unknown as Player[]) || players;
            const conditionTargets = conditionDetails?.targets || targets;
            const conditionSkillMap = conditionDetails?.skillMap || details.skillMap;
            const conditionBuffMap = conditionDetails?.buffMap || details.buffMap;
            const replayMeta = (details as any).combatReplayMetaData || {};
            const inchesToPixel = typeof replayMeta?.inchToPixel === 'number' && replayMeta.inchToPixel > 0
                ? replayMeta.inchToPixel
                : 1;
            const pollingRate = typeof replayMeta?.pollingRate === 'number' && replayMeta.pollingRate > 0
                ? replayMeta.pollingRate
                : 1;
            const RUN_BACK_RANGE = 5000;

            const toPairs = (value: any): Array<[number, number]> => {
                if (!Array.isArray(value)) return [];
                return value
                    .map((entry) => (Array.isArray(entry) ? [Number(entry[0]), Number(entry[1])] as [number, number] : null))
                    .filter((entry): entry is [number, number] => {
                        if (!entry) return false;
                        return Number.isFinite(entry[0]) && Number.isFinite(entry[1]);
                    });
            };

            let commanderTagPositions: Array<[number, number]> = [];
            let deadTagMark = details.durationMS || 0;
            let deadTag = false;
            const commanderPlayer = players.find((player: any) => player?.hasCommanderTag && !player?.notInSquad);
            if (commanderPlayer?.combatReplayData?.positions) {
                commanderTagPositions = commanderPlayer.combatReplayData.positions as Array<[number, number]>;
                const commanderDeaths = toPairs(commanderPlayer.combatReplayData.dead);
                commanderDeaths.forEach(([deathTime]) => {
                    if (deathTime > 0) {
                        deadTag = true;
                        deadTagMark = Math.min(deadTagMark, deathTime);
                    }
                });
            }

            const avgDistance = (
                positions: Array<[number, number]>,
                tagPositions: Array<[number, number]>,
                poll: number,
            ) => {
                const limit = Math.max(0, Math.min(poll, positions.length, tagPositions.length));
                if (limit <= 0) return 0;
                let sum = 0;
                for (let i = 0; i < limit; i += 1) {
                    const [px, py] = positions[i];
                    const [tx, ty] = tagPositions[i];
                    sum += Math.hypot(px - tx, py - ty);
                }
                return Math.round((sum / limit) / inchesToPixel);
            };

            const getDistanceToTag = (p: any) => {
                const stats = p.statsAll?.[0];
                const distToCom = stats?.distToCom;
                const stackDist = stats?.stackDist;
                let playerDistToTag = 0;
                if (distToCom !== undefined && distToCom !== null) {
                    playerDistToTag = distToCom === 'Infinity' ? 0 : Math.round(Number(distToCom));
                } else if (stackDist !== undefined && stackDist !== null) {
                    playerDistToTag = Math.round(Number(stackDist)) || 0;
                }
                if (p.hasCommanderTag) {
                    return 0;
                }

                const combatData = p.combatReplayData;
                if (!combatData?.positions || !commanderTagPositions.length) {
                    return playerDistToTag;
                }

                const playerPositions = combatData.positions as Array<[number, number]>;
                const playerDeaths = toPairs(combatData.dead);
                const playerDowns = toPairs(combatData.down);
                const playerOffset = Math.floor((combatData.start || 0) / pollingRate);

                if (playerDeaths.length && playerDowns.length) {
                    for (const [deathKey] of playerDeaths) {
                        if (deathKey < 0) continue;
                        const positionMark = Math.max(0, Math.floor(deathKey / pollingRate)) - playerOffset;
                        for (const [downKey, downValue] of playerDowns) {
                            if (deathKey !== downValue) continue;
                            const playerDeadPoll = deadTag && downKey > deadTagMark
                                ? Math.max(1, Math.floor(deadTagMark / pollingRate))
                                : positionMark;
                            playerDistToTag = avgDistance(playerPositions, commanderTagPositions, playerDeadPoll);
                        }
                    }
                }

                return playerDistToTag;
            };

            // Squad/Enemy Counts
            const squadPlayers = players.filter(p => !p.notInSquad);
            const squadCount = squadPlayers.length;
            const enemyCount = targets.filter((t: any) => !t.isFake).length;
            totalSquadSizeAccum += squadCount;
            totalEnemiesAccum += enemyCount;

            applyStabilityGeneration(players, { durationMS: details.durationMS, buffMap: details.buffMap });

            // 1. Calculate Win/Loss based on Downs/Deaths
            let squadDownsDeaths = 0;
            let enemyDownsDeaths = 0;

            // Squad Downs/Deaths - from our players' defenses
            let logSquadDeaths = 0;
            players.forEach(p => {
                if (!p.notInSquad && p.defenses && p.defenses.length > 0) {
                    squadDownsDeaths += (p.defenses[0].downCount || 0) + (p.defenses[0].deadCount || 0);
                    logSquadDeaths += p.defenses[0].deadCount || 0;
                }
            });
            totalSquadDeaths += logSquadDeaths;
            totalEnemyKills += logSquadDeaths; // Enemy killed us

            // Enemy Downs/Deaths - from statsTargets (what WE did to them)
            let logEnemyKills = 0;
            players.forEach((p: any) => {
                if (p.notInSquad) return;
                if (p.statsTargets && p.statsTargets.length > 0) {
                    p.statsTargets.forEach((targetStats: any) => {
                        if (targetStats && targetStats.length > 0) {
                            const st = targetStats[0];
                            enemyDownsDeaths += (st.downed || 0) + (st.killed || 0);
                            logEnemyKills += st.killed || 0;
                        }
                    });
                }
            });
            totalSquadKills += logEnemyKills;
            totalEnemyDeaths += logEnemyKills;

            if (squadDownsDeaths < enemyDownsDeaths) {
                wins++;
            } else {
                losses++;
            }

            players.forEach(p => {
                // Only process squad members, not allies
                if (p.notInSquad) return;

                // Determine Identity
                const account = p.account || 'Unknown';
                // We key by account to aggregate totals across characters
                const key = account !== 'Unknown' ? account : (p.name || 'Unknown');
                const name = p.name || 'Unknown'; // Helper name (last seen character name usually)

                if (!playerStats.has(key)) {
                    playerStats.set(key, {
                        name: name,
                        account: account !== 'Unknown' ? account : name,
                        downContrib: 0,
                        cleanses: 0,
                        strips: 0,
                        stab: 0,
                        healing: 0,
                        barrier: 0,
                        cc: 0,
                        logsJoined: 0,
                        totalDist: 0,
                        distCount: 0,
                        dodges: 0,
                        downs: 0,
                        deaths: 0,
                        totalFightMs: 0,
                        offenseTotals: {},
                        offenseRateWeights: {},
                        defenseActiveMs: 0,
                        defenseTotals: {},
                        supportActiveMs: 0,
                        supportTotals: {},
                        healingActiveMs: 0,
                        healingTotals: {},
                        professions: new Set<string>(),
                        professionTimeMs: {} as Record<string, number>,
                        profession: p.profession || 'Unknown',
                        isCommander: false,
                        damage: 0,
                        dps: 0,
                        revives: 0,
                        outgoingConditions: {},
                        incomingConditions: {}
                    });
                }

                const s = playerStats.get(key)!;
                if (p.hasCommanderTag) {
                    s.isCommander = true;
                }
                if (p.profession) {
                    s.profession = p.profession;
                    if (p.profession && p.profession !== 'Unknown') {
                        s.professions.add(p.profession);
                        const activeMs = Array.isArray(p.activeTimes) && typeof p.activeTimes[0] === 'number'
                            ? p.activeTimes[0]
                            : details.durationMS || 0;
                        s.professionTimeMs[p.profession] = (s.professionTimeMs[p.profession] || 0) + activeMs;
                    }
                }
                s.logsJoined++;

                // Aggregate Metrics
                // Down Contribution
                s.downContrib += getPlayerDownContribution(p);

                // Support: Cleanses and Strips (EI support stats)
                s.cleanses += getPlayerCleanses(p);
                s.strips += getPlayerStrips(p, method);

                s.healing += getPlayerSquadHealing(p);
                s.barrier += getPlayerSquadBarrier(p);
                s.cc += getPlayerOutgoingCrowdControl(p, method);
                s.stab += p.stabGeneration || 0;

                // Stack Distance (Distance to Tag)
        // statsAll[0] contains the stackDist field in hosted JSON
                const dist = getDistanceToTag(p);
                if (dist <= RUN_BACK_RANGE) {
                    s.totalDist += dist;
                    s.distCount++;
                }

                // Dodges
                if (p.defenses && p.defenses.length > 0) {
                    s.dodges += p.defenses[0].dodgeCount || 0;
                    s.downs += p.defenses[0].downCount || 0;
                    s.deaths += p.defenses[0].deadCount || 0;
                }

                if (details.durationMS) {
                    s.totalFightMs += details.durationMS;
                }
                const activeMs = Array.isArray(p.activeTimes) && typeof p.activeTimes[0] === 'number'
                    ? p.activeTimes[0]
                    : details.durationMS || 0;
                s.defenseActiveMs += activeMs;
                s.supportActiveMs += activeMs;
                s.healingActiveMs += activeMs;

                if (p.defenses && p.defenses.length > 0) {
                    const defenses = p.defenses[0] as any;
                    DEFENSE_METRICS.forEach((metric) => {
                        const value = Number(defenses[metric.field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        s.defenseTotals[metric.id] = (s.defenseTotals[metric.id] || 0) + value;
                    });
                }

                if (p.support && p.support.length > 0) {
                    const support = p.support[0] as any;
                    SUPPORT_METRICS.forEach((metric) => {
                        let value = Number(support[metric.field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        if (supportTimeSanityFields.has(metric.field) && value > 999999) {
                            value = 0;
                        }
                        s.supportTotals[metric.id] = (s.supportTotals[metric.id] || 0) + value;
                    });
                }

                const addHealingTotal = (key: string, value: number) => {
                    if (!Number.isFinite(value)) return;
                    s.healingTotals[key] = (s.healingTotals[key] || 0) + value;
                };

                if (Array.isArray(p.rotation)) {
                    let resUtilityCasts = 0;
                    p.rotation.forEach((rotationSkill: any) => {
                        if (!rotationSkill || typeof rotationSkill.id !== 'number') {
                            return;
                        }
                        if (!isResUtilitySkill(rotationSkill.id, details.skillMap)) {
                            return;
                        }
                        const castCount = Array.isArray(rotationSkill.skills) ? rotationSkill.skills.length : 0;
                        if (!Number.isFinite(castCount) || castCount <= 0) {
                            return;
                        }
                        resUtilityCasts += castCount;
                        addHealingTotal(`resUtility_s${rotationSkill.id}`, castCount);
                    });
                    if (resUtilityCasts > 0) {
                        addHealingTotal('resUtility', resUtilityCasts);
                    }
                }

                if (p.extHealingStats?.outgoingHealingAllies && Array.isArray(p.extHealingStats.outgoingHealingAllies)) {
                    const healerName = p.name || '';
                    const healerGroup = p.group;
                    p.extHealingStats.outgoingHealingAllies.forEach((healTarget, index) => {
                        const targetPlayer = players[index];
                        if (!targetPlayer) return;
                        const phase = Array.isArray(healTarget) ? healTarget[0] : null;
                        if (!phase) return;
                        const totalHealing = Number(phase.healing ?? 0);
                        const downedHealing = Number(phase.downedHealing ?? 0);
                        if (!Number.isFinite(totalHealing) || !Number.isFinite(downedHealing)) return;
                        const outgoingHealing = totalHealing - downedHealing;
                        if (!(outgoingHealing || downedHealing)) return;

                        addHealingTotal('healing', outgoingHealing);
                        addHealingTotal('downedHealing', downedHealing);

                        if (targetPlayer.notInSquad) {
                            addHealingTotal('offSquadHealing', outgoingHealing);
                            addHealingTotal('offSquadDownedHealing', downedHealing);
                        } else {
                            addHealingTotal('squadHealing', outgoingHealing);
                            addHealingTotal('squadDownedHealing', downedHealing);
                        }

                        if (targetPlayer.group === healerGroup) {
                            addHealingTotal('groupHealing', outgoingHealing);
                            addHealingTotal('groupDownedHealing', downedHealing);
                        }

                        if (targetPlayer.name === healerName) {
                            addHealingTotal('selfHealing', outgoingHealing);
                            addHealingTotal('selfDownedHealing', downedHealing);
                        }
                    });
                }

                if (p.extBarrierStats?.outgoingBarrierAllies && Array.isArray(p.extBarrierStats.outgoingBarrierAllies)) {
                    const healerName = p.name || '';
                    const healerGroup = p.group;
                    p.extBarrierStats.outgoingBarrierAllies.forEach((barrierTarget, index) => {
                        const targetPlayer = players[index];
                        if (!targetPlayer) return;
                        const phase = Array.isArray(barrierTarget) ? barrierTarget[0] : null;
                        if (!phase) return;
                        const outgoingBarrier = Number(phase.barrier ?? 0);
                        if (!Number.isFinite(outgoingBarrier) || outgoingBarrier === 0) return;

                        addHealingTotal('barrier', outgoingBarrier);

                        if (targetPlayer.notInSquad) {
                            addHealingTotal('offSquadBarrier', outgoingBarrier);
                        } else {
                            addHealingTotal('squadBarrier', outgoingBarrier);
                        }

                        if (targetPlayer.group === healerGroup) {
                            addHealingTotal('groupBarrier', outgoingBarrier);
                        }

                        if (targetPlayer.name === healerName) {
                            addHealingTotal('selfBarrier', outgoingBarrier);
                        }
                    });
                }

                const statsTargetsList = Array.isArray(p.statsTargets) ? p.statsTargets : [];
                const dpsTargetsList = Array.isArray(p.dpsTargets) ? p.dpsTargets : [];
                const statsAll = (p.statsAll && p.statsAll.length > 0) ? (p.statsAll[0] as any) : null;
                const dpsAll = (p.dpsAll && p.dpsAll.length > 0) ? (p.dpsAll[0] as any) : null;

                OFFENSE_METRICS.forEach((metric) => {
                    if (metric.id === 'downContributionPercent') {
                        return;
                    }
                    const field = metric.field;
                    if (!field) return;
                    const source = metric.source || 'statsTargets';
                    if (source === 'statsAll') {
                        if (!statsAll) return;
                        let value = Number(statsAll[field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        if (metric.isRate) {
                            const denomField = metric.denomField || metric.weightField;
                            const denom = Number(statsAll[denomField || 'connectedDamageCount'] ?? 0);
                            if (denom > 0) {
                                s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                                s.offenseRateWeights[metric.id] = (s.offenseRateWeights[metric.id] || 0) + denom;
                            }
                            return;
                        }
                        s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                        return;
                    }
                    if (source === 'dpsAll') {
                        if (!dpsAll) return;
                        const value = Number(dpsAll[field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                        return;
                    }
                    if (source === 'dpsTargets') {
                        if (dpsTargetsList.length === 0 && statsAll) {
                            const fallbackValue = Number(statsAll[field] ?? 0);
                            if (Number.isFinite(fallbackValue)) {
                                s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + fallbackValue;
                            }
                            return;
                        }
                        dpsTargetsList.forEach((targetEntry: any) => {
                            const target = targetEntry?.[0];
                            if (!target) return;
                            const value = Number(target[field] ?? 0);
                            if (!Number.isFinite(value)) return;
                            s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                        });
                        return;
                    }

                    if (statsTargetsList.length === 0 && statsAll) {
                        let value = Number(statsAll[field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        if (metric.isRate) {
                            const denomField = metric.denomField || metric.weightField;
                            const denom = Number(statsAll[denomField || 'connectedDamageCount'] ?? 0);
                            if (denom > 0) {
                                s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                                s.offenseRateWeights[metric.id] = (s.offenseRateWeights[metric.id] || 0) + denom;
                            }
                            return;
                        }
                        s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                        return;
                    }

                    statsTargetsList.forEach((targetEntry: any) => {
                        const target = targetEntry?.[0];
                        if (!target) return;
                        let value = Number(target[field] ?? 0);
                        if (!Number.isFinite(value)) return;
                        if (metric.isRate) {
                            const denomField = metric.denomField || metric.weightField;
                            const denom = Number(target[denomField || 'connectedDamageCount'] ?? 0);
                            if (denom > 0) {
                                s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                                s.offenseRateWeights[metric.id] = (s.offenseRateWeights[metric.id] || 0) + denom;
                            }
                            return;
                        }
                        s.offenseTotals[metric.id] = (s.offenseTotals[metric.id] || 0) + value;
                    });
                });

                s.revives += p.support?.[0]?.resurrects || 0;

                if (p.dpsAll && p.dpsAll.length > 0) {
                    s.damage += p.dpsAll[0].damage || 0;
                    s.dps += p.dpsAll[0].dps || 0;
                }

                // Outgoing Skill Aggregation
                if (p.totalDamageDist) {
                    p.totalDamageDist.forEach(distList => {
                        if (!distList) return;
                        distList.forEach(entry => {
                            if (!entry.id) return;

                            let skillName = `Skill ${entry.id}`;
                            // Attempt to resolve name from skillMap
                            if (details.skillMap) {
                                if (details.skillMap[`s${entry.id}`]) {
                                    skillName = details.skillMap[`s${entry.id}`].name;
                                } else if (details.skillMap[`${entry.id}`]) {
                                    skillName = details.skillMap[`${entry.id}`].name;
                                }
                            }

                            if (!skillDamageMap[entry.id]) {
                                skillDamageMap[entry.id] = { name: skillName, damage: 0, hits: 0 };
                            }
                            // Update name if we found a better one
                            if (skillDamageMap[entry.id].name.startsWith('Skill ') && !skillName.startsWith('Skill ')) {
                                skillDamageMap[entry.id].name = skillName;
                            }

                            skillDamageMap[entry.id].damage += entry.totalDamage;
                            skillDamageMap[entry.id].hits += entry.connectedHits;

                        });
                    });
                }

            // Incoming Skill Aggregation (Damage Taken)
            if (p.totalDamageTaken) {
                p.totalDamageTaken.forEach(takenList => {
                    if (!takenList) return;
                    takenList.forEach(entry => {
                        if (!entry.id) return;

                        let skillName = `Skill ${entry.id}`;
                        // Resolve name
                        if (details.skillMap) {
                            if (details.skillMap[`s${entry.id}`]) {
                                skillName = details.skillMap[`s${entry.id}`].name;
                            } else if (details.skillMap[`${entry.id}`]) {
                                skillName = details.skillMap[`${entry.id}`].name;
                            }
                        }

                        if (!incomingSkillDamageMap[entry.id]) {
                            incomingSkillDamageMap[entry.id] = { name: skillName, damage: 0, hits: 0 };
                        }
                        if (incomingSkillDamageMap[entry.id].name.startsWith('Skill ') && !skillName.startsWith('Skill ')) {
                            incomingSkillDamageMap[entry.id].name = skillName;
                        }

                        incomingSkillDamageMap[entry.id].damage += entry.totalDamage;
                        incomingSkillDamageMap[entry.id].hits += entry.hits; // For taken, hits is usually raw hits
                    });
                });
            }
            });

            const conditionResult: OutgoingConditionsResult = (log?.details?.conditionMetrics as OutgoingConditionsResult) || computeOutgoingConditions({
                players: conditionPlayers,
                targets: conditionTargets,
                skillMap: conditionSkillMap,
                buffMap: conditionBuffMap,
                getPlayerKey: (player) => {
                    const account = player?.account || 'Unknown';
                    if (account && account !== 'Unknown') return account;
                    const name = player?.name || 'Unknown';
                    return name || null;
                }
            });

            Object.entries(conditionResult.playerConditions).forEach(([key, conditionTotals]) => {
                const playerStat = playerStats.get(key);
                if (!playerStat) return;
                Object.entries(conditionTotals).forEach(([conditionName, entry]) => {
                    const existing = playerStat.outgoingConditions[conditionName] || {
                        applications: 0,
                        damage: 0,
                        skills: {}
                    };
                    existing.applications += Number(entry.applications || 0);
                    existing.damage += Number(entry.damage || 0);
                    if (entry.applicationsFromBuffs) {
                        existing.applicationsFromBuffs = (existing.applicationsFromBuffs || 0) + entry.applicationsFromBuffs;
                    }
                    if (entry.applicationsFromBuffsActive) {
                        existing.applicationsFromBuffsActive = (existing.applicationsFromBuffsActive || 0) + entry.applicationsFromBuffsActive;
                    }
                    Object.entries(entry.skills || {}).forEach(([skillName, skillEntry]) => {
                        const skillExisting = existing.skills[skillName] || { name: skillEntry.name, hits: 0, damage: 0 };
                        skillExisting.hits += Number(skillEntry.hits || 0);
                        skillExisting.damage += Number(skillEntry.damage || 0);
                        existing.skills[skillName] = skillExisting;
                    });
                    playerStat.outgoingConditions[conditionName] = existing;
                });
            });

            Object.entries(conditionResult.summary).forEach(([conditionName, entry]) => {
                const existing = outgoingCondiTotals[conditionName] || {
                    name: entry.name || conditionName,
                    applications: 0,
                    damage: 0
                };
                existing.applications += Number(entry.applications || 0);
                existing.damage += Number(entry.damage || 0);
                if (entry.applicationsFromBuffs) {
                    existing.applicationsFromBuffs = (existing.applicationsFromBuffs || 0) + entry.applicationsFromBuffs;
                }
                if (entry.applicationsFromBuffsActive) {
                    existing.applicationsFromBuffsActive = (existing.applicationsFromBuffsActive || 0) + entry.applicationsFromBuffsActive;
                }
                outgoingCondiTotals[conditionName] = existing;
            });

            if (conditionResult.meta.buffStateApplicationsTotal > 0) {
                window.electronAPI?.logToMain?.({
                    level: 'info',
                    message: '[Conditions] Buff state applications',
                    meta: { count: conditionResult.meta.buffStateApplicationsTotal }
                });
            } else {
                window.electronAPI?.logToMain?.({
                    level: 'info',
                    message: '[Conditions] No buff state applications found; using damage distribution fallback.',
                    meta: {
                        targetBuffEntriesSeen: conditionResult.meta.targetBuffEntriesSeen,
                        buffStateSourcesSeen: conditionResult.meta.buffStateSourcesSeen
                    }
                });
            }

            conditionPlayers.forEach((player: any) => {
                if (player?.notInSquad) return;
                const account = player.account || 'Unknown';
                const key = account !== 'Unknown' ? account : (player.name || 'Unknown');
                const stat = playerStats.get(key);
                if (!stat || !player?.totalDamageTaken) return;
                player.totalDamageTaken.forEach((takenList: any) => {
                    if (!takenList) return;
                    takenList.forEach((entry: any) => {
                        if (!entry.id) return;
                        let skillName = `Skill ${entry.id}`;
                        if (conditionSkillMap) {
                            if (conditionSkillMap[`s${entry.id}`]) {
                                skillName = conditionSkillMap[`s${entry.id}`].name;
                            } else if (conditionSkillMap[`${entry.id}`]) {
                                skillName = conditionSkillMap[`${entry.id}`].name;
                            }
                        }
                        const finalName = resolveConditionNameFromEntry(skillName, entry.id, conditionBuffMap);
                        if (!finalName) return;
                        const hits = Number(entry.hits ?? 0);
                        const damage = Number(entry.totalDamage ?? 0);
                        if (!Number.isFinite(hits) && !Number.isFinite(damage)) return;

                        const summaryEntry = incomingCondiTotals[finalName] || { name: finalName, applications: 0, damage: 0 };
                        summaryEntry.applications += Number.isFinite(hits) ? hits : 0;
                        summaryEntry.damage += Number.isFinite(damage) ? damage : 0;
                        incomingCondiTotals[finalName] = summaryEntry;

                        const playerEntry = stat.incomingConditions[finalName] || { applications: 0, damage: 0, skills: {} };
                        playerEntry.applications += Number.isFinite(hits) ? hits : 0;
                        playerEntry.damage += Number.isFinite(damage) ? damage : 0;
                        const skillEntry = playerEntry.skills[skillName] || { name: skillName, hits: 0, damage: 0 };
                        skillEntry.hits += Number.isFinite(hits) ? hits : 0;
                        skillEntry.damage += Number.isFinite(damage) ? damage : 0;
                        playerEntry.skills[skillName] = skillEntry;
                        stat.incomingConditions[finalName] = playerEntry;
                    });
                });
            });
        });

        const avgSquadSize = total > 0 ? Math.round(totalSquadSizeAccum / total) : 0;
        const avgEnemies = total > 0 ? Math.round(totalEnemiesAccum / total) : 0;

        const shouldComputeTopStats = activeStatsViewSettings.showTopStats || activeStatsViewSettings.showMvp;
        const shouldComputeMvp = activeStatsViewSettings.showMvp;

        // Find Leaders
        const emptyLeader = { value: 0, player: '-', count: 0, profession: 'Unknown', professionList: [] as string[] };

        let maxDownContrib = { ...emptyLeader };
        let maxCleanses = { ...emptyLeader };
        let maxStrips = { ...emptyLeader };
        let maxStab = { ...emptyLeader };
        let maxHealing = { ...emptyLeader };
        let maxBarrier = { ...emptyLeader };
        let maxCC = { ...emptyLeader };
        let maxDodges = { ...emptyLeader };
        let maxLogsJoined = 0;
        let closestToTag = { value: 999999, player: '-', count: 0, profession: 'Unknown', professionList: [] as string[] }; // Min is better
        let maxDamage = { ...emptyLeader };
        let maxDps = { ...emptyLeader };
        let maxRevives = { ...emptyLeader };
        let topStatsPerSecond: Record<string, typeof emptyLeader> | null = null;
        let topStatsLeaderboardsPerSecond: Record<string, Array<{ rank: number; account: string; profession: string; professionList?: string[]; value: number }>> | null = null;
        let leaderboards: Record<string, Array<{ rank: number; account: string; profession: string; professionList?: string[]; value: number }>> = {
            downContrib: [],
            barrier: [],
            healing: [],
            dodges: [],
            strips: [],
            cleanses: [],
            cc: [],
            stability: [],
            closestToTag: [],
            revives: [],
            participation: [],
            dps: [],
            damage: []
        };

        playerStats.forEach((stat) => {
            const list = Array.from(stat.professions || []).filter((prof) => prof && prof !== 'Unknown');
            stat.professionList = list;
            if (list.length > 0) {
                let primary = list[0];
                let maxTime = stat.professionTimeMs?.[primary] || 0;
                list.forEach((prof) => {
                    const time = stat.professionTimeMs?.[prof] || 0;
                    if (time > maxTime) {
                        maxTime = time;
                        primary = prof;
                    }
                });
                stat.profession = primary;
            }
        });

        const playerEntries = Array.from(playerStats.entries()).map(([key, stat]) => ({ key, stat }));
        const offensePlayers = playerEntries.map(({ stat }) => ({
            account: stat.account,
            profession: stat.profession || 'Unknown',
            professionList: stat.professionList,
            totalFightMs: stat.totalFightMs || 0,
            offenseTotals: stat.offenseTotals,
            offenseRateWeights: stat.offenseRateWeights,
            downs: stat.downs,
            downContribution: stat.offenseTotals?.downContribution || 0
        }));
        const defensePlayers = playerEntries.map(({ stat }) => ({
            account: stat.account,
            profession: stat.profession || 'Unknown',
            professionList: stat.professionList,
            activeMs: stat.defenseActiveMs || 0,
            defenseTotals: stat.defenseTotals
        }));
        const supportPlayers = playerEntries.map(({ stat }) => ({
            account: stat.account,
            profession: stat.profession || 'Unknown',
            professionList: stat.professionList,
            activeMs: stat.supportActiveMs || 0,
            supportTotals: stat.supportTotals
        }));
        const healingPlayers = playerEntries.map(({ stat }) => ({
            account: stat.account,
            profession: stat.profession || 'Unknown',
            professionList: stat.professionList,
            activeMs: stat.healingActiveMs || 0,
            healingTotals: stat.healingTotals
        }));
        const outgoingConditionPlayers = playerEntries.map(({ stat }) => {
            const conditionTotals = stat.outgoingConditions || {};
            let totalApplications = 0;
            let totalDamage = 0;
            Object.values(conditionTotals).forEach((entry) => {
                const applications = (entry.applicationsFromBuffs && entry.applicationsFromBuffs > 0)
                    ? entry.applicationsFromBuffs
                    : entry.applications;
                totalApplications += Number(applications || 0);
                totalDamage += Number(entry.damage || 0);
            });
            return {
                account: stat.account,
                profession: stat.profession || 'Unknown',
                professionList: stat.professionList,
                totalFightMs: stat.totalFightMs || 0,
                totalApplications,
                totalDamage,
                conditions: conditionTotals
            };
        });
        const incomingConditionPlayers = playerEntries.map(({ stat }) => {
            const conditionTotals = stat.incomingConditions || {};
            let totalApplications = 0;
            let totalDamage = 0;
            Object.values(conditionTotals).forEach((entry) => {
                totalApplications += Number(entry.applications || 0);
                totalDamage += Number(entry.damage || 0);
            });
            return {
                account: stat.account,
                profession: stat.profession || 'Unknown',
                professionList: stat.professionList,
                totalFightMs: stat.totalFightMs || 0,
                totalApplications,
                totalDamage,
                conditions: conditionTotals
            };
        });

        if (shouldComputeTopStats) {
            playerEntries.forEach(({ stat }) => {
                const pInfo = { player: stat.account, count: stat.logsJoined, profession: stat.profession || 'Unknown', professionList: stat.professionList || [] };

                if (stat.downContrib > maxDownContrib.value) maxDownContrib = { value: stat.downContrib, ...pInfo };
                if (stat.cleanses > maxCleanses.value) maxCleanses = { value: stat.cleanses, ...pInfo };
                if (stat.strips > maxStrips.value) maxStrips = { value: stat.strips, ...pInfo };
                if (stat.stab > maxStab.value) maxStab = { value: stat.stab, ...pInfo };
                if (stat.healing > maxHealing.value) maxHealing = { value: stat.healing, ...pInfo };
                if (stat.barrier > maxBarrier.value) maxBarrier = { value: stat.barrier, ...pInfo };
                if (stat.cc > maxCC.value) maxCC = { value: stat.cc, ...pInfo };
                if (stat.dodges > maxDodges.value) maxDodges = { value: stat.dodges, ...pInfo };
                if (stat.damage > maxDamage.value) maxDamage = { value: stat.damage, ...pInfo };
                if (stat.dps > maxDps.value) maxDps = { value: stat.dps, ...pInfo };
                if (stat.revives > maxRevives.value) maxRevives = { value: stat.revives, ...pInfo };
                if (stat.logsJoined > maxLogsJoined) maxLogsJoined = stat.logsJoined;

                if (!stat.isCommander && stat.distCount > 0) {
                    const avgDist = stat.totalDist / stat.distCount;
                    if (avgDist > 0 && avgDist < closestToTag.value) {
                        closestToTag = { value: avgDist, ...pInfo };
                    }
                }
            });

            if (closestToTag.value === 999999) closestToTag.value = 0;

            const buildLeaderboard = (items: Array<{ key: string; account: string; profession: string; professionList?: string[]; value: number }>, higherIsBetter: boolean) => {
                const filtered = items.filter(item => Number.isFinite(item.value) && item.value > 0);
                const sorted = filtered.sort((a, b) => {
                    const diff = higherIsBetter ? b.value - a.value : a.value - b.value;
                    if (diff !== 0) return diff;
                    return a.account.localeCompare(b.account);
                });
                let lastValue: number | null = null;
                let lastRank = 0;
                return sorted.map((item, index) => {
                    if (lastValue === null || item.value !== lastValue) {
                        lastRank = index + 1;
                        lastValue = item.value;
                    }
                    return {
                        rank: lastRank,
                        account: item.account,
                        profession: item.profession,
                        professionList: item.professionList,
                        value: item.value
                    };
                });
            };

            const getTopStatValue = (stat: PlayerStats, key: string) => {
                switch (key) {
                    case 'downContrib':
                        return stat.downContrib;
                    case 'barrier':
                        return stat.barrier;
                    case 'healing':
                        return stat.healing;
                    case 'dodges':
                        return stat.dodges;
                    case 'strips':
                        return stat.strips;
                    case 'cleanses':
                        return stat.cleanses;
                    case 'cc':
                        return stat.cc;
                    case 'stability':
                        return stat.stab;
                    case 'revives':
                        return stat.revives;
                    default:
                        return 0;
                }
            };

            const getTopStatPerSecond = (stat: PlayerStats, key: string) => {
                const seconds = Math.max(1, (stat.totalFightMs || 0) / 1000);
                return getTopStatValue(stat, key) / seconds;
            };

            leaderboards = {
                downContrib: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.downContrib
                })), true),
                barrier: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.barrier
                })), true),
                healing: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.healing
                })), true),
                dodges: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.dodges
                })), true),
                strips: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.strips
                })), true),
                cleanses: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.cleanses
                })), true),
                cc: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.cc
                })), true),
                stability: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.stab
                })), true),
                closestToTag: buildLeaderboard(
                    playerEntries
                        .filter(({ stat }) => !stat.isCommander)
                        .map(({ key, stat }) => ({
                            key,
                            account: stat.account,
                            profession: stat.profession,
                            professionList: stat.professionList,
                            value: stat.distCount > 0 ? stat.totalDist / stat.distCount : Number.POSITIVE_INFINITY
                        }))
                        .filter(item => Number.isFinite(item.value)),
                    false
                ),
                revives: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.revives
                })), true),
                participation: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.logsJoined
                })), true),
                dps: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.dps
                })), true),
                damage: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: stat.damage
                })), true)
            };

            const topStatsPerSecondLocal = {
                maxDownContrib: { ...emptyLeader },
                maxCleanses: { ...emptyLeader },
                maxStrips: { ...emptyLeader },
                maxStab: { ...emptyLeader },
                maxHealing: { ...emptyLeader },
                maxBarrier: { ...emptyLeader },
                maxCC: { ...emptyLeader },
                maxDodges: { ...emptyLeader },
                maxRevives: { ...emptyLeader },
                closestToTag: { ...closestToTag }
            };

            playerEntries.forEach(({ stat }) => {
                const pInfo = { player: stat.account, count: stat.logsJoined, profession: stat.profession || 'Unknown', professionList: stat.professionList || [] };
                const downContrib = getTopStatPerSecond(stat, 'downContrib');
                const cleanses = getTopStatPerSecond(stat, 'cleanses');
                const strips = getTopStatPerSecond(stat, 'strips');
                const stab = getTopStatPerSecond(stat, 'stability');
                const healing = getTopStatPerSecond(stat, 'healing');
                const barrier = getTopStatPerSecond(stat, 'barrier');
                const cc = getTopStatPerSecond(stat, 'cc');
                const dodges = getTopStatPerSecond(stat, 'dodges');
                const revives = getTopStatPerSecond(stat, 'revives');

                if (downContrib > topStatsPerSecondLocal.maxDownContrib.value) topStatsPerSecondLocal.maxDownContrib = { value: downContrib, ...pInfo };
                if (cleanses > topStatsPerSecondLocal.maxCleanses.value) topStatsPerSecondLocal.maxCleanses = { value: cleanses, ...pInfo };
                if (strips > topStatsPerSecondLocal.maxStrips.value) topStatsPerSecondLocal.maxStrips = { value: strips, ...pInfo };
                if (stab > topStatsPerSecondLocal.maxStab.value) topStatsPerSecondLocal.maxStab = { value: stab, ...pInfo };
                if (healing > topStatsPerSecondLocal.maxHealing.value) topStatsPerSecondLocal.maxHealing = { value: healing, ...pInfo };
                if (barrier > topStatsPerSecondLocal.maxBarrier.value) topStatsPerSecondLocal.maxBarrier = { value: barrier, ...pInfo };
                if (cc > topStatsPerSecondLocal.maxCC.value) topStatsPerSecondLocal.maxCC = { value: cc, ...pInfo };
                if (dodges > topStatsPerSecondLocal.maxDodges.value) topStatsPerSecondLocal.maxDodges = { value: dodges, ...pInfo };
                if (revives > topStatsPerSecondLocal.maxRevives.value) topStatsPerSecondLocal.maxRevives = { value: revives, ...pInfo };
            });

            topStatsPerSecond = topStatsPerSecondLocal;

            topStatsLeaderboardsPerSecond = {
                downContrib: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'downContrib')
                })), true),
                barrier: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'barrier')
                })), true),
                healing: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'healing')
                })), true),
                dodges: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'dodges')
                })), true),
                strips: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'strips')
                })), true),
                cleanses: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'cleanses')
                })), true),
                cc: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'cc')
                })), true),
                stability: buildLeaderboard(playerEntries.map(({ key, stat }) => ({
                    key,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    value: getTopStatPerSecond(stat, 'stability')
                })), true),
                closestToTag: leaderboards.closestToTag
            };
        }

        // rankMaps removed: MVP now references leaderboards for rank consistency.

        // --- Calculate MVP ---
        let mvp = {
            player: 'None',
            account: 'None',
            reason: 'No sufficient data',
            score: -1,
            profession: 'Unknown',
            professionList: [] as string[],
            color: '#64748b',
            topStats: [] as { name: string, val: string, ratio: number }[]
        };
        let silver: any = undefined;
        let bronze: any = undefined;
        let avgMvpScore = 0;

        if (shouldComputeMvp) {
            let totalScoreSum = 0;
            const scoreBreakdown: Array<{
                player: string;
                account: string;
                profession: string;
                professionList?: string[];
                score: number;
                reason: string;
                topStats: { name: string, val: string, ratio: number }[];
            }> = [];

            const getRankFromLeaderboard = (
                leaderboard: Array<{ rank: number; account: string }> | undefined,
                account: string
            ) => {
                if (!leaderboard?.length) return 0;
                const entry = leaderboard.find((row) => row.account === account);
                return entry?.rank || 0;
            };

            playerEntries.forEach(({ stat }) => {
                let score = 0;
                const contributions: { name: string, ratio: number, value: number, fmt: string, rank: number }[] = [];

                const formatCompactNumber = (value: number) => {
                    const abs = Math.abs(value);
                    if (abs >= 1_000_000) {
                        return `${(value / 1_000_000).toFixed(2)}m`;
                    }
                    if (abs >= 1_000) {
                        return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
                    }
                    return Math.round(value).toLocaleString();
                };

                const weights = activeMvpWeights;

                const check = (val: number, maxVal: number, name: string, weight = 1, leaderboard?: Array<{ rank: number; account: string }>) => {
                    if (weight <= 0) return;
                    if (maxVal > 0) {
                        const ratio = val / maxVal;
                        score += ratio * weight;
                        const rank = getRankFromLeaderboard(leaderboard, stat.account);
                        contributions.push({ name, ratio, value: val, fmt: formatCompactNumber(val), rank });
                    }
                };
                const checkLowerIsBetter = (val: number, bestVal: number, name: string, weight = 1, leaderboard?: Array<{ rank: number; account: string }>) => {
                    if (weight <= 0) return;
                    if (bestVal > 0 && val > 0) {
                        const ratio = bestVal / val;
                        score += ratio * weight;
                        const rank = getRankFromLeaderboard(leaderboard, stat.account);
                        contributions.push({ name, ratio, value: val, fmt: formatCompactNumber(val), rank });
                    }
                };

                check(stat.downContrib, maxDownContrib.value, 'Down Contribution', weights.downContribution, leaderboards.downContrib);
                check(stat.healing, maxHealing.value, 'Healing', weights.healing, leaderboards.healing);
                check(stat.cleanses, maxCleanses.value, 'Cleanses', weights.cleanses, leaderboards.cleanses);
                check(stat.strips, maxStrips.value, 'Strips', weights.strips, leaderboards.strips);
                check(stat.stab, maxStab.value, 'Stability', weights.stability, leaderboards.stability);
                check(stat.cc, maxCC.value, 'CC', weights.cc, leaderboards.cc);
                check(stat.revives, maxRevives.value, 'Revives', weights.revives, leaderboards.revives);
                check(stat.logsJoined, maxLogsJoined, 'Participation', weights.participation, leaderboards.participation);
                check(stat.dodges, maxDodges.value, 'Dodging', weights.dodging, leaderboards.dodges);
                check(stat.dps, maxDps.value, 'DPS', weights.dps, leaderboards.dps);
                check(stat.damage, maxDamage.value, 'Damage', weights.damage, leaderboards.damage);
                if (!stat.isCommander && stat.distCount > 0) {
                    const avgDist = stat.totalDist / stat.distCount;
                    checkLowerIsBetter(avgDist, closestToTag.value, 'Distance to Tag', weights.distanceToTag, leaderboards.closestToTag);
                }

                totalScoreSum += score;

                contributions.sort((a, b) => b.ratio - a.ratio);
                const top3 = contributions.slice(0, 3);

                let reason = 'Consistent all-round performance';
                if (top3.length > 0) {
                    const best = top3[0];
                    if (best.ratio >= 1) {
                        reason = `Top Rank in ${best.name}`;
                        if (top3.length > 1 && top3[1].ratio > 0.8) {
                            reason += ` & High ${top3[1].name}`;
                        }
                    } else if (best.ratio > 0.8) {
                        reason = `High ${best.name} & ${top3[1]?.name || 'Performance'}`;
                    } else {
                        reason = `Versatile: ${best.name}, ${top3[1]?.name}`;
                    }
                }

                const summary = {
                    player: stat.name,
                    account: stat.account,
                    profession: stat.profession,
                    professionList: stat.professionList,
                    score,
                    reason,
                    topStats: top3.map(c => ({ name: c.name, val: c.fmt, ratio: c.rank }))
                };

                scoreBreakdown.push(summary);
            });

            scoreBreakdown.sort((a, b) => b.score - a.score);
            silver = scoreBreakdown[1];
            bronze = scoreBreakdown[2];
            if (scoreBreakdown[0]) {
                const top = scoreBreakdown[0];
                mvp = {
                    player: top.player,
                    account: top.account,
                    reason: top.reason,
                    score: top.score,
                    profession: top.profession,
                    professionList: top.professionList || [],
                    color: getProfessionColor(top.profession),
                    topStats: top.topStats
                };
            }

            avgMvpScore = playerStats.size > 0 ? totalScoreSum / playerStats.size : 0;
        }

        // Sort Skills
        const topSkills = Object.values(skillDamageMap)
            .sort((a, b) => b.damage - a.damage)
            .slice(0, 25);

        const topIncomingSkills = Object.values(incomingSkillDamageMap)
            .sort((a, b) => b.damage - a.damage)
            .slice(0, 25);

        const outgoingConditionSummary = Object.values(outgoingCondiTotals)
            .map((entry) => ({
                ...entry,
                applications: (entry.applicationsFromBuffs && entry.applicationsFromBuffs > 0)
                    ? entry.applicationsFromBuffs
                    : entry.applications
            }))
            .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
        const incomingConditionSummary = Object.values(incomingCondiTotals)
            .map((entry) => ({
                ...entry,
                applications: entry.applications
            }))
            .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));

        // KDR Calculations
        const squadKDR = totalSquadDeaths > 0 ? (totalSquadKills / totalSquadDeaths).toFixed(2) : totalSquadKills > 0 ? '∞' : '0.00';
        const enemyKDR = totalEnemyDeaths > 0 ? (totalEnemyKills / totalEnemyDeaths).toFixed(2) : totalEnemyKills > 0 ? '∞' : '0.00';

        // Class Distribution (Squad)
        const squadClassCounts: Record<string, number> = {};
        // Class Distribution (Enemies)
        const enemyClassCounts: Record<string, number> = {};

        // Unique Composition Set: Tracks "AccountName-Profession"
        // If a player plays Guardian in 5 logs, they count ONCE as Guardian.
        // If they play Guardian in 3 and Necro in 2, they count ONCE as Guardian and ONCE as Necro.
        const uniqueSquadComposition = new Set<string>();

        const seenEnemyIdsAcrossLogs = new Set<string>();
        validLogs.forEach(log => {
            const details = log.details;
            if (!details) return;
            const players = details.players as unknown as Player[];
            const targets = details.targets as unknown as Target[];

            // Squad Classes
            players.forEach(p => {
                if (!p.notInSquad) {
                    const prof = p.profession || 'Unknown';
                    const account = p.account || p.name; // Fallback if account missing
                    const key = `${account}-${prof}`;
                    uniqueSquadComposition.add(key);
                }
            });

            // Enemy Classes (unique by player/instance id per log)
            if (targets) {
                targets.forEach(t => {
                    if (t.isFake) return;
                    const rawName = t.name || 'Unknown';
                    const rawId = (t as any).instanceID ?? (t as any).instid ?? (t as any).id ?? rawName;
                    const idKey = rawId !== undefined && rawId !== null ? String(rawId) : rawName;
                    if (seenEnemyIdsAcrossLogs.has(idKey)) return;
                    seenEnemyIdsAcrossLogs.add(idKey);

                    // Clean up name: remove " pl-1234", " (Account)", ids, etc.
                    let cleanName = rawName
                        .replace(/\s+pl-\d+$/i, '')
                        .replace(/\s*\([^)]*\)/, '')
                        .trim();

                    enemyClassCounts[cleanName] = (enemyClassCounts[cleanName] || 0) + 1;
                });
            }
        });

        // Calculate Squad Counts from Unique Set
        uniqueSquadComposition.forEach(entry => {
            const [, prof] = entry.split('-');
            squadClassCounts[prof] = (squadClassCounts[prof] || 0) + 1;
        });

        // Format for Charts
        // Format for Charts - Explicit Sort
        const squadClassData = Object.entries(squadClassCounts)
            .map(([name, count]) => ({
                name,
                value: Number(count),
                color: getProfessionColor(name)
            }))
            .sort((a, b) => {
                const diff = b.value - a.value;
                if (diff !== 0) return diff;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 10);

        const enemyClassData = Object.entries(enemyClassCounts)
            .map(([name, count]) => ({
                name,
                value: Number(count),
                color: getProfessionColor(name)
            }))
            .sort((a, b) => {
                const diff = b.value - a.value;
                if (diff !== 0) return diff;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 10);

        // Map/Borderland Distribution
        const mapCounts: Record<string, number> = {};
        validLogs.forEach(log => {
            let mapName = 'Unknown';
            const details = log.details;
            if (details) {
                // Check explicit zone field if available (in some EI versions)
                if (details.zone) {
                    mapName = details.zone;
                } else if (details.fightName) {
                    const fn = details.fightName.toLowerCase();
                    if (fn.includes('eternal') || fn.includes(' eb')) mapName = 'Eternal Battlegrounds';
                    else if (fn.includes('blue') && (fn.includes('alpine') || fn.includes('borderlands'))) mapName = 'Blue Borderlands';
                    else if (fn.includes('green') && (fn.includes('alpine') || fn.includes('borderlands'))) mapName = 'Green Borderlands';
                    else if (fn.includes('red') || fn.includes('desert')) mapName = 'Red Borderlands';
                    else if (fn.includes('alpine')) mapName = 'Green Borderlands'; // Fallback for generic "Alpine" often implies home/green
                    else if (fn.includes('edge') || fn.includes('mists')) mapName = 'Edge of the Mists';
                    else if (fn.includes('armistice')) mapName = 'Armistice Bastion';
                    else if (fn.includes('obsidian')) mapName = 'Obsidian Sanctum';
                    else if (fn.includes('world vs world')) mapName = 'World vs World (Generic)';
                }
            }
            mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;
        });

        // Map Colors
        const mapColors: Record<string, string> = {
            'Eternal Battlegrounds': '#ffffff', // White
            'Blue Borderlands': '#3b82f6', // Blue
            'Green Borderlands': '#10b981', // Emerald
            'Red Borderlands': '#ef4444', // Red
            'Edge of the Mists': '#a855f7', // Purple
            'Armistice Bastion': '#ec4899', // Pink
            'Obsidian Sanctum': '#f59e0b', // Amber
            'World vs World (Generic)': '#64748b', // Slate
            'Unknown': '#475569' // Slate-600
        };

        const mapData = Object.entries(mapCounts)
            .map(([name, value]) => ({ name, value, color: mapColors[name] || '#64748b' }))
            .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

        const getBuffInfo = (details: any, id: number) => {
            const buff = details?.buffMap?.[`b${id}`];
            if (buff?.name) {
                return { name: buff.name as string, classification: buff.classification as string | undefined };
            }
            const skill = details?.skillMap?.[`b${id}`]
                || details?.skillMap?.[`${id}`]
                || details?.skillMap?.[`s${id}`];
            if (skill?.name) {
                return { name: skill.name as string, classification: undefined };
            }
            return { name: `Buff ${id}`, classification: undefined };
        };

        const shouldIncludeSpecial = (classification?: string, name?: string) => {
            const allowList = ['Distortion'];
            if (name && allowList.includes(name)) return true;
            if (!classification) return true;
            const lowered = classification.toLowerCase();
            const excluded = ['condition', 'defensive', 'offensive', 'support', 'nourishment', 'consumable'];
            return !excluded.includes(lowered);
        };

        const { boonTables } = buildBoonTables(validLogs);
        const specialTotals: Record<string, { id: number; name: string; total: number; rows: Record<string, { account: string; profession: string; total: number; duration: number }> }> = {};
        validLogs.forEach(log => {
            const details = log.details;
            if (!details) return;
            const durationSec = details.durationMS ? details.durationMS / 1000 : 0;
            const players = details.players as unknown as Player[];

            const sourceLookup = new Map<string, { account: string; profession: string }>();
            players.forEach(player => {
                if (player.name) {
                    sourceLookup.set(player.name, { account: player.account || player.name, profession: player.profession || 'Unknown' });
                }
                if (player.character_name) {
                    sourceLookup.set(player.character_name, { account: player.account || player.character_name, profession: player.profession || 'Unknown' });
                }
            });

            const computeGeneration = (states: number[][]) => {
                let lastState = 0;
                let gen = 0;
                for (const state of states) {
                    if (state[1] > lastState) {
                        gen += (state[1] - lastState);
                    }
                    lastState = state[1];
                }
                return gen;
            };

            // Special buffs: use buffUptimes statesPerSource when available (captures shared applications)
            players.forEach(player => {
                if (player.notInSquad) return;
                (player.buffUptimes || []).forEach((buff) => {
                    const info = getBuffInfo(details, buff.id);
                    if (info.classification === 'Boon') return;
                    if (!shouldIncludeSpecial(info.classification, info.name)) return;
                    for (const [sourceName, states] of Object.entries(buff.statesPerSource || {})) {
                        if (!sourceLookup.has(sourceName)) continue;
                        const outgoing = computeGeneration(states as number[][]);
                        if (!outgoing) continue;
                        const key = String(buff.id);
                        if (!specialTotals[key]) {
                            specialTotals[key] = {
                                id: buff.id,
                                name: info.name,
                                total: 0,
                                rows: {}
                            };
                        }
                        const sourceInfo = sourceLookup.get(sourceName) || { account: sourceName, profession: 'Unknown' };
                        if (!specialTotals[key].rows[sourceInfo.account]) {
                            specialTotals[key].rows[sourceInfo.account] = {
                                account: sourceInfo.account,
                                profession: sourceInfo.profession,
                                total: 0,
                                duration: 0
                            };
                        }
                        specialTotals[key].total += outgoing;
                        specialTotals[key].rows[sourceInfo.account].total += outgoing;
                        specialTotals[key].rows[sourceInfo.account].duration += durationSec;
                    }
                });
            });
        });

        const specialTables = Object.values(specialTotals)
            .map((buff) => ({
                id: String(buff.id),
                name: buff.name,
                total: buff.total,
                rows: Object.values(buff.rows)
                    .map((row) => ({
                        ...row,
                        perSecond: row.duration > 0 ? row.total / row.duration : 0
                    }))
                    .sort((a, b) => b.total - a.total || a.account.localeCompare(b.account))
            }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        const timelineData = validLogs
            .filter(log => log.details)
            .map((log, index) => {
                const details = log.details;
                const players = (details?.players as unknown as Player[]) || [];
                const targets = details?.targets || [];
                const squadCount = players.filter(p => !p.notInSquad).length;
                const allyCount = players.filter(p => p.notInSquad).length;
                const friendlyCount = squadCount + allyCount;
                const enemies = targets.filter((t: any) => !t.isFake).length;
                const timestamp = details?.uploadTime || log.uploadTime || 0;
                const label = timestamp
                    ? new Date(timestamp * 1000).toLocaleDateString()
                    : `Log ${index + 1}`;
                return {
                    label,
                    squadCount,
                    allyCount,
                    friendlyCount,
                    enemies,
                    timestamp
                };
            })
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            .map((entry, index) => ({
                ...entry,
                index: index + 1
            }));

        const fightBreakdown = validLogs.map((log, index) => {
            const details = (log.details || {}) as any;
            const players = (details.players || []) as any[];
            const targets = (details.targets || []) as any[];
            const squadPlayers = players.filter((p) => !p.notInSquad);
            const allyPlayers = players.filter((p) => p.notInSquad);
            const allFriendly = players;
            const nonFakeTargets = targets.filter((t) => !t.isFake);
            const teamIds = Array.from(new Set(
                nonFakeTargets
                    .map((t) => Number(t?.teamID ?? t?.teamId))
                    .filter((id) => Number.isFinite(id))
            ));
            const allyTeamIds = Array.from(new Set(
                allyPlayers
                    .map((p) => Number(p?.teamID ?? p?.teamId))
                    .filter((id) => Number.isFinite(id))
            ));
            const relevantTeamIds = new Set<number>([...teamIds, ...allyTeamIds]);
            const colorOrder = ['red', 'green', 'blue'] as const;

            const teamColorMap = new Map<number, typeof colorOrder[number]>();
            const rawTeamMap = details?.teamIdMap || details?.teamIDMap || details?.wvwTeams || details?.teams;
            if (rawTeamMap && typeof rawTeamMap === 'object') {
                if (Array.isArray(rawTeamMap)) {
                    rawTeamMap.forEach((entry: any) => {
                        const id = Number(entry?.teamID ?? entry?.teamId ?? entry?.id);
                        const colorRaw = String(entry?.color || entry?.name || '').toLowerCase();
                        const color = colorOrder.find((c) => colorRaw.includes(c));
                        if (Number.isFinite(id) && color) {
                            teamColorMap.set(id, color);
                        }
                    });
                } else {
                    colorOrder.forEach((color) => {
                        const idRaw = rawTeamMap[color] ?? rawTeamMap[color.toUpperCase()];
                        const id = Number(idRaw);
                        if (Number.isFinite(id)) {
                            teamColorMap.set(id, color);
                        }
                    });
                }
            }

            const usedColors = new Set(
                Array.from(teamColorMap.entries())
                    .filter(([id]) => relevantTeamIds.has(id))
                    .map(([, color]) => color)
            );
            const remainingColors = colorOrder.filter((c) => !usedColors.has(c));
            const unmappedIds = teamIds.filter((id) => !teamColorMap.has(id)).sort((a, b) => a - b);
            unmappedIds.forEach((id, idx) => {
                const color = remainingColors[idx] || remainingColors[remainingColors.length - 1] || 'red';
                teamColorMap.set(id, color);
            });

            const teamCounts = { red: 0, green: 0, blue: 0 };
            const teamClassCounts: Record<'red' | 'green' | 'blue', Record<string, number>> = {
                red: {},
                green: {},
                blue: {}
            };
            const enemyClassCounts: Record<string, number> = {};
            let enemyPlayerCount = 0;
            const countByProfession = (list: any[]) => {
                const counts: Record<string, number> = {};
                list.forEach((p) => {
                    const prof = p?.profession || 'Unknown';
                    counts[prof] = (counts[prof] || 0) + 1;
                });
                return counts;
            };
            nonFakeTargets.forEach((t) => {
                const teamId = Number(t?.teamID ?? t?.teamId);
                if (!Number.isFinite(teamId)) return;
                const color = teamColorMap.get(teamId);
                if (!color) return;
                teamCounts[color] += 1;
            });
            players.forEach((p) => {
                if (!p?.notInSquad) return;
                const teamId = Number(p?.teamID ?? p?.teamId);
                if (!Number.isFinite(teamId)) return;
                const color = teamColorMap.get(teamId);
                if (!color) return;
                const prof = p?.profession || 'Unknown';
                teamClassCounts[color][prof] = (teamClassCounts[color][prof] || 0) + 1;
            });
            const seenEnemyIdsInFight = new Set<string>();
            nonFakeTargets.forEach((t) => {
                const rawName = t?.name || 'Unknown';
                const rawId = (t as any)?.instanceID ?? (t as any)?.instid ?? (t as any)?.id ?? rawName;
                const idKey = rawId !== undefined && rawId !== null ? String(rawId) : rawName;
                if (seenEnemyIdsInFight.has(idKey)) return;
                seenEnemyIdsInFight.add(idKey);

                const cleanName = String(rawName)
                    .replace(/\s+pl-\d+$/i, '')
                    .replace(/\s*\([^)]*\)/, '')
                    .trim();

                enemyClassCounts[cleanName] = (enemyClassCounts[cleanName] || 0) + 1;
            });

            const squadClassCountsFight = countByProfession(squadPlayers);
            const allyClassCountsFight = countByProfession(allyPlayers);

            let squadDownsDeaths = 0;
            let enemyDownsDeaths = 0;

            squadPlayers.forEach((p) => {
                if (p.defenses && p.defenses.length > 0) {
                    squadDownsDeaths += Number(p.defenses[0].downCount || 0) + Number(p.defenses[0].deadCount || 0);
                }
            });

            squadPlayers.forEach((p: any) => {
                if (!p.statsTargets || p.statsTargets.length === 0) return;
                p.statsTargets.forEach((targetStats: any) => {
                    if (targetStats && targetStats.length > 0) {
                        const st = targetStats[0];
                        enemyDownsDeaths += Number(st.downed || 0) + Number(st.killed || 0);
                    }
                });
            });

            let alliesDown = 0;
            let alliesDead = 0;
            let alliesRevived = 0;
            let rallies = 0;
            let totalOutgoingDamage = 0;
            let totalIncomingDamage = 0;
            let incomingBarrierAbsorbed = 0;

            allFriendly.forEach((p) => {
                alliesDown += Number(p.defenses?.[0]?.downCount ?? 0);
                alliesDead += Number(p.defenses?.[0]?.deadCount ?? 0);
                alliesRevived += Number(p.support?.[0]?.resurrects ?? 0);
                rallies += Number(p.defenses?.[0]?.rallyCount ?? p.defenses?.[0]?.rallies ?? 0);
                totalOutgoingDamage += Number(p.dpsAll?.[0]?.damage ?? 0);
                totalIncomingDamage += Number(p.defenses?.[0]?.damageTaken ?? 0);
                incomingBarrierAbsorbed += Number(p.defenses?.[0]?.damageBarrier ?? 0);
            });

            let enemyDeaths = 0;
            squadPlayers.forEach((p: any) => {
                enemyDeaths += getTargetStatTotal(p, 'killed');
            });

            let outgoingBarrierAbsorbed = 0;
            nonFakeTargets.forEach((t) => {
                outgoingBarrierAbsorbed += Number(t?.defenses?.[0]?.damageBarrier ?? 0);
            });

            return {
                id: log.id || log.filePath || `${details.fightName || 'fight'}-${index}`,
                label: (() => {
                    const baseLabel = shortenFightLabel(details.fightName || details.name || log.filePath || log.id || 'Fight');
                    const timestamp = formatFightDateTime(details, log);
                    return timestamp ? `${timestamp} ${baseLabel}` : baseLabel;
                })(),
                permalink: log.permalink,
                duration: getFightDurationLabel(details, log),
                squadCount: squadPlayers.length,
                allyCount: allyPlayers.length,
                enemyCount: nonFakeTargets.length,
                teamCounts,
                teamClassCounts,
                enemyClassCounts,
                enemyPlayerCount,
                squadClassCountsFight,
                allyClassCountsFight,
                alliesDown,
                alliesDead,
                alliesRevived,
                rallies,
                enemyDeaths,
                isWin: squadDownsDeaths < enemyDownsDeaths,
                totalOutgoingDamage,
                totalIncomingDamage,
                incomingBarrierAbsorbed,
                outgoingBarrierAbsorbed
            };
        });

        return {
            total,
            wins,
            losses,
            avgSquadSize,
            avgEnemies,
            squadKDR,
            enemyKDR,
            totalSquadKills,
            totalSquadDeaths,
            totalEnemyKills,
            totalEnemyDeaths,
            maxDownContrib,
            maxCleanses,
            maxStrips,
            maxStab,
            maxHealing,
            maxBarrier,
            maxCC,
            closestToTag,
            topSkills,
            topIncomingSkills,
            outgoingConditionSummary,
            outgoingConditionPlayers,
            incomingConditionSummary,
            incomingConditionPlayers,

            mapData,
            squadClassData,
            enemyClassData,
            timelineData,
            fightBreakdown,
            boonTables,
            specialTables,
            offensePlayers,
            defensePlayers,
            supportPlayers,
            healingPlayers,

            maxDodges,
            mvp,
            silver,
            bronze,
            avgMvpScore,
            leaderboards,
            topStatsPerSecond,
            topStatsLeaderboardsPerSecond
        };
    }, [validLogs, precomputedStats]);

    const normalizeConditionName = (name?: string | null) => normalizeConditionLabel(name) ?? (name || '');
    const conditionSummary = useMemo(() => {
        const rawSummary = conditionDirection === 'outgoing'
            ? stats.outgoingConditionSummary
            : stats.incomingConditionSummary;
        const merged = new Map<string, any>();
        (rawSummary || []).forEach((entry: any) => {
            const key = normalizeConditionName(entry.name);
            if (!key) return;
            const existing = merged.get(key) || {
                ...entry,
                name: key,
                applications: 0,
                damage: 0,
                applicationsFromBuffs: 0,
                applicationsFromBuffsActive: 0
            };
            existing.applications += Number(entry.applications || 0);
            existing.damage += Number(entry.damage || 0);
            if (Number.isFinite(entry.applicationsFromBuffs)) {
                existing.applicationsFromBuffs += Number(entry.applicationsFromBuffs || 0);
            }
            if (Number.isFinite(entry.applicationsFromBuffsActive)) {
                existing.applicationsFromBuffsActive += Number(entry.applicationsFromBuffsActive || 0);
            }
            merged.set(key, existing);
        });
        return Array.from(merged.values());
    }, [conditionDirection, stats.outgoingConditionSummary, stats.incomingConditionSummary]);

    const conditionPlayers = useMemo(() => {
        const rawPlayers = conditionDirection === 'outgoing'
            ? stats.outgoingConditionPlayers
            : stats.incomingConditionPlayers;
        return (rawPlayers || []).map((player: any) => {
            const mergedConditions: Record<string, any> = {};
            let totalApplications = 0;
            let totalDamage = 0;
            Object.entries(player.conditions || {}).forEach(([conditionName, entry]: [string, any]) => {
                const key = normalizeConditionName(conditionName);
                if (!key) return;
                const existing = mergedConditions[key] || {
                    ...entry,
                    applications: 0,
                    damage: 0,
                    skills: {}
                };
                existing.applications += Number(entry.applications || 0);
                existing.damage += Number(entry.damage || 0);
                if (Number.isFinite(entry.applicationsFromBuffs)) {
                    existing.applicationsFromBuffs = (existing.applicationsFromBuffs || 0) + Number(entry.applicationsFromBuffs || 0);
                }
                if (Number.isFinite(entry.applicationsFromBuffsActive)) {
                    existing.applicationsFromBuffsActive = (existing.applicationsFromBuffsActive || 0) + Number(entry.applicationsFromBuffsActive || 0);
                }
                Object.entries(entry.skills || {}).forEach(([skillName, skillEntry]: [string, any]) => {
                    const skillExisting = existing.skills[skillName] || { name: skillEntry.name, hits: 0, damage: 0 };
                    skillExisting.hits += Number(skillEntry.hits || 0);
                    skillExisting.damage += Number(skillEntry.damage || 0);
                    existing.skills[skillName] = skillExisting;
                });
                mergedConditions[key] = existing;
            });
            Object.values(mergedConditions).forEach((entry: any) => {
                const applications = conditionDirection === 'outgoing' && entry.applicationsFromBuffs && entry.applicationsFromBuffs > 0
                    ? entry.applicationsFromBuffs
                    : entry.applications;
                totalApplications += Number(applications || 0);
                totalDamage += Number(entry.damage || 0);
            });
            return {
                ...player,
                conditions: mergedConditions,
                totalApplications,
                totalDamage
            };
        });
    }, [conditionDirection, stats.outgoingConditionPlayers, stats.incomingConditionPlayers]);

    const skillUsageData = useMemo<SkillUsageSummary>(() => {
        const precomputedSkillUsage = precomputedStats?.skillUsageData as SkillUsageSummary | undefined;
        if (precomputedSkillUsage) {
            const activeSecondsByPlayer = new Map<string, number>();
            precomputedSkillUsage.logRecords?.forEach((record) => {
                Object.entries(record.playerActiveSeconds || {}).forEach(([playerKey, seconds]) => {
                    if (!Number.isFinite(seconds)) return;
                    activeSecondsByPlayer.set(playerKey, (activeSecondsByPlayer.get(playerKey) || 0) + seconds);
                });
            });
            return {
                ...precomputedSkillUsage,
                skillOptions: (precomputedSkillUsage.skillOptions || []).map((option) => ({
                    ...option,
                    autoAttack: typeof option.autoAttack === 'boolean' ? option.autoAttack : isAutoAttackName(option.name)
                })),
                players: (precomputedSkillUsage.players || []).map((player) => ({
                    ...player,
                    totalActiveSeconds: player.totalActiveSeconds ?? activeSecondsByPlayer.get(player.key) ?? 0
                }))
            };
        }
        const skillNameMap = new Map<string, string>();
        const skillTotals = new Map<string, number>();
        const skillAutoAttackMap = new Map<string, boolean>();
        const playerMap = new Map<string, SkillUsagePlayer>();
        const logRecords: SkillUsageLogRecord[] = [];
        const resUtilitySkillNameMap = new Map<string, string>();

        const resolveSkillEntry = (map: Record<string, { name?: string; autoAttack?: boolean }> | undefined, id: number) => {
            const keyed = map?.[`s${id}`] || map?.[`${id}`];
            const name = keyed?.name || `Skill ${id}`;
            const autoAttack = typeof keyed?.autoAttack === 'boolean' ? keyed.autoAttack : isAutoAttackName(name);
            return { name, autoAttack };
        };

        validLogs.forEach((log) => {
            const details = log.details;
            if (!details) return;
            const skillMap = details.skillMap || {};
            const label = details.fightName || details.name || log.filePath || log.id || 'Log';
            let timestamp = 0;
            const parsedTime = Date.parse(details.timeStartStd || details.timeStart || '');
            if (!Number.isNaN(parsedTime)) {
                timestamp = parsedTime;
            } else {
                timestamp = details.uploadTime ?? log.uploadTime ?? Date.now();
            }

            const record: SkillUsageLogRecord = {
                id: log.filePath || log.id || label,
                label,
                timestamp,
                skillEntries: {},
                playerActiveSeconds: {},
                durationSeconds: details.durationMS ? details.durationMS / 1000 : 0
            };

            const players = (details.players || []) as any[];
            players.forEach((player) => {
                if (player?.notInSquad) {
                    return;
                }
                const account = player.account || player.name || player.character_name || 'Unknown';
                const profession = player.profession || 'Unknown';
                const key = `${account}|${profession}`;
                let playerRecord = playerMap.get(key);
                if (!playerRecord) {
                    playerRecord = {
                        key,
                        account,
                        displayName: player.account || account,
                        profession,
                        professionList: player.profession ? [player.profession] : [],
                        logs: 0,
                        totalActiveSeconds: 0,
                        skillTotals: {}
                    };
                    playerMap.set(key, playerRecord);
                }
                playerRecord.logs += 1;
                const activeMs = Array.isArray(player.activeTimes) && typeof player.activeTimes[0] === 'number'
                    ? player.activeTimes[0]
                    : details.durationMS || 0;
                const activeSeconds = activeMs > 0 ? activeMs / 1000 : 0;
                playerRecord.totalActiveSeconds = (playerRecord.totalActiveSeconds || 0) + activeSeconds;
                record.playerActiveSeconds![playerRecord.key] = activeSeconds;

                (player.rotation || []).forEach((rotationSkill: any) => {
                    if (!rotationSkill || typeof rotationSkill.id !== 'number') return;
                    const castCount = Array.isArray(rotationSkill.skills) ? rotationSkill.skills.length : 0;
                    if (castCount === 0) return;
                    const skillId = `s${rotationSkill.id}`;
                    const { name: skillName, autoAttack } = resolveSkillEntry(skillMap, rotationSkill.id);
                    const existingEntry = record.skillEntries[skillId] ?? { name: skillName, players: {} };
                    if (existingEntry.name.startsWith('Skill ') && !skillName.startsWith('Skill ')) {
                        existingEntry.name = skillName;
                    }
                    existingEntry.players[playerRecord.key] = (existingEntry.players[playerRecord.key] || 0) + castCount;
                    record.skillEntries[skillId] = existingEntry;

                    playerRecord.skillTotals[skillId] = (playerRecord.skillTotals[skillId] || 0) + castCount;
                    skillNameMap.set(skillId, skillName);
                    skillTotals.set(skillId, (skillTotals.get(skillId) || 0) + castCount);
                    skillAutoAttackMap.set(skillId, autoAttack);

                    if (isResUtilitySkill(rotationSkill.id, skillMap)) {
                        resUtilitySkillNameMap.set(skillId, skillName);
                    }
                });
            });

            logRecords.push(record);
        });

        logRecords.sort((a, b) => a.timestamp - b.timestamp);

        const players = Array.from(playerMap.values())
            .map((player) => ({
                ...player,
                professionList: Array.from(new Set(player.professionList || []))
            }))
            .sort((a, b) => b.logs - a.logs || a.displayName.localeCompare(b.displayName));

        const skillOptions = Array.from(skillNameMap.entries())
            .map(([id, name]) => ({
                id,
                name,
                total: skillTotals.get(id) || 0,
                autoAttack: skillAutoAttackMap.get(id) ?? isAutoAttackName(name)
            }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        return {
            logRecords,
            players,
            skillOptions,
            resUtilitySkills: Array.from(resUtilitySkillNameMap.entries())
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name))
        };
    }, [precomputedStats, validLogs]);

    const playerMapByKey = useMemo(() => {
        const map = new Map<string, SkillUsagePlayer>();
        skillUsageData.players.forEach((player) => map.set(player.key, player));
        return map;
    }, [skillUsageData.players]);

    const adjustHexColor = (hex: string, factor: number) => {
        const cleaned = hex.replace('#', '');
        if (cleaned.length !== 6) return hex;
        const clamp = (value: number) => Math.max(0, Math.min(255, value));
        const parse = (start: number) => Number.parseInt(cleaned.slice(start, start + 2), 16);
        const toHex = (value: number) => clamp(Math.round(value)).toString(16).padStart(2, '0');
        const r = parse(0);
        const g = parse(2);
        const b = parse(4);
        return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
    };

    const skillNameLookup = useMemo(() => new Map(skillUsageData.skillOptions.map((option) => [option.id, option.name])), [skillUsageData.skillOptions]);
    const skillAutoAttackLookup = useMemo(() => new Map(
        skillUsageData.skillOptions.map((option) => {
            const autoAttack = typeof option.autoAttack === 'boolean' ? option.autoAttack : isAutoAttackName(option.name);
            return [option.id, autoAttack];
        })
    ), [skillUsageData.skillOptions]);
    const isSkillUsagePerSecond = skillUsageView === 'perSecond';
    const formatSkillUsageValue = (value: number) => {
        if (isSkillUsagePerSecond) {
            return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return Math.round(value).toLocaleString();
    };
    const formatApmValue = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const formatCastRateValue = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatCastCountValue = (value: number) => Math.round(value).toLocaleString();

    const getPlayerActiveSeconds = (playerKey: string) => {
        const player = playerMapByKey.get(playerKey);
        return player?.totalActiveSeconds || 0;
    };

    const skillBarData = useMemo(() => {
        if (selectedPlayers.length === 0) return [];
        const totals = new Map<
            string,
            { total: number; name: string; dominantProfession: string; maxPlayerCount: number }
        >();
        const selectedActiveSeconds = selectedPlayers.reduce((sum, playerKey) => sum + getPlayerActiveSeconds(playerKey), 0);
        selectedPlayers.forEach((playerKey) => {
            const player = playerMapByKey.get(playerKey);
            if (!player) return;
            Object.entries(player.skillTotals).forEach(([skillId, count]) => {
                if (!count) return;
                const existing = totals.get(skillId) || {
                    total: 0,
                    name: skillNameLookup.get(skillId) || `Skill ${skillId}`,
                    dominantProfession: player.profession,
                    maxPlayerCount: 0
                };
                existing.total += count;
                if (count > existing.maxPlayerCount) {
                    existing.maxPlayerCount = count;
                    existing.dominantProfession = player.profession;
                }
                totals.set(skillId, existing);
            });
        });

        const filterTerm = skillUsageSkillFilter.trim().toLowerCase();
        const filtered = Array.from(totals.entries())
            .map(([skillId, data]) => ({
                skillId,
                name: data.name,
                total: isSkillUsagePerSecond && selectedActiveSeconds > 0
                    ? data.total / selectedActiveSeconds
                    : data.total,
                color: getProfessionColor(data.dominantProfession) || '#38bdf8'
            }))
            .filter((entry) => {
                if (!filterTerm) return true;
                return entry.name.toLowerCase().includes(filterTerm);
            })
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
        return filtered;
    }, [selectedPlayers, playerMapByKey, skillNameLookup, skillUsageSkillFilter, isSkillUsagePerSecond]);

    const skillUsageAvailable = skillUsageData.logRecords.length > 0 && skillUsageData.skillOptions.length > 0 && skillUsageData.players.length > 0;

    useEffect(() => {
        if (!selectedSkillId && skillUsageData.skillOptions.length > 0) {
            setSelectedSkillId(skillUsageData.skillOptions[0].id);
        }
    }, [skillUsageData.skillOptions, selectedSkillId]);

    const filteredPlayerOptions = useMemo(() => {
        const filterTerm = skillUsagePlayerFilter.trim().toLowerCase();
        if (!filterTerm) return skillUsageData.players;
        return skillUsageData.players.filter((player) => {
            return (
                player.displayName.toLowerCase().includes(filterTerm) ||
                player.account.toLowerCase().includes(filterTerm) ||
                player.profession.toLowerCase().includes(filterTerm)
            );
        });
    }, [skillUsageData.players, skillUsagePlayerFilter]);

    const groupedSkillUsagePlayers = useMemo(() => {
        const groups = new Map<string, SkillUsagePlayer[]>();
        filteredPlayerOptions.forEach((player) => {
            const profession = player.profession || 'Unknown';
            const list = groups.get(profession) || [];
            list.push(player);
            groups.set(profession, list);
        });
        return Array.from(groups.entries())
            .map(([profession, players]) => ({
                profession,
                players: [...players].sort((a, b) => b.logs - a.logs || a.displayName.localeCompare(b.displayName))
            }))
            .sort((a, b) => b.players.length - a.players.length || a.profession.localeCompare(b.profession));
    }, [filteredPlayerOptions]);

    useEffect(() => {
        if (expandedSkillUsageClass && !groupedSkillUsagePlayers.some((group) => group.profession === expandedSkillUsageClass)) {
            setExpandedSkillUsageClass(null);
        }
    }, [groupedSkillUsagePlayers, expandedSkillUsageClass]);

    const playerTotalsForSkill = useMemo(() => {
        if (!selectedSkillId) return {};
        return selectedPlayers.reduce((acc, playerKey) => {
            const player = playerMapByKey.get(playerKey);
            const total = player?.skillTotals[selectedSkillId] || 0;
            const activeSeconds = getPlayerActiveSeconds(playerKey);
            acc[playerKey] = isSkillUsagePerSecond && activeSeconds > 0 ? total / activeSeconds : total;
            return acc;
        }, {} as Record<string, number>);
    }, [selectedSkillId, selectedPlayers, playerMapByKey, isSkillUsagePerSecond]);

    const classMaxTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        selectedPlayers.forEach((playerKey) => {
            const player = playerMapByKey.get(playerKey);
            if (!player) return;
            const total = playerTotalsForSkill[playerKey] ?? 0;
            totals[player.profession] = Math.max(totals[player.profession] || 0, total);
        });
        return totals;
    }, [selectedPlayers, playerMapByKey, playerTotalsForSkill]);

    const classRankByPlayer = useMemo(() => {
        const ranks = new Map<string, number>();
        const grouped = new Map<string, Array<{ key: string; total: number }>>();
        selectedPlayers.forEach((playerKey) => {
            const player = playerMapByKey.get(playerKey);
            if (!player) return;
            const total = playerTotalsForSkill[playerKey] ?? 0;
            const list = grouped.get(player.profession) || [];
            list.push({ key: playerKey, total });
            grouped.set(player.profession, list);
        });
        grouped.forEach((list) => {
            list.sort((a, b) => b.total - a.total);
            list.forEach((entry, index) => {
                ranks.set(entry.key, index);
            });
        });
        return ranks;
    }, [selectedPlayers, playerMapByKey, playerTotalsForSkill]);

    const lineDashPatterns = ['0', '12 3', '8 3', '6 3', '4 3', '2 3'];

    const getLineColorForPlayer = (playerKey: string) => {
        const player = playerMapByKey.get(playerKey);
        const baseColor = getProfessionColor(player?.profession || '') || '#38bdf8';
        const total = playerTotalsForSkill[playerKey] ?? 0;
        const maxTotal = player?.profession ? classMaxTotals[player.profession] || 1 : 1;
        const ratio = maxTotal > 0 ? total / maxTotal : 1;
        const factor = 0.35 + ratio * 0.65;
        return adjustHexColor(baseColor, factor);
    };

    const getLineDashForPlayer = (playerKey: string) => {
        const rank = classRankByPlayer.get(playerKey) ?? 0;
        return lineDashPatterns[rank % lineDashPatterns.length];
    };

    const getLineStrokeColor = (playerKey: string, isSelected: boolean, hasSelection: boolean) => {
        if (!hasSelection) {
            return getLineColorForPlayer(playerKey);
        }
        const player = playerMapByKey.get(playerKey);
        const baseColor = getProfessionColor(player?.profession || '') || '#38bdf8';
        return isSelected ? adjustHexColor(baseColor, 1.2) : adjustHexColor(baseColor, 0.5);
    };

    const skillChartData = useMemo(() => {
        if (!selectedSkillId || selectedPlayers.length === 0) return [];
        return skillUsageData.logRecords.map((record, index) => {
            const timeLabel = new Date(record.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const point: Record<string, number | string> = {
                label: record.label,
                timestamp: record.timestamp,
                shortLabel: timeLabel,
                fullLabel: timeLabel,
                index
            };
            const entry = record.skillEntries[selectedSkillId];
            selectedPlayers.forEach((playerKey) => {
                const total = entry?.players?.[playerKey] ?? 0;
                const activeSeconds = record.playerActiveSeconds?.[playerKey] ?? record.durationSeconds ?? 0;
                point[playerKey] = isSkillUsagePerSecond && activeSeconds > 0 ? total / activeSeconds : total;
            });
            return point;
        });
    }, [skillUsageData.logRecords, selectedPlayers, selectedSkillId, isSkillUsagePerSecond]);

    const skillChartMaxY = useMemo(() => {
        let max = 0;
        skillChartData.forEach((point) => {
            selectedPlayers.forEach((playerKey) => {
                const value = Number(point[playerKey] ?? 0);
                if (value > max) max = value;
            });
        });
        return max;
    }, [skillChartData, selectedPlayers]);

    const selectedSkillName = skillUsageData.skillOptions.find((option) => option.id === selectedSkillId)?.name || '';
    const skillUsageReady = skillUsageAvailable && Boolean(selectedSkillId) && selectedPlayers.length > 0;

    const ALL_SKILLS_KEY = '__all__';
    const apmSpecTables = useMemo(() => {
        const specMap = new Map<string, ApmSpecBucket>();
        const playerLookup = new Map(skillUsageData.players.map((player) => [player.key, player]));
        const normalizeSkillKey = (name: string) => name.trim().toLowerCase();

        skillUsageData.players.forEach((player) => {
            const profession = player.profession || 'Unknown';
            const entry: ApmSpecBucket = specMap.get(profession) || {
                profession,
                players: [] as SkillUsagePlayer[],
                playerRows: [] as ApmPlayerRow[],
                totalActiveSeconds: 0,
                totalCasts: 0,
                totalAutoCasts: 0,
                skillMap: new Map<string, ApmSkillEntry>()
            };
            const activeSeconds = player.totalActiveSeconds || 0;
            let totalCasts = 0;
            let totalAutoCasts = 0;
            Object.entries(player.skillTotals || {}).forEach(([skillId, count]) => {
                if (!count) return;
                totalCasts += count;
                if (skillAutoAttackLookup.get(skillId)) {
                    totalAutoCasts += count;
                }
                const rawName = skillNameLookup.get(skillId) || `Skill ${skillId}`;
                const cleanedName = rawName.trim() || `Skill ${skillId}`;
                const skillKey = normalizeSkillKey(cleanedName);
                const skillEntry = entry.skillMap.get(skillKey) || {
                    id: skillKey,
                    name: cleanedName,
                    totalCasts: 0,
                    playerCounts: new Map<string, number>()
                };
                skillEntry.totalCasts += count;
                skillEntry.playerCounts.set(player.key, (skillEntry.playerCounts.get(player.key) || 0) + count);
                entry.skillMap.set(skillKey, skillEntry);
            });
            const nonAutoCasts = Math.max(0, totalCasts - totalAutoCasts);
            const activeMinutes = activeSeconds > 0 ? activeSeconds / 60 : 0;
            const apm = activeMinutes > 0 ? totalCasts / activeMinutes : 0;
            const apmNoAuto = activeMinutes > 0 ? nonAutoCasts / activeMinutes : 0;
            const aps = activeSeconds > 0 ? totalCasts / activeSeconds : 0;
            const apsNoAuto = activeSeconds > 0 ? nonAutoCasts / activeSeconds : 0;

            entry.players.push(player);
            entry.playerRows.push({
                key: player.key,
                account: player.account,
                displayName: player.displayName,
                profession,
                professionList: player.professionList || [],
                logs: player.logs,
                totalActiveSeconds: activeSeconds,
                totalCasts,
                totalAutoCasts,
                apm,
                apmNoAuto,
                aps,
                apsNoAuto
            });
            entry.totalActiveSeconds += activeSeconds;
            entry.totalCasts += totalCasts;
            entry.totalAutoCasts += totalAutoCasts;
            specMap.set(profession, entry);
        });

        const sortKey: 'apm' | 'aps' = apmView === 'perSecond' ? 'aps' : 'apm';
        return Array.from(specMap.values())
            .map((spec) => {
                const activeMinutes = spec.totalActiveSeconds > 0 ? spec.totalActiveSeconds / 60 : 0;
                const totalApm = activeMinutes > 0 ? spec.totalCasts / activeMinutes : 0;
                const nonAutoTotal = Math.max(0, spec.totalCasts - spec.totalAutoCasts);
                const totalApmNoAuto = activeMinutes > 0 ? nonAutoTotal / activeMinutes : 0;
                const totalAps = spec.totalActiveSeconds > 0 ? spec.totalCasts / spec.totalActiveSeconds : 0;
                const totalApsNoAuto = spec.totalActiveSeconds > 0 ? nonAutoTotal / spec.totalActiveSeconds : 0;
                const playerRows = [...spec.playerRows].sort((a, b) => {
                    const diff = b[sortKey] - a[sortKey];
                    if (diff !== 0) return diff;
                    return a.displayName.localeCompare(b.displayName);
                });
                const skills = Array.from(spec.skillMap.values())
                    .map((skill) => {
                        const name = skill.name || `Skill ${skill.id}`;
                        const playerRows = Array.from(skill.playerCounts.entries())
                            .map(([playerKey, count]) => {
                                const player = playerLookup.get(playerKey);
                                const activeSeconds = player?.totalActiveSeconds || 0;
                                const activeMinutes = activeSeconds > 0 ? activeSeconds / 60 : 0;
                                return {
                                    key: playerKey,
                                    displayName: player?.displayName || playerKey,
                                    profession: player?.profession || 'Unknown',
                                    professionList: player?.professionList || [],
                                    count,
                                    apm: activeMinutes > 0 ? count / activeMinutes : 0,
                                    aps: activeSeconds > 0 ? count / activeSeconds : 0
                                };
                            })
                            .sort((a, b) => {
                                const diff = b[sortKey] - a[sortKey];
                                if (diff !== 0) return diff;
                                return a.displayName.localeCompare(b.displayName);
                            });
                        const skillActiveSeconds = playerRows.reduce((sum, row) => sum + (playerLookup.get(row.key)?.totalActiveSeconds || 0), 0);
                        const skillActiveMinutes = skillActiveSeconds > 0 ? skillActiveSeconds / 60 : 0;
                        const totalApm = skillActiveMinutes > 0 ? skill.totalCasts / skillActiveMinutes : 0;
                        const totalAps = skillActiveSeconds > 0 ? skill.totalCasts / skillActiveSeconds : 0;
                        const totalCastsPerSecond = skillActiveSeconds > 0 ? skill.totalCasts / skillActiveSeconds : 0;
                        return {
                            id: skill.id,
                            name,
                            totalCasts: skill.totalCasts,
                            totalApm,
                            totalAps,
                            totalCastsPerSecond,
                            playerRows
                        };
                    })
                    .sort((a, b) => b.totalCasts - a.totalCasts || a.name.localeCompare(b.name));
                return {
                    ...spec,
                    totalApm,
                    totalApmNoAuto,
                    totalAps,
                    totalApsNoAuto,
                    playerRows,
                    skills
                };
            })
            .sort((a, b) => b.totalCasts - a.totalCasts || a.profession.localeCompare(b.profession));
    }, [skillUsageData.players, skillAutoAttackLookup, skillNameLookup, apmView]);

    const apmSpecAvailable = skillUsageAvailable && apmSpecTables.length > 0;
    const activeApmSpecTable = useMemo(
        () => apmSpecTables.find((spec) => spec.profession === activeApmSpec) ?? null,
        [apmSpecTables, activeApmSpec]
    );
    const isAllApmSkills = activeApmSkillId === ALL_SKILLS_KEY;
    const activeApmSkill = useMemo(
        () => activeApmSpecTable?.skills?.find((skill) => skill.id === activeApmSkillId) ?? null,
        [activeApmSpecTable, activeApmSkillId]
    );

    useEffect(() => {
        if (apmSpecTables.length === 0) {
            if (activeApmSpec !== null) {
                setActiveApmSpec(null);
            }
            if (expandedApmSpec !== null) {
                setExpandedApmSpec(null);
            }
            return;
        }
        if (!activeApmSpec || !apmSpecTables.some((spec) => spec.profession === activeApmSpec)) {
            const nextSpec = apmSpecTables[0].profession;
            setActiveApmSpec(nextSpec);
            setExpandedApmSpec(null);
        }
    }, [apmSpecTables, activeApmSpec, expandedApmSpec]);

    useEffect(() => {
        if (!activeApmSpecTable || activeApmSpecTable.skills.length === 0) {
            if (activeApmSkillId !== null) {
                setActiveApmSkillId(null);
            }
            return;
        }
        const hasSkill = activeApmSpecTable.skills.some((skill) => skill.id === activeApmSkillId);
        if (!activeApmSkillId || (!hasSkill && activeApmSkillId !== ALL_SKILLS_KEY)) {
            setActiveApmSkillId(ALL_SKILLS_KEY);
        }
    }, [activeApmSpecTable, activeApmSkillId]);

    const togglePlayerSelection = (playerKey: string) => {
        setSelectedPlayers((prev) => {
            if (prev.includes(playerKey)) {
                return prev.filter((key) => key !== playerKey);
            }
            return [...prev, playerKey];
        });
    };

    const removeSelectedPlayer = (playerKey: string) => {
        setSelectedPlayers((prev) => prev.filter((key) => key !== playerKey));
    };

    const filteredBoonTables = useMemo(() => {
        const term = boonSearch.trim().toLowerCase();
        if (!term) return stats.boonTables;
        return stats.boonTables.filter((boon: any) => boon.name.toLowerCase().includes(term));
    }, [stats.boonTables, boonSearch]);
    const activeBoonTable = useMemo(() => {
        if (!activeBoonTab) return null;
        return stats.boonTables.find((boon: any) => boon.id === activeBoonTab) ?? null;
    }, [stats.boonTables, activeBoonTab]);
    const filteredSpecialTables = useMemo(() => {
        const term = specialSearch.trim().toLowerCase();
        const sorted = [...stats.specialTables].sort((a: any, b: any) => a.name.localeCompare(b.name));
        if (!term) return sorted;
        return sorted.filter((buff: any) => buff.name.toLowerCase().includes(term));
    }, [stats.specialTables, specialSearch]);
    const activeSpecialTable = useMemo(() => {
        if (!activeSpecialTab) return null;
        return stats.specialTables.find((buff: any) => buff.id === activeSpecialTab) ?? null;
    }, [stats.specialTables, activeSpecialTab]);

    useEffect(() => {
        if (!stats.boonTables || stats.boonTables.length === 0) return;
        if (!activeBoonTab || !stats.boonTables.some((tab: any) => tab.id === activeBoonTab)) {
            setActiveBoonTab(stats.boonTables[0].id);
        }
    }, [stats.boonTables, activeBoonTab]);

    useEffect(() => {
        if (!stats.specialTables || stats.specialTables.length === 0) return;
        if (!activeSpecialTab || !stats.specialTables.some((tab: any) => tab.id === activeSpecialTab)) {
            setActiveSpecialTab(stats.specialTables[0].id);
        }
    }, [stats.specialTables, activeSpecialTab]);

    useEffect(() => {
        const clearSelection = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                selection.removeAllRanges();
            }
        };
        const preventChartSelection = (event: Event) => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest?.('.recharts-wrapper')) return;
            event.preventDefault();
            clearSelection();
        };
        document.addEventListener('selectstart', preventChartSelection);
        document.addEventListener('mousedown', preventChartSelection);
        document.addEventListener('mousemove', preventChartSelection);
        document.addEventListener('dragstart', preventChartSelection);
        return () => {
            document.removeEventListener('selectstart', preventChartSelection);
            document.removeEventListener('mousedown', preventChartSelection);
            document.removeEventListener('mousemove', preventChartSelection);
            document.removeEventListener('dragstart', preventChartSelection);
        };
    }, []);

    const buildReportMeta = () => {
        const commanderSet = new Set<string>();
        let firstStart: Date | null = null;
        let lastEnd: Date | null = null;

        logs.forEach((log) => {
            const details = log.details;
            if (!details) return;
            const timeStart = details.timeStartStd || details.timeStart || details.uploadTime || log.uploadTime;
            const timeEnd = details.timeEndStd || details.timeEnd || details.uploadTime || log.uploadTime;
            const startDate = timeStart ? new Date(timeStart) : null;
            const endDate = timeEnd ? new Date(timeEnd) : null;
            if (startDate && !Number.isNaN(startDate.getTime())) {
                if (!firstStart || startDate < firstStart) firstStart = startDate;
            }
            if (endDate && !Number.isNaN(endDate.getTime())) {
                if (!lastEnd || endDate > lastEnd) lastEnd = endDate;
            }
            const players = (details.players || []) as any[];
            players.forEach((player) => {
                if (player?.notInSquad) return;
                if (player?.hasCommanderTag) {
                    const name = player?.name || player?.account || 'Unknown';
                    commanderSet.add(name);
                }
            });
        });

        const commanders = Array.from(commanderSet).sort((a, b) => a.localeCompare(b));
        const safeStart = firstStart || new Date();
        const safeEnd = lastEnd || safeStart;
        const dateStart = safeStart.toISOString();
        const dateEnd = safeEnd.toISOString();
        const dateLabel = `${safeStart.toLocaleString()} - ${safeEnd.toLocaleString()}`;

        const pad = (value: number) => String(value).padStart(2, '0');
        const reportId = `${safeStart.getFullYear()}${pad(safeStart.getMonth() + 1)}${pad(safeStart.getDate())}-${pad(safeStart.getHours())}${pad(safeStart.getMinutes())}${pad(safeStart.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;

        return {
            id: reportId,
            title: commanders.length ? commanders.join(', ') : 'Unknown Commander',
            commanders,
            dateStart,
            dateEnd,
            dateLabel,
            generatedAt: new Date().toISOString()
        };
    };

    const handleWebUpload = async () => {
        if (embedded) return;
        if (!onWebUpload) return;
        try {
            const meta = buildReportMeta();
            await onWebUpload({
                meta,
                stats: {
                    ...stats,
                    skillUsageData,
                    statsViewSettings: activeStatsViewSettings,
                    uiTheme: uiTheme || 'classic'
                }
            });
        } catch (err) {
            console.error('[StatsView] Web upload failed:', err);
        }
    };

    const handleDevMockUpload = async () => {
        if (embedded || !window.electronAPI?.mockWebReport) return;
        setDevMockUploadState({ uploading: true, message: 'Preparing local report...', url: null });
        try {
            const meta = buildReportMeta();
            const result = await window.electronAPI.mockWebReport({
                meta,
                stats: {
                    ...stats,
                    skillUsageData,
                    statsViewSettings: activeStatsViewSettings,
                    uiTheme: uiTheme || 'classic'
                }
            });
            if (result?.success) {
                setDevMockUploadState({
                    uploading: false,
                    message: 'Local report ready.',
                    url: result.url || null
                });
            } else {
                setDevMockUploadState({
                    uploading: false,
                    message: result?.error || 'Local report failed.',
                    url: null
                });
            }
        } catch (err: any) {
            setDevMockUploadState({
                uploading: false,
                message: err?.message || 'Local report failed.',
                url: null
            });
        }
    };

    const handleShare = async () => {
        if (embedded || !window.electronAPI?.sendStatsScreenshot) return;
        setSharing(true);
        const node = document.getElementById('stats-dashboard-container');
        if (node) {
            try {
                // Wait a moment for UI to settle if anything changed
                await new Promise(r => setTimeout(r, 100));

                const excluded = Array.from(node.querySelectorAll('.stats-share-exclude')) as HTMLElement[];
                excluded.forEach((el) => {
                    el.dataset.prevDisplay = el.style.display;
                    el.style.display = 'none';
                });
                const scrollWidth = node.scrollWidth;
                const scrollHeight = node.scrollHeight;
                const dataUrl = await toPng(node, {
                    backgroundColor: '#0f172a',
                    quality: 0.95,
                    pixelRatio: 2,
                    cacheBust: true,
                    width: scrollWidth,
                    height: scrollHeight,
                    style: {
                        overflow: 'visible',
                        maxHeight: 'none',
                        height: 'auto'
                    }
                });
                excluded.forEach((el) => {
                    el.style.display = el.dataset.prevDisplay || '';
                    delete el.dataset.prevDisplay;
                });

                const resp = await fetch(dataUrl);
                const blob = await resp.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

                window.electronAPI.sendStatsScreenshot(buffer);
            } catch (err) {
                console.error("Failed to capture stats:", err);
            }
        }
        setTimeout(() => setSharing(false), 2000);
    };


    const openExpandedSection = (sectionId: string) => {
        if (expandedCloseTimerRef.current) {
            window.clearTimeout(expandedCloseTimerRef.current);
            expandedCloseTimerRef.current = null;
        }
        setExpandedSectionClosing(false);
        setExpandedSection(sectionId);
    };

    const closeExpandedSection = () => {
        if (!expandedSection) return;
        if (expandedCloseTimerRef.current) {
            window.clearTimeout(expandedCloseTimerRef.current);
        }
        setExpandedSectionClosing(true);
        expandedCloseTimerRef.current = window.setTimeout(() => {
            setExpandedSection(null);
            setExpandedSectionClosing(false);
            expandedCloseTimerRef.current = null;
        }, 160);
    };

    useEffect(() => {
        if (!expandedSection) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeExpandedSection();
            }
        };
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
        };
    }, [expandedSection]);

    const sortByCountDesc = (a: any, b: any) => {
        const diff = (b?.value || 0) - (a?.value || 0);
        if (diff !== 0) return diff;
        return String(a?.name || '').localeCompare(String(b?.name || ''));
    };
    const sortedSquadClassData = [...stats.squadClassData].sort(sortByCountDesc);
    const sortedEnemyClassData = [...stats.enemyClassData].sort(sortByCountDesc);

    const containerClass = embedded
        ? 'stats-view min-h-screen flex flex-col p-0 w-full max-w-none'
        : 'stats-view h-full flex flex-col p-1 w-full max-w-6xl mx-auto overflow-hidden';
    const scrollContainerClass = embedded
        ? `stats-sections space-y-0 min-h-0 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 rounded-xl bg-black/20 border border-white/5 ${
            expandedSection ? '' : 'backdrop-blur-xl'
        }`
        : `flex-1 overflow-y-auto pr-2 space-y-6 min-h-0 bg-black/30 border border-white/5 p-4 rounded-xl ${
            expandedSection ? '' : 'backdrop-blur-2xl'
        }`;
    const scrollContainerStyle: CSSProperties | undefined = embedded
        ? {
            backgroundColor: 'rgba(3, 7, 18, 0.75)',
            backgroundImage: 'linear-gradient(160deg, rgba(var(--accent-rgb), 0.12), rgba(var(--accent-rgb), 0.04) 70%)'
        }
        : undefined;

    return (
        <div className={containerClass}>
            {expandedSection && (
                <div
                    className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-md modal-backdrop ${
                        expandedSectionClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
                    }`}
                    onClick={closeExpandedSection}
                />
            )}
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 shrink-0">
                <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    {!embedded && (
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                    )}
                    <div className="space-y-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            {dashboardTitle || 'Statistics Dashboard'}
                        </h1>
                        <p className="text-gray-400 text-[11px] sm:text-xs">
                            Performance across {stats.total} uploaded logs
                        </p>
                    </div>
                </div>
                {!embedded && (
                    <div className="flex items-center gap-3">
                        {devMockAvailable && (
                            <button
                                onClick={handleDevMockUpload}
                                disabled={devMockUploadState.uploading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25"
                            >
                                <Sparkles className="w-4 h-4" />
                                {devMockUploadState.uploading ? 'Building...' : 'Dev Mock Upload'}
                            </button>
                        )}
                        <button
                            onClick={handleWebUpload}
                            disabled={uploadingWeb}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <UploadCloud className="w-4 h-4" />
                            {uploadingWeb ? 'Uploading...' : 'Upload to Web'}
                        </button>
                        <button
                            onClick={handleShare}
                            disabled={sharing}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <Share2 className="w-4 h-4" />
                            {sharing ? 'Sharing...' : 'Share to Discord'}
                        </button>
                    </div>
                )}
            </div>

            {!embedded && webUploadMessage && (
                <div className="mb-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-300 flex items-center gap-2">
                        <span className="uppercase tracking-widest text-[10px] text-cyan-300/70">Uploaded</span>
                        <button
                            onClick={() => {
                                const url = webUploadUrl || webUploadMessage.replace(/^Uploaded:\s*/i, '').trim();
                                if (url && window.electronAPI?.openExternal) {
                                    window.electronAPI.openExternal(url);
                                }
                            }}
                            className="text-cyan-200 hover:text-cyan-100 underline underline-offset-2"
                        >
                            {webUploadUrl || webUploadMessage.replace(/^Uploaded:\s*/i, '')}
                        </button>
                        {webUploadBuildStatus !== 'idle' && (
                            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${webUploadBuildStatus === 'built'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : webUploadBuildStatus === 'errored'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : webUploadBuildStatus === 'unknown'
                                        ? 'bg-white/5 text-gray-400 border-white/10'
                                        : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                                }`}>
                                {(webUploadBuildStatus === 'checking' || webUploadBuildStatus === 'building') && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                )}
                                {webUploadBuildStatus === 'built' && <CheckCircle2 className="w-3 h-3" />}
                                {webUploadBuildStatus === 'errored' && <XCircle className="w-3 h-3" />}
                                {webUploadBuildStatus === 'built'
                                    ? 'Build ready'
                                    : webUploadBuildStatus === 'errored'
                                        ? 'Build failed'
                                        : webUploadBuildStatus === 'unknown'
                                            ? 'Build status unknown'
                                            : 'Building…'}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            const url = webUploadUrl || webUploadMessage.replace(/^Uploaded:\s*/i, '').trim();
                            if (url) {
                                navigator.clipboard.writeText(url);
                                setWebCopyStatus('copied');
                                setTimeout(() => setWebCopyStatus('idle'), 1200);
                            }
                        }}
                        className="px-3 py-1 rounded-full text-[10px] border bg-white/5 text-gray-300 border-white/10 hover:text-white"
                    >
                        {webCopyStatus === 'copied' ? 'Copied' : 'Copy URL'}
                    </button>
                </div>
            )}

            {!embedded && devMockAvailable && devMockUploadState.message && (
                <div className="mb-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-300 flex items-center gap-2">
                        <span className="uppercase tracking-widest text-[10px] text-amber-300/70">Dev Mock</span>
                        {devMockUploadState.url ? (
                            <button
                                onClick={() => {
                                    const url = devMockUploadState.url;
                                    if (url && window.electronAPI?.openExternal) {
                                        window.electronAPI.openExternal(url);
                                    }
                                }}
                                className="text-amber-200 hover:text-amber-100 underline underline-offset-2"
                            >
                                {devMockUploadState.url}
                            </button>
                        ) : (
                            <span className="text-gray-300">{devMockUploadState.message}</span>
                        )}
                    </div>
                    {devMockUploadState.url && (
                        <button
                            onClick={() => {
                                const url = devMockUploadState.url;
                                if (url && window.electronAPI?.openExternal) {
                                    window.electronAPI.openExternal(url);
                                }
                            }}
                            className="px-3 py-1 rounded-full text-[10px] border bg-white/5 text-gray-300 border-white/10 hover:text-white"
                        >
                            Open in Browser
                        </button>
                    )}
                </div>
            )}

            <div
                id="stats-dashboard-container"
                ref={scrollContainerRef}
                className={scrollContainerClass}
                style={scrollContainerStyle}
            >

                <OverviewSection
                    stats={stats}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <FightBreakdownSection
                    stats={stats}
                    fightBreakdownTab={fightBreakdownTab}
                    setFightBreakdownTab={setFightBreakdownTab}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <TopPlayersSection
                    stats={stats}
                    showTopStats={showTopStats}
                    showMvp={showMvp}
                    topStatsMode={topStatsMode}
                    expandedLeader={expandedLeader}
                    setExpandedLeader={setExpandedLeader}
                    formatTopStatValue={formatTopStatValue}
                    formatWithCommas={formatWithCommas}
                    isMvpStatEnabled={isMvpStatEnabled}
                    renderProfessionIcon={renderProfessionIcon}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <TopSkillsSection
                    stats={stats}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <SquadCompositionSection
                    sortedSquadClassData={sortedSquadClassData}
                    sortedEnemyClassData={sortedEnemyClassData}
                    getProfessionIconPath={getProfessionIconPath}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <TimelineSection
                    timelineData={stats.timelineData}
                    timelineFriendlyScope={timelineFriendlyScope}
                    setTimelineFriendlyScope={setTimelineFriendlyScope}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <MapDistributionSection
                    mapData={stats.mapData}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <OffenseSection
                    stats={stats}
                    OFFENSE_METRICS={OFFENSE_METRICS}
                    roundCountStats={roundCountStats}
                    offenseSearch={offenseSearch}
                    setOffenseSearch={setOffenseSearch}
                    activeOffenseStat={activeOffenseStat}
                    setActiveOffenseStat={setActiveOffenseStat}
                    offenseViewMode={offenseViewMode}
                    setOffenseViewMode={setOffenseViewMode}
                    formatWithCommas={formatWithCommas}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <ConditionsSection
                    conditionSummary={conditionSummary}
                    conditionPlayers={conditionPlayers}
                    conditionSearch={conditionSearch}
                    setConditionSearch={setConditionSearch}
                    activeConditionName={activeConditionName}
                    setActiveConditionName={setActiveConditionName}
                    conditionDirection={conditionDirection}
                    setConditionDirection={setConditionDirection}
                    conditionGridClass={conditionGridClass}
                    effectiveConditionSort={effectiveConditionSort}
                    setConditionSort={setConditionSort}
                    showConditionDamage={showConditionDamage}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <DefenseSection
                    stats={stats}
                    DEFENSE_METRICS={DEFENSE_METRICS}
                    defenseSearch={defenseSearch}
                    setDefenseSearch={setDefenseSearch}
                    activeDefenseStat={activeDefenseStat}
                    setActiveDefenseStat={setActiveDefenseStat}
                    defenseViewMode={defenseViewMode}
                    setDefenseViewMode={setDefenseViewMode}
                    roundCountStats={roundCountStats}
                    formatWithCommas={formatWithCommas}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <BoonOutputSection
                    stats={stats}
                    activeBoonCategory={activeBoonCategory}
                    setActiveBoonCategory={setActiveBoonCategory}
                    activeBoonMetric={activeBoonMetric}
                    setActiveBoonMetric={setActiveBoonMetric}
                    activeBoonTab={activeBoonTab}
                    setActiveBoonTab={setActiveBoonTab}
                    activeBoonTable={activeBoonTable}
                    filteredBoonTables={filteredBoonTables}
                    boonSearch={boonSearch}
                    setBoonSearch={setBoonSearch}
                    formatBoonMetricDisplay={formatBoonMetricDisplay}
                    getBoonMetricValue={getBoonMetricValue}
                    renderProfessionIcon={renderProfessionIcon}
                    roundCountStats={roundCountStats}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <SupportSection
                    stats={stats}
                    SUPPORT_METRICS={SUPPORT_METRICS}
                    supportSearch={supportSearch}
                    setSupportSearch={setSupportSearch}
                    activeSupportStat={activeSupportStat}
                    setActiveSupportStat={setActiveSupportStat}
                    supportViewMode={supportViewMode}
                    setSupportViewMode={setSupportViewMode}
                    cleanseScope={cleanseScope}
                    setCleanseScope={setCleanseScope}
                    roundCountStats={roundCountStats}
                    formatWithCommas={formatWithCommas}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <HealingSection
                    stats={stats}
                    HEALING_METRICS={HEALING_METRICS}
                    activeHealingMetric={activeHealingMetric}
                    setActiveHealingMetric={setActiveHealingMetric}
                    healingCategory={healingCategory}
                    setHealingCategory={setHealingCategory}
                    activeResUtilitySkill={activeResUtilitySkill}
                    setActiveResUtilitySkill={setActiveResUtilitySkill}
                    skillUsageData={skillUsageData}
                    formatWithCommas={formatWithCommas}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                />

                <SpecialBuffsSection
                    stats={stats}
                    specialSearch={specialSearch}
                    setSpecialSearch={setSpecialSearch}
                    filteredSpecialTables={filteredSpecialTables}
                    activeSpecialTab={activeSpecialTab}
                    setActiveSpecialTab={setActiveSpecialTab}
                    activeSpecialTable={activeSpecialTable}
                    formatWithCommas={formatWithCommas}
                    renderProfessionIcon={renderProfessionIcon}
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                />

                <SkillUsageSection
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    selectedPlayers={selectedPlayers}
                    setSelectedPlayers={setSelectedPlayers}
                    removeSelectedPlayer={removeSelectedPlayer}
                    playerMapByKey={playerMapByKey}
                    groupedSkillUsagePlayers={groupedSkillUsagePlayers}
                    expandedSkillUsageClass={expandedSkillUsageClass}
                    setExpandedSkillUsageClass={setExpandedSkillUsageClass}
                    togglePlayerSelection={togglePlayerSelection}
                    skillUsagePlayerFilter={skillUsagePlayerFilter}
                    setSkillUsagePlayerFilter={setSkillUsagePlayerFilter}
                    skillUsageView={skillUsageView}
                    setSkillUsageView={setSkillUsageView}
                    skillUsageData={skillUsageData}
                    skillUsageSkillFilter={skillUsageSkillFilter}
                    setSkillUsageSkillFilter={setSkillUsageSkillFilter}
                    selectedSkillId={selectedSkillId}
                    setSelectedSkillId={setSelectedSkillId}
                    skillBarData={skillBarData}
                    selectedSkillName={selectedSkillName}
                    skillUsageReady={skillUsageReady}
                    skillUsageAvailable={skillUsageAvailable}
                    isSkillUsagePerSecond={isSkillUsagePerSecond}
                    skillChartData={skillChartData}
                    skillChartMaxY={skillChartMaxY}
                    playerTotalsForSkill={playerTotalsForSkill}
                    hoveredSkillPlayer={hoveredSkillPlayer}
                    setHoveredSkillPlayer={setHoveredSkillPlayer}
                    getLineStrokeColor={getLineStrokeColor}
                    getLineDashForPlayer={getLineDashForPlayer}
                    formatSkillUsageValue={formatSkillUsageValue}
                    formatCastRateValue={formatCastRateValue}
                    formatCastCountValue={formatCastCountValue}
                    renderProfessionIcon={renderProfessionIcon}
                />

                <ApmSection
                    expandedSection={expandedSection}
                    expandedSectionClosing={expandedSectionClosing}
                    openExpandedSection={openExpandedSection}
                    closeExpandedSection={closeExpandedSection}
                    isSectionVisible={isSectionVisible}
                    isFirstVisibleSection={isFirstVisibleSection}
                    sectionClass={sectionClass}
                    sidebarListClass={sidebarListClass}
                    apmSpecAvailable={apmSpecAvailable}
                    skillUsageAvailable={skillUsageAvailable}
                    apmSpecTables={apmSpecTables}
                    activeApmSpec={activeApmSpec}
                    setActiveApmSpec={setActiveApmSpec}
                    expandedApmSpec={expandedApmSpec}
                    setExpandedApmSpec={setExpandedApmSpec}
                    activeApmSkillId={activeApmSkillId}
                    setActiveApmSkillId={setActiveApmSkillId}
                    ALL_SKILLS_KEY={ALL_SKILLS_KEY}
                    apmSkillSearch={apmSkillSearch}
                    setApmSkillSearch={setApmSkillSearch}
                    activeApmSpecTable={activeApmSpecTable}
                    activeApmSkill={activeApmSkill}
                    isAllApmSkills={isAllApmSkills}
                    apmView={apmView}
                    setApmView={setApmView}
                    formatApmValue={formatApmValue}
                    formatCastRateValue={formatCastRateValue}
                    formatCastCountValue={formatCastCountValue}
                    renderProfessionIcon={renderProfessionIcon}
                />
                {!embedded && <div className="h-24" aria-hidden="true" />}
            </div>

            {!embedded && (
                <>
                    <div
                        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-md transition-opacity ${mobileNavOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <div className="fixed bottom-4 left-4 right-4 z-50">
                        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/25 bg-white/5 backdrop-blur-2xl px-3 py-1.5 shadow-[0_24px_65px_rgba(0,0,0,0.55)]">
                            <button
                                onClick={() => stepSection(-1)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-gray-200"
                            >
                                <ChevronDown className="w-4 h-4 rotate-90 text-[color:var(--accent)]" />
                                Prev
                            </button>
                            <button
                                onClick={() => setMobileNavOpen((open) => !open)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-gray-200"
                            >
                                <span className="truncate max-w-[160px]">
                                    {tocItems.find((item) => item.id === activeNavId)?.label || 'Sections'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-[color:var(--accent)] transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                                onClick={() => stepSection(1)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-gray-200"
                            >
                                Next
                                <ChevronDown className="w-4 h-4 -rotate-90 text-[color:var(--accent)]" />
                            </button>
                        </div>
                    </div>
                    {mobileNavOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center px-4"
                            onClick={(event) => {
                                if (event.target === event.currentTarget) {
                                    setMobileNavOpen(false);
                                }
                            }}
                        >
                            <div className="w-full max-w-sm max-h-[80vh] rounded-2xl p-4 border border-white/20 bg-white/5 shadow-[0_22px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[11px] uppercase tracking-[0.3em] text-gray-400">Jump to</div>
                                    <button
                                        onClick={() => setMobileNavOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                                        aria-label="Close navigation"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1 pb-2">
                                    {tocItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = item.id === activeNavId;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => scrollToSection(item.id)}
                                                className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-200 border transition-colors ${isActive
                                                    ? 'bg-white/10 border-white/20'
                                                    : 'border-transparent hover:border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10">
                                                    <Icon className="w-3.5 h-3.5 text-[color:var(--accent)]" />
                                                </span>
                                                <span className="text-[13px] font-medium">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
