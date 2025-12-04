import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import '../../../utils/responsive.dart';
import '../buttons/app_icon_button.dart';
import '../modal/app_bottom_sheet.dart';
import '../../../services/livekit_service.dart';

class MeetingControlDock extends StatefulWidget {
  const MeetingControlDock({
    super.key,
    required this.onToggleCamera,
    required this.onToggleMicrophone,
    required this.onToggleChat,
    required this.onLeave,
    required this.onToggleHand,
    this.cameraEnabled = true,
    this.microphoneEnabled = true,
    this.chatUnread = 0,
    this.handRaised = false,
    this.participantCount = 1,
    this.quickActions = const [],
    this.showChat = true,
    this.showRaiseHand = true,
    this.chatEnabled = true,
    this.raiseHandEnabled = true,
    this.isObserver = false,
  });

  final VoidCallback? onToggleCamera;
  final VoidCallback? onToggleMicrophone;
  final VoidCallback onToggleChat;
  final VoidCallback onToggleHand;
  final VoidCallback onLeave;
  final bool cameraEnabled;
  final bool microphoneEnabled;
  final int chatUnread;
  final bool handRaised;
  final int participantCount;
  final List<MeetingQuickAction> quickActions;
  final bool showChat;
  final bool showRaiseHand;
  final bool chatEnabled;
  final bool raiseHandEnabled;
  final bool isObserver;

  @override
  State<MeetingControlDock> createState() => _MeetingControlDockState();
}

