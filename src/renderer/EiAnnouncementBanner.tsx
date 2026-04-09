import { AnimatePresence, motion } from 'framer-motion';

interface EiAnnouncementBannerProps {
    visible: boolean;
    onSetup: () => void;
    onDismiss: () => void;
}

export function EiAnnouncementBanner({ visible, onSetup, onDismiss }: EiAnnouncementBannerProps) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                >
                    <div
                        style={{
                            background: 'rgba(var(--brand-primary-rgb), 0.08)',
                            borderTop: '2px solid var(--brand-primary)',
                            padding: '7px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--brand-primary)', fontSize: 12 }}>✦</span>
                            <span style={{ color: '#d1d5db', fontSize: 12 }}>
                                <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>New feature:</span>{' '}
                                Local Elite Insights parsing for accurate WvW stats
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                onClick={onSetup}
                                style={{
                                    background: 'rgba(var(--brand-primary-rgb), 0.12)',
                                    border: '1px solid rgba(var(--brand-primary-rgb), 0.3)',
                                    borderRadius: 4,
                                    padding: '3px 12px',
                                    color: 'var(--brand-primary)',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Set up
                            </button>
                            <button
                                onClick={onDismiss}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6b7280',
                                    fontSize: 16,
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                    padding: 0,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
