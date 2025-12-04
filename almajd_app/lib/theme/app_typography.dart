import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Application wide typography styles.
class AppTypography {
  AppTypography._();

  static TextTheme textTheme = TextTheme(
    displayLarge: _base.copyWith(fontSize: 48, fontWeight: FontWeight.w700),
    displayMedium: _base.copyWith(fontSize: 40, fontWeight: FontWeight.w700),
    displaySmall: _base.copyWith(fontSize: 32, fontWeight: FontWeight.w700),
    headlineLarge: _base.copyWith(fontSize: 28, fontWeight: FontWeight.w700),
    headlineMedium: _base.copyWith(fontSize: 24, fontWeight: FontWeight.w600),
    headlineSmall: _base.copyWith(fontSize: 20, fontWeight: FontWeight.w600),
    titleLarge: _base.copyWith(fontSize: 18, fontWeight: FontWeight.w600),
    titleMedium: _base.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
    titleSmall: _base.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
    bodyLarge: _base.copyWith(fontSize: 16, fontWeight: FontWeight.w500),
    bodyMedium: _base.copyWith(fontSize: 14, fontWeight: FontWeight.w400),
    bodySmall: _base.copyWith(fontSize: 12, fontWeight: FontWeight.w400),
    labelLarge: _base.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
    labelMedium: _base.copyWith(fontSize: 12, fontWeight: FontWeight.w500),
    labelSmall: _base.copyWith(fontSize: 10, fontWeight: FontWeight.w500),
  );

  static final TextStyle _base = GoogleFonts.urbanist(
    color: Colors.white,
    letterSpacing: 0.2,
  );
}

