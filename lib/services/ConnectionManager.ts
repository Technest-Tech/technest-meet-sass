import { Room, RoomConnectOptions, RoomEvent, RoomOptions, DisconnectReason } from 'livekit-client';
import { logger } from '../utils/logger';
import { handleError, ErrorType } from '../utils/errorHandler';
import { useConnectionStore } from '../store';

export interface ConnectOptions {
  serverUrl: string;
  token: string;
  options: RoomConnectOptions;
  roomOptions?: RoomOptions;
}

export interface ConnectionManagerCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: DisconnectReason) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onError?: (error: Error) => void;
}

export class ConnectionManager {
  private room: Room | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
  private callbacks: ConnectionManagerCallbacks = {};
  private isConnecting = false;
  private hasConnected = false;

  constructor(room?: Room, callbacks?: ConnectionManagerCallbacks) {
    if (room) {
      this.room = room;
    }
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Set or update callbacks
   */
  setCallbacks(callbacks: ConnectionManagerCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set the room instance
   */
  setRoom(room: Room) {
    this.room = room;
  }

  /**
   * Connect to the LiveKit room
   */
  async connect(options: ConnectOptions): Promise<void> {
    if (this.isConnecting) {
      logger.warn('Connection already in progress');
      return;
    }

    if (this.hasConnected && this.room?.state === 'connected') {
      logger.warn('Already connected to room');
      return;
    }

    if (!this.room) {
      throw new Error('Room instance not set. Call setRoom() first.');
    }

    this.isConnecting = true;
    useConnectionStore.getState().setStatus('connecting');

    try {
      // Set connection timeout
      this.setupConnectionTimeout();

      // Setup event listeners before connecting
      this.setupEventListeners();

      // Attempt connection
      logger.debug('Connecting to LiveKit room...', {
        serverUrl: options.serverUrl,
        roomOptions: options.roomOptions
      });

      await this.room.connect(options.serverUrl, options.token, options.options);

      // Clear timeout on successful connection
      this.clearConnectionTimeout();

      this.isConnecting = false;
      this.hasConnected = true;
      this.reconnectAttempts = 0;

      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().setRoom(this.room);
      useConnectionStore.getState().resetReconnectAttempts();

      logger.success('Successfully connected to room');
      this.callbacks.onConnected?.();

    } catch (error) {
      this.isConnecting = false;
      this.clearConnectionTimeout();

      const errorInfo = handleError(error, 'ConnectionManager.connect');
      useConnectionStore.getState().setError(errorInfo.userMessage);
      useConnectionStore.getState().setStatus('error');

      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));

      throw error;
    }
  }

  /**
   * Disconnect from the room
   */
  async disconnect(): Promise<void> {
    this.clearConnectionTimeout();
    this.cleanup();

    if (this.room && this.room.state !== 'disconnected') {
      logger.debug('Disconnecting from room...');
      await this.room.disconnect();
    }

    this.isConnecting = false;
    this.hasConnected = false;
    this.reconnectAttempts = 0;

    useConnectionStore.getState().setStatus('disconnected');
    useConnectionStore.getState().setRoom(null);
  }

  /**
   * Attempt to reconnect
   */
  async reconnect(options: ConnectOptions): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('Maximum reconnection attempts reached');
      throw new Error('Maximum reconnection attempts reached');
    }

    this.reconnectAttempts++;
    useConnectionStore.getState().incrementReconnectAttempts();
    useConnectionStore.getState().setIsReconnecting(true);

    logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`);
    this.callbacks.onReconnecting?.();

    try {
      // Disconnect first if needed
      if (this.room && this.room.state !== 'disconnected') {
        await this.room.disconnect();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await this.connect(options);

      useConnectionStore.getState().setIsReconnecting(false);
      this.callbacks.onReconnected?.();

    } catch (error) {
      useConnectionStore.getState().setIsReconnecting(false);
      logger.error('Reconnection failed:', error);
      throw error;
    }
  }

  /**
   * Setup connection timeout
   */
  private setupConnectionTimeout() {
    this.clearConnectionTimeout();

    this.connectionTimeout = setTimeout(() => {
      if (this.isConnecting && this.room?.state === 'connecting') {
        logger.warn('Connection timeout reached');
        this.room.disconnect();
        this.isConnecting = false;

        const timeoutError = new Error('Connection timeout. Please check your internet connection.');
        useConnectionStore.getState().setError(timeoutError.message);
        useConnectionStore.getState().setStatus('error');

        this.callbacks.onError?.(timeoutError);
      }
    }, this.CONNECTION_TIMEOUT_MS);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Setup event listeners on the room
   */
  private setupEventListeners() {
    if (!this.room) return;

    // Connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      logger.debug('Connection state changed:', state);
      useConnectionStore.getState().setStatus(
        state === 'connected' ? 'connected' :
        state === 'connecting' ? 'connecting' :
        state === 'disconnected' ? 'disconnected' :
        'idle'
      );
    });

    // Disconnected event
    this.room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      logger.info('Room disconnected:', reason);
      this.isConnecting = false;
      this.clearConnectionTimeout();

      useConnectionStore.getState().setStatus('disconnected');
      this.callbacks.onDisconnected?.(reason);
    });

    // Reconnecting event
    this.room.on(RoomEvent.Reconnecting, () => {
      logger.info('Room reconnecting...');
      useConnectionStore.getState().setStatus('connecting');
      useConnectionStore.getState().setIsReconnecting(true);
      this.callbacks.onReconnecting?.();
    });

    // Reconnected event
    this.room.on(RoomEvent.Reconnected, () => {
      logger.success('Room reconnected successfully');
      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().setIsReconnecting(false);
      useConnectionStore.getState().resetReconnectAttempts();
      this.reconnectAttempts = 0;
      this.callbacks.onReconnected?.();
    });

    // Connection quality changed
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      logger.debug('Connection quality changed:', {
        participant: participant?.identity,
        quality
      });
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    this.clearConnectionTimeout();

    if (this.room) {
      // Remove all event listeners
      this.room.removeAllListeners();
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return {
      isConnecting: this.isConnecting,
      hasConnected: this.hasConnected,
      reconnectAttempts: this.reconnectAttempts,
      roomState: this.room?.state
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.hasConnected && this.room?.state === 'connected';
  }

  /**
   * Get the room instance
   */
  getRoom(): Room | null {
    return this.room;
  }
}










