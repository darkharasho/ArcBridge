import { Sword } from 'lucide-react';

type OffenseSwordIconProps = {
    className?: string;
};

export const OffenseSwordIcon = ({ className }: OffenseSwordIconProps) => (
    <Sword className={className} style={{ transform: 'rotate(45deg)' }} />
);
