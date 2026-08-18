import React, { useEffect, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { showAlert } from '../../components/common/customAlert/alertService';
import { ScreenNames } from '../../constants/ScreenNames';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import CustomButton from '../../components/common/customButton/CustomButton';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { searchCompanyAction } from '../../store/actions/authActions';
import { clearSearchError, setWebsite } from '../../store/reducers/authSlice';
import { setOdooBaseUrl } from '../../services/apiClient'; 
import { loadOdooBaseUrl, saveOdooBaseUrl } from '../../services/sessionStorage';
import {
    isValidOdooFetchUrl,
    sanitizeOdooFetchUrl,
} from '../../utils/urlValidation';
import { createStyles } from './FetchUrlScreenStyle';

type Props = NativeStackScreenProps<RootStackParamList, typeof ScreenNames.FETCH_URL>;

const FetchUrlScreen = ({ navigation }: Props) => {
    const { colors, isDark } = useAppTheme();
    const { isTablet, contentMaxWidth } = useResponsive();
    const styles = createStyles(colors, isTablet, contentMaxWidth);

    const dispatch = useAppDispatch();
    const { searchLoading, searchError, website } = useAppSelector((state) => state.auth);

    const [url, setUrl] = useState(website);
    const [urlError, setUrlError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (website) {
            setUrl(website);
            return;
        }
        loadOdooBaseUrl().then((saved) => {
            if (!cancelled && saved) {
                setUrl(saved);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [website]);

    const handleSearch = async () => {
        if (!url.trim() || !isValidOdooFetchUrl(url)) {
            setUrlError(true);
            return;
        }

        const normalized = sanitizeOdooFetchUrl(url);
        setUrlError(false);
        dispatch(clearSearchError());
        setOdooBaseUrl(normalized);
        await saveOdooBaseUrl(normalized);
        dispatch(setWebsite(normalized));
        setUrl(normalized);

        const result = await dispatch(
            searchCompanyAction({
                website: normalized,
                mode: isDark ? 'dark' : 'light',
            }),
        );

        if (searchCompanyAction.fulfilled.match(result)) {
            navigation.navigate(ScreenNames.LOGIN);
            return;
        }

        const failCode =
            typeof result.payload === 'string' ? result.payload : searchError;

        showAlert({
            title: 'Search failed',
            message: getAuthErrorMessage(failCode),
        });
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
                    <View style={styles.brand}>
                        <Image
                            source={require('../../assets/image/Logo/Logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>
                            {`Geo Employee\nTracker`}
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <View
                            style={[
                                styles.inputRow,
                                urlError && styles.inputRowError,
                            ]}
                        >
                            <MaterialIcons name="language" size={30} color={colors.button} />
                            <TextInput
                                style={styles.input}
                                value={url}
                                onChangeText={(text) => {
                                    setUrl(text);
                                    if (urlError) setUrlError(false);
                                    if (searchError) dispatch(clearSearchError());
                                }}
                                placeholder="https://www.example.com"
                                placeholderTextColor={colors.placeholder}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                                returnKeyType="search"
                                editable={!searchLoading}
                                onSubmitEditing={handleSearch}
                            />
                        </View>
                        {urlError ? (
                            <Text style={styles.error}>
                                Enter a valid URL like https://www.example.com
                            </Text>
                        ) : null}
                        <CustomButton
                            title="Search"
                            onPress={handleSearch}
                            loading={searchLoading}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default FetchUrlScreen;