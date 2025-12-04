import 'dart:math';
import '../utils/logger.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';

class FloatingReaction {
  FloatingReaction({
    required this.id,
    required this.reactionType,
    required this.startX,
    required this.startY,
    required this.endX,
    required this.endY,
    required this.startTime,
  });

  final String id;
  final String reactionType;
  final double startX;
  final double startY;
  final double endX;
  final double endY;
  final int startTime;
}

class FloatingReactionsWidget extends StatefulWidget {
  const FloatingReactionsWidget({
    super.key,
    required this.reactions,
  });

  final List<FloatingReaction> reactions;

  @override
  State<FloatingReactionsWidget> createState() => _FloatingReactionsWidgetState();
}

class _FloatingReactionsWidgetState extends State<FloatingReactionsWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: widget.reactions.map((reaction) {
          return _FloatingReactionItem(
            key: ValueKey(reaction.id),
            reaction: reaction,
            animationController: _controller,
          );
        }).toList(),
      ),
    );
  }
}

class _FloatingReactionItem extends StatefulWidget {
  const _FloatingReactionItem({
    super.key,
    required this.reaction,
    required this.animationController,
  });

  final FloatingReaction reaction;
  final AnimationController animationController;

  @override
  State<_FloatingReactionItem> createState() => _FloatingReactionItemState();
}

class _FloatingReactionItemState extends State<_FloatingReactionItem>
    with SingleTickerProviderStateMixin {
  static const int animationDuration = 3000; // 3 seconds
  late AnimationController _controller;
  late Animation<double> _positionAnimation;
  late Animation<double> _opacityAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: animationDuration),
    );

    // Position animation - move from start to end
    _positionAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    // Opacity animation - fade out
    _opacityAnimation = Tween<double>(
      begin: 1.0,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.6, 1.0, curve: Curves.easeOut),
    ));

    // Scale animation - slight scale up then down
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.5, end: 1.2),
        weight: 0.3,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 1.0),
        weight: 0.7,
      ),
    ]).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final currentX = widget.reaction.startX +
            (widget.reaction.endX - widget.reaction.startX) *
                _positionAnimation.value;
        final currentY = widget.reaction.startY +
            (widget.reaction.endY - widget.reaction.startY) *
                _positionAnimation.value;

        // Add some horizontal drift for more natural movement
        final drift = sin(_positionAnimation.value * pi * 2) * 30;

        return Positioned(
          left: currentX + drift - 20, // Center the emoji (assuming ~40px width)
          top: currentY - 20, // Center the emoji (assuming ~40px height)
          child: Opacity(
            opacity: _opacityAnimation.value,
            child: Transform.scale(
              scale: _scaleAnimation.value,
              child: Text(
                widget.reaction.reactionType,
                style: const TextStyle(
                  fontSize: 40,
                  shadows: [
                    Shadow(
                      color: Colors.black54,
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// Helper class to manage floating reactions
class FloatingReactionsManager {
  final List<FloatingReaction> _reactions = [];
  final Random _random = Random();

  List<FloatingReaction> get reactions => List.unmodifiable(_reactions);

  void addReaction(String reactionType, Size screenSize) {
    // Start from random position in bottom 30% of screen
    final startX = _random.nextDouble() * screenSize.width;
    final startY = screenSize.height * 0.7 +
        _random.nextDouble() * (screenSize.height * 0.3);

    // End at random position in top 30% of screen
    final endX = _random.nextDouble() * screenSize.width;
    final endY = _random.nextDouble() * (screenSize.height * 0.3);

    final reaction = FloatingReaction(
      id: '${DateTime.now().millisecondsSinceEpoch}-${_random.nextInt(10000)}',
      reactionType: reactionType,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      startTime: DateTime.now().millisecondsSinceEpoch,
    );

    _reactions.add(reaction);

    // Remove old reactions after animation duration
    Future.delayed(const Duration(milliseconds: 3000), () {
      _reactions.remove(reaction);
    });
  }

  void clear() {
    _reactions.clear();
  }
}

