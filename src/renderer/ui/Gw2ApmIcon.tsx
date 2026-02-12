type Gw2ApmIconProps = {
    className?: string;
};

export const Gw2ApmIcon = ({ className = '' }: Gw2ApmIconProps) => (
    <span
        aria-hidden="true"
        className={`inline-block shrink-0 ${className}`.trim()}
        style={{
            backgroundColor: 'currentColor',
            maskImage: 'url(/svg/custom-icons/mouse.svg)',
            WebkitMaskImage: 'url(/svg/custom-icons/mouse.svg)',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskSize: 'contain'
        }}
    />
);
