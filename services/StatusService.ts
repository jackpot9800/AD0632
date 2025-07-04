import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface DeviceStatus {
  device_id: string;
  status: 'online' | 'offline' | 'playing' | 'paused' | 'error';
  current_presentation_id?: number;
  current_presentation_name?: string;
  current_slide_index?: number;
  total_slides?: number;
  is_looping?: boolean;
  auto_play?: boolean;
  last_heartbeat: string;
  uptime_seconds?: number;
  memory_usage?: number;
  battery_level?: number;
  wifi_strength?: number;
  app_version?: string;
  error_message?: string;
  local_ip?: string;
  device_name?: string;
}

export interface RemoteCommand {
  command: 'play' | 'pause' | 'stop' | 'restart' | 'next_slide' | 'prev_slide' | 'goto_slide' | 'assign_presentation' | 'reboot' | 'update_app';
  device_id: string;
  parameters?: {
    slide_index?: number;
    presentation_id?: number;
    auto_play?: boolean;
    loop_mode?: boolean;
  };
}

class StatusService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private commandCheckInterval: NodeJS.Timeout | null = null;
  private currentStatus: DeviceStatus | null = null;
  private onStatusUpdateCallback: ((status: DeviceStatus) => void) | null = null;
  private onRemoteCommandCallback: ((command: RemoteCommand) => void) | null = null;
  private isInPresentationMode: boolean = false;
  private lastHeartbeatTime: number = 0;
  private isInitialized: boolean = false;
  private localIpAddress: string | null = null;
  private deviceName: string | null = null;

  async initialize() {
    // Éviter les initialisations multiples
    if (this.isInitialized) {
      console.log('=== STATUS SERVICE ALREADY INITIALIZED v2.3.0 ===');
      return;
    }
    
    console.log('=== INITIALIZING STATUS SERVICE v2.3.0 ===');
    
    // Récupérer le nom de l'appareil
    try {
      this.deviceName = await AsyncStorage.getItem('device_name') || apiService.getDeviceName();
    } catch (error) {
      console.error('Error getting device name:', error);
      this.deviceName = apiService.getDeviceName();
    }
    
    // Tenter de récupérer l'adresse IP locale
    await this.getLocalIPAddress();
    
    // Démarrer le heartbeat toutes les 60 secondes
    this.startHeartbeat();
    
    // Vérifier les commandes à distance toutes les 20 secondes
    this.startCommandCheck();
    
    this.isInitialized = true;
  }

  /**
   * Tente de récupérer l'adresse IP locale de l'appareil
   */
  private async getLocalIPAddress() {
    try {
      if (Platform.OS !== 'web') {
        // Utiliser NetInfo pour obtenir l'adresse IP locale
        const netInfo = await NetInfo.fetch();
        if (netInfo.type === 'wifi' && netInfo.details) {
          this.localIpAddress = (netInfo.details as any).ipAddress || null;
        }
      }
      
      if (!this.localIpAddress) {
        // Méthode de secours - simuler une adresse IP locale
        this.localIpAddress = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      }
      
      console.log('Local IP address:', this.localIpAddress);
    } catch (error) {
      console.log('Failed to get local IP address:', error);
      this.localIpAddress = null;
    }
  }

  /**
   * Démarre l'envoi périodique du statut au serveur
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;

    // Augmenter l'intervalle à 60 secondes pour éviter complètement les interférences
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Ne pas envoyer de heartbeat si on est en mode présentation et qu'un heartbeat récent a été envoyé
        const now = Date.now();
        if (this.isInPresentationMode && (now - this.lastHeartbeatTime) < 45000) {
          console.log('=== SKIPPING HEARTBEAT - PRESENTATION MODE v2.3.0 ===');
          return;
        }
        
        await this.sendHeartbeat();
      } catch (error) {
        console.log('Heartbeat failed:', error);
      }
    }, 60000); // Augmenté à 60 secondes

    // Envoyer immédiatement le premier heartbeat
    this.sendHeartbeat();
  }

  /**
   * Démarre la vérification des commandes à distance
   */
  private startCommandCheck() {
    if (this.commandCheckInterval) return;

    this.commandCheckInterval = setInterval(async () => {
      try {
        await this.checkForRemoteCommands();
      } catch (error) {
        console.log('Command check failed:', error);
      }
    }, 20000); // Augmenté à 20 secondes
  }

  /**
   * Envoie le statut actuel au serveur
   */
  private async sendHeartbeat() {
    try {
      if (!apiService.isDeviceRegistered()) return;

      console.log('=== SENDING HEARTBEAT v2.3.0 ===');
      console.log('Presentation mode:', this.isInPresentationMode);
      
      const status = await this.getCurrentStatus();
      
      // Utiliser un timeout plus court pour éviter de bloquer l'interface
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 secondes max
      
      const response = await fetch(`${apiService.getServerUrl()}/appareil/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': apiService.getDeviceId(),
        },
        body: JSON.stringify(status),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.lastHeartbeatTime = Date.now();

      if (response.ok) {
        console.log('Heartbeat sent successfully v2.3.0');
      } else {
        console.log('Heartbeat failed with status:', response.status);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Heartbeat timeout - continuing without blocking v2.3.0');
      } else {
        console.log('Failed to send heartbeat:', error);
      }
    }
  }

  /**
   * Vérifie s'il y a des commandes à distance en attente
   */
  private async checkForRemoteCommands() {
    try {
      if (!apiService.isDeviceRegistered()) return;

      // Utiliser un timeout plus court pour les commandes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes max

      const response = await fetch(`${apiService.getServerUrl()}/appareil/commandes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': apiService.getDeviceId(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.commands && data.commands.length > 0) {
          for (const command of data.commands) {
            await this.executeRemoteCommand(command);
            await this.acknowledgeCommand(command.id);
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Command check timeout - continuing v2.3.0');
      } else {
        console.log('Failed to check for remote commands:', error);
      }
    }
  }

  /**
   * Exécute une commande à distance
   */
  private async executeRemoteCommand(command: RemoteCommand) {
    console.log('=== EXECUTING REMOTE COMMAND v2.3.0 ===', command);

    if (this.onRemoteCommandCallback) {
      this.onRemoteCommandCallback(command);
    }

    // Mettre à jour le statut après l'exécution
    setTimeout(() => {
      this.updateStatus({ status: 'online' });
    }, 1000);
  }

  /**
   * Confirme l'exécution d'une commande
   */
  private async acknowledgeCommand(commandId: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(`${apiService.getServerUrl()}/appareil/commandes/${commandId}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': apiService.getDeviceId(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.log('Failed to acknowledge command:', error);
      }
    }
  }

  /**
   * Récupère le statut actuel de l'appareil
   */
  private async getCurrentStatus(): Promise<DeviceStatus> {
    const deviceId = apiService.getDeviceId();
    const appVersion = '2.3.0';
    
    // Récupérer les informations système (simulées pour l'exemple)
    const systemInfo = await this.getSystemInfo();

    const status: DeviceStatus = {
      device_id: deviceId,
      device_name: this.deviceName || apiService.getDeviceName() || `Fire TV ${deviceId.substring(deviceId.length - 6)}`,
      status: this.currentStatus?.status || 'online',
      current_presentation_id: this.currentStatus?.current_presentation_id,
      current_presentation_name: this.currentStatus?.current_presentation_name,
      current_slide_index: this.currentStatus?.current_slide_index,
      total_slides: this.currentStatus?.total_slides,
      is_looping: this.currentStatus?.is_looping,
      auto_play: this.currentStatus?.auto_play,
      last_heartbeat: new Date().toISOString(),
      uptime_seconds: systemInfo.uptime,
      memory_usage: systemInfo.memoryUsage,
      wifi_strength: systemInfo.wifiStrength,
      app_version: appVersion,
      error_message: this.currentStatus?.error_message,
      local_ip: this.localIpAddress,
    };

    return status;
  }

  /**
   * Récupère les informations système
   */
  private async getSystemInfo() {
    // Simulation des informations système
    return {
      uptime: Math.floor(Date.now() / 1000),
      memoryUsage: Math.floor(Math.random() * 100),
      wifiStrength: Math.floor(Math.random() * 100),
    };
  }

  /**
   * Active le mode présentation (réduit la fréquence des heartbeats)
   */
  setPresentationMode(isActive: boolean) {
    console.log('=== SETTING PRESENTATION MODE v2.3.0 ===', isActive);
    this.isInPresentationMode = isActive;
    
    if (isActive) {
      // En mode présentation, envoyer un heartbeat immédiat puis réduire la fréquence
      this.sendHeartbeat();
    }
  }

  /**
   * Met à jour le statut de l'appareil
   */
  updateStatus(updates: Partial<DeviceStatus>) {
    this.currentStatus = {
      ...this.currentStatus,
      ...updates,
      device_id: apiService.getDeviceId(),
      last_heartbeat: new Date().toISOString(),
    } as DeviceStatus;

    console.log('Status updated v2.3.0:', this.currentStatus);

    if (this.onStatusUpdateCallback) {
      this.onStatusUpdateCallback(this.currentStatus);
    }
  }

  /**
   * Met à jour le statut de la présentation en cours
   */
  updatePresentationStatus(presentationId: number, presentationName: string, slideIndex: number, totalSlides: number, isLooping: boolean, autoPlay: boolean) {
    this.updateStatus({
      status: 'playing',
      current_presentation_id: presentationId,
      current_presentation_name: presentationName,
      current_slide_index: slideIndex,
      total_slides: totalSlides,
      is_looping: isLooping,
      auto_play: autoPlay,
    });
  }

  /**
   * Met à jour le statut de lecture
   */
  updatePlaybackStatus(status: 'playing' | 'paused' | 'stopped') {
    this.updateStatus({ status });
    
    // Activer/désactiver le mode présentation selon le statut
    this.setPresentationMode(status === 'playing');
  }

  /**
   * Signale une erreur
   */
  reportError(errorMessage: string) {
    this.updateStatus({
      status: 'error',
      error_message: errorMessage,
    });
  }

  /**
   * Définit le callback pour les mises à jour de statut
   */
  setOnStatusUpdate(callback: (status: DeviceStatus) => void) {
    this.onStatusUpdateCallback = callback;
  }

  /**
   * Définit le callback pour les commandes à distance
   */
  setOnRemoteCommand(callback: (command: RemoteCommand) => void) {
    this.onRemoteCommandCallback = callback;
  }

  /**
   * Arrête le service
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
      this.commandCheckInterval = null;
    }

    this.setPresentationMode(false);
    this.updateStatus({ status: 'offline' });
    this.isInitialized = false;
  }

  /**
   * Récupère le statut actuel
   */
  getCurrentStatusSync(): DeviceStatus | null {
    return this.currentStatus;
  }
}

export const statusService = new StatusService();