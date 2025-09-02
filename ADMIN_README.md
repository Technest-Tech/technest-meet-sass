# NewMeet Admin Control Panel

A comprehensive admin control panel for managing video conference rooms with automatic participant assignment and direct access links.

## ✨ Features

- **🔐 Secure Admin Authentication** - JWT-based login system
- **🏠 Room Management** - Create, edit, and delete video conference rooms
- **👥 Automatic Participant Assignment** - Teacher1, Teacher2... / Student1, Student2...
- **🔗 Short Access Links** - 8-character unique links for hosts and guests
- **⚡ Direct Room Access** - Bypass join page for instant room entry
- **🎛️ Room Configuration** - Host approval, max participants, room status
- **📱 Modern UI** - Beautiful, responsive interface built with Tailwind CSS
- **🗄️ Database Storage** - SQLite database with Prisma ORM

## 🚀 Quick Start

### 1. Setup

```bash
# Run the setup script
./setup-admin.sh

# Or manually:
pnpm install
pnpm run db:generate
node scripts/init-db.js
```

### 2. Start Development Server

```bash
pnpm run dev
```

### 3. Access Admin Panel

- **URL**: http://localhost:3000/admin/login
- **Email**: admin@newmeet.com
- **Password**: admin123

## 📋 How It Works

### Room Creation Flow

1. **Admin creates room** with name and settings
2. **System generates** unique 8-character links for host and guest
3. **Automatic participant names** are created (Teacher1, Student1, etc.)
4. **Links are displayed** in the admin dashboard

### Room Access Flow

#### Host Access
- Click host link → Direct room entry as Teacher1, Teacher2, etc.
- No pre-join page, immediate camera/mic permission request
- Full room control and management

#### Guest Access
- Click guest link → Direct room entry as Student1, Student2, etc.
- Automatic participant name assignment
- Respects host approval settings

### Participant Naming System

- **Hosts**: Teacher1, Teacher2, Teacher3... (incremental)
- **Guests**: Student1, Student2, Student3... (incremental)
- **Automatic**: System assigns next available name
- **Unique**: Each participant gets a unique name per room

## 🏗️ Architecture

### Frontend
- **Next.js 15** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **TypeScript** - Type-safe development

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database management
- **SQLite** - Lightweight database
- **JWT** - Authentication tokens

### Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  role      UserRole @default(ADMIN)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Room {
  id                String           @id @default(cuid())
  name              String
  description       String?
  hostApproval      Boolean          @default(false)
  maxParticipants   Int              @default(50)
  isActive          Boolean          @default(true)
  hostLink          String           @unique
  guestLink         String           @unique
  participants      Participant[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model Participant {
  id        String         @id @default(cuid())
  name      String
  type      ParticipantType
  roomId    String
  room      Room           @relation(fields: [roomId], references: [id], onDelete: Cascade)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}
```

## 🔧 Configuration

### Environment Variables

```env
# Optional: Custom JWT secret
JWT_SECRET=your-secret-key-change-in-production

# Optional: LiveKit server URL
LIVEKIT_URL=wss://your-livekit-server.com
```

### Room Settings

- **Host Approval**: Require host approval for guest entry
- **Max Participants**: Limit room capacity
- **Room Status**: Enable/disable rooms
- **Description**: Optional room description

## 📱 Usage Examples

### Creating a Room

1. Login to admin panel
2. Click "Create Room"
3. Enter room name and settings
4. System generates unique links
5. Share links with participants

### Room Access URLs

```
# Host access
http://localhost:3000/room/ABC123XY?type=host

# Guest access  
http://localhost:3000/room/DEF456ZW?type=guest
```

### Managing Rooms

- **View all rooms** in card layout
- **Edit room settings** inline
- **Copy access links** with one click
- **Delete rooms** with confirmation
- **Search and filter** rooms

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Build for production
pnpm run start        # Start production server

# Database
pnpm run db:generate  # Generate Prisma client
pnpm run db:push      # Push schema to database
pnpm run db:studio    # Open Prisma Studio

# Code Quality
pnpm run lint         # Run ESLint
pnpm run format:write # Format with Prettier
```

### Project Structure

```
app/
├── admin/                    # Admin control panel
│   ├── login/              # Login page
│   └── dashboard/          # Main admin dashboard
├── api/                     # API endpoints
│   ├── admin/              # Admin APIs
│   └── room/               # Room access APIs
├── room/                    # Direct room access
└── custom/                  # Video conference components

lib/
├── auth.ts                 # Authentication utilities
├── database.ts             # Database utilities
└── utils.ts                # Helper functions

prisma/
└── schema.prisma           # Database schema
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt password encryption
- **Role-based Access** - Admin/moderator permissions
- **Input Validation** - Server-side validation
- **SQL Injection Protection** - Prisma ORM protection

## 🎨 UI Components

- **Modern Design** - Clean, professional interface
- **Responsive Layout** - Works on all devices
- **Dark Mode Ready** - Easy theme customization
- **Accessibility** - WCAG compliant components
- **Loading States** - Smooth user experience

## 🚀 Deployment

### Production Build

```bash
# Build the application
pnpm run build

# Start production server
pnpm run start
```

### Environment Setup

```bash
# Set production environment variables
export NODE_ENV=production
export JWT_SECRET=your-production-secret
export LIVEKIT_URL=wss://your-livekit-server.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the code examples
- Open an issue on GitHub

---

**Made with ❤️ for easy video conference management**
