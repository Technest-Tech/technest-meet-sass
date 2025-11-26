import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/splash_screen.dart';
import 'screens/room_entry_screen.dart';
import 'screens/pre_join_screen.dart';
import 'services/livekit_service.dart';
import 'services/deep_link_service.dart';
import 'services/api_service.dart';
import 'providers/auth_provider.dart';
import 'theme/app_theme.dart';
import 'utils/logger.dart';

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
      
      // Wait for navigation context to be available
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleDeepLinkNavigation(roomLink, accessType);
      });
    };
    
    // Initialize the deep link service
    _deepLinkService.initialize();
  }

  Future<void> _handleDeepLinkNavigation(String roomLink, String accessType) async {
    try {
      Logger.info('Handling deep link navigation - Room: $roomLink, Type: $accessType', 'Main');
      
      // Map access type to API type: h=host/Teacher, g=guest/Student, o=observer/Observer
      final apiType = accessType == 'host' ? 'host' : (accessType == 'observer' ? 'observer' : 'guest');
      
      // Validate room exists with correct type
      Logger.debug('Validating room from deep link with type: $apiType...', 'Main');
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

      Logger.info('Room validated successfully, navigating to PreJoinScreen', 'Main');

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

      // Clear navigation stack and navigate to PreJoinScreen
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => PreJoinScreen(
            roomName: roomLink,
            participantName: participantName,
            participantType: apiType,
            roomFeatures: validation.features,
            passwordRequired: validation.room?.passwordRequired,
            passwordFor: validation.room?.passwordFor,
            roomLink: roomLink,
          ),
        ),
        (route) => false, // Remove all previous routes
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