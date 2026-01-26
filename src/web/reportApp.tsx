import { useEffect, useMemo, useState } from 'react';
import { StatsView } from '../renderer/StatsView';
import { ShieldCheck, CalendarDays, Users, ExternalLink } from 'lucide-react';

interface ReportMeta {
    id: string;
    title: string;
    commanders: string[];
    dateStart: string;
    dateEnd: string;
    dateLabel: string;
    generatedAt: string;
    appVersion?: string;
}

interface ReportPayload {
    meta: ReportMeta;
    stats: any;
}

interface ReportIndexEntry {
    id: string;
    title: string;
    commanders: string[];
    dateStart: string;
    dateEnd: string;
    dateLabel: string;
    url: string;
}

const glassCard = 'bg-white/5 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md';

const formatLocalRange = (start: string, end: string) => {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
        return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
    } catch {
        return '';
    }
};

export function ReportApp() {
    const [report, setReport] = useState<ReportPayload | null>(null);
    const [index, setIndex] = useState<ReportIndexEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reportPathHint, setReportPathHint] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let isMounted = true;
        const params = new URLSearchParams(window.location.search);
        const reportId = params.get('report') || window.location.pathname.match(/\/reports\/([^/]+)\/?$/)?.[1] || null;
        const basePath = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;
        const reportPath = reportId ? `${basePath}reports/${reportId}/report.json` : `${basePath}report.json`;
        if (reportId) {
            setReportPathHint(reportPath);
        }

        fetch(reportPath, { cache: 'no-store' })
            .then((resp) => (resp.ok ? resp.json() : Promise.reject()))
            .then((data) => {
                if (!isMounted) return;
                setReport(data);
            })
            .catch(() => {
                if (reportId) {
                    if (!isMounted) return;
                    setError('Report not found yet. It may still be deploying.');
                }
                fetch(`${basePath}reports/index.json`, { cache: 'no-store' })
                    .then((resp) => (resp.ok ? resp.json() : Promise.reject()))
                    .then((data) => {
                        if (!isMounted) return;
                        setIndex(Array.isArray(data) ? data : []);
                    })
                    .catch(() => {
                        if (!isMounted) return;
                        setError('No report data found.');
                });
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const sortedIndex = useMemo(() => {
        if (!index) return [];
        return [...index].sort((a, b) => {
            const aTime = new Date(a.dateEnd || a.dateStart).getTime();
            const bTime = new Date(b.dateEnd || b.dateStart).getTime();
            return bTime - aTime;
        });
    }, [index]);

    const filteredIndex = useMemo(() => {
        if (!sortedIndex.length) return [];
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedIndex;
        return sortedIndex.filter((entry) => {
            const commanders = entry.commanders?.join(' ') || '';
            const haystack = `${entry.title} ${commanders} ${entry.dateLabel}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [sortedIndex, searchTerm]);

    if (report) {
        return (
            <div className="min-h-screen bg-[#0f172a] text-white relative">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-[140px]" />
                    <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-[120px]" />
                    <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-[120px]" />
                </div>
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className={`${glassCard} p-6 mb-6`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">GW2 Arc Log Report</div>
                                <h1 className="text-3xl font-bold mt-1">{report.meta.title}</h1>
                                <div className="text-sm text-gray-400 mt-2">{report.meta.dateLabel || formatLocalRange(report.meta.dateStart, report.meta.dateEnd)}</div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs uppercase tracking-widest text-gray-300 flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-cyan-300" />
                                    {report.meta.dateLabel || 'Log Range'}
                                </div>
                                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs uppercase tracking-widest text-gray-300 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-300" />
                                    {report.meta.commanders.length ? report.meta.commanders.join(', ') : 'No Commanders'}
                                </div>
                                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs uppercase tracking-widest text-gray-300 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-indigo-300" />
                                    Report {report.meta.appVersion ? `v${report.meta.appVersion}` : 'build'}
                                </div>
                                <a
                                    href="./"
                                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs uppercase tracking-widest text-cyan-200 hover:text-cyan-100 hover:border-cyan-300/40 transition-colors"
                                >
                                    Back to Reports
                                </a>
                            </div>
                        </div>
                    </div>
                    <StatsView logs={[]} onBack={() => {}} mvpWeights={undefined} precomputedStats={report.stats} embedded />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white relative">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-[140px]" />
                <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-[120px]" />
                <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-[120px]" />
            </div>
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className={`${glassCard} p-6 mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
                    <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">GW2 Arc Log Uploader</div>
                        <h1 className="text-3xl font-bold mt-2">Command Reports</h1>
                        <p className="text-gray-400 mt-1">Select a report to view the full stats dashboard.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs uppercase tracking-widest text-gray-300">
                            {filteredIndex.length} Reports
                        </div>
                    </div>
                </div>

                <div className={`${glassCard} px-4 py-3 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between`}>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search reports, commanders, or date..."
                        className="w-full md:flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    />
                    <div className="text-xs text-gray-400">
                        Showing <span className="text-cyan-200">{filteredIndex.length}</span> of <span className="text-cyan-200">{sortedIndex.length}</span>
                    </div>
                </div>

                {error && (
                    <div className={`${glassCard} p-6 text-gray-300`}>
                        <div className="font-semibold text-white">{error}</div>
                        {reportPathHint && (
                            <div className="text-xs text-gray-400 mt-2">
                                Looking for: <span className="text-cyan-200">{reportPathHint}</span>
                            </div>
                        )}
                    </div>
                )}

                {!error && !index && (
                    <div className={`${glassCard} p-6 text-gray-300`}>Loading reports...</div>
                )}

                {filteredIndex.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {filteredIndex.map((entry) => (
                            <a
                                key={entry.id}
                                href={entry.url}
                                className={`${glassCard} px-5 py-4 hover:border-cyan-400/40 transition-colors group`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-[11px] uppercase tracking-widest text-gray-400">{entry.dateLabel}</div>
                                        <div className="text-lg font-semibold mt-1 truncate">{entry.title}</div>
                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-emerald-300" />
                                            <span className="truncate">{entry.commanders.length ? entry.commanders.join(', ') : 'No Commanders'}</span>
                                        </div>
                                    </div>
                                    <ExternalLink className="w-5 h-5 text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {!error && index && sortedIndex.length === 0 && (
                    <div className={`${glassCard} p-6 text-gray-300`}>No reports uploaded yet.</div>
                )}

                {!error && index && sortedIndex.length > 0 && filteredIndex.length === 0 && (
                    <div className={`${glassCard} p-6 text-gray-300`}>No reports match your search.</div>
                )}
            </div>
        </div>
    );
}
