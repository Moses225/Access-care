# AccessCare - Maternal Healthcare Platform

![AccessCare Logo](./assets/images/AccessCare-logo.png)

**Connecting patients with quality healthcare, regardless of location.**

AccessCare is a comprehensive mobile healthcare platform that bridges the gap between patients and providers, with a special focus on maternal care and underserved communities.

---

## 🎯 Features

### Core Functionality
- ✅ **Provider Search & Discovery** - Search across 23+ healthcare providers in 3 service categories
- ✅ **Advanced Filtering** - Filter by category, specialty, distance, and availability
- ✅ **Real-time Appointments** - Book and manage appointments with Firebase integration
- ✅ **Interactive Maps** - Integrated navigation with turn-by-turn directions
- ✅ **Q&A System** - Ask questions and receive answers from healthcare professionals
- ✅ **Push Notifications** - Appointment reminders and updates
- ✅ **Profile Management** - Insurance info, payment methods, preferences
- ✅ **Dark Mode** - Full theme support for comfortable viewing
### Additional Features Implemented:
- ✅ **Profile Picture Upload** - Camera & gallery integration with Firebase Storage
- ✅ **Local Push Notifications** - Appointment confirmations with immediate alerts
- ✅ **23 Real Oklahoma Providers** - Unique addresses with accurate GPS coordinates
- ✅ **Native Navigation** - Opens Apple Maps (iOS) or Google Maps (Android)
- ✅ **Dark Mode** - Full theme support across all screens
- ✅ **Real-time Q&A** - Patient questions with admin dashboard responses

### Provider Network
**Core Services:**
- OB/GYN
- Midwives
- Hospitals
- Family Medicine
- Pediatricians

**Extended Services:**
- Maternal-Fetal Medicine
- Lactation Consultants
- Nutritionists
- Mental Health Providers
- Physical Therapists
- Social Workers

**Rare & Specialized Services:**
- Reproductive Endocrinologists
- Neonatologists
- Genetic Counselors
- Perinatal Mental Health Specialists
- Rheumatologists
- Infectious Disease Specialists
- Palliative Care
- Rare Disease Centers

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React Native with Expo
- **Language:** TypeScript
- **Navigation:** Expo Router (file-based routing)
- **UI:** Custom components with StyleSheet

### Backend
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth (Email/Password)
- **Storage:** Firebase Storage (Profile images)
- **Real-time Updates:** Firestore listeners

### Key Libraries
- `react-native-maps` - Map integration
- `expo-notifications` - Push notifications
- `expo-image-picker` - Profile picture upload
- `@react-native-async-storage/async-storage` - Local storage

---

## 📱 Screenshots

### Light Mode
![Welcome Screen](./screenshots/welcome-light.png)
![Find Care](./screenshots/find-care-light.png)
![Provider Detail](./screenshots/provider-detail-light.png)

