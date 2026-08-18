import { StyleSheet } from "react-native";
import { ThemeColors } from "../../../constants/Colors";

export const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        wrapper: {
            marginBottom: 16,
        },
        label: {
            color: colors.textEnabled,
            marginBottom: 8,
            fontSize: 14,
            fontWeight: '500',
        },
        labelDisabled: {
            color: colors.textDisabled,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.inputBox,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 4,
            minHeight: 52,
        },
        inputRowDisabled: {
            opacity: 0.6,
        },
        inputRowError: {
            borderColor: '#FF4444',
        },
        input: {
            flex: 1,
            color: colors.textEnabled,
            fontSize: 16,
            paddingVertical: 12,
            paddingHorizontal: 10,
        },
        inputDisabled: {
            color: colors.textDisabled,
        },
        iconSlot: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        error: {
            color: '#FF4444',
            marginTop: 4,
            fontSize: 12,
        },
    });
