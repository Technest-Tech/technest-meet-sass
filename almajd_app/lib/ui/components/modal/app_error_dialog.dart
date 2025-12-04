import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';

enum ErrorType {
  roomNotFound, // 404
  roomRestricted, // 403 - multi participants not allowed
  connectionError,
  tokenError,
  permissionError,
  serverError,
  unknown,
}

class AppErrorDialog extends StatelessWidget {
  final ErrorType errorType;
  final String title;
  final String message;
  final String? details;
  final VoidCallback? onRetry;
  final VoidCallback? onDismiss;
  final bool showRetry;

  const AppErrorDialog({
    super.key,
    required this.errorType,
    required this.title,
    required this.message,
    this.details,
    this.onRetry,
    this.onDismiss,
    this.showRetry = true,
  });

  IconData _getErrorIcon() {
    switch (errorType) {
      case ErrorType.roomNotFound:
        return Icons.search_off_rounded;
      case ErrorType.roomRestricted:
        return Icons.lock_outline_rounded;
      case ErrorType.connectionError:
        return Icons.wifi_off_rounded;
      case ErrorType.tokenError:
        return Icons.key_off_rounded;
      case ErrorType.permissionError:
        return Icons.block_rounded;
      case ErrorType.serverError:
        return Icons.error_outline_rounded;
      case ErrorType.unknown:
        return Icons.help_outline_rounded;
    }
  }

  Color _getErrorColor() {
    switch (errorType) {
      case ErrorType.roomNotFound:
        return AppColors.warning;
      case ErrorType.roomRestricted:
        return AppColors.warningOrange;
      case ErrorType.connectionError:
        return AppColors.info;
      case ErrorType.tokenError:
        return AppColors.danger;
      case ErrorType.permissionError:
        return AppColors.danger;
      case ErrorType.serverError:
        return AppColors.danger;
      case ErrorType.unknown:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final errorColor = _getErrorColor();
    final errorIcon = _getErrorIcon();

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Padding(
          padding: EdgeInsets.all(spacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Error Icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: errorColor.withOpacity(0.15),
                ),
                child: Icon(
                  errorIcon,
                  size: 40,
                  color: errorColor,
                ),
              ),
              SizedBox(height: spacing.lg),
              // Title
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: spacing.sm),
              // Message
              Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              // Details (if provided)
              if (details != null) ...[
                SizedBox(height: spacing.sm),
                Container(
                  padding: EdgeInsets.all(spacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    details!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textMuted,
                          fontFamily: 'monospace',
                        ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
              SizedBox(height: spacing.lg),
              // Action Buttons
              Row(
                children: [
                  if (onDismiss != null)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onDismiss,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: AppColors.outline),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: EdgeInsets.symmetric(vertical: spacing.md),
                        ),
                        child: Text(
                          'Go Back',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    ),
                  if (onDismiss != null && showRetry && onRetry != null)
                    SizedBox(width: spacing.md),
                  if (showRetry && onRetry != null)
                    Expanded(
                      child: ElevatedButton(
                        onPressed: onRetry,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.textPrimary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: EdgeInsets.symmetric(vertical: spacing.md),
                        ),
                        child: const Text('Retry'),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Show error dialog with automatic error type detection
  static Future<void> show({
    required BuildContext context,
    required ErrorType errorType,
    String? title,
    String? message,
    String? details,
    VoidCallback? onRetry,
    VoidCallback? onDismiss,
    bool showRetry = true,
  }) {
    // Default titles and messages based on error type
    String defaultTitle = title ?? _getDefaultTitle(errorType);
    String defaultMessage = message ?? _getDefaultMessage(errorType);

    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.6),
      builder: (context) => AppErrorDialog(
        errorType: errorType,
        title: defaultTitle,
        message: defaultMessage,
        details: details,
        onRetry: onRetry,
        onDismiss: onDismiss ?? () => Navigator.of(context).pop(),
        showRetry: showRetry,
      ),
    );
  }

  /// Show error dialog from exception/error
  static Future<void> showFromError({
    required BuildContext context,
    required dynamic error,
    String? title,
    String? message,
    VoidCallback? onRetry,
    VoidCallback? onDismiss,
    bool showRetry = true,
  }) {
    ErrorType errorType = ErrorType.unknown;
    String? errorDetails;

    // Parse error to determine type
    final errorString = error.toString().toLowerCase();
    if (errorString.contains('404') || errorString.contains('not found')) {
      errorType = ErrorType.roomNotFound;
    } else if (errorString.contains('403') || 
               errorString.contains('forbidden') ||
               errorString.contains('multi participants') ||
               errorString.contains('room restriction')) {
      errorType = ErrorType.roomRestricted;
    } else if (errorString.contains('connection') || 
               errorString.contains('network') ||
               errorString.contains('timeout')) {
      errorType = ErrorType.connectionError;
    } else if (errorString.contains('token') || 
               errorString.contains('unauthorized') ||
               errorString.contains('401')) {
      errorType = ErrorType.tokenError;
    } else if (errorString.contains('permission')) {
      errorType = ErrorType.permissionError;
    } else if (errorString.contains('500') || 
               errorString.contains('server')) {
      errorType = ErrorType.serverError;
    }

    errorDetails = error.toString();

    return show(
      context: context,
      errorType: errorType,
      title: title,
      message: message,
      details: errorDetails,
      onRetry: onRetry,
      onDismiss: onDismiss,
      showRetry: showRetry,
    );
  }

  static String _getDefaultTitle(ErrorType errorType) {
    switch (errorType) {
      case ErrorType.roomNotFound:
        return 'Room Not Found';
      case ErrorType.roomRestricted:
        return 'Room Access Restricted';
      case ErrorType.connectionError:
        return 'Connection Error';
      case ErrorType.tokenError:
        return 'Authentication Error';
      case ErrorType.permissionError:
        return 'Permission Denied';
      case ErrorType.serverError:
        return 'Server Error';
      case ErrorType.unknown:
        return 'Error Occurred';
    }
  }

  static String _getDefaultMessage(ErrorType errorType) {
    switch (errorType) {
      case ErrorType.roomNotFound:
        return 'The room link you entered doesn\'t exist or has been removed. Please check the link and try again.';
      case ErrorType.roomRestricted:
        return 'This room doesn\'t allow multiple participants at the same time. You will be connected as host.';
      case ErrorType.connectionError:
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case ErrorType.tokenError:
        return 'Your session has expired or the authentication token is invalid. Please try again.';
      case ErrorType.permissionError:
        return 'Required permissions are missing. Please grant the necessary permissions and try again.';
      case ErrorType.serverError:
        return 'The server encountered an error. Please try again later.';
      case ErrorType.unknown:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

