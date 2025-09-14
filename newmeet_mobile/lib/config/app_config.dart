class AppConfig {
  // Environment configuration
  static const Environment _environment = Environment.production;
  
  // Base URLs for different environments
  static const Map<Environment, String> _baseUrls = {
    Environment.development: 'http://localhost:3000',
    Environment.staging: 'https://staging.almajd.link',
    Environment.production: 'https://live.almajd.link',
  };
  
  // Get current base URL
  static String get baseUrl => _baseUrls[_environment]!;
  
  // Get current environment
  static Environment get environment => _environment;
  
  // Check if running in production
  static bool get isProduction => _environment == Environment.production;
  
  // Check if running in development
  static bool get isDevelopment => _environment == Environment.development;
  
  // API endpoints
  static String get roomValidationEndpoint => '$baseUrl/api/room/validate';
  static String get liveKitTokenEndpoint => '$baseUrl/api/livekit/token';
  static String get connectionDetailsEndpoint => '$baseUrl/api/connection-details';
  
  // WebSocket endpoint for LiveKit
  static String get liveKitWebSocketUrl => '$baseUrl/rtc';
  
  // App information
  static const String appName = 'Almajd Meet';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'LiveKit Video Conferencing App with Whiteboard';
}

enum Environment {
  development,
  staging,
  production,
}
