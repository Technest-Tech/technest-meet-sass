import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import 'app_gradient_background.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    this.title,
    this.actions,
    this.onBack,
    required this.body,
    this.bottomBar,
    this.extendBodyBehindAppBar = false,
  });

  final String? title;
  final List<Widget>? actions;
  final VoidCallback? onBack;
  final Widget body;
  final Widget? bottomBar;
  final bool extendBodyBehindAppBar;

  @override
  Widget build(BuildContext context) {
    final scaffold = Scaffold(
      extendBody: true,
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      backgroundColor: Colors.transparent,
      appBar: title == null && onBack == null && (actions == null || actions!.isEmpty)
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              title: title == null
                  ? null
                  : Text(
                      title!,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
              centerTitle: false,
              leading: onBack == null
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.textSecondary),
                      onPressed: onBack,
                    ),
              actions: actions,
            ),
      body: SafeArea(child: body),
      bottomNavigationBar: bottomBar,
    );

    return AppGradientBackground(child: scaffold);
  }
}

