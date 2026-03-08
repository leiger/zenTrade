---
name: Project Overview & Structure
description: A comprehensive guide to the ZenTrade project structure, core technologies, and functional modules.
---

# ZenTrade Project Overview

ZenTrade is a personal asset management tool designed to track investment logic, visualize decision processes, and provide AI-assisted review to eliminate emotional interference.

## Technology Stack

### Frontend (zentrade-app)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Lucide React
- **State Management**: Zustand
- **Date Handling**: date-fns
- **Theming**: next-themes (Light/Dark mode)

### Backend (zentrade-backend)
- **Framework**: FastAPI
- **Language**: Python
- **Database**: SQLite

## Project Structure

```text
zenTrade/                        # Monorepo root
├── .agent/                      # Agent-specific skills and workflows
├── .cursorrules                 # Cursor workspace rules
├── .gitignore                   # Root-level gitignore
├── zentrade-app/                # Next.js frontend
│   ├── src/
│   │   ├── app/                 # App Router (Pages, Layouts)
│   │   │   ├── thesis/          # Thesis Tracker module pages
│   │   │   └── globals.css      # Global styles & Tailwind layers
│   │   ├── components/
│   │   │   ├── modules/         # Feature-specific components
│   │   │   │   └── thesis-tracker/
│   │   │   ├── shared/          # Reusable app-wide components (Sidebar, etc.)
│   │   │   └── ui/              # shadcn/ui base components
│   │   ├── constants/           # Global constants and presets
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities and state stores
│   │   └── types/               # TypeScript interfaces and types
│   ├── .prettierrc
│   └── components.json          # shadcn/ui configuration
└── zentrade-backend/            # FastAPI backend
    ├── app/                     # Backend application code
    └── requirements.txt
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
