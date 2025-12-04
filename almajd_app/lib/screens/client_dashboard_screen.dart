import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import '../providers/auth_provider.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../models/client_models.dart';
import '../utils/logger.dart';
import '../widgets/client/stat_card.dart';
import '../utils/logger.dart';
import '../widgets/client/client_sidebar.dart';
import '../utils/logger.dart';
import '../widgets/client/client_button.dart';
import '../utils/logger.dart';
import 'client_rooms_screen.dart';
import '../utils/logger.dart';
import 'client_subscription_screen.dart';
import '../utils/logger.dart';
import 'client_settings_screen.dart';
import '../utils/logger.dart';

class ClientDashboardScreen extends StatefulWidget {
  const ClientDashboardScreen({super.key});

  @override
  State<ClientDashboardScreen> createState() => _ClientDashboardScreenState();
}

class _ClientDashboardScreenState extends State<ClientDashboardScreen> {
  int _selectedIndex = 0;
  ClientSubscription? _subscription;
  ClientLimits? _limits;
  List<ClientRoom> _rooms = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final subscriptionFuture = ApiService.getClientSubscription().catchError((e) => null as ClientSubscription?);
      final limitsFuture = ApiService.getClientLimits().catchError((e) => null as ClientLimits?);
      final roomsFuture = ApiService.getClientRooms().catchError((e) => <ClientRoom>[]);

      final results = await Future.wait([
        subscriptionFuture,
        limitsFuture,
        roomsFuture,
      ]);

      setState(() {
        _subscription = results[0] as ClientSubscription?;
        _limits = results[1] as ClientLimits?;
        _rooms = results[2] as List<ClientRoom>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.logout();
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    }
  }

  void _onItemSelected(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  Widget _buildDashboardContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              'Error loading dashboard',
              style: TextStyle(fontSize: 18, color: Colors.grey[800]),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ClientButton(
              text: 'Retry',
              onPressed: _loadDashboardData,
              icon: Icons.refresh,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Section
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    const Color(0xFF1C7ED6),
                    const Color(0xFF0A4E9B),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome back!',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Consumer<AuthProvider>(
                    builder: (context, authProvider, child) {
                      return Text(
                        authProvider.email ?? 'Client',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  ClientButton(
                    text: 'Create New Room',
                    onPressed: () {
                      setState(() {
                        _selectedIndex = 1; // Navigate to rooms
                      });
                    },
                    icon: Icons.add,
                    backgroundColor: Colors.white,
                    textColor: const Color(0xFF1C7ED6),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Stats Section
            const Text(
              'Overview',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F1A3A),
              ),
            ),
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.2,
              children: [
                StatCard(
                  title: 'Total Rooms',
                  value: '${_rooms.length}',
                  icon: Icons.meeting_room,
                  color: Colors.blue,
                  subtitle: _limits != null
                      ? '${_limits!.currentRooms}/${_limits!.maxRooms} max'
                      : null,
                ),
                StatCard(
                  title: 'Subscription',
                  value: _subscription?.status ?? 'N/A',
                  icon: Icons.credit_card,
                  color: _subscription?.status == 'ACTIVE'
                      ? Colors.green
                      : Colors.orange,
                  subtitle: _subscription?.plan?.name,
                ),
                StatCard(
                  title: 'Max Participants',
                  value: _limits != null ? '${_limits!.maxParticipants}' : 'N/A',
                  icon: Icons.people,
                  color: Colors.purple,
                ),
                StatCard(
                  title: 'Active Rooms',
                  value: '${_rooms.where((r) => r.isActive).length}',
                  icon: Icons.video_call,
                  color: Colors.green,
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Quick Actions
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F1A3A),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildQuickActionCard(
                    'Manage Rooms',
                    Icons.meeting_room,
                    Colors.blue,
                    () => setState(() => _selectedIndex = 1),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildQuickActionCard(
                    'Subscription',
                    Icons.credit_card,
                    Colors.green,
                    () => setState(() => _selectedIndex = 2),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionCard(
    String title,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final userEmail = authProvider.email ?? 'Client';

    Widget currentScreen;
    String appBarTitle;

    switch (_selectedIndex) {
      case 0:
        currentScreen = _buildDashboardContent();
        appBarTitle = 'Dashboard';
        break;
      case 1:
        currentScreen = ClientRoomsScreen(
          onRoomCreated: _loadDashboardData,
        );
        appBarTitle = 'Rooms';
        break;
      case 2:
        currentScreen = const ClientSubscriptionScreen();
        appBarTitle = 'Subscription';
        break;
      case 3:
        currentScreen = const ClientSettingsScreen();
        appBarTitle = 'Settings';
        break;
      default:
        currentScreen = _buildDashboardContent();
        appBarTitle = 'Dashboard';
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: Text(appBarTitle),
        backgroundColor: const Color(0xFF1C7ED6),
        foregroundColor: Colors.white,
        elevation: 0,
        // Let Flutter automatically show the menu icon when drawer is present
        // No need to set leading, it will show automatically
        actions: [
          IconButton(
            icon: const Icon(Icons.home),
            tooltip: 'Back to Home',
            onPressed: () {
              // Navigate back to home screen without logging out
              Navigator.of(context).pop();
            },
          ),
        ],
      ),
      drawer: ClientSidebar(
        userEmail: userEmail,
        selectedIndex: _selectedIndex,
        onItemSelected: _onItemSelected,
        onLogout: _handleLogout,
      ),
      body: currentScreen,
    );
  }
}


