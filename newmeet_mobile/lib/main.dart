import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/room_entry_screen.dart';
import 'screens/admin_login_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'services/livekit_service.dart';

void main() {
  print('🚀 NewMeet: App starting...');
  runApp(const NewMeetApp());
}

class NewMeetApp extends StatelessWidget {
  const NewMeetApp({super.key});

  @override
  Widget build(BuildContext context) {
    print('🏗️ NewMeet: Building app widget tree');
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) {
          print('🔧 NewMeet: Creating LiveKitService provider');
          return LiveKitService();
        }),
      ],
      child: MaterialApp(
        title: 'Tarteel Meet',
        theme: ThemeData(
          primarySwatch: Colors.blue,
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.blue,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
        ),
        debugShowCheckedModeBanner: false,
        routes: {
          '/': (context) => const RoomEntryScreen(),
          '/admin-login': (context) => const AdminLoginScreen(),
          '/admin-dashboard': (context) => const AdminDashboardScreen(),
        },
        onGenerateRoute: (settings) {
          print('🧭 NewMeet: Navigation to ${settings.name}');
          return null;
        },
      ),
    );
  }
}