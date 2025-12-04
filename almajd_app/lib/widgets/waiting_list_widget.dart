import 'dart:async';
import '../utils/logger.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../services/reaction_sound_service.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';

class WaitingParticipant {
  final String id;
  final String participantName;
  final String participantType;
  final String status;
  final String joinedAt;

  WaitingParticipant({
    required this.id,
    required this.participantName,
    required this.participantType,
    required this.status,
    required this.joinedAt,
  });

  factory WaitingParticipant.fromJson(Map<String, dynamic> json) {
    return WaitingParticipant(
      id: json['id'] as String,
      participantName: json['participantName'] as String,
      participantType: json['participantType'] as String,
      status: json['status'] as String,
      joinedAt: json['joinedAt'] as String,
    );
  }
}

class WaitingListWidget extends StatefulWidget {
  final String roomName;
  final bool isHost;

  const WaitingListWidget({
    super.key,
    required this.roomName,
    required this.isHost,
  });

  @override
  State<WaitingListWidget> createState() => _WaitingListWidgetState();
}

class _WaitingListWidgetState extends State<WaitingListWidget> {
  List<WaitingParticipant> _waitingParticipants = [];
  Timer? _pollTimer;
  Set<String> _processedParticipantIds = {};
  bool _isLoading = false;
  String? _processingParticipantId;
  final ReactionSoundService _soundService = ReactionSoundService();

  @override
  void initState() {
    super.initState();
    if (widget.isHost) {
      _startPolling();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    // Fetch immediately
    _fetchWaitingParticipants();
    
    // Then poll every 3 seconds
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _fetchWaitingParticipants();
    });
  }

  Future<void> _fetchWaitingParticipants() async {
    if (!widget.isHost || _isLoading) return;

    try {
      setState(() {
        _isLoading = true;
      });

      final response = await ApiService.getWaitingRoomParticipants(
        roomName: widget.roomName,
      );

      final participantsList = response['waitingParticipants'] as List<dynamic>? ?? [];
      final newParticipants = participantsList
          .map((p) => WaitingParticipant.fromJson(p as Map<String, dynamic>))
          .toList();

      // Check for new participants
      final newParticipantIds = newParticipants
          .map((p) => p.id)
          .where((id) => !_processedParticipantIds.contains(id))
          .toList();

      if (newParticipantIds.isNotEmpty && mounted) {
        // Show confirmation alert for new participants
        for (final newId in newParticipantIds) {
          final newParticipant = newParticipants.firstWhere((p) => p.id == newId);
          _processedParticipantIds.add(newId);
          
          // Play notification sound
          _soundService.playWaitingRoomNotificationSound();
          
          // Show alert dialog for this new participant
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              _showGuestConfirmationAlert(newParticipant);
            }
          });
        }
      }

      if (mounted) {
        setState(() {
          _waitingParticipants = newParticipants;
          _isLoading = false;
        });
      }
    } catch (e) {
      Logger.error(' WaitingListWidget: Error fetching waiting participants: $e', e, null, 'waiting_list_widget');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _showGuestConfirmationAlert(WaitingParticipant participant) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          elevation: 8,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.person_add,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Guest Request',
                  style: TextStyle(
                    color: Color(0xFF1A1A1A),
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${participant.participantName} wants to join the meeting.',
                style: const TextStyle(
                  color: Color(0xFF4A4A4A),
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.primary.withOpacity(0.3),
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: AppColors.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You can admit or reject this request.',
                        style: TextStyle(
                          color: Color(0xFF4A4A4A),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: _processingParticipantId == participant.id
                  ? null
                  : () async {
                      Navigator.of(context).pop();
                      await _rejectParticipant(participant);
                    },
              child: _processingParticipantId == participant.id
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(AppColors.danger),
                      ),
                    )
                  : Text(
                      'Reject',
                      style: TextStyle(
                        color: AppColors.danger,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _processingParticipantId == participant.id
                  ? null
                  : () async {
                      Navigator.of(context).pop();
                      await _admitParticipant(participant);
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 2,
              ),
              child: _processingParticipantId == participant.id
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Admit',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _admitParticipant(WaitingParticipant participant) async {
    setState(() {
      _processingParticipantId = participant.id;
    });

    try {
      Logger.debug(' WaitingListWidget: Admitting participant: ${participant.participantName}', 'waiting_list_widget');
      
      await ApiService.admitWaitingParticipant(
        roomName: widget.roomName,
        participantId: participant.id,
      );

      // Refresh the list
      await _fetchWaitingParticipants();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('✅ ${participant.participantName} admitted to meeting'),
                ),
              ],
            ),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      Logger.error(' WaitingListWidget: Error admitting participant: $e', e, null, 'waiting_list_widget');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to admit participant: $e'),
            backgroundColor: AppColors.danger,
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _processingParticipantId = null;
        });
      }
    }
  }

  Future<void> _rejectParticipant(WaitingParticipant participant) async {
    setState(() {
      _processingParticipantId = participant.id;
    });

    try {
      Logger.error(' WaitingListWidget: Rejecting participant: ${participant.participantName}', null, null, 'waiting_list_widget');
      
      await ApiService.rejectWaitingParticipant(
        roomName: widget.roomName,
        participantId: participant.id,
      );

      // Refresh the list
      await _fetchWaitingParticipants();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.cancel, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('❌ ${participant.participantName} rejected'),
                ),
              ],
            ),
            backgroundColor: AppColors.danger,
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      Logger.error(' WaitingListWidget: Error rejecting participant: $e', e, null, 'waiting_list_widget');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reject participant: $e'),
            backgroundColor: AppColors.danger,
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _processingParticipantId = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // This widget doesn't render anything visible
    // It only handles polling and shows alert dialogs
    return const SizedBox.shrink();
  }
}

