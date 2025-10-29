# CoGrader API - Real-Time Image Processing Pipeline

Backend API for the CoGrader Full-Stack Challenge. A production-grade NestJS application that processes images asynchronously using BullMQ, with Firebase integration for storage and real-time updates.

## 🎯 Overview

This API provides a robust image processing pipeline that:
- Accepts image URLs for processing
- Downloads and validates images
- Applies transformations (resize, grayscale, watermark)
- Uploads results to Firebase Storage
- Provides real-time job status updates via Firebase Realtime Database

## 🏗️ Architecture

### Tech Stack
- **Framework**: NestJS (TypeScript)
- **Queue System**: BullMQ + Redis
- **Database**: Firebase Realtime Database
- **Storage**: Firebase Storage
- **Image Processing**: Sharp
- **Validation**: class-validator

### Key Components

```
src/
├── modules/
│   ├── jobs/              # Job creation and management
│   │   ├── dto/           # Data transfer objects
│   │   ├── jobs.controller.ts
│   │   └── jobs.service.ts
│   ├── queue/             # BullMQ queue management
│   │   ├── queue.service.ts
│   │   └── redis-health.service.ts
│   └── images/            # Image processing worker
│       └── processing/
│           └── processing.service.ts
└── shared/
    └── google/firebase/   # Firebase integration
        ├── firebase-init.service.ts
        ├── firebase-database.service.ts
        └── storage/
            └── firebase-storage.service.ts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)
- Redis (running locally or remote)
- Firebase project with:
  - Realtime Database enabled
  - Storage bucket created
  - Service account credentials

### Installation

```bash
# Install dependencies
pnpm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Firebase Admin SDK
# Get from Firebase Console > Project Settings > Service Accounts
GOOGLE_FIREBASE_ADMIN_SDK={"type":"service_account","project_id":"...","private_key":"..."}

# Server Configuration
PORT=8080
NODE_ENV=development
```

### Firebase Storage Rules

Update your Firebase Storage rules to allow public read access:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;  // Public read access
      allow write: if false; // Write only via backend
    }
  }
}
```

### Running the Application

```bash
# Development mode (with hot reload)
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

The API will be available at `http://localhost:8080`

## 📡 API Endpoints

### Health Check

#### Check Redis Connection
```bash
GET /api/queue/health
```

**Response:**
```json
{
  "redis": {
    "connected": true,
    "status": "healthy"
  }
}
```

### Jobs

#### Create a New Job
```bash
POST /api/jobs
Content-Type: application/json

{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "imageUrl": "https://example.com/image.jpg",
  "status": "pending",
  "progress": 0,
  "createdAt": "2025-10-29T17:30:00.000Z",
  "updatedAt": "2025-10-29T17:30:00.000Z"
}
```

#### Get Job Status
```bash
GET /api/jobs/:id
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "imageUrl": "https://example.com/image.jpg",
  "status": "completed",
  "progress": 100,
  "resultUrl": "https://storage.googleapis.com/...",
  "createdAt": "2025-10-29T17:30:00.000Z",
  "updatedAt": "2025-10-29T17:30:15.000Z"
}
```

#### List All Jobs
```bash
GET /api/jobs
```

## 🔄 Image Processing Pipeline

1. **Job Creation** (`POST /api/jobs`)
   - Validates image URL format
   - Creates job record in Firebase
   - Adds job to BullMQ queue

2. **Worker Processing** (Automatic)
   - Downloads image from URL (30s timeout, 10MB max)
   - Validates format (PNG, JPG, WEBP)
   - Applies transformations:
     - Resize to 800x600 (maintains aspect ratio)
     - Convert to grayscale
     - Add "Processed by CoGrader" watermark
   - Uploads to Firebase Storage
   - Updates job status at each step

3. **Real-time Updates**
   - Firebase Realtime Database tracks progress
   - Frontend receives updates via Firebase listeners
   - No polling required

## 🧪 Testing

### Manual Testing with cURL

#### Valid Image
```bash
curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"}'
```

#### Invalid URL (404)
```bash
curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://httpstat.us/404"}'
```

#### Non-Image URL
```bash
curl -X POST http://localhost:8080/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://www.google.com"}'
```

#### Multiple Jobs Simultaneously
```bash
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/jobs \
    -H "Content-Type: application/json" \
    -d '{"imageUrl": "https://picsum.photos/1200/800"}' &
done
wait
```

