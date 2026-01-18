import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, UploadCloud, FileText, Settings, Minus, Square, X } from 'lucide-react';
import { ExpandableLogCard } from './ExpandableLogCard';

function App() {
    const [logDirectory, setLogDirectory] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string>('');
    const [logs, setLogs] = useState<ILogData[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Stats calculation
    const totalUploads = logs.length;
    const avgSquadSize = logs.length > 0
        ? Math.round(logs.reduce((acc, log) => acc + (log.details?.players?.length || 0), 0) / logs.length)
        : 0;
    const successRate = logs.length > 0
        ? Math.round((logs.filter(log => log.details?.success).length / logs.length) * 100)
        : 0;

    useEffect(() => {
        // Load saved settings
        const loadSettings = async () => {
            const settings = await window.electronAPI.getSettings();
            if (settings.logDirectory) {
                setLogDirectory(settings.logDirectory);
                window.electronAPI.startWatching(settings.logDirectory);
            }
            if (settings.discordWebhookUrl) {
                setWebhookUrl(settings.discordWebhookUrl);
                window.electronAPI.setDiscordWebhook(settings.discordWebhookUrl);
            }
        };
        loadSettings();

        // Listen for detected logs (Just filepath initially)
        /* 
           Note: The current main process sends 'log-detected' with just path, 
           and 'upload-complete' with full data. We rely on 'upload-complete' for the list content. 
           We can ignore 'log-detected' for the list if we only want to show uploaded ones, 
           or we can show a "Loading..." state.
           For simplicity, let's just listen to upload-complete for the table.
        */
        // const cleanupLog = window.electronAPI.onLogDetected((path) => {
        //      // Optional: Add temporary pending log
        // });

        // Listen for status updates during upload process
        const cleanupStatus = window.electronAPI.onUploadStatus((data: ILogData) => {
            console.log("Upload status:", data);
            setLogs((currentLogs) => {
                const existingIndex = currentLogs.findIndex(log => log.filePath === data.filePath);
                if (existingIndex >= 0) {
                    const updated = [...currentLogs];
                    updated[existingIndex] = { ...updated[existingIndex], ...data };
                    return updated;
                } else {
                    return [data, ...currentLogs];
                }
            });
        });

        const cleanupUpload = window.electronAPI.onUploadComplete((data: ILogData) => {
            console.log("Upload complete:", data);
            setLogs((currentLogs) => {
                const existingIndex = currentLogs.findIndex(log => log.filePath === data.filePath);
                if (existingIndex >= 0) {
                    const updated = [...currentLogs];
                    updated[existingIndex] = data;
                    return updated;
                } else {
                    return [data, ...currentLogs];
                }
            });
        });

        return () => {
            cleanupStatus();
            cleanupUpload();
        };
    }, []);

    const handleSelectDirectory = async () => {
        const path = await window.electronAPI.selectDirectory();
        if (path) {
            setLogDirectory(path);
            window.electronAPI.startWatching(path);
        }
    };

    return (
        <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-gray-900 to-black text-white font-sans overflow-hidden flex flex-col">
            {/* Custom Title Bar */}
            <div className="h-10 shrink-0 w-full flex justify-between items-center px-4 bg-black/20 backdrop-blur-md border-b border-white/5 drag-region select-none z-50">
                <div className="flex items-center gap-2">
                    <img src="./icon.png" alt="Icon" className="w-4 h-4" />
                    <span className="text-xs font-medium text-gray-400">GW2 Arc Log Uploader</span>
                </div>
                <div className="flex items-center gap-4 no-drag">
                    <button onClick={() => window.electronAPI.windowControl('minimize')} className="text-gray-400 hover:text-white transition-colors">
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={() => window.electronAPI.windowControl('maximize')} className="text-gray-400 hover:text-white transition-colors">
                        <Square className="w-3 h-3" />
                    </button>
                    <button onClick={() => window.electronAPI.windowControl('close')} className="text-gray-400 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Background Orbs */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-5xl mx-auto p-8 flex-1 w-full flex flex-col min-h-0">
                <header className="flex justify-between items-center mb-10 shrink-0">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="p-2 bg-blue-500/20 rounded-lg backdrop-blur-sm border border-blue-500/30">
                            <UploadCloud className="w-10 h-10 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            GW2 Arc Log Uploader
                        </h1>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs font-medium px-3 py-1 bg-white/5 rounded-full border border-white/10"
                    >
                        v1.0.0
                    </motion.div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0 overflow-hidden">
                    {/* Left Column: Stats & Config */}
                    <div className="space-y-6 overflow-y-auto pr-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl hover:border-white/20 transition-colors"
                        >
                            <h2 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-gray-400" />
                                Configuration
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Log Directory</label>
                                    <div className="flex gap-2 w-full max-w-full">
                                        <div className="flex-1 min-w-0 bg-black/40 border border-white/5 rounded-xl p-2 flex items-center gap-3 hover:border-blue-500/50 transition-colors">
                                            <div className="pl-2 shrink-0">
                                                <FolderOpen className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={logDirectory || ''}
                                                placeholder="C:\...\arcdps.cbtlogs"
                                                className="flex-1 bg-transparent border-none text-sm text-gray-300 placeholder-gray-600 focus:ring-0 px-2 min-w-0 w-full"
                                                onChange={(e) => setLogDirectory(e.target.value)}
                                                onBlur={(e) => {
                                                    if (e.target.value) {
                                                        window.electronAPI.startWatching(e.target.value);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && logDirectory) {
                                                        window.electronAPI.startWatching(logDirectory);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSelectDirectory}
                                            className="shrink-0 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl px-4 flex items-center justify-center transition-colors"
                                            title="Browse..."
                                        >
                                            <FolderOpen className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2 ml-1">
                                        {logDirectory ? "Watching for new logs" : "Paste path or browse"}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Discord Webhook</label>
                                    <div className="bg-black/40 border border-white/5 rounded-xl p-2 flex items-center gap-3 hover:border-blue-500/50 transition-colors">
                                        <input
                                            type="text"
                                            value={webhookUrl}
                                            placeholder="https://discord.com/api/webhooks/..."
                                            className="flex-1 bg-transparent border-none text-sm text-gray-300 placeholder-gray-600 focus:ring-0 px-2"
                                            onChange={(e) => {
                                                setWebhookUrl(e.target.value);
                                                window.electronAPI.setDiscordWebhook(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Recent Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-2 gap-4"
                        >
                            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                                <div className="text-blue-200 text-xs font-medium mb-1 uppercase tracking-wider">Uploads</div>
                                <div className="text-2xl font-bold text-white">{totalUploads}</div>
                            </div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                                <div className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">Avg Squad</div>
                                <div className="text-2xl font-bold text-gray-200">{avgSquadSize} <span className="text-sm text-gray-500 font-normal">players</span></div>
                            </div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 col-span-2">
                                <div className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">Success Rate</div>
                                <div className="text-2xl font-bold text-green-400">{successRate}%</div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${successRate}%` }}></div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Recent Activity */}
                    <div className="lg:col-span-2 flex flex-col min-h-0">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className={`bg-white/5 backdrop-blur-xl border ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'} rounded-2xl p-6 flex flex-col h-full shadow-2xl transition-all duration-300 relative`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                                const files = Array.from(e.dataTransfer.files);
                                files.forEach(file => {
                                    if (file.name.endsWith('.evtc') || file.name.endsWith('.zevtc')) {
                                        const filePath = (file as any).path;
                                        if (filePath) {
                                            window.electronAPI.manualUpload(filePath);
                                        }
                                    }
                                });
                            }}
                        >
                            <h2 className="text-lg font-semibold mb-6 text-gray-200 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                Recent Activity
                            </h2>

                            {isDragging && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 rounded-2xl flex flex-col items-center justify-center text-blue-400 pointer-events-none">
                                    <UploadCloud className="w-16 h-16 mb-4 animate-bounce" />
                                    <p className="text-xl font-bold">Drop logs to upload</p>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                <AnimatePresence mode='popLayout'>
                                    {logs.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="h-full flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-xl"
                                        >
                                            <UploadCloud className="w-12 h-12 mb-3 opacity-20" />
                                            <p>Drag & Drop logs here</p>
                                            <p className="text-xs mt-1 opacity-50">or configure a watch directory</p>
                                        </motion.div>
                                    ) : (
                                        logs.map((log) => (
                                            <ExpandableLogCard
                                                key={log.filePath}
                                                log={log}
                                                isExpanded={expandedLogId === log.filePath}
                                                onToggle={() => setExpandedLogId(expandedLogId === log.filePath ? null : log.filePath)}
                                            />
                                        ))
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
