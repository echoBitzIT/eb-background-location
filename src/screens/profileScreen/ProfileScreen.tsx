import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { showAlert } from '../../components/common/customAlert/alertService';
import { ScreenNames } from '../../constants/ScreenNames';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchProfileAction,
  updateProfileAction,
} from '../../store/actions/authActions';
import { clearProfileError } from '../../store/reducers/authSlice';
import CustomTextInput from '../../components/common/customTextInput/CustomTextInput';
import type { MobileEmployee } from '../../services/apiClient';
import { createStyles } from './ProfileScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.PROFILE
>;

function fieldToInput(value: string | false | null | undefined): string {
  if (value === false || value == null) {
    return '';
  }
  return String(value);
}

function displayField(value: string | false | null | undefined): string {
  const text = fieldToInput(value).trim();
  return text.length > 0 ? text : 'Not set';
}

function employeeToForm(employee: MobileEmployee | null) {
  return {
    name: fieldToInput(employee?.name),
    workPhone: fieldToInput(employee?.work_phone),
    avatar: fieldToInput(employee?.avatar),
  };
}

const ProfileScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);

  const dispatch = useAppDispatch();
  const employee = useAppSelector((state) => state.auth.employee);
  const profileLoading = useAppSelector((state) => state.auth.profileLoading);
  const profileSaving = useAppSelector((state) => state.auth.profileSaving);
  const profileError = useAppSelector((state) => state.auth.profileError);  

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(() => employeeToForm(employee).name);
  const [workPhone, setWorkPhone] = useState(
    () => employeeToForm(employee).workPhone,
  );
  const [avatar, setAvatar] = useState(() => employeeToForm(employee).avatar);

  const syncFormFromEmployee = useCallback((next: MobileEmployee | null) => {
    const form = employeeToForm(next);
    setName(form.name);
    setWorkPhone(form.workPhone);
    setAvatar(form.avatar);
  }, []);

  useEffect(() => {
    dispatch(clearProfileError());
    if (!employee) {
      void dispatch(fetchProfileAction());
    }
  }, [dispatch, employee]);

  useEffect(() => {
    if (!isEditing) {
      syncFormFromEmployee(employee);
    }
  }, [employee, isEditing, syncFormFromEmployee]);

  const baseline = useMemo(() => employeeToForm(employee), [employee]);
  const hasChanges =
    name.trim() !== baseline.name.trim() ||
    workPhone.trim() !== baseline.workPhone.trim() ||
    avatar !== baseline.avatar;

  const hasAvatar = avatar.length > 0;
  const busy = profileLoading || profileSaving;

  const handleStartEdit = () => {
    if (busy) {
      return;
    }
    dispatch(clearProfileError());
    syncFormFromEmployee(employee);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profileSaving) {
      return;
    }
    syncFormFromEmployee(employee);
    dispatch(clearProfileError());
    setIsEditing(false);
  };

  const handlePickAvatar = async () => {
    if (!isEditing || busy) {
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: true,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.8,
    });
    if (result.didCancel || result.errorCode) {
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      return;
    }
    const mime = asset.type || 'image/jpeg';
    setAvatar(`data:${mime};base64,${asset.base64}`);
  };

  const handleSave = async () => {
    if (!hasChanges || busy) {
      return;
    }
    const body: {
      name?: string;
      work_phone?: string;
      avatar?: string;
    } = {};
    if (name.trim() !== baseline.name.trim()) {
      body.name = name.trim();
    }
    if (workPhone.trim() !== baseline.workPhone.trim()) {
      body.work_phone = workPhone.trim();
    }
    if (avatar !== baseline.avatar) {
      body.avatar = avatar;
    }

    const result = await dispatch(updateProfileAction(body));
    if (updateProfileAction.fulfilled.match(result)) {
      setIsEditing(false);
      showAlert({
        title: 'Profile',
        message: 'Profile updated successfully.',
      });
    }
  };

  const renderReadOnlyField = (label: string, value: string | false | null | undefined) => {
    const shown = displayField(value);
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          style={[styles.fieldValue, shown === 'Not set' && styles.fieldEmpty]}
        >
          {shown}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={isTablet ? 26 : 22}
            color={colors.textEnabled}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        {profileLoading && !isEditing ? (
          <ActivityIndicator size="small" color={colors.button} />
        ) : (
          <Pressable
            style={styles.headerAction}
            onPress={isEditing ? handleCancelEdit : handleStartEdit}
            disabled={busy && !isEditing}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Cancel editing' : 'Edit profile'}
          >
            <Text style={styles.headerActionText}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <Pressable
              style={styles.avatarPressable}
              onPress={() => void handlePickAvatar()}
              disabled={!isEditing || busy}
              accessibilityRole="button"
              accessibilityLabel={
                isEditing ? 'Change profile photo' : 'Profile photo'
              }
            >
              {hasAvatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <MaterialIcons
                    name="person"
                    size={isTablet ? 44 : 36}
                    color={colors.placeholder}
                  />
                </View>
              )}
              {isEditing ? (
                <View style={styles.avatarBadge}>
                  <MaterialIcons
                    name="photo-camera"
                    size={isTablet ? 16 : 14}
                    color={colors.buttonText}
                  />
                </View>
              ) : null}
            </Pressable>
            {isEditing ? (
              <Text style={styles.avatarHint}>Tap to change photo</Text>
            ) : null}
          </View>

          {isEditing ? (
            <>
              <CustomTextInput
                label="Name"
                value={name}
                onChangeText={setName}
                editable={!busy}
                autoCapitalize="words"
                placeholder="Your name"
              />
              <CustomTextInput
                label="Phone"
                value={workPhone}
                onChangeText={setWorkPhone}
                editable={!busy}
                keyboardType="phone-pad"
                placeholder="Work phone"
              />
            </>
          ) : (
            <>
              {renderReadOnlyField('Name', name || employee?.name)}
              {renderReadOnlyField(
                'Phone',
                workPhone || employee?.work_phone,
              )}
            </>
          )}

          {renderReadOnlyField('Email', employee?.work_email)}
          {renderReadOnlyField('Job title', employee?.job_title)}
          {renderReadOnlyField('Company', employee?.company_name)}

          {profileError ? (
            <Text style={styles.errorText}>
              {getAuthErrorMessage(profileError)}
            </Text>
          ) : null}

          {isEditing ? (
            <Pressable
              style={[
                styles.saveButton,
                (!hasChanges || busy) && styles.saveButtonDisabled,
              ]}
              onPress={() => void handleSave()}
              disabled={!hasChanges || busy}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
            >
              {profileSaving ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
