import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';

enum AppButtonVariant { primary, secondary, danger, ghost }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.leading,
    this.trailing,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.fullWidth = true,
    this.padding,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? leading;
  final Widget? trailing;
  final AppButtonVariant variant;
  final bool isLoading;
  final bool fullWidth;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final theme = Theme.of(context);

    final Color backgroundColor;
    final Color foregroundColor;
    final BorderSide borderSide;

    switch (variant) {
      case AppButtonVariant.primary:
        backgroundColor = AppColors.primary;
        foregroundColor = AppColors.textPrimary;
        borderSide = BorderSide.none;
        break;
      case AppButtonVariant.secondary:
        backgroundColor = AppColors.surfaceMuted;
        foregroundColor = AppColors.textPrimary;
        borderSide = const BorderSide(color: AppColors.outline);
        break;
      case AppButtonVariant.danger:
        backgroundColor = AppColors.danger;
        foregroundColor = AppColors.textPrimary;
        borderSide = BorderSide.none;
        break;
      case AppButtonVariant.ghost:
        backgroundColor = Colors.transparent;
        foregroundColor = AppColors.textSecondary;
        borderSide = const BorderSide(color: AppColors.outline);
        break;
    }

    final child = AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: isLoading
          ? SizedBox(
              key: const ValueKey('loading'),
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation<Color>(foregroundColor),
              ),
            )
          : Row(
              key: const ValueKey('content'),
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (leading != null) ...[
                  leading!,
                  SizedBox(width: spacing.xs),
                ],
                Flexible(
                  child: Text(
                    label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: foregroundColor,
                      letterSpacing: 0.6,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (trailing != null) ...[
                  SizedBox(width: spacing.xs),
                  trailing!,
                ],
              ],
            ),
    );

    final button = Semantics(
      button: true,
      enabled: !isLoading && onPressed != null,
      label: label,
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: padding ??
              EdgeInsets.symmetric(
                horizontal: spacing.lg,
                vertical: spacing.sm,
              ),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(18),
            border: borderSide == BorderSide.none
                ? null
                : Border.fromBorderSide(borderSide),
            boxShadow: variant == AppButtonVariant.ghost
                ? null
                : [
                    BoxShadow(
                      color: backgroundColor.withOpacity(0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          child: Center(child: child),
        ),
      ),
    );

    if (fullWidth) {
      return SizedBox(width: double.infinity, child: button);
    }

    return button;
  }
}

