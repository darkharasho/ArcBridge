import type { ReactNode } from 'react';

type StatsTableShellProps = {
    header: ReactNode;
    columns: ReactNode;
    rows: ReactNode;
    expanded?: boolean;
    maxHeightClass?: string;
};

export const StatsTableShell = ({
    header,
    columns,
    rows,
    expanded,
    maxHeightClass = 'max-h-80'
}: StatsTableShellProps) => (
    <>
        <div className="stats-table-shell__head-stack">
            <div className="stats-table-shell__header">{header}</div>
            <div className="stats-table-shell__columns">{columns}</div>
        </div>
        <div className={`stats-table-shell__rows ${expanded ? 'flex-1 min-h-0 overflow-y-auto' : `${maxHeightClass} overflow-y-auto`}`}>
            {rows}
        </div>
    </>
);
