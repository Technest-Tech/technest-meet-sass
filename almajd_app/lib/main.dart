import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/splash_screen.dart';
import 'screens/room_entry_screen.dart';
import 'screens/pre_join_screen.dart';
import 'services/livekit_service.dart';
import 'services/deep_link_service.dart';
import 'services/api_service.dart';
import 'providers/auth_provider.dart';
import 'store/media_quality_store.dart';
import 'theme/app_theme.dart';
import 'utils/logger.dart';
import 'models/room.dart';

void main() {
  Logger.info('App starting...', 'Main');
  runApp(const AcademiqMeetApp());
}

class AcademiqMeetApp extends StatefulWidget {
  const AcademiqMeetApp({super.key});

  @override
  State<AcademiqMeetApp> createState() => _AcademiqMeetAppState();
}

class _AcademiqMeetAppState extends State<AcademiqMeetApp> {
  final DeepLinkService _deepLinkService = DeepLinkService();
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool _isAppInitialized = false;
  String? _pendingRoomLink;
  String? _pendingAccessType;

  @override
  void initState() {
    super.initState();
    _initializeDeepLinks();
  }

  void _initializeDeepLinks() {
    Logger.info('Initializing deep links', 'Main');
    
    // Set up deep link handler
    _deepLinkService.onDeepLinkReceived = (roomLink, accessType) {
      Logger.info('Deep link received in app: $roomLink, $accessType', 'Main');
      
      // Store pending deep link if app is not initialized yet (splash screen still showing)
      if (!_isAppInitialized) {
        Logger.info('App not initialized yet, storing deep link for later processing', 'Main');
        _pendingRoomLink = roomLink;
        _pendingAccessType = accessType;
        return;
      }
      
      // Wait for navigation context to be available
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleDeepLinkNavigation(roomLink, accessType);
      });
    };
    
    // Initialize the deep link service
    _deepLinkService.initialize();
    
    // Mark app as initialized after splash screen duration + transition
    // Splash: 2.5s duration + 0.6s transition = ~3.1s total, so wait 3.5s to be safe
    Future.delayed(const Duration(milliseconds: 3500), () {
      if (mounted) {
        setState(() {
          _isAppInitialized = true;
        });
        
        // Process pending deep link if any
        if (_pendingRoomLink != null && _pendingAccessType != null) {
          Logger.info('Processing pending deep link after app initialization', 'Main');
          // Add additional delay to ensure navigation stack is stable
          Future.delayed(const Duration(milliseconds: 200), () {
            if (mounted && _pendingRoomLink != null && _pendingAccessType != null) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _handleDeepLinkNavigation(_pendingRoomLink!, _pendingAccessType!);
                _pendingRoomLink = null;
                _pendingAccessType = null;
              });
            }
          });
        }
      }
    });
  }

  Future<void> _handleDeepLinkNavigation(String roomLink, String accessType) async {
    try {
      Logger.info('Handling deep link navigation - Room: $roomLink, Type: $accessType', 'Main');
      
      // Map access type to API type: h=host/Teacher, g=guest/Student, o=observer/Observer
      final apiType = accessType == 'host' ? 'host' : (accessType == 'observer' ? 'observer' : 'guest');
      
      // For observers, skip validation (connection-details API will handle it)
      // This matches the behavior in room_entry_screen.dart
      RoomFeatures? features;
      bool? passwordRequired;
      String? passwordFor;
      
      if (apiType == 'observer') {
        Logger.debug('Skipping validation for observer - will be validated by connection-details API', 'Main');
        // For observers, skip validation since the API doesn't support observer type in validation
        // The connection-details API will handle validation when connecting
        features = null; // Will be handled by connection-details API
        passwordRequired = false; // Observers don't need passwords
        passwordFor = null;
      } else {
        // Validate room exists with correct type for host and guest
        Logger.debug('Validating room from deep link with type: $apiType...', 'Main');
        try {
          final validation = await ApiService.validateRoom(roomLink, apiType);
          
          if (!validation.exists || validation.room == null) {
            Logger.error('Room not found via deep link: $roomLink', null, null, 'Main');
            _showDeepLinkError('Room not found. Please check the room link.');
            return;
          }

          if (validation.room!.isActive == false) {
            Logger.error('Room is inactive: $roomLink', null, null, 'Main');
            _showDeepLinkError('This room is currently inactive.');
            return;
          }

          Logger.info('Room validated successfully', 'Main');
          
          // Extract features from validation
          features = validation.features;
          passwordRequired = validation.room?.passwordRequired;
          passwordFor = validation.room?.passwordFor;
        } catch (e) {
          Logger.error('Error validating room from deep link: $e', e, null, 'Main');
          _showDeepLinkError('Failed to validate room: ${e.toString()}');
          return;
        }
      }

      // Get the navigator context
      final navigator = _navigatorKey.currentState;
      if (navigator == null) {
        Logger.warning('Navigator not available yet, will retry', 'Main');
        // Retry after a short delay
        Future.delayed(const Duration(milliseconds: 500), () {
          _handleDeepLinkNavigation(roomLink, accessType);
        });
        return;
      }

      // Set participant name based on role
      String participantName = '';
      if (accessType == 'observer') {
        participantName = 'Observer';
      } else if (accessType == 'host') {
        participantName = 'Teacher';
      } else {
        participantName = 'Student';
      }

      Logger.info('Navigating to PreJoinScreen', 'Main');

      // Navigate to PreJoinScreen with proper stack setup
      // Strategy: Clear all routes, push RoomEntryScreen as base, then PreJoinScreen on top
      // This ensures consistent navigation stack regardless of when deep link is processed
      
      // First, clear everything and push RoomEntryScreen as the base route
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const RoomEntryScreen(),
        ),
        (route) => false, // Clear all routes
      );
      
      // Then push PreJoinScreen on top
      // This ensures RoomEntryScreen is always available to navigate back to
      // Mark as joined from deep link so app exits when leaving
      navigator.push(
        MaterialPageRoute(
          builder: (context) => PreJoinScreen(
            roomName: roomLink,
            participantName: participantName,
            participantType: apiType,
            roomFeatures: features,
            passwordRequired: passwordRequired,
            passwordFor: passwordFor,
            roomLink: roomLink,
            joinedFromDeepLink: true, // Mark as deep link join
          ),
        ),
      );
    } catch (e) {
      Logger.error('Error handling deep link navigation: $e', e, null, 'Main');
      _showDeepLinkError('Error joining room: ${e.toString()}');
    }
  }

  void _showDeepLinkError(String message) {
    final navigator = _navigatorKey.currentState;
    if (navigator != null) {
      // Navigate to room entry screen and show error
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const RoomEntryScreen(),
        ),
        (route) => false,
      );
      
      // Show error message after navigation
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(navigator.context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      });
    }
  }

  @override
  void dispose() {
    _deepLinkService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Logger.debug('Building app widget tree', 'Main');
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) {
          Logger.debug('Creating LiveKitService provider', 'Main');
          return LiveKitService();
        }),
        ChangeNotifierProvider(create: (_) {
          Logger.debug('Creating AuthProvider', 'Main');
          return AuthProvider();
        }),
        ChangeNotifierProvider(create: (_) {
          Logger.debug('Creating MediaQualityStore provider', 'Main');
          final store = MediaQualityStore();
          store.initialize();
          return store;
        }),
      ],
      child: MaterialApp(
        navigatorKey: _navigatorKey,
        title: 'Academiq Meet',
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
        debugShowCheckedModeBanner: false,
        onGenerateRoute: (settings) {
          Logger.debug('Navigation to ${settings.name}', 'Main');
          return null;
        },
      ),
    );
  }
}