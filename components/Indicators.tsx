import React, { useState, useEffect } from 'react';

export type IndicatorType = 'default' | 'image' | 'generating' | 'research';

interface IndicatorsProps {
    type?: IndicatorType;
}

const Indicators = ({ type = 'default' }: IndicatorsProps) => {
    const [text, setText] = useState('Just a sec...');

    useEffect(() => {
        // Reset text when type changes
        setText('Just a sec...');

        if (type === 'image') {
            // Image agent: Just a sec... → Imagining...
            const timer1 = setTimeout(() => setText('Imagining...'), 2000);
            return () => clearTimeout(timer1);
        } else if (type === 'generating') {
            // Generating image (static, no timers)
            setText('Generating image...');
            return;
        } else if (type === 'research') {
            // Research mode: Deep researching... → Collecting data... → Philosophizing... → Preparing answer...
            setText('Deep researching...');
            const timer1 = setTimeout(() => setText('Collecting data...'), 2500);
            const timer2 = setTimeout(() => setText('Philosophizing...'), 5000);
            const timer3 = setTimeout(() => setText('Preparing answer...'), 7500);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        } else {
            // Default: Just a sec... → Analyzing context... → Thinking...
            const timer1 = setTimeout(() => setText('Analyzing context...'), 2500);
            const timer2 = setTimeout(() => setText('Thinking...'), 5000);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [type]);

    return (
        <div className="flex items-center gap-2 animate-fade-in select-none py-2">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {text}
            </span>
        </div>
    );
};

export default Indicators;
