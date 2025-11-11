import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/room_entry_screen.dart';
import 'services/livekit_service.dart';
import 'theme/app_theme.dart';

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
        title: 'NewMeet Mobile',
        theme: AppTheme.darkTheme,
        home: const RoomEntryScreen(),
        debugShowCheckedModeBanner: false,
        onGenerateRoute: (settings) {
          print('🧭 NewMeet: Navigation to ${settings.name}');
          return null;
        },
      ),
    );
  }
}