import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import 'video_conference_screen.dart';

class RoomEntryScreen extends StatefulWidget {
  const RoomEntryScreen({super.key});

  @override
  State<RoomEntryScreen> createState() => _RoomEntryScreenState();
}

class _RoomEntryScreenState extends State<RoomEntryScreen> {

  final _formKey = GlobalKey<FormState>();
  final _roomNameController = TextEditingController();
  final _participantNameController = TextEditingController();
  String _participantType = 'guest';
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _roomNameController.dispose();
    _participantNameController.dispose();
    super.dispose();
  }

  Future<void> _joinRoom() async {
    print('🚀 RoomEntry: Starting room join process');
    
    if (!_formKey.currentState!.validate()) {
      print('❌ RoomEntry: Form validation failed');
      return;
    }

    print('✅ RoomEntry: Form validation passed');
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final roomName = _roomNameController.text.trim();
      final participantName = _participantNameController.text.trim().isEmpty 
          ? (_participantType == 'host' ? 'Host' : 'Guest')
          : _participantNameController.text.trim();

      print('📝 RoomEntry: Room details - Name: $roomName, Participant: $participantName, Type: $_participantType');

      // Request permissions first
      print('📱 RoomEntry: Requesting permissions...');
      await _requestPermissions();
      print('✅ RoomEntry: Permissions granted');

      // Validate room exists
      print('🔍 RoomEntry: Validating room existence...');
      final validation = await ApiService.validateRoom(roomName, _participantType);
      print('🔍 RoomEntry: Room validation result - Exists: ${validation.exists}');
      
      if (!validation.exists) {
        print('❌ RoomEntry: Room not found');
        setState(() {
          _error = 'Room not found. Please check the room name or create it through the admin dashboard.';
          _isLoading = false;
        });
        return;
      }

      if (validation.room != null && !validation.room!.isActive) {
        print('❌ RoomEntry: Room is inactive');
        setState(() {
          _error = 'This room is currently inactive. Please contact the administrator.';
          _isLoading = false;
        });
        return;
      }

      print('✅ RoomEntry: Room validation passed');

      // Navigate to video conference
      print('🎬 RoomEntry: Navigating to video conference screen');
      if (mounted) {
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => VideoConferenceScreen(
              roomName: roomName,
              participantName: participantName,
              participantType: _participantType,
            ),
          ),
        );
        print('✅ RoomEntry: Navigation completed, result: $result');
        
        // Reset loading state when returning from video conference
        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = null;
          });
        }
      } else {
        print('⚠️ RoomEntry: Widget not mounted, skipping navigation');
      }

    } catch (e) {
      print('❌ RoomEntry: Error joining room: $e');
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
          print('❌ RoomEntry: Permission $permissionName denied by user');
          throw Exception('Permission denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        print('❌ RoomEntry: Permission $permissionName is permanently denied');
        throw Exception('Permission permanently denied: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        print('❌ RoomEntry: Permission $permissionName is not granted');
        throw Exception('Permission not granted: $permissionName. Please enable camera and microphone permissions in your device settings.');
      } else {
        print('✅ RoomEntry: Permission $permissionName is already granted');
      }
    }
    
    print('✅ RoomEntry: All permissions granted successfully');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF667eea),
              Color(0xFF764ba2),
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  
                  // Header Section
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.video_call_rounded,
                            size: 60,
                            color: Color(0xFF667eea),
                          ),
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          'NewMeet',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Join your video conference',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white.withOpacity(0.8),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 32),

                  // Form Section
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Room Name Field
                        TextFormField(
                          controller: _roomNameController,
                          decoration: InputDecoration(
                            labelText: 'Room Name',
                            hintText: 'Enter room name',
                            prefixIcon: const Icon(Icons.meeting_room_rounded),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Colors.grey.shade300),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Colors.grey.shade300),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFF667eea), width: 2),
                            ),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter a room name';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),

                        // Participant Name Field
                        TextFormField(
                          controller: _participantNameController,
                          decoration: InputDecoration(
                            labelText: 'Your Name (Optional)',
                            hintText: 'Enter your name',
                            prefixIcon: const Icon(Icons.person_rounded),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Colors.grey.shade300),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(color: Colors.grey.shade300),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFF667eea), width: 2),
                            ),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Participant Type Selection
                        const Text(
                          'Join as:',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2D3748),
                          ),
                        ),
                        const SizedBox(height: 16),
                        
                        // Guest Option
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _participantType == 'guest' 
                                  ? const Color(0xFF667eea) 
                                  : Colors.grey.shade300,
                              width: _participantType == 'guest' ? 2 : 1,
                            ),
                            color: _participantType == 'guest' 
                                ? const Color(0xFF667eea).withOpacity(0.1)
                                : Colors.grey.shade50,
                          ),
                          child: RadioListTile<String>(
                            title: const Text(
                              'Guest',
                              style: TextStyle(fontWeight: FontWeight.w500),
                            ),
                            subtitle: const Text('Can participate in the meeting'),
                            value: 'guest',
                            groupValue: _participantType,
                            activeColor: const Color(0xFF667eea),
                            onChanged: (value) {
                              setState(() {
                                _participantType = value!;
                              });
                            },
                          ),
                        ),
                        const SizedBox(height: 12),
                        
                        // Host Option
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _participantType == 'host' 
                                  ? const Color(0xFF667eea) 
                                  : Colors.grey.shade300,
                              width: _participantType == 'host' ? 2 : 1,
                            ),
                            color: _participantType == 'host' 
                                ? const Color(0xFF667eea).withOpacity(0.1)
                                : Colors.grey.shade50,
                          ),
                          child: RadioListTile<String>(
                            title: const Text(
                              'Host',
                              style: TextStyle(fontWeight: FontWeight.w500),
                            ),
                            subtitle: const Text('Can control the meeting'),
                            value: 'host',
                            groupValue: _participantType,
                            activeColor: const Color(0xFF667eea),
                            onChanged: (value) {
                              setState(() {
                                _participantType = value!;
                              });
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 24),

                  // Error Message
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        border: Border.all(color: Colors.red.shade200),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_rounded, color: Colors.red.shade600),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: Colors.red.shade700,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  
                  if (_error != null) const SizedBox(height: 24),

                  // Join Button
                  Container(
                    height: 56,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF667eea).withOpacity(0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _joinRoom,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: _isLoading
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                ),
                                SizedBox(width: 16),
                                Text(
                                  'Joining...',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.video_call_rounded, size: 24),
                                SizedBox(width: 12),
                                Text(
                                  'Join Meeting',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Info Text
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_rounded, color: Colors.white.withOpacity(0.8), size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Rooms must be created through the admin dashboard first.',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white.withOpacity(0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
