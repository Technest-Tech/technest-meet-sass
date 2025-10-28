import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';
import '../services/api_service.dart';

class ParticipantManagerWidget extends StatefulWidget {
  final String participantType;
  final String roomName;

  const ParticipantManagerWidget({
    super.key,
    required this.participantType,
    required this.roomName,
  });

  @override
  State<ParticipantManagerWidget> createState() => _ParticipantManagerWidgetState();
}

class _ParticipantManagerWidgetState extends State<ParticipantManagerWidget> {
  bool _isOpen = false;
  String? _removingParticipant;
  String? _notificationMessage;
  String? _notificationType;

  @override
  Widget build(BuildContext context) {
    // Only show for hosts
    if (widget.participantType.toLowerCase() != 'host') {
      return const SizedBox.shrink();
    }

    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        // Get all participants excluding the host
        final allParticipants = <dynamic>[];
        
        // Add remote participants
        allParticipants.addAll(liveKitService.participants);
        
        // Filter out the local participant (host) from the list
        final otherParticipants = allParticipants.where((p) => 
          p.identity != liveKitService.localParticipant?.identity
        ).toList();

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Participant Manager Button
            _buildControlButton(
              icon: Icons.people,
              label: 'Participants (${otherParticipants.length})',
              isActive: _isOpen,
              onPressed: () {
                setState(() {
                  _isOpen = !_isOpen;
                });
              },
            ),

            // Participant List Modal
            if (_isOpen) _buildParticipantModal(otherParticipants, liveKitService),

            // Notification
            if (_notificationMessage != null) _buildNotification(),
          ],
        );
      },
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onPressed,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: isActive ? Colors.blue : Colors.grey.shade700,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            onPressed: onPressed,
            icon: Icon(
              icon,
              color: Colors.white,
              size: 24,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildParticipantModal(List<dynamic> participants, LiveKitService liveKitService) {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade600),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Manage Participants',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _isOpen = false;
                  });
                },
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Participants List
          if (participants.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32.0),
              child: Column(
                children: [
                  Icon(
                    Icons.people_outline,
                    size: 48,
                    color: Colors.grey,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'No other participants in the meeting',
                    style: TextStyle(
                      color: Colors.grey,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            )
          else
            ...participants.map((participant) => _buildParticipantItem(participant)),
          
          const SizedBox(height: 16),
          
          // Footer
          const Text(
            'Only hosts can remove participants. Removed participants can rejoin if they have the room link.',
            style: TextStyle(
              color: Colors.grey,
              fontSize: 12,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // Helper method to clean participant name for display
  String _cleanParticipantName(String rawName) {
    // Remove timestamp suffix for cleaner display (e.g., "Host-1234567890" -> "Host")
    if (rawName.contains('-') && rawName.split('-').last.length >= 13) {
      // If the last part looks like a timestamp (13+ digits), remove it
      final parts = rawName.split('-');
      if (int.tryParse(parts.last) != null) {
        return parts.sublist(0, parts.length - 1).join('-');
      }
    }
    return rawName;
  }

  Widget _buildParticipantItem(dynamic participant) {
    final participantIdentity = participant.identity as String;
    final displayName = _cleanParticipantName(participantIdentity);
    final isRemoving = _removingParticipant == participantIdentity;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade800,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade600),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.blue,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                displayName.isNotEmpty 
                    ? displayName[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          
          // Participant Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Text(
                  'Guest',
                  style: TextStyle(
                    color: Colors.grey,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          
          // Remove Button
          ElevatedButton(
            onPressed: isRemoving ? null : () => _removeParticipant(participantIdentity),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
              ),
            ),
            child: isRemoving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.person_remove, size: 16),
                      SizedBox(width: 4),
                      Text('Remove'),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotification() {
    Color backgroundColor;
    switch (_notificationType) {
      case 'success':
        backgroundColor = Colors.green;
        break;
      case 'error':
        backgroundColor = Colors.red;
        break;
      default:
        backgroundColor = Colors.blue;
    }

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _notificationMessage!,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  void _removeParticipant(String participantIdentity) async {
    setState(() {
      _removingParticipant = participantIdentity;
    });

    try {
      print('🗑️ Removing participant: $participantIdentity');
      
      // Call the API to remove the participant
      final response = await ApiService.removeParticipant(
        roomName: widget.roomName,
        participantIdentity: participantIdentity,
      );
      
      if (response['success'] == true) {
        setState(() {
          _notificationMessage = 'Participant removed successfully';
          _notificationType = 'success';
        });
        
        // Close the modal after successful removal
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _isOpen = false;
              _notificationMessage = null;
              _notificationType = null;
            });
          }
        });
      } else {
        throw Exception(response['error'] ?? 'Failed to remove participant');
      }
      
    } catch (error) {
      print('❌ Error removing participant: $error');
      setState(() {
        _notificationMessage = 'Failed to remove participant: $error';
        _notificationType = 'error';
      });
      
      // Clear notification after 5 seconds
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) {
          setState(() {
            _notificationMessage = null;
            _notificationType = null;
          });
        }
      });
    } finally {
      setState(() {
        _removingParticipant = null;
      });
    }
  }
}
