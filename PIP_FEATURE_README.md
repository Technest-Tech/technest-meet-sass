# Picture-in-Picture (PiP) Feature

## Overview
The Picture-in-Picture feature automatically displays participants' camera feeds in small overlay windows when they are simultaneously sharing their screen and have their camera enabled. This ensures that participants remain visible even when navigating to other browser windows or applications during screen sharing.

## Features

### 🎯 **Automatic Detection**
- Automatically detects when participants have both screen share and camera active
- Shows PiP windows only when needed
- Hides PiP windows when screen sharing stops or camera is disabled

### 🎥 **Video Display**
- Shows live camera feed in a 160x120px window (120x90px on mobile)
- Displays participant's name and status
- Shows screen share indicator (📺) when active
- Falls back to participant initial if camera is unavailable

### 🖱️ **Interactive Controls**
- **Drag & Drop**: Click and drag PiP windows to reposition them
- **Minimize/Maximize**: Click the ➖ button to minimize all PiP windows
- **Responsive**: Automatically adjusts size and position on mobile devices

### 🎨 **Visual Design**
- Modern glassmorphism design with backdrop blur effects
- Smooth animations for appearance/disappearance
- Hover effects and visual feedback
- High contrast for accessibility

## How It Works

### 1. **Track Monitoring**
The component monitors LiveKit track publications for:
- `Track.Source.ScreenShare` - Screen sharing tracks
- `Track.Source.Camera` - Camera video tracks

### 2. **Condition Detection**
A participant is eligible for PiP when:
```typescript
const hasScreenShare = participant.getTrackPublication(Track.Source.ScreenShare)?.isEnabled;
const hasCamera = participant.getTrackPublication(Track.Source.Camera)?.isEnabled;

if (hasScreenShare && hasCamera) {
  // Show PiP for this participant
}
```

### 3. **Event Handling**
The component listens to LiveKit events:
- `trackPublished` - New tracks become available
- `trackUnpublished` - Tracks are removed
- `trackMuted` - Tracks are muted/disabled
- `trackUnmuted` - Tracks are unmuted/enabled

## Implementation

### Component Location
- **Main Component**: `lib/PictureInPicture.tsx`
- **Styles**: `styles/PictureInPicture.module.css`
- **Integration**: Added to both main meeting room and custom video conference

### Usage
```tsx
import { PictureInPicture } from '@/lib/PictureInPicture';

// In your meeting room component
<PictureInPicture room={room} />
```

### Props
```typescript
interface PictureInPictureProps {
  room: Room; // LiveKit room instance
}
```

## Browser Compatibility

### ✅ **Supported**
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### ⚠️ **Requirements**
- Modern browser with ES6+ support
- WebRTC support for video tracks
- CSS backdrop-filter support (for glassmorphism effects)

## Customization

### Styling
The component uses CSS modules and can be customized by modifying:
- `styles/PictureInPicture.module.css` - Main styles
- Component props for positioning and sizing
- CSS custom properties for theming

### Behavior
Key behaviors can be modified:
- PiP window size and position
- Animation timing and effects
- Event handling logic
- Participant filtering criteria

## Troubleshooting

### Common Issues

1. **PiP not appearing**
   - Check if participant has both screen share and camera enabled
   - Verify LiveKit track publications are working
   - Check browser console for errors

2. **Video not displaying**
   - Ensure camera track is properly published
   - Check if track is enabled and not muted
   - Verify VideoTrack component is rendering

3. **Performance issues**
   - Monitor CPU usage during screen sharing
   - Consider reducing video quality for PiP windows
   - Check if multiple PiP windows are causing issues

### Debug Information
The component logs key events to the console:
- Participant detection
- Track status changes
- PiP window creation/removal

## Future Enhancements

### Planned Features
- [ ] PiP window resizing
- [ ] Custom PiP layouts (grid, carousel)
- [ ] PiP window pinning
- [ ] Keyboard shortcuts for PiP control
- [ ] PiP window recording
- [ ] Custom PiP themes

### Technical Improvements
- [ ] Performance optimization for multiple PiP windows
- [ ] Better mobile touch support
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Memory leak prevention
- [ ] Error boundary implementation

## Contributing

When contributing to the PiP feature:

1. **Test thoroughly** with different screen sharing scenarios
2. **Maintain performance** - PiP should not impact main video quality
3. **Follow accessibility** guidelines for video overlays
4. **Update documentation** for any new features or changes
5. **Consider mobile** experience and responsive design

## License

This feature is part of the NewMeet project and follows the same licensing terms.
