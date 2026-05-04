# ParkAlert 🚔

ParkAlert is a modern, mobile-first government parking enforcement system designed to streamline the process of reporting parking violations and managing vehicle compliance.

## 🚀 Overview

The system provides three distinct interfaces tailored to different user roles:
- **Citizen (Owner) Dashboard**: Allows vehicle owners to register their cars, track their registration status, view/pay fines, and transfer ownership securely.
- **Agent Portal**: A specialized interface for traffic wardens to quickly report illegally parked vehicles with photo evidence and license plate recognition.
- **Police Control Panel**: A high-level dashboard for police officers to review agent reports, issue fines, and approve/reject vehicle registration and ownership transfer requests.

## 🛠 Tech Stack

### Frontend
- **Framework**: [Nuxt 4](https://nuxt.com/) (configured as an SPA)
- **UI Library**: [Nuxt UI](https://ui.nuxt.com/) (Tailwind CSS based)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Firebase Integration**: [VueFire](https://vuefire.vuejs.org/) & `httpsCallable` for backend interaction.
- **Internationalization**: `@nuxtjs/i18n` (Multi-language support: EN, FR, AR).
- **Design Pattern**: Atomic Design (Atoms, Molecules, Organisms).

### Backend
- **Framework**: [Firebase Cloud Functions v2](https://firebase.google.com/docs/functions) (Node.js/TypeScript)
- **Database**: [Firestore](https://firebase.google.com/docs/firestore)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **Storage**: [Firebase Storage](https://firebase.google.com/docs/storage) (for vehicle documents and report photos).

## 🏗 Architecture

### Backend: Hexagonal Architecture (Ports & Adapters)
The backend is structured to ensure that business logic remains decoupled from external frameworks and the database.

- **Domain Layer (`src/domain`)**: Contains core business entities (`User`, `Car`, `Report`, `Fine`) and Repository interfaces (Ports).
- **Application Layer (`src/application`)**: Implemented as pure Use Cases (e.g., `IssueFineUseCase`, `ApproveTransferUseCase`). Each use case encapsulates a single business operation.
- **Infrastructure Layer (`src/infrastructure`)**:
    - **Adapters (`persistence`)**: Concrete implementations of the repositories using Firestore.
    - **Connectors**: Centralized management of Firebase Admin SDK dependencies.
    - **Entry Points**: Firebase `onCall` functions that act as the delivery mechanism, orchestrating authentication and use case execution.

### Frontend: Atomic Design
Components are organized into hierarchy-based categories to promote reusability and consistency:
- **Atoms**: Basic building blocks (buttons, inputs, badges).
- **Molecules**: Groups of atoms working together (search bars, user avatars).
- **Organisms**: Complex UI sections (Vehicle tabs, Profile cards, Modals).
- **Templates**: Page layouts and structural containers.

## 📦 Project Structure

```text
├── front/                # Nuxt 4 Frontend
│   ├── app/
│   │   ├── components/   # Atomic Design components
│   │   ├── pages/        # Role-based routes
│   │   └── stores/       # Pinia state management
├── functions/            # Firebase Backend
│   ├── src/
│   │   ├── domain/       # Entities & Ports
│   │   ├── application/  # Use Cases
│   │   └── infrastructure/# Adapters & Entry Points
├── firestore.rules       # Database Security Rules
└── storage.rules         # Storage Security Rules
```

## 🛠 Setup & Development

### Prerequisites
- Node.js (v20+)
- Firebase CLI (`npm install -g firebase-tools`)
- pnpm (`npm install -g pnpm`)

### Local Development

1. **Install Dependencies**:
   ```bash
   pnpm install
   cd front && pnpm install
   cd ../functions && pnpm install
   ```

2. **Run with Emulators**:
   From the project root:
   ```bash
   # Start the frontend dev server
   cd front && pnpm dev
   
   # In another terminal, start Firebase Emulators
   firebase emulators:start
   ```

## 🛡 Code Quality
We use **ESLint** and **Husky** to maintain high code standards.
- **Pre-commit hooks**: Automatically lint both frontend and backend code before every commit.
- **Linting**:
  - Frontend: `cd front && pnpm lint`
  - Backend: `cd functions && pnpm lint`

## 🔒 Security
- **Firestore Rules**: Strict role-based access control (RBAC).
- **Backend Validation**: Every Use Case validates the user's role and ownership before performing sensitive operations.
- **Storage Security**: Files are scoped to user IDs and required documentation is only accessible to authorized personnel.
