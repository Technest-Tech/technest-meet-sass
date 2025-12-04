import 'dart:io';

import 'package:image/image.dart';

Future<void> main(List<String> args) async {
  final projectDir = Directory.current.path;
  final logoPath = '$projectDir/assets/icons/logo.png';
  final outputPath = '$projectDir/assets/icons/logo_splash_small.png';

  final file = File(logoPath);
  if (!file.existsSync()) {
    stderr.writeln('Logo not found at $logoPath');
    exit(1);
  }

  final bytes = await file.readAsBytes();
  final original = decodeImage(bytes);
  if (original == null) {
    stderr.writeln('Unable to decode logo image.');
    exit(1);
  }

  // Resize to 60% of original size for smaller native splash logo
  final scale = 0.6;
  final newWidth = (original.width * scale).round();
  final newHeight = (original.height * scale).round();
  
  final resized = copyResize(
    original,
    width: newWidth,
    height: newHeight,
    interpolation: Interpolation.cubic,
  );

  await File(outputPath).writeAsBytes(encodePng(resized));
  stdout.writeln('Created smaller splash logo at $outputPath (${newWidth}x${newHeight})');
}

