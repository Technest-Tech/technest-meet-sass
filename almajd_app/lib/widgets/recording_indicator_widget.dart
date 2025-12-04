import 'dart:async';
import '../utils/logger.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';

class RecordingIndicatorWidget extends StatefulWidget {
  const RecordingIndicatorWidget({
    super.key,
    required this.startTime,
    this.onPauseToggle,
    this.isPaused = false,
  });

  final DateTime startTime;
  final VoidCallback? onPauseToggle;
  final bool isPaused;

  @override
  State<RecordingIndicatorWidget> createState() => _RecordingIndicatorWidgetState();
}

class _RecordingIndicatorWidgetState extends State<RecordingIndicatorWidget> {
  Timer? _timer;
  Duration _elapsed = Duration.zero;
  DateTime? _lastPauseTime;
  Duration _totalPausedTime = Duration.zero;

  @override
  void initState() {
    super.initState();
    _updateElapsed();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _updateElapsed();
        });
      }
    });
  }

  @override
  void didUpdateWidget(RecordingIndicatorWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Handle pause state changes
    if (oldWidget.isPaused != widget.isPaused) {
      if (widget.isPaused && !oldWidget.isPaused) {
        // Just paused - record the pause time
        _lastPauseTime = DateTime.now();
      } else if (!widget.isPaused && oldWidget.isPaused) {
        // Just resumed - add to total paused time
        final lastPauseTime = _lastPauseTime;
        if (lastPauseTime != null) {
          _totalPausedTime += DateTime.now().difference(lastPauseTime);
          _lastPauseTime = null;
        }
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _updateElapsed() {
    if (widget.isPaused) {
      // Don't update elapsed time when paused - keep current value
      // But still account for current pause if it just started
      if (_lastPauseTime != null) {
        final currentPauseDuration = DateTime.now().difference(_lastPauseTime!);
        final now = DateTime.now();
        final rawElapsed = now.difference(widget.startTime);
        _elapsed = rawElapsed - _totalPausedTime - currentPauseDuration;
      }
      return;
    }
    // Calculate elapsed time minus total paused time
    final now = DateTime.now();
    final rawElapsed = now.difference(widget.startTime);
    _elapsed = rawElapsed - _totalPausedTime;
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    
    if (hours > 0) {
      return '${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return GestureDetector(
      onTap: widget.onPauseToggle,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.md,
          vertical: spacing.sm,
        ),
        decoration: BoxDecoration(
          color: widget.isPaused 
              ? AppColors.warning.withOpacity(0.9)
              : AppColors.danger.withOpacity(0.9),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: (widget.isPaused ? AppColors.warning : AppColors.danger).withOpacity(0.4),
              blurRadius: 18,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: AppColors.textPrimary,
                shape: BoxShape.circle,
              ),
            ),
            SizedBox(width: spacing.sm),
            Text(
              widget.isPaused ? 'Paused' : 'Recording',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            SizedBox(width: spacing.sm),
            Container(
              padding: EdgeInsets.symmetric(horizontal: spacing.xs, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.textPrimary.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _formatDuration(_elapsed),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontFeatures: [const FontFeature.tabularFigures()],
                    ),
              ),
            ),
            if (widget.onPauseToggle != null) ...[
              SizedBox(width: spacing.xs),
              Icon(
                widget.isPaused ? Icons.play_arrow : Icons.pause,
                size: 16,
                color: AppColors.textPrimary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

