import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import '../../../utils/responsive.dart';

class AppBottomSheet extends StatelessWidget {
  const AppBottomSheet({
    super.key,
    required this.title,
    required this.children,
    this.leading,
    this.trailing,
    this.padding,
  });

  final String title;
  final List<Widget> children;
  final Widget? leading;
  final Widget? trailing;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return Padding(
      padding: EdgeInsets.only(
        top: spacing.lg,
        left: spacing.lg,
        right: spacing.lg,
        bottom: MediaQuery.of(context).padding.bottom + Responsive.spacing(
          context,
          phone: spacing.lg,
          tablet: spacing.xl,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (leading != null) ...[
                leading!,
                SizedBox(width: spacing.sm),
              ],
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          SizedBox(height: spacing.lg),
          ...children,
        ],
      ),
    );
  }

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    required List<Widget> children,
    Widget? leading,
    Widget? trailing,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceElevated,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(
            Responsive.value(context, phone: 28.0, tablet: 32.0),
          ),
        ),
      ),
      transitionAnimationController: null, // Use default smooth animation
      enableDrag: true, // Allow dragging to dismiss
      isDismissible: true,
      useSafeArea: true,
      builder: (context) => AppBottomSheet(
        title: title,
        children: children,
        leading: leading,
        trailing: trailing,
      ),
    );
  }
}

