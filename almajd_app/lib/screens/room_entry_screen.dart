import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:permission_handler/permission_handler.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../models/room.dart';
import '../utils/logger.dart';
import 'pre_join_screen.dart';
import '../utils/logger.dart';
import 'client_login_screen.dart';
import '../utils/logger.dart';
import 'client_dashboard_screen.dart';
import '../utils/logger.dart';
import 'support_screen.dart';
import '../utils/logger.dart';
import '../providers/auth_provider.dart';
import '../utils/logger.dart';
import '../utils/responsive.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';

class _EntryColors {
  static const background = Color(0xFFE8F1FF);
  static const surface = Colors.white;
  static const primary = Color(0xFF1C7ED6);
  static const textPrimary = Color(0xFF0F1A3A);
  static const textSecondary = Color(0xFF5A6A8A);
  static const border = Color(0xFFC5D6F2);
  static const active = Color(0xFF0A4E9B);
  static const accent = Color(0xFF52A5FF);
}

class RoomEntryScreen extends StatefulWidget {
  const RoomEntryScreen({super.key});

  @override
  State<RoomEntryScreen> createState() => _RoomEntryScreenState();
}

class _RoomEntryScreenState extends State<RoomEntryScreen> {

  final _formKey = GlobalKey<FormState>();
  final _roomNameController = TextEditingController();
  final _participantNameController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  String _selectedRole = 'host'; // Default to Teacher (host)
  String? _linkRole; // Role extracted from the link (h/g/o)

  @override
  void initState() {
    super.initState();
    _roomNameController.addListener(_handleInputChange);
    _participantNameController.addListener(_handleInputChange);
  }

  @override
  void dispose() {
    _roomNameController.removeListener(_handleInputChange);
    _participantNameController.removeListener(_handleInputChange);
    _roomNameController.dispose();
    _participantNameController.dispose();
    super.dispose();
  }

  /// Extract room name and role from link or return as-is
  String _extractRoomName(String input) {
    final trimmed = input.trim();
    String? extractedRole;
    
    // Check if it's a URL
    if (trimmed.contains('://') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        final uri = Uri.parse(trimmed);
        var path = uri.path;
        
        // Remove leading slash if present
        if (path.startsWith('/')) {
          path = path.substring(1);
        }
        
        // Extract role from path (h/g/o)
        if (path.endsWith('/h') || path.endsWith('/host')) {
          extractedRole = 'host'; // Teacher
          path = path.replaceAll(RegExp(r'/(h|host)$'), '');
        } else if (path.endsWith('/g') || path.endsWith('/guest')) {
          extractedRole = 'guest'; // Student
          path = path.replaceAll(RegExp(r'/(g|guest)$'), '');
        } else if (path.endsWith('/o') || path.endsWith('/observer')) {
          extractedRole = 'observer'; // Observer
          path = path.replaceAll(RegExp(r'/(o|observer)$'), '');
        }
        
        // Remove trailing slash if present
        if (path.endsWith('/')) {
          path = path.substring(0, path.length - 1);
        }
        
        // Store the role from link and update selected role
        if (extractedRole != null) {
          setState(() {
            _linkRole = extractedRole;
            _selectedRole = extractedRole!; // Override user selection with link role
          });
          Logger.debug(' RoomEntry: Extracted room name from link: $path, role from link: $extractedRole', 'room_entry_screen');
        } else {
          setState(() {
            _linkRole = null; // No role in link, user can select freely
          });
          Logger.debug(' RoomEntry: Extracted room name from link: $path, no role in link', 'room_entry_screen');
        }
        
        return path;
      } catch (e) {
        Logger.warning(' RoomEntry: Failed to parse URL, using as-is: $e', 'room_entry_screen');
        setState(() {
          _linkRole = null;
        });
        return trimmed;
      }
    }
    
