import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
    colors: ThemeColors,
    isTablet: boolean,
    contentMaxWidth: number,
) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'space-between',
            paddingHorizontal: isTablet ? 48 : 24,
            paddingTop: isTablet ? 48 : 32,
            paddingBottom: isTablet ? 40 : 24,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
        },
        brand: {
            alignItems: 'center',
            marginTop: isTablet ? 40 : 24,
        },
        logo: {
            width: isTablet ? 160 : 130,
            height: isTablet ? 160 : 130,
        },
        title: {
            marginTop: 16,
            color: colors.textEnabled,
            fontSize: isTablet ? 28 : 24,
            fontWeight: '700',
            textAlign: 'center',
            lineHeight: isTablet ? 36 : 32,
        },
        footer: {
            width: '100%',
            gap: 16,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.inputBox,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: isTablet ? 16 : 14,
            gap: 12,
        },
        inputRowError: {
            borderColor: '#FF4444',
        },
        input: {
            flex: 1,
            color: colors.textEnabled,
            fontSize: 16,
            padding: 0,
            
        },
        error: {
            color: '#FF4444',
            marginTop: 4,
            fontSize: 12,
        },
    });
