import { Plus } from 'lucide-react';

type SupportPlusIconProps = {
    className?: string;
};

export const SupportPlusIcon = ({ className }: SupportPlusIconProps) => (
    <Plus className={className} strokeWidth={3.2} />
);
