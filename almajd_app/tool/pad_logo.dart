import 'dart:io';

import 'package:image/image.dart';

Future<void> main(List<String> args) async {
  final projectDir = Directory.current.path;
  final logoPath = '$projectDir/assets/icons/logo.png';
  final outputPath = '$projectDir/assets/icons/logo_splash.png';

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

  const padding = 80; // pixels of transparent padding on each side
  final padded = Image(
    width: original.width + padding * 2,
    height: original.height + padding * 2,
    numChannels: 4,
  );

  padded.clear(ColorRgba8(0, 0, 0, 0));
  compositeImage(
    padded,
    original,
    dstX: padding,
    dstY: padding,
    blend: BlendMode.direct,
  );

  await File(outputPath).writeAsBytes(encodePng(padded));
  stdout.writeln('Created padded splash logo at $outputPath');
}
