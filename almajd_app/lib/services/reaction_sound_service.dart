import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import '../utils/logger.dart';

// Reaction types matching web version
typedef ReactionType = String;

class ReactionSoundService {
  static final ReactionSoundService _instance = ReactionSoundService._internal();
  factory ReactionSoundService() => _instance;
  ReactionSoundService._internal();

  final AudioPlayer _audioPlayer = AudioPlayer();
  Timer? _stopTimer;
  bool _isInitialized = false;

  // Initialize audio context (for Flutter, we use AudioPlayer)
  Future<void> _ensureInitialized() async {
    if (!_isInitialized) {
      // Set audio mode for better sound playback
      await _audioPlayer.setReleaseMode(ReleaseMode.stop);
      _isInitialized = true;
    }
  }

  // Play audio file with 3 second limit
  Future<void> _playAudioFile(String assetPath, {int maxDurationSeconds = 3}) async {
    await _ensureInitialized();
    
    try {
      // Cancel any existing timer
      _stopTimer?.cancel();
      
      // Stop any currently playing sound
      await _audioPlayer.stop();
      
      // Play the audio file
      await _audioPlayer.play(AssetSource(assetPath));
      
      // Set timer to stop after maxDurationSeconds
      _stopTimer = Timer(Duration(seconds: maxDurationSeconds), () async {
        await _audioPlayer.stop();
      });
      
      Logger.debug('Playing $assetPath (max ${maxDurationSeconds}s)', 'ReactionSoundService');
    } catch (e) {
      Logger.warning('Error playing audio file: $e', 'ReactionSoundService');
    }
  }

  // Play reaction sound based on type
  Future<void> playReactionSound(ReactionType reactionType) async {
    try {
      // Map reactions to sound files
      final soundMap = <ReactionType, String>{
        '👍': 'sounds/365scores_like.mp3',
        '❤️': 'sounds/my_love.mp3',
        '😂': 'sounds/laughs.mp3',
        '👏': 'sounds/clap.mp3',
        '🎉': 'sounds/children_celebrating.mp3',
        '😮': 'sounds/wow.mp3',
        '🙌': 'sounds/wow.mp3',
      };

      final soundFile = soundMap[reactionType];
      if (soundFile != null) {
        await _playAudioFile(soundFile, maxDurationSeconds: 3);
      } else {
        // Fallback to default sound
        await _playAudioFile('sounds/wow.mp3', maxDurationSeconds: 3);
      }
    } catch (e) {
      Logger.warning('Error playing reaction sound: $e', 'ReactionSoundService');
    }
  }

  // Play raise hand sound
  Future<void> playRaiseHandSound(bool isRaised) async {
    try {
      if (isRaised) {
        // Raising hand - play default gentle sound
        await _playAudioFile('sounds/365scores_like.mp3', maxDurationSeconds: 1);
      } else {
        // Lowering hand - no sound needed
      }
    } catch (e) {
      Logger.warning('Error playing raise hand sound: $e', 'ReactionSoundService');
    }
  }

  // Play waiting room guest notification sound
  Future<void> playWaitingRoomNotificationSound() async {
    try {
      // Use the like sound for waiting room notifications
      await _playAudioFile('sounds/365scores_like.mp3', maxDurationSeconds: 2);
      Logger.debug('Playing waiting room notification sound', 'ReactionSoundService');
    } catch (e) {
      Logger.warning('Error playing waiting room notification sound: $e', 'ReactionSoundService');
      // Fallback to clap sound if like sound doesn't exist
      try {
        await _playAudioFile('sounds/clap.mp3', maxDurationSeconds: 2);
      } catch (fallbackError) {
        Logger.warning('Fallback sound also failed: $fallbackError', 'ReactionSoundService');
      }
    }
  }

  // Dispose resources
  void dispose() {
    _stopTimer?.cancel();
    _audioPlayer.dispose();
    _isInitialized = false;
  }
}

