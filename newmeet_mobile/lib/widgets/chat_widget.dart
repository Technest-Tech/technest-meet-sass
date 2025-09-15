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
  final List<ChatMessage> _messages = [];
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
            final message = ChatMessage(
              id: (data['id'] as String?) ?? DateTime.now().millisecondsSinceEpoch.toString(),
              sender: (data['sender'] as String?) ?? 'Unknown',
              message: (data['message'] as String?) ?? '',
              timestamp: DateTime.fromMillisecondsSinceEpoch(
                (data['timestamp'] as int?) ?? DateTime.now().millisecondsSinceEpoch,
              ),
              isLocal: (data['sender'] as String?) == liveKitService.localParticipant?.identity,
            );
            _messages.add(message);
            
            // Increment unread count for non-local messages when chat is closed
            if (!message.isLocal && !widget.isOpen) {
              setState(() {
                _unreadCount++;
              });
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
      
      // Add message to local state immediately for better UX
      setState(() {
        _messages.add(ChatMessage(
          id: messageData['id'] as String,
          sender: messageData['sender'] as String,
          message: messageData['message'] as String,
          timestamp: DateTime.fromMillisecondsSinceEpoch(messageData['timestamp'] as int),
          isLocal: true,
        ));
      });
      
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
        
        return Container(
          height: MediaQuery.of(context).size.height * 0.6,
          decoration: const BoxDecoration(
            color: Color(0xFF1a1a2e),
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
          ),
          child: Column(
            children: [
              // Chat Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Color(0xFF16213e),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                  ),
                ),
                child: Row(
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
              ),
              
              // Messages Area
              Expanded(
                child: _messages.isEmpty
                    ? const Center(
                        child: Text(
                          'No messages yet. Start the conversation!',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 16,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          return _buildMessageBubble(message);
                        },
                      ),
              ),
              
              // Input Area
              Container(
                padding: const EdgeInsets.all(16),
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
                      child: TextField(
                        controller: _messageController,
                        enabled: _isConnected,
                        style: const TextStyle(color: Colors.white),
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
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                        maxLength: 500,
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: const BoxDecoration(
                        color: Colors.blue,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        onPressed: _isConnected ? _sendMessage : null,
                        icon: const Icon(
                          Icons.send,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
