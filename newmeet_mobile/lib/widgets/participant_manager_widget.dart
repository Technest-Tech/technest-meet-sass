import 'dart:async';
import '../utils/logger.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../services/livekit_service.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';

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

class ParticipantStatus {
  final bool audioEnabled;
  final bool videoEnabled;

  ParticipantStatus({
    required this.audioEnabled,
    required this.videoEnabled,
  });
}

class _ParticipantManagerWidgetState extends State<ParticipantManagerWidget> {
  String? _removingParticipant;
  String? _mutingParticipant;
  bool _isMutingAll = false;
  String? _notificationMessage;
  String? _notificationType;
  Map<String, ParticipantStatus> _participantStatuses = {};
  Map<String, bool> _raisedHands = {};
  Timer? _statusUpdateTimer;

  // Helper function to clean participant names (remove _host_roomName, _guest_roomName suffixes)
  String _getCleanName(String identity) {
    // Match pattern: _host_roomName or _guest_roomName (where roomName can contain hyphens, etc.)
    return identity.replaceAll(RegExp(r'_(host|guest)_[^_]+$'), '');
  }

  void _updateParticipantStatuses(LiveKitService liveKitService) {
    if (!mounted) return;
    
    final newStatuses = <String, ParticipantStatus>{};
    
    for (final participant in liveKitService.participants) {
      bool audioEnabled = false;
      bool videoEnabled = false;
      
      if (participant is lk.RemoteParticipant) {
        try {
          // Check audio tracks - similar to web implementation
          // Check if any audio track is unmuted and has a track
          if (participant.audioTrackPublications.isNotEmpty) {
            for (final publication in participant.audioTrackPublications) {
              if (!publication.muted && publication.track != null) {
                audioEnabled = true;
                break;
              }
            }
          } else {
            // If no audio tracks published, check using participant method as fallback
            try {
              audioEnabled = participant.isMicrophoneEnabled();
            } catch (e) {
              audioEnabled = false;
            }
          }
          
          // Check video tracks - similar to web implementation
          // Check if any video track is unmuted and has a track
          if (participant.videoTrackPublications.isNotEmpty) {
            for (final publication in participant.videoTrackPublications) {
              if (!publication.muted && publication.track != null) {
                videoEnabled = true;
                break;
              }
            }
          } else {
            // If no video tracks published, check using participant method as fallback
            try {
              videoEnabled = participant.isCameraEnabled();
            } catch (e) {
              videoEnabled = false;
            }
          }
        } catch (e) {
          // Handle any errors gracefully
          Logger.warning(' Error checking participant status: $e', 'participant_manager_widget');
        }
      }
      
      newStatuses[participant.identity] = ParticipantStatus(
        audioEnabled: audioEnabled,
        videoEnabled: videoEnabled,
      );
    }
    
    // Always update to reflect current state
    if (mounted) {
      setState(() {
        _participantStatuses = newStatuses;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    // Set up periodic status updates (every 3 seconds to reduce CPU usage)
    _statusUpdateTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (mounted) {
        final liveKitService = Provider.of<LiveKitService>(context, listen: false);
        _updateParticipantStatuses(liveKitService);
      }
    });
  }

  @override
  void dispose() {
    _statusUpdateTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.participantType.toLowerCase() != 'host') {
      return const SizedBox.shrink();
    }

    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        final allParticipants = <dynamic>[];
        allParticipants.addAll(liveKitService.participants);
        final otherParticipants = allParticipants
            .where(
              (p) => p.identity != liveKitService.localParticipant?.identity,
            )
            .toList();

        // Update statuses when participants change - do this after build
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            _updateParticipantStatuses(liveKitService);
          }
        });

        final spacing = Theme.of(context).extension<AppSpacing>()!;
        final isHost = widget.participantType.toLowerCase() == 'host';

        return Padding(
          padding: EdgeInsets.all(spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.group, color: AppColors.textSecondary),
                  SizedBox(width: spacing.sm),
                  Text(
                    'Manage Participants',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const Spacer(),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.sm,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      '${otherParticipants.length} online',
                      style: Theme.of(context)
                          .textTheme
                          .labelMedium
                          ?.copyWith(color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
              if (isHost && otherParticipants.isNotEmpty) ...[
                SizedBox(height: spacing.md),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isMutingAll ? null : () => _muteAllParticipants(liveKitService),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.danger,
                      foregroundColor: AppColors.textPrimary,
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.md,
                        vertical: spacing.sm,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    icon: _isMutingAll
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(AppColors.textPrimary),
                            ),
                          )
                        : const Icon(Icons.mic_off),
                    label: Text(_isMutingAll ? 'Muting All...' : 'Mute All Participants'),
                  ),
                ),
              ],
              SizedBox(height: spacing.md),
              Expanded(
                child: otherParticipants.isEmpty
                    ? _buildEmptyState(context)
                    : ListView.separated(
                        itemCount: otherParticipants.length,
                        separatorBuilder: (_, __) => SizedBox(height: spacing.sm),
                        itemBuilder: (context, index) =>
                            _buildParticipantItem(otherParticipants[index], liveKitService),
                      ),
              ),
              SizedBox(height: spacing.md),
              if (_notificationMessage != null) _buildNotification(),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: EdgeInsets.all(spacing.lg),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.sentiment_satisfied_alt,
                color: AppColors.textMuted, size: 40),
          ),
          SizedBox(height: spacing.md),
          Text(
            'No additional participants',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          SizedBox(height: spacing.xs),
          Text(
            'Invite attendees by sharing the room link.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildParticipantItem(dynamic participant, LiveKitService liveKitService) {
    final participantIdentity = participant.identity as String;
    final status = _participantStatuses[participantIdentity] ?? 
        ParticipantStatus(audioEnabled: false, videoEnabled: false);
    final hasRaisedHand = _raisedHands[participantIdentity] ?? false;
    final isRemoving = _removingParticipant == participantIdentity;
    final isMuting = _mutingParticipant == participantIdentity;
    final isProcessing = isRemoving || isMuting;
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final cleanName = _getCleanName(participantIdentity);
    
    return Container(
      padding: EdgeInsets.all(spacing.sm),
      decoration: BoxDecoration(
        color: hasRaisedHand 
            ? AppColors.warning.withOpacity(0.1)
            : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: hasRaisedHand 
              ? AppColors.warning.withOpacity(0.5)
              : AppColors.outline.withOpacity(0.6),
          width: hasRaisedHand ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: hasRaisedHand
                ? AppColors.warning.withOpacity(0.2)
                : AppColors.primary.withOpacity(0.18),
            child: Text(
              cleanName.isNotEmpty
                  ? cleanName[0].toUpperCase()
                  : '?',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(
                    color: hasRaisedHand ? AppColors.warning : AppColors.primary,
                  ),
            ),
          ),
          SizedBox(width: spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        cleanName,
                        style: Theme.of(context).textTheme.titleMedium,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    if (hasRaisedHand)
                      Padding(
                        padding: EdgeInsets.only(left: spacing.xs),
                        child: Icon(
                          Icons.front_hand,
                          size: 18,
                          color: AppColors.warning,
                        ),
                      ),
                  ],
                ),
                SizedBox(height: spacing.xs),
                Wrap(
                  spacing: spacing.sm,
                  runSpacing: spacing.xs,
                  children: [
                    _buildStatusIndicator(
                      icon: status.audioEnabled ? Icons.mic : Icons.mic_off,
                      enabled: status.audioEnabled,
                      label: status.audioEnabled ? 'Audio On' : 'Audio Off',
                    ),
                    _buildStatusIndicator(
                      icon: status.videoEnabled ? Icons.videocam : Icons.videocam_off,
                      enabled: status.videoEnabled,
                      label: status.videoEnabled ? 'Video On' : 'Video Off',
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(width: spacing.xs),
          PopupMenuButton<String>(
            icon: Icon(
              Icons.more_vert,
              color: AppColors.textSecondary,
            ),
            iconSize: 20,
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: AppColors.surfaceElevated,
            elevation: 8,
            onSelected: (value) {
              switch (value) {
                case 'mute':
                  // If audio is enabled (unmuted), we want to mute (pass true)
                  // If audio is disabled (muted), we want to unmute (pass false)
                  _muteParticipant(participantIdentity, status.audioEnabled);
                  break;
                case 'video':
                  _requestVideoControl(participantIdentity, !status.videoEnabled, liveKitService);
                  break;
                case 'remove':
                  _removeParticipant(participantIdentity);
                  break;
              }
            },
            itemBuilder: (BuildContext context) => [
              PopupMenuItem<String>(
                value: 'mute',
                enabled: !isMuting && !isProcessing,
                child: Row(
                  children: [
                    if (isMuting)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.textPrimary),
                        ),
                      )
                    else
                      Icon(
                        status.audioEnabled ? Icons.mic_off : Icons.mic,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                    SizedBox(width: spacing.sm),
                    Text(
                      status.audioEnabled ? 'Mute' : 'Unmute',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ],
                ),
              ),
              PopupMenuItem<String>(
                value: 'video',
                child: Row(
                  children: [
                    Icon(
                      status.videoEnabled ? Icons.videocam_off : Icons.videocam,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                    SizedBox(width: spacing.sm),
                    Flexible(
                      child: Text(
                        'Request ${status.videoEnabled ? 'Camera Off' : 'Camera On'}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w500,
                            ),
                        overflow: TextOverflow.ellipsis,
                          ),
                    ),
                  ],
                ),
              ),
              PopupMenuDivider(),
              PopupMenuItem<String>(
                value: 'remove',
                enabled: !isRemoving && !isProcessing,
                child: Row(
                  children: [
                    if (isRemoving)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.danger),
                        ),
                      )
                    else
                      Icon(
                        Icons.person_remove_alt_1,
                        size: 18,
                        color: AppColors.danger,
                      ),
                    SizedBox(width: spacing.sm),
                    Text(
                      'Remove from Meeting',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.danger,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIndicator({
    required IconData icon,
    required bool enabled,
    required String label,
  }) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final color = enabled ? AppColors.success : AppColors.textMuted;
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        SizedBox(width: spacing.xs),
        Flexible(
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
      ],
    );
  }

  Widget _buildNotification() {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final Color backgroundColor;
    final Color foregroundColor;

    switch (_notificationType) {
      case 'success':
        backgroundColor = AppColors.success.withOpacity(0.18);
        foregroundColor = AppColors.success;
        break;
      case 'error':
        backgroundColor = AppColors.danger.withOpacity(0.18);
        foregroundColor = AppColors.danger;
        break;
      default:
        backgroundColor = AppColors.info.withOpacity(0.18);
        foregroundColor = AppColors.info;
    }

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(spacing.sm),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: foregroundColor.withOpacity(0.4)),
      ),
      child: Text(
        _notificationMessage!,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(color: foregroundColor, fontWeight: FontWeight.w600),
        textAlign: TextAlign.center,
      ),
    );
  }

  void _muteParticipant(String participantIdentity, bool mute) async {
    setState(() {
      _mutingParticipant = participantIdentity;
    });

    try {
      Logger.debug(' Muting participant: $participantIdentity, mute: $mute', 'participant_manager_widget');
      
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      
      // Send mute command via data channel (this actually mutes the participant)
      try {
        await liveKitService.sendMuteControlCommand(
          targetParticipant: participantIdentity,
          mute: mute,
          allowUnmute: true,
        );
        Logger.debug(' Data channel mute command sent successfully', 'participant_manager_widget');
      } catch (e) {
        Logger.warning(' Data channel mute command failed: $e', 'participant_manager_widget');
      }
      
      // Also call API to mute on server side (for consistency)
      final response = await ApiService.muteParticipant(
        roomName: widget.roomName,
        participantIdentity: participantIdentity,
        mute: mute,
      );
      
      if (response['success'] == true) {
        Logger.debug(' API mute command successful', 'participant_manager_widget');
        // Update status immediately and then again after a short delay
        _updateParticipantStatuses(liveKitService);
        Future.delayed(const Duration(milliseconds: 800), () {
          if (mounted) {
            _updateParticipantStatuses(liveKitService);
          }
        });
        
        setState(() {
          _notificationMessage = '${_getCleanName(participantIdentity)} ${mute ? 'muted' : 'unmuted'} successfully';
          _notificationType = 'success';
        });
        
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _notificationMessage = null;
              _notificationType = null;
            });
          }
        });
      } else {
        throw Exception(response['error'] ?? 'Failed to mute participant');
      }
      
    } catch (error) {
      Logger.error(' Error muting participant: $error', null, null, 'participant_manager_widget');
      setState(() {
        _notificationMessage = 'Failed to mute participant: $error';
        _notificationType = 'error';
      });
      
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
        _mutingParticipant = null;
      });
    }
  }

  void _muteAllParticipants(LiveKitService liveKitService) async {
    final hostIdentity = liveKitService.localParticipant?.identity;
    if (hostIdentity == null) return;

    setState(() {
      _isMutingAll = true;
    });

    try {
      Logger.debug(' Muting all participants', 'participant_manager_widget');
      
      // Send mute all command via data channel (this actually mutes all participants)
      try {
        await liveKitService.sendMuteAllCommand(allowUnmute: true);
        Logger.debug(' Data channel mute all command sent successfully', 'participant_manager_widget');
      } catch (e) {
        Logger.warning(' Data channel mute all command failed: $e', 'participant_manager_widget');
      }
      
      // Also call API to mute on server side (for consistency)
      final response = await ApiService.muteAllParticipants(
        roomName: widget.roomName,
        hostIdentity: hostIdentity,
      );
      
      if (response['success'] == true) {
        Logger.debug(' API mute all command successful', 'participant_manager_widget');
        // Update status immediately and then again after a short delay
        _updateParticipantStatuses(liveKitService);
        Future.delayed(const Duration(milliseconds: 800), () {
          if (mounted) {
            _updateParticipantStatuses(liveKitService);
          }
        });
        
        setState(() {
          _notificationMessage = response['message'] as String? ?? 'All participants muted';
          _notificationType = 'success';
        });
        
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _notificationMessage = null;
              _notificationType = null;
            });
          }
        });
      } else {
        throw Exception(response['error'] ?? 'Failed to mute all participants');
      }
      
    } catch (error) {
      Logger.error(' Error muting all participants: $error', null, null, 'participant_manager_widget');
      setState(() {
        _notificationMessage = 'Failed to mute all participants: $error';
        _notificationType = 'error';
      });
      
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
        _isMutingAll = false;
      });
    }
  }

  void _requestVideoControl(String participantIdentity, bool turnOn, LiveKitService liveKitService) async {
    try {
      Logger.debug(' Requesting video control: $participantIdentity, turnOn: $turnOn', 'participant_manager_widget');
      
      await liveKitService.sendVideoRequest(
        targetParticipant: participantIdentity,
        turnOn: turnOn,
      );
      
      // Refresh participant status after video request
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          final liveKitService = Provider.of<LiveKitService>(context, listen: false);
          _updateParticipantStatuses(liveKitService);
        }
      });
      
      setState(() {
        _notificationMessage = 'Request sent to ${_getCleanName(participantIdentity)}';
        _notificationType = 'success';
      });
      
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          setState(() {
            _notificationMessage = null;
            _notificationType = null;
          });
        }
      });
      
    } catch (error) {
      Logger.error(' Error sending video request: $error', null, null, 'participant_manager_widget');
      setState(() {
        _notificationMessage = 'Failed to send request: $error';
        _notificationType = 'error';
      });
      
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() {
            _notificationMessage = null;
            _notificationType = null;
          });
        }
      });
    }
  }

  void _removeParticipant(String participantIdentity) async {
    setState(() {
      _removingParticipant = participantIdentity;
    });

    try {
      Logger.debug(' Removing participant: $participantIdentity', 'participant_manager_widget');
      
      final response = await ApiService.removeParticipant(
        roomName: widget.roomName,
        participantIdentity: participantIdentity,
      );
      
      if (response['success'] == true) {
        setState(() {
          _notificationMessage = '${_getCleanName(participantIdentity)} removed successfully';
          _notificationType = 'success';
        });
        
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _notificationMessage = null;
              _notificationType = null;
            });
          }
        });
      } else {
        throw Exception(response['error'] ?? 'Failed to remove participant');
      }
      
    } catch (error) {
      Logger.error(' Error removing participant: $error', null, null, 'participant_manager_widget');
      setState(() {
        _notificationMessage = 'Failed to remove participant: $error';
        _notificationType = 'error';
      });
      
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
