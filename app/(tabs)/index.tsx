import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { Monitor, Wifi, WifiOff, RefreshCw, Play, Settings, Repeat, Star, Activity, Zap, Chrome as Home, Bug } from 'lucide-react-native';
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
  
  // SOLUTION DÉFINITIVE v2.4.0 - Surveillance active avec debug complet
  const surveillanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoLaunchAttemptedRef = useRef<Set<number>>(new Set());
  const isAppActiveRef = useRef(true);
  const lastCheckTimeRef = useRef<number>(0);
  const forceCheckRef = useRef<boolean>(false);
  
  // NOUVEAU v2.4.0 - États de surveillance visibles avec debug
  const [surveillanceActive, setSurveillanceActive] = useState(false);
  const [lastSurveillanceCheck, setLastSurveillanceCheck] = useState<Date | null>(null);
  const [surveillanceMessage, setSurveillanceMessage] = useState<string>('Initialisation...');
  const [autoLaunchStatus, setAutoLaunchStatus] = useState<string>('En attente...');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    initializeApp();
    initializeStatusService();
    
    return () => {
      if (surveillanceIntervalRef.current) {
        clearInterval(surveillanceIntervalRef.current);
      }
      statusService.stop();
    };
  }, []);

  const initializeApp = async () => {
    console.log('=== STARTING APP INITIALIZATION v2.4.0 DEBUG COMPLET ===');
    setLoading(true);
    setSurveillanceMessage('Initialisation de l\'application...');
    setDebugInfo('Démarrage de l\'application...');
    
    await apiService.initialize();
    
    const serverUrl = apiService.getServerUrl();
    console.log('Current server URL:', serverUrl);
    setDebugInfo(`URL serveur: ${serverUrl || 'Non configuré'}`);
    
    if (!serverUrl) {
      setConnectionStatus('not_configured');
      setSurveillanceMessage('Serveur non configuré');
      setDebugInfo('❌ Serveur non configuré');
      setLoading(false);
      return;
    }
    
    await checkConnection();
    await loadPresentations();
    
    // DÉMARRER LA SURVEILLANCE ACTIVE AVEC DEBUG COMPLET v2.4.0
    if (apiService.isDeviceRegistered() && connectionStatus === 'connected') {
      startActiveSurveillanceWithDebug();
    }
    
    setLoading(false);
    console.log('=== APP INITIALIZATION COMPLETE v2.4.0 ===');
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
      setSurveillanceMessage('Serveur non configuré');
      setDebugInfo('❌ Serveur non configuré');
      return;
    }
    
    setConnectionStatus('testing');
    setSurveillanceMessage('Test de connexion...');
    setDebugInfo('🔍 Test de connexion...');
    try {
      const isConnected = await apiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      setSurveillanceMessage(isConnected ? 'Connexion établie' : 'Connexion échouée');
      setDebugInfo(isConnected ? '✅ Connexion établie' : '❌ Connexion échouée');
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('disconnected');
      setSurveillanceMessage('Erreur de connexion');
      setDebugInfo(`❌ Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`);
    }
  };

  const loadPresentations = async () => {
    const serverUrl = apiService.getServerUrl();
    if (!serverUrl) {
      setConnectionStatus('not_configured');
      setSurveillanceMessage('Serveur non configuré');
      setDebugInfo('❌ Serveur non configuré');
      return;
    }
    
    try {
      setSurveillanceMessage('Chargement des présentations...');
      setDebugInfo('📥 Chargement des présentations...');
      const data = await apiService.getPresentations();
      setPresentations(data);
      setSurveillanceMessage('Présentations chargées');
      setDebugInfo(`✅ ${data.length} présentations chargées`);
    } catch (error) {
      console.error('Error loading presentations:', error);
      setSurveillanceMessage('Erreur de chargement');
      setDebugInfo(`❌ Erreur chargement: ${error instanceof Error ? error.message : 'Inconnue'}`);
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

  // SOLUTION DÉFINITIVE v2.4.0 : Surveillance active avec debug complet
  const startActiveSurveillanceWithDebug = () => {
    console.log('=== STARTING ACTIVE SURVEILLANCE WITH DEBUG v2.4.0 ===');
    
    setSurveillanceActive(true);
    setSurveillanceMessage('🔄 Surveillance active - Recherche de présentations...');
    setDebugInfo('🔄 Surveillance démarrée');
    
    // Vérification immédiate
    performDebuggedCheck();
    
    // Surveillance continue toutes les 2 secondes avec debug complet
    if (surveillanceIntervalRef.current) {
      clearInterval(surveillanceIntervalRef.current);
    }
    
    surveillanceIntervalRef.current = setInterval(() => {
      if (isAppActiveRef.current) {
        performDebuggedCheck();
      }
    }, 2000); // Toutes les 2 secondes avec debug complet
    
    console.log('✅ Active surveillance with debug started (2s interval)');
  };

  // FONCTION PRINCIPALE v2.4.0 : Vérification avec debug complet
  const performDebuggedCheck = async () => {
    try {
      const now = Date.now();
      
      // Permettre les vérifications forcées ou respecter l'intervalle minimum
      if (!forceCheckRef.current && (now - lastCheckTimeRef.current < 1500)) {
        return;
      }
      lastCheckTimeRef.current = now;
      forceCheckRef.current = false;
      
      setLastSurveillanceCheck(new Date());
      setSurveillanceMessage('🔍 Vérification en cours...');
      setDebugInfo(`🔍 Check ${new Date().toLocaleTimeString()}`);
      
      console.log('=== DEBUGGED CHECK v2.4.0 ===');
      
      // 1. Vérifier les assignations (priorité absolue)
      setSurveillanceMessage('🔍 Recherche de présentations assignées...');
      setDebugInfo('🔍 Vérification assignations...');
      const assigned = await apiService.checkForAssignedPresentation();
      if (assigned) {
        console.log('✅ ASSIGNED PRESENTATION FOUND:', assigned.presentation_id);
        setAssignedPresentation(assigned);
        setSurveillanceMessage('📌 Présentation assignée trouvée !');
        setAutoLaunchStatus('🚀 Lancement de la présentation assignée...');
        setDebugInfo(`✅ Assignée: ${assigned.presentation_name}`);
        
        if (!autoLaunchAttemptedRef.current.has(assigned.presentation_id)) {
          console.log('🚀 LAUNCHING ASSIGNED PRESENTATION v2.4.0');
          autoLaunchAttemptedRef.current.add(assigned.presentation_id);
          launchAssignedPresentation(assigned);
        }
        return; // Priorité aux assignations
      }
      
      // 2. Vérifier la présentation par défaut avec debug complet
      setSurveillanceMessage('🔍 Recherche de présentation par défaut...');
      setDebugInfo('🔍 Vérification présentation par défaut...');
      
      console.log('=== CALLING checkForDefaultPresentation v2.4.0 ===');
      const defaultPres = await apiService.checkForDefaultPresentation();
      console.log('=== DEFAULT PRESENTATION CHECK RESULT v2.4.0 ===');
      console.log('Default presentation data:', defaultPres);
      
      // VALIDATION STRICTE RENFORCÉE v2.4.0 avec debug complet
      console.log('=== VALIDATION DEBUG v2.4.0 ===');
      const hasDefaultPres = !!defaultPres;
      const hasId = !!(defaultPres?.presentation_id);
      const idGreaterThanZero = (defaultPres?.presentation_id || 0) > 0;
      const hasName = !!(defaultPres?.presentation_name);
      const nameNotEmpty = !!(defaultPres?.presentation_name?.trim());
      const nameLength = defaultPres?.presentation_name?.trim()?.length || 0;
      
      console.log('Validation steps:', {
        hasDefaultPres,
        hasId,
        idGreaterThanZero,
        hasName,
        nameNotEmpty,
        nameLength
      });
      
      setDebugInfo(`Debug: ID=${defaultPres?.presentation_id}, Nom="${defaultPres?.presentation_name}", Longueur=${nameLength}`);
      
      if (hasDefaultPres && hasId && idGreaterThanZero && hasName && nameNotEmpty && nameLength > 0) {
        console.log('✅ ✅ ✅ VALID DEFAULT PRESENTATION FOUND v2.4.0 ✅ ✅ ✅');
        console.log('VALID DEFAULT PRESENTATION DETAILS:', {
          id: defaultPres.presentation_id,
          name: defaultPres.presentation_name,
          nameLength: nameLength
        });
        
        setDefaultPresentation(defaultPres);
        setSurveillanceMessage('⭐ Présentation par défaut trouvée !');
        setAutoLaunchStatus(`🔄 Lancement automatique: ${defaultPres.presentation_name}`);
        setDebugInfo(`✅ Par défaut: ${defaultPres.presentation_name} (ID: ${defaultPres.presentation_id})`);
        
        // LANCEMENT AUTOMATIQUE GARANTI v2.4.0
        if (!autoLaunchAttemptedRef.current.has(defaultPres.presentation_id)) {
          console.log('🚀 LAUNCHING DEFAULT PRESENTATION IN INFINITE LOOP v2.4.0');
          autoLaunchAttemptedRef.current.add(defaultPres.presentation_id);
          setAutoLaunchStatus('🚀 Démarrage en boucle infinie...');
          setDebugInfo(`🚀 Lancement: ${defaultPres.presentation_name}`);
          launchDefaultPresentationInfiniteLoop(defaultPres);
        } else {
          setSurveillanceMessage('⚠️ Présentation déjà lancée, surveillance continue...');
          setAutoLaunchStatus('✅ Présentation en cours de diffusion');
          setDebugInfo(`✅ Déjà lancée: ${defaultPres.presentation_name}`);
        }
      } else {
        console.log('❌ ❌ ❌ NO VALID DEFAULT PRESENTATION FOUND v2.4.0 ❌ ❌ ❌');
        console.log('Validation failure details:', {
          hasDefaultPres,
          hasId,
          idGreaterThanZero,
          hasName,
          nameNotEmpty,
          nameLength
        });
        
        setSurveillanceMessage('❌ Aucune présentation par défaut valide');
        setAutoLaunchStatus('⏳ En attente d\'une présentation...');
        setDefaultPresentation(null);
        
        // Debug détaillé de l'échec
        let debugFailure = '❌ Échec validation: ';
        if (!hasDefaultPres) debugFailure += 'Pas de données, ';
        if (!hasId) debugFailure += 'Pas d\'ID, ';
        if (!idGreaterThanZero) debugFailure += 'ID ≤ 0, ';
        if (!hasName) debugFailure += 'Pas de nom, ';
        if (!nameNotEmpty) debugFailure += 'Nom vide, ';
        if (nameLength === 0) debugFailure += 'Longueur = 0';
        
        setDebugInfo(debugFailure);
        
        // Réinitialiser les tentatives si aucune présentation par défaut valide
        if (!defaultPres || !defaultPres.presentation_id || defaultPres.presentation_id <= 0) {
          autoLaunchAttemptedRef.current.clear();
        }
      }
      
    } catch (error) {
      console.error('Error in debugged check:', error);
      setSurveillanceMessage('❌ Erreur lors de la vérification');
      setAutoLaunchStatus('❌ Erreur de surveillance');
      setDebugInfo(`❌ Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`);
    }
  };

  const launchAssignedPresentation = (assigned: AssignedPresentation) => {
    console.log('=== LAUNCHING ASSIGNED PRESENTATION v2.4.0 ===');
    
    apiService.markAssignedPresentationAsViewed(assigned.presentation_id);
    
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true',
      assigned: 'true'
    });
    
    const url = `/presentation/${assigned.presentation_id}?${params.toString()}`;
    console.log('Navigating to assigned presentation:', url);
    router.push(url);
  };

  // LANCEMENT EN BOUCLE INFINIE GARANTI v2.4.0
  const launchDefaultPresentationInfiniteLoop = (defaultPres: DefaultPresentation) => {
    console.log('=== LAUNCHING DEFAULT PRESENTATION IN INFINITE LOOP v2.4.0 ===');
    console.log('Presentation ID:', defaultPres.presentation_id);
    console.log('Presentation name:', defaultPres.presentation_name);
    
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true', // BOUCLE INFINIE GARANTIE
      assigned: 'false',
      default: 'true'
    });
    
    const url = `/presentation/${defaultPres.presentation_id}?${params.toString()}`;
    console.log('🔄 Navigating to default presentation with INFINITE LOOP v2.4.0:', url);
    router.push(url);
  };

  const handleManualRefresh = async () => {
    if (refreshing) return;
    
    console.log('=== MANUAL REFRESH v2.4.0 ===');
    setRefreshing(true);
    setSurveillanceMessage('🔄 Actualisation manuelle...');
    setAutoLaunchStatus('🔄 Réinitialisation...');
    setDebugInfo('🔄 Actualisation manuelle...');
    
    // RÉINITIALISER complètement les tentatives de lancement
    autoLaunchAttemptedRef.current.clear();
    lastCheckTimeRef.current = 0;
    forceCheckRef.current = true;
    
    await checkConnection();
    await loadPresentations();
    
    // RELANCER la surveillance après le refresh
    if (apiService.isDeviceRegistered() && connectionStatus === 'connected') {
      startActiveSurveillanceWithDebug();
    }
    
    setRefreshing(false);
  };

  const onRefresh = async () => {
    await handleManualRefresh();
  };

  const playPresentation = (presentation: Presentation) => {
    // Marquer cette présentation comme tentée pour éviter les conflits
    autoLaunchAttemptedRef.current.add(presentation.id);
    
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

  const goToPresentations = () => {
    router.push('/(tabs)/presentations');
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
          Version 2.4.0 - DEBUG COMPLET • Surveillance 2s • ID: {apiService.getDeviceId()}
        </Text>
      </TouchableOpacity>
    );
  };

  // NOUVEAU v2.4.0 - Panneau de surveillance avec debug complet
  const renderSurveillancePanel = () => {
    if (!surveillanceActive) return null;

    return (
      <View style={styles.surveillancePanel}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.surveillanceGradient}
        >
          <View style={styles.surveillanceHeader}>
            <Activity size={20} color="#ffffff" />
            <Text style={styles.surveillanceTitle}>Surveillance Active v2.4.0</Text>
            <Bug size={16} color="#ffffff" />
          </View>
          
          <View style={styles.surveillanceContent}>
            <Text style={styles.surveillanceMessage}>{surveillanceMessage}</Text>
            <Text style={styles.autoLaunchStatus}>{autoLaunchStatus}</Text>
            
            {lastSurveillanceCheck && (
              <Text style={styles.lastCheckTime}>
                Dernière vérification: {lastSurveillanceCheck.toLocaleTimeString()}
              </Text>
            )}
            
            {debugInfo && (
              <Text style={styles.debugInfo}>{debugInfo}</Text>
            )}
          </View>
          
          <View style={styles.surveillanceIndicator}>
            <View style={styles.pulsingDot} />
            <Text style={styles.surveillanceFrequency}>Debug complet toutes les 2 secondes</Text>
          </View>
        </LinearGradient>
      </View>
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
                🚀 Surveillance 2s - Debug complet v2.4.0
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
          onPress={() => {
            launchDefaultPresentationInfiniteLoop(defaultPresentation);
          }}
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
                🔄 BOUCLE INFINIE - Debug complet v2.4.0
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

  const renderQuickActions = () => {
    return (
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={goToPresentations}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.quickActionGradient}
            >
              <Monitor size={32} color="#ffffff" />
              <Text style={styles.quickActionTitle}>Présentations</Text>
              <Text style={styles.quickActionSubtitle}>
                {presentations.length} disponible{presentations.length > 1 ? 's' : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={goToSettings}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6b7280', '#4b5563']}
              style={styles.quickActionGradient}
            >
              <Settings size={32} color="#ffffff" />
              <Text style={styles.quickActionTitle}>Paramètres</Text>
              <Text style={styles.quickActionSubtitle}>Configuration</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <Home size={48} color="#ffffff" />
          <Text style={styles.loadingText}>Initialisation de l'application...</Text>
          <Text style={styles.loadingSubtext}>Version 2.4.0 - DEBUG COMPLET</Text>
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
              <Home size={40} color="#ffffff" />
              <Text style={styles.title}>Accueil - Kiosque Fire TV</Text>
              <Text style={styles.subtitle}>
                Version 2.4.0 - DEBUG COMPLET
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
        {renderSurveillancePanel()}
        {renderAssignedPresentation()}
        {renderDefaultPresentation()}
        {renderQuickActions()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Aperçu des présentations ({presentations.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              🔄 Debug complet 2s • SOLUTION DÉFINITIVE v2.4.0
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
            <View style={styles.presentationsPreview}>
              <Text style={styles.previewTitle}>Dernières présentations</Text>
              {presentations.slice(0, 3).map((presentation, index) => (
                <TouchableOpacity
                  key={presentation.id}
                  style={styles.previewCard}
                  onPress={() => playPresentation(presentation)}
                  activeOpacity={0.8}
                >
                  <View style={styles.previewContent}>
                    <Monitor size={24} color="#3b82f6" />
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName} numberOfLines={1}>
                        {presentation.name || presentation.nom}
                      </Text>
                      <Text style={styles.previewDescription} numberOfLines={1}>
                        {presentation.slide_count} slide{presentation.slide_count > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Play size={20} color="#3b82f6" />
                  </View>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={goToPresentations}
              >
                <Text style={styles.viewAllText}>Voir toutes les présentations</Text>
                <Monitor size={16} color="#3b82f6" />
              </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
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
  // NOUVEAU v2.4.0 - Styles pour le panneau de surveillance avec debug
  surveillancePanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  surveillanceGradient: {
    padding: 20,
  },
  surveillanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  surveillanceTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  surveillanceContent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  surveillanceMessage: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  autoLaunchStatus: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  lastCheckTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  debugInfo: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  surveillanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    opacity: 0.8,
  },
  surveillanceFrequency: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
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
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  quickActionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
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
  presentationsPreview: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
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