    // Not a URL, clear link role
    setState(() {
      _linkRole = null;
    });
    return trimmed;
  }

  Future<void> _joinRoom() async {
    Logger.info(' RoomEntry: Starting room join process', 'room_entry_screen');
    
    if (!_formKey.currentState!.validate()) {
      Logger.error(' RoomEntry: Form validation failed', null, null, 'room_entry_screen');
      return;
    }

    Logger.debug(' RoomEntry: Form validation passed', 'room_entry_screen');
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Extract room name from link or use as-is
      final inputText = _roomNameController.text.trim();
      final roomName = _extractRoomName(inputText);
      
      // Use role from link if present, otherwise use selected role
      // If link has a role, it overrides user selection
      final participantType = _linkRole ?? _selectedRole;
      
      Logger.debug(' RoomEntry: Using participant type: $participantType (from link: $_linkRole, selected: $_selectedRole)', 'room_entry_screen');
      
      // Set default participant name based on role
      String defaultName;
      if (participantType == 'host') {
        defaultName = 'Teacher';
      } else if (participantType == 'observer') {
        defaultName = 'Observer';
      } else {
        defaultName = 'Student';
      }
      
      final participantName = _participantNameController.text.trim().isEmpty
          ? defaultName
          : _participantNameController.text.trim();

      print('📝 RoomEntry: Room details - Name: $roomName, Participant: $participantName, Type: $participantType');

      // Request permissions first (skip for observers)
      if (participantType != 'observer') {
        print('📱 RoomEntry: Requesting permissions...');
        await _requestPermissions();
        Logger.debug(' RoomEntry: Permissions granted', 'room_entry_screen');
      } else {
        Logger.debug(' RoomEntry: Skipping permissions for observer', 'room_entry_screen');
      }

      // Validate room exists (skip validation for observers - connection-details API will handle it)
      RoomFeatures? features;
      bool? passwordRequired;
      String? passwordFor;
      
      if (participantType == 'observer') {
        Logger.debug(' RoomEntry: Skipping validation for observer - will be validated by connection-details API', 'room_entry_screen');
        // For observers, skip validation since the API doesn't support observer type
        // The connection-details API will handle validation when connecting
        features = null; // Will be handled by connection-details API
        passwordRequired = false; // Observers don't need passwords
        passwordFor = null;
      } else {
        Logger.debug(' RoomEntry: Validating room existence...', 'room_entry_screen');
        final validation = await ApiService.validateRoom(roomName, participantType);
        Logger.debug(' RoomEntry: Room validation result - Exists: ${validation.exists}', 'room_entry_screen');
        
        if (!validation.exists) {
          Logger.error(' RoomEntry: Room not found', null, null, 'room_entry_screen');
          setState(() {
            _error = 'Room not found. Please check the room name or create it through the admin dashboard.';
            _isLoading = false;
          });
          return;
        }

        if (validation.room != null && !validation.room!.isActive) {
          Logger.error(' RoomEntry: Room is inactive', null, null, 'room_entry_screen');
          setState(() {
            _error = 'This room is currently inactive. Please contact the administrator.';
            _isLoading = false;
          });
          return;
        }

        Logger.debug(' RoomEntry: Room validation passed', 'room_entry_screen');

        // Check if room allows multiple hosts when joining as host
        if (participantType == 'host' && 
            validation.room?.allowMultipleHosts == false) {
          Logger.debug(' RoomEntry: Room does not allow multiple hosts', 'room_entry_screen');
          // Show warning dialog - user can still proceed, but API will block if host already exists
          final shouldProceed = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (context) => AlertDialog(
              backgroundColor: AppColors.surfaceElevated,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              title: Text(
                'Host Access Restricted',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: AppColors.textPrimary,
                    ),
              ),
              content: Text(
                'This room only allows one host at a time. If there is already an active host in the room, you will not be able to join.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(
                    'Cancel',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                  ),
                  child: const Text('Continue Anyway'),
                ),
              ],
            ),
          );
          
          if (shouldProceed != true) {
            setState(() {
              _isLoading = false;
            });
            return;
          }
        }

        // Extract features from validation
        features = validation.features;
        passwordRequired = validation.room?.passwordRequired;
        passwordFor = validation.room?.passwordFor;
        
        print('🎯 RoomEntry: Room features - Chat: ${features?.enablePrivateChat}, Reactions: ${features?.enableReactions}, RaiseHand: ${features?.enableRaiseHand}, NoiseCancellation: ${features?.enableNoiseCancellation}');
        print('🎯 RoomEntry: Full room features JSON: ${features?.toJson()}');
        
        // Debug password fields
        Logger.debug(' RoomEntry: Password fields - passwordRequired: $passwordRequired, passwordFor: $passwordFor, participantType: $participantType', 'room_entry_screen');
      }

      // Navigate to video conference
      print('🎬 RoomEntry: Navigating to video conference screen');
      if (mounted) {
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PreJoinScreen(
              roomName: roomName,
              participantName: participantName,
              participantType: participantType,
              roomFeatures: features,
              passwordRequired: passwordRequired,
              passwordFor: passwordFor,
              roomLink: roomName,
            ),
          ),
        );
        Logger.debug(' RoomEntry: Navigation completed, result: $result', 'room_entry_screen');
        
        // Reset loading state when returning from video conference
        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = null;
          });
        }
      } else {
        Logger.warning(' RoomEntry: Widget not mounted, skipping navigation', 'room_entry_screen');
      }

    } catch (e) {
      Logger.error(' RoomEntry: Error joining room: $e', e, null, 'room_entry_screen');
      setState(() {
        _error = 'Error joining room: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _requestPermissions() async {
    print('📱 RoomEntry: Starting permission request process');
    
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final permissionName = permission.toString().split('.').last;
      print('📱 RoomEntry: Checking permission: $permissionName');
      
      final status = await permission.status;
      print('📱 RoomEntry: Permission $permissionName status: $status');
      
      if (status.isDenied) {
        print('📱 RoomEntry: Permission $permissionName is denied, requesting...');
        final requestResult = await permission.request();
        print('📱 RoomEntry: Permission $permissionName request result: $requestResult');
        
        if (!requestResult.isGranted) {
          Logger.error(' RoomEntry: Permission $permissionName denied by user', null, null, 'room_entry_screen');
          throw Exception('Permission denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        Logger.error(' RoomEntry: Permission $permissionName is permanently denied', null, null, 'room_entry_screen');
        throw Exception('Permission permanently denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        Logger.error(' RoomEntry: Permission $permissionName is not granted', null, null, 'room_entry_screen');
        throw Exception('Permission not granted: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else {
        Logger.debug(' RoomEntry: Permission $permissionName is already granted', 'room_entry_screen');
      }
    }
    
    Logger.debug(' RoomEntry: All permissions granted successfully', 'room_entry_screen');
  }

  @override
  Widget build(BuildContext context) {
    final theme = _buildEntryTheme(context);

    return Theme(
      data: theme,
      child: Scaffold(
        backgroundColor: _EntryColors.background,
        appBar: _buildTopAppBar(theme),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: Responsive.maxContentWidth(context) ?? double.infinity,
              ),
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: Responsive.padding(
                    context,
                    horizontal: 24.0,
                    vertical: 24.0,
                  ),
                  children: [
                    _buildJoinCard(theme),
                    if (_error != null) ...[
                      SizedBox(height: Responsive.spacing(context, phone: 20.0, tablet: 24.0)),
                      _buildErrorBanner(theme),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        bottomNavigationBar: _buildBottomNavigation(),
      ),
    );
  }

  ThemeData _buildEntryTheme(BuildContext context) {
    final base = Theme.of(context);
    final colorScheme = base.colorScheme.copyWith(
      primary: _EntryColors.primary,
      onPrimary: Colors.black,
      surface: _EntryColors.surface,
      onSurface: _EntryColors.textPrimary,
      background: _EntryColors.background,
      onBackground: _EntryColors.textPrimary,
    );

    return base.copyWith(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: _EntryColors.background,
      appBarTheme: base.appBarTheme.copyWith(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: _EntryColors.textPrimary,
        displayColor: _EntryColors.textPrimary,
      ),
      iconTheme: const IconThemeData(color: _EntryColors.textSecondary),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        filled: true,
        fillColor: const Color(0xFFF4F8FF),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        hintStyle: base.textTheme.bodyMedium?.copyWith(
          color: _EntryColors.textSecondary,
        ),
        labelStyle: base.textTheme.bodyMedium?.copyWith(
          color: _EntryColors.textSecondary,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: _EntryColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: _EntryColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: _EntryColors.active,
            width: 2,
          ),
        ),
        prefixIconColor: _EntryColors.active,
        suffixIconColor: _EntryColors.active,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _EntryColors.active,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: base.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildTopAppBar(ThemeData theme) {
    return AppBar(
      automaticallyImplyLeading: false,
      toolbarHeight: 84,
      titleSpacing: 0,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              _EntryColors.active,
              _EntryColors.primary,
              _EntryColors.accent,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
      ),
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Row(
          children: [
            Container(
              height: 52,
              width: 52,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(.7)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(8),
              child: Image.asset(
                'assets/icons/logo.png',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Academiq Meet',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Where interactive learning begins',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white.withOpacity(0.85),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: IconButton(
            icon: const Icon(Icons.person_rounded, color: Colors.white),
            onPressed: () async {
              // Check if user is logged in
              final authProvider = Provider.of<AuthProvider>(context, listen: false);
              
              // Refresh auth state to ensure it's up to date
              await authProvider.refreshClientInfo();
              
              if (authProvider.isLoggedIn) {
                // User is logged in, navigate to dashboard
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ClientDashboardScreen(),
                  ),
                );
              } else {
                // User is not logged in, navigate to login screen
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ClientLoginScreen(),
                  ),
                );
              }
            },
          ),
        ),
      ],
    );
  }

  Widget _buildTabs() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.65),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _EntryColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _EntryColors.primary.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.play_circle_fill_rounded,
                color: _EntryColors.active,
              ),
            ),
            const SizedBox(width: 14),
            Text(
              'Join an Academiq room',
              style: TextStyle(
                color: _EntryColors.active,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJoinCard(ThemeData theme) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Container(
          padding: Responsive.padding(context, all: 24.0),
          decoration: BoxDecoration(
            color: _EntryColors.surface,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 18,
                offset: const Offset(0, 12),
              ),
            ],
            border: Border.all(color: _EntryColors.border),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
          Text(
            'Join meeting',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: _EntryColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter the meeting ID or full meeting link. Links will be automatically parsed.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: _EntryColors.textSecondary,
            ),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _roomNameController,
            keyboardType: TextInputType.text,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              hintText: 'Enter Meeting ID/Meeting Link',
              prefixIcon: _buildInputIcon(Icons.meeting_room_outlined),
              prefixIconConstraints:
                  const BoxConstraints(minWidth: 64, minHeight: 48),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Meeting ID or link is required';
              }
              return null;
            },
          ),
          const SizedBox(height: 18),
          TextFormField(
            controller: _participantNameController,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              hintText: 'Enter your name',
              prefixIcon: _buildInputIcon(Icons.person_outline),
              prefixIconConstraints:
                  const BoxConstraints(minWidth: 64, minHeight: 48),
            ),
          ),
          const SizedBox(height: 24),
          _buildRoleSelection(theme),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _joinRoom,
              child: _isLoading
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Text('Joining...'),
                      ],
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.video_call_rounded),
                        SizedBox(width: 8),
                        Text('Join'),
                      ],
                    ),
            ),
          ),
        ],
          ),
        );
      },
    );
  }

  Widget _buildErrorBanner(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.danger.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.danger.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _error!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildBottomNavigation() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _EntryColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 14,
            offset: const Offset(0, -2),
          ),
        ],
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Row(
        children: [
          const Expanded(
            child: _BottomNavItem(
              icon: Icons.home_rounded,
              label: 'Home',
              isActive: true,
            ),
          ),
          const Expanded(
            child: _BottomNavItem(
              icon: Icons.group_outlined,
              label: 'Contacts',
            ),
          ),
          const Expanded(
            child: _BottomNavItem(
              icon: Icons.meeting_room_outlined,
              label: 'Rooms',
            ),
          ),
          Expanded(
            child: _BottomNavItem(
              icon: Icons.headset_mic_outlined,
              label: 'Support',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const SupportScreen(),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _handleInputChange() {
    if (mounted) {
      // Extract role from link if present when user types
      final inputText = _roomNameController.text.trim();
      if (inputText.isNotEmpty) {
        // Check if it's a URL with role indicator
        if (inputText.contains('://') || inputText.startsWith('http://') || inputText.startsWith('https://')) {
          try {
            final uri = Uri.parse(inputText);
            var path = uri.path;
            
            if (path.startsWith('/')) {
              path = path.substring(1);
            }
            
            String? extractedRole;
            if (path.endsWith('/h') || path.endsWith('/host')) {
              extractedRole = 'host';
            } else if (path.endsWith('/g') || path.endsWith('/guest')) {
              extractedRole = 'guest';
            } else if (path.endsWith('/o') || path.endsWith('/observer')) {
              extractedRole = 'observer';
            }
            
            if (extractedRole != null && extractedRole != _linkRole) {
              setState(() {
                _linkRole = extractedRole;
                _selectedRole = extractedRole!; // Update dropdown to match link
              });
            } else if (extractedRole == null && _linkRole != null) {
              // Link no longer has role, allow user selection
              setState(() {
                _linkRole = null;
              });
            }
          } catch (e) {
            // Invalid URL, clear link role
            if (_linkRole != null) {
              setState(() {
                _linkRole = null;
              });
            }
          }
        } else {
          // Not a URL, clear link role
          if (_linkRole != null) {
            setState(() {
              _linkRole = null;
            });
          }
        }
      } else {
        // Input is empty, clear link role
        if (_linkRole != null) {
          setState(() {
            _linkRole = null;
          });
        }
      }
    }
  }

  Widget _buildInputIcon(IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: _EntryColors.primary.withOpacity(0.15),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(
          icon,
          color: _EntryColors.active,
          size: 20,
        ),
      ),
    );
  }

  Widget _buildDropdownItem({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Text(
      title,
      style: TextStyle(
        color: _EntryColors.textPrimary,
        fontWeight: FontWeight.w600,
        fontSize: 14,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildRoleSelection(ThemeData theme) {
    // Map role values to display labels
    final roleOptions = [
      {'value': 'host', 'label': 'Teacher'},
      {'value': 'guest', 'label': 'Student'},
      {'value': 'observer', 'label': 'Observer'},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Join as',
          style: theme.textTheme.titleMedium?.copyWith(
            color: _EntryColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: _EntryColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _EntryColors.border,
              width: 1,
            ),
          ),
          child: DropdownButtonFormField<String>(
            value: _selectedRole,
            isExpanded: true,
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: true,
              fillColor: Colors.transparent,
              isDense: false,
              constraints: const BoxConstraints(
                minHeight: 60,
              ),
            ),
            style: theme.textTheme.bodyLarge?.copyWith(
              color: _EntryColors.textPrimary,
              fontWeight: FontWeight.w600,
              height: 1.5,
            ),
            dropdownColor: _EntryColors.surface,
            borderRadius: BorderRadius.circular(16),
            menuMaxHeight: 300,
            icon: Icon(
              Icons.arrow_drop_down,
              color: _EntryColors.active,
            ),
            selectedItemBuilder: (BuildContext context) {
              return roleOptions.map((option) {
                return Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    option['label'] as String,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: _EntryColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.left,
                  ),
                );
              }).toList();
            },
            items: roleOptions.map((option) {
              final isDisabled = _linkRole != null && _linkRole != option['value'];
              return DropdownMenuItem<String>(
                value: option['value'] as String,
                enabled: !isDisabled,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  child: Opacity(
                    opacity: isDisabled ? 0.5 : 1.0,
                    child: Text(
                      option['label'] as String,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: isDisabled 
                            ? _EntryColors.textSecondary 
                            : _EntryColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
            onChanged: _linkRole != null 
                ? null // Disable changes if role is from link
                : (String? newValue) {
                    if (newValue != null) {
                      setState(() {
                        _selectedRole = newValue;
                      });
                    }
                  },
          ),
        ),
      ],
    );
  }
}

class _BottomNavItem extends StatelessWidget {
  const _BottomNavItem({
    required this.icon,
    required this.label,
    this.isActive = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = isActive
        ? _EntryColors.active
        : _EntryColors.textSecondary.withOpacity(0.7);

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isActive
              ? _EntryColors.primary.withOpacity(0.2)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 6),
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: color,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