class _MeetingControlDockState extends State<MeetingControlDock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  double _dragOffset = 0.0;
  bool _isDragging = false;
  bool _hasOpened = false;
  static const double _maxDragDistance = 400.0;
  static const double _openThreshold = 150.0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDragStart(DragStartDetails details) {
    _controller.stop();
    setState(() {
      _isDragging = true;
      _hasOpened = false;
    });
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (!_isDragging || _hasOpened) return;

    setState(() {
      // Negative delta = dragging up
      double delta = -details.primaryDelta!;
      _dragOffset = (_dragOffset + delta).clamp(-_maxDragDistance, 0);
      
      // Open when threshold reached
      if (_dragOffset <= -_openThreshold && !_hasOpened) {
        _hasOpened = true;
        widget.quickActions.isNotEmpty ? _openQuickActions() : null;
        _resetPosition();
      }
    });
  }

  void _onDragEnd(DragEndDetails details) {
    if (!_isDragging) return;

    final velocity = details.primaryVelocity ?? 0;
    bool shouldOpen = false;

    if (!_hasOpened) {
      if (_dragOffset <= -_openThreshold) {
        shouldOpen = true;
      } else if (velocity < -800) {
        // Fast upward swipe
        shouldOpen = true;
      } else if (_dragOffset <= -80 && velocity < -400) {
        // Moderate drag with upward velocity
        shouldOpen = true;
      }
    }

    if (shouldOpen && !_hasOpened && widget.quickActions.isNotEmpty) {
      _hasOpened = true;
      _openQuickActions();
    }

    setState(() {
      _isDragging = false;
    });

    _resetPosition();
  }

  void _onTap() {
    if (widget.quickActions.isNotEmpty && !_hasOpened) {
      _hasOpened = true;
      _openQuickActions();
    }
  }

  void _resetPosition() {
    if (_dragOffset == 0) return;
    
    _controller.reset();
    final startValue = _dragOffset;
    
    final animation = Tween<double>(
      begin: startValue,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    void listener() {
      if (mounted) {
        setState(() {
          _dragOffset = animation.value;
        });
      }
    }

    animation.addListener(listener);
    
    _controller.forward().then((_) {
      animation.removeListener(listener);
      if (mounted) {
        setState(() {
          _dragOffset = 0.0;
          _hasOpened = false;
        });
        _controller.reset();
      }
    });
  }

  void _openQuickActions() {
    // Use Consumer to make the bottom sheet reactive to LiveKitService state changes
    AppBottomSheet.show(
      context: context,
      title: 'Quick Actions',
      trailing: IconButton(
        icon: const Icon(Icons.close, color: AppColors.textSecondary),
        onPressed: () => Navigator.of(context).pop(),
      ),
      children: [
        // Use Selector to rebuild only when screen sharing state changes
        Selector<LiveKitService, bool>(
          selector: (_, service) => service.isScreenSharing,
          builder: (context, isScreenSharing, child) {
            // Get LiveKitService for building tiles
            final liveKitService = Provider.of<LiveKitService>(context, listen: false);
            // Rebuild quick actions list based on current state
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (int i = 0; i < widget.quickActions.length; i++) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: _buildQuickActionTile(i, liveKitService),
                  ),
                  if (i != widget.quickActions.length - 1)
                    const SizedBox(height: 4),
                ],
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildQuickActionTile(int index, LiveKitService liveKitService) {
    final action = widget.quickActions[index];
    
    // For screen share action, update icon and title based on current state
    IconData icon = action.icon;
    String title = action.title;
    bool isHighlighted = action.isHighlighted;
    
    // Check if this is the screen share action by checking if icon matches screen share icons
    if (action.icon == Icons.screen_share || action.icon == Icons.stop_screen_share) {
      icon = liveKitService.isScreenSharing
          ? Icons.stop_screen_share
          : Icons.screen_share;
      title = liveKitService.isScreenSharing
          ? 'Stop screen share'
          : 'Start screen share';
    }
    
    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      horizontalTitleGap: 14,
      dense: true,
      minVerticalPadding: 4,
      leading: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: isHighlighted
              ? (action.highlightColor ?? AppColors.danger).withOpacity(0.2)
              : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(
          icon,
          color: isHighlighted
              ? (action.highlightColor ?? AppColors.danger)
              : AppColors.textSecondary,
          size: 24,
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isHighlighted
                        ? (action.highlightColor ?? AppColors.danger)
                        : action.isDisabled
                            ? AppColors.textMuted
                            : AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          if (action.showProBadge)
            Container(
              margin: const EdgeInsets.only(left: 8),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'PRO',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                      letterSpacing: 0.5,
                    ),
              ),
            ),
        ],
      ),
      subtitle: action.subtitle == null
          ? null
          : Text(
              action.subtitle!,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textMuted),
            ),
      trailing: action.trailing,
      onTap: action.isDisabled
          ? null
          : () {
              Navigator.of(context).pop();
              action.onTap();
            },
    );
  }

  @override
  Widget build(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        spacing.xs,
        spacing.md,
        spacing.xs,
        spacing.xl,
      ),
      child: Transform.translate(
        offset: Offset(0, _dragOffset),
        child: GestureDetector(
          onVerticalDragStart: _onDragStart,
          onVerticalDragUpdate: _onDragUpdate,
          onVerticalDragEnd: _onDragEnd,
          onTap: widget.quickActions.isNotEmpty ? _onTap : null,
          child: Container(
            padding: Responsive.padding(
              context,
              horizontal: 18.0,
              vertical: 12.0,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated.withOpacity(0.96),
              borderRadius: BorderRadius.circular(
                Responsive.value(context, phone: 28.0, tablet: 32.0),
              ),
              border: Border.all(color: AppColors.outline.withOpacity(0.6)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 24,
                  offset: const Offset(0, 14),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.quickActions.isNotEmpty)
                  _DraggableHandle(
                    isDragging: _isDragging,
                    dragProgress: (_dragOffset.abs() / _openThreshold).clamp(0.0, 1.0),
                  ),
                LayoutBuilder(
                  builder: (context, constraints) {
                    // Calculate responsive spacing to prevent overflow
                    final buttonWidth = Responsive.value(context, phone: 48.0, tablet: 52.0);
                    final buttonCount = 5;
                    final minSpacing = Responsive.value(context, phone: 6.0, tablet: 8.0);
                    final totalButtonWidth = buttonWidth * buttonCount;
                    final availableWidth = constraints.maxWidth;
                    final baseSpacing = Responsive.value(context, phone: spacing.sm, tablet: spacing.md);
                    final totalSpacing = (buttonCount - 1) * baseSpacing;
                    final totalNeeded = totalButtonWidth + totalSpacing;
                    
                    // Calculate spacing that fits within available width
                    final calculatedSpacing = totalNeeded > availableWidth
                        ? ((availableWidth - totalButtonWidth) / (buttonCount - 1)).clamp(minSpacing, baseSpacing)
                        : baseSpacing;
                    
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Camera button - hidden for observers
                        if (!widget.isObserver) ...[
                          AppIconButton(
                            icon: widget.cameraEnabled ? Icons.videocam : Icons.videocam_off,
                            onPressed: widget.onToggleCamera,
                            label: 'Camera',
                            semanticLabel:
                                widget.cameraEnabled ? 'Disable camera' : 'Enable camera',
                            state: AppIconButtonState.normal,
                            isToggled: widget.cameraEnabled,
                            dimension: Responsive.value(context, phone: 48, tablet: 52),
                          ),
                          SizedBox(width: calculatedSpacing),
                        ],
                        // Microphone button - hidden for observers
                        if (!widget.isObserver) ...[
                          AppIconButton(
                            icon: widget.microphoneEnabled ? Icons.mic : Icons.mic_off,
                            onPressed: widget.onToggleMicrophone,
                            label: 'Mic',
                            semanticLabel:
                                widget.microphoneEnabled ? 'Mute microphone' : 'Unmute microphone',
                            state: AppIconButtonState.normal,
                            isToggled: widget.microphoneEnabled,
                            dimension: Responsive.value(context, phone: 48, tablet: 52),
                          ),
                          SizedBox(width: calculatedSpacing),
                        ],
                        // Chat button - hidden for observers
                        if (!widget.isObserver && widget.showChat) ...[
                          SizedBox(width: calculatedSpacing),
                          _buildBadge(
                            context,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                AppIconButton(
                                  icon: Icons.chat_bubble,
                                  onPressed: widget.chatEnabled ? widget.onToggleChat : null,
                                  label: 'Chat',
                                  semanticLabel: 'Open chat messages',
                                  state: AppIconButtonState.normal,
                                  isToggled: widget.chatUnread > 0,
                                  dimension: Responsive.value(context, phone: 48, tablet: 52),
                                ),
                                if (!widget.chatEnabled)
                                  Positioned(
                                    top: -4,
                                    right: -4,
                                    child: _buildProBadge(context),
                                  ),
                              ],
                            ),
                            count: widget.chatUnread,
                          ),
                        ],
                        // Raise hand button - hidden for observers
                        if (!widget.isObserver && widget.showRaiseHand) ...[
                          SizedBox(width: calculatedSpacing),
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              AppIconButton(
                                icon: Icons.front_hand,
                                onPressed: widget.raiseHandEnabled ? widget.onToggleHand : null,
                                label: 'Hand',
                                semanticLabel: widget.handRaised ? 'Lower hand' : 'Raise hand',
                                state: AppIconButtonState.active,
                                isToggled: widget.handRaised,
                                dimension: Responsive.value(context, phone: 48, tablet: 52),
                              ),
                              if (!widget.raiseHandEnabled)
                                Positioned(
                                  top: -4,
                                  right: -4,
                                  child: _buildProBadge(context),
                                ),
                            ],
                          ),
                        ],
                        SizedBox(width: calculatedSpacing),
                        AppIconButton(
                          icon: Icons.call_end,
                          onPressed: widget.onLeave,
                          label: 'Leave',
                          semanticLabel: 'Leave meeting',
                          state: AppIconButtonState.danger,
                          isToggled: true,
                          dimension: Responsive.value(context, phone: 48, tablet: 52),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(
    BuildContext context, {
    required Widget child,
    required int count,
    bool muted = false,
  }) {
    if (count <= 0) return child;

    final badgeColor = muted ? AppColors.surfaceMuted : AppColors.primary;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        Positioned(
          right: -2,
          top: -2,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: badgeColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.background, width: 2),
            ),
            child: Text(
              '$count',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProBadge(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF9333EA), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.background, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF9333EA).withOpacity(0.5),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        'PRO',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 9,
              letterSpacing: 0.8,
            ),
      ),
    );
  }
}

class MeetingQuickAction {
  MeetingQuickAction({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailing,
    this.isHighlighted = false,
    this.highlightColor,
    this.showProBadge = false,
    this.isDisabled = false,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final String? subtitle;
  final Widget? trailing;
  final bool isHighlighted;
  final Color? highlightColor;
  final bool showProBadge;
  final bool isDisabled;
}

class _DraggableHandle extends StatelessWidget {
  const _DraggableHandle({
    required this.isDragging,
    required this.dragProgress,
  });

  final bool isDragging;
  final double dragProgress;

  @override
  Widget build(BuildContext context) {
    final opacity = (0.8 - (dragProgress * 0.5)).clamp(0.3, 0.8);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Align(
        alignment: Alignment.topCenter,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 20),
          child: AnimatedContainer(
            duration: isDragging 
                ? const Duration(milliseconds: 0)
                : const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            width: 52,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.outline.withOpacity(opacity),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
    );
  }
}




