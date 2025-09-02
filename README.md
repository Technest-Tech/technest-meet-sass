<a href="https://livekit.io/">
  <img src="./.github/assets/livekit-mark.png" alt="LiveKit logo" width="100" height="100">
</a>

# NewMeet - Modern Video Conferencing

NewMeet is a modern video conferencing application built with LiveKit open source technology, featuring beautiful Islamic-inspired design and seamless communication.

## 🚀 Quick Start

1. **Clone the repository**
2. **Install dependencies**: `pnpm install`
3. **Set up environment**: `./setup-env.sh`
4. **Start the development server**: `pnpm dev`
5. **Access the application**: `http://localhost:3000`

## 🔐 Admin Access

- **Admin Login**: `http://localhost:3000/admin/login`
- **Demo Credentials**: 
  - Email: `admin@newmeet.com`
  - Password: `admin123`

## 🏠 Room Access

### Important: Room Links Require Type Parameter

Room links must include the access type parameter to work properly:

- **Host Access**: `/room/room-link?type=host`
- **Guest Access**: `/room/room-link?type=guest`

### Examples:
- ✅ **Correct**: `http://localhost:3000/room/sample-host?type=host`
- ❌ **Incorrect**: `http://localhost:3000/room/sample-host`

### Why This Matters:
- The `type` parameter determines whether you're joining as a host or guest
- Hosts have additional permissions (can manage the room, record, etc.)
- Guests have limited permissions (can join, speak, and view)
- Without the type parameter, the system cannot determine your access level

## 🛠️ Development

- **Database**: `pnpm db:push` (after schema changes)
- **Prisma Studio**: `pnpm db:studio`
- **Build**: `pnpm build`
- **Start**: `pnpm start`

## 🔧 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## 📝 License

This project is licensed under the MIT License.
