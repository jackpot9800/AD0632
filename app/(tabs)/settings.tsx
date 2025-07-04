import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  Check, 
  CircleAlert as AlertCircle, 
  Monitor, 
  Settings as SettingsIcon, 
  RefreshCw, 
  Trash2, 
  
  Power
} from 'lucide-react-native';
import { apiService } from '@/services/ApiService';
import { statusService } from '@/services/StatusService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Paramètres avancés
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(true);
  const [statusReportingEnabled, setStatusReportingEnabled] = useState(true);

  useEffect(() => {
    loadCurrentSettings();
    loadDebugInfo();
    loadAdvancedSettings();
  }, []);

  useEffect(() => {
    setHasChanges(serverUrl !== originalUrl);
  }, [serverUrl, originalUrl]);

  const loadCurrentSettings = () => {
    const currentUrl = apiService.getServerUrl();
    setServerUrl(currentUrl);
    setOriginalUrl(currentUrl);
  };

  const loadDebugInfo = async () => {
    try {
      const info = await apiService.getDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  };

  const loadAdvancedSettings = async () => {
    try {
      const autoStart = await AsyncStorage.getItem('settings_auto_start');
      const keepAwake = await AsyncStorage.getItem('settings_keep_awake');
      const remoteControl = await AsyncStorage.getItem('settings_remote_control');
      const statusReporting = await AsyncStorage.getItem('settings_status_reporting');
      
      setAutoStartEnabled(autoStart === 'true');
      setKeepAwakeEnabled(keepAwake !== 'false');
      setRemoteControlEnabled(remoteControl !== 'false');
      setStatusReportingEnabled(statusReporting !== 'false');
    } catch (error) {
      console.error('Error loading advanced settings:', error);
    }
  };

  const saveAdvancedSettings = async () => {
    try {
      await AsyncStorage.setItem('settings_auto_start', autoStartEnabled.toString());
      await AsyncStorage.setItem('settings_keep_awake', keepAwakeEnabled.toString());
      await AsyncStorage.setItem('settings_remote_control', remoteControlEnabled.toString());
      await AsyncStorage.setItem('settings_status_reporting', statusReportingEnabled.toString());
      
      Alert.alert(
        'Paramètres sauvegardés',
        'Les paramètres ont été sauvegardés avec succès.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      Alert.alert(
        'Erreur',
        'Impossible de sauvegarder les paramètres.',
        [{ text: 'OK' }]
      );
    }
  };

  const testConnection = async (url: string) => {
    if (!url.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL de serveur valide.');
      return;
    }

    setConnectionStatus('testing');
    try {
      const testUrl = url.replace(/\/+$/, '');
      const finalUrl = testUrl.endsWith('index.php') ? testUrl : `${testUrl}/index.php`;
      
      console.log('Testing connection to:', finalUrl);
      
      await AsyncStorage.setItem('server_url', finalUrl);
      
      const response = await fetch(`${finalUrl}/version`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PresentationKiosk/1.7.0 (FireTV)',
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.ok) {
        const responseText = await response.text();
        
        try {
          const data = JSON.parse(responseText);
          
          if (data.api_status === 'running' || data.status === 'running' || data.version) {
            setConnectionStatus('success');
            
            Alert.alert(
              'Test de connexion réussi',
              `Connexion au serveur établie avec succès !\n\nVersion API: ${data.version || 'N/A'}\nStatut: ${data.api_status || data.status || 'running'}`,
              [{ text: 'OK' }]
            );
            return true;
          }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
        }
      }
      
      setConnectionStatus('error');
      Alert.alert(
        'Test de connexion échoué',
        `Impossible de se connecter au serveur.\n\nStatut HTTP: ${response.status}`,
        [{ text: 'OK' }]
      );
      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      
      Alert.alert(
        'Erreur de connexion',
        `Impossible de joindre le serveur:\n\n${error instanceof Error ? error.message : 'Erreur réseau'}`,
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const saveSettings = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL de serveur valide.');
      return;
    }

    setSaving(true);
    
    try {
      console.log('=== SAVING SETTINGS v1.7.0 ===');
      
      const success = await apiService.setServerUrl(serverUrl.trim());
      
      if (success) {
        setOriginalUrl(serverUrl.trim());
        setConnectionStatus('success');
        await loadDebugInfo();
        
        Alert.alert(
          'Configuration sauvegardée',
          'La configuration a été sauvegardée avec succès.',
          [{ text: 'Parfait !' }]
        );
      } else {
        setConnectionStatus('error');
        Alert.alert(
          'Erreur de sauvegarde',
          'Impossible de sauvegarder la configuration.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setConnectionStatus('error');
      Alert.alert(
        'Erreur de sauvegarde',
        `Une erreur est survenue:\n\n${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const registerDevice = async () => {
    if (!serverUrl.trim()) {
      Alert.alert(
        'Configuration requise',
        'Veuillez d\'abord configurer et sauvegarder l\'URL du serveur.',
        [{ text: 'OK' }]
      );
      return;
    }

    setRegistering(true);
    
    try {
      console.log('=== MANUAL DEVICE REGISTRATION v1.7.0 ===');
      
      if (apiService.isDeviceRegistered()) {
        Alert.alert(
          'Appareil déjà enregistré',
          `Cet appareil est déjà enregistré.\n\nID: ${apiService.getDeviceId()}`,
          [
            { text: 'OK', style: 'cancel' }
          ]
        );
        return;
      }

      const connectionOk = await apiService.testConnection();
      if (!connectionOk) {
        throw new Error('Impossible de se connecter au serveur');
      }

      const registrationOk = await apiService.registerDevice();
      if (registrationOk) {
        await loadDebugInfo();
        
        Alert.alert(
          'Enregistrement réussi !',
          `L'appareil a été enregistré avec succès.\n\nID: ${apiService.getDeviceId()}`,
          [{ text: 'Parfait !' }]
        );
      } else {
        throw new Error('L\'enregistrement a échoué');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      Alert.alert(
        'Erreur d\'enregistrement',
        `Impossible d'enregistrer l'appareil:\n\n${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setRegistering(false);
    }
  };

  const resetSettings = () => {
    Alert.alert(
      'Réinitialiser les paramètres',
      'Êtes-vous sûr de vouloir effacer la configuration ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            setServerUrl('');
            setConnectionStatus('idle');
            await apiService.resetDevice();
            await loadDebugInfo();
            
            Alert.alert(
              'Paramètres réinitialisés',
              'La configuration a été effacée.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      idle: { color: '#6b7280', text: 'Non testé', icon: Server },
      testing: { color: '#f59e0b', text: 'Test en cours...', icon: Wifi },
      success: { color: '#10b981', text: 'Connexion réussie', icon: Check },
      error: { color: '#ef4444', text: 'Connexion échouée', icon: AlertCircle },
    };

    const config = statusConfig[connectionStatus];
    const IconComponent = config.icon;

    return (
      <View style={[styles.statusContainer, { borderColor: config.color }]}>
        <IconComponent size={20} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            style={styles.headerGradient}
          >
            <SettingsIcon size={32} color="#ffffff" />
          </LinearGradient>
          <Text style={styles.title}>Paramètres</Text>
          <Text style={styles.subtitle}>Version 1.7.0 - SIMPLE ET EFFICACE</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration du serveur</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>URL du serveur</Text>
            <TextInput
              style={styles.textInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.18.28/mods/livetv/api"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {renderConnectionStatus()}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.testButton,
                (!serverUrl.trim() || connectionStatus === 'testing') && styles.buttonDisabled
              ]}
              onPress={() => testConnection(serverUrl)}
              disabled={!serverUrl.trim() || connectionStatus === 'testing'}
            >
              {connectionStatus === 'testing' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Wifi size={16} color="#ffffff" />
              )}
              <Text style={styles.buttonText}>Tester</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (!hasChanges || saving) && styles.buttonDisabled
              ]}
              onPress={saveSettings}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Check size={16} color="#ffffff" />
              )}
              <Text style={styles.buttonText}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enregistrement</Text>
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.registerButton,
              registering && styles.buttonDisabled
            ]}
            onPress={registerDevice}
            disabled={registering}
          >
            {registering ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Monitor size={16} color="#ffffff" />
            )}
            <Text style={styles.buttonText}>
              {registering ? 'Enregistrement...' : 'Enregistrer l\'appareil'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres avancés</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Power size={20} color={autoStartEnabled ? "#10b981" : "#6b7280"} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Démarrage automatique</Text>
                <Text style={styles.settingDescription}>
                  Démarrer l'application au démarrage du Fire TV
                </Text>
              </View>
            </View>
            <Switch
              value={autoStartEnabled}
              onValueChange={setAutoStartEnabled}
              trackColor={{ false: '#6b7280', true: '#10b981' }}
              thumbColor={autoStartEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Monitor size={20} color={keepAwakeEnabled ? "#10b981" : "#6b7280"} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Keep-awake</Text>
                <Text style={styles.settingDescription}>
                  Empêcher la mise en veille pendant les présentations
                </Text>
              </View>
            </View>
            <Switch
              value={keepAwakeEnabled}
              onValueChange={setKeepAwakeEnabled}
              trackColor={{ false: '#6b7280', true: '#10b981' }}
              thumbColor={keepAwakeEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity
            style={styles.saveAdvancedButton}
            onPress={saveAdvancedSettings}
          >
            <Check size={16} color="#ffffff" />
            <Text style={styles.saveAdvancedButtonText}>
              Sauvegarder les paramètres
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Monitor size={20} color="#9ca3af" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.7.0 - SIMPLE ET EFFICACE</Text>
              </View>
            </View>
            
            {debugInfo && (
              <>
                <View style={styles.infoRow}>
                  <Server size={20} color="#9ca3af" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>ID de l'appareil</Text>
                    <Text style={styles.infoValue}>{debugInfo.deviceId}</Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <Check size={20} color={debugInfo.isRegistered ? "#10b981" : "#ef4444"} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <Text style={[styles.infoValue, { color: debugInfo.isRegistered ? "#10b981" : "#ef4444" }]}>
                      {debugInfo.isRegistered ? 'Enregistré' : 'Non enregistré'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetSettings}
          >
            <Trash2 size={16} color="#ef4444" />
            <Text style={[styles.buttonText, { color: '#ef4444' }]}>
              Réinitialiser
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  registerButton: {
    backgroundColor: '#8b5cf6',
    flex: 'none',
    width: '100%',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ef4444',
    flex: 'none',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  saveAdvancedButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveAdvancedButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
});