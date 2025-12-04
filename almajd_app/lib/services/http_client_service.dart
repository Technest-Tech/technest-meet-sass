import 'package:dio/dio.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:flutter/foundation.dart';
import 'dart:io';
import '../config/app_config.dart';
import '../utils/logger.dart';
import 'retry_interceptor.dart';

class HttpClientService {
  static Dio? _dio;
  static CookieJar? _cookieJar;

  static Future<Dio> get dio async {
    if (_dio != null) {
      return _dio!;
    }

    // Initialize cookie jar
    if (_cookieJar == null) {
      Directory? appDocDir;
      if (Platform.isAndroid || Platform.isIOS) {
        appDocDir = await getApplicationDocumentsDirectory();
      } else {
        appDocDir = await getApplicationSupportDirectory();
      }
      
      final cookiePath = path.join(appDocDir.path, '.cookies');
      final cookieDir = Directory(cookiePath);
      if (!await cookieDir.exists()) {
        await cookieDir.create(recursive: true);
      }
      
      _cookieJar = PersistCookieJar(
        storage: FileStorage(cookiePath),
      );
    }

    // Create Dio instance with cookie manager
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 15), // Reduced for faster failure detection
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Add retry interceptor first (so it can retry after other interceptors)
    _dio!.interceptors.add(RetryInterceptor(
      dio: _dio!,
      retries: 3,
      retryDelays: const [
        Duration(seconds: 1),
        Duration(seconds: 2),
        Duration(seconds: 4),
      ],
    ));

    // Add logging interceptor (only in debug mode)
    if (kDebugMode) {
      _dio!.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (object) => Logger.debug(object.toString(), 'Dio'),
      ));
    }

    // Add cookie manager interceptor
    _dio!.interceptors.add(CookieManager(_cookieJar!));

    return _dio!;
  }

  static Future<void> clearCookies() async {
    if (_cookieJar != null) {
      await _cookieJar!.deleteAll();
    }
  }
}

