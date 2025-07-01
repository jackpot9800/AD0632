import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Monitor, Clock, CircleAlert as AlertCircle, RefreshCw, Repeat } from 'lucide-react-native';
import { apiService, PresentationDetails, Slide } from '@/services/ApiService';
import { statusService } from '@/services/StatusService';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

const { width, height } = Dimensions.get('window');

export default function PresentationScreen() {
  const { id, auto_play, loop_mode, assigned } = useLocalSearchParams();
  const [presentation, setPresentation] = useState<PresentationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [imageLoadError, setImageLoadError] = useState<{[key: number]: boolean}>({});
  const [loopCount, setLoopCount] = useState(0);
  
  // Refs pour la gestion simplifiée
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayTriggeredRef = useRef<boolean>(false);
  const presentationLoadedRef = useRef<boolean>(false);

  // Nettoyage des ressources
  const cleanupResources = useCallback(() => {
    console.log('=== CLEANING UP RESOURCES v2.0.0 SIMPLE ===');
    
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
    
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    
    deactivateKeepAwake();
    statusService.setPresentationMode(false);
  }, []);

  useEffect(() => {
    console.log('=== PRESENTATION SCREEN MOUNTED v2.0.0 SIMPLE ===');
    console.log('Params:', { id, auto_play, loop_mode, assigned });
    
    // Activer keep-awake immédiatement
    activateKeepAwake();
    console.log('=== KEEP-AWAKE ACTIVATED v2.0.0 SIMPLE ===');
    
    // Configurer le mode boucle dès le début
    if (loop_mode === 'true') {
      console.log('=== LOOP MODE ENABLED v2.0.0 SIMPLE ===');
      setIsLooping(true);
    }
    
    // Charger la présentation
    loadPresentation();
    
    return cleanupResources;
  }, []);

  // DÉMARRAGE AUTOMATIQUE SIMPLIFIÉ
  useEffect(() => {
    console.log('=== AUTO-PLAY EFFECT v2.0.0 SIMPLE ===');
    console.log('presentation loaded:', !!presentation);
    console.log('auto_play param:', auto_play);
    console.log('autoPlayTriggeredRef:', autoPlayTriggeredRef.current);
    console.log('presentationLoadedRef:', presentationLoadedRef.current);
    
    // Conditions simplifiées pour le démarrage automatique
    if (
      presentation && 
      auto_play === 'true' && 
      !autoPlayTriggeredRef.current &&
      presentationLoadedRef.current
    ) {
      console.log('=== TRIGGERING AUTO-PLAY v2.0.0 SIMPLE ===');
      autoPlayTriggeredRef.current = true;
      
      // Démarrer immédiatement
      setIsPlaying(true);
      
      // Masquer les contrôles après 2 secondes
      setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  }, [presentation, auto_play]);

  // Gestion du timer de slides SIMPLIFIÉE
  useEffect(() => {
    console.log('=== SLIDE TIMER EFFECT v2.0.0 SIMPLE ===');
    console.log('isPlaying:', isPlaying);
    console.log('currentSlideIndex:', currentSlideIndex);
    console.log('slides count:', presentation?.slides.length || 0);

    // Nettoyer le timer existant
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }

    // Démarrer le timer si on est en lecture
    if (isPlaying && presentation && presentation.slides.length > 0) {
      const currentSlide = presentation.slides[currentSlideIndex];
      if (currentSlide) {
        const duration = currentSlide.duration * 1000; // Convertir en ms
        setTimeRemaining(duration);
        
        console.log(`=== STARTING TIMER FOR SLIDE ${currentSlideIndex + 1} v2.0.0 SIMPLE ===`);
        console.log(`Duration: ${currentSlide.duration}s`);
        
        slideTimerRef.current = setTimeout(() => {
          console.log(`=== TIMER COMPLETED FOR SLIDE ${currentSlideIndex + 1} v2.0.0 SIMPLE ===`);
          nextSlide();
        }, duration);
        
        // Mettre à jour le temps restant
        const startTime = Date.now();
        const updateTimer = () => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, duration - elapsed);
          setTimeRemaining(remaining);
          
          if (remaining > 0 && isPlaying) {
            setTimeout(updateTimer, 100);
          }
        };
        updateTimer();
      }
    } else {
      setTimeRemaining(0);
    }

    return () => {
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current);
        slideTimerRef.current = null;
      }
    };
  }, [isPlaying, currentSlideIndex, presentation]);

  // Auto-masquage des contrôles
  useEffect(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }

    if (showControls && isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
    };
  }, [showControls, isPlaying]);

  // Mise à jour du statut
  useEffect(() => {
    if (presentation) {
      statusService.updatePresentationStatus(
        presentation.id,
        presentation.name || presentation.nom || 'Présentation',
        currentSlideIndex,
        presentation.slides.length,
        isLooping,
        auto_play === 'true'
      );
      
      statusService.updatePlaybackStatus(isPlaying ? 'playing' : 'paused');
      statusService.setPresentationMode(isPlaying);
    }
  }, [presentation, currentSlideIndex, isLooping, isPlaying, auto_play]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('=== LOADING PRESENTATION v2.0.0 SIMPLE ===');
      console.log('Presentation ID:', id);
      
      const data = await apiService.getPresentation(Number(id));
      console.log('Loaded presentation:', data.name);
      console.log('Number of slides:', data.slides.length);
      
      if (!data.slides || data.slides.length === 0) {
        throw new Error('Aucune slide trouvée dans cette présentation');
      }
      
      setPresentation(data);
      presentationLoadedRef.current = true;
      
      console.log('=== PRESENTATION LOADED SUCCESSFULLY v2.0.0 SIMPLE ===');
      
      // Activer le mode présentation
      statusService.setPresentationMode(true);
    } catch (error) {
      console.error('Error loading presentation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(errorMessage);
      statusService.reportError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = useCallback(() => {
    if (!presentation || presentation.slides.length === 0) return;
    
    console.log(`=== NEXT SLIDE v2.0.0 SIMPLE ===`);
    console.log(`Current: ${currentSlideIndex + 1}/${presentation.slides.length}`);
    console.log(`Is looping: ${isLooping}`);
    
    if (currentSlideIndex < presentation.slides.length - 1) {
      const nextIndex = currentSlideIndex + 1;
      console.log(`Moving to slide ${nextIndex + 1}`);
      setCurrentSlideIndex(nextIndex);
    } else {
      console.log('End of presentation reached');
      
      if (isLooping) {
        console.log(`Loop ${loopCount + 1} completed, restarting...`);
        setCurrentSlideIndex(0);
        setLoopCount(prev => prev + 1);
      } else {
        console.log('Stopping playback');
        setIsPlaying(false);
        setCurrentSlideIndex(0);
        setShowControls(true);
        
        Alert.alert(
          'Présentation terminée',
          'La présentation est arrivée à sa fin.',
          [
            { text: 'Recommencer', onPress: () => setIsPlaying(true) },
            { text: 'Mode boucle', onPress: () => { setIsLooping(true); setIsPlaying(true); } },
            { text: 'Retour', onPress: () => router.back() },
          ]
        );
      }
    }
  }, [presentation, currentSlideIndex, isLooping, loopCount]);

  const previousSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      console.log(`Moving to previous slide: ${currentSlideIndex}`);
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
    setShowControls(true);
  }, [currentSlideIndex]);

  const togglePlayPause = useCallback(() => {
    console.log('=== TOGGLE PLAY/PAUSE v2.0.0 SIMPLE ===');
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    setShowControls(true);
  }, [isPlaying]);

  const toggleControls = useCallback(() => {
    setShowControls(!showControls);
  }, [showControls]);

  const handleImageError = useCallback((slideId: number) => {
    console.error('Image load error for slide:', slideId);
    setImageLoadError(prev => ({ ...prev, [slideId]: true }));
  }, []);

  const retryLoadPresentation = useCallback(() => {
    setError(null);
    setImageLoadError({});
    presentationLoadedRef.current = false;
    autoPlayTriggeredRef.current = false;
    loadPresentation();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Chargement de la présentation...</Text>
        <Text style={styles.loadingSubtext}>Version 2.0.0 - Lancement automatique simplifié</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Erreur de chargement</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.retryButton} onPress={retryLoadPresentation}>
            <RefreshCw size={20} color="#ffffff" />
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#ffffff" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!presentation || presentation.slides.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Monitor size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Présentation vide</Text>
        <Text style={styles.errorMessage}>
          Cette présentation ne contient aucune slide valide.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#ffffff" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Vérification de sécurité pour l'index
  const safeCurrentSlideIndex = Math.min(currentSlideIndex, presentation.slides.length - 1);
  const currentSlide = presentation.slides[safeCurrentSlideIndex];
  
  if (!currentSlide) {
    console.error('=== CRITICAL ERROR: NO CURRENT SLIDE v2.0.0 SIMPLE ===');
    setCurrentSlideIndex(0);
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Correction de l'index...</Text>
      </View>
    );
  }

  const progress = currentSlide.duration > 0 
    ? ((currentSlide.duration * 1000 - timeRemaining) / (currentSlide.duration * 1000)) * 100
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <TouchableOpacity
        style={styles.slideContainer}
        onPress={toggleControls}
        activeOpacity={1}
      >
        {imageLoadError[currentSlide.id] ? (
          <View style={styles.imageErrorContainer}>
            <AlertCircle size={48} color="#ef4444" />
            <Text style={styles.imageErrorText}>Impossible de charger l'image</Text>
            <Text style={styles.imageErrorUrl}>{currentSlide.image_url}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: currentSlide.image_url }}
            style={styles.slideImage}
            resizeMode="cover"
            onError={() => handleImageError(currentSlide.id)}
          />
        )}
        
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        {isLooping && (
          <View style={styles.loopIndicator}>
            <Repeat size={16} color="#ffffff" />
            <Text style={styles.loopText}>
              BOUCLE {loopCount > 0 ? `(${loopCount})` : ''}
            </Text>
          </View>
        )}

        {assigned === 'true' && (
          <View style={styles.assignedIndicator}>
            <Monitor size={16} color="#ffffff" />
            <Text style={styles.assignedText}>ASSIGNÉE</Text>
          </View>
        )}

        {auto_play === 'true' && (
          <View style={styles.autoPlayIndicator}>
            <Play size={16} color="#ffffff" />
            <Text style={styles.autoPlayText}>AUTO</Text>
          </View>
        )}

        <View style={styles.versionIndicator}>
          <Text style={styles.versionText}>v2.0.0</Text>
        </View>
      </TouchableOpacity>

      {showControls && (
        <View style={styles.controlsOverlay}>
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.8)']}
            style={styles.controlsGradient}
          >
            <View style={styles.topControls}>
              <TouchableOpacity
                style={styles.backIconButton}
                onPress={() => router.back()}
              >
                <ArrowLeft size={24} color="#ffffff" />
              </TouchableOpacity>
              
              <View style={styles.presentationInfo}>
                <Text style={styles.presentationTitle} numberOfLines={1}>
                  {presentation.name} {assigned === 'true' && '(Assignée)'} - v2.0.0
                </Text>
                <Text style={styles.slideCounter}>
                  {safeCurrentSlideIndex + 1} / {presentation.slides.length}
                  {isLooping && loopCount > 0 && ` • Boucle ${loopCount}`}
                  {auto_play === 'true' && ' • Auto-play'}
                </Text>
              </View>

              <View style={styles.timeInfo}>
                <Clock size={16} color="#ffffff" />
                <Text style={styles.timeText}>
                  {Math.ceil(timeRemaining / 1000)}s
                </Text>
              </View>
            </View>

            <View style={styles.bottomControls}>
              <View style={styles.controlButtons}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={previousSlide}
                  disabled={currentSlideIndex === 0}
                >
                  <SkipBack size={24} color={currentSlideIndex === 0 ? "#6b7280" : "#ffffff"} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, styles.playButton]}
                  onPress={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause size={28} color="#ffffff" fill="#ffffff" />
                  ) : (
                    <Play size={28} color="#ffffff" fill="#ffffff" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={nextSlide}
                >
                  <SkipForward size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loopButton, isLooping && styles.loopButtonActive]}
                onPress={() => setIsLooping(!isLooping)}
              >
                <Repeat size={20} color="#ffffff" />
                <Text style={styles.loopButtonText}>
                  {isLooping ? 'Boucle activée' : 'Boucle désactivée'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#6b7280',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  imageErrorText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  imageErrorUrl: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  loopIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loopText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  assignedIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  autoPlayIndicator: {
    position: 'absolute',
    top: 70,
    left: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoPlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  versionIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  versionText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  controlsGradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  backIconButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentationInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  presentationTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  slideCounter: {
    color: '#9ca3af',
    fontSize: 14,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#3b82f6',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  loopButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loopButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.7)',
  },
  loopButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});