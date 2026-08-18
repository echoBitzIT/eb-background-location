import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { createStyles } from './LoginScreenStyle';
import CustomTextInput from '../../components/common/customTextInput/CustomTextInput';
import CustomButton from '../../components/common/customButton/CustomButton';
import { showAlert } from '../../components/common/customAlert/alertService';
import { ScreenNames } from '../../constants/ScreenNames';
import {
    AUTH_ERRORS,
    getAuthErrorMessage,
} from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginAction } from '../../store/actions/authActions';
import { clearLoginError } from '../../store/reducers/authSlice';

type Props = NativeStackScreenProps<RootStackParamList, typeof ScreenNames.LOGIN>;

const LoginScreen = ({ navigation }: Props) => {
    const { colors, isDark } = useAppTheme();
    const { isTablet, contentMaxWidth } = useResponsive();
    const styles = createStyles(colors, isTablet, contentMaxWidth);

    const dispatch = useAppDispatch();
    const { loginLoading, companyLogo, companyName, termsAndConditions } =
        useAppSelector((state) => state.auth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [agreedError, setAgreedError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const logoSource =
        typeof companyLogo === 'string' && companyLogo.length > 0
            ? { uri: companyLogo }
            : require('../../assets/image/Logo/Logo.png');

    const handleLogin = async () => {
        const nextEmailError = !email.trim();
        const nextPasswordError = !password;
        const nextAgreedError = !agreed;
        setEmailError(nextEmailError);
        setPasswordError(nextPasswordError);
        setAgreedError(nextAgreedError);

        if (nextEmailError || nextPasswordError || nextAgreedError) return;

        dispatch(clearLoginError());

        const result = await dispatch(
            loginAction({ email: email.trim(), password }),
        );

        if (loginAction.fulfilled.match(result)) {
            return;
        }

        const errorCode =
            typeof result.payload === 'string'
                ? result.payload
                : AUTH_ERRORS.LOGIN_FAILED;

        if (errorCode === AUTH_ERRORS.INVALID_SESSION) {
            showAlert({
                title: 'Session expired',
                message: getAuthErrorMessage(errorCode),
                onConfirm: () =>
                    navigation.reset({
                        index: 0,
                        routes: [{ name: ScreenNames.FETCH_URL }],
                    }),
            });
            return;
        }

        showAlert({
            title: 'Login failed',
            message: getAuthErrorMessage(errorCode),
        });
    };

    const handleTermsPress = () => {
        if (!termsAndConditions) return;
        void Linking.openURL(termsAndConditions);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <StatusBar
                    barStyle={isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <View style={styles.formContainer}>
                        <View style={styles.logoWrap}>
                            <Image
                                source={logoSource}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            {companyName ? (
                                <Text style={styles.companyName}>{companyName}</Text>
                            ) : null}
                        </View>

                        <CustomTextInput
                            placeholder="Email ID"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                if (emailError) setEmailError(false);
                            }}
                            error={emailError}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loginLoading}
                            leftIcon={
                                <MaterialIcons
                                    name="email"
                                    size={22}
                                    color={colors.button}
                                />
                            }
                        />

                        <CustomTextInput
                            placeholder="Password"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (passwordError) setPasswordError(false);
                            }}
                            error={passwordError}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            editable={!loginLoading}
                            leftIcon={
                                <MaterialIcons
                                    name="vpn-key"
                                    size={22}
                                    color={colors.button}
                                />
                            }
                            rightIcon={
                                <Pressable
                                    onPress={() => setShowPassword((prev) => !prev)}
                                    hitSlop={8}
                                >
                                    <MaterialIcons
                                        name={showPassword ? 'visibility' : 'visibility-off'}
                                        size={22}
                                        color={colors.textDisabled}
                                    />
                                </Pressable>
                            }
                        />

                        <View style={styles.termsRow}>
                            <Pressable
                                style={styles.checkbox}
                                onPress={() => {
                                    setAgreed((prev) => !prev);
                                    if (agreedError) setAgreedError(false);
                                }}
                                hitSlop={8}
                                disabled={loginLoading}
                            >
                                <MaterialIcons
                                    name={agreed ? 'check-box' : 'check-box-outline-blank'}
                                    size={24}
                                    color={agreedError ? '#FF4444' : colors.button}
                                />
                            </Pressable>
                            <Text style={styles.termsText}>
                                By using, Geo Employee Tracker, I agree that I have read and
                                accepted the{' '}
                                <Text style={styles.link} onPress={handleTermsPress}>
                                    Terms of Use
                                </Text>
                                .
                            </Text>
                        </View>

                        <CustomButton
                            title="Login"
                            onPress={handleLogin}
                            loading={loginLoading}
                            style={styles.loginButton}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default LoginScreen;
