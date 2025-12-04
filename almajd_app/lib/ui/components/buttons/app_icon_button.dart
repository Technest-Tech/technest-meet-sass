import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';

enum AppIconButtonState { normal, active, danger }

class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.label,
    this.state = AppIconButtonState.normal,
    this.isToggled = false,
    this.semanticLabel,
    this.dimension = 58,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? label;
  final AppIconButtonState state;
  final bool isToggled;
  final String? semanticLabel;
  final double dimension;

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final theme = Theme.of(context);

    Color background;
    Color foreground;

    switch (state) {
      case AppIconButtonState.normal:
        background = isToggled ? AppColors.primary : AppColors.surfaceMuted;
        foreground = isToggled ? AppColors.textPrimary : AppColors.textSecondary;
        break;
      case AppIconButtonState.active:
        background = AppColors.accent.withOpacity(isToggled ? 1 : 0.15);
        foreground = isToggled ? AppColors.textPrimary : AppColors.accent;
        break;
      case AppIconButtonState.danger:
        background = isToggled ? AppColors.danger : AppColors.surfaceMuted;
        foreground = isToggled ? AppColors.textPrimary : AppColors.danger;
        break;
    }

    final button = Semantics(
      button: true,
      toggled: isToggled,
      label: semanticLabel ?? label ?? icon.codePoint.toString(),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: dimension,
          height: dimension,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isToggled ? Colors.transparent : AppColors.outline,
            ),
            boxShadow: [
              BoxShadow(
                color: background.withOpacity(0.35),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Icon(icon, color: foreground, size: 28),
        ),
      ),
    );

    if (label == null) {
      return button;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        button,
        SizedBox(height: spacing.xs),
        Text(
          label!,
          style: theme.textTheme.labelMedium?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

