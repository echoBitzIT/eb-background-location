import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useAppTheme } from "../../../theme/ThemeContext";
import { createStyles } from "./CustomButtonStyle";

interface CustomButtonProps extends TouchableOpacityProps {
    title: string;
    loading?: boolean;
}

const CustomButton = ({
    title,
    loading = false,
    disabled,
    style,
    ...props
}: CustomButtonProps) => {
    const { colors } = useAppTheme();
    const isDisabled = disabled || loading;
    const styles = createStyles(colors);

    return (
        <TouchableOpacity
            style={[styles.button, style]}
            disabled={isDisabled}
            activeOpacity={0.8}
            {...props}
        >
            <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.gradient, isDisabled && styles.buttonDisabled]}
            >
                {loading ? (
                    <ActivityIndicator color={colors.buttonText} />
                ) : (
                    <Text style={[styles.text, isDisabled && styles.textDisabled]}>
                        {title}
                    </Text>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

export default CustomButton;
