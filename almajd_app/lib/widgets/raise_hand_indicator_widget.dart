import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';

class RaiseHandIndicatorWidget extends StatelessWidget {
  const RaiseHandIndicatorWidget({
    super.key,
    required this.raisedHands,
  });

  final Map<String, bool> raisedHands;

  @override
  Widget build(BuildContext context) {
    if (raisedHands.isEmpty) {
      return const SizedBox.shrink();
    }

    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final raisedHandsList = raisedHands.keys.toList();

    return Positioned(
      top: MediaQuery.of(context).padding.top + 80,
      right: spacing.md,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 200),
        padding: EdgeInsets.all(spacing.sm),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withOpacity(0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.outline.withOpacity(0.6),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.front_hand,
                  color: AppColors.accent,
                  size: 20,
                ),
                SizedBox(width: spacing.xs),
                Text(
                  'Raised Hands',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            SizedBox(height: spacing.xs),
            ...raisedHandsList.map((participantIdentity) {
              // Clean name - remove _host_1, _guest_1 suffixes
              final cleanName = participantIdentity.replaceAll(RegExp(r'_(host|guest)_\d+$'), '');
              
              return Padding(
                padding: EdgeInsets.only(top: spacing.xs),
                child: Row(
                  children: [
                    const Icon(
                      Icons.person,
                      color: AppColors.textSecondary,
                      size: 16,
                    ),
                    SizedBox(width: spacing.xs),
                    Expanded(
                      child: Text(
                        cleanName,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

