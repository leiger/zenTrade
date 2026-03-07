---
name: Project Overview & Structure
description: A comprehensive guide to the ZenTrade project structure, core technologies, and functional modules.
---

# ZenTrade Project Overview

ZenTrade is a personal asset management tool designed to track investment logic, visualize decision processes, and provide AI-assisted review to eliminate emotional interference.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Lucide React
- **State Management**: Zustand
- **Date Handling**: date-fns
- **Theming**: next-themes (Light/Dark mode)

## Project Structure

```text
zentrade-app/
├── src/
│   ├── app/                # Next.js App Router (Pages, Layouts)
│   │   ├── thesis/         # Thesis Tracker module pages
│   │   └── globals.css     # Global styles & Tailwind layers
│   ├── components/
│   │   ├── modules/        # Feature-specific components
│   │   │   └── thesis-tracker/ # Components for the Thesis Tracker
│   │   ├── shared/         # Reusable application-wide components (Sidebar, etc.)
│   │   └── ui/             # shadcn/ui base components
│   ├── constants/          # Global constants and presets (Tags, Zones)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and shared state stores
│   │   ├── store.ts        # Zustand store for global state
│   │   └── utils.ts        # Common utility functions (cn)
│   └── types/              # TypeScript interfaces and types
├── .agent/                 # Agent-specific skills and workflows
├── .prettierrc             # Code formatting configuration
└── components.json         # shadcn/ui configuration
```

## Core Functional Modules

### 1. Thesis Tracker (认知追踪)
The core module for recording investment "theses" (judgments/logic).
- **Thesis List**: Overview of all active investment judgments.
- **Thesis Detail**: Deep dive into a specific thesis, including its lifecycle.
- **Snapshots**: Point-in-time recordings of judgment status, forming a timeline for review.
- **Tagging System**: Categorization by "Buy Reasons" and "Sell Reasons".

### 2. Decision Firewall (决策防火墙) - *Phase 2*
Planned module to enforce discipline before trade execution.

### 3. Analytics (深度分析) - *Phase 2*
Planned module for data visualization and cognitive bias analysis.

## Development Standards

- **Formatting**: Indentation is standardized to **2 spaces** via `.prettierrc`.
- **Git Commits**: Follow the `git-commit-standard` (Conventional Commits in English).
- **UI Consistency**: Leverage shadcn/ui components and maintain standard heights (`h-9` for inputs/selects).
