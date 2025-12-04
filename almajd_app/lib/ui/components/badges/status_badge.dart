import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  StatusBadge.success({Key? key, required this.label})
      : background = AppColors.success.withOpacity(0.2),
        foreground = AppColors.success,
        super(key: key);

  StatusBadge.warning({Key? key, required this.label})
      : background = AppColors.warning.withOpacity(0.2),
        foreground = AppColors.warning,
        super(key: key);

  StatusBadge.info({Key? key, required this.label})
      : background = AppColors.info.withOpacity(0.2),
        foreground = AppColors.info,
        super(key: key);

  StatusBadge.neutral({Key? key, required this.label})
      : background = AppColors.surfaceMuted,
        foreground = AppColors.textSecondary,
        super(key: key);

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

