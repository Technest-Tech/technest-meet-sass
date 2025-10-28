import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';

class ChatMessage {
  final String id;
  final String sender;
  final String message;
  final DateTime timestamp;
  final bool isLocal;

  ChatMessage({
    required this.id,
    required this.sender,
    required this.message,
    required this.timestamp,
    required this.isLocal,
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
  bool _isConnected = false;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _setupChatDataCallback();
  }

  @override
  void didUpdateWidget(ChatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reset unread count when chat is opened
    if (widget.isOpen && !oldWidget.isOpen) {
      setState(() {
        _unreadCount = 0;
      });
      widget.onUnreadCountChange?.call(0);
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
      if (mounted) {
        setState(() {
          if (data['type'] == 'chat_message') {
            final isLocal = (data['sender'] as String?) == liveKitService.localParticipant?.identity;
            
            // Increment unread count for non-local messages when chat is closed
            if (!isLocal && !widget.isOpen) {
              _unreadCount++;
              widget.onUnreadCountChange?.call(_unreadCount);
            }
          }
        });
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

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;

    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final message = _messageController.text.trim();
    
    final messageData = {
      'type': 'chat_message',
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'sender': liveKitService.localParticipant?.identity ?? 'Unknown',
      'message': message,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
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
          backgroundColor: Colors.red,
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
        
        // Convert LiveKitService messages to ChatMessage objects
        final messages = liveKitService.chatMessages
            .where((data) => data['type'] == 'chat_message')
            .map((data) => ChatMessage(
                  id: (data['id'] as String?) ?? DateTime.now().millisecondsSinceEpoch.toString(),
                  sender: (data['sender'] as String?) ?? 'Unknown',
                  message: (data['message'] as String?) ?? '',
                  timestamp: DateTime.fromMillisecondsSinceEpoch(
                    (data['timestamp'] as int?) ?? DateTime.now().millisecondsSinceEpoch,
                  ),
                  isLocal: (data['sender'] as String?) == liveKitService.localParticipant?.identity,
                ))
            .toList();
        
        // Get keyboard height and screen dimensions
        final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;
        final screenHeight = MediaQuery.of(context).size.height;
        final availableHeight = screenHeight - keyboardHeight;
        
        // Calculate chat panel height - leave space for controls at bottom
        final controlsHeight = 120.0; // Approximate height of controls
        final availableForChat = keyboardHeight > 0 
            ? availableHeight - controlsHeight
            : screenHeight - controlsHeight;
        
        final chatHeight = availableForChat * 0.8; // Use 80% of available space
        
        // Ensure minimum height for usability
        final finalChatHeight = chatHeight.clamp(300.0, availableForChat);
        
        return Container(
          height: finalChatHeight,
          decoration: const BoxDecoration(
            color: Color(0xFF1a1a2e),
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 10,
                offset: Offset(0, -2),
              ),
            ],
          ),
          child: GestureDetector(
            onTap: () {
              // Prevent closing when tapping inside the chat
            },
            child: Column(
            children: [
              // Chat Header
              Container(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: 16,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFF16213e),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                  ),
                ),
                child: Column(
                  children: [
                    // Resize handle
                    Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade600,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Text(
                              '💬 Chat',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (!_isConnected)
                              const Padding(
                                padding: EdgeInsets.only(left: 8),
                                child: Text(
                                  '(Disconnected)',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        IconButton(
                          onPressed: widget.onClose,
                          icon: const Icon(
                            Icons.close,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Messages Area
              Expanded(
                child: messages.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Text(
                            'No messages yet. Start the conversation!',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 16,
                              fontStyle: FontStyle.italic,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          final message = messages[index];
                          return _buildMessageBubble(message);
                        },
                      ),
              ),
              
              // Input Area
              Container(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: keyboardHeight > 0 ? 20 : MediaQuery.of(context).padding.bottom + 20, // Adjust padding based on keyboard
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFF16213e),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3, // Takes 60% of available space
                      child: Container(
                        constraints: const BoxConstraints(
                          minHeight: 48, // Ensure minimum touch target size
                        ),
                        margin: const EdgeInsets.only(right: 12),
                        child: TextField(
                          controller: _messageController,
                          enabled: _isConnected,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16, // Prevent zoom on iOS
                          ),
                          decoration: InputDecoration(
                            hintText: _isConnected ? 'Type a message...' : 'Connecting...',
                            hintStyle: const TextStyle(color: Colors.white54),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(25),
                              borderSide: const BorderSide(color: Colors.white24),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(25),
                              borderSide: const BorderSide(color: Colors.white24),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(25),
                              borderSide: const BorderSide(color: Colors.blue),
                            ),
                            filled: true,
                            fillColor: Colors.white.withOpacity(0.1),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                          ),
                          maxLength: 500,
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 2, // Takes 40% of available space
                      child: Container(
                        constraints: const BoxConstraints(
                          minHeight: 48,
                          minWidth: 80,
                        ),
                        child: ElevatedButton(
                          onPressed: _isConnected ? _sendMessage : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(25),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            elevation: 2,
                          ),
                          child: const Icon(
                            Icons.send,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          ),
        );
      },
    );
  }

  Widget _buildMessageBubble(ChatMessage message) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: message.isLocal 
            ? MainAxisAlignment.end 
            : MainAxisAlignment.start,
        children: [
          if (!message.isLocal) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: Colors.blue,
              child: Text(
                message.sender.isNotEmpty ? message.sender[0].toUpperCase() : '?',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: message.isLocal ? Colors.blue : Colors.grey[700],
                borderRadius: BorderRadius.circular(18).copyWith(
                  bottomLeft: message.isLocal 
                      ? const Radius.circular(18) 
                      : const Radius.circular(5),
                  bottomRight: message.isLocal 
                      ? const Radius.circular(5) 
                      : const Radius.circular(18),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!message.isLocal)
                    Text(
                      message.sender,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  if (!message.isLocal) const SizedBox(height: 4),
                  Text(
                    message.message,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatTime(message.timestamp),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.6),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (message.isLocal) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              radius: 16,
              backgroundColor: Colors.green,
              child: const Text(
                'You',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