### Dark Mode
![Welcome Screen Dark](./screenshots/welcome-dark.png)
![Find Care Dark](./screenshots/find-care-dark.png)
![Profile Dark](./screenshots/profile-dark.png)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Studio

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/YOUR_USERNAME/accesscare-app.git
   cd accesscare-app
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up Firebase**
   - Create a Firebase project at [https://firebase.google.com](https://firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Enable Storage
   - Copy your Firebase config to `firebase.ts`

4. **Update Firebase Configuration**
   
   Edit `firebase.ts` with your credentials:
```typescript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
```

5. **Run the app**
```bash
   npx expo start
```

6. **Open in simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

---

## 📂 Project Structure
```
AccessCare/
├── app/
│   ├── (tabs)/          # Main tab navigation
│   │   ├── index.tsx    # Find Care screen
│   │   ├── profile.tsx  # Profile screen
│   │   └── _layout.tsx  # Tab layout
│   ├── profile/         # Profile sub-screens
│   │   ├── appointments.tsx
│   │   ├── saved.tsx
│   │   ├── insurance.tsx
│   │   ├── payments.tsx
│   │   ├── notifications.tsx
│   │   ├── privacy.tsx
│   │   ├── help.tsx
│   │   ├── edit.tsx
│   │   └── theme.tsx
│   ├── provider/        # Provider screens
│   │   └── [id].tsx     # Provider detail (dynamic route)
│   ├── booking/         # Booking screens
│   │   └── [id].tsx     # Booking form (dynamic route)
│   ├── qa/              # Q&A system
│   │   └── index.tsx
│   ├── admin/           # Admin panel
│   │   └── qa.tsx
│   ├── welcome.tsx      # Welcome/landing screen
│   ├── index.tsx        # Login screen
│   ├── signup.tsx       # Sign up screen
│   ├── about.tsx        # About screen
│   └── _layout.tsx      # Root layout with auth
├── assets/
│   └── images/          # App images and logo
├── context/
│   └── ThemeContext.tsx # Dark mode theme provider
├── data/
│   └── providers.ts     # Provider data and types
├── utils/
│   └── notifications.ts # Notification utilities
├── firebase.ts          # Firebase configuration
├── app.json            # Expo configuration
├── package.json        # Dependencies
└── README.md           # This file
```

---

## 🔥 Firebase Collections

### `providers`
```typescript
{
  id: string
  name: string
  specialty: string
  category: string
  distance: number
  rating: number
  address: string
  phone: string
  available: boolean
  services: string[]
}
```

### `appointments`
```typescript
{
  userId: string
  providerId: string
  provider: string
  specialty: string
  date: string
  time: string
  reason: string
  status: string
  createdAt: Date
}
```

### `questions`
```typescript
{
  userId: string
  question: string
  answer?: string
  createdAt: Date
  answeredAt?: Date
}
```

### `users`
```typescript
{
  profileImage?: string
}
```

### `savedProviders`
```typescript
{
  userId: string
  providerId: string
  name: string
  specialty: string
  rating: number
  distance: number
}
```

### `insurance`
```typescript
{
  provider: string
  policy: string
}
```

### `paymentMethods`
```typescript
{
  userId: string
  cardNumber: string
}
```

### `notifications`
```typescript
{
  appointmentReminders: boolean
  generalUpdates: boolean
}
```

### `privacy`
```typescript
{
  shareData: boolean
  twoFactorAuth: boolean
}
```

### `supportRequests`
```typescript
{
  userId: string
  email: string
  message: string
  createdAt: Date
  status: string
}
```

---

## 🎨 Theme System

AccessCare includes a complete dark mode theme system.

**Toggle theme:**
Profile → Settings → Theme → Select Light/Dark/System

**Available colors:**
- `colors.background` - Main background color
- `colors.card` - Card/surface background
- `colors.text` - Primary text color
- `colors.subtext` - Secondary text color
- `colors.primary` - Accent color (purple)
- `colors.border` - Border color
- `colors.error` - Error/destructive actions
- `colors.success` - Success messages

---

## 🧪 Testing

### Test Accounts
Create test accounts using the signup flow or use:
```
Email: test@accesscare.com
Password: test123
```

### Testing Notifications
1. Book an appointment
2. Wait 5 seconds
3. Notification should appear

### Testing Dark Mode
1. Go to Profile
2. Click Theme
3. Select Dark Mode
4. Navigate through app to see changes

---

## 📊 Project Objectives Met

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Functional program without errors | ✅ | App runs smoothly on iOS/Android |
| Main + 3 additional screens | ✅ | 7+ major screens, 15+ total screens |
| View component | ✅ | Used throughout all screens |
| Text component | ✅ | All text rendered with Text |
| Image component | ✅ | Logo, profile pictures, avatars |
| TextInput component | ✅ | Search, forms, Q&A |
| StyleSheet | ✅ | All components styled |
| Button component | ✅ | TouchableOpacity throughout |
| Integrated map | ✅ | MapView in provider details |
| Local push notifications | ✅ | Appointment reminders |
| Firebase data storage | ✅ | 9+ collections with real-time sync |
| Design principles & clean UI | ✅ | Professional, consistent design |

---

## 🎯 Use Cases

### For Patients
1. **Find Nearby Providers** - Search by specialty, filter by distance
2. **Book Appointments** - Real-time scheduling with confirmation
3. **Ask Questions** - Get answers from professionals 24/7
4. **Navigate to Care** - Turn-by-turn directions to appointments
5. **Manage Health Info** - Insurance, payments, preferences

### For Remote/Rural Communities
1. **Discover Specialists** - Find rare disease centers and specialists
2. **Reduce Travel** - Ask questions remotely before traveling
3. **Plan Visits** - Get directions to unfamiliar facilities
4. **Access Support** - 24/7 Q&A reduces need for office calls

### For Healthcare Providers
1. **Answer Questions** - Admin panel to respond to patient queries
2. **Manage Availability** - Update schedule and availability
3. **View Bookings** - Track appointments in real-time

---

## 🚧 Future Enhancements

- [ ] Telemedicine integration (video calls)
- [ ] AI-powered symptom checker
- [ ] Insurance verification API
- [ ] Prescription management
- [ ] Lab results integration
- [ ] Multi-language support
- [ ] Health records storage (HIPAA compliant)
- [ ] Provider reviews and ratings
- [ ] Transportation booking integration
- [ ] Wearable device integration

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Developer

**Your Name**
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- **Expo** - For the amazing React Native framework
- **Firebase** - For backend infrastructure
- **React Native Maps** - For map integration
- **Oklahoma City Healthcare Providers** - For inspiration

---

## 📞 Support

For support, email support@accesscare.com or open an issue in this repository.

---

## 🌟 Star This Repo

If you found this project helpful, please give it a ⭐️!

---

**Built with ❤️ for better maternal healthcare access**
```

---

## 📝 STEP 2: Create .gitignore

**Create `.gitignore` in project root:**
```
# Dependencies
node_modules/

# Expo
.expo/
.expo-shared/
dist/
web-build/

# Native
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# Debug
npm-debug.*
yarn-debug.*
yarn-error.*
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Env files (if you add them later)
.env
.env.local
.env.production

# TypeScript
*.tsbuildinfo