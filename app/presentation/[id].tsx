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
import { ArrowLeft, Play, Pause, Monitor, Clock, CircleAlert as AlertCircle, RefreshCw, Repeat } from 'lucide-react-native';
import { apiService, PresentationDetails, Slide } from '@/services/ApiService';
import { statusService } from '@/services/StatusService';

const { width, height } = Dimensions.get('window');

export default function PresentationScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;
  const auto_play = params.auto_play as string;
  const loop_mode = params.loop_mode as string;
  const assigned = params.assigned as string;
  
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
  
  // Refs pour la gestion du timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slideStartTimeRef = useRef<number>(0);
  const currentSlideDurationRef = useRef<number>(0);
  const timeRemainingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Nettoyage des ressources
  const cleanupResources = useCallback(() => {
    console.log('=== CLEANING UP RESOURCES v1.5.1 ===');
    
    // Arrêter le timer principal
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Arrêter le timer de masquage des contrôles
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
    
    // Arrêter l'intervalle de mise à jour du temps restant
    if (timeRemainingIntervalRef.current) {
      clearInterval(timeRemainingIntervalRef.current);
      timeRemainingIntervalRef.current = null;
    }
    
    // Réinitialiser les refs
    slideStartTimeRef.current = 0;
    currentSlideDurationRef.current = 0;
  }, []);

  useEffect(() => {
    loadPresentation();
    
    // Configurer selon les paramètres
    if (loop_mode === 'true') {
      console.log('Loop mode enabled v1.5.1');
      setIsLooping(true);
    }
    
    return cleanupResources;
  }, []);

  // Démarrage automatique
  useEffect(() => {
    if (presentation && auto_play === 'true') {
      console.log('=== AUTO-STARTING PRESENTATION v1.5.1 ===');
      const startTimer = setTimeout(() => {
        setIsPlaying(true);
        setShowControls(false);
      }, 1000);
      
      return () => clearTimeout(startTimer);
    }
  }, [presentation, auto_play]);

  // Gestion du timer
  useEffect(() => {
    console.log('=== TIMER EFFECT v1.5.1 ===');
    console.log('isPlaying:', isPlaying);
    console.log('currentSlideIndex:', currentSlideIndex);
    console.log('presentation slides:', presentation?.slides.length || 0);

    if (isPlaying && presentation && presentation.slides.length > 0) {
      startSlideTimer();
    } else {
      stopSlideTimer();
    }

    return () => {
      stopSlideTimer();
    };
  }, [isPlaying, currentSlideIndex, presentation]);

  // Auto-masquage des contrôles
  useEffect(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }

    if (showControls && isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
    };
  }, [showControls, isPlaying]);

  // Mettre à jour le statut
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
    }
  }, [presentation, currentSlideIndex, isLooping, isPlaying, auto_play]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('=== LOADING PRESENTATION v1.5.1 ===');
      console.log('Presentation ID:', id);
      
      const data = await apiService.getPresentation(Number(id));
      console.log('Loaded presentation:', data.name);
      console.log('Number of slides:', data.slides.length);
      
      if (!data.slides || data.slides.length === 0) {
        throw new Error('Aucune slide trouvée dans cette présentation');
      }
      
      // Log détaillé des slides avec leurs durées
      console.log('=== SLIDES DETAILS v1.5.1 ===');
      data.slides.forEach((slide, index) => {
        console.log(`Slide ${index + 1}:`, {
          id: slide.id,
          name: slide.name,
          duration: slide.duration
        });
      });
      
      setPresentation(data);
      
      // Initialiser le temps restant avec la durée de la première slide
      if (data.slides.length > 0) {
        setTimeRemaining(data.slides[0].duration * 1000);
      }
    } catch (error) {
      console.error('Error loading presentation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(errorMessage);
      statusService.reportError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const stopSlideTimer = useCallback(() => {
    if (timerRef.current) {
      console.log('=== STOPPING TIMER v1.5.1 ===');
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (timeRemainingIntervalRef.current) {
      clearInterval(timeRemainingIntervalRef.current);
      timeRemainingIntervalRef.current = null;
    }
    
    slideStartTimeRef.current = 0;
    currentSlideDurationRef.current = 0;
    setTimeRemaining(0);
  }, []);

  const startSlideTimer = useCallback(() => {
    if (!presentation || presentation.slides.length === 0) {
      console.log('=== NO PRESENTATION OR SLIDES v1.5.1 ===');
      return;
    }

    // Vérifier que l'index est valide
    if (currentSlideIndex >= presentation.slides.length) {
      console.error('=== INVALID SLIDE INDEX v1.5.1 ===');
      console.error('Current index:', currentSlideIndex);
      console.error('Total slides:', presentation.slides.length);
      setCurrentSlideIndex(0);
      return;
    }

    stopSlideTimer();

    const currentSlide = presentation.slides[currentSlideIndex];
    if (!currentSlide) {
      console.error('=== CURRENT SLIDE NOT FOUND v1.5.1 ===');
      return;
    }

    const slideDuration = currentSlide.duration * 1000; // Convertir en millisecondes
    
    console.log(`=== STARTING TIMER v1.5.1 FOR SLIDE ${currentSlideIndex + 1}/${presentation.slides.length} ===`);
    console.log(`Slide: ${currentSlide.name}`);
    console.log(`Duration: ${currentSlide.duration}s (${slideDuration}ms)`);
    
    slideStartTimeRef.current = Date.now();
    currentSlideDurationRef.current = slideDuration;
    setTimeRemaining(slideDuration);

    // Timer principal pour passer à la slide suivante
    timerRef.current = setTimeout(() => {
      console.log(`=== TIMER COMPLETED FOR SLIDE ${currentSlideIndex + 1} v1.5.1 ===`);
      nextSlide();
    }, slideDuration);

    // Intervalle pour mettre à jour le temps restant
    timeRemainingIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - slideStartTimeRef.current;
      const remaining = Math.max(0, currentSlideDurationRef.current - elapsed);
      
      setTimeRemaining(remaining);
      
      if (remaining <= 0 && timeRemainingIntervalRef.current) {
        clearInterval(timeRemainingIntervalRef.current);
        timeRemainingIntervalRef.current = null;
      }
    }, 100);

    console.log('=== TIMER STARTED SUCCESSFULLY v1.5.1 ===');
  }, [presentation, currentSlideIndex]);

  const nextSlide = useCallback(() => {
    if (!presentation) return;
    
    console.log(`=== NEXT SLIDE LOGIC v1.5.1 ===`);
    console.log(`Current: ${currentSlideIndex + 1}/${presentation.slides.length}`);
    console.log(`Is looping: ${isLooping}`);
    
    if (currentSlideIndex < presentation.slides.length - 1) {
      const nextIndex = currentSlideIndex + 1;
      console.log(`Moving to slide ${nextIndex + 1}/${presentation.slides.length}`);
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

  const togglePlayPause = useCallback(() => {
    console.log('=== TOGGLE PLAY/PAUSE v1.5.1 ===');
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
    loadPresentation();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Chargement de la présentation...</Text>
        <Text style={styles.loadingSubtext}>Version 1.5.1 - Simplifiée</Text>
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
    console.error('=== CRITICAL ERROR: NO CURRENT SLIDE v1.5.1 ===');
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
            resizeMode="contain"
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

        <View style={styles.versionIndicator}>
          <Text style={styles.versionText}>v1.5.1</Text>
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
                  {presentation.name} {assigned === 'true' && '(Assignée)'} - v1.5.1
                </Text>
                <Text style={styles.slideCounter}>
                  {safeCurrentSlideIndex + 1} / {presentation.slides.length}
                  {isLooping && loopCount > 0 && ` • Boucle ${loopCount}`}
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
                  style={[styles.controlButton, styles.playButton]}
                  onPress={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause size={28} color="#ffffff" />
                  ) : (
                    <Play size={28} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: width,
    height: height,
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
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
});