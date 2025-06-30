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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Server, 
  Wifi, 
  Check, 
  CircleAlert as AlertCircle, 
  Settings as SettingsIcon, 
  Trash2, 
  UserPlus
} from 'lucide-react-native';
import { apiService } from '@/services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Paramètres simplifiés
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);

  useEffect(() => {
    loadCurrentSettings();
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

  const loadAdvancedSettings = async () => {
    try {
      const autoStart = await AsyncStorage.getItem('settings_auto_start');
      const keepAwake = await AsyncStorage.getItem('settings_keep_awake');
      
      setAutoStartEnabled(autoStart !== 'false');
      setKeepAwakeEnabled(keepAwake !== 'false');
    } catch (error) {
      console.error('Error loading advanced settings:', error);
    }
  };

  const saveAdvancedSettings = async () => {
    try {
      await AsyncStorage.setItem('settings_auto_start', autoStartEnabled.toString());
      await AsyncStorage.setItem('settings_keep_awake', keepAwakeEnabled.toString());
      
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
      
      console.log('Testing connection to v1.5.0:', finalUrl);
      
      await AsyncStorage.setItem('server_url', finalUrl);
      
      const response = await fetch(`${finalUrl}/version`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PresentationKiosk/1.5.0 (FireTV)',
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
              `Connexion au serveur établie avec succès !`,
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
        `Impossible de se connecter au serveur.`,
        [{ text: 'OK' }]
      );
      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      
      Alert.alert(
        'Erreur de connexion',
        `Impossible de joindre le serveur`,
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
      console.log('=== SAVING SETTINGS v1.5.0 ===');
      
      const success = await apiService.setServerUrl(serverUrl.trim());
      
      if (success) {
        setOriginalUrl(serverUrl.trim());
        setConnectionStatus('success');
        
        Alert.alert(
          'Configuration sauvegardée',
          'La configuration a été sauvegardée avec succès.',
          [{ text: 'OK' }]
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
        `Une erreur est survenue`,
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
      console.log('=== MANUAL DEVICE REGISTRATION v1.5.0 ===');
      
      const connectionOk = await apiService.testConnection();
      if (!connectionOk) {
        throw new Error('Impossible de se connecter au serveur');
      }

      const registrationOk = await apiService.registerDevice();
      if (registrationOk) {
        Alert.alert(
          'Enregistrement réussi !',
          `L'appareil a été enregistré avec succès.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('L\'enregistrement a échoué');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      Alert.alert(
        'Erreur d\'enregistrement',
        `Impossible d'enregistrer l'appareil`,
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
          <Text style={styles.subtitle}>Version 1.5.0 - Simplifiée</Text>
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
              <UserPlus size={16} color="#ffffff" />
            )}
            <Text style={styles.buttonText}>
              {registering ? 'Enregistrement...' : 'Enregistrer l\'appareil'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres simplifiés</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
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
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.5.0 - Simplifiée</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>ID de l'appareil</Text>
                <Text style={styles.infoValue}>{apiService.getDeviceId()}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Statut</Text>
                <Text style={styles.infoValue}>
                  {apiService.isDeviceRegistered() ? 'Enregistré' : 'Non enregistré'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Plateforme</Text>
                <Text style={styles.infoValue}>{Platform.OS}</Text>
              </View>
            </View>
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
    backgroundColor: '#0a0a0a',
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
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#374151',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#9ca3af',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});