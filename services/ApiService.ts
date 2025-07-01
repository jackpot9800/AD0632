import AsyncStorage from '@react-native-async-storage/async-storage';

// Définition des clés de stockage
const STORAGE_KEYS = {
  SERVER_URL: 'server_url',
  DEVICE_ID: 'device_id',
  DEVICE_REGISTERED: 'device_registered',
  ENROLLMENT_TOKEN: 'enrollment_token',
  ASSIGNED_PRESENTATION: 'assigned_presentation',
  DEFAULT_PRESENTATION: 'default_presentation',
};

export interface Presentation {
  id: number;
  name?: string;
  nom?: string; // Support pour l'API affichageDynamique
  description: string;
  created_at?: string;
  date_creation?: string; // Support pour l'API affichageDynamique
  slide_count: number;
  preview_url: string;
}

export interface Slide {
  id: number;
  name: string;
  title?: string;
  image_path: string;
  media_path?: string;
  image_url: string;
  duration: number;
  transition_type: string;
}

export interface PresentationDetails extends Presentation {
  slides: Slide[];
}

export interface ApiResponse<T> {
  presentations?: T;
  presentation?: T;
  assigned_presentation?: T;
  default_presentation?: T;
  success?: boolean;
  message?: string;
  device_id?: string;
  token?: string;
}

export interface DeviceRegistration {
  device_id: string;
  name: string;
  type: string;
  platform: string;
  user_agent: string;
  capabilities: string[];
}

export interface AssignedPresentation {
  id: number;
  presentation_id: number;
  presentation_name: string;
  presentation_description: string;
  auto_play: boolean;
  loop_mode: boolean;
  start_time?: string;
  end_time?: string;
  created_at: string;
}

export interface DefaultPresentation {
  presentation_id: number;
  presentation_name: string;
  presentation_description: string;
  slide_count?: number;
  is_default: boolean;
}

class ApiService {
  private baseUrl: string = '';
  private deviceId: string = '';
  private isRegistered: boolean = false;
  private enrollmentToken: string = '';
  private assignmentCheckInterval: NodeJS.Timeout | null = null;
  private defaultCheckInterval: NodeJS.Timeout | null = null;
  private onAssignedPresentationCallback: ((presentation: AssignedPresentation) => void) | null = null;
  private onDefaultPresentationCallback: ((presentation: DefaultPresentation) => void) | null = null;
  private assignmentCheckEnabled: boolean = false;
  private defaultCheckEnabled: boolean = false;
  private apiType: 'standard' | 'affichageDynamique' = 'affichageDynamique';
  private lastConnectionError: string = '';
  private connectionAttempts: number = 0;

  async initialize() {
    try {
      console.log('=== INITIALIZING API SERVICE v2.4.0 ===');
      
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      const savedDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      const savedRegistration = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_REGISTERED);
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.ENROLLMENT_TOKEN);
      
      if (savedUrl) {
        this.baseUrl = savedUrl;
        console.log('Loaded server URL:', this.baseUrl);
      }
      
