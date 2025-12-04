import 'dart:async';
import '../utils/logger.dart';

import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/logger.dart';

import 'room_entry_screen.dart';
import '../utils/logger.dart';

/// Professional splash screen with smooth animations and modern design.
///
/// Features:
/// - Smooth fade-in and scale-up logo animation
/// - Animated gradient background
/// - Shimmer loading indicator
/// - Auto-navigation after configurable duration
/// - Fully responsive design
class SplashScreen extends StatefulWidget {
  const SplashScreen({
    super.key,
    this.duration = const Duration(milliseconds: 2500),
    this.logoPath = 'assets/icons/logo_splash.png',
    this.nextScreen,
    this.appName = 'Academiq Meet',
    this.tagline = 'Connecting reciters worldwide',
    this.description = 'Your trusted platform for online learning and virtual meetings',
  });

  /// Duration before navigating to next screen
  final Duration duration;

  /// Path to the logo asset
  final String logoPath;

  /// Next screen to navigate to (defaults to RoomEntryScreen)
  final Widget? nextScreen;

  /// App name to display below logo
  final String appName;

  /// Short descriptive sentence below app name
  final String description;

  /// Tagline to display at bottom
  final String tagline;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _logoController;
  late final AnimationController _shimmerController;
  late final AnimationController _gradientController;

  late final Animation<double> _logoFadeAnimation;
  late final Animation<double> _logoScaleAnimation;
  late final Animation<double> _textFadeAnimation;
  late final Animation<Offset> _textSlideAnimation;
  late final Animation<double> _shimmerAnimation;
  late final Animation<double> _gradientAnimation;

  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();

