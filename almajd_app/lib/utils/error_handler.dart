import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';

/// Error categories for better error handling
enum ErrorCategory {
  network,
  permission,
  authentication,
  authorization,
  server,
  timeout,
  validation,
  unknown,
}

/// Global error handler for the app
/// Provides user-friendly error messages and error reporting
class ErrorHandler {
  /// Handle and display user-friendly error messages
  static void handleError(
    BuildContext? context,
    dynamic error, {
    StackTrace? stackTrace,
    String? userMessage,
    bool showSnackBar = true,
    bool reportToCrashlytics = true,
    VoidCallback? onRetry,
  }) {
    // Log the error
    Logger.error(
      userMessage ?? 'An error occurred: $error',
      error,
      stackTrace,
      'ErrorHandler',
    );

    // Categorize error
    final category = _categorizeError(error);
    final message = _getUserFriendlyMessage(error, category);
    final canRetry = _canRetry(category);

    // Show user-friendly message if context is available
    if (context != null && showSnackBar && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(_getErrorIcon(category), color: Colors.white),
              const SizedBox(width: 12),
              Expanded(child: Text(message)),
            ],
          ),
          backgroundColor: _getErrorColor(category),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
          action: (canRetry && onRetry != null)
              ? SnackBarAction(
                  label: 'Retry',
                  textColor: Colors.white,
                  onPressed: onRetry,
                )
              : null,
        ),
      );
    }

    // In production, send to error reporting service
    if (kReleaseMode && reportToCrashlytics) {
      // TODO: Integrate with Firebase Crashlytics or Sentry
      // _reportToCrashlytics(error, stackTrace);
    }
  }

  /// Categorize error for better handling
  static ErrorCategory _categorizeError(dynamic error) {
    final errorString = error.toString().toLowerCase();

    if (errorString.contains('permission')) {
      return ErrorCategory.permission;
    } else if (errorString.contains('network') || 
               errorString.contains('connection') ||
               errorString.contains('socket')) {
      return ErrorCategory.network;
    } else if (errorString.contains('timeout')) {
      return ErrorCategory.timeout;
    } else if (errorString.contains('unauthorized') || 
               errorString.contains('401') ||
               errorString.contains('authentication')) {
      return ErrorCategory.authentication;
    } else if (errorString.contains('forbidden') || 
               errorString.contains('403') ||
               errorString.contains('authorization')) {
      return ErrorCategory.authorization;
    } else if (errorString.contains('server') || 
               errorString.contains('500') ||
               errorString.contains('502') ||
               errorString.contains('503')) {
      return ErrorCategory.server;
    } else if (errorString.contains('validation') ||
               errorString.contains('invalid') ||
               errorString.contains('not found')) {
      return ErrorCategory.validation;
    } else {
      return ErrorCategory.unknown;
    }
  }

  /// Get user-friendly error message from error object
  static String _getUserFriendlyMessage(dynamic error, ErrorCategory category) {
    switch (category) {
      case ErrorCategory.network:
        return 'Network error. Please check your internet connection and try again.';
      case ErrorCategory.permission:
        return 'Permission denied. Please enable required permissions in settings.';
      case ErrorCategory.timeout:
        return 'Request timed out. Please check your connection and try again.';
      case ErrorCategory.authentication:
        return 'Authentication failed. Please log in again.';
      case ErrorCategory.authorization:
        return 'Access denied. You don\'t have permission for this action.';
      case ErrorCategory.server:
        return 'Server error. Please try again in a moment.';
      case ErrorCategory.validation:
        final errorString = error.toString().toLowerCase();
        if (errorString.contains('room') && errorString.contains('not found')) {
          return 'Room not found. Please check the room name.';
        }
        return 'Invalid input. Please check your information and try again.';
      case ErrorCategory.unknown:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /// Check if error can be retried
  static bool _canRetry(ErrorCategory category) {
    return category == ErrorCategory.network ||
           category == ErrorCategory.timeout ||
           category == ErrorCategory.server;
  }

  /// Get error icon based on category
  static IconData _getErrorIcon(ErrorCategory category) {
    switch (category) {
      case ErrorCategory.network:
        return Icons.wifi_off;
      case ErrorCategory.permission:
        return Icons.lock_outline;
      case ErrorCategory.timeout:
        return Icons.schedule;
      case ErrorCategory.authentication:
        return Icons.login;
      case ErrorCategory.authorization:
        return Icons.block;
      case ErrorCategory.server:
        return Icons.cloud_off;
      case ErrorCategory.validation:
        return Icons.error_outline;
      case ErrorCategory.unknown:
        return Icons.error_outline;
    }
  }

  /// Get error color based on category
  static Color _getErrorColor(ErrorCategory category) {
    switch (category) {
      case ErrorCategory.network:
      case ErrorCategory.timeout:
        return Colors.orange;
      case ErrorCategory.permission:
      case ErrorCategory.authorization:
        return Colors.amber;
      case ErrorCategory.authentication:
        return Colors.blue;
      case ErrorCategory.server:
      case ErrorCategory.validation:
      case ErrorCategory.unknown:
        return Colors.red;
    }
  }

  /// Handle network errors specifically
  static void handleNetworkError(BuildContext? context, dynamic error) {
    handleError(
      context,
      error,
      userMessage: 'Network error. Please check your internet connection.',
    );
  }

  /// Handle permission errors specifically
  static void handlePermissionError(BuildContext? context, String permission) {
    handleError(
      context,
      'Permission denied: $permission',
      userMessage: 'Permission denied. Please enable $permission in settings.',
    );
  }

  /// Handle room validation errors
  static void handleRoomError(BuildContext? context, dynamic error) {
    handleError(
      context,
      error,
      userMessage: 'Room error. Please check the room name and try again.',
    );
  }
}



