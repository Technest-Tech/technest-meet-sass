# Collaborative Whiteboard Feature

## Overview

The collaborative whiteboard feature allows participants in video conferences to draw, collaborate, and share ideas in real-time. The whiteboard is synchronized across all participants using LiveKit's data channels, ensuring that any drawing made by one participant is immediately visible to all others.

## Features

### 🎨 Drawing Tools
- **Pen Tool**: Draw with customizable colors and brush sizes
- **Eraser Tool**: Erase parts of your drawings
- **Color Palette**: 10 predefined colors including black, red, green, blue, yellow, magenta, cyan, orange, purple, and green
- **Brush Sizes**: 7 different brush sizes from 2px to 20px

### 🔄 Real-time Collaboration
- **Live Synchronization**: All drawings are synchronized in real-time across participants
- **Real-time Drawing**: See other participants drawing as they draw, not just after completion
- **Multi-participant Support**: Works with any number of participants
- **Host Controls**: Host can open/close whiteboard for ALL participants automatically
- **Guest Access**: All participants can draw and collaborate
- **Automatic Sync**: When host opens/closes whiteboard, it automatically opens/closes for all guests
- **Live Drawing Indicator**: Visual feedback when receiving real-time updates from other participants

### 💾 Content Management
- **Download**: Save whiteboard as PNG image
- **Clear**: Clear all content (synchronized across all participants)
- **Persistent**: Drawings persist during the session until manually cleared

## Implementation Details

### Architecture
- **Frontend**: React component with HTML5 Canvas
- **Real-time Sync**: LiveKit data channels for low-latency communication
- **State Management**: Local state for immediate feedback, shared state for collaboration
- **Responsive Design**: Works on desktop and mobile devices

### Components

#### Whiteboard.tsx
Main whiteboard component that handles:
- Canvas rendering and drawing logic
- Tool selection and color management
- Real-time data synchronization
- User interaction handling

#### WhiteboardControl.tsx
Control component that provides:
- Open/close whiteboard functionality
- Integration with video conference interface
- Host/guest role-based positioning

### Data Flow
1. **Local Drawing**: User draws on canvas with immediate visual feedback
2. **Stroke Completion**: When drawing stops, stroke data is sent via LiveKit data channel
3. **Remote Sync**: Other participants receive stroke data and render it on their canvas
4. **State Consistency**: All participants maintain synchronized whiteboard state

### LiveKit Integration
- Uses `useRoomContext()` hook to access room instance
- Implements data channel communication for real-time updates
- Handles participant identification and message routing
- Supports reliable data transmission for drawing accuracy

## Usage

### For Hosts
1. **Open Whiteboard**: Click the "📋 Open for All" button (right side, bottom)
2. **Control Access**: Host can open/close whiteboard for ALL participants automatically
3. **Automatic Sync**: When host opens whiteboard, it automatically opens for all guests
4. **Manage Content**: Clear whiteboard or download content as needed
5. **End Meeting**: Host maintains control over meeting termination

### For Guests
1. **Automatic Control**: Whiteboard automatically opens/closes when host controls it
2. **Draw Freely**: Use pen or eraser tools with any color and size
3. **Collaborate**: See real-time updates from other participants
4. **Download**: Save whiteboard content locally
5. **Host Indicator**: See "👑 Controlled by Host" indicator when whiteboard is host-controlled

**Note**: Only hosts can open/close the whiteboard. Guests automatically join when the host opens it.

### Drawing Controls
- **Tool Selection**: Switch between pen and eraser tools
- **Color Selection**: Choose from 10 predefined colors
- **Brush Size**: Adjust drawing thickness from 2px to 20px
- **Real-time Preview**: See your drawing as you create it

## Technical Specifications

### Browser Support
- Modern browsers with HTML5 Canvas support
- WebRTC-enabled browsers for LiveKit integration
- Touch support for mobile devices

### Performance
- **Real-time Drawing**: 60fps updates with 50ms throttling for optimal performance
- **Optimized Rendering**: Debounced updates prevent excessive re-renders
- **Efficient Data Transmission**: LiveKit data channels with optimized message size
- **Minimal Memory Footprint**: Efficient stroke storage and cleanup
- **Smooth Collaboration**: Real-time drawing without lag or performance issues

### Security
- Participant authentication via LiveKit tokens
- Data channel encryption for secure communication
- Role-based access control (host vs guest)

## File Structure

```
lib/
├── Whiteboard.tsx          # Main whiteboard component
├── WhiteboardControl.tsx   # Control interface component
└── ...

styles/
└── Whiteboard.module.css   # Styling and responsive design

app/rooms/[roomName]/
└── PageClientImpl.tsx      # Integration with video conference
```

## Customization

### Adding New Tools
1. Extend the `DrawingStroke` interface
2. Add tool logic in the drawing handlers
3. Update the toolbar UI
4. Handle tool-specific data synchronization

### Color Palette
Modify the `COLORS` array in `Whiteboard.tsx` to add custom colors:
```typescript
const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
  '#YOUR_COLOR_HERE'  // Add custom colors
];
```

### Brush Sizes
Adjust the `BRUSH_SIZES` array for different brush options:
```typescript
const BRUSH_SIZES = [1, 2, 4, 6, 8, 12, 16, 20, 24, 32]; // Custom sizes
```

## Troubleshooting

### Common Issues

#### Whiteboard Not Opening
- Check if LiveKit connection is established
- Verify participant permissions
- Check browser console for errors

#### Drawing Not Syncing
- Ensure data channel is connected (green status indicator)
- Check network connectivity
- Verify LiveKit server configuration

#### Performance Issues
- Reduce brush size for complex drawings
- Close other browser tabs
- Check device memory usage

### Debug Information
- Status indicator shows connection state
- Console logs provide detailed error information
- Participant count displays active users

## Future Enhancements

### Planned Features
- **Text Tool**: Add text annotations to whiteboard
- **Shape Tools**: Rectangles, circles, lines, arrows
- **Image Import**: Upload and draw on images
- **Session Recording**: Record whiteboard sessions
- **Template Library**: Pre-made drawing templates

### Technical Improvements
- **Offline Support**: Cache drawings for offline viewing
- **Compression**: Optimize data transmission
- **Multi-page**: Support multiple whiteboard pages
- **Export Options**: PDF, SVG, and other formats

## Contributing

When contributing to the whiteboard feature:

1. **Follow Patterns**: Maintain existing component structure
2. **Test Integration**: Ensure LiveKit compatibility
3. **Responsive Design**: Test on multiple screen sizes
4. **Performance**: Monitor drawing performance impact
5. **Documentation**: Update this README for new features

## Support

For technical support or feature requests:
- Check existing issues in the repository
- Review LiveKit documentation for data channel usage
- Test with minimal participant count first
- Verify browser compatibility and permissions
