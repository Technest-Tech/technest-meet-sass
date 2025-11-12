import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/splash_screen.dart';
import 'services/livekit_service.dart';
import 'providers/auth_provider.dart';
import 'theme/app_theme.dart';
import 'utils/logger.dart';

void main() {
  Logger.info('App starting...', 'Main');
  runApp(const AcademiqMeetApp());
}

class AcademiqMeetApp extends StatelessWidget {
  const AcademiqMeetApp({super.key});

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