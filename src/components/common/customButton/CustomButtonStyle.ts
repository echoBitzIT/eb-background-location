import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../constants/Colors';

export const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        button: {
            borderRadius: 8,
            overflow: 'hidden',
        },
        gradient: {
            borderRadius: 8,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
        },
        buttonDisabled: {
            opacity: 0.5,
        },
        text: {
            color: colors.buttonText,
            fontSize: 16,
            fontWeight: '600',
        },
        textDisabled: {
            color: colors.textDisabled,
        },
    });
