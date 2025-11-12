import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../utils/logger.dart';
import '../services/livekit_service.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';
import '../ui/components/buttons/app_button.dart';
import '../utils/logger.dart';

class ChatMessage {
  final String id;
  final String sender;
  final String senderIdentity;
  final String message;
  final DateTime timestamp;
  final bool isLocal;
  final bool isPrivate;
  final String? recipientId;
  final String recipientType;

  ChatMessage({
    required this.id,
    required this.sender,
    required this.senderIdentity,
    required this.message,
    required this.timestamp,
    required this.isLocal,
    this.isPrivate = false,
    this.recipientId,
    this.recipientType = 'all',
  });
}

class ChatWidget extends StatefulWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final void Function(int)? onUnreadCountChange;

  const ChatWidget({
    super.key,
    required this.isOpen,
    required this.onClose,
    this.onUnreadCountChange,
  });

  @override
  State<ChatWidget> createState() => _ChatWidgetState();
}

class _ChatWidgetState extends State<ChatWidget> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  int _unreadCount = 0;
  bool _isConnected = false;
  String _recipientType = 'all'; // 'all', 'host', 'specific'
  String? _selectedRecipientId;
  bool _isHost = false;

  @override
  void initState() {
    super.initState();
    // Set up callback immediately - this ensures unread count works even when chat is closed
    _setupChatDataCallback();
    print('📬 Chat: Callback set up in initState, chat open: ${widget.isOpen}');
  }

  @override
  void didUpdateWidget(ChatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reset unread count when chat is opened
    if (widget.isOpen && !oldWidget.isOpen) {
      setState(() {
        _unreadCount = 0;
      });
      // Defer callback to avoid setState during build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onUnreadCountChange?.call(0);
        print('📬 Chat: Unread count reset to 0 (chat opened)');
      });
    }
    // Re-setup callback if needed (in case LiveKitService was recreated)
    if (widget.isOpen != oldWidget.isOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _setupChatDataCallback();
      });
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _setupChatDataCallback() {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    
    // Set up callback for chat data
    liveKitService.setChatDataCallback((data) {
      if (!mounted) return;
      
      if (data['type'] == 'chat_message') {
        final senderIdentity = (data['sender'] as String?) ?? 'Unknown';
        final localIdentity = liveKitService.localParticipant?.identity ?? '';
        final isLocal = senderIdentity == localIdentity;
        final recipientType = (data['recipientType'] as String?) ?? 'all';
        final recipientId = data['recipientId'] as String?;
        
        // Determine if user is host (check in callback to get current value)
        final isHost = localIdentity.toLowerCase().contains('host');
        
        // Check if message should be shown to current user
        bool shouldShow = false;
        if (recipientType == 'all') {
          shouldShow = true;
        } else if (recipientType == 'host') {
          shouldShow = isHost || isLocal;
        } else if (recipientType == 'specific') {
          shouldShow = isLocal || recipientId == localIdentity;
        }
        
        print('📬 Chat: Message received - sender: $senderIdentity, isLocal: $isLocal, shouldShow: $shouldShow, chatOpen: ${widget.isOpen}');
        
        // Increment unread count for non-local messages when chat is closed
        if (shouldShow && !isLocal && !widget.isOpen) {
          final newCount = _unreadCount + 1;
          setState(() {
            _unreadCount = newCount;
          });
          // Defer callback to avoid setState during build
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              widget.onUnreadCountChange?.call(newCount);
              print('📬 Chat: Unread count updated to $newCount');
            }
          });
        } else {
          print('📬 Chat: Not incrementing count - isLocal: $isLocal, chatOpen: ${widget.isOpen}, shouldShow: $shouldShow');
        }
      }
      
      // Scroll to bottom when new message arrives (only if chat is open)
      if (widget.isOpen) {
        _scrollToBottom();
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _getParticipantName(lk.Participant? participant) {
    if (participant == null) return 'Unknown';
    return participant.name ?? participant.identity;
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;

    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final message = _messageController.text.trim();
    final localIdentity = liveKitService.localParticipant?.identity ?? 'Unknown';
    
    final isPrivate = _recipientType != 'all';
    final messageData = {
      'type': 'chat_message',
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'sender': localIdentity,
      'message': message,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'recipientType': _recipientType,
      'recipientId': _recipientType == 'specific' ? _selectedRecipientId : null,
      'isPrivate': isPrivate,
    };

    try {
      await liveKitService.sendChatData(messageData);
      
      // Message is now stored in LiveKitService, just trigger UI update
      setState(() {});
      
      _messageController.clear();
      _scrollToBottom();
    } catch (e) {
      print('Error sending chat message: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to send message: $e'),
          backgroundColor: AppColors.warningOrange,
        ),
      );
    }
  }

  String _formatTime(DateTime timestamp) {
    return '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();

    return Consumer<LiveKitService>(
      builder: (context, liveKitService, child) {
        _isConnected = liveKitService.isConnected;
        final spacing = Theme.of(context).extension<AppSpacing>()!;
        
        // Determine if user is host
        final localIdentity = liveKitService.localParticipant?.identity ?? '';
        _isHost = localIdentity.toLowerCase().contains('host');
        
        // Get all participants for recipient selection
        final allParticipants = [
          liveKitService.localParticipant,
          ...liveKitService.participants,
        ].where((p) => p != null).cast<lk.Participant>().toList();
        
        // Filter out observers and local participant for private messaging
        final availableParticipants = allParticipants
            .where((p) => p.identity != localIdentity && 
                   !p.identity.toLowerCase().contains('observer'))
            .toList();

        // Process messages and filter based on recipient
        final allMessages = liveKitService.chatMessages
            .where((data) => data['type'] == 'chat_message')
            .map((data) {
              final senderIdentity = (data['sender'] as String?) ?? 'Unknown';
              final recipientType = (data['recipientType'] as String?) ?? 'all';
              final recipientId = data['recipientId'] as String?;
              final isPrivate = (data['isPrivate'] as bool?) ?? false;
              
              // Find sender participant to get real name
              lk.Participant? senderParticipant;
              if (senderIdentity == localIdentity) {
                senderParticipant = liveKitService.localParticipant;
              } else {
                try {
                  senderParticipant = liveKitService.participants
                      .firstWhere((p) => p.identity == senderIdentity);
                } catch (e) {
                  // Participant not found, use identity as name
                  senderParticipant = null;
                }
              }
              
              return ChatMessage(
                id: (data['id'] as String?) ??
                    DateTime.now().millisecondsSinceEpoch.toString(),
                sender: senderParticipant != null
                    ? _getParticipantName(senderParticipant)
                    : senderIdentity,
                senderIdentity: senderIdentity,
                message: (data['message'] as String?) ?? '',
                timestamp: DateTime.fromMillisecondsSinceEpoch(
                  (data['timestamp'] as int?) ??
                      DateTime.now().millisecondsSinceEpoch,
                ),
                isLocal: senderIdentity == localIdentity,
                isPrivate: isPrivate,
                recipientId: recipientId,
                recipientType: recipientType,
              );
            })
            .toList();
        
        // Filter messages based on recipient
        final messages = allMessages.where((msg) {
          if (msg.recipientType == 'all') return true;
          if (msg.recipientType == 'host') return _isHost || msg.isLocal;
          if (msg.recipientType == 'specific') {
            return msg.isLocal || msg.recipientId == localIdentity;
          }
          return true;
        }).toList();

        return Scaffold(
          backgroundColor: AppColors.surfaceElevated,
          body: SafeArea(
            child: Column(
              children: [
                // Header
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.lg,
                    vertical: spacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceElevated,
                    border: Border(
                      bottom: BorderSide(
                        color: AppColors.outline.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: widget.onClose,
                        icon: const Icon(
                          Icons.arrow_back,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(width: spacing.sm),
                      Text(
                        'Chat',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      SizedBox(width: spacing.sm),
                      if (!_isConnected)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: spacing.sm,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.warningOrange.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            'Offline',
                            style: Theme.of(context)
                                .textTheme
                                .labelMedium
                                ?.copyWith(color: AppColors.warningOrange),
                          ),
                        ),
                      const Spacer(),
                    ],
                  ),
                ),
                
                // Recipient Selector
                if (_isConnected)
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.lg,
                      vertical: spacing.sm,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      border: Border(
                        bottom: BorderSide(
                          color: AppColors.outline.withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.people_outline,
                          size: 18,
                          color: AppColors.textSecondary,
                        ),
                        SizedBox(width: spacing.sm),
                        Text(
                          'Send to:',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: AppColors.textSecondary),
                        ),
                        SizedBox(width: spacing.sm),
                        Expanded(
                          child: _buildRecipientSelector(
                            context,
                            spacing,
                            availableParticipants,
                          ),
                        ),
                      ],
                    ),
                  ),
                
                // Messages List
                Expanded(
                  child: messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.chat_bubble_outline,
                                size: 64,
                                color: AppColors.textMuted,
                              ),
                              SizedBox(height: spacing.md),
                              Text(
                                'No messages yet',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                              SizedBox(height: spacing.xs),
                              Text(
                                'Start the conversation',
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          controller: _scrollController,
                          padding: EdgeInsets.all(spacing.lg),
                          itemCount: messages.length,
                          separatorBuilder: (_, __) => SizedBox(height: spacing.md),
                          itemBuilder: (context, index) {
                            final message = messages[index];
                            return _buildMessageBubble(context, message, liveKitService);
                          },
                        ),
                ),
                
                // Message Composer
                Container(
                  padding: EdgeInsets.all(spacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceElevated,
                    border: Border(
                      top: BorderSide(
                        color: AppColors.outline.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                  ),
                  child: _buildComposer(context),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRecipientSelector(
    BuildContext context,
    AppSpacing spacing,
    List<lk.Participant> availableParticipants,
  ) {
    // Reset selected recipient if it's no longer available
    if (_selectedRecipientId != null && 
        !availableParticipants.any((p) => p.identity == _selectedRecipientId)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            if (availableParticipants.isNotEmpty) {
              _selectedRecipientId = availableParticipants.first.identity;
            } else {
              _selectedRecipientId = null;
              _recipientType = 'all';
            }
          });
        }
      });
    }
    
    // Set default recipient if switching to specific and none selected
    if (_recipientType == 'specific' && 
        _selectedRecipientId == null && 
        availableParticipants.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _selectedRecipientId = availableParticipants.first.identity;
          });
        }
      });
    }

    final List<DropdownMenuItem<String>> items = [
      DropdownMenuItem(
        value: 'all',
        child: Row(
          children: [
            const Icon(Icons.public, size: 16, color: AppColors.textPrimary),
            SizedBox(width: spacing.xs),
            const Text('Everyone'),
          ],
        ),
      ),
      if (!_isHost)
        DropdownMenuItem(
          value: 'host',
          child: Row(
            children: [
              const Icon(Icons.lock, size: 16, color: AppColors.warningOrange),
              SizedBox(width: spacing.xs),
              const Text('Host (Private)'),
            ],
          ),
        ),
    ];

    // Add specific participants if available
    if (availableParticipants.isNotEmpty) {
      // If only one participant, add it directly
      if (availableParticipants.length == 1) {
        items.add(
          DropdownMenuItem(
            value: 'specific',
            child: Row(
              children: [
                const Icon(Icons.person, size: 16, color: AppColors.warningOrange),
                SizedBox(width: spacing.xs),
                Text(_getParticipantName(availableParticipants.first)),
                SizedBox(width: spacing.xs),
                const Text('(Private)', style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
        );
      } else {
        // Multiple participants - show selected one in dropdown, use popup for selection
        final selectedParticipant = _selectedRecipientId != null
            ? availableParticipants.firstWhere(
                (p) => p.identity == _selectedRecipientId,
                orElse: () => availableParticipants.first,
              )
            : availableParticipants.first;
            
        items.add(
          DropdownMenuItem(
            value: 'specific',
            child: Row(
              children: [
                const Icon(Icons.person, size: 16, color: AppColors.warningOrange),
                SizedBox(width: spacing.xs),
                Flexible(
                  child: Text(
                    _getParticipantName(selectedParticipant),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(width: spacing.xs),
                const Text('(Private)', style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
        );
      }
    }

    return Row(
      children: [
        Expanded(
          child: DropdownButton<String>(
            value: _recipientType,
            isExpanded: true,
            underline: const SizedBox(),
            dropdownColor: AppColors.surfaceElevated,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textPrimary),
            items: items,
            onChanged: (value) {
              if (value != null) {
                setState(() {
                  _recipientType = value;
                  if (value == 'specific' && availableParticipants.isNotEmpty) {
                    if (_selectedRecipientId == null ||
                        !availableParticipants
                            .any((p) => p.identity == _selectedRecipientId)) {
                      _selectedRecipientId = availableParticipants.first.identity;
                    }
                  } else {
                    _selectedRecipientId = null;
                  }
                });
              }
            },
          ),
        ),
        if (_recipientType == 'specific' && availableParticipants.length > 1)
          PopupMenuButton<String>(
            icon: Icon(
              Icons.arrow_drop_down,
              color: AppColors.textSecondary,
            ),
            color: AppColors.surfaceElevated,
            itemBuilder: (context) {
              return availableParticipants.map((participant) {
                final isSelected = participant.identity == _selectedRecipientId;
                return PopupMenuItem(
                  value: participant.identity,
                  child: Row(
                    children: [
                      if (isSelected)
                        Icon(
                          Icons.check,
                          size: 18,
                          color: AppColors.info,
                        )
                      else
                        const SizedBox(width: 18),
                      SizedBox(width: spacing.xs),
                      Expanded(
                        child: Text(
                          _getParticipantName(participant),
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(
                                color: isSelected
                                    ? AppColors.info
                                    : AppColors.textPrimary,
                                fontWeight: isSelected
                                    ? FontWeight.w600
                                    : FontWeight.normal,
                              ),
                        ),
                      ),
                    ],
                  ),
                  onTap: () {
                    setState(() {
                      _selectedRecipientId = participant.identity;
                    });
                  },
                );
              }).toList();
            },
          ),
      ],
    );
  }

  Widget _buildComposer(BuildContext context) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final isPrivate = _recipientType != 'all';
    final recipientLabel = _recipientType == 'all'
        ? 'everyone'
        : _recipientType == 'host'
            ? 'host'
            : 'participant';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: TextField(
            controller: _messageController,
            enabled: _isConnected,
            maxLines: 4,
            minLines: 1,
            maxLength: 500,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textPrimary,
                ),
            decoration: InputDecoration(
              hintText: _isConnected
                  ? 'Type a message to $recipientLabel...'
                  : 'Connecting to chat...',
              counterText: '',
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(
                  color: AppColors.outline.withOpacity(0.3),
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(
                  color: AppColors.outline.withOpacity(0.3),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(
                  color: AppColors.info,
                  width: 2,
                ),
              ),
              hintStyle: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppColors.textMuted),
              contentPadding: EdgeInsets.symmetric(
                horizontal: spacing.md,
                vertical: spacing.sm,
              ),
            ),
            onSubmitted: (_) => _sendMessage(),
          ),
        ),
        SizedBox(width: spacing.sm),
        Container(
          decoration: BoxDecoration(
            color: _isConnected ? AppColors.info : AppColors.outline,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _isConnected ? _sendMessage : null,
              borderRadius: BorderRadius.circular(24),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.md,
                  vertical: spacing.sm,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Send',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    SizedBox(width: spacing.xs),
                    Icon(
                      _recipientType != 'all' ? Icons.lock : Icons.send,
                      size: 18,
                      color: AppColors.textPrimary,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMessageBubble(
    BuildContext context,
    ChatMessage message,
    LiveKitService liveKitService,
  ) {
    final spacing = Theme.of(context).extension<AppSpacing>()!;
    final isHost = message.senderIdentity.toLowerCase().contains('host');

    final bubbleColor = message.isLocal
        ? AppColors.info
        : AppColors.surfaceMuted;
    final textColor = message.isLocal
        ? AppColors.textPrimary
        : AppColors.textSecondary;

    return Align(
      alignment: message.isLocal
          ? Alignment.centerRight
          : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        padding: EdgeInsets.all(spacing.md),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: message.isPrivate
                ? AppColors.warningOrange.withOpacity(0.5)
                : message.isLocal
                    ? AppColors.info.withOpacity(0.3)
                    : AppColors.outline.withOpacity(0.3),
            width: message.isPrivate ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: message.isLocal
                      ? Colors.white.withOpacity(0.2)
                      : AppColors.surface,
                  child: Text(
                    message.sender.isNotEmpty
                        ? message.sender.characters.first.toUpperCase()
                        : '?',
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(
                          color: textColor,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ),
                SizedBox(width: spacing.sm),
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          message.isLocal ? 'You' : message.sender,
                          style: Theme.of(context)
                              .textTheme
                              .labelLarge
                              ?.copyWith(
                                color: textColor,
                                fontWeight: FontWeight.w600,
                              ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (message.isPrivate) ...[
                        SizedBox(width: spacing.xs),
                        Icon(
                          Icons.lock,
                          size: 14,
                          color: AppColors.warningOrange,
                        ),
                      ],
                    ],
                  ),
                ),
                if (isHost)
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.xs,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Host',
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(color: AppColors.accent),
                    ),
                  ),
              ],
            ),
            SizedBox(height: spacing.sm),
            Text(
              message.message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: textColor),
            ),
            SizedBox(height: spacing.xs),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _formatTime(message.timestamp),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: textColor.withOpacity(0.7),
                      ),
                ),
                if (message.isPrivate)
                  Text(
                    'Private',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.warningOrange.withOpacity(0.8),
                          fontWeight: FontWeight.w500,
                        ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
