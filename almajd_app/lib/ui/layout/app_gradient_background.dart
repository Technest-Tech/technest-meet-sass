import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class AppGradientBackground extends StatelessWidget {
  const AppGradientBackground({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF101020),
            Color(0xFF040407),
          ],
        ),
      ),
      child: child,
    );
  }
}

