# 🧠 BrainNot

A modern, AI-powered calendar-based notebook that seamlessly integrates with Google Calendar.

## ✨ Features

- 📅 **Smart Calendar Integration** - Two-way sync with Google Calendar
- 🤖 **AI-Powered Notes** - Gemini AI for text enhancement, grammar fixes, and summarization
- 📱 **Mobile-First Design** - WhatsApp-style two-panel layout
- 🎨 **Modern UI** - Built with Tailwind CSS and Framer Motion
- 📝 **Rich Text Editor** - Inline formatting with contentEditable
- 🏷️ **Priority System** - Color-coded events (High/Medium/Low)
- 📊 **Multiple Views** - Day view timeline and month view grid
- 🔄 **Real-time Sync** - Automatic Google Calendar synchronization
- 📱 **Responsive** - Works perfectly on desktop and mobile

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Headless UI
- **Authentication**: Firebase Auth with Google OAuth
- **Database**: Cloud Firestore
- **Calendar API**: Google Calendar API
- **AI**: Google Gemini API
- **Animations**: Framer Motion
- **Icons**: Heroicons
- **Notifications**: React Hot Toast

## 🛠️ Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/brainot.git
   cd brainot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Gemini API Key
   VITE_GEMINI_API_KEY=your_gemini_api_key

   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Firebase Setup**
   - Create a Firebase project
   - Enable Authentication with Google provider
   - Enable Firestore Database
   - Add your domain to authorized domains

5. **Google APIs Setup**
   - Enable Google Calendar API in Google Cloud Console
   - Get Gemini API key from Google AI Studio
   - Configure OAuth consent screen

6. **Run the development server**
   ```bash
   npm run dev
   ```

## 📖 Usage

1. **Login** with your Google account
2. **Create Notes** - Click on any date to add notes with AI assistance
3. **Schedule Events** - Add timed events that sync with Google Calendar
4. **AI Features** - Use the AI button in notes for:
   - Text summarization
   - Grammar fixes
   - Writing improvements
   - Content expansion
   - Professional tone conversion

## 🎯 Key Features

### Calendar Views
- **Day View**: Timeline with hourly slots and all-day events
- **Month View**: Grid layout with colored dots for events

### Event Management
- Create, edit, and delete events
- Multi-day all-day events
- Priority-based color coding
- Automatic Google Calendar sync

### Note Taking
- Rich text editor with inline formatting
- AI-powered text enhancement
- Horizontal scrolling note carousel
- Real-time content saving

## 🔧 Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

## 📱 Mobile Support

BrainNot is fully responsive and provides an optimal experience on:
- 📱 Mobile phones
- 📱 Tablets
- 💻 Desktop computers

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Calendar API for seamless calendar integration
- Google Gemini AI for intelligent text processing
- Firebase for authentication and database services
- Tailwind CSS for beautiful, responsive design

---

Made with ❤️ for better productivity and note-taking