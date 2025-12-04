import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../store/media_quality_store.dart';
import '../theme/app_colors.dart';

/// Widget for selecting video quality
class VideoQualitySelector extends StatefulWidget {
  final bool showScreenShareQuality;
  final void Function(VideoQualityPreference)? onQualityChanged;

  const VideoQualitySelector({
    super.key,
    this.showScreenShareQuality = false,
    this.onQualityChanged,
  });

  @override
  State<VideoQualitySelector> createState() => _VideoQualitySelectorState();
}

class _VideoQualitySelectorState extends State<VideoQualitySelector> {
  @override
  Widget build(BuildContext context) {
    return Consumer<MediaQualityStore>(
      builder: (context, qualityStore, child) {
        if (!qualityStore.isInitialized) {
          return const SizedBox.shrink();
        }

        final currentQuality = widget.showScreenShareQuality
            ? qualityStore.screenShareQuality
            : qualityStore.videoQuality;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.showScreenShareQuality ? 'Screen Share Quality' : 'Video Quality',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            _buildQualityOption(
              context,
              'Auto',
              VideoQualityPreference.auto,
              currentQuality,
              'Automatically adjust based on connection',
              qualityStore,
            ),
            const SizedBox(height: 8),
            _buildQualityOption(
              context,
              'Low',
              VideoQualityPreference.low,
              currentQuality,
              '360p - Best for slow connections',
              qualityStore,
            ),
            const SizedBox(height: 8),
            _buildQualityOption(
              context,
              'Medium',
              VideoQualityPreference.medium,
              currentQuality,
              '540p - Balanced quality and performance',
              qualityStore,
            ),
            const SizedBox(height: 8),
            _buildQualityOption(
              context,
              'High',
              VideoQualityPreference.high,
              currentQuality,
              '720p - Best quality (requires good connection)',
              qualityStore,
            ),
          ],
        );
      },
    );
  }

  Widget _buildQualityOption(
    BuildContext context,
    String label,
    VideoQualityPreference quality,
    VideoQualityPreference currentQuality,
    String description,
    MediaQualityStore qualityStore,
  ) {
    final isSelected = quality == currentQuality;

    return InkWell(
      onTap: () async {
        if (widget.showScreenShareQuality) {
          await qualityStore.setScreenShareQuality(quality);
        } else {
          await qualityStore.setVideoQuality(quality);
        }
        widget.onQualityChanged?.call(quality);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withOpacity(0.2)
              : AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.outline,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                  width: 2,
                ),
                color: isSelected ? AppColors.primary : Colors.transparent,
              ),
              child: isSelected
                  ? const Icon(
                      Icons.check,
                      size: 14,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

