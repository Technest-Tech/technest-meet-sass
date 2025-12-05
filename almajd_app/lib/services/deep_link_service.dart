import 'dart:async';
import 'package:app_links/app_links.dart';
import '../utils/logger.dart';

/// Service to handle deep links from acadmyq.com and almajdmeet.org domains
/// 
/// Handles URLs in format: https://acadmyq.com/{roomLink}/{accessType} or https://almajdmeet.org/{roomLink}/{accessType}
/// Where accessType is: 'h' (host), 'g' (guest), or 'o' (observer)
class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSubscription;
  
  /// Callback function to handle parsed deep links
  /// Parameters: (roomLink, accessType)
  Function(String roomLink, String accessType)? onDeepLinkReceived;

  /// Initialize deep link service
  /// Should be called once when app starts
  void initialize() {
    Logger.info('Initializing DeepLinkService', 'DeepLinkService');
    
    // Handle initial link (if app was opened from a link)
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) {
        Logger.info('App opened from deep link: $uri', 'DeepLinkService');
        _handleDeepLink(uri);
      } else {
        Logger.debug('No initial deep link found', 'DeepLinkService');
      }
    }).catchError((err) {
      Logger.error('Error getting initial link: $err', err, null, 'DeepLinkService');
    });

    // Listen for deep links while app is running
    _linkSubscription = _appLinks.uriLinkStream.listen(
      (uri) {
        Logger.info('Deep link received while app running: $uri', 'DeepLinkService');
        _handleDeepLink(uri);
      },
      onError: (err) {
        Logger.error('Deep link stream error: $err', err, null, 'DeepLinkService');
      },
    );
  }

  /// Parse and handle incoming deep link
  void _handleDeepLink(Uri uri) {
    try {
      Logger.debug('Parsing deep link: ${uri.path}', 'DeepLinkService');
      
      // Parse URL structure: /{roomLink}/{accessType}
      // Example: /9h3t0u5/h or /9h3t0u5/g or /9h3t0u5/o
      final pathSegments = uri.pathSegments;
      
      if (pathSegments.isEmpty) {
        Logger.warning('Empty path segments in deep link: ${uri.path}', 'DeepLinkService');
        return;
      }
      
      // Get roomLink (first segment)
      final roomLink = pathSegments[0];
      
      // Get accessType (second segment, default to 'g' if not present)
      String accessTypeSegment = 'g'; // Default to guest
      if (pathSegments.length >= 2) {
        accessTypeSegment = pathSegments[1];
      }
      
      // Map path segments to access types
      String accessType;
      if (accessTypeSegment == 'g') {
        accessType = 'guest';
      } else if (accessTypeSegment == 'h') {
        accessType = 'host';
      } else if (accessTypeSegment == 'o') {
        accessType = 'observer';
      } else {
        Logger.warning('Unknown access type: $accessTypeSegment, defaulting to guest', 'DeepLinkService');
        accessType = 'guest'; // Default to guest
      }
      
      Logger.info('Parsed deep link - Room: $roomLink, Type: $accessType', 'DeepLinkService');
      
      // Call the callback if set
      if (onDeepLinkReceived != null) {
        onDeepLinkReceived!(roomLink, accessType);
      } else {
        Logger.warning('Deep link received but no callback is set', 'DeepLinkService');
      }
    } catch (e) {
      Logger.error('Error handling deep link: $e', e, null, 'DeepLinkService');
    }
  }

  /// Dispose resources
  void dispose() {
    _linkSubscription?.cancel();
    Logger.info('DeepLinkService disposed', 'DeepLinkService');
  }
}


