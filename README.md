# Moustapha Gueye — Developer Portfolio

### Software Engineering | Computer Science | Quantitative Development

**TypeScript · React · Vite · Software Architecture · Type Safety · Frontend Engineering**

[**Live Website — mousholdings.com**](https://mousholdings.com)

## Overview

This repository contains the source code for my personal developer portfolio, built to showcase my technical projects, software engineering experience, and interests in computer science and quantitative development.

Developed with React, TypeScript, and Vite, the application emphasizes modular architecture, reusable components, type-safe development, and maintainable code.

The portfolio serves as a central platform for presenting my engineering work, professional experience, and ongoing technical development.

## Engineering Highlights

### Type-Safe Application Development

- Built the application using **TypeScript** to support static type checking and improve code maintainability.
- Integrated TypeScript compilation into the production build process.
- Configured separate TypeScript settings for application code and development tooling.

**Relevant concepts:** Type Safety, Static Analysis, Compile-Time Validation, Software Reliability

### Modular Software Architecture

- Organized the application into reusable React components with distinct responsibilities.
- Separated site content, custom hooks, and presentation logic.
- Implemented custom hooks for section tracking and reduced-motion preferences.
- Structured the application to simplify updates and future feature development.

**Relevant concepts:** Modular Design, Component Architecture, Separation of Concerns, Code Reusability

### User Interface & Accessibility

- Developed a responsive, component-based interface for presenting projects and experience.
- Implemented section-aware navigation using a custom React hook.
- Incorporated reduced-motion preferences and keyboard-accessible navigation.
- Integrated Vercel Analytics for website usage insights.

**Relevant concepts:** Event-Driven Programming, React Hooks, Accessibility, Frontend Engineering

## Technology Stack

| Category | Technologies |
|---|---|
| Programming Languages | TypeScript, JavaScript, HTML, CSS |
| Frontend Framework | React 18 |
| Development Tooling | Vite |
| Type Checking | TypeScript Compiler |
| Deployment | Vercel |
| Analytics | Vercel Analytics |
| Version Control | Git, GitHub |

## Project Architecture

```text
Portfolio/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   ├── data/               # Structured website content
│   ├── hooks/              # Custom React hooks
│   └── App.tsx             # Main application composition
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tsconfig.app.json       # Application TypeScript configuration
├── tsconfig.node.json      # Tooling TypeScript configuration
├── vite.config.ts          # Vite configuration
└── vercel.json             # Deployment configuration
```

The application uses a component-based architecture to separate presentation, content, and shared behavior.

## Getting Started

### Prerequisites

- Node.js
- npm
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/MousScales/Portfolio.git
cd Portfolio
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development URL displayed in the terminal.

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript compilation and generate a production build |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Perform TypeScript checks without emitting files |

## Build & Deployment

The portfolio uses Vite for development and production builds, with Vercel configuration for deployment.

To generate a production build:

```bash
npm run build
```

The build process performs TypeScript checks before generating optimized production assets in the `dist/` directory.

**Live deployment:** [mousholdings.com](https://mousholdings.com)

## Engineering Focus

This project demonstrates foundational software engineering practices relevant to larger, more complex systems:

- **Type Safety:** Using static analysis to identify errors before runtime.
- **Modularity:** Separating application responsibilities into independent components.
- **Maintainability:** Organizing code to support future development and iteration.
- **Event-Driven Programming:** Managing user interactions and interface state through React hooks.
- **Build Automation:** Incorporating type checking and production compilation into a repeatable workflow.

These principles provide a foundation for further work in systems programming, data-intensive applications, and quantitative software engineering.

## About Me

I'm Moustapha Gueye, a Computer & Data Science student at New York University with interests in software engineering, systems programming, and quantitative development.

My technical interests include C++, Python, algorithms, data structures, and the engineering of reliable, high-performance software.

Through independent projects and software development, I aim to strengthen my programming fundamentals and build systems that solve meaningful technical problems.

## Contact

**Moustapha Gueye**

- **Portfolio:** [mousholdings.com](https://mousholdings.com)
- **GitHub:** [@MousScales](https://github.com/MousScales)

---

© 2026 Moustapha Gueye. All rights reserved.
