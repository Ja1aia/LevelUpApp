import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert as RNAlert,
  Dimensions,
} from 'react-native';
import { COLORS } from '../theme/colors';

interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

type ShowAlertFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

const AlertContext = createContext<ShowAlertFn>(() => {});

// Global reference so we can call alert without hooks
let globalShowAlert: ShowAlertFn | null = null;

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert: ShowAlertFn = useCallback((title, message = '', buttons) => {
    const defaultButtons: AlertButton[] = buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default' }];
    setAlert({ visible: true, title, message, buttons: defaultButtons });
  }, []);

  // Register global reference
  const showAlertRef = useRef(showAlert);
  showAlertRef.current = showAlert;
  if (!globalShowAlert) {
    globalShowAlert = (...args) => showAlertRef.current(...args);
  }

  const handleButtonPress = (button: AlertButton) => {
    setAlert(prev => ({ ...prev, visible: false }));
    // Delay callback to allow modal to close
    if (button.onPress) {
      setTimeout(button.onPress, 100);
    }
  };

  const handleDismiss = () => {
    const cancelButton = alert.buttons.find(b => b.style === 'cancel');
    setAlert(prev => ({ ...prev, visible: false }));
    if (cancelButton?.onPress) {
      setTimeout(cancelButton.onPress, 100);
    }
  };

  return (
    <AlertContext.Provider value={showAlert}>
      {children}
      <Modal
        transparent
        visible={alert.visible}
        animationType="fade"
        onRequestClose={handleDismiss}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleDismiss}
        >
          <TouchableOpacity activeOpacity={1} style={styles.alertBox}>
            <Text style={styles.title}>{alert.title}</Text>
            {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}
            <View style={styles.buttonRow}>
              {alert.buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isDestructive && styles.destructiveButton,
                      isCancel && styles.cancelButton,
                      !isDestructive && !isCancel && styles.defaultButton,
                      alert.buttons.length === 1 && styles.singleButton,
                    ]}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && styles.destructiveText,
                        isCancel && styles.cancelText,
                        !isDestructive && !isCancel && styles.defaultText,
                      ]}
                    >
                      {button.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </AlertContext.Provider>
  );
};

// Hook for components
export const useAlert = () => useContext(AlertContext);

// Drop-in replacement for Alert.alert - works globally
export const CrossPlatformAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (Platform.OS === 'web') {
      if (globalShowAlert) {
        globalShowAlert(title, message, buttons);
      } else {
        // Fallback if provider not mounted yet
        window.alert(`${title}\n${message || ''}`);
      }
    } else {
      RNAlert.alert(title, message, buttons);
    }
  },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: Math.min(Dimensions.get('window').width * 0.85, 340),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  singleButton: {
    flex: 0,
    paddingHorizontal: 40,
  },
  defaultButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  destructiveButton: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  defaultText: {
    color: COLORS.textPrimary,
  },
  cancelText: {
    color: COLORS.textSecondary,
  },
  destructiveText: {
    color: COLORS.white,
  },
});
