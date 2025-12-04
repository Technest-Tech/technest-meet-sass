import 'package:flutter/material.dart';

/// Responsive utility class for handling device types, breakpoints, and responsive values
class Responsive {
  Responsive._();

  // Breakpoint constants
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 1200;
  static const double desktopBreakpoint = 1200;

  /// Get device type based on screen width
  static DeviceType getDeviceType(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < mobileBreakpoint) {
      return DeviceType.phone;
    } else if (width < tabletBreakpoint) {
      return DeviceType.tablet;
    } else {
      return DeviceType.desktop;
    }
  }

  /// Check if device is phone
  static bool isPhone(BuildContext context) {
    return getDeviceType(context) == DeviceType.phone;
  }

  /// Check if device is tablet
  static bool isTablet(BuildContext context) {
    return getDeviceType(context) == DeviceType.tablet;
  }

  /// Check if device is desktop
  static bool isDesktop(BuildContext context) {
    return getDeviceType(context) == DeviceType.desktop;
  }

  /// Check if device is mobile (phone or small tablet)
  static bool isMobile(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width < mobileBreakpoint;
  }

  /// Get screen width
  static double width(BuildContext context) {
    return MediaQuery.of(context).size.width;
  }

  /// Get screen height
  static double height(BuildContext context) {
    return MediaQuery.of(context).size.height;
  }

  /// Get screen orientation
  static Orientation orientation(BuildContext context) {
    return MediaQuery.of(context).orientation;
  }

  /// Check if in portrait mode
  static bool isPortrait(BuildContext context) {
    return orientation(context) == Orientation.portrait;
  }

  /// Check if in landscape mode
  static bool isLandscape(BuildContext context) {
    return orientation(context) == Orientation.landscape;
  }

  /// Get responsive value based on device type
  /// Returns phone value for phones, tablet value for tablets, desktop value for desktop
  static T value<T>(BuildContext context, {
    required T phone,
    T? tablet,
    T? desktop,
  }) {
    final deviceType = getDeviceType(context);
    switch (deviceType) {
      case DeviceType.phone:
        return phone;
      case DeviceType.tablet:
        return tablet ?? phone;
      case DeviceType.desktop:
        return desktop ?? tablet ?? phone;
    }
  }

  /// Get responsive value based on screen width
  /// Returns small value for small screens, large value for large screens
  static T valueByWidth<T>(BuildContext context, {
    required T small,
    required T large,
    double breakpoint = mobileBreakpoint,
  }) {
    final width = MediaQuery.of(context).size.width;
    return width < breakpoint ? small : large;
  }

  /// Calculate responsive grid columns for video layout
  /// Based on participant count and device type
  static int getVideoGridColumns(BuildContext context, int participantCount) {
    final deviceType = getDeviceType(context);
    final isPortraitMode = isPortrait(context);

    if (participantCount == 1) {
      return 1;
    } else if (participantCount == 2) {
      // 2 participants: 1 column on phone, 2 columns on tablet
      return deviceType == DeviceType.phone ? 1 : 2;
    } else if (participantCount <= 4) {
      // 3-4 participants: 2 columns on phone, 2 columns on tablet
      return deviceType == DeviceType.phone ? 2 : 2;
    } else if (participantCount <= 9) {
      // 5-9 participants: 2 columns on phone portrait, 3 on phone landscape/tablet
      if (deviceType == DeviceType.phone) {
        return isPortraitMode ? 2 : 3;
      } else {
        return 3;
      }
    } else {
      // 10+ participants: 3 columns on phone, 4 columns on tablet
      if (deviceType == DeviceType.phone) {
        return isPortraitMode ? 2 : 3;
      } else {
        return isPortraitMode ? 3 : 4;
      }
    }
  }

  /// Get responsive padding
  static EdgeInsets padding(BuildContext context, {
    double? all,
    double? horizontal,
    double? vertical,
    double? top,
    double? bottom,
    double? left,
    double? right,
  }) {
    final deviceType = getDeviceType(context);
    final basePadding = deviceType == DeviceType.phone ? 16.0 : 24.0;

    return EdgeInsets.only(
      top: top ?? vertical ?? all ?? basePadding,
      bottom: bottom ?? vertical ?? all ?? basePadding,
      left: left ?? horizontal ?? all ?? basePadding,
      right: right ?? horizontal ?? all ?? basePadding,
    );
  }

  /// Get responsive spacing
  static double spacing(BuildContext context, {
    double phone = 8.0,
    double? tablet,
    double? desktop,
  }) {
    return value(
      context,
      phone: phone,
      tablet: tablet ?? phone * 1.5,
      desktop: desktop ?? tablet ?? phone * 2,
    );
  }

  /// Get responsive font size
  static double fontSize(BuildContext context, {
    double phone = 14.0,
    double? tablet,
    double? desktop,
  }) {
    return value(
      context,
      phone: phone,
      tablet: tablet ?? phone * 1.1,
      desktop: desktop ?? tablet ?? phone * 1.2,
    );
  }

  /// Get responsive icon size
  static double iconSize(BuildContext context, {
    double phone = 24.0,
    double? tablet,
    double? desktop,
  }) {
    return value(
      context,
      phone: phone,
      tablet: tablet ?? phone * 1.2,
      desktop: desktop ?? tablet ?? phone * 1.4,
    );
  }

  /// Get max width for content centering on larger screens
  static double? maxContentWidth(BuildContext context) {
    final deviceType = getDeviceType(context);
    if (deviceType == DeviceType.phone) {
      return null; // Full width on phones
    } else if (deviceType == DeviceType.tablet) {
      return 800; // Max width for tablets
    } else {
      return 1200; // Max width for desktop
    }
  }
}

/// Device type enum
enum DeviceType {
  phone,
  tablet,
  desktop,
}

