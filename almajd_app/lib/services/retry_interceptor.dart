import 'package:dio/dio.dart';
import '../utils/logger.dart';

/// Interceptor that retries failed requests with exponential backoff
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int retries;
  final List<Duration> retryDelays;
  final bool Function(DioException)? retryable;

  RetryInterceptor({
    required this.dio,
    this.retries = 3,
    List<Duration>? retryDelays,
    this.retryable,
  }) : retryDelays = retryDelays ??
            [
              const Duration(seconds: 1),
              const Duration(seconds: 2),
              const Duration(seconds: 4),
            ];

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final shouldRetry = _shouldRetry(err);
    
    if (!shouldRetry) {
      return super.onError(err, handler);
    }

    final options = err.requestOptions;
    final retryCount = options.extra['retryCount'] as int? ?? 0;

    if (retryCount >= retries) {
      Logger.warning(
        'Max retries ($retries) reached for ${options.path}',
        'RetryInterceptor',
      );
      return super.onError(err, handler);
    }

    // Calculate delay
    final delay = retryCount < retryDelays.length
        ? retryDelays[retryCount]
        : retryDelays.last;

    Logger.debug(
      'Retrying ${options.path} (attempt ${retryCount + 1}/$retries) after ${delay.inSeconds}s',
      'RetryInterceptor',
    );

    // Wait before retrying
    await Future.delayed(delay);

    // Update retry count
    options.extra['retryCount'] = retryCount + 1;

    try {
      // Retry the request using the stored Dio instance
      final response = await dio.fetch(options);
      return handler.resolve(response);
    } catch (e) {
      if (e is DioException) {
        return onError(e, handler);
      }
      return super.onError(
        DioException(
          requestOptions: options,
          error: e,
        ),
        handler,
      );
    }
  }

  bool _shouldRetry(DioException error) {
    // Use custom retryable function if provided
    if (retryable != null) {
      return retryable!(error);
    }

    // Retry on network errors
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError) {
      return true;
    }

    // Retry on 5xx server errors
    if (error.response != null) {
      final statusCode = error.response!.statusCode;
      if (statusCode != null && statusCode >= 500 && statusCode < 600) {
        return true;
      }
      // Retry on 429 (Too Many Requests)
      if (statusCode == 429) {
        return true;
      }
    }

    return false;
  }
}

