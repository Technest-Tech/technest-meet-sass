import 'package:flutter/material.dart';
import '../services/connection_monitor_service.dart';
import '../theme/app_colors.dart';

/// Widget to display connection quality indicator
class ConnectionQualityIndicator extends StatelessWidget {
  final QualityLevel quality;
  final bool showLabel;
  final bool showDetails;
  final ConnectionStats? stats;

  const ConnectionQualityIndicator({
    super.key,
    required this.quality,
    this.showLabel = true,
    this.showDetails = false,
    this.stats,
  });

  @override
  Widget build(BuildContext context) {
    final color = _getQualityColor(quality);
    final label = _getQualityLabel(quality);
    final icon = _getQualityIcon(quality);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color,
          width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: color,
            size: 16,
          ),
          if (showLabel) ...[
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (showDetails && stats != null) ...[
            const SizedBox(width: 8),
            _buildStats(context, stats!),
          ],
        ],
      ),
    );
  }

  Color _getQualityColor(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return AppColors.success;
      case QualityLevel.good:
        return AppColors.info;
      case QualityLevel.fair:
        return AppColors.warning;
      case QualityLevel.poor:
        return AppColors.danger;
    }
  }

  String _getQualityLabel(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return 'Excellent';
      case QualityLevel.good:
        return 'Good';
      case QualityLevel.fair:
        return 'Fair';
      case QualityLevel.poor:
        return 'Poor';
    }
  }

  IconData _getQualityIcon(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return Icons.signal_wifi_4_bar;
      case QualityLevel.good:
        return Icons.signal_wifi_4_bar;
      case QualityLevel.fair:
        return Icons.signal_wifi_4_bar; // Use 4_bar as fallback since 2_bar doesn't exist
      case QualityLevel.poor:
        return Icons.signal_wifi_0_bar;
    }
  }

  Widget _buildStats(BuildContext context, ConnectionStats stats) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildStatItem('${(stats.bitrate / 1000).toStringAsFixed(0)}k', 'Bitrate'),
        const SizedBox(width: 8),
        _buildStatItem('${stats.packetLoss.toStringAsFixed(1)}%', 'Loss'),
        const SizedBox(width: 8),
        _buildStatItem('${stats.latency.toStringAsFixed(0)}ms', 'Latency'),
      ],
    );
  }

  Widget _buildStatItem(String value, String label) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 8,
          ),
        ),
      ],
    );
  }
}

/// Compact connection quality indicator (just icon)
class CompactConnectionQualityIndicator extends StatelessWidget {
  final QualityLevel quality;
  final double size;

  const CompactConnectionQualityIndicator({
    super.key,
    required this.quality,
    this.size = 16,
  });

  @override
  Widget build(BuildContext context) {
    final color = _getQualityColor(quality);
    final icon = _getQualityIcon(quality);

    return Tooltip(
      message: _getQualityLabel(quality),
      child: Icon(
        icon,
        color: color,
        size: size,
      ),
    );
  }

  Color _getQualityColor(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return AppColors.success;
      case QualityLevel.good:
        return AppColors.info;
      case QualityLevel.fair:
        return AppColors.warning;
      case QualityLevel.poor:
        return AppColors.danger;
    }
  }

  String _getQualityLabel(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return 'Excellent Connection';
      case QualityLevel.good:
        return 'Good Connection';
      case QualityLevel.fair:
        return 'Fair Connection';
      case QualityLevel.poor:
        return 'Poor Connection';
    }
  }

  IconData _getQualityIcon(QualityLevel quality) {
    switch (quality) {
      case QualityLevel.excellent:
        return Icons.signal_wifi_4_bar;
      case QualityLevel.good:
        return Icons.signal_wifi_4_bar;
      case QualityLevel.fair:
        return Icons.signal_wifi_4_bar; // Use 4_bar as fallback since 2_bar doesn't exist
      case QualityLevel.poor:
        return Icons.signal_wifi_0_bar;
    }
  }
}

