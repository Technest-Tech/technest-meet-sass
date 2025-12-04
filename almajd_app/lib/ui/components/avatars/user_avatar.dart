import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.initials,
    this.size = 72,
    this.statusColor,
    this.imageUrl,
    this.showGlow = false,
  });

  final String initials;
  final double size;
  final Color? statusColor;
  final String? imageUrl;
  final bool showGlow;

  @override
  Widget build(BuildContext context) {
    final avatar = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [
            Color(0xFF2E2E3F),
            Color(0xFF1A1A28),
          ],
        ),
        border: Border.all(color: AppColors.outline.withOpacity(0.6)),
      ),
      child: ClipOval(
        child: imageUrl != null
            ? Image.network(imageUrl!, fit: BoxFit.cover)
            : Center(
                child: Text(
                  initials.toUpperCase(),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
      ),
    );

    if (statusColor == null && !showGlow) {
      return avatar;
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        if (showGlow)
          Container(
            width: size + 18,
            height: size + 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColors.primary.withOpacity(0.35),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        avatar,
        if (statusColor != null)
          Positioned(
            bottom: 6,
            right: 6,
            child: Container(
              width: size * 0.24,
              height: size * 0.24,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
              ),
              child: Container(
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: statusColor,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

