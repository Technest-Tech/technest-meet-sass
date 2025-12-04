import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import '../../../utils/responsive.dart';
import '../badges/observer_badge.dart';

class MeetingInfoBar extends StatelessWidget {
  const MeetingInfoBar({
    super.key,
    required this.title,
    required this.duration,
    this.participantCount,
    this.onSpeakerTap,
    this.isSpeakerOn = true,
    this.showObserverBadge = false,
  });

  final String title;
  final Duration duration;
  final int? participantCount;
  final VoidCallback? onSpeakerTap;
  final bool isSpeakerOn;
  final bool showObserverBadge;

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final isLandscape = Responsive.isLandscape(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        spacing.xs,
        spacing.lg,
        spacing.xs,
        isLandscape ? spacing.xxs : spacing.sm, // Reduce bottom padding in landscape only
      ),
      child: SizedBox(
        width: double.infinity,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: 18,
            vertical: isLandscape ? 12.0 : 14.0, // Slightly reduce vertical padding in landscape
          ),
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated.withOpacity(0.9),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.outline.withOpacity(0.35)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.25),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title.toLowerCase(),
                            style:
                                Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (showObserverBadge) ...[
                          const SizedBox(width: 8),
                          const ObserverBadge(),
                        ],
                      ],
                    ),
                    SizedBox(height: spacing.xxs),
                    Text(
                      _formatDuration(duration),
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              SizedBox(width: spacing.md),
              Container(
                decoration: const BoxDecoration(
                  color: AppColors.surfaceMuted,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  onPressed: onSpeakerTap,
                  icon: Icon(
                    isSpeakerOn ? Icons.volume_up : Icons.volume_off,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ),
              ),
              SizedBox(width: spacing.sm),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.group,
                        size: 18, color: AppColors.textPrimary),
                    SizedBox(width: spacing.xs),
                    Text(
                      '${participantCount ?? 0}',
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
  }
}

