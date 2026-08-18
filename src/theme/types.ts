import { ThemeColors, ThemeMode } from '../constants/Colors';

export interface ThemeContextType {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
}