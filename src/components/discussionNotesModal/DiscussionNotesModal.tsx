import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { createStyles } from './DiscussionNotesModalStyle';

type Props = {
  visible: boolean;
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => void;
};

const PLACEHOLDER =
  'Enter key discussion points, customer feedback, or specific requests here...';

const DiscussionNotesModal = ({
  visible,
  initialNote = '',
  onClose,
  onSave,
}: Props) => {
  const { colors } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const [note, setNote] = useState(initialNote);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setNote(initialNote);
      setKeyboardHeight(0);
      return;
    }
    setKeyboardHeight(0);
  }, [visible, initialNote]);

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    const trimmed = note.trim();
    onSave(trimmed);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss discussion notes"
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, isTablet ? 28 : 24),
              marginBottom: keyboardHeight,
            },
          ]}
        >
          <Text style={styles.title}>Discussion Notes</Text>
          <Text style={styles.subtitle}>Meeting Highlights & Action Items</Text>

          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder={PLACEHOLDER}
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Discussion note"
          />

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={styles.saveButton}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save Note"
            >
              <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.saveGradient}
              >
                <Text style={styles.saveText}>Save Note</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DiscussionNotesModal;
