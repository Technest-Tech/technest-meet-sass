import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import '../services/livekit_service.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import 'video_participant_widget.dart';
import '../utils/logger.dart';

class PipMeetingWidget extends StatelessWidget {
  final VoidCallback? onTap;
  final VoidCallback? onEndCall;

  const PipMeetingWidget({
    super.key,
    this.onTap,
    this.onEndCall,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        // Get the primary participant to display (prefer remote, fallback to local)
        dynamic primaryParticipant;
        
        if (liveKitService.participants.isNotEmpty) {
          primaryParticipant = liveKitService.participants.first;
        } else if (liveKitService.localParticipant != null) {
          primaryParticipant = liveKitService.localParticipant;
        }

        return GestureDetector(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                children: [
                  // Video content
                  if (primaryParticipant != null)
                    Positioned.fill(
                      child: VideoParticipantWidget(
                        participant: primaryParticipant,
                        isLocal: primaryParticipant == liveKitService.localParticipant,
                      ),
                    )
                  else
                    Positioned.fill(
                      child: Container(
                        color: AppColors.surfaceMuted,
                        child: const Center(
                          child: CircularProgressIndicator(
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                  
                  // Overlay with controls
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withOpacity(0.7),
                          ],
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Mute/Unmute button
                          _buildControlButton(
                            context,
                            icon: liveKitService.localParticipant
                                    ?.isMicrophoneEnabled() ??
                                false
                                ? Icons.mic
                                : Icons.mic_off,
                            onPressed: () {
                              liveKitService.toggleMicrophone();
                            },
                            isActive: liveKitService.localParticipant
                                    ?.isMicrophoneEnabled() ??
                                false,
                          ),
                          
                          // Participant count
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated.withOpacity(0.8),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.group,
                                  size: 14,
                                  color: AppColors.textPrimary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${liveKitService.participants.length + 1}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              ],
                            ),
                          ),
                          
                          // End call button
                          _buildControlButton(
                            context,
                            icon: Icons.call_end,
                            onPressed: onEndCall,
                            isDanger: true,
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  // Tap indicator (subtle hint)
                  if (onTap != null)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated.withOpacity(0.7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.open_in_full,
                          size: 16,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildControlButton(
    BuildContext context, {
    required IconData icon,
    required VoidCallback? onPressed,
    bool isActive = false,
    bool isDanger = false,
  }) {
    final color = isDanger
        ? AppColors.danger
        : isActive
            ? AppColors.success
            : AppColors.textSecondary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated.withOpacity(0.8),
            shape: BoxShape.circle,
            border: Border.all(
              color: color.withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Icon(
            icon,
            size: 20,
            color: color,
          ),
        ),
      ),
    );
  }
}

