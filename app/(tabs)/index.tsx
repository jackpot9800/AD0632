import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, Wifi, WifiOff, RefreshCw, Play, Settings, Repeat, Star } from 'lucide-react-native';
import { apiService, Presentation, AssignedPresentation, DefaultPresentation } from '@/services/ApiService';
import { statusService } from '@/services/StatusService';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing' | 'not_configured'>('testing');
  const [assignedPresentation, setAssignedPresentation] = useState<AssignedPresentation | null>(null);
  const [defaultPresentation, setDefaultPresentation] = useState<DefaultPresentation | null>(null);

  useEffect(() => {
    initializeApp();
    initializeStatusService();
  }, []);

  const initializeApp = async () => {
    setLoading(true);
    await apiService.initialize();
    
    const serverUrl = apiService.getServerUrl();
    console.log('Current server URL:', serverUrl);
    
    if (!serverUrl) {
      setConnectionStatus('not_configured');
      setLoading(false);
      return;
    }
    
    await checkConnection();
    await loadPresentations();
    
    if (apiService.isDeviceRegistered() && connectionStatus === 'connected') {
      console.log('=== DEVICE IS REGISTERED AND CONNECTED ===');
      startAssignmentMonitoring();
      startDefaultPresentationMonitoring();
    }
    
    setLoading(false);
  };

  const initializeStatusService = async () => {
    try {
      await statusService.initialize();
      statusService.updateStatus({ status: 'online' });
    } catch (error) {
      console.error('Failed to initialize status service:', error);
    }
  };

  const checkConnection = async () => {
    const serverUrl = apiService.getServerUrl();
    if (!serverUrl) {
      setConnectionStatus('not_configured');
      return;
    }
    
    setConnectionStatus('testing');
    try {
      const isConnected = await apiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('disconnected');
    }
  };

  const loadPresentations = async () => {
    const serverUrl = apiService.getServerUrl();
    if (!serverUrl) {
      setConnectionStatus('not_configured');
      return;
    }
    
    try {
      const data = await apiService.getPresentations();
      setPresentations(data);
    } catch (error) {
      console.error('Error loading presentations:', error);
      Alert.alert(
        'Erreur de connexion',
        `Impossible de charger les présentations`,
        [
          { text: 'Paramètres', onPress: () => router.push('/(tabs)/settings') },
          { text: 'Réessayer', onPress: loadPresentations },
        ]
      );
    }
  };

  const startAssignmentMonitoring = async () => {
    try {
      await apiService.startAssignmentCheck((assigned: AssignedPresentation) => {
        console.log('=== ASSIGNED PRESENTATION DETECTED ===');
        setAssignedPresentation(assigned);
        
        setTimeout(() => {
          launchAssignedPresentation(assigned);
        }, 1000);
      });

      const existing = await apiService.checkForAssignedPresentation();
      if (existing) {
        setAssignedPresentation(existing);
        setTimeout(() => {
          launchAssignedPresentation(existing);
        }, 2000);
      }
    } catch (error) {
      console.log('Assignment monitoring failed:', error);
    }
  };

  const startDefaultPresentationMonitoring = async () => {
    try {
      await apiService.startDefaultPresentationCheck((defaultPres: DefaultPresentation) => {
        console.log('=== DEFAULT PRESENTATION DETECTED ===');
        setDefaultPresentation(defaultPres);
      });

      const existing = await apiService.checkForDefaultPresentation();
      if (existing) {
        setDefaultPresentation(existing);
      }
    } catch (error) {
      console.log('Default presentation monitoring failed:', error);
    }
  };

  const launchAssignedPresentation = (assigned: AssignedPresentation) => {
    console.log('=== LAUNCHING ASSIGNED PRESENTATION ===');
    
    apiService.markAssignedPresentationAsViewed(assigned.presentation_id);
    
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true',
      assigned: 'true'
    });
    
    const url = `/presentation/${assigned.presentation_id}?${params.toString()}`;
    router.push(url);
  };

  const launchDefaultPresentation = (defaultPres: DefaultPresentation) => {
    console.log('=== LAUNCHING DEFAULT PRESENTATION ===');
    
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true',
      assigned: 'false',
      default: 'true'
    });
    
    const url = `/presentation/${defaultPres.presentation_id}?${params.toString()}`;
    router.push(url);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await checkConnection();
    await loadPresentations();
    setRefreshing(false);
  };

  const onRefresh = async () => {
    await handleManualRefresh();
  };

  const playPresentation = (presentation: Presentation) => {
    statusService.updatePresentationStatus(
      presentation.id,
      presentation.name || presentation.nom || 'Présentation',
      0,
      presentation.slide_count,
      true,
      true
    );
    
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true',
      assigned: 'false'
    });
    
    const url = `/presentation/${presentation.id}?${params.toString()}`;
    router.push(url);
  };

  const goToSettings = () => {
    router.push('/(tabs)/settings');
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      connected: { color: '#10b981', text: 'Connecté au serveur', icon: Wifi },
      disconnected: { color: '#ef4444', text: 'Serveur inaccessible', icon: WifiOff },
      testing: { color: '#f59e0b', text: 'Test de connexion...', icon: RefreshCw },
      not_configured: { color: '#6b7280', text: 'Serveur non configuré', icon: WifiOff },
    };

    const config = statusConfig[connectionStatus];
    const IconComponent = config.icon;

    return (
      <TouchableOpacity 
        style={[styles.statusCard, { borderLeftColor: config.color }]}
        onPress={goToSettings}
      >
        <View style={styles.statusHeader}>
          <IconComponent size={20} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.text}
          </Text>
          <Settings size={16} color="#9ca3af" />
        </View>
        <Text style={styles.serverUrl}>
          {apiService.getServerUrl() || 'Cliquez pour configurer'}
        </Text>
        <Text style={styles.versionText}>
          Version 1.3.0 - Timer corrigé • ID: {apiService.getDeviceId()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAssignedPresentation = () => {
    if (!assignedPresentation) return null;

    return (
      <View style={styles.assignedSection}>
        <Text style={styles.assignedTitle}>📌 Présentation assignée</Text>
        <TouchableOpacity
          style={styles.assignedCard}
          onPress={() => launchAssignedPresentation(assignedPresentation)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            style={styles.assignedGradient}
          >
            <View style={styles.assignedHeader}>
              <Monitor size={24} color="#ffffff" />
              <View style={styles.assignedBadges}>
                <View style={styles.autoPlayBadge}>
                  <Play size={12} color="#ffffff" />
                  <Text style={styles.badgeText}>AUTO</Text>
                </View>
                <View style={styles.loopBadge}>
                  <Repeat size={12} color="#ffffff" />
                  <Text style={styles.badgeText}>BOUCLE</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.assignedName} numberOfLines={2}>
              {assignedPresentation.presentation_name}
            </Text>
            <Text style={styles.assignedDescription} numberOfLines={2}>
              {assignedPresentation.presentation_description || 'Présentation assignée à cet appareil'}
            </Text>
            
            <View style={styles.assignedFooter}>
              <Text style={styles.assignedMode}>
                🚀 Lecture automatique en boucle
              </Text>
              <View style={styles.assignedPlayButton}>
                <Play size={18} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDefaultPresentation = () => {
    if (!defaultPresentation) return null;

    return (
      <View style={styles.assignedSection}>
        <Text style={styles.assignedTitle}>⭐ Présentation par défaut</Text>
        <TouchableOpacity
          style={styles.assignedCard}
          onPress={() => launchDefaultPresentation(defaultPresentation)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8b5cf6', '#7c3aed']}
            style={styles.assignedGradient}
          >
            <View style={styles.assignedHeader}>
              <Star size={24} color="#ffffff" />
              <View style={styles.assignedBadges}>
                <View style={styles.defaultBadge}>
                  <Star size={12} color="#ffffff" />
                  <Text style={styles.badgeText}>DÉFAUT</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.assignedName} numberOfLines={2}>
              {defaultPresentation.presentation_name}
            </Text>
            <Text style={styles.assignedDescription} numberOfLines={2}>
              {defaultPresentation.presentation_description || 'Présentation par défaut pour cet appareil'}
            </Text>
            
            <View style={styles.assignedFooter}>
              <Text style={styles.assignedMode}>
                🌟 Cliquez pour lancer
              </Text>
              <View style={styles.assignedPlayButton}>
                <Play size={18} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPresentationCard = (presentation: Presentation, index: number) => {
    const gradientColors = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7']
    ];
    
    const colors = gradientColors[index % gradientColors.length];

    return (
      <TouchableOpacity
        key={presentation.id}
        style={styles.presentationCard}
        onPress={() => playPresentation(presentation)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <Monitor size={28} color="#ffffff" />
            <View style={styles.slideCountBadge}>
              <Text style={styles.slideCountText}>{presentation.slide_count}</Text>
            </View>
          </View>
          
          <View style={styles.cardContent}>
            <Text style={styles.presentationTitle} numberOfLines={2}>
              {presentation.name}
            </Text>
            <Text style={styles.presentationDescription} numberOfLines={3}>
              {presentation.description || 'Aucune description disponible'}
            </Text>
            
            <View style={styles.autoLoopIndicator}>
              <Repeat size={14} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.autoLoopText}>Lecture automatique en boucle</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.createdDate}>
              {new Date(presentation.created_at).toLocaleDateString('fr-FR')}
            </Text>
            <View style={styles.playButton}>
              <Play size={18} color="#ffffff" fill="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <RefreshCw size={48} color="#ffffff" />
          <Text style={styles.loadingText}>Initialisation de l'application...</Text>
          <Text style={styles.loadingSubtext}>Version 1.3.0 - Timer corrigé</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Kiosque de Présentations</Text>
              <Text style={styles.subtitle}>
                Fire TV Stick - Version 1.3.0 Timer Corrigé
              </Text>
              
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleManualRefresh}
                disabled={refreshing}
              >
                <RefreshCw 
                  size={20} 
                  color="#ffffff" 
                  style={refreshing ? styles.spinning : undefined}
                />
                <Text style={styles.refreshButtonText}>
                  {refreshing ? 'Actualisation...' : 'Actualiser'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {renderConnectionStatus()}
        {renderAssignedPresentation()}
        {renderDefaultPresentation()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Présentations disponibles ({presentations.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              🔄 Lecture automatique en boucle • Timer corrigé v1.3.0
            </Text>
          </View>
          
          {connectionStatus === 'not_configured' ? (
            <View style={styles.configurationNeeded}>
              <Settings size={64} color="#6b7280" />
              <Text style={styles.configTitle}>Configuration requise</Text>
              <Text style={styles.configMessage}>
                Configurez l'URL de votre serveur pour accéder aux présentations
              </Text>
              <TouchableOpacity
                style={styles.configButton}
                onPress={goToSettings}
              >
                <Settings size={20} color="#ffffff" />
                <Text style={styles.configButtonText}>Configurer le serveur</Text>
              </TouchableOpacity>
            </View>
          ) : connectionStatus === 'disconnected' ? (
            <View style={styles.disconnectedState}>
              <WifiOff size={64} color="#ef4444" />
              <Text style={styles.disconnectedTitle}>Connexion impossible</Text>
              <Text style={styles.disconnectedMessage}>
                Impossible de se connecter au serveur.
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleManualRefresh}
                >
                  <RefreshCw size={20} color="#ffffff" />
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={goToSettings}
                >
                  <Settings size={20} color="#ffffff" />
                  <Text style={styles.settingsButtonText}>Paramètres</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : presentations.length === 0 ? (
            <View style={styles.emptyState}>
              <Monitor size={64} color="#6b7280" />
              <Text style={styles.emptyTitle}>Aucune présentation</Text>
              <Text style={styles.emptyMessage}>
                Aucune présentation disponible sur le serveur.
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleManualRefresh}
              >
                <RefreshCw size={20} color="#ffffff" />
                <Text style={styles.refreshButtonText}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.presentationsGrid}>
              {presentations.map((presentation, index) => 
                renderPresentationCard(presentation, index)
              )}
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    margin: 20,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: -20,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  serverUrl: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  assignedSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  assignedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  assignedCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  assignedGradient: {
    padding: 20,
    minHeight: 140,
  },
  assignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignedBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  autoPlayBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loopBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  assignedName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  assignedDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  assignedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignedMode: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  assignedPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
  },
  presentationsGrid: {
    gap: 16,
  },
  presentationCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 24,
    minHeight: 220,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  slideCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slideCountText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
    marginBottom: 16,
  },
  presentationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    lineHeight: 26,
  },
  presentationDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 12,
  },
  autoLoopIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  autoLoopText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdDate: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  playButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  configurationNeeded: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  configTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  configMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  configButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectedState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disconnectedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  disconnectedMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});