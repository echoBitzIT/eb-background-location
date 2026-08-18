import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { useAppTheme } from "../../../theme/ThemeContext";
import { createStyles } from "./CustomTextInputStyle";

interface CustomTextInputProps extends TextInputProps {
    label?: string;
    error?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const CustomTextInput = ({
    label,
    error = false,
    leftIcon,
    rightIcon,
    editable = true,
    style,
    placeholderTextColor,
    ...props
}: CustomTextInputProps) => {
    const { colors } = useAppTheme();
    const styles = createStyles(colors);

    return (
        <View style={styles.wrapper}>
            {label ? (
                <Text style={[styles.label, !editable && styles.labelDisabled]}>
                    {label}
                </Text>
            ) : null}

            <View
                style={[
                    styles.inputRow,
                    !editable && styles.inputRowDisabled,
                    error && styles.inputRowError,
                    style,
                ]}
            >
                {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
                <TextInput
                    style={[styles.input, !editable && styles.inputDisabled]}
                    placeholderTextColor={placeholderTextColor ?? colors.placeholder}
                    editable={editable}
                    {...props}
                />
                {rightIcon ? <View style={styles.iconSlot}>{rightIcon}</View> : null}
            </View>
        </View>
    );
};

export default CustomTextInput;
