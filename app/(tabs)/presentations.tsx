import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, Play, Clock, WifiOff, CircleAlert as AlertCircle, RefreshCw, Settings } from 'lucide-react-native';
import { apiService, Presentation } from '@/services/ApiService';

export default function PresentationsScreen() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== LOADING PRESENTATIONS v2.3.0 ===');
      console.log('Server URL:', apiService.getServerUrl());
      
      const data = await apiService.getPresentations();
      console.log('Presentations loaded successfully:', data.length);
      
      setPresentations(data);
    } catch (error) {
      console.error('=== ERROR LOADING PRESENTATIONS ===');
      console.error('Error details:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(errorMessage);
      
      Alert.alert(
        'Erreur de connexion',
        `Impossible de charger les présentations:\n\n${errorMessage}`,
        [
          { text: 'Paramètres', onPress: () => router.push('/(tabs)/settings') },
          { text: 'Réessayer', onPress: loadPresentations },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresentations();
    setRefreshing(false);
  };

  const playPresentation = (presentation: Presentation) => {
    console.log('Playing presentation:', presentation.id, presentation.name);
    const params = new URLSearchParams({
      auto_play: 'true',
      loop_mode: 'true',
      assigned: 'false'
    });
    
    const url = `/presentation/${presentation.id}?${params.toString()}`;
    router.push(url);
  };

  const renderPresentationItem = ({ item, index }: { item: Presentation; index: number }) => {
    const gradientColors = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a8edea', '#fed6e3']
    ];
    
    const colors = gradientColors[index % gradientColors.length];

    return (
      <TouchableOpacity
        style={styles.presentationItem}
        onPress={() => playPresentation(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors}
          style={styles.itemGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.itemHeader}>
            <Monitor size={28} color="#ffffff" />
            <View style={styles.slideCountBadge}>
              <Text style={styles.slideCountText}>{item.slide_count}</Text>
            </View>
          </View>
          
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.name || item.nom}
            </Text>
            <Text style={styles.itemDescription} numberOfLines={3}>
              {item.description || 'Aucune description disponible'}
            </Text>
          </View>

          <View style={styles.itemFooter}>
            <View style={styles.itemMeta}>
              <Clock size={14} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.metaText}>
                {new Date(item.created_at || item.date_creation || '').toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <View style={styles.playButton}>
              <Play size={18} color="#ffffff" fill="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      {!apiService.getServerUrl() ? (
        <>
          <WifiOff size={64} color="#ef4444" />
          <Text style={styles.emptyTitle}>Serveur non configuré</Text>
          <Text style={styles.emptyMessage}>
            Configurez l'URL de votre serveur dans les paramètres.
          </Text>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Settings size={20} color="#ffffff" />
            <Text style={styles.configButtonText}>Configurer</Text>
          </TouchableOpacity>
        </>
      ) : error ? (
        <>
          <AlertCircle size={64} color="#ef4444" />
          <Text style={styles.emptyTitle}>Erreur de chargement</Text>
          <Text style={styles.emptyMessage}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.configButton}
            onPress={loadPresentations}
          >
            <RefreshCw size={20} color="#ffffff" />
            <Text style={styles.configButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Monitor size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>Aucune présentation</Text>
          <Text style={styles.emptyMessage}>
            Aucune présentation disponible sur le serveur.
            Créez des présentations depuis votre plateforme web.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4f46e5', '#7c3aed']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Monitor size={32} color="#ffffff" />
          <Text style={styles.title}>Présentations</Text>
          <Text style={styles.subtitle}>
            {error ? 'Erreur de chargement' : 
             `${presentations.length} présentation${presentations.length > 1 ? 's' : ''} disponible${presentations.length > 1 ? 's' : ''}`}
          </Text>
          {apiService.getServerUrl() && (
            <Text style={styles.serverInfo}>
              Serveur: {apiService.getServerUrl()}
            </Text>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={presentations}
        renderItem={renderPresentationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        numColumns={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    textAlign: 'center',
  },
  serverInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
  },
  listContent: {
    padding: 20,
  },
  presentationItem: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  itemGradient: {
    padding: 24,
    minHeight: 180,
  },
  itemHeader: {
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
  itemContent: {
    flex: 1,
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    lineHeight: 26,
  },
  itemDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
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
  configButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  configButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});