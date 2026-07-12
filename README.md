# People's Priorities

### Priority Based Constituency Planning.

> Turning citizen text,photo,voices into Priority-based development decisions using AI.

![Build with AI - Google Hackathon](https://img.shields.io/badge/Build%20with%20AI-Google%20Hackathon-green)

## The Vision

**People's Priorities** is an intelligent constituency planning platform that helps Members of Parliament (MPs) and local authorities identify exactly what their citizens need.

Instead of relying on paper surveys, Twitter complaints, or scattered emails, citizens can report issues naturally—by speaking in their local language, taking a quick photo, or typing a text. The platform's Artificial Intelligence understands every report, removes noise, and plots real, verified infrastructure problems on a live map. 

It generates transparent, ranked development priorities so governments can make evidence-based decisions that actually reflect what the people want.

## The Technical Architecture 

People's Priorities is built to be resilient system where Admin cant delete citizen's Report. 

### 1. Robust AI Intake Pipelines
- **Voice Reporting**: The browser captures raw audio via `MediaRecorder` alongside a live heuristic `webkitSpeechRecognition` text hint. Both are sent to a stateless Vercel Node.js backend (`/api/analyze-report-audio`). The backend securely calls **Gemini 2.5 Flash Multimodal** to natively transcribe the audio. If network latency cuts the audio short, the backend dynamically merges the browser's live text hint with the audio stream to ensure no words are lost.
- **Photo Reporting**: The browser captures and compresses an image into a raw JPEG Blob. A custom binary-safe parser on Vercel (`/api/analyze-report-image`) forwards these exact raw bytes directly to **Gemini Multimodal AI** for visual verification. If a citizen uploads a selfie instead of a broken road, the AI rejects it instantly (protecting database storage and preventing spam).

### 2. Real-Time Sync & Data Integrity
- **Local-First Ledger**: The app uses `IndexedDB` for instant, zero-latency saving of high-resolution reports on the citizen's device.
- **Strict Cloud-Only Sync**: To guarantee perfect mathematical alignment of report counts across all devices, the app utilizes a Strict Cloud-Only Sync mechanism via **Firebase Cloud Firestore**. It actively deduplicates reports across the nationwide network in real-time.
- **Dynamic Region Clustering**: The React frontend executes a powerful `ClusterEngine` that dynamically aggregates individual citizen demand pins into prioritized Action Mandate Clusters based on the MP's selected viewing region (e.g., Koraput PC vs All India).



## 🚀 Key Features

- 🎤 **Multimodal Reporting**: Voice, Photo & Text pipelines with automatic spam rejection.
- 🌍 **Multilingual AI**: Native understanding of Odia, Hindi, Telugu, and English.
- 🗺️ **Interactive GIS Map**: Real-time Leaflet & OpenStreetMap clustering.
- 🤖 **Automated Priority Engine**: AI categorizes, scores severity (0-100), and ranks issues automatically.
- 🏛️ **Decision Support Dashboard**: Aggregates hundreds of reports into ranked infrastructure categories (Roads, Water, Healthcare).



## 🏗️ Tech Stack

**Frontend**
- React 19, TypeScript, Vite
- Tailwind CSS, shadcn/ui
- Leaflet.js (Interactive Maps)
- IndexedDB (Offline-first storage)

**Backend & Infrastructure**
- Vercel Serverless Functions (Secure API proxying)
- Firebase Cloud Firestore (Real-time NoSQL database)
- Firebase Storage (Evidence image hosting)

**Artificial Intelligence**
- Google Gemini 2.5 Pro / Flash APIs
- Native Multimodal Processing (Audio + Vision)



## 📊 Technical Data Flow

```text
Citizen (Voice/Photo)
        │
        ▼ (Multipart Stream)
Vercel Serverless API (Rate-Limited)
        │
        ▼ (Secure API Key)
Google Gemini AI (Audio/Vision Analysis)
        │
        ▼ (Structured JSON)
React Client (IndexedDB Instant Save)
        │
        ▼ (Background Sync)
Firebase Cloud Firestore
        │
        ▼ (Real-time Snapshot)
ClusterEngine / MP Dashboard
```


## 👨‍💻 Team

**Team Mango**
- **Ajay Bala** - Solo Participant

## 🔗 Links

- **Live Demo**: [https://peoples-priorities-aiflow.vercel.app/](https://peoples-priorities-aiflow.vercel.app/)
- **GitHub**: [https://github.com/Ajayrx/peoples-priorities-aiflow](https://github.com/Ajayrx/peoples-priorities-aiflow)

---

 ⭐ If you like this project, consider giving it a star!
