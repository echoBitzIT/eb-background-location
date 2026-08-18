export const BrandGradient = ['#1ABDFA', '#1D70F1'] as const;

export const LightColors = {
    background: '#F9F9F9',
    inputBox: '#FFFFFF',
    button: '#1D70F1',
    buttonGradient: BrandGradient,
    buttonText: '#FFFFFF',
    textDisabled: '#AAAAAA',
    textEnabled: '#0B1422',
    border: '#E0E0E0',
    placeholder: '#AAAAAA',
} as const;

export const DarkColors = {
    background: '#0B1422',
    inputBox: '#142136',
    button: '#1D70F1',
    buttonGradient: BrandGradient, 
    buttonText: '#FFFFFF',
    textDisabled: '#AAAAAA',
    textEnabled: '#FFFFFF',
    border: '#1E2D45',
    placeholder: '#AAAAAA',
} as const;

export type ThemeColors = typeof LightColors | typeof DarkColors;
export type ThemeMode = "light" | "dark";
