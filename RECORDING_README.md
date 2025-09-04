# 🎥 NewMeet Recording Feature

This document explains how to set up and use the recording functionality in NewMeet.

## 📋 Overview

The recording feature allows meeting hosts to record video conferences and save them as MP4 files. Recordings can be stored locally (for development) or uploaded to AWS S3 (for production).

## ✨ Features

- **Host-only Recording**: Only meeting hosts can start/stop recordings
- **Visual Indicators**: Recording status is clearly indicated to all participants
- **Multiple Storage Options**: Local storage for development, S3 for production
- **Automatic File Naming**: Recordings are automatically named with timestamp and room name
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **E2EE Compatibility**: Recording is disabled for encrypted meetings (LiveKit limitation)

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)

Run the setup script to configure recording:

```bash
./setup-recording.sh
```

This script will guide you through the configuration process.

### Option 2: Manual Setup

1. **Add Environment Variables**

   Add these variables to your `.env` file:

   ```env
   # Recording endpoint
   NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
   
   # S3 Configuration (for production)
   S3_KEY_ID=your-s3-access-key
   S3_KEY_SECRET=your-s3-secret-key
   S3_BUCKET=your-recording-bucket
   S3_ENDPOINT=https://s3.amazonaws.com
   S3_REGION=us-east-1
   ```

2. **Update LiveKit Configuration**

   The `livekit.yaml` file has been updated to enable recording:

   ```yaml
   egress:
     enabled: true
     room_composite: true
     track_composite: true
     track: true
     web: true
   ```

3. **Restart Services**

   ```bash
   # Restart LiveKit server
   ./start-livekit.sh
   
   # Restart Next.js application
   npm run dev
   ```

## 🎮 How to Use

### For Hosts

1. **Join a meeting as a host** (participantType: 'host')
2. **Access recording controls** in two ways:
   - **Main UI**: Recording button appears in the bottom-right corner
   - **Settings Menu**: Recording tab in the settings panel
3. **Start Recording**: Click the "Start Recording" button
4. **Stop Recording**: Click the "Stop Recording" button
5. **Visual Feedback**: Recording status is shown with visual indicators

### For Participants

- **Recording Indicator**: A red border appears around the video area when recording
- **Toast Notification**: Participants are notified when recording starts
- **No Controls**: Only hosts can control recording

## 🔧 Technical Details

### API Endpoints

- `GET /api/record/start?roomName={roomName}` - Start recording
- `GET /api/record/stop?roomName={roomName}` - Stop recording

### Recording Format

- **Format**: MP4 (H.264 video, AAC audio)
- **Layout**: Speaker view (active speaker highlighted)
- **Quality**: High quality (1080p when available)
- **File Naming**: `{timestamp}-{roomName}.mp4`

### Storage Options

#### Local Development
- Recordings saved to LiveKit server
- No S3 configuration required
- Good for testing and development

#### Production (S3)
- Recordings uploaded to AWS S3
- Requires S3 credentials
- Better for production use
- Automatic file management

## 🛠️ Configuration Options

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_LK_RECORD_ENDPOINT` | Recording API endpoint | Yes | `/api/record` |
| `S3_KEY_ID` | AWS S3 Access Key ID | For S3 | - |
| `S3_KEY_SECRET` | AWS S3 Secret Key | For S3 | - |
| `S3_BUCKET` | S3 Bucket Name | For S3 | - |
| `S3_ENDPOINT` | S3 Endpoint URL | For S3 | `https://s3.amazonaws.com` |
| `S3_REGION` | S3 Region | For S3 | `us-east-1` |

### S3 Bucket Permissions

Your S3 access key needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

## 🚨 Important Notes

### Security Considerations

- **Host-only Access**: Recording controls are only available to hosts
- **Room Name Validation**: API endpoints validate room names
- **E2EE Limitation**: Recording is disabled for encrypted meetings
- **Production Warning**: Current implementation allows anyone with room name to control recording (see API route comments)

### Limitations

- **E2EE Meetings**: Cannot record encrypted meetings (LiveKit limitation)
- **Browser Support**: Requires modern browsers with WebRTC support
- **Storage Space**: S3 storage costs apply for production use
- **File Size**: Large meetings may produce large files

## 🐛 Troubleshooting

### Common Issues

1. **Recording Button Not Visible**
   - Ensure you're joined as a host (`participantType: 'host'`)
   - Check that `NEXT_PUBLIC_LK_RECORD_ENDPOINT` is set

2. **Recording Fails to Start**
   - Check LiveKit server logs
   - Verify S3 credentials (if using S3)
   - Ensure room is not encrypted (E2EE)

3. **S3 Upload Fails**
   - Verify S3 credentials
   - Check bucket permissions
   - Ensure bucket exists and is accessible

4. **Recording Indicator Not Showing**
   - Check browser console for errors
   - Verify LiveKit connection is stable

### Debug Mode

Enable debug logging by checking browser console for detailed error messages.

## 📁 File Structure

```
├── app/api/record/
│   ├── start/route.ts          # Start recording API
│   └── stop/route.ts           # Stop recording API
├── lib/
│   ├── RecordingControl.tsx    # Recording control component
│   ├── RecordingIndicator.tsx  # Recording status indicator
│   └── SettingsMenu.tsx        # Settings menu with recording tab
├── setup-recording.sh          # Recording setup script
└── RECORDING_README.md         # This documentation
```

## 🔄 Updates and Maintenance

### Updating Recording Settings

1. Modify environment variables in `.env`
2. Restart LiveKit server
3. Restart Next.js application

### Monitoring Recordings

- Check S3 bucket for uploaded files
- Monitor LiveKit server logs for recording events
- Use browser developer tools for client-side debugging

## 📞 Support

If you encounter issues with the recording feature:

1. Check this documentation
2. Review browser console logs
3. Check LiveKit server logs
4. Verify environment configuration
5. Test with a simple meeting setup

## 🎯 Future Enhancements

Potential improvements for the recording feature:

- [ ] Recording quality settings
- [ ] Multiple recording formats
- [ ] Recording scheduling
- [ ] Recording analytics
- [ ] Cloud storage alternatives (Google Cloud, Azure)
- [ ] Recording encryption
- [ ] Automatic recording cleanup
- [ ] Recording thumbnails
- [ ] Recording search and indexing
