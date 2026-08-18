import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, ThemeMode } from '../constants/Colors'
import { ThemeContextType } from './types';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const systemScheme = useColorScheme();
    const mode: ThemeMode = systemScheme === 'dark' ? 'dark' : 'light';
    const isDark = mode === 'dark';

    const value = useMemo<ThemeContextType>(
        () => ({
            colors: isDark ? DarkColors : LightColors,
            mode,
            isDark,
        }),
        [isDark, mode]
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useAppTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useAppTheme must be used within a ThemeProvider");
    }
    return context;
}
