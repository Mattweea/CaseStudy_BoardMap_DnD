import * as React from "react";

export type DiceType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";
export type NumericDiceType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export type DiceIconProps = React.SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number;
};

function baseProps({
    size = 18,
    strokeWidth = 1.75,
    ...props
}: DiceIconProps) {
    return {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
        ...props,
    };
}

export function D4Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M12 4.4 5.2 12 12 19.6 18.8 12 12 4.4Z" />
            <path d="M12 4.4V19.6" />
            <path d="M5.2 12 12 15.7 18.8 12" />
        </svg>
    );
}

export function D6Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M12 4.7 17.7 8 17.7 16 12 19.3 6.3 16 6.3 8 12 4.7Z" />
            <path d="M12 4.7v14.6" />
            <path d="M6.3 8 12 11.3 17.7 8" />
        </svg>
    );
}

export function D8Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M12 4.3 5 12 12 19.7 19 12 12 4.3Z" />
            <path d="M12 4.3v15.4" />
            <path d="M5 12 12 15.8 19 12" />
        </svg>
    );
}

export function D10Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M12 4.1 5.6 10.5 12 19.9 18.4 10.5 12 4.1Z" />
            <path d="M12 4.1v15.8" />
            <path d="M5.6 10.5 12 13.4 18.4 10.5" />
        </svg>
    );
}

export function D12Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M9 3.7 15 3.7 19.3 6.9 20.2 12.8 17.1 18 12 20.1 6.9 18 3.8 12.8 4.7 6.9 9 3.7Z" />
            <path d="M9 3.7 7.7 8.2 10.3 12 13.7 12 16.3 8.2 15 3.7" />
            <path d="M3.8 12.8 7.7 8.2" />
            <path d="M20.2 12.8 16.3 8.2" />
            <path d="M6.9 18 10.3 12" />
            <path d="M17.1 18 13.7 12" />
        </svg>
    );
}

export function D20Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M12 3.6 7 5.1 4 9.2 4.4 15 7.6 18.9 12 20.4 16.4 18.9 19.6 15 20 9.2 17 5.1 12 3.6Z" />
            <path d="M12 3.6 8 8.8 12 11.2 16 8.8 12 3.6Z" />
            <path d="M4 9.2 8 8.8 6.9 15 4.4 15" />
            <path d="M20 9.2 16 8.8 17.1 15 19.6 15" />
            <path d="M7.6 18.9 6.9 15 12 11.2 17.1 15 16.4 18.9" />
            <path d="M8 8.8h8" />
            <path d="M8 8.8 12 20.4 16 8.8" />
        </svg>
    );
}

export function D100Icon(props: DiceIconProps) {
    return (
        <svg {...baseProps(props)}>
            <path d="M8.3 5.1 4.2 10.1 8.5 18.9 13.8 13.8 8.3 5.1Z" />
            <path d="M8.3 5.1 13.8 13.8 13.9 6.5 8.3 5.1Z" />
            <path d="M4.2 10.1 9.4 11.1 13.8 13.8 8.5 18.9" />
            <path d="M15 4.5 12.1 8.2 15.5 14.2 19.8 10 15 4.5Z" />
            <path d="M15 4.5 19.8 10 19.2 5.7 15 4.5Z" />
            <path d="M12.1 8.2 15.5 14.2 19.8 10" />
            <path d="M13.9 6.5 12.1 8.2" />
        </svg>
    );
}

export const diceIcons = {
    d4: D4Icon,
    d6: D6Icon,
    d8: D8Icon,
    d10: D10Icon,
    d12: D12Icon,
    d20: D20Icon,
    d100: D100Icon,
} satisfies Record<DiceType, React.ComponentType<DiceIconProps>>;

export const numericDiceToIconType: Record<NumericDiceType, DiceType> = {
    4: "d4",
    6: "d6",
    8: "d8",
    10: "d10",
    12: "d12",
    20: "d20",
    100: "d100",
};

type DiceGlyphProps = DiceIconProps & {
    type: DiceType;
};

export function DiceGlyph({ type, ...props }: DiceGlyphProps) {
    const Icon = diceIcons[type];
    return <Icon {...props} />;
}