### Unit Tests
```bash
# Run unit tests
pnpm run test

# Run with coverage
pnpm run test:cov

# Run e2e tests
pnpm run test:e2e
```

## 🔍 Error Handling

The API handles the following error cases:

- **404 Not Found**: Image URL returns 404
- **Invalid Format**: URL doesn't point to PNG/JPG/WEBP
- **Image Too Large**: File exceeds 10MB limit
- **Network Timeout**: Download takes longer than 30s
- **Transformation Failed**: Sharp processing error
- **Storage Upload Failed**: Firebase Storage error

All errors return appropriate HTTP status codes and error messages.

## 📊 Monitoring

### Application Logs

Structured logging format:
```
{TYPE}.{ServiceName}.{MethodName}.{Action} { context }
```

Example:
```
INFO.ImageProcessingService.processImage.success {
  jobId: '550e8400-...',
  imageUrl: 'https://...',
  message: 'Image processing completed'
}
```

### Redis Connection Status

Check at startup:
```
✅ Redis connection established { host: 'localhost', port: 6379 }
✅ Firebase Admin SDK initialized
✅ Firebase Realtime Database ready
✅ Firebase Storage ready { bucketName: 'test-gograder.firebasestorage.app' }
```

## 🚢 Deployment

### Google Cloud Run (Recommended)

```bash
# Build Docker image
docker build -t cograder-api .

# Deploy to Cloud Run
gcloud run deploy cograder-api \
  --image cograder-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Variables for Production

Set these in your deployment platform:
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `GOOGLE_FIREBASE_ADMIN_SDK`
- `NODE_ENV=production`
- `PORT=8080`

## 📝 Key Design Decisions

1. **BullMQ over other queue systems**
   - Robust Redis-based queue
   - Automatic retries with exponential backoff
   - Job progress tracking
   - Concurrent processing

2. **Firebase for real-time updates**
   - WebSocket-based real-time listeners
   - No polling required
   - Automatic reconnection
   - Built-in offline support

3. **Sharp for image processing**
   - Fast, memory-efficient
   - Native bindings (no ImageMagick dependency)
   - Stream-based processing
   - Wide format support

4. **Modular architecture**
   - Separation of concerns (jobs, queue, images, firebase)
   - Easy to test and maintain
   - Scalable design

5. **i18n-ready message system**
   - All messages and errors use SNAKE_CASE keys
   - Centralized in `src/shared/constants/messages.enum.ts`
   - Frontend can translate keys to any language
   - Example: `IMAGE_PROCESSING_STARTING` → translatable

## 🌍 Internationalization (i18n)

All user-facing messages and errors are defined as SNAKE_CASE constants, making them easy to translate in the frontend.

### Message Enums

```typescript
// src/shared/constants/messages.enum.ts
export enum ImageProcessingMessage {
  STARTING = 'IMAGE_PROCESSING_STARTING',
  COMPLETED = 'IMAGE_PROCESSING_COMPLETED',
}

export enum ImageProcessingError {
  NOT_FOUND = 'IMAGE_NOT_FOUND_404',
  TOO_LARGE = 'IMAGE_TOO_LARGE',
  // ...
}
```

### API Response Example

```json
{
  "id": "550e8400-...",
  "status": "failed",
  "error": "IMAGE_NOT_FOUND_404"
}
```

### Frontend Translation

```typescript
// Frontend i18n setup
const translations = {
  en: {
    IMAGE_NOT_FOUND_404: "Image not found (404)",
    IMAGE_TOO_LARGE: "Image is too large (max 10MB)"
  },
  pt: {
    IMAGE_NOT_FOUND_404: "Imagem não encontrada (404)",
    IMAGE_TOO_LARGE: "Imagem muito grande (máx 10MB)"
  }
}

// Usage
t(error.message) // Translates the key to current language
```

### Available Message Categories

- **ImageProcessingMessage**: Success messages for processing steps
- **ImageProcessingError**: Error messages for image operations
- **ValidationMessage**: Form validation errors
- **FirebaseMessage**: Firebase initialization and status
- **FirebaseError**: Firebase operation errors

## 🤝 Contributing

This is a challenge project. For the actual implementation:
1. Focus on code correctness over speed
2. Anticipate edge cases and errors
3. Write clear, maintainable code
4. Document key decisions

## 📄 License

UNLICENSED - Challenge project for CoGrader

---

**Built with ❤️ using NestJS, BullMQ, and Firebase**