      if (savedDeviceId) {
        this.deviceId = savedDeviceId;
        console.log('Loaded device ID:', this.deviceId);
      } else {
        this.deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, this.deviceId);
        console.log('Generated new device ID:', this.deviceId);
      }

      if (savedRegistration === 'true') {
        this.isRegistered = true;
        console.log('Device is already registered');
      }

      if (savedToken) {
        this.enrollmentToken = savedToken;
        console.log('Loaded enrollment token');
      }

      console.log('=== API SERVICE INITIALIZED v2.4.0 ===');
      
    } catch (error) {
      console.error('Error initializing API service:', error);
    }
  }

  private generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `firetv_${timestamp}_${random}`;
  }

  /**
   * Détecte automatiquement le type d'API utilisé
   */
  private async detectApiType(): Promise<void> {
    try {
      console.log('=== DETECTING API TYPE ===');
      
      const response = await this.makeRequest<any>('/version');
      
      if (response.database === 'affichageDynamique') {
        this.apiType = 'affichageDynamique';
        console.log('✅ Detected affichageDynamique API');
      } else {
        this.apiType = 'standard';
        console.log('✅ Detected standard API');
      }
    } catch (error) {
      console.log('⚠️ Could not detect API type, using affichageDynamique by default');
      this.apiType = 'affichageDynamique';
    }
  }

  /**
   * Retourne l'endpoint correct selon le type d'API
   */
  private getEndpoint(endpoint: string): string {
    if (this.apiType === 'affichageDynamique') {
      const endpointMapping: { [key: string]: string } = {
        '/device/register': '/appareil/enregistrer',
        '/device/assigned-presentation': '/appareil/presentation-assignee',
        '/device/default-presentation': '/appareil/presentation-defaut',
        '/device/presentation': '/appareil/presentation',
        '/presentations': '/presentations',
        '/presentation': '/presentation',
        '/version': '/version'
      };

      if (endpoint.startsWith('/presentation/') && endpoint.match(/\/presentation\/\d+$/)) {
        return endpoint;
      }

      return endpointMapping[endpoint] || endpoint;
    }
    
    return endpoint;
  }

  /**
   * SOLUTION DÉFINITIVE v2.4.0: Démarre la vérification périodique des présentations assignées
   * Fréquence: toutes les 5 secondes pour une réactivité optimale
   */
  async startAssignmentCheck(callback?: (presentation: AssignedPresentation) => void) {
    if (!this.baseUrl || !this.isRegistered) {
      console.log('Cannot start assignment check: not configured or not registered');
      return;
    }

    await this.detectApiType();

    console.log('=== STARTING ASSIGNMENT CHECK v2.4.0 ===');
    console.log('API Type:', this.apiType);

    if (this.apiType === 'affichageDynamique') {
      console.log('✅ Enabling assignment check for affichageDynamique API');
      this.assignmentCheckEnabled = true;
    } else {
      console.log('=== CHECKING IF ASSIGNMENT ENDPOINT EXISTS (Standard API) ===');
      try {
        const testResponse = await this.makeRequest<any>('/version');
        const assignmentEndpoint = this.getEndpoint('/device/assigned-presentation');
        
        if (testResponse.endpoints && testResponse.endpoints[`GET ${assignmentEndpoint}`]) {
          console.log('✅ Assignment endpoint is available');
          this.assignmentCheckEnabled = true;
        } else {
          console.log('⚠️ Assignment endpoint not available in this API version');
          this.assignmentCheckEnabled = false;
          return;
        }
      } catch (error) {
        console.log('⚠️ Could not verify endpoint availability, disabling assignment check');
        this.assignmentCheckEnabled = false;
        return;
      }
    }

    this.onAssignedPresentationCallback = callback || null;

    // Vérification immédiate au démarrage
    this.checkForAssignedPresentation();

    // SOLUTION DÉFINITIVE v2.4.0: Surveillance toutes les 5 secondes pour une réactivité optimale
    this.assignmentCheckInterval = setInterval(async () => {
      try {
        await this.checkForAssignedPresentation();
      } catch (error) {
        console.log('Assignment check failed:', error);
      }
    }, 5000); // 5 secondes

    console.log('✅ Assignment check started with 5s interval');
  }

  /**
   * SOLUTION DÉFINITIVE v2.4.0: Démarre la vérification périodique des présentations par défaut
   * Fréquence: toutes les 5 secondes pour détecter rapidement les changements
   */
  async startDefaultPresentationCheck(callback?: (presentation: DefaultPresentation) => void) {
    if (!this.baseUrl || !this.isRegistered) {
      console.log('Cannot start default presentation check: not configured or not registered');
      return;
    }

    await this.detectApiType();

    console.log('=== STARTING DEFAULT PRESENTATION CHECK v2.4.0 ===');
    console.log('API Type:', this.apiType);

    if (this.apiType === 'affichageDynamique') {
      console.log('✅ Enabling default presentation check for affichageDynamique API');
      this.defaultCheckEnabled = true;
    } else {
      console.log('=== CHECKING IF DEFAULT PRESENTATION ENDPOINT EXISTS (Standard API) ===');
      try {
        const testResponse = await this.makeRequest<any>('/version');
        const defaultEndpoint = this.getEndpoint('/device/default-presentation');
        
        if (testResponse.endpoints && testResponse.endpoints[`GET ${defaultEndpoint}`]) {
          console.log('✅ Default presentation endpoint is available');
          this.defaultCheckEnabled = true;
        } else {
          console.log('⚠️ Default presentation endpoint not available in this API version');
          this.defaultCheckEnabled = false;
          return;
        }
      } catch (error) {
        console.log('⚠️ Could not verify endpoint availability, disabling default presentation check');
        this.defaultCheckEnabled = false;
        return;
      }
    }

    this.onDefaultPresentationCallback = callback || null;

    // SOLUTION DÉFINITIVE v2.4.0: Vérification immédiate au démarrage - PAS dans l'intervalle
    // Cette vérification immédiate est cruciale pour le lancement automatique
    console.log('=== IMMEDIATE DEFAULT PRESENTATION CHECK v2.4.0 ===');
    this.checkForDefaultPresentation();

    // SOLUTION DÉFINITIVE v2.4.0: Surveillance toutes les 5 secondes pour détecter les changements
    this.defaultCheckInterval = setInterval(async () => {
      try {
        await this.checkForDefaultPresentation();
      } catch (error) {
        console.log('Default presentation check failed:', error);
      }
    }, 5000); // 5 secondes - MÊME FRÉQUENCE pour synchronisation

    console.log('✅ Default presentation check started with 5s interval');
  }

  /**
   * Arrête la vérification des présentations assignées
   */
  stopAssignmentCheck() {
    if (this.assignmentCheckInterval) {
      clearInterval(this.assignmentCheckInterval);
      this.assignmentCheckInterval = null;
      console.log('Assignment check stopped');
    }
    this.assignmentCheckEnabled = false;
  }

  /**
   * Arrête la vérification des présentations par défaut
   */
  stopDefaultPresentationCheck() {
    if (this.defaultCheckInterval) {
      clearInterval(this.defaultCheckInterval);
      this.defaultCheckInterval = null;
      console.log('Default presentation check stopped');
    }
    this.defaultCheckEnabled = false;
  }

  /**
   * Vérifie s'il y a une présentation assignée à cet appareil
   */
  async checkForAssignedPresentation(): Promise<AssignedPresentation | null> {
    try {
      if (!this.baseUrl || !this.isRegistered || !this.assignmentCheckEnabled) {
        console.log('Assignment check disabled or not ready');
        return null;
      }

      console.log('=== CHECKING FOR ASSIGNED PRESENTATION v2.4.0 ===');
      const endpoint = this.getEndpoint('/device/assigned-presentation');
      console.log('Using endpoint:', endpoint);
      
      const response = await this.makeRequest<ApiResponse<AssignedPresentation>>(endpoint);
      const assignedPresentation = response.assigned_presentation;

      if (assignedPresentation) {
        console.log('✅ Found assigned presentation:', {
          presentation_id: assignedPresentation.presentation_id,
          auto_play: assignedPresentation.auto_play,
          loop_mode: assignedPresentation.loop_mode
        });
        
        await AsyncStorage.setItem(STORAGE_KEYS.ASSIGNED_PRESENTATION, JSON.stringify(assignedPresentation));
        
        if (this.onAssignedPresentationCallback) {
          this.onAssignedPresentationCallback(assignedPresentation);
        }
        
        return assignedPresentation;
      } else {
        console.log('No assigned presentation found');
        await AsyncStorage.removeItem(STORAGE_KEYS.ASSIGNED_PRESENTATION);
        return null;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Endpoint not found') || error.message.includes('404')) {
          console.log('⚠️ Assignment endpoint not available on this server version - disabling assignment check');
          this.assignmentCheckEnabled = false;
          this.stopAssignmentCheck();
          return null;
        }
      }
      
      console.log('Assignment check failed:', error);
      return null;
    }
  }

  /**
   * SOLUTION DÉFINITIVE v2.4.0: Vérifie s'il y a une présentation par défaut pour cet appareil
   * AVEC DEBUG COMPLET et VALIDATION STRICTE RENFORCÉE
   */
  async checkForDefaultPresentation(): Promise<DefaultPresentation | null> {
    try {
      if (!this.baseUrl || !this.isRegistered || !this.defaultCheckEnabled) {
        console.log('❌ Default presentation check disabled or not ready');
        console.log('Debug info:', {
          hasBaseUrl: !!this.baseUrl,
          isRegistered: this.isRegistered,
          defaultCheckEnabled: this.defaultCheckEnabled
        });
        return null;
      }

      console.log('=== CHECKING FOR DEFAULT PRESENTATION v2.4.0 DEBUG COMPLET ===');
      const endpoint = this.getEndpoint('/device/default-presentation');
      console.log('Using endpoint:', endpoint);
      console.log('Device ID:', this.deviceId);
      console.log('Base URL:', this.baseUrl);
      console.log('Full URL will be:', `${this.baseUrl}${endpoint}`);
      
      const response = await this.makeRequest<ApiResponse<DefaultPresentation>>(endpoint);
      
      console.log('=== DEFAULT PRESENTATION RESPONSE v2.4.0 DEBUG ===');
      console.log('Full response:', JSON.stringify(response, null, 2));
      
      const defaultPresentation = response.default_presentation;
      console.log('Extracted default_presentation:', JSON.stringify(defaultPresentation, null, 2));

      // SOLUTION DÉFINITIVE v2.4.0: VALIDATION STRICTE RENFORCÉE AVEC DEBUG COMPLET
      console.log('=== VALIDATION STRICTE v2.4.0 ===');
      console.log('Step 1 - defaultPresentation exists:', !!defaultPresentation);
      console.log('Step 2 - presentation_id exists:', !!(defaultPresentation?.presentation_id));
      console.log('Step 3 - presentation_id value:', defaultPresentation?.presentation_id);
      console.log('Step 4 - presentation_id > 0:', (defaultPresentation?.presentation_id || 0) > 0);
      console.log('Step 5 - presentation_name exists:', !!(defaultPresentation?.presentation_name));
      console.log('Step 6 - presentation_name value:', `"${defaultPresentation?.presentation_name}"`);
      console.log('Step 7 - presentation_name trimmed:', `"${defaultPresentation?.presentation_name?.trim()}"`);
      console.log('Step 8 - presentation_name not empty after trim:', !!(defaultPresentation?.presentation_name?.trim()));
      console.log('Step 9 - presentation_name length > 0:', (defaultPresentation?.presentation_name?.trim()?.length || 0) > 0);

      if (defaultPresentation && 
          defaultPresentation.presentation_id && 
          defaultPresentation.presentation_id > 0 && // VALIDATION CRITIQUE: ID > 0
          defaultPresentation.presentation_name &&
          defaultPresentation.presentation_name.trim() !== '' &&
          defaultPresentation.presentation_name.trim().length > 0) { // VALIDATION CRITIQUE: Nom non vide
        
        console.log('✅ ✅ ✅ FOUND VALID DEFAULT PRESENTATION v2.4.0 ✅ ✅ ✅');
        console.log('VALID DEFAULT PRESENTATION DETAILS:', {
          presentation_id: defaultPresentation.presentation_id,
          presentation_name: defaultPresentation.presentation_name,
          name_length: defaultPresentation.presentation_name.trim().length,
          is_default: defaultPresentation.is_default,
          slide_count: defaultPresentation.slide_count
        });
        
        await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_PRESENTATION, JSON.stringify(defaultPresentation));
        
        // SOLUTION DÉFINITIVE v2.4.0: Appeler le callback IMMÉDIATEMENT
        if (this.onDefaultPresentationCallback) {
          console.log('=== CALLING DEFAULT PRESENTATION CALLBACK v2.4.0 ===');
          this.onDefaultPresentationCallback(defaultPresentation);
        } else {
          console.log('⚠️ NO CALLBACK REGISTERED FOR DEFAULT PRESENTATION');
        }
        
        return defaultPresentation;
      } else {
        console.log('❌ ❌ ❌ NO VALID DEFAULT PRESENTATION FOUND v2.4.0 ❌ ❌ ❌');
        console.log('VALIDATION FAILURE DETAILS:');
        console.log('- defaultPresentation exists:', !!defaultPresentation);
        console.log('- presentation_id exists:', !!(defaultPresentation?.presentation_id));
        console.log('- presentation_id value:', defaultPresentation?.presentation_id);
        console.log('- presentation_id > 0:', (defaultPresentation?.presentation_id || 0) > 0);
        console.log('- presentation_name exists:', !!(defaultPresentation?.presentation_name));
        console.log('- presentation_name value:', `"${defaultPresentation?.presentation_name}"`);
        console.log('- presentation_name not empty:', !!(defaultPresentation?.presentation_name?.trim()));
        console.log('- presentation_name length > 0:', (defaultPresentation?.presentation_name?.trim()?.length || 0) > 0);
        
        // Supprimer la présentation par défaut locale si elle n'est plus valide
        await AsyncStorage.removeItem(STORAGE_KEYS.DEFAULT_PRESENTATION);
        return null;
      }
      
    } catch (error) {
      console.error('❌ ERROR IN DEFAULT PRESENTATION CHECK v2.4.0:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.message.includes('Endpoint not found') || error.message.includes('404')) {
          console.log('⚠️ Default presentation endpoint not available on this server version - disabling default presentation check');
          this.defaultCheckEnabled = false;
          this.stopDefaultPresentationCheck();
          return null;
        }
      }
      
      console.log('Default presentation check failed:', error);
      return null;
    }
  }

  /**
   * Récupère l'assignation en cours localement
   */
  async getLocalAssignedPresentation(): Promise<AssignedPresentation | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ASSIGNED_PRESENTATION);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting local assigned presentation:', error);
      return null;
    }
  }

  /**
   * Récupère la présentation par défaut localement
   */
  async getLocalDefaultPresentation(): Promise<DefaultPresentation | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_PRESENTATION);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting local default presentation:', error);
      return null;
    }
  }

  /**
   * Marque une présentation assignée comme vue
   */
  async markAssignedPresentationAsViewed(presentationId: number): Promise<boolean> {
    try {
      if (!this.assignmentCheckEnabled) {
        console.log('Assignment features not available');
        return false;
      }
      
      const endpoint = `/appareil/presentation/${presentationId}/vue`;
      const response = await this.makeRequest<{ success: boolean }>(endpoint, {
        method: 'POST',
      });
      return response.success || false;
    } catch (error) {
      console.log('Error marking presentation as viewed (endpoint may not exist):', error);
      return false;
    }
  }

  async setServerUrl(url: string): Promise<boolean> {
    try {
      console.log('=== SETTING SERVER URL v2.4.0 ===');
      console.log('Input URL:', url);
      
      let cleanUrl = url.replace(/\/+$/, '');
      
      if (!cleanUrl.endsWith('index.php')) {
        if (!cleanUrl.endsWith('/')) {
          cleanUrl += '/';
        }
        cleanUrl += 'index.php';
      }
      
      console.log('Clean URL:', cleanUrl);
      
      this.baseUrl = cleanUrl;
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
      
      this.isRegistered = false;
      this.enrollmentToken = '';
      this.assignmentCheckEnabled = false;
      this.defaultCheckEnabled = false;
      this.apiType = 'affichageDynamique';
      this.lastConnectionError = '';
      this.connectionAttempts = 0;
      
      await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_REGISTERED);
      await AsyncStorage.removeItem(STORAGE_KEYS.ENROLLMENT_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.ASSIGNED_PRESENTATION);
      await AsyncStorage.removeItem(STORAGE_KEYS.DEFAULT_PRESENTATION);
      
      this.stopAssignmentCheck();
      this.stopDefaultPresentationCheck();
      
      await this.detectApiType();
      
      const connectionOk = await this.testConnection();
      if (connectionOk) {
        const registrationOk = await this.registerDevice();
        if (registrationOk) {
          console.log('=== SERVER SETUP COMPLETE v2.4.0 ===');
          return true;
        } else {
          console.warn('Connection OK but registration failed');
          return true;
        }
      }
      
      console.error('Connection test failed');
      return false;
    } catch (error) {
      console.error('Error setting server URL:', error);
      return false;
    }
  }

  getServerUrl(): string {
    return this.baseUrl;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isDeviceRegistered(): boolean {
    return this.isRegistered;
  }
  
  getLastConnectionError(): string {
    return this.lastConnectionError;
  }

  private getBaseServerUrl(): string {
    if (!this.baseUrl) return '';
    
    console.log('=== BUILDING BASE SERVER URL ===');
    console.log('Original baseUrl:', this.baseUrl);
    
    let baseServerUrl = this.baseUrl;
    
    if (baseServerUrl.includes('/api/index.php')) {
      baseServerUrl = baseServerUrl.replace('/api/index.php', '');
    }
    else if (baseServerUrl.includes('/index.php')) {
      baseServerUrl = baseServerUrl.replace('/index.php', '');
    }
    
    console.log('Base server URL for images:', baseServerUrl);
    return baseServerUrl;
  }

  private cleanPhpResponse(responseText: string): string {
    console.log('=== CLEANING PHP RESPONSE ===');
    console.log('Original length:', responseText.length);
    console.log('First 500 chars:', responseText.substring(0, 500));
    
    let cleanedResponse = responseText.trim();
    
    const jsonMatches = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatches && jsonMatches.length > 0) {
      const potentialJson = jsonMatches[0];
      try {
        JSON.parse(potentialJson);
        console.log('Found valid JSON in response');
        return potentialJson;
      } catch (e) {
        console.log('Found JSON-like text but invalid JSON, continuing with cleaning...');
      }
    }
    
    const phpErrorPatterns = [
      /<br\s*\/?>\s*<b>Warning<\/b>:.*?<br\s*\/?>/gi,
      /<br\s*\/?>\s*<b>Notice<\/b>:.*?<br\s*\/?>/gi,
      /<br\s*\/?>\s*<b>Fatal error<\/b>:.*?<br\s*\/?>/gi,
      /<br\s*\/?>\s*<b>Parse error<\/b>:.*?<br\s*\/?>/gi,
      /Warning:.*?in.*?on line.*?\n/gi,
      /Notice:.*?in.*?on line.*?\n/gi,
      /Fatal error:.*?in.*?on line.*?\n/gi,
      /Parse error:.*?in.*?on line.*?\n/gi,
      /<br\s*\/?>\s*<b>[^<]*<\/b>:\s*[^<]*<br\s*\/?>/gi,
      /(<br\s*\/?>){2,}/gi,
    ];
    
    let foundErrors = [];
    
    phpErrorPatterns.forEach((pattern, index) => {
      const matches = cleanedResponse.match(pattern);
      if (matches) {
        foundErrors.push(`Pattern ${index + 1}: ${matches.length} matches`);
        cleanedResponse = cleanedResponse.replace(pattern, '');
      }
    });
    
    cleanedResponse = cleanedResponse
      .replace(/^(\s*<br\s*\/?>)+/gi, '')
      .replace(/(\s*<br\s*\/?>)+$/gi, '')
      .trim();
    
    if (foundErrors.length > 0) {
      console.log('=== PHP ERRORS CLEANED ===');
      console.log('Errors found and removed:', foundErrors);
    }
    
    return cleanedResponse;
  }

  private extractJsonFromResponse(responseText: string): any {
    console.log('=== EXTRACTING JSON FROM RESPONSE ===');
    
    let cleanedResponse = this.cleanPhpResponse(responseText);
    
    if (!cleanedResponse.trim()) {
      throw new Error('Réponse vide après suppression des erreurs PHP');
    }
    
    if (cleanedResponse.includes('<!DOCTYPE') || cleanedResponse.includes('<html')) {
      console.error('Response is a full HTML page:', cleanedResponse.substring(0, 200));
      
      if (cleanedResponse.includes('404') || cleanedResponse.includes('Not Found')) {
        throw new Error('Endpoint non trouvé (404). Vérifiez que votre API est correctement configurée.');
      } else if (cleanedResponse.includes('500') || cleanedResponse.includes('Internal Server Error')) {
        throw new Error('Erreur serveur interne (500). Vérifiez les logs PHP de votre serveur.');
      } else if (cleanedResponse.includes('403') || cleanedResponse.includes('Forbidden')) {
        throw new Error('Accès interdit (403). Vérifiez les permissions de votre serveur.');
      } else {
        throw new Error('Le serveur a retourné une page HTML au lieu de JSON.');
      }
    }
    
    if (cleanedResponse.trim().startsWith('<')) {
      console.error('Still HTML after cleaning:', cleanedResponse.substring(0, 300));
      throw new Error('La réponse contient encore du HTML après nettoyage.');
    }
    
    try {
      const jsonData = JSON.parse(cleanedResponse);
      console.log('=== JSON PARSED SUCCESSFULLY ===');
      console.log('Data keys:', Object.keys(jsonData));
      return jsonData;
    } catch (parseError) {
      console.error('=== JSON PARSE ERROR ===');
      console.error('Parse error:', parseError);
      console.error('Cleaned response:', cleanedResponse.substring(0, 500));
      
      let errorHint = '';
      if (cleanedResponse.includes('<?php')) {
        errorHint = '\n\nIl semble que le code PHP ne soit pas exécuté.';
      } else if (cleanedResponse.includes('Endpoint not found')) {
        errorHint = '\n\nL\'endpoint demandé n\'existe pas.';
      } else if (cleanedResponse.includes('Database')) {
        errorHint = '\n\nErreur de base de données.';
      }
      
      throw new Error(`Réponse du serveur invalide${errorHint}\n\nRéponse: ${cleanedResponse.substring(0, 200)}...`);
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout après ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
    const enhancedOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    };

    const fetchPromise = fetch(url, enhancedOptions);
    const timeoutPromise = this.createTimeoutPromise(timeoutMs);
    
    return Promise.race([fetchPromise, timeoutPromise]);
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('URL du serveur non configurée');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const finalEndpoint = this.getEndpoint(cleanEndpoint);
    const url = `${this.baseUrl}${finalEndpoint}`;
    
    console.log('=== API REQUEST v2.4.0 ===');
    console.log('Original endpoint:', cleanEndpoint);
    console.log('Final endpoint:', finalEndpoint);
    console.log('URL:', url);
    console.log('Method:', options.method || 'GET');
    console.log('Device ID:', this.deviceId);
    console.log('API Type:', this.apiType);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'User-Agent': 'PresentationKiosk/2.4.0 (Android; FireTV)',
      'X-Device-ID': this.deviceId,
      'X-Device-Type': 'firetv',
      'X-App-Version': '2.4.0',
      'X-Platform': 'android',
      'Connection': 'keep-alive',
      ...options.headers,
    };

    if (this.enrollmentToken) {
      headers['X-Enrollment-Token'] = this.enrollmentToken;
    }

    if (this.isRegistered) {
      headers['X-Device-Registered'] = 'true';
    }
    
    try {
      this.connectionAttempts++;
      console.log(`Connection attempt #${this.connectionAttempts} to ${url}`);
      
      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers,
      }, 30000);

      console.log('=== API RESPONSE ===');
      console.log('Status:', response.status, response.statusText);

      const responseText = await response.text();
      console.log('=== RAW RESPONSE ===');
      console.log('Length:', responseText.length);
      console.log('First 1000 chars:', responseText.substring(0, 1000));

      if (!response.ok) {
        console.error('=== HTTP ERROR ===');
        console.error('Status:', response.status);
        console.error('Response:', responseText);
        
        this.lastConnectionError = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
        
        if (response.status === 500) {
          throw new Error('Erreur serveur interne (500). Vérifiez les logs PHP de votre serveur.');
        } else if (response.status === 404) {
          try {
            const errorData = this.extractJsonFromResponse(responseText);
            if (errorData.available_endpoints) {
              const endpointsList = Object.keys(errorData.available_endpoints).join(', ');
              throw new Error(`Endpoint non trouvé: ${finalEndpoint}\n\nEndpoints disponibles: ${endpointsList}`);
            }
          } catch (parseError) {
            // Si on ne peut pas parser le JSON d'erreur, utiliser un message générique
          }
          throw new Error(`Endpoint non trouvé: ${url}`);
        } else {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }
      }

      if (!responseText.trim()) {
        this.lastConnectionError = "Réponse vide du serveur";
        throw new Error('Réponse vide du serveur');
      }

      this.connectionAttempts = 0;
      this.lastConnectionError = '';
      
      return this.extractJsonFromResponse(responseText);

    } catch (error) {
      if (error instanceof Error) {
        this.lastConnectionError = error.message;
        
        if (error.message.includes('Timeout après')) {
          throw new Error(`Timeout de connexion: ${url}`);
        } else if (error.message.includes('fetch') || error.message.includes('Network')) {
          throw new Error(`Impossible de se connecter au serveur: ${url}\n\nVérifiez que votre appareil est connecté au même réseau que le serveur.`);
        }
      } else {
        this.lastConnectionError = "Erreur inconnue";
      }
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('=== TESTING CONNECTION v2.4.0 ===');
      console.log('Testing URL:', this.baseUrl);
      
      if (!this.baseUrl) {
        console.log('No server URL configured');
        return false;
      }
      
      try {
        const response = await this.makeRequest<any>('/version');
        console.log('Connection test response:', response);
        
        const isConnected = response.status === 'running' || 
                          response.api_status === 'running' || 
                          response.version !== undefined ||
                          response.database === 'affichageDynamique';
        
        console.log('Connection test result:', isConnected);
        
        if (isConnected) {
          await this.detectApiType();
          return true;
        }
      } catch (error) {
        console.log('First connection test failed, trying root endpoint...');
      }
      
      try {
        const response = await this.makeRequest<any>('');
        console.log('Root endpoint test response:', response);
        
        const isConnected = response.status === 'running' || 
                          response.api_status === 'running' || 
                          response.version !== undefined ||
                          response.database === 'affichageDynamique' ||
                          response.endpoints !== undefined;
        
        console.log('Root endpoint test result:', isConnected);
        
        if (isConnected) {
          await this.detectApiType();
          return true;
        }
      } catch (error) {
        console.error('Both connection tests failed:', error);
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async registerDevice(): Promise<boolean> {
    try {
      console.log('=== REGISTERING DEVICE v2.4.0 ===');
      console.log('Device ID:', this.deviceId);
      console.log('Server URL:', this.baseUrl);
      console.log('API Type:', this.apiType);
      
      const deviceInfo: DeviceRegistration = {
        device_id: this.deviceId,
        name: `Fire TV Stick - ${this.deviceId.split('_').pop()}`,
        type: 'firetv',
        platform: 'android',
        user_agent: 'PresentationKiosk/2.4.0 (Android; FireTV)',
        capabilities: [
          'video_playback',
          'image_display',
          'remote_control',
          'presentation_mode',
          'fullscreen',
          'auto_play',
          'loop_mode'
        ]
      };

      console.log('=== DEVICE INFO TO REGISTER ===');
      console.log('Device info:', deviceInfo);

      const endpoint = this.getEndpoint('/device/register');
      console.log('Using registration endpoint:', endpoint);

      const response = await this.makeRequest<ApiResponse<any>>(endpoint, {
        method: 'POST',
        body: JSON.stringify(deviceInfo),
      });

      console.log('=== REGISTRATION RESPONSE ===');
      console.log('Response:', response);

      if (response.success !== false) {
        this.isRegistered = true;
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_REGISTERED, 'true');
        
        if (response.token) {
          this.enrollmentToken = response.token;
          await AsyncStorage.setItem(STORAGE_KEYS.ENROLLMENT_TOKEN, response.token);
        }

        console.log('=== DEVICE REGISTERED SUCCESSFULLY v2.4.0 ===');
        console.log('Device ID:', this.deviceId);
        console.log('Token:', response.token);
        return true;
      } else {
        console.warn('Registration failed:', response.message);
        throw new Error(response.message || 'L\'enregistrement a échoué');
      }
    } catch (error) {
      console.error('=== DEVICE REGISTRATION FAILED ===');
      console.error('Error details:', error);
      
      if (error instanceof Error && error.message.includes('Endpoint not found')) {
        console.log('Registration endpoint not available - continuing without registration');
        this.isRegistered = true;
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_REGISTERED, 'true');
        return true;
      }
      
      throw error;
    }
  }

  async getPresentations(): Promise<Presentation[]> {
    try {
      console.log('=== FETCHING PRESENTATIONS v2.4.0 ===');
      
      if (!this.isRegistered) {
        console.log('Device not registered, attempting registration...');
        const registered = await this.registerDevice();
        if (!registered) {
          console.warn('Registration failed, continuing anyway...');
        }
      }
      
      const response = await this.makeRequest<ApiResponse<Presentation[]>>('/presentations');
      const presentations = response.presentations || [];
      
      const cleanedPresentations = presentations.map(pres => ({
        ...pres,
        name: pres.name || pres.nom || 'Présentation sans nom',
        created_at: pres.created_at || pres.date_creation || new Date().toISOString(),
        slide_count: parseInt(pres.slide_count?.toString() || '0'),
        description: pres.description || 'Aucune description disponible'
      }));
      
      console.log('Cleaned presentations:', cleanedPresentations.length);
      return cleanedPresentations;
    } catch (error) {
      console.error('=== ERROR FETCHING PRESENTATIONS ===');
      console.error('Error details:', error);
      throw error;
    }
  }

  async getPresentation(id: number): Promise<PresentationDetails> {
    try {
      console.log('=== FETCHING PRESENTATION DETAILS v2.4.0 ===');
      console.log('Presentation ID:', id);
      
      if (!this.isRegistered) {
        console.log('Device not registered, attempting registration...');
        const registered = await this.registerDevice();
        if (!registered) {
          console.warn('Registration failed, continuing anyway...');
        }
      }
      
      const response = await this.makeRequest<ApiResponse<PresentationDetails>>(`/presentation/${id}`);
      
      if (!response.presentation) {
        throw new Error('Présentation non trouvée dans la réponse du serveur');
      }

      const presentation = response.presentation;
      
      if (!presentation.slides || !Array.isArray(presentation.slides)) {
        console.warn('No slides found, presentation data:', presentation);
        throw new Error('Aucune slide trouvée pour cette présentation');
      }

      const validSlides = presentation.slides.filter(slide => {
        if (!slide.image_url && !slide.image_path && !slide.media_path) {
          console.warn('Slide sans image:', slide);
          return false;
        }
        return true;
      }).map(slide => {
        let imageUrl = slide.image_url;
        
        if (!imageUrl) {
          const imagePath = slide.image_path || slide.media_path || '';
          if (imagePath) {
            imageUrl = this.buildImageUrl(imagePath);
          }
        }
        
        if (imageUrl && this.baseUrl) {
          const baseServerUrl = this.getBaseServerUrl();
          const imagePath = slide.media_path || slide.image_path || '';
          
          if (imagePath) {
            if (imagePath.includes('uploads/slides/')) {
              imageUrl = `${baseServerUrl}/${imagePath}`;
            } else {
              imageUrl = `${baseServerUrl}/uploads/slides/${imagePath}`;
            }
          }
        }
        
        const duration = parseInt(slide.duration?.toString() || '5');
        
        console.log('=== SLIDE DURATION DEBUG v2.4.0 ===');
        console.log('Slide ID:', slide.id);
        console.log('Raw duration from DB:', slide.duration);
        console.log('Parsed duration:', duration);
        
        return {
          ...slide,
          duration: duration,
          image_url: imageUrl || this.buildImageUrl(slide.image_path || slide.media_path || ''),
          transition_type: slide.transition_type || 'fade',
          name: slide.name || slide.title || `Slide ${slide.id}`
        };
      });

      if (validSlides.length === 0) {
        throw new Error('Aucune slide valide trouvée pour cette présentation');
      }

      console.log('=== VALID SLIDES WITH DURATIONS v2.4.0 ===');
      console.log('Count:', validSlides.length);
      validSlides.forEach((slide, index) => {
        console.log(`Slide ${index + 1}:`, {
          id: slide.id,
          name: slide.name,
          duration: slide.duration,
          image_url: slide.image_url
        });
      });

      const finalPresentation = {
        ...presentation,
        name: presentation.name || presentation.nom || 'Présentation sans nom',
        created_at: presentation.created_at || presentation.date_creation || new Date().toISOString(),
        slides: validSlides,
        slide_count: validSlides.length
      };

      return finalPresentation;
    } catch (error) {
      console.error('=== ERROR FETCHING PRESENTATION ===');
      console.error('Error details:', error);
      throw error;
    }
  }

  private buildImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    const baseServerUrl = this.getBaseServerUrl();
    
    if (imagePath.includes('uploads/slides/')) {
      return `${baseServerUrl}/${imagePath}`;
    } else {
      return `${baseServerUrl}/uploads/slides/${imagePath}`;
    }
  }

  async getDebugInfo(): Promise<{
    serverUrl: string;
    deviceId: string;
    isRegistered: boolean;
    hasToken: boolean;
    assignmentCheckActive: boolean;
    assignmentCheckEnabled: boolean;
    defaultCheckActive: boolean;
    defaultCheckEnabled: boolean;
    apiType: string;
    lastConnectionError: string;
    connectionAttempts: number;
  }> {
    return {
      serverUrl: this.baseUrl,
      deviceId: this.deviceId,
      isRegistered: this.isRegistered,
      hasToken: !!this.enrollmentToken,
      assignmentCheckActive: !!this.assignmentCheckInterval,
      assignmentCheckEnabled: this.assignmentCheckEnabled,
      defaultCheckActive: !!this.defaultCheckInterval,
      defaultCheckEnabled: this.defaultCheckEnabled,
      apiType: this.apiType,
      lastConnectionError: this.lastConnectionError,
      connectionAttempts: this.connectionAttempts
    };
  }

  async resetDevice(): Promise<void> {
    console.log('=== RESETTING DEVICE v2.4.0 ===');
    
    this.stopAssignmentCheck();
    this.stopDefaultPresentationCheck();
    
    this.isRegistered = false;
    this.enrollmentToken = '';
    this.assignmentCheckEnabled = false;
    this.defaultCheckEnabled = false;
    this.apiType = 'affichageDynamique';
    this.lastConnectionError = '';
    this.connectionAttempts = 0;
    
    await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_REGISTERED);
    await AsyncStorage.removeItem(STORAGE_KEYS.ENROLLMENT_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.ASSIGNED_PRESENTATION);
    await AsyncStorage.removeItem(STORAGE_KEYS.DEFAULT_PRESENTATION);
    
    console.log('Device reset complete');
  }
}

export const apiService = new ApiService();