    // Logo animation controller (fade + scale)
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    // Spinner rotation controller
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // Gradient animation controller (subtle pulse)
    _gradientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    // Logo animations
    _logoFadeAnimation = CurvedAnimation(
      parent: _logoController,
      curve: Curves.easeOut,
    );
    _logoScaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoController,
        curve: Curves.easeOutBack,
      ),
    );

    // Text animations (delayed slightly after logo)
    _textFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoController,
        curve: const Interval(0.3, 1.0, curve: Curves.easeOut),
      ),
    );
    _textSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _logoController,
        curve: const Interval(0.3, 1.0, curve: Curves.easeOutCubic),
      ),
    );

    // Spinner rotation animation
    _shimmerAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _shimmerController,
        curve: Curves.linear,
      ),
    );

    // Gradient animation (subtle brightness variation)
    _gradientAnimation = Tween<double>(begin: 0.0, end: 0.1).animate(
      CurvedAnimation(
        parent: _gradientController,
        curve: Curves.easeInOut,
      ),
    );

    // Start logo animation
    _logoController.forward();

    // Navigate after duration
    _navigationTimer = Timer(widget.duration, _navigateToNext);
  }

  void _navigateToNext() {
    if (!mounted) return;

    // Always navigate to home screen (RoomEntryScreen)
    final nextScreen = widget.nextScreen ?? const RoomEntryScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (_, __, ___) => nextScreen,
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOut,
            ),
            child: child,
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _logoController.dispose();
    _shimmerController.dispose();
    _gradientController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isSmallScreen = size.height < 700;

    return Scaffold(
      body: AnimatedBuilder(
        animation: _gradientAnimation,
        builder: (context, child) {
          return DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  _adjustBrightness(
                    const Color(0xFF0F172A), // Deep navy
                    _gradientAnimation.value,
                  ),
                  _adjustBrightness(
                    const Color(0xFF1E293B), // Dark blue-gray
                    _gradientAnimation.value * 0.5,
                  ),
                  _adjustBrightness(
                    const Color(0xFF0A0E1A), // Almost black
                    _gradientAnimation.value * 0.3,
                  ),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
            child: child,
          );
        },
        child: Stack(
          children: [
            // Decorative orbs (subtle background elements)
            _buildDecorativeOrbs(size),

            // Main content
            SafeArea(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo with animation
                    _buildAnimatedLogo(isSmallScreen),

                    SizedBox(height: isSmallScreen ? 20 : 28),

                    // App name with animation
                    _buildAppName(isSmallScreen),

                    // Description sentence
                    SizedBox(height: isSmallScreen ? 12 : 16),
                    _buildDescription(isSmallScreen),

                    SizedBox(height: isSmallScreen ? 40 : 60),

                    // Modern spinner
                    _buildModernSpinner(),
                  ],
                ),
              ),
            ),

            // Tagline at bottom
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 32.0),
                  child: _buildTagline(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _adjustBrightness(Color color, double amount) {
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withLightness(
          (hsl.lightness + amount).clamp(0.0, 1.0),
        )
        .toColor();
  }

  Widget _buildDecorativeOrbs(Size size) {
    return Stack(
      children: [
        // Top-right orb
        Positioned(
          right: -size.width * 0.15,
          top: -size.height * 0.1,
          child: _BlurredOrb(
            diameter: size.width * 0.4,
            color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
          ),
        ),
        // Bottom-left orb
        Positioned(
          left: -size.width * 0.2,
          bottom: size.height * 0.15,
          child: _BlurredOrb(
            diameter: size.width * 0.5,
            color: const Color(0xFF1E40AF).withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }

  Widget _buildAnimatedLogo(bool isSmallScreen) {
    // Increased logo size for wider display
    final logoSize = isSmallScreen ? 70.0 : 85.0;
    // Container with generous padding (25px padding on each side)
    final containerSize = isSmallScreen ? 120.0 : 135.0;

    return FadeTransition(
      opacity: _logoFadeAnimation,
      child: ScaleTransition(
        scale: _logoScaleAnimation,
        child: Container(
          width: containerSize,
          height: containerSize,
          padding: const EdgeInsets.all(25), // Very generous padding to prevent clipping
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.1),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 30,
                offset: const Offset(0, 15),
                spreadRadius: 0,
              ),
              BoxShadow(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                blurRadius: 40,
                offset: const Offset(0, 20),
                spreadRadius: -10,
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Image.asset(
            widget.logoPath,
            width: logoSize,
            height: logoSize,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              return Icon(
                Icons.apps_rounded,
                size: logoSize * 0.6,
                color: Colors.white70,
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAppName(bool isSmallScreen) {
    return FadeTransition(
      opacity: _textFadeAnimation,
      child: SlideTransition(
        position: _textSlideAnimation,
        child: Text(
          widget.appName,
          style: GoogleFonts.poppins(
            color: Colors.white,
            fontSize: isSmallScreen ? 22 : 26,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildDescription(bool isSmallScreen) {
    return FadeTransition(
      opacity: _logoFadeAnimation,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: isSmallScreen ? 32.0 : 48.0),
        child: Text(
          widget.description,
          style: GoogleFonts.poppins(
            color: Colors.white.withValues(alpha: 0.85),
            fontSize: isSmallScreen ? 13 : 15,
            fontWeight: FontWeight.w400,
            letterSpacing: 0.2,
            height: 1.4,
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  Widget _buildModernSpinner() {
    return AnimatedBuilder(
      animation: _shimmerAnimation,
      builder: (context, child) {
        return SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer rotating gradient ring
              Transform.rotate(
                angle: _shimmerAnimation.value * 2 * 3.14159,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: SweepGradient(
                      center: Alignment.center,
                      startAngle: 0,
                      endAngle: 3.14159 * 2,
                      colors: [
                        const Color(0xFF3B82F6).withValues(alpha: 0.0),
                        const Color(0xFF3B82F6).withValues(alpha: 0.0),
                        const Color(0xFF60A5FA),
                        const Color(0xFF93C5FD),
                        const Color(0xFF60A5FA),
                        const Color(0xFF3B82F6).withValues(alpha: 0.0),
                        const Color(0xFF3B82F6).withValues(alpha: 0.0),
                      ],
                      stops: const [0.0, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0],
                    ),
                  ),
                  child: Container(
                    margin: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.transparent,
                    ),
                  ),
                ),
              ),
              // Inner pulsing dot
              AnimatedBuilder(
                animation: _gradientController,
                builder: (context, child) {
                  return Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF60A5FA).withValues(
                        alpha: 0.6 + (_gradientAnimation.value * 0.4),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF60A5FA).withValues(
                            alpha: 0.4 + (_gradientAnimation.value * 0.3),
                          ),
                          blurRadius: 8,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTagline() {
    return AnimatedOpacity(
      opacity: _logoFadeAnimation.value * 0.8,
      duration: const Duration(milliseconds: 300),
      child: Text(
        widget.tagline,
        style: GoogleFonts.poppins(
          color: Colors.white.withValues(alpha: 0.6),
          fontSize: 14,
          letterSpacing: 0.3,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

/// Decorative blurred orb for background ambiance
class _BlurredOrb extends StatelessWidget {
  const _BlurredOrb({
    required this.diameter,
    required this.color,
  });

  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(
            color: color,
            blurRadius: diameter * 0.6,
            spreadRadius: diameter * 0.2,
          ),
        ],
      ),
    );
  }
}
