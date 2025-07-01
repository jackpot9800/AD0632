import { apiService, DeviceStatus } from './ApiService';

// Interface pour le service WebSocket
interface WebSocketService {
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnectedToServer(): boolean;
  sendMessage(message: any): boolean;
}

// Implémentation du service WebSocket
class WebSocketServiceImpl implements WebSocketService {
  private ws: WebSocket | null = null;
  private serverUrl: string = '';
  private deviceId: string = '';
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  async connect(): Promise<boolean> {
    try {
      // Récupérer l'URL du serveur et l'ID de l'appareil
      this.serverUrl = apiService.getServerUrl();
      this.deviceId = apiService.getDeviceId();
      
      if (!this.serverUrl || !this.deviceId) {
        console.log('WebSocket: Missing server URL or device ID');
        return false;
      }
      
      // Construire l'URL WebSocket
      const wsBaseUrl = this.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      const wsUrl = `${wsBaseUrl.replace('index.php', 'ws')}?device_id=${this.deviceId}`;
      
      console.log('WebSocket: Connecting to', wsUrl);
      
      // Fermer la connexion existante si elle existe
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      // Créer une nouvelle connexion WebSocket
      this.ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket instance is null'));
          return;
        }
        
        // Gérer l'ouverture de la connexion
        this.ws.onopen = () => {
          console.log('WebSocket: Connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve(true);
        };
        
        // Gérer les erreurs
        this.ws.onerror = (error) => {
          console.error('WebSocket: Error', error);
          this.isConnected = false;
          reject(error);
        };
        
        // Gérer la fermeture de la connexion
        this.ws.onclose = (event) => {
          console.log('WebSocket: Connection closed', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          
          // Tenter de se reconnecter si la fermeture n'est pas volontaire
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch(err => {
                console.error('WebSocket: Reconnection failed', err);
              });
            }, delay);
          }
        };
        
        // Gérer les messages reçus
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket: Message received', message);
            
            // Traiter les différents types de messages
            if (message.type === 'ping') {
              this.sendPong();
            } else if (message.type === 'command') {
              this.handleCommand(message.data);
            }
          } catch (error) {
            console.error('WebSocket: Error parsing message', error);
          }
        };
        
        // Timeout pour la connexion
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket: Connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('WebSocket: Connection error', error);
      this.isConnected = false;
      return false;
    }
  }

  disconnect(): void {
    if (this.ws) {
      console.log('WebSocket: Disconnecting');
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  sendMessage(message: any): boolean {
    if (!this.isConnectedToServer() || !this.ws) {
      console.log('WebSocket: Not connected, cannot send message');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('WebSocket: Error sending message', error);
      return false;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Envoyer un ping toutes les 30 secondes pour maintenir la connexion
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnectedToServer()) {
        this.sendPing();
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendPing(): void {
    this.lastPingTime = Date.now();
    this.sendMessage({
      type: 'ping',
      device_id: this.deviceId,
      timestamp: this.lastPingTime
    });
  }

  private sendPong(): void {
    this.sendMessage({
      type: 'pong',
      device_id: this.deviceId,
      timestamp: Date.now(),
      ping_time: this.lastPingTime
    });
  }

  private handleCommand(command: any): void {
    console.log('WebSocket: Received command', command);
    // Ici, vous pouvez implémenter la logique pour traiter les commandes
    // Par exemple, en utilisant le service de statut pour exécuter la commande
  }
}

// Instance singleton du service WebSocket
let webSocketService: WebSocketService | null = null;

// Fonction pour initialiser le service WebSocket
export async function initWebSocketService(): Promise<boolean> {
  if (!webSocketService) {
    webSocketService = new WebSocketServiceImpl();
  }
  
  return webSocketService.connect();
}

// Fonction pour récupérer l'instance du service WebSocket
export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}

// Fonction pour envoyer le statut via WebSocket
export function sendStatusViaWebSocket(status: any): boolean {
  if (!webSocketService || !webSocketService.isConnectedToServer()) {
    return false;
  }
  
  return webSocketService.sendMessage({
    type: 'status',
    device_id: apiService.getDeviceId(),
    timestamp: Date.now(),
    data: status
  });
}