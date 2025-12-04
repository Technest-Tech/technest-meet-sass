import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../services/api_service.dart';
import '../../services/room_storage_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/error_handler.dart';
import '../video_conference_screen.dart';

class JoinByLinkTab extends StatefulWidget {
  const JoinByLinkTab({super.key});

  @override
  State<JoinByLinkTab> createState() => _JoinByLinkTabState();
}

class _JoinByLinkTabState extends State<JoinByLinkTab> {
  final _formKey = GlobalKey<FormState>();
  final _roomLinkController = TextEditingController();
  final _participantNameController = TextEditingController();
  String _participantType = 'guest'; // Default to Student
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDefaultName();
  }

  @override
  void dispose() {
    _roomLinkController.dispose();
    _participantNameController.dispose();
    super.dispose();
  }

  Future<void> _loadDefaultName() async {
    final defaultName = await RoomStorageService.getDefaultParticipantName();
    if (defaultName != null && mounted) {
      _participantNameController.text = defaultName;
    }
  }

  Future<void> _joinRoom() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final roomLink = _roomLinkController.text.trim();
      final participantName = _participantNameController.text.trim().isEmpty
          ? (_participantType == 'host' 
              ? 'Teacher' 
              : (_participantType == 'observer' ? 'Observer' : 'Student'))
          : _participantNameController.text.trim();

      // Save default name if provided
      if (_participantNameController.text.trim().isNotEmpty) {
        await RoomStorageService.setDefaultParticipantName(
            _participantNameController.text.trim());
      }

      // Request permissions
      await _requestPermissions();

      // Validate room exists
      final validation = await ApiService.validateRoom(roomLink, _participantType);

      if (!validation.exists) {
        setState(() {
          _error =
              'Room not found. Please check the room link or create it through the admin dashboard.';
          _isLoading = false;
        });
        return;
      }

      if (validation.room != null && !validation.room!.isActive) {
        setState(() {
          _error =
              'This room is currently inactive. Please contact the administrator.';
          _isLoading = false;
        });
        return;
      }

      // Save to room history
      await RoomStorageService.saveRoom(
        roomName: roomLink,
        roomId: validation.room?.id,
        participantName: participantName,
        participantType: _participantType,
      );

      // Extract features from validation
      final features = validation.features;

      // Navigate to video conference
      if (mounted) {
        await Navigator.push(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) =>
                VideoConferenceScreen(
              roomName: roomLink,
              participantName: participantName,
              participantType: _participantType,
              roomFeatures: features,
            ),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return FadeTransition(
                opacity: animation,
                child: child,
              );
            },
          ),
        );

        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = null;
          });
        }
      }
    } catch (e) {
      ErrorHandler.handleError(context, e);
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _requestPermissions() async {
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final status = await permission.status;

      if (status.isDenied) {
        final requestResult = await permission.request();
        if (!requestResult.isGranted) {
          throw Exception(
              'Permission denied: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        throw Exception(
            'Permission permanently denied: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        throw Exception(
            'Permission not granted: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacingL),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: AppTheme.spacingM),

            // Header
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingXL),
              decoration: AppTheme.glassmorphism(
                color: Colors.white,
                opacity: 0.15,
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppTheme.spacingL),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.link,
                      size: 48,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: AppTheme.spacingM),
                  const Text(
                    'Join by Room Link',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppTheme.spacingS),
                  Text(
                    'Enter the room link or name to join',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withOpacity(0.9),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppTheme.spacingXL),

            // Form Section
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingXL),
              decoration: AppTheme.glassmorphism(
                color: Colors.white,
                opacity: 0.2,
                blur: 20.0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Room Link Field
                  TextFormField(
                    controller: _roomLinkController,
                    decoration: InputDecoration(
                      labelText: 'Room Link or Name',
                      hintText: 'Enter room link or name',
                      prefixIcon: const Icon(Icons.meeting_room_rounded),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.9),
                    ),
                    style: const TextStyle(fontSize: 16),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter a room link or name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppTheme.spacingL),

                  // Participant Name Field
                  TextFormField(
                    controller: _participantNameController,
                    decoration: InputDecoration(
                      labelText: 'Your Name (Optional)',
                      hintText: 'Enter your name',
                      prefixIcon: const Icon(Icons.person_rounded),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.9),
                    ),
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: AppTheme.spacingL),

                  // Participant Type Selector
                  Text(
                    'Join As',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withOpacity(0.9),
                    ),
                  ),
                  const SizedBox(height: AppTheme.spacingS),
                  Row(
                    children: [
                      Expanded(
                        child: _buildParticipantTypeCard(
                          'host',
                          'Teacher',
                          Icons.school,
                          'Full meeting control',
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingM),
                      Expanded(
                        child: _buildParticipantTypeCard(
                          'guest',
                          'Student',
                          Icons.person,
                          'Participate with camera and mic',
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingM),
                      Expanded(
                        child: _buildParticipantTypeCard(
                          'observer',
                          'Observer',
                          Icons.visibility,
                          'View only, invisible',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppTheme.spacingL),

            // Error Message
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(AppTheme.spacingM),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  boxShadow: AppTheme.shadowMedium,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.white),
                    const SizedBox(width: AppTheme.spacingS),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            if (_error != null) const SizedBox(height: AppTheme.spacingL),

            // Join Button
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 64,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppTheme.radiusL),
                gradient: _isLoading
                    ? null
                    : const LinearGradient(
                        colors: [AppTheme.successGreen, Color(0xFF2E7D32)],
                      ),
                color: _isLoading ? Colors.grey : null,
                boxShadow: _isLoading
                    ? null
                    : [
                        BoxShadow(
                          color: AppTheme.successGreen.withOpacity(0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        ),
                      ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _isLoading ? null : _joinRoom,
                  borderRadius: BorderRadius.circular(AppTheme.radiusL),
                  child: Center(
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.video_call_rounded,
                                  size: 28, color: Colors.white),
                              SizedBox(width: 12),
                              Text(
                                'JOIN MEETING',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: AppTheme.spacingXL),
          ],
        ),
      ),
    );
  }

  Widget _buildParticipantTypeCard(
    String type,
    String label,
    IconData icon,
    String subtitle,
  ) {
    final isSelected = _participantType == type;
    return GestureDetector(
      onTap: () {
        setState(() {
          _participantType = type;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(AppTheme.spacingM),
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.white.withOpacity(0.3)
              : Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(AppTheme.radiusM),
          border: Border.all(
            color: isSelected
                ? Colors.white
                : Colors.white.withOpacity(0.3),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: Colors.white.withOpacity(0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}



