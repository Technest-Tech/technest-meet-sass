import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';
import '../ui/components/modal/app_bottom_sheet.dart';
import '../utils/logger.dart';

// Reaction types matching web version
const List<String> REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '😮', '🙌'];

class ReactionsButtonWidget extends StatelessWidget {
  const ReactionsButtonWidget({
    super.key,
    required this.onReactionSelected,
    this.disabled = false,
  });

  final Function(String reactionType) onReactionSelected;
  final bool disabled;

  void _showReactionPicker(BuildContext context) {
    if (disabled) return;

    AppBottomSheet.show(
      context: context,
      title: 'Send Reaction',
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.0,
          ),
          itemCount: REACTIONS.length,
          itemBuilder: (context, index) {
            final reaction = REACTIONS[index];
            return _ReactionEmojiButton(
              emoji: reaction,
              onTap: () {
                Navigator.of(context).pop();
                onReactionSelected(reaction);
              },
            );
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return GestureDetector(
      onTap: () => _showReactionPicker(context),
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: disabled
              ? AppColors.surfaceMuted.withOpacity(0.5)
              : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: AppColors.outline.withOpacity(0.6),
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            '😊',
            style: TextStyle(
              fontSize: 24,
              color: disabled ? AppColors.textMuted : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

class _ReactionEmojiButton extends StatelessWidget {
  const _ReactionEmojiButton({
    required this.emoji,
    required this.onTap,
  });

  final String emoji;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.outline.withOpacity(0.6),
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            emoji,
            style: const TextStyle(fontSize: 32),
          ),
        ),
      ),
    );
  }
